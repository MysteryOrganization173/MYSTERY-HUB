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

    try {
      // 1. Confirm supplier orders/services are available
      const servicesCheck = await this.provider.checkServicesAvailable();
      if (!servicesCheck.available) {
        console.warn(`[Fulfilment Preflight] Services check failed: ${servicesCheck.reason}`);
        return {
          allowed: false,
          customerMessage: 'This bundle is temporarily unavailable. Please try another package or try again shortly.',
          internalReason: servicesCheck.reason,
        };
      }

      // 2. Confirm exact product mapping exists in GET /catalog
      const resolved = await this.provider.resolvePackage(network, bundleSize);
      if (!resolved.resolved) {
        console.warn(`[Fulfilment Preflight] Package resolution failed: ${resolved.error}`);
        return {
          allowed: false,
          customerMessage: 'This bundle is temporarily unavailable. Please try another package or try again shortly.',
          internalReason: resolved.error,
        };
      }

      const supplierPackage = resolved.resolved;

      // 3. Confirm beneficiary eligibility via /beneficiary-check with offer selector
      const beneficiaryCheck = await this.provider.checkBeneficiaryEligibility(recipientPhone, {
        offerSlug: supplierPackage.offerSlug,
        offerId: supplierPackage.offerId,
      });
      if (!beneficiaryCheck.eligible) {
        console.warn(`[Fulfilment Preflight] Beneficiary ineligible: ${beneficiaryCheck.reason}`);
        return {
          allowed: false,
          customerMessage: 'The recipient phone number is not eligible for this telecom bundle. Please check the number and network.',
          internalReason: beneficiaryCheck.reason || 'Beneficiary ineligible',
        };
      }

      // 4. Check supplier available wallet balance against package cost
      try {
        const wallet = await this.provider.getBalance();
        if (wallet.balancePesewas < supplierPackage.supplierCostMinor) {
          console.error(
            `[Fulfilment Preflight] Insufficient supplier wallet balance! Available: GH₵${wallet.balanceGhc}, required: GH₵${(supplierPackage.supplierCostMinor / 100).toFixed(2)}`
          );
          return {
            allowed: false,
            customerMessage: 'This bundle is temporarily unavailable. Please try another package or try again shortly.',
            internalReason: 'Insufficient supplier wallet balance.',
          };
        }
      } catch (walletErr) {
        console.warn('[Fulfilment Preflight] Wallet check failed, failing closed:', walletErr);
        return {
          allowed: false,
          customerMessage: 'This bundle is temporarily unavailable. Please try another package or try again shortly.',
          internalReason: 'Supplier wallet check failed.',
        };
      }

      return {
        allowed: true,
        supplierCostMinor: supplierPackage.supplierCostMinor,
      };
    } catch (err) {
      console.error('[Fulfilment Preflight] Unexpected preflight exception:', err);
      return {
        allowed: false,
        customerMessage: 'This bundle is temporarily unavailable. Please try another package or try again shortly.',
        internalReason: err instanceof Error ? err.message : 'Unknown preflight error',
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
   */
  static async refreshOrderStatusIfDue(order: OrderRecord): Promise<OrderRecord> {
    if (!order.supplier_order_id || (order.status !== 'submitted' && order.status !== 'processing')) {
      return order;
    }

    if (!this.provider.client.isFulfillmentEnabled() || !this.provider.client.isConfigured()) {
      return order;
    }

    // Check throttle: no more than once every 30 seconds
    const lastChecked = order.supplier_last_checked_at ? new Date(order.supplier_last_checked_at).getTime() : 0;
    const now = Date.now();
    if (now - lastChecked < 30_000) {
      return order; // Throttled
    }

    try {
      const statusRes = await this.provider.getOrderStatus(order.supplier_order_id);
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
