import { SuccessBizHubClient } from '../suppliers/successBizHub/client.js';
import { ResultsCheckerStore } from '../db/resultsCheckerStore.js';
import { OrdersStore } from '../db/ordersStore.js';
import { isCheckerEncryptionConfigured } from './resultsCheckerEncryption.js';
import { CHECKER_MAX_QTY, CHECKER_PRODUCTS, checkerProduct, matchCheckerOffer, parseVoucherCatalogue, parseVoucherPurchase, type CheckerConfig, type CheckerProduct, type OfferState, type VoucherOffer } from '../../shared/resultsCheckers.js';
import type { OrderRecord } from '../types/orders.js';

const OFFER_REF = 'results_checker';

/**
 * Results Checkers: buy a voucher from the supplier after a verified payment, store the PINs encrypted, then deliver.
 *
 * The supplier documents no idempotency key for voucher purchases, and a timeout tells us nothing about whether a
 * voucher was bought or the wallet debited. So a purchase is attempted at most once per order, whatever happens next.
 * Everything uncertain goes to Admin. Nothing here ever repeats a purchase on its own.
 */
export class ResultsCheckerService {
  static client = new SuccessBizHubClient();

  static enabled() { return /^(true|1)$/i.test(process.env.RESULTS_CHECKER_ENABLED || ''); }
  static typeId(product: CheckerProduct) { return (process.env[product.typeIdEnv] || '').trim() || undefined; }

  /** Live supplier money needs a live payment. Test payments only ever reach a supplier stand-in on this machine. */
  static supplierSpendAllowed(): boolean {
    if (!this.client.isFulfillmentEnabled()) return false;
    if ((process.env.PAYSTACK_SECRET_KEY || '').trim().startsWith('sk_live_')) return process.env.NODE_ENV !== 'test';
    if (process.env.NODE_ENV === 'production') return false;
    return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(process.env.SUCCESS_BIZ_HUB_BASE_URL || '');
  }

  /** Everything except the supplier's answer that must be true before a product can be offered. */
  static async prerequisitesMet(): Promise<boolean> {
    return this.enabled() && this.client.isConfigured() && this.supplierSpendAllowed() && isCheckerEncryptionConfigured() && await ResultsCheckerStore.ready();
  }

  static async catalogue(skipCache = false): Promise<VoucherOffer[]> { return parseVoucherCatalogue(await this.client.getVouchers(skipCache)); }

  static async offerFor(product: CheckerProduct, qty = 1, skipCache = false): Promise<{ state: OfferState; offer: VoucherOffer | null }> {
    return matchCheckerOffer(product, this.typeId(product), await this.catalogue(skipCache), qty);
  }

  /** What the page may show. Supplier costs and exact stock figures stay on the server. */
  static async publicConfig(): Promise<CheckerConfig> {
    const closed = (message: string): CheckerConfig => ({ available: false, message, maxQty: CHECKER_MAX_QTY, products: CHECKER_PRODUCTS.map(p => ({ key: p.key, name: p.name, short: p.short, priceMinor: p.retailMinor, available: false, stock: null })) });
    const notYet = 'Results checkers are not on sale yet.';
    if (!await this.prerequisitesMet()) return closed(notYet);
    let catalogue: VoucherOffer[];
    try { catalogue = await this.catalogue(); } catch { return closed('Results checkers are temporarily unavailable.'); }
    const products = CHECKER_PRODUCTS.map(p => {
      const { state, offer } = matchCheckerOffer(p, this.typeId(p), catalogue);
      return { key: p.key, name: p.name, short: p.short, priceMinor: p.retailMinor, available: state === 'ok', stock: state !== 'ok' ? null : (offer!.available! <= 20 ? 'low' as const : 'in_stock' as const) };
    });
    const available = products.some(p => p.available);
    return { available, message: available ? 'Results checkers are available.' : 'Results checkers are temporarily unavailable.', maxQty: CHECKER_MAX_QTY, products };
  }

  /** Called once a payment is verified and the order has been claimed for dispatch. Runs its purchase at most once. */
  static async fulfil(order: OrderRecord): Promise<OrderRecord> {
    if (order.payment_status !== 'success' || order.status !== 'queued') return order;
    const record = await ResultsCheckerStore.find(order.id);
    if (!record) return this.review(order, 'Results checker purchase record is missing; do not buy a voucher without investigation.');
    if (record.pin_count > 0) return this.settle(order);
    if (record.submission_attempted_at) return (await OrdersStore.saveSupplierUncertainSubmission(order.id, 'Results checker purchase was already attempted; reconcile with the supplier before any further action.')) || order;
    if (!this.supplierSpendAllowed() || !isCheckerEncryptionConfigured()) return this.review(order, 'Results checker dispatch held by payment, supplier or encryption configuration. No voucher was bought.');

    const product = checkerProduct(record.product_key);
    if (!product) return this.review(order, 'Results checker product is unknown. No voucher was bought.');
    // Check again now: stock and cost may have moved since the customer paid. No purchase is made if anything changed.
    let check: { state: OfferState; offer: VoucherOffer | null };
    try { check = await this.offerFor(product, record.qty, true); }
    catch { return this.review(order, 'Supplier catalogue could not be checked after payment. No voucher was bought.'); }
    if (check.state !== 'ok' || check.offer?.id !== record.supplier_type_id) return this.review(order, `Results checker unavailable after payment (${check.state}). No voucher was bought. Refund or retry from Admin.`);

    if (!await ResultsCheckerStore.claimSubmission(order.id)) return (await OrdersStore.findOrder(order.id)) || order;
    let response: unknown;
    try { response = await this.client.purchaseVoucher({ typeId: record.supplier_type_id, qty: record.qty }); }
    catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // The supplier refused it. Even so, its answer isn't proof no wallet debit happened, so Admin checks the statement.
      if (status && [400, 401, 403, 404, 429].includes(status)) {
        await OrdersStore.updateOrderReview(order.id, true, `Supplier refused the voucher purchase (HTTP ${status}). Check the supplier statement before any refund or new purchase.`);
        return (await OrdersStore.updateOrderStatus(order.id, 'refund_pending', 'Results checker purchase needs support review.')) || order;
      }
      // Timeouts, 5xx and unreadable replies: the voucher may or may not exist. Never repeated automatically.
      return (await OrdersStore.saveSupplierUncertainSubmission(order.id, 'Results checker purchase outcome unknown; do not buy again until the supplier statement is checked.')) || order;
    }
    return this.applyPurchase(order, response, record.qty, record.quoted_cost_minor);
  }

  /** Stores what the supplier returned, then updates the order. The PINs are safe before anything else can fail. */
  static async applyPurchase(order: OrderRecord, response: unknown, expected: number, quotedCostMinor: number): Promise<OrderRecord> {
    const result = parseVoucherPurchase(response);
    if ((response as { success?: unknown })?.success !== true) return (await OrdersStore.saveSupplierUncertainSubmission(order.id, 'Supplier voucher reply was not a success; outcome unknown. Do not buy again until checked.')) || order;
    if (result.pins.length > 0) await ResultsCheckerStore.savePins(order.id, result.purchaseId, result.pins);
    else if (result.purchaseId) await ResultsCheckerStore.savePurchaseId(order.id, result.purchaseId);

    const supplierRef = result.purchaseId || (result.pins.length ? `pins-${order.id.slice(-24)}` : null);
    if (!supplierRef) return (await OrdersStore.saveSupplierUncertainSubmission(order.id, 'Supplier voucher reply had no PINs and no reference. Do not buy again until checked.')) || order;

    // Only safe facts about the purchase enter the order record. PINs never do.
    const safe = { purchaseId: result.purchaseId, pinCount: result.pins.length, malformedPins: result.malformedPins, costMinor: result.costMinor };
    const cost = result.costMinor ?? quotedCostMinor * expected;
    const complete = result.pins.length === expected && result.malformedPins === 0;
    await OrdersStore.saveSupplierSubmission(order.id, supplierRef, cost, OFFER_REF, 'processing', safe);
    if (!complete) {
      await OrdersStore.updateOrderReview(order.id, true, `Supplier returned ${result.pins.length} of ${expected} PINs (${result.malformedPins} unreadable). Use the purchase lookup or supplier support to complete this order.`);
      return (await OrdersStore.findOrder(order.id)) || order;
    }
    const delivered = (await OrdersStore.updateOrderStatus(order.id, 'delivered')) || order;
    if (result.costMinor === null || result.costMinor > quotedCostMinor * expected) {
      await OrdersStore.updateOrderReview(order.id, true, result.costMinor === null ? 'Voucher delivered, but the supplier reply had no charge. Confirm cost from the statement.' : 'Voucher delivered, but the supplier charged more than quoted. Check the margin.');
    }
    return (await OrdersStore.findOrder(order.id)) || delivered;
  }

  /** Crash recovery: PINs held but the order isn't delivered yet. */
  private static async settle(order: OrderRecord): Promise<OrderRecord> {
    const record = await ResultsCheckerStore.find(order.id);
    if (!record || record.pin_count < record.qty || order.status === 'delivered') return order;
    const ref = record.supplier_purchase_id || `pins-${order.id.slice(-24)}`;
    if (!order.supplier_order_id) await OrdersStore.saveSupplierSubmission(order.id, ref, record.quoted_cost_minor * record.qty, OFFER_REF, 'processing', { purchaseId: record.supplier_purchase_id, pinCount: record.pin_count, recovered: true });
    return (await OrdersStore.updateOrderStatus(order.id, 'delivered')) || order;
  }

  private static async review(order: OrderRecord, note: string): Promise<OrderRecord> {
    await OrdersStore.updateOrderReview(order.id, true, note);
    return (await OrdersStore.findOrder(order.id)) || order;
  }

  /**
   * Status refresh, from the order pages and Admin. It only ever reads: finishing a crashed save, flagging an
   * interrupted purchase, or looking up a known supplier purchase. It can't start a purchase.
   */
  static async refresh(order: OrderRecord): Promise<OrderRecord> {
    if (order.service_type !== 'results_checker' || !['paid', 'queued', 'submitted', 'processing'].includes(order.status)) return order;
    const record = await ResultsCheckerStore.find(order.id);
    if (!record) return order;
    if (record.pin_count >= record.qty) return this.settle(order);
    if (record.supplier_purchase_id) return this.lookup(order, record.supplier_purchase_id, record.qty, record.quoted_cost_minor);
    if (record.submission_attempted_at && order.status === 'queued' && order.failure_reason !== 'supplier_submission_uncertain' && Date.now() - Date.parse(record.submission_attempted_at) > 30_000) {
      return (await OrdersStore.saveSupplierUncertainSubmission(order.id, 'Results checker purchase was interrupted; reconcile with the supplier before any further action.')) || order;
    }
    return order;
  }

  private static async lookup(order: OrderRecord, purchaseId: string, expected: number, quotedCostMinor: number): Promise<OrderRecord> {
    if (!this.client.isConfigured() || !isCheckerEncryptionConfigured()) return order;
    let response: unknown;
    try { response = await this.client.getVoucherPurchase(purchaseId); }
    catch { return order; }
    const result = parseVoucherPurchase(response);
    if (result.purchaseId && result.purchaseId !== purchaseId) return this.review(order, 'Supplier purchase lookup returned a different reference. Investigate.');
    if (result.pins.length === 0) return order;
    return this.applyPurchase(order, { success: true, data: { ...(response as { data?: object }).data, id: purchaseId } }, expected, quotedCostMinor);
  }
}
