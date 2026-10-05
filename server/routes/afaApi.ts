import { Router } from 'express';
import { FinanceService } from '../services/financeService.js';
import { FinanceStore, FinanceError } from '../db/financeStore.js';
import { ReferralService } from '../services/referralService.js';
import { randomUUID } from 'node:crypto';
import { ALLOWED_ORIGINS } from '../middleware/cors.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { AfaService } from '../services/afaService.js';
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
afaRouter.post('/payments/initialize', requireAuth, createRateLimiter({windowMs:600_000,max:10}), async (req, res) => {
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
    const config = await AfaService.publicConfig();
    const requestedOrigin = req.headers.origin || '';
    const origin = (process.env.APP_URL || process.env.FRONTEND_URL || (ALLOWED_ORIGINS.includes(requestedOrigin) || (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestedOrigin)) ? requestedOrigin : '')).replace(/\/$/, '');
    if (!/^https:\/\/[^\s]+$/.test(origin) && !(process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {res.status(503).json({error:'Registration payment is temporarily unavailable.'});return;}
    if (!config.available || config.retailPriceMinor === null || (process.env.NODE_ENV === 'production' && !getPool())) { res.status(503).json({error:'AFA registration is temporarily unavailable.'}); return; }
    const id = `ord_${randomUUID()}`, publicRef = `MH-AFA-${randomUUID()}`, reference = `MH_afa_${randomUUID()}`, now = new Date().toISOString();
    const order: OrderRecord = {id, user_id:req.user!.id, public_reference:publicRef, customer_name:req.user!.name,
      customer_email:email, customer_phone:req.user!.phone || validateAndNormalizeGhanaPhone(payload.phone).normalized!,
      recipient_phone:validateAndNormalizeGhanaPhone(payload.phone).normalized!, network:'mtn', service_type:'afa', product_id:'afa-registration',
      product_name_snapshot:'AFA Registration',bundle_size_snapshot:'MTN AFA Registration',amount:config.retailPriceMinor,currency:'GHS',
      status:'pending_payment',payment_provider:'paystack',payment_reference:reference,payment_status:'pending',supplier_provider:'success_biz_hub',
      supplier_order_id:null,supplier_response:null,supplier_cost_minor:null,supplier_offer_ref:null,supplier_last_checked_at:null,failure_reason:null,
      created_at:now,updated_at:now,paid_at:null,submitted_at:null,delivered_at:null};
    const referral=await ReferralService.resolveReferralContextForOrder({userId:req.user!.id,visitorKey:req.body.visitorKey,explicitCode:req.body.referralCode});
    Object.assign(order,{referrer_user_id:referral.referrerUserId,referral_attribution_id:referral.attributionId,referral_code:referral.referralCode});
    if(req.body.paymentMethod==='wallet') {
      const paid=await FinanceService.payOrder(order,req.body.requestId,(tx,record)=>AfaStore.create(record,payload,tx.client));
      res.json({success:true,paymentMethod:'wallet',orderRef:paid.public_reference,reference:paid.payment_reference,status:paid.status,amountPesewas:paid.amount});return;
    }
    await AfaStore.create(order, payload); orderId=id;
    // Only safe order context enters payment metadata. Identity fields remain encrypted in the AFA store.
    const payment = await PaystackServerService.initializeTransaction({email,amountPesewas:order.amount,reference,
      ...(origin ? {callbackUrl:`${origin}/afa`} : {}),metadata:{public_reference:publicRef,service_type:'afa',product_id:'afa-registration'}});
    if (!payment.success) { await OrdersStore.cancelOrder(id,'afa_payment_initialization_failed'); res.status(503).json({error:'Unable to start payment. Please try again later.'}); return; }
    res.json({success:true,orderRef:publicRef,reference,authorizationUrl:payment.authorizationUrl,accessCode:payment.accessCode,amountPesewas:order.amount,amountGhc:order.amount/100,currency:'GHS',isSimulated:payment.isSimulated || false});
  } catch (err) {
    if (err instanceof FinanceError) {res.status(err.status).json({error:err.message});return;}
    if (err instanceof AfaValidationError) { res.status(400).json({error:err.message,field:err.field}); return; }
    if (err instanceof AfaDuplicateError || (err as {code?:string}).code === '23505') { res.status(409).json({error:new AfaDuplicateError().message}); return; }
    if (orderId) await OrdersStore.cancelOrder(orderId,'afa_payment_initialization_failed').catch(() => {});
    // Neither request bodies nor supplier/crypto errors are logged or returned.
    res.status(503).json({error:'Unable to start AFA registration. Please try again later.'});
  }
});
