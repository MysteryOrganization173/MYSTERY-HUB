import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { campaignOrderContext } from '../services/campaignContext.js';
import { ALLOWED_ORIGINS } from '../middleware/cors.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { OrdersStore } from '../db/ordersStore.js';
import { ResultsCheckerStore } from '../db/resultsCheckerStore.js';
import { getPool } from '../db/connection.js';
import { PaystackServerService } from '../services/paystackService.js';
import { ReferralService } from '../services/referralService.js';
import { ResultsCheckerService } from '../services/resultsCheckerService.js';
import { validateAndNormalizeGhanaPhone } from '../utils/phone.js';
import { CHECKER_MAX_QTY, CHECKER_ORDER_NETWORK, checkerOrderName, checkerProduct, checkerProductId, checkerReceiptState, type CheckerReceipt } from '../../shared/resultsCheckers.js';
import type { OrderRecord } from '../types/orders.js';

export const resultsCheckerRouter = Router();
// Nothing from this service may be held in a shared cache: some responses carry PINs.
resultsCheckerRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store, private'); res.setHeader('Pragma', 'no-cache'); next(); });

resultsCheckerRouter.get('/config', async (_req, res) => {
  try { res.json(await ResultsCheckerService.publicConfig()); }
  catch { res.status(503).json({ available: false, message: 'Results checkers are temporarily unavailable.', maxQty: CHECKER_MAX_QTY, products: [] }); }
});

/** The server decides product, price and quantity limits. Any amount sent by the browser is ignored. */
resultsCheckerRouter.post('/payments/initialize', requireAuth, campaignOrderContext, createRateLimiter({ windowMs: 600_000, max: 10 }), async (req, res) => {
  let orderId: string | undefined;
  try {
    const product = checkerProduct(req.body?.product);
    if (!product) { res.status(400).json({ error: 'Choose a results checker.', field: 'product' }); return; }
    const qty = req.body?.qty;
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > CHECKER_MAX_QTY) { res.status(400).json({ error: `Choose between 1 and ${CHECKER_MAX_QTY} checkers.`, field: 'qty' }); return; }
    const email = typeof req.body?.customerEmail === 'string' ? req.body.customerEmail.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: 'Enter a valid receipt email.', field: 'customerEmail' }); return; }
    const phone = validateAndNormalizeGhanaPhone(typeof req.body?.phone === 'string' && req.body.phone ? req.body.phone : req.user!.phone || '');
    if (!phone.isValid || !phone.normalized) { res.status(400).json({ error: 'Enter a valid Ghana phone number, so we can help if anything goes wrong.', field: 'phone' }); return; }

    if (!await ResultsCheckerService.prerequisitesMet() || (process.env.NODE_ENV === 'production' && !getPool())) { res.status(503).json({ error: 'Results checkers are not on sale yet.' }); return; }
    const { state, offer } = await ResultsCheckerService.offerFor(product, qty, true);
    if (state !== 'ok' || !offer) { res.status(409).json({ error: state === 'out_of_stock' ? `We don't have ${qty === 1 ? 'that checker' : `${qty} of that checker`} in stock right now.` : 'This checker is temporarily unavailable.' }); return; }

    const requestedOrigin = req.headers.origin || '';
    const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
    const origin = (process.env.APP_URL || process.env.FRONTEND_URL || (ALLOWED_ORIGINS.includes(requestedOrigin) || (process.env.NODE_ENV !== 'production' && isLocal.test(requestedOrigin)) ? requestedOrigin : '')).replace(/\/$/, '');
    if (!/^https:\/\/[^\s]+$/.test(origin) && !(process.env.NODE_ENV !== 'production' && isLocal.test(origin))) { res.status(503).json({ error: 'Payment is temporarily unavailable.' }); return; }

    const id = `ord_${randomUUID()}`, publicRef = `MH-RC-${randomUUID()}`, reference = `MH_rc_${randomUUID()}`, now = new Date().toISOString();
    const amount = product.retailMinor * qty;
    const order: OrderRecord = { id, user_id: req.user!.id, public_reference: publicRef, customer_name: req.user!.name, customer_email: email, customer_phone: phone.normalized, recipient_phone: phone.normalized,
      network: CHECKER_ORDER_NETWORK as OrderRecord['network'], service_type: 'results_checker', product_id: checkerProductId(product.key), product_name_snapshot: checkerOrderName(product, qty), bundle_size_snapshot: product.name,
      amount, currency: 'GHS', status: 'pending_payment', payment_provider: 'paystack', payment_reference: reference, payment_status: 'pending', supplier_provider: 'success_biz_hub',
      supplier_order_id: null, supplier_response: null, supplier_cost_minor: null, supplier_offer_ref: null, supplier_last_checked_at: null, failure_reason: null, created_at: now, updated_at: now, paid_at: null, submitted_at: null, delivered_at: null };
    const referral = await ReferralService.resolveReferralContextForOrder({ userId: req.user!.id, visitorKey: req.body.visitorKey, explicitCode: req.body.referralCode });
    Object.assign(order, { referrer_user_id: referral.referrerUserId, referral_attribution_id: referral.attributionId, referral_code: referral.referralCode });
    await ResultsCheckerStore.create(order, { product_key: product.key, qty, unit_price_minor: product.retailMinor, supplier_type_id: offer.id, quoted_cost_minor: offer.costMinor! });
    orderId = id;
    const payment = await PaystackServerService.initializeTransaction({ email, amountPesewas: amount, reference, callbackUrl: `${origin}/results-checkers`, metadata: { public_reference: publicRef, service_type: 'results_checker', product_id: order.product_id } });
    if (!payment.success) { await OrdersStore.cancelOrder(id, 'results_checker_payment_initialization_failed'); res.status(503).json({ error: 'Unable to start payment. Please try again later.' }); return; }
    res.json({ success: true, orderRef: publicRef, reference, authorizationUrl: payment.authorizationUrl, amountPesewas: amount, currency: 'GHS', isSimulated: payment.isSimulated || false });
  } catch {
    if (orderId) await OrdersStore.cancelOrder(orderId, 'results_checker_payment_initialization_failed').catch(() => {});
    // Neither the request nor supplier errors are logged or returned.
    res.status(503).json({ error: 'Unable to start your purchase. Please try again later.' });
  }
});

const receiptLimiter = createRateLimiter({ windowMs: 60_000, max: 30, key: req => req.user?.id || req.ip || 'unknown' });

/**
 * The only route that returns PINs: signed in, the order's own customer, and only after they're stored. Any other
 * order, including one that doesn't exist, gets the same 404. Opening it again later returns the same PINs.
 */
resultsCheckerRouter.get('/orders/:reference/receipt', requireAuth, receiptLimiter, async (req, res) => {
  try {
    const reference = req.params.reference;
    const order = typeof reference === 'string' && reference.length <= 128 ? await OrdersStore.findOrder(reference) : null;
    if (!order || order.service_type !== 'results_checker' || !order.user_id || order.user_id !== req.user!.id) { res.status(404).json({ error: 'We could not find that order on your account.' }); return; }
    const refreshed = await ResultsCheckerService.refresh(order).catch(() => order);
    const record = await ResultsCheckerStore.find(refreshed.id);
    if (!record) { res.status(404).json({ error: 'We could not find that order on your account.' }); return; }
    const paid = refreshed.payment_status === 'success';
    const pins = paid ? ResultsCheckerStore.pins(record) : [];
    if (pins.length) await ResultsCheckerStore.markViewed(refreshed.id);
    const receipt: CheckerReceipt = { orderRef: refreshed.public_reference, productName: refreshed.product_name_snapshot, qty: record.qty, status: refreshed.status, paid, manualReview: Boolean(refreshed.manual_review), pins, pinsExpected: record.qty,
      state: checkerReceiptState({ paid, status: refreshed.status, manualReview: Boolean(refreshed.manual_review), pinCount: pins.length, qty: record.qty }) };
    res.json(receipt);
  } catch { res.status(503).json({ error: 'We could not open this receipt just now. Your PINs are safe. Please try again.' }); }
});
