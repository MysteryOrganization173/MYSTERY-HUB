import { normalizeGhanaPhoneForComparison } from '../suppliers/successBizHub/provider.js';
import { SuccessBizHubProvider } from '../suppliers/successBizHub/provider.js';
import type { SbhAfaResponse } from '../suppliers/successBizHub/types.js';
export function parseAfaPriceMinor(value:unknown):number|null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value.trim()))) return null;
  const number = Number(value);
  // orders.supplier_cost_minor is a PostgreSQL INTEGER. Reject overflow before binding.
  return Number.isSafeInteger(number) && number >= 0 && number <= 2_147_483_647 ? number : null;
}
import { AfaStore } from '../db/afaStore.js';
import { OrdersStore } from '../db/ordersStore.js';
import { isAfaEncryptionConfigured } from './afaEncryption.js';
import type { OrderRecord } from '../types/orders.js';
export class AfaService {
  static provider = new SuccessBizHubProvider();
  static async publicConfig() {
    const enabled = /^(true|1)$/i.test(process.env.AFA_SERVICE_ENABLED || '');
    const raw = process.env.AFA_RETAIL_PRICE_MINOR || '';
    const price = /^\d+$/.test(raw) ? Number(raw) : 0;
    const retailPriceMinor = Number.isSafeInteger(price) && price > 0 && price <= 100_000_000 ? price : null;
    const configured = this.provider.client.isConfigured() && this.provider.client.isFulfillmentEnabled() && isAfaEncryptionConfigured();
    const capability = enabled && configured && retailPriceMinor ? await this.provider.checkAfaAvailable() : { available: false, status: 'not_configured' };
    const available = enabled && configured && retailPriceMinor !== null && capability.available;
    return { enabled, available, retailPriceMinor, retailPriceGhc: retailPriceMinor === null ? null : retailPriceMinor / 100,
      status: capability.status, message: available ? 'AFA registration is available.' : 'AFA registration is temporarily unavailable.' };
  }
  static async submit(order: OrderRecord): Promise<OrderRecord> {
    if (order.payment_status !== 'success' || order.status !== 'queued') return order;
    const record = await AfaStore.find(order.id);
    if (record?.supplier_public_id || order.supplier_order_id) {
      const recovered = !order.supplier_order_id && record?.supplier_public_id
        ? await OrdersStore.saveSupplierSubmission(order.id,record.supplier_public_id,order.supplier_cost_minor,'afa','processing',{publicId:record.supplier_public_id,status:'unknown'}) : order;
      return this.refresh(recovered || order);
    }
    if (record?.submission_attempted_at) return (await OrdersStore.saveSupplierUncertainSubmission(order.id, 'AFA submission already attempted; reconcile with supplier support.')) || order;
    // Existing safety: test payments never spend supplier money.
    if (process.env.NODE_ENV === 'test' || !this.provider.client.isFulfillmentEnabled() || !(process.env.PAYSTACK_SECRET_KEY || '').trim().startsWith('sk_live_')) {
      await OrdersStore.updateOrderReview(order.id, true, 'AFA live dispatch suppressed by payment/fulfilment configuration.');
      return (await OrdersStore.findOrder(order.id)) || order;
    }
    let payload;
    try { payload = await AfaStore.payload(order.id); }
    catch { await OrdersStore.updateOrderReview(order.id, true, 'AFA encrypted submission payload unavailable.'); return (await OrdersStore.findOrder(order.id)) || order; }
    if (!(await this.publicConfig()).available) {
      await OrdersStore.updateOrderReview(order.id, true, 'AFA supplier unavailable after payment. Review before submission.');
      return (await OrdersStore.findOrder(order.id)) || order;
    }
    if (!await AfaStore.claimSubmission(order.id)) return (await OrdersStore.findOrder(order.id)) || order;
    try { return await this.applySupplierResult(order, await this.provider.placeAfaRegistration(payload)); }
    catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status && [400,401,403,404,429].includes(status)) {
        await OrdersStore.updateOrderReview(order.id, true, `AFA supplier rejected request (HTTP ${status}); review/refund required.`);
        return (await OrdersStore.updateOrderStatus(order.id, 'refund_pending', 'AFA registration needs support review.')) || order;
      }
      // Includes 5xx, parse failures and timeout. No request data or supplier message stored.
      return (await OrdersStore.saveSupplierUncertainSubmission(order.id, 'AFA supplier acceptance uncertain; do not resubmit without reconciliation.')) || order;
    }
  }
  static async applySupplierResult(order: OrderRecord, result: SbhAfaResponse): Promise<OrderRecord> {
    const data = result.data;
    if (result.success !== true || !data || typeof data.publicId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(data.publicId)) throw new Error('AFA response missing reliable public ID.');
    // Persist a reliable identifier even if other supplier fields are malformed; future action is GET only.
    if (order.supplier_order_id && data.publicId !== order.supplier_order_id) throw new Error('AFA status identifier mismatch.');
    const rawStatus = typeof data.status === 'string' && /^[a-zA-Z_]{1,64}$/.test(data.status) ? data.status.toLowerCase() : 'unknown';
    const cost = parseAfaPriceMinor(data.priceMinor);

    const phoneMismatch = typeof data.phone === 'string' && normalizeGhanaPhoneForComparison(data.phone) !== normalizeGhanaPhoneForComparison(order.recipient_phone);
    await AfaStore.supplierState(order.id, data.publicId, phoneMismatch ? 'identity_mismatch' : rawStatus);
    const knownStatus = ['registered','pending','queued','submitted','processing','failed','rejected','cancelled'].includes(rawStatus);
    const status = phoneMismatch ? 'processing' : rawStatus === 'registered' ? 'delivered' : ['failed','rejected','cancelled'].includes(rawStatus) ? 'refund_pending' : ['pending','queued','submitted'].includes(rawStatus) ? 'submitted' : 'processing';
    const safeResponse = { publicId: data.publicId, status: rawStatus, priceMinor: cost };
    // Never persist the supplier response wholesale; it may contain identity data.
    const current = (await OrdersStore.findOrder(order.id)) || order;
    const updated = await OrdersStore.saveSupplierSubmission(order.id, data.publicId, cost ?? current.supplier_cost_minor, 'afa', status === 'delivered' ? 'processing' : status, safeResponse);
    if (status === 'delivered') await OrdersStore.updateOrderStatus(order.id, 'delivered');
    await AfaStore.onOrderTerminal(updated || current);
    if (cost === null || !knownStatus || phoneMismatch || status === 'refund_pending') await OrdersStore.updateOrderReview(order.id, true, 'AFA supplier response requires review; customer retail amount unchanged.');
    return (await OrdersStore.findOrder(order.id)) || updated || current;
  }
  static async refresh(order: OrderRecord): Promise<OrderRecord> {
    if (order.service_type !== 'afa') return order;
    await AfaStore.onOrderTerminal(order);
    if (!['queued','submitted','processing'].includes(order.status)) return order;
    const record = await AfaStore.find(order.id);
    // Recover the separately persisted ID after a crash before the generic order update.
    if (!order.supplier_order_id && record?.supplier_public_id) {
      order = await OrdersStore.saveSupplierSubmission(order.id,record.supplier_public_id,order.supplier_cost_minor,'afa','processing',{publicId:record.supplier_public_id,status:'unknown'}) || order;
    }
    if (!order.supplier_order_id) {
      if (record?.submission_attempted_at && Date.now()-Date.parse(record.submission_attempted_at)>30_000) {
        return await OrdersStore.saveSupplierUncertainSubmission(order.id,'AFA submission interrupted; reconcile with supplier support before any further action.') || order;
      }
      return order;
    }
    if (!this.provider.client.isConfigured()) return order;
    if (!await AfaStore.claimRefresh(order.id)) return order;
    try { return await this.applySupplierResult(order, await this.provider.getAfaStatus(order.supplier_order_id)); }
    catch { await OrdersStore.updateOrderReview(order.id, true, 'AFA status check unavailable; reconcile using the existing supplier ID.'); return (await OrdersStore.findOrder(order.id)) || order; } // Throttle is persisted even on supplier errors. No tight retries or PII logs.
  }
}
