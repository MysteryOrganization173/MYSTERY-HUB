/**
 * Centralized Fulfilment Service
 * Orchestrates preflight checks and post-payment supplier dispatch for Data Bundles.
 * Serves as the single source of truth for both Paystack Webhooks and Verify API.
 */

import { OrdersStore } from '../db/ordersStore.js';
import { OrderRecord, OrderStatus } from '../types/orders.js';
import { SuccessBizHubProvider } from '../suppliers/successBizHub/provider.js';
import { SuccessBizHubClient } from '../suppliers/successBizHub/client.js';

export interface PreflightResult {
  allowed: boolean;
  customerMessage?: string;
  internalReason?: string;
  supplierCostMinor?: number;
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
      console.error('[Fulfilment Preflight] Fulfilment is enabled but SUCCESS_BIZ_HUB_API_KEY is not configured.');
      return {
        allowed: false,
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
        console.warn(`[Fulfilment Preflight] Services check failed: ${servicesCheckResult.res.reason}`);
        return {
          allowed: false,
          customerMessage: 'This bundle is temporarily unavailable. Please try another package or try again shortly.',
          internalReason: servicesCheckResult.res.reason,
          timings: { servicesMs, catalogMs, beneficiaryMs: 0, walletMs: 0, totalMs: Math.round(performance.now() - startPreflight) },
        };
      }

      if (!resolvedResult.res.resolved) {
        console.warn(`[Fulfilment Preflight] Package resolution failed: ${resolvedResult.res.error}`);
        return {
          allowed: false,
          customerMessage: 'This bundle is temporarily unavailable. Please try another package or try again shortly.',
          internalReason: resolvedResult.res.error,
          timings: { servicesMs, catalogMs, beneficiaryMs: 0, walletMs: 0, totalMs: Math.round(performance.now() - startPreflight) },
        };
      }

      const supplierPackage = resolvedResult.res.resolved;

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
        console.warn(`[Fulfilment Preflight] Beneficiary ineligible: ${beneficiaryResult.res.reason}`);
        return {
          allowed: false,
          customerMessage: 'The recipient phone number is not eligible for this telecom bundle. Please check the number and network.',
          internalReason: beneficiaryResult.res.reason || 'Beneficiary ineligible',
          timings: { servicesMs, catalogMs, beneficiaryMs, walletMs, totalMs: Math.round(performance.now() - startPreflight) },
        };
      }

      if (walletResult.error || !walletResult.res) {
        console.warn('[Fulfilment Preflight] Wallet check failed, failing closed:', walletResult.error);
        return {
          allowed: false,
          customerMessage: 'This bundle is temporarily unavailable. Please try another package or try again shortly.',
          internalReason: 'Supplier wallet check failed.',
          timings: { servicesMs, catalogMs, beneficiaryMs, walletMs, totalMs: Math.round(performance.now() - startPreflight) },
        };
      }

      if (walletResult.res.balancePesewas < supplierPackage.supplierCostMinor) {
        console.error(
          `[Fulfilment Preflight] Insufficient supplier wallet balance! Available: GH₵${walletResult.res.balanceGhc}, required: GH₵${(supplierPackage.supplierCostMinor / 100).toFixed(2)}`
        );
        return {
          allowed: false,
          customerMessage: 'This bundle is temporarily unavailable. Please try another package or try again shortly.',
          internalReason: 'Insufficient supplier wallet balance.',
          timings: { servicesMs, catalogMs, beneficiaryMs, walletMs, totalMs: Math.round(performance.now() - startPreflight) },
        };
      }

      return {
        allowed: true,
        supplierCostMinor: supplierPackage.supplierCostMinor,
        timings: { servicesMs, catalogMs, beneficiaryMs, walletMs, totalMs: Math.round(performance.now() - startPreflight) },
      };
    } catch (err) {
      console.error('[Fulfilment Preflight] Unexpected preflight exception:', err);
      return {
        allowed: false,
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
      console.error('[Airtime Preflight] Fulfilment is enabled but SUCCESS_BIZ_HUB_API_KEY is not configured.');
      return {
        allowed: false,
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
        console.warn(`[Airtime Preflight] Airtime service unavailable: ${serviceResult.res.reason}`);
        return {
          allowed: false,
          customerMessage: 'Airtime Top-Up is temporarily unavailable. Please try again shortly.',
          internalReason: serviceResult.res.reason || 'Airtime service unavailable on supplier.',
          timings: { servicesMs, catalogMs: 0, beneficiaryMs: 0, walletMs, totalMs: Math.round(performance.now() - startPreflight) },
        };
      }

      if (walletResult.error || !walletResult.res) {
        console.warn('[Airtime Preflight] Wallet check failed, failing closed:', walletResult.error);
        return {
          allowed: false,
          customerMessage: 'Airtime Top-Up is temporarily unavailable. Please try again shortly.',
          internalReason: 'Supplier wallet check failed.',
          timings: { servicesMs, catalogMs: 0, beneficiaryMs: 0, walletMs, totalMs: Math.round(performance.now() - startPreflight) },
        };
      }

      if (walletResult.res.balancePesewas < faceValuePesewas) {
        console.error(
          `[Airtime Preflight] Insufficient supplier wallet balance for airtime! Available: GH₵${walletResult.res.balanceGhc}, required: GH₵${(faceValuePesewas / 100).toFixed(2)}`
        );
        return {
          allowed: false,
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
      console.error('[Airtime Preflight] Unexpected preflight exception:', err);
      return {
        allowed: false,
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

    if (!paidOrder) {
      return { order: null, alreadyHandled: false };
    }

    // Step 2: Atomically claim order for supplier dispatch (paid -> queued ONLY)
    const claimedOrder = await OrdersStore.claimOrderForSupplierDispatch(paidOrder.id);
    if (!claimedOrder) {
      // Already claimed or moved beyond 'paid' status by concurrent request
      return { order: paidOrder, alreadyHandled: true };
    }

    // Step 3: Safety check: Is live fulfilment enabled?
    const isFulfillmentEnabled = this.provider.client.isFulfillmentEnabled();
    const isTestPayment = this.isTestPaymentEnvironment();

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

    // Step 4: Live dispatch to Success Biz Hub
    const isAirtime = claimedOrder.service_type === 'airtime' || claimedOrder.product_id.startsWith('airtime-');

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

        const airtimeRes = await this.provider.placeAirtime({
          internalOrderId: claimedOrder.id,
          publicReference: claimedOrder.public_reference,
          recipientPhone: msisdn,
          network: claimedOrder.network,
          amountMajor,
          faceValuePesewas: claimedOrder.face_value_minor || claimedOrder.amount,
          customerTotalPesewas: claimedOrder.amount,
        });

        if (!airtimeRes.success && !airtimeRes.supplierOrderId) {
          throw new Error(airtimeRes.errorMessage || 'Success Biz Hub Airtime placement failed.');
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

    // 4-Data: Live dispatch to Success Biz Hub Data catalog
    try {
      // 4a. Resolve live supplier package
      const resolution = await this.provider.resolvePackage(
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
      const response = await this.provider.client.createOrder(orderPayload);
      const data = response.data || {};
      const supplierOrderId = data.publicId || data.id;

      if (!supplierOrderId) {
        throw new Error('Success Biz Hub did not return an order identifier.');
      }

      const supplierDomainStatus = this.provider.mapSupplierStatus(data.status);
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
        data
      );

      return { order: submittedOrder || claimedOrder, alreadyHandled: false };
    } catch (err: unknown) {
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
    if (!order.supplier_order_id || (order.status !== 'submitted' && order.status !== 'processing')) {
      return order;
    }

    if (!this.provider.client.isFulfillmentEnabled() || !this.provider.client.isConfigured()) {
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
      const statusRes = isAirtime && this.provider.getAirtimeStatus
        ? await this.provider.getAirtimeStatus(order.supplier_order_id)
        : await this.provider.getOrderStatus(order.supplier_order_id);

      if (statusRes.success && statusRes.status) {
        const mappedStatus: OrderStatus =
          statusRes.status === 'delivered'
            ? 'delivered'
            : statusRes.status === 'failed'
            ? 'refund_pending'
            : statusRes.status === 'processing'
            ? 'processing'
            : 'submitted';

        if (mappedStatus !== order.status) {
          const updated = await OrdersStore.updateOrderStatus(
            order.id,
            mappedStatus,
            statusRes.errorMessage,
            order.supplier_order_id,
            JSON.stringify(statusRes.rawResponse)
          );
          return updated || order;
        }
      }
    } catch (err) {
      console.warn(`[Fulfilment Refresh] Error refreshing order status for ${order.public_reference}:`, err);
    }

    return order;
  }
}
