import { FinanceError } from '../db/financeStore.js';
import { CommercialService } from './commercialService.js';
import { WebsiteBusinessService } from './websiteBusinessService.js';
/**
 * Centralized Fulfilment Service
 * Orchestrates preflight checks and post-payment supplier dispatch for Data Bundles.
 * Serves as the single source of truth for both Paystack Webhooks and Verify API.
 */

import { AfaStore } from '../db/afaStore.js';
import { FinanceService } from './financeService.js';
import { AfaService } from './afaService.js';
import { ResultsCheckerService } from './resultsCheckerService.js';
import { OrdersStore } from '../db/ordersStore.js';
import { OrderRecord, OrderStatus } from '../types/orders.js';
import { SuccessBizHubProvider } from '../suppliers/successBizHub/provider.js';
import { SuccessBizHubClient } from '../suppliers/successBizHub/client.js';
import { DEFAULT_SUPPLIER_ROUTES, SupplierRegistry, resolveSupplierRoute, resolveOrderSupplier, legacySuccessBizHubIdentity, SupplierRoutingError, type SupplierRouteContext } from '../suppliers/supplierRouting.js';
import { SUPPLIER_NETWORKS, SUPPLIER_SERVICES, type SupplierRoutingOverview } from '../../shared/supplierRouting.js';
import {observeSalesPreflight,noteSalesFailure} from './salesReliability.js';

export type PreflightErrorCode =
  | 'BENEFICIARY_NOT_ELIGIBLE'
  | 'BENEFICIARY_CHECK_UNAVAILABLE'
  | 'SUPPLIER_WALLET_LOW'
  | 'SERVICE_TEMPORARILY_UNAVAILABLE'
  | 'PACKAGE_UNAVAILABLE'
  | 'ACTIVE_MTN_ORDER';

export interface PreflightResult {
  allowed: boolean;
  code?: PreflightErrorCode;
  customerMessage?: string;
  internalReason?: string;
  supplierCostMinor?: number;
  supplierOfferRef?: string;
  timings?: {
    servicesMs: number;
    catalogMs: number;
    beneficiaryMs: number;
    walletMs: number;
    totalMs: number;
  };
}

export class FulfilmentService {
  private static provider = new SuccessBizHubProvider(new SuccessBizHubClient());

  public static getProvider(): SuccessBizHubProvider {
    return this.provider;
  }

  /** Catalogue compatibility accessor above is SBH-specific. Order execution never consults defaults. */
  private static registry(): SupplierRegistry {
    return new SupplierRegistry([
      { id: 'success_biz_hub', name: 'Success Biz Hub', provider: this.provider, services: SUPPLIER_SERVICES, networks: SUPPLIER_NETWORKS, plannedServices: [], configured: this.provider.client.isConfigured(), qualified: true, acceptsNewOrders: true },
      { id: 'telcogh', name: 'TELCOGH', provider: null, services: [], networks: [], plannedServices: ['data', 'airtime'], configured: false, qualified: false, acceptsNewOrders: false },
    ]);
  }
  static resolveRoute(context: SupplierRouteContext) {
    // Disabled fulfillment retains the existing test/queued flow. Enabled production requires credentials.
    try { return resolveSupplierRoute(this.registry(), context, undefined, this.provider.client.isFulfillmentEnabled()); }
    catch { throw new FinanceError('Supplier service is temporarily unavailable. No payment has been taken.',503); }
  }
  static getProviderForOrder(order: OrderRecord): SuccessBizHubProvider {
    if (['afa', 'results_checker'].includes(order.service_type || '')) {
      if (order.supplier_provider !== 'success_biz_hub' && !legacySuccessBizHubIdentity(order)) throw new SupplierRoutingError('UNAVAILABLE_PROVIDER');
    } else if (resolveOrderSupplier(this.registry(), order).id !== 'success_biz_hub') {
      throw new SupplierRoutingError('UNAVAILABLE_PROVIDER');
    }
    // Explicit compatibility bridge: future providers require their own qualified preflight/status adapter.
    return this.provider;
  }
  static async preflightExistingData(order: OrderRecord): Promise<PreflightResult> {
    this.getProviderForOrder(order);
    return observeSalesPreflight('data',()=>this.preflightData(order.network,order.bundle_size_snapshot,order.recipient_phone));
  }
  static routingOverview(): SupplierRoutingOverview {
    const registry = this.registry();
    return { mode: 'read_only', providers: registry.list().map(p => ({ id: p.id, name: p.name, implementedServices: p.services, plannedServices: p.plannedServices, networks: p.networks, configured: p.configured, qualified: p.qualified, acceptsNewOrders: p.acceptsNewOrders && p.configured && this.provider.client.isFulfillmentEnabled(), restriction: p.id === 'telcogh' ? 'Not integrated or qualified. Activation is unavailable in this release.' : 'Existing fulfillment configuration, preflight and payment safeguards remain required.' })), routes: DEFAULT_SUPPLIER_ROUTES.map(route => ({...route})) };
  }

  /**
   * Helper to determine if Paystack is running in test mode
   */
  public static isTestPaymentEnvironment(): boolean {
    const key = (process.env.PAYSTACK_SECRET_KEY || '').trim();
    if (!key) return true;
    return key.startsWith('sk_test_');
  }

  /**
   * 1. SUPPLIER PREFLIGHT CHECK
   * Executed before initializing a Paystack transaction when fulfillment is enabled.
   */
  static async preflightCheck(
    network: string, bundleSize: string, recipientPhone: string
  ): Promise<PreflightResult> {
    try { this.resolveRoute({service:'data',network}); } catch { return {allowed:false,code:'SERVICE_TEMPORARILY_UNAVAILABLE',customerMessage:'Supplier service is temporarily unavailable.'}; }
    return observeSalesPreflight('data',()=>this.preflightData(network,bundleSize,recipientPhone));
  }
  private static async preflightData(
    network: string,
    bundleSize: string,
    recipientPhone: string
  ): Promise<PreflightResult> {
    const isEnabled = this.provider.client.isFulfillmentEnabled();

    // When fulfillment is disabled, preserve test payment flow without calling supplier
    if (!isEnabled) {
      return { allowed: true };
    }

    if (!this.provider.client.isConfigured()) {
      noteSalesFailure('application','configuration',true);
      console.error('[Fulfilment Preflight] Fulfilment is enabled but SUCCESS_BIZ_HUB_API_KEY is not configured.');
      return {
        allowed: false,
        code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
        customerMessage: 'This bundle is temporarily unavailable. Please try another package or try again shortly.',
        internalReason: 'SUCCESS_BIZ_HUB_API_KEY is missing.',
      };
    }

    const startPreflight = performance.now();
    try {
      // Step A: Run checkServicesAvailable and resolvePackage concurrently
      // Genuinely independent discovery queries
      const [servicesCheckResult, resolvedResult] = await Promise.all([
        (async () => {
          const s0 = performance.now();
          const res = await this.provider.checkServicesAvailable();
          return { res, ms: Math.round(performance.now() - s0) };
        })(),
        (async () => {
          const c0 = performance.now();
          const res = await this.provider.resolvePackage(network, bundleSize);
          return { res, ms: Math.round(performance.now() - c0) };
        })(),
      ]);

      const servicesMs = servicesCheckResult.ms;
      const catalogMs = resolvedResult.ms;

      if (!servicesCheckResult.res.available) {
        noteSalesFailure('services','service_unavailable',true);
        console.warn('[Fulfilment Preflight] Service availability not confirmed.');
        return {
          allowed: false,
          code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
          customerMessage: 'We could not confirm service availability. No payment has been taken. Please try again shortly.',
          internalReason: servicesCheckResult.res.reason,
          timings: { servicesMs, catalogMs, beneficiaryMs: 0, walletMs: 0, totalMs: Math.round(performance.now() - startPreflight) },
        };
      }

      if (!resolvedResult.res.resolved) {
        console.warn('[Fulfilment Preflight] Package resolution not confirmed.');
        return {
          allowed: false,
          code: 'PACKAGE_UNAVAILABLE',
          customerMessage: 'This bundle is temporarily unavailable. Please try another package or try again shortly.',
          internalReason: resolvedResult.res.error,
          timings: { servicesMs, catalogMs, beneficiaryMs: 0, walletMs: 0, totalMs: Math.round(performance.now() - startPreflight) },
        };
      }

      const supplierPackage = resolvedResult.res.resolved;
      if(!Number.isSafeInteger(supplierPackage.supplierCostMinor)||supplierPackage.supplierCostMinor<=0){
        noteSalesFailure('catalog','supplier_response',true);
        return {allowed:false,code:'PACKAGE_UNAVAILABLE',customerMessage:'This bundle is temporarily unavailable.',internalReason:'Invalid authoritative supplier cost.'};
      }

      // Step B: Now that authoritative package is resolved, checkBeneficiaryEligibility and getBalance
      // are genuinely independent. Run them concurrently.
      const [beneficiaryResult, walletResult] = await Promise.all([
        (async () => {
          const b0 = performance.now();
          const res = await this.provider.checkBeneficiaryEligibility(recipientPhone, {
            offerSlug: supplierPackage.offerSlug,
            offerId: supplierPackage.offerId,
          });
          return { res, ms: Math.round(performance.now() - b0) };
        })(),
        (async () => {
          const w0 = performance.now();
          try {
            const res = await this.provider.getBalance();
            return { res, ms: Math.round(performance.now() - w0), error: null };
          } catch (walletErr) {
            return { res: null, ms: Math.round(performance.now() - w0), error: walletErr };
          }
        })(),
      ]);

      const beneficiaryMs = beneficiaryResult.ms;
      const walletMs = walletResult.ms;

      if (!beneficiaryResult.res.eligible) {
        const confirmed=beneficiaryResult.res.outcome==='ineligible';
        return {
          allowed: false,
          code: confirmed?'BENEFICIARY_NOT_ELIGIBLE':'BENEFICIARY_CHECK_UNAVAILABLE',
          customerMessage: confirmed?'The recipient is not eligible for this selected bundle.':'We could not confirm recipient eligibility. Please try again later.',
          internalReason: confirmed?'Confirmed recipient denial.':'Eligibility evidence unavailable.',
          timings: { servicesMs, catalogMs, beneficiaryMs, walletMs, totalMs: Math.round(performance.now() - startPreflight) },
        };
      }

      if (walletResult.error || !walletResult.res) {
        noteSalesFailure('wallet','supplier_response',true);
        console.warn('[Fulfilment Preflight] Wallet check unavailable; failing closed.');
        return {
          allowed: false,
          code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
          customerMessage: 'This bundle is temporarily unavailable. Please try another package or try again shortly.',
          internalReason: 'Supplier wallet check failed.',
          timings: { servicesMs, catalogMs, beneficiaryMs, walletMs, totalMs: Math.round(performance.now() - startPreflight) },
        };
      }

      if (walletResult.res.balancePesewas < supplierPackage.supplierCostMinor) {
        noteSalesFailure('wallet','wallet_low',true);
        console.error(
          '[Fulfilment Preflight] Supplier balance restriction.'
        );
        return {
          allowed: false,
          code: 'SUPPLIER_WALLET_LOW',
          customerMessage: 'This bundle is temporarily unavailable. Please try another package or try again shortly.',
          internalReason: 'Insufficient supplier wallet balance.',
          timings: { servicesMs, catalogMs, beneficiaryMs, walletMs, totalMs: Math.round(performance.now() - startPreflight) },
        };
      }

      return {
        allowed: true,
        supplierCostMinor: supplierPackage.supplierCostMinor,
        supplierOfferRef: supplierPackage.offerSlug || supplierPackage.offerId,
        timings: { servicesMs, catalogMs, beneficiaryMs, walletMs, totalMs: Math.round(performance.now() - startPreflight) },
      };
    } catch (err) {
      noteSalesFailure('application','internal_error',true);
      console.error('[Fulfilment Preflight] Unexpected preflight exception; failing closed.');
      return {
        allowed: false,
        code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
        customerMessage: 'This bundle is temporarily unavailable. Please try another package or try again shortly.',
        internalReason: err instanceof Error ? err.message : 'Unknown preflight error',
        timings: { servicesMs: 0, catalogMs: 0, beneficiaryMs: 0, walletMs: 0, totalMs: Math.round(performance.now() - startPreflight) },
      };
    }
  }

  /**
   * 1b. AIRTIME SUPPLIER PREFLIGHT CHECK
   * Executed before initializing a Paystack transaction for Airtime.
   * If Airtime service is unavailable on supplier, BLOCKS before Paystack.
   */
  static async preflightCheckAirtime(
    network: string, faceValuePesewas: number, recipientPhone: string
  ): Promise<PreflightResult> {
    try { this.resolveRoute({service:'airtime',network}); } catch { return {allowed:false,code:'SERVICE_TEMPORARILY_UNAVAILABLE',customerMessage:'Supplier service is temporarily unavailable.'}; }
    return observeSalesPreflight('airtime',()=>this.preflightAirtime(network,faceValuePesewas,recipientPhone));
  }
  private static async preflightAirtime(
    network: string,
    faceValuePesewas: number,
    recipientPhone: string
  ): Promise<PreflightResult> {
    const isEnabled = this.provider.client.isFulfillmentEnabled();

    // When fulfillment is disabled, preserve test payment flow without calling supplier
    if (!isEnabled) {
      return { allowed: true };
    }

    if (!this.provider.client.isConfigured()) {
      noteSalesFailure('application','configuration',true);
      console.error('[Airtime Preflight] Fulfilment is enabled but SUCCESS_BIZ_HUB_API_KEY is not configured.');
      return {
        allowed: false,
        code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
        customerMessage: 'Airtime Top-Up is temporarily unavailable. Please try again shortly.',
        internalReason: 'SUCCESS_BIZ_HUB_API_KEY is missing.',
      };
    }

    const startPreflight = performance.now();
    try {
      // Run service availability and wallet check concurrently
      const [serviceResult, walletResult] = await Promise.all([
        (async () => {
          const s0 = performance.now();
          const res = await this.provider.checkAirtimeAvailable();
          return { res, ms: Math.round(performance.now() - s0) };
        })(),
        (async () => {
          const w0 = performance.now();
          try {
            const res = await this.provider.getBalance();
            return { res, ms: Math.round(performance.now() - w0), error: null };
          } catch (walletErr) {
            return { res: null, ms: Math.round(performance.now() - w0), error: walletErr };
          }
        })(),
      ]);

      const servicesMs = serviceResult.ms;
      const walletMs = walletResult.ms;

      if (!serviceResult.res.available) {
        noteSalesFailure('services','service_unavailable',true);
        console.warn(`[Airtime Preflight] Airtime service unavailable: ${serviceResult.res.reason}`);
        return {
          allowed: false,
          code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
          customerMessage: 'Airtime Top-Up is temporarily unavailable. Please try again shortly.',
          internalReason: serviceResult.res.reason || 'Airtime service unavailable on supplier.',
          timings: { servicesMs, catalogMs: 0, beneficiaryMs: 0, walletMs, totalMs: Math.round(performance.now() - startPreflight) },
        };
      }

      if (walletResult.error || !walletResult.res) {
        noteSalesFailure('wallet','supplier_response',true);
        console.warn('[Airtime Preflight] Wallet check failed, failing closed:', walletResult.error);
        return {
          allowed: false,
          code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
          customerMessage: 'Airtime Top-Up is temporarily unavailable. Please try again shortly.',
          internalReason: 'Supplier wallet check failed.',
          timings: { servicesMs, catalogMs: 0, beneficiaryMs: 0, walletMs, totalMs: Math.round(performance.now() - startPreflight) },
        };
      }

      if (walletResult.res.balancePesewas < faceValuePesewas) {
        noteSalesFailure('wallet','wallet_low',true);
        console.error(
          `[Airtime Preflight] Insufficient supplier wallet balance for airtime! Available: GH₵${walletResult.res.balanceGhc}, required: GH₵${(faceValuePesewas / 100).toFixed(2)}`
        );
        return {
          allowed: false,
          code: 'SUPPLIER_WALLET_LOW',
          customerMessage: 'Airtime Top-Up is temporarily unavailable. Please try again shortly.',
          internalReason: 'Insufficient supplier wallet balance for airtime.',
          timings: { servicesMs, catalogMs: 0, beneficiaryMs: 0, walletMs, totalMs: Math.round(performance.now() - startPreflight) },
        };
      }

      return {
        allowed: true,
        timings: { servicesMs, catalogMs: 0, beneficiaryMs: 0, walletMs, totalMs: Math.round(performance.now() - startPreflight) },
      };
    } catch (err) {
      noteSalesFailure('application','internal_error',true);
      console.error('[Airtime Preflight] Unexpected preflight exception:', err);
      return {
        allowed: false,
        code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
        customerMessage: 'Airtime Top-Up is temporarily unavailable. Please try again shortly.',
        internalReason: err instanceof Error ? err.message : 'Unknown preflight error',
        timings: { servicesMs: 0, catalogMs: 0, beneficiaryMs: 0, walletMs: 0, totalMs: Math.round(performance.now() - startPreflight) },
      };
    }
  }

  /**
   * 2. CENTRALIZED PAYMENT -> DISPATCH ORCHESTRATION
   * Used identically by both Paystack webhook and GET /api/payments/verify/:reference.
   */
  static async processPaidOrder(
    paymentReference: string,
    paidAtIso: string,
    sourceNotice = 'Paystack payment confirmed'
  ): Promise<{ order: OrderRecord | null; alreadyHandled: boolean }> {
    // Step 1: Idempotently mark payment paid
    const { order: paidOrder, alreadyPaid } = await OrdersStore.markOrderPaid(
      paymentReference,
      paidAtIso,
      sourceNotice
    );

    if (!paidOrder || paidOrder.payment_status !== 'success') {
      return { order: null, alreadyHandled: false };
    }

    await WebsiteBusinessService.syncOrder(paidOrder);
    if(!await CommercialService.allowPaid(paidOrder)){const review=await OrdersStore.updateOrderReview(paidOrder.id,true,'Released welcome payment received late; reconcile before dispatch.');return {order:review,alreadyHandled:true};}
    if(paidOrder.store_context && paidOrder.manual_review)return {order:paidOrder,alreadyHandled:true};

    // Step 2: Atomically claim order for supplier dispatch (paid -> queued ONLY)
    const claimedOrder = await OrdersStore.claimOrderForSupplierDispatch(paidOrder.id);
    if (!claimedOrder) {
      // Already claimed or moved beyond 'paid' status by concurrent request
      return { order: paidOrder, alreadyHandled: true };
    }

    return this.dispatchClaimedOrder(claimedOrder);
  }

  /** Internal continuation of a durably claimed order; never an HTTP status override. */
  static async dispatchClaimedOrder(claimedOrder:OrderRecord,guarded=false,expectedSupplierCostMinor?:number,expectedSupplierOffer?:string):Promise<{order:OrderRecord|null;alreadyHandled:boolean}> {
    const assisted=['complimentary','admin_external'].includes(claimedOrder.payment_provider);
    if(assisted){
      const {AdminAssistedStore}=await import('../db/adminAssistedStore.js');
      const intent=await AdminAssistedStore.decision({order:claimedOrder.id}),q=intent?.snapshot;
      if(!guarded||!q||intent?.source!==claimedOrder.payment_provider||claimedOrder.status!=='queued'||claimedOrder.supplier_order_id||claimedOrder.payment_status!==(q.source==='complimentary'?'not_required':'recorded')||claimedOrder.amount!==(q.source==='complimentary'?0:q.product.retailMinor)||q.recipient!==claimedOrder.recipient_phone||q.product.id!==claimedOrder.product_id||expectedSupplierCostMinor!==q.product.supplierCostMinor||expectedSupplierOffer!==q.product.offerRef)throw new FinanceError('Assisted dispatch requires its exact durable operator authorization.',409);
    }

    if (claimedOrder.service_type === 'marketplace') return {order: claimedOrder, alreadyHandled: false};
    let provider: SuccessBizHubProvider;
    try { provider = this.getProviderForOrder(claimedOrder); }
    catch {
      const held = claimedOrder.manual_review ? claimedOrder : await OrdersStore.updateOrderReview(claimedOrder.id, true, 'Original supplier is unavailable or unrecognized. No supplier request was sent; inspect the original assignment.');
      return {order: held || claimedOrder, alreadyHandled: false};
    }
    if (claimedOrder.service_type === 'afa') return { order: await AfaService.submit(claimedOrder), alreadyHandled: false };
    if (claimedOrder.service_type === 'results_checker') return { order: await ResultsCheckerService.fulfil(claimedOrder), alreadyHandled: false };

    // Step 3: Safety check: Is live fulfilment enabled?
    const isFulfillmentEnabled = provider.client.isFulfillmentEnabled();
    const isTestPayment = !assisted&&this.isTestPaymentEnvironment();

    // NEVER spend real supplier money from test payments!
    if (!isFulfillmentEnabled || isTestPayment) {
      const reason = isTestPayment
        ? 'Test payment environment detected (sk_test_...). Live supplier dispatch suppressed for safety.'
        : 'Supplier fulfilment is currently disabled via configuration.';

      console.info(`[Fulfilment Dispatch] ${reason} Order ${claimedOrder.public_reference} remains in "queued" status.`);
      const safeOrder = await OrdersStore.updateOrderStatus(
        claimedOrder.id,
        'queued',
        undefined,
        undefined,
        `Supplier status: unconfigured/disabled. (${reason})`
      );
      return { order: safeOrder || claimedOrder, alreadyHandled: false };
    }

    // Step 3b: Concurrent active MTN fulfillment safeguard
    // Prevents submitting a second MTN order to supplier if another order is already active for this recipient
    if (claimedOrder.network.toLowerCase() === 'mtn') {
      const activeOrder = await OrdersStore.findActiveMtnOrder(claimedOrder.recipient_phone);
      if (
        activeOrder &&
        activeOrder.id !== claimedOrder.id &&
        ['submitted', 'processing'].includes(activeOrder.status)
      ) {
        console.warn(
          `[Fulfilment Dispatch] Concurrent active MTN order ${activeOrder.public_reference} already in progress for ${claimedOrder.recipient_phone}. Holding ${claimedOrder.public_reference} in queued status.`
        );
        const queuedOrder = await OrdersStore.updateOrderStatus(
          claimedOrder.id,
          'queued',
          'An active MTN order is currently in progress for this recipient. Kept in queue for sequential processing.',
          undefined,
          `Active MTN order in progress: ${activeOrder.public_reference}`
        );
        return { order: queuedOrder || claimedOrder, alreadyHandled: false };
      }
    }

    // Step 4: Live dispatch to Success Biz Hub (Data / Airtime / Instant)
    const isAirtime = claimedOrder.service_type === 'airtime' || claimedOrder.product_id.startsWith('airtime-');
    const isInstantBundle =
      claimedOrder.service_type === 'instant_bundle' || claimedOrder.product_id.startsWith('instant-');

    if (isInstantBundle) {
      // 4-InstantBundle: Dispatch instant bundle order
      try {
        const cleanPhone = claimedOrder.recipient_phone.replace(/[^\d]/g, '');
        const msisdn = cleanPhone.startsWith('233') ? `0${cleanPhone.slice(3)}` : cleanPhone;
        const packageId =
          claimedOrder.supplier_offer_ref || claimedOrder.product_id.replace(/^instant-/, '');

        let amountMajor: number | string | undefined = undefined;
        if (claimedOrder.bundle_size_snapshot && claimedOrder.bundle_size_snapshot.includes('Flexi')) {
          const match = claimedOrder.bundle_size_snapshot.replace(/[^\d.]/g, '');
          if (match) amountMajor = match;
        }

        console.info(
          `[Fulfilment Dispatch] Submitting Instant Bundle order ${claimedOrder.public_reference} to Success Biz Hub (pkg: ${packageId}) for ${msisdn}...`
        );

        const instantRes = await provider.placeInstantBundle({
          internalOrderId: claimedOrder.id,
          publicReference: claimedOrder.public_reference,
          packageId,
          phone: msisdn,
          amountMajor,
        });

        if (!instantRes.success && !instantRes.supplierOrderId) {
          throw Object.assign(new Error(instantRes.errorMessage || 'Success Biz Hub Instant Bundle placement failed.'), {
            isTimeout: (instantRes.rawResponse as { isTimeout?: boolean } | undefined)?.isTimeout === true,
          });
        }

        const supplierOrderId = instantRes.supplierOrderId;
        if (!supplierOrderId) {
          throw new Error('Success Biz Hub did not return an instant bundle order identifier.');
        }

        const mappedOrderStatus: OrderStatus =
          instantRes.status === 'delivered'
            ? 'delivered'
            : instantRes.status === 'processing'
            ? 'processing'
            : instantRes.status === 'failed'
            ? 'refund_pending'
            : 'submitted';

        const supplierCostMinor = instantRes.chargeMinor ?? instantRes.amountMinor ?? claimedOrder.supplier_cost_minor ?? null;

        const submittedOrder = await OrdersStore.saveSupplierSubmission(
          claimedOrder.id,
          supplierOrderId,
          supplierCostMinor,
          packageId,
          mappedOrderStatus,
          instantRes.rawResponse || {}
        );

        return { order: submittedOrder || claimedOrder, alreadyHandled: false };
      } catch (err: unknown) {
        const isTimeout = Boolean((err as { isTimeout?: boolean })?.isTimeout);
        const errorMessage = err instanceof Error ? err.message : 'Unknown instant bundle supplier error';

        if (isTimeout) {
          console.error(
            `[Fulfilment Dispatch] Ambiguous timeout communicating with Success Biz Hub Instant Bundle API for order ${claimedOrder.public_reference}. Preserving order in safe queued state.`
          );
          const uncertainOrder = await OrdersStore.saveSupplierUncertainSubmission(
            claimedOrder.id,
            'Network timeout awaiting response from Success Biz Hub Instant Bundle API',
            { isTimeout: true, message: errorMessage }
          );
          return { order: uncertainOrder || claimedOrder, alreadyHandled: false };
        }

        console.error(
          `[Fulfilment Dispatch] Definitive supplier error for instant bundle order ${claimedOrder.public_reference}: ${errorMessage}`
        );
        const refundOrder = await OrdersStore.updateOrderStatus(
          claimedOrder.id,
          'refund_pending',
          `Supplier instant bundle placement failed: ${errorMessage}`,
          undefined,
          JSON.stringify({ error: errorMessage })
        );
        return { order: refundOrder || claimedOrder, alreadyHandled: false };
      }
    }

    if (isAirtime) {
      // 4-Airtime: Dispatch airtime top-up
      try {
        const cleanPhone = claimedOrder.recipient_phone.replace(/[^\d]/g, '');
        const msisdn = cleanPhone.startsWith('233') ? `0${cleanPhone.slice(3)}` : cleanPhone;

        // Calculate amountMajor face value string e.g. "10"
        let amountMajor = '10';
        if (claimedOrder.face_value_minor && claimedOrder.face_value_minor > 0) {
          const faceValGhc = claimedOrder.face_value_minor / 100;
          amountMajor = Number.isInteger(faceValGhc) ? String(faceValGhc) : faceValGhc.toFixed(2);
        } else if (claimedOrder.bundle_size_snapshot) {
          const numericMatch = claimedOrder.bundle_size_snapshot.replace(/[^\d.]/g, '');
          if (numericMatch) amountMajor = numericMatch;
        }

        console.info(
          `[Fulfilment Dispatch] Submitting Airtime order ${claimedOrder.public_reference} to Success Biz Hub for ${msisdn} (${claimedOrder.network.toUpperCase()} GH₵${amountMajor})...`
        );

        const airtimeRes = await provider.placeAirtime({
          internalOrderId: claimedOrder.id,
          publicReference: claimedOrder.public_reference,
          recipientPhone: msisdn,
          network: claimedOrder.network,
          amountMajor,
          faceValuePesewas: claimedOrder.face_value_minor || claimedOrder.amount,
          customerTotalPesewas: claimedOrder.amount,
        });

        if (!airtimeRes.success && !airtimeRes.supplierOrderId) {
          throw Object.assign(new Error(airtimeRes.errorMessage || 'Success Biz Hub Airtime placement failed.'), {
            isTimeout: (airtimeRes.rawResponse as { isTimeout?: boolean } | undefined)?.isTimeout === true,
          });
        }

        const supplierOrderId = airtimeRes.supplierOrderId;
        if (!supplierOrderId) {
          throw new Error('Success Biz Hub did not return an airtime order identifier.');
        }

        const mappedOrderStatus: OrderStatus =
          airtimeRes.status === 'delivered'
            ? 'delivered'
            : airtimeRes.status === 'processing'
            ? 'processing'
            : airtimeRes.status === 'failed'
            ? 'refund_pending'
            : 'submitted';

        const supplierCostMinor = airtimeRes.chargeMinor ?? airtimeRes.amountMinor ?? null;

        const submittedOrder = await OrdersStore.saveSupplierSubmission(
          claimedOrder.id,
          supplierOrderId,
          supplierCostMinor,
          'sbh_airtime',
          mappedOrderStatus,
          airtimeRes.rawResponse || {}
        );

        return { order: submittedOrder || claimedOrder, alreadyHandled: false };
      } catch (err: unknown) {
        const isTimeout = Boolean((err as { isTimeout?: boolean })?.isTimeout);
        const errorMessage = err instanceof Error ? err.message : 'Unknown airtime supplier error';

        if (isTimeout) {
          // CRITICAL: Ambiguous timeout! Do NOT automatically resubmit.
          console.error(
            `[Fulfilment Dispatch] Ambiguous timeout communicating with Success Biz Hub Airtime API for order ${claimedOrder.public_reference}. Preserving order in safe queued state.`
          );
          const uncertainOrder = await OrdersStore.saveSupplierUncertainSubmission(
            claimedOrder.id,
            'Network timeout awaiting response from Success Biz Hub Airtime API',
            { isTimeout: true, message: errorMessage }
          );
          return { order: uncertainOrder || claimedOrder, alreadyHandled: false };
        }

        // Definitive supplier error before placement
        console.error(
          `[Fulfilment Dispatch] Definitive supplier error for airtime order ${claimedOrder.public_reference}: ${errorMessage}`
        );
        const refundOrder = await OrdersStore.updateOrderStatus(
          claimedOrder.id,
          'refund_pending',
          `Supplier airtime placement failed: ${errorMessage}`,
          undefined,
          JSON.stringify({ error: errorMessage })
        );
        return { order: refundOrder || claimedOrder, alreadyHandled: false };
      }
    }

    let storePostStarted=false;
    let storeSupplierId:string|undefined;
    // 4-Data: Live dispatch to Success Biz Hub Data catalog
    try {
      // 4a. Resolve live supplier package
      const resolution = await provider.resolvePackage(
        claimedOrder.network,
        claimedOrder.bundle_size_snapshot
      );

      if (!resolution.resolved) {
        console.error(`[Fulfilment Dispatch] Catalog resolution failed for paid order ${claimedOrder.public_reference}: ${resolution.error}`);
        const failedOrder = await OrdersStore.updateOrderStatus(
          claimedOrder.id,
          'refund_pending',
          `Supplier package resolution failed: ${resolution.error}`,
          undefined,
          JSON.stringify({ error: resolution.error })
        );
        return { order: failedOrder || claimedOrder, alreadyHandled: false };
      }

      const { offerSlug, offerId, sizeLabel, supplierCostMinor } = resolution.resolved;
      // New Data checkouts capture an offer/cost pair. A later catalogue change must not silently replace it.
      // Legacy rows without an offer snapshot retain the established preflight/economic checks below.
      if (claimedOrder.supplier_offer_ref && (claimedOrder.supplier_offer_ref !== (offerSlug || offerId) || claimedOrder.supplier_cost_minor != null && claimedOrder.supplier_cost_minor !== supplierCostMinor)) {
        const held = await OrdersStore.updateOrderReview(claimedOrder.id, true, 'Supplier offer or cost differs from the checkout snapshot. Nothing was sent; review the original quote.');
        return {order: held || claimedOrder, alreadyHandled: false};
      }

      if(expectedSupplierCostMinor!==undefined&&(supplierCostMinor!==expectedSupplierCostMinor||expectedSupplierOffer!==undefined&&expectedSupplierOffer!==(offerSlug||offerId||''))){
        const held=await OrdersStore.updateOrderReview(claimedOrder.id,true,'Supplier cost changed after confirmation. Nothing was sent; reconcile this authorization before creating another order.');
        return {order:held||claimedOrder,alreadyHandled:false};
      }
      if(claimedOrder.store_context && (!Number.isSafeInteger(supplierCostMinor) || supplierCostMinor <= 0 || supplierCostMinor > claimedOrder.store_context.wholesaleMinor)) {
        const held=await OrdersStore.saveSupplierUncertainSubmission(claimedOrder.id,'Store supplier cost exceeds the economic snapshot; Admin reconciliation required.');
        return {order:held||claimedOrder,alreadyHandled:false};
      }
      const offerRef = offerSlug || offerId || 'catalog_offer';

      // 4b. Format recipient phone
      const cleanPhone = claimedOrder.recipient_phone.replace(/[^\d]/g, '');
      const msisdn = cleanPhone.startsWith('233') ? `0${cleanPhone.slice(3)}` : cleanPhone;

      // 4c. Submit order to Success Biz Hub
      const orderPayload: { msisdn: string; data: string; offerSlug?: string; offerId?: string } = {
        msisdn,
        data: sizeLabel,
      };
      if (offerSlug) orderPayload.offerSlug = offerSlug;
      else if (offerId) orderPayload.offerId = offerId;

      console.info(`[Fulfilment Dispatch] Submitting order ${claimedOrder.public_reference} to Success Biz Hub for ${msisdn} (${sizeLabel})...`);
      // Persist uncertainty before POST: a process crash cannot leave an apparently safe queued sale.
      if(claimedOrder.store_context||guarded)await OrdersStore.saveSupplierUncertainSubmission(claimedOrder.id,'Supplier dispatch started; acceptance is awaiting confirmation.');
      storePostStarted=true;
      const response = await provider.client.createOrder(orderPayload);
      const data = response.data || {};
      const supplierOrderId = data.publicId || data.id;

      if(guarded&&(typeof supplierOrderId!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(supplierOrderId)))throw new Error('Supplier identifier is missing or malformed; acceptance requires reconciliation.');

      if (!supplierOrderId) {
        throw new Error('Success Biz Hub did not return an order identifier.');
      }

      if(claimedOrder.store_context||guarded){storeSupplierId=String(supplierOrderId);await OrdersStore.updateOrderStatus(claimedOrder.id,'queued',undefined,storeSupplierId);}
      const supplierDomainStatus = provider.mapSupplierStatus(data.status);
      const mappedOrderStatus: OrderStatus =
        supplierDomainStatus === 'delivered'
          ? 'delivered'
          : supplierDomainStatus === 'processing'
          ? 'processing'
          : supplierDomainStatus === 'failed'
          ? 'refund_pending'
          : 'submitted';

      const submittedOrder = await OrdersStore.saveSupplierSubmission(
        claimedOrder.id,
        supplierOrderId,
        supplierCostMinor,
        offerRef,
        mappedOrderStatus,
        data,
        guarded
      );

      return { order: submittedOrder || claimedOrder, alreadyHandled: false };
    } catch (err: unknown) {
      if((claimedOrder.store_context||guarded)&&storePostStarted) {
        if(storeSupplierId)await OrdersStore.updateOrderStatus(claimedOrder.id,'queued',undefined,storeSupplierId);
        const held=await OrdersStore.saveSupplierUncertainSubmission(claimedOrder.id,'Managed store supplier acceptance needs reconciliation.');
        return {order:held||claimedOrder,alreadyHandled:false};
      }
      const isTimeout = Boolean((err as { isTimeout?: boolean })?.isTimeout);
      const errorMessage = err instanceof Error ? err.message : 'Unknown supplier error';

      if (isTimeout) {
        // CRITICAL: Ambiguous timeout! Do NOT automatically resubmit.
        // Success Biz Hub might have accepted the order. Save uncertain state for reconciliation.
        console.error(
          `[Fulfilment Dispatch] Ambiguous timeout communicating with Success Biz Hub for order ${claimedOrder.public_reference}. Preserving order in safe queued state.`
        );
        const uncertainOrder = await OrdersStore.saveSupplierUncertainSubmission(
          claimedOrder.id,
          'Network timeout awaiting response from Success Biz Hub',
          { isTimeout: true, message: errorMessage }
        );
        return { order: uncertainOrder || claimedOrder, alreadyHandled: false };
      }

      // Definitive supplier error before placement
      console.error(
        `[Fulfilment Dispatch] Definitive supplier error for order ${claimedOrder.public_reference}: ${errorMessage}`
      );
      const refundOrder = await OrdersStore.updateOrderStatus(
        claimedOrder.id,
        'refund_pending',
        `Supplier placement failed: ${errorMessage}`,
        undefined,
        JSON.stringify({ error: errorMessage })
      );
      return { order: refundOrder || claimedOrder, alreadyHandled: false };
    }
  }

  /**
   * 3. BEST-EFFORT STATUS REFRESH WITH 30-SECOND THROTTLE
   * Called during order lookup to refresh state for orders in submitted/processing state.
   * Can be forced by Admin manual refresh.
   */
  static async refreshOrderStatusIfDue(order: OrderRecord, force = false): Promise<OrderRecord> {
    if (order.service_type === 'marketplace') return order;
    let provider: SuccessBizHubProvider;
    try { provider = this.getProviderForOrder(order); }
    catch {
      if (force) throw new FinanceError('Original supplier is unavailable. Review this order without changing its supplier.',409);
      return order;
    }
    if (order.service_type === 'afa') return AfaService.refresh(order);
    if (order.service_type === 'results_checker') return ResultsCheckerService.refresh(order);
    const uncertainWithId = order.failure_reason === 'supplier_submission_uncertain' && (order.status === 'queued' || order.store_context && order.manual_review && ['submitted','processing','delivered'].includes(order.status));
    const failedPaidRefresh=force&&order.payment_status==='success'&&['paid','queued','submitted','processing','failed','refund_pending','refunded'].includes(order.status)&&order.resolution_json?.stage!=='resolved';
    if (!order.supplier_order_id || (order.status !== 'submitted' && order.status !== 'processing' && !uncertainWithId && !failedPaidRefresh)) {
      if(force&&!order.supplier_order_id)throw new FinanceError('No supplier identifier is available. Record documented supplier evidence instead.',409);
      if(force)throw new FinanceError('This order state does not permit supplier reconciliation.',409);
      return order;
    }

    if ((!force&&!provider.client.isFulfillmentEnabled()) || !provider.client.isConfigured()) {
      if(force)throw new FinanceError('Supplier status lookup is not configured. Use documented manual reconciliation.',503);
      return order;
    }

    // Check throttle: no more than once every 30 seconds unless forced
    if (!force) {
      const lastChecked = order.supplier_last_checked_at ? new Date(order.supplier_last_checked_at).getTime() : 0;
      const now = Date.now();
      if (now - lastChecked < 30_000) {
        return order; // Throttled
      }
    }

    try {
      const isAirtime = order.service_type === 'airtime' || order.product_id.startsWith('airtime-');
      const isInstantBundle =
        order.service_type === 'instant_bundle' || order.product_id.startsWith('instant-');

      let statusRes;
      if (isInstantBundle && provider.getInstantBundleStatus) {
        statusRes = await provider.getInstantBundleStatus(order.supplier_order_id);
      } else if (isAirtime && provider.getAirtimeStatus) {
        statusRes = await provider.getAirtimeStatus(order.supplier_order_id);
      } else {
        statusRes = await provider.getOrderStatus(order.supplier_order_id);
      }

      order=(await OrdersStore.recordSupplierCheck(order.id,order.supplier_order_id!,statusRes.rawResponse?JSON.stringify(statusRes.rawResponse):undefined))||order;
      if(statusRes.supplierOrderId&&String(statusRes.supplierOrderId)!==order.supplier_order_id)throw new FinanceError('Supplier identifier did not match the order.',503);
      if(force&&!statusRes.success)throw new FinanceError('Supplier lookup failed; the customer resolution remains open.',503);
      if (statusRes.success && statusRes.status) {
        const mappedStatus: OrderStatus =
          statusRes.status === 'delivered'
            ? 'delivered'
            : statusRes.status === 'failed'
            ? 'refund_pending'
            : statusRes.status === 'processing'
            ? 'processing'
            : 'submitted';

        if (mappedStatus !== order.status || order.store_context && order.manual_review && order.failure_reason === 'supplier_submission_uncertain') {
          const updated = await OrdersStore.updateOrderStatus(
            order.id,
            mappedStatus,
            statusRes.errorMessage,
            order.supplier_order_id!,
            JSON.stringify(statusRes.rawResponse),
            {expectedSupplierId:order.supplier_order_id!,authoritativeSupplierRecovery:['processed','completed','success','delivered','processing','in_progress','pending','queued','accepted'].includes(String((statusRes.rawResponse as any)?.status||'').toLowerCase())}
          );
          if(order.store_context&&order.manual_review&&order.failure_reason==='supplier_submission_uncertain'&&(updated||order).status===mappedStatus)return await OrdersStore.resolveStoreSupplierReview(order.id,order.supplier_order_id!)||updated||order;
          return updated || order;
        }
      }
    } catch (err) {
      await OrdersStore.recordSupplierCheck(order.id,order.supplier_order_id!);
      if(force)throw new FinanceError('Supplier lookup could not be confirmed. Customer resolution remains open.',503);
      console.warn('[Fulfilment Refresh] Supplier status lookup unavailable.');
    }

    return order;
  }

  /**
   * 4. RECONCILE ALL ACTIVE SUPPLIER ORDERS
   * Batch reconciles submitted/processing telecom orders with the supplier
   */
  static async reconcileActiveSupplierOrders(
    force = false,
    limit = 50
  ): Promise<{ scanned: number; updatedCount: number }> {
    let scanned = 0;
    let updatedCount = 0;
    try {
      await FinanceService.reconcileWalletOrders();
      await WebsiteBusinessService.recoverEffects();
      await CommercialService.recover();
      await AfaStore.reconcileTerminalPayloads();
      const activeOrders = await OrdersStore.getActiveSupplierOrders(limit);
      scanned = activeOrders.length;
      for (const order of activeOrders) {
        const prevStatus = order.status;
        const refreshed = await this.refreshOrderStatusIfDue(order, force);
        if (refreshed.status !== prevStatus) {
          updatedCount++;
        }
      }
    } catch (err) {
      console.warn('[Fulfilment Reconciler] Error reconciling active supplier orders:', err);
    }
    return { scanned, updatedCount };
  }
}
