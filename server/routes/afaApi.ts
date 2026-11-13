import {campaignOrderContext} from '../services/campaignContext.js';
import { Router } from 'express';
import { FinanceService } from '../services/financeService.js';
import { FinanceStore, FinanceError } from '../db/financeStore.js';
import { ReferralService } from '../services/referralService.js';
import { randomUUID } from 'node:crypto';
import { ALLOWED_ORIGINS } from '../middleware/cors.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { AfaService } from '../services/afaService.js';
import { CommercialService, AfaReviewRequired } from '../services/commercialService.js';
import { afaRequestMatchesQuote } from '../../shared/afaPricing.js';
import { AfaStore, AfaDuplicateError } from '../db/afaStore.js';
import { OrdersStore } from '../db/ordersStore.js';
import { getPool } from '../db/connection.js';
import { PaystackServerService } from '../services/paystackService.js';
import { AfaValidationError, validateAfaPayload } from '../../shared/afa.js';
import { validateAndNormalizeGhanaPhone } from '../utils/phone.js';
import type { OrderRecord } from '../types/orders.js';

export const afaRouter = Router();
afaRouter.get('/config', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try { res.json(await AfaService.publicConfig()); }
  catch { res.status(503).json({ available:false, enabled:false, retailPriceMinor:null, retailPriceGhc:null, status:'supplier_error', message:'AFA registration is temporarily unavailable.' }); }
});
/** The customer's AFA fee quote (standard price, any applying promotion, total and pricing revision). */
afaRouter.get('/quote', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try { res.json(await CommercialService.afaQuote()); }
  catch { res.status(503).json({ available:false, enabled:false, standardMinor:null, totalMinor:null, pricingRevision:null, retailPriceMinor:null, retailPriceGhc:null, welcomeApplies:false, status:'supplier_error', message:'AFA registration is temporarily unavailable.' }); }
});
const reviewBody=(quote:any)=>({error:'The registration fee changed. Review the new total before paying.',code:'AFA_REVIEW_REQUIRED',quote});
afaRouter.post('/payments/initialize', requireAuth,campaignOrderContext, createRateLimiter({windowMs:600_000,max:10}), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let orderId: string | undefined;
  try {
    if (!req.body || Array.isArray(req.body) || Buffer.byteLength(JSON.stringify(req.body)) > 8192) { res.status(413).json({error:'Registration request is too large.'}); return; }
    if (req.body.consent !== true) { res.status(400).json({error:'Please authorize submission of your registration details.',field:'consent'}); return; }
    const payload = validateAfaPayload(req.body);
    if(req.body.paymentMethod==='wallet') {
      const old=await FinanceStore.transaction(req.user!.id,tx=>tx.find(`purchase:${req.body.requestId}`));
      if(old) {if(old.payload.recipient!==validateAndNormalizeGhanaPhone(payload.phone).normalized||old.payload.service!=='afa')throw new FinanceError('Checkout request details changed.',409);
        const paid=await FinanceService.recoverPurchase(req.user!.id,old.payload.orderId);res.json({success:true,paymentMethod:'wallet',orderRef:paid.public_reference,reference:paid.payment_reference,status:paid.status,amountPesewas:paid.amount});return;}
    }
    const email = typeof req.body.customerEmail === 'string' ? req.body.customerEmail.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({error:'Enter a valid receipt email.',field:'customerEmail'}); return; }
    // One authority for the fee: the commercial quote (existing availability + the standard or approved promotional price).
    const quote = await CommercialService.afaQuote();
    const requestedOrigin = req.headers.origin || '';
    const origin = (process.env.APP_URL || process.env.FRONTEND_URL || (ALLOWED_ORIGINS.includes(requestedOrigin) || (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestedOrigin)) ? requestedOrigin : '')).replace(/\/$/, '');
    if (!/^https:\/\/[^\s]+$/.test(origin) && !(process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {res.status(503).json({error:'Registration payment is temporarily unavailable.'});return;}
    if (!quote.available || quote.totalMinor === null || quote.pricingRevision === null || (process.env.NODE_ENV === 'production' && !getPool())) { res.status(503).json({error:'AFA registration is temporarily unavailable.'}); return; }
    // A stated total or revision must match exactly; a promotional price must always have been reviewed.
    if (!afaRequestMatchesQuote({totalMinor:quote.totalMinor,pricingRevision:quote.pricingRevision,campaign:quote.campaign},req.body)) { res.status(409).json(reviewBody(quote)); return; }
    const id = `ord_${randomUUID()}`, publicRef = `MH-AFA-${randomUUID()}`, reference = `MH_afa_${randomUUID()}`, now = new Date().toISOString();
    const order: OrderRecord = {id, user_id:req.user!.id, public_reference:publicRef, customer_name:req.user!.name,
      customer_email:email, customer_phone:req.user!.phone || validateAndNormalizeGhanaPhone(payload.phone).normalized!,
      recipient_phone:validateAndNormalizeGhanaPhone(payload.phone).normalized!, network:'mtn', service_type:'afa', product_id:'afa-registration',
      product_name_snapshot:'AFA Registration',bundle_size_snapshot:'MTN AFA Registration',amount:quote.totalMinor,currency:'GHS',
      status:'pending_payment',payment_provider:'paystack',payment_reference:reference,payment_status:'pending',supplier_provider:'success_biz_hub',
      supplier_order_id:null,supplier_response:null,supplier_cost_minor:null,supplier_offer_ref:null,supplier_last_checked_at:null,failure_reason:null,
      created_at:now,updated_at:now,paid_at:null,submitted_at:null,delivered_at:null};
    const referral=await ReferralService.resolveReferralContextForOrder({userId:req.user!.id,visitorKey:req.body.visitorKey,explicitCode:req.body.referralCode});
    Object.assign(order,{referrer_user_id:referral.referrerUserId,referral_attribution_id:referral.attributionId,referral_code:referral.referralCode});
    // Promotional sales only: an immutable record of the standard price and the promotion (no welcome benefit; no other order changes).
    if (quote.campaign) order.commercial_context = {regularMinor:quote.totalMinor,discountMinor:0,paidMinor:quote.totalMinor,pricingRevision:quote.pricingRevision,promotionId:null,promotionRevision:null,buyerPhone:null,
      supplierCostMinor:null,reserveMinor:null,contributionMinor:null,standardMinor:quote.standardMinor!,priceCampaignId:quote.campaign.id,priceCampaignRevision:quote.pricingRevision};
    const sameQuote = (price: Awaited<ReturnType<typeof CommercialService.afaPrice>>) => !!price && price.totalMinor === order.amount && price.pricingRevision === quote.pricingRevision;
    if(req.body.paymentMethod==='wallet') {
      // Re-quoted inside the Wallet transaction under the commercial policy lock: the debit is exactly the reviewed fee.
      const paid=await FinanceService.payOrder(order,req.body.requestId,(tx,record)=>AfaStore.create(record,payload,tx.client),async tx=>{if(!sameQuote(await CommercialService.afaPrice(tx)))throw new AfaReviewRequired(null);return order;});
      res.json({success:true,paymentMethod:'wallet',orderRef:paid.public_reference,reference:paid.payment_reference,status:paid.status,amountPesewas:paid.amount});return;
    }
    await AfaStore.create(order, payload); orderId=id;
    // Checked again at the payment boundary: a fee that changed after the order was written is never sent to Paystack.
    if (!sameQuote(await CommercialService.afaPrice())) { await OrdersStore.cancelOrder(id,'afa_price_changed_before_payment'); orderId=undefined; res.status(409).json(reviewBody(await CommercialService.afaQuote().catch(()=>null))); return; }
    // Only safe order context enters payment metadata. Identity fields remain encrypted in the AFA store.
    const payment = await PaystackServerService.initializeTransaction({email,amountPesewas:order.amount,reference,
      ...(origin ? {callbackUrl:`${origin}/afa`} : {}),metadata:{public_reference:publicRef,service_type:'afa',product_id:'afa-registration'}});
    if (!payment.success) { await OrdersStore.cancelOrder(id,'afa_payment_initialization_failed'); res.status(503).json({error:'Unable to start payment. Please try again later.'}); return; }
    res.json({success:true,orderRef:publicRef,reference,authorizationUrl:payment.authorizationUrl,accessCode:payment.accessCode,amountPesewas:order.amount,amountGhc:order.amount/100,currency:'GHS',isSimulated:payment.isSimulated || false});
  } catch (err) {
    // The fresh quote is read after the transaction, so no supplier call happens while it holds locks.
    if (err instanceof AfaReviewRequired) {res.status(409).json(reviewBody(err.quote ?? await CommercialService.afaQuote().catch(()=>null)));return;}
    if (err instanceof FinanceError) {res.status(err.status).json({error:err.message});return;}
    if (err instanceof AfaValidationError) { res.status(400).json({error:err.message,field:err.field}); return; }
    if (err instanceof AfaDuplicateError || (err as {code?:string}).code === '23505') { res.status(409).json({error:new AfaDuplicateError().message}); return; }
    if (orderId) await OrdersStore.cancelOrder(orderId,'afa_payment_initialization_failed').catch(() => {});
    // Neither request bodies nor supplier/crypto errors are logged or returned.
    res.status(503).json({error:'Unable to start AFA registration. Please try again later.'});
  }
});
