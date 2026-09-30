/**
 * Production API Routes for Real Payments & Persistent Orders
 */

import { Router, Request, Response } from 'express';
import { validateAndNormalizeGhanaPhone } from '../utils/phone.js';
import { getAuthoritativeProduct } from '../data/productCatalog.js';
import { calculateAirtimeOrder, validateAirtimeAmount, AIRTIME_SERVICE_FEE_PERCENT } from '../data/airtimePricing.js';
import { OrdersStore } from '../db/ordersStore.js';
import { OrderRecord, toSafePublicOrder } from '../types/orders.js';
import { PaystackServerService } from '../services/paystackService.js';
import { FulfilmentService } from '../services/fulfilmentService.js';
import { SuccessBizHubWebhookHandler } from '../suppliers/successBizHub/webhookHandler.js';
import {
  ACTIVE_MTN_ORDER_CODE,
  ACTIVE_MTN_ORDER_MESSAGE,
  mapToSafeCustomerStatus,
} from '../services/duplicateOrderProtection.js';

export const apiRouter = Router();

/**
 * 0. GET /api/health
 * Lightweight health check endpoint for monitoring & Render deployment checks
 */
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'mysteryhub-api',
  });
});

/**
 * 1. POST /api/payments/initialize
 * Creates pending order and initializes Paystack from the SERVER.
 * Authoritative price is loaded from the catalog — browser input price is ignored.
 * If fulfillment is enabled, performs supplier preflight checks before taking customer payment.
 */
apiRouter.post('/payments/initialize', async (req: Request, res: Response) => {
  try {
    const { productId, recipientPhone, customerEmail, customerName, serviceType, network: reqNetwork, amount: reqAmount } = req.body || {};

    if (!productId || typeof productId !== 'string') {
      res.status(400).json({ error: 'Missing or invalid productId parameter.' });
      return;
    }

    // 1. Validate Ghana recipient phone
    const phoneVal = validateAndNormalizeGhanaPhone(recipientPhone);
    if (!phoneVal.isValid || !phoneVal.normalized) {
      res.status(400).json({ error: phoneVal.error || 'Invalid recipient phone number.' });
      return;
    }

    // 2. Validate customer email
    const emailStr = typeof customerEmail === 'string' ? customerEmail.trim() : '';
    const validEmail =
      emailStr.includes('@') && emailStr.includes('.')
        ? emailStr
        : `${phoneVal.formattedLocal}@customer.mysteryhub.site`;

    const isAirtime =
      serviceType === 'airtime' ||
      productId.startsWith('airtime-') ||
      productId === 'airtime';

    // ==========================================
    // A. AIRTIME TOP-UP FLOW
    // ==========================================
    if (isAirtime) {
      // 1. Determine network
      let airtimeNet = typeof reqNetwork === 'string' ? reqNetwork.toLowerCase().trim() : '';
      if (!airtimeNet && productId.startsWith('airtime-')) {
        const parts = productId.split('-');
        if (parts[1]) airtimeNet = parts[1].toLowerCase().trim();
      }
      if (airtimeNet === 'at') airtimeNet = 'airteltigo';

      if (!['mtn', 'airteltigo', 'telecel'].includes(airtimeNet)) {
        res.status(400).json({ error: 'Please select a valid network (MTN, AirtelTigo, or Telecel).' });
        return;
      }

      // 2. Determine requested face value amount in GHS
      let airtimeFaceValue = 0;
      if (typeof reqAmount === 'number' && !isNaN(reqAmount)) {
        airtimeFaceValue = reqAmount;
      } else if (typeof reqAmount === 'string') {
        airtimeFaceValue = parseFloat(reqAmount);
      } else if (productId.startsWith('airtime-')) {
        const parts = productId.split('-');
        if (parts[2]) airtimeFaceValue = parseFloat(parts[2]);
      }

      const amountValidation = validateAirtimeAmount(airtimeFaceValue);
      if (!amountValidation.isValid) {
        res.status(400).json({ error: amountValidation.error || 'Invalid airtime amount.' });
        return;
      }

      // 3. Server-authoritative fee and total calculation (2% service fee)
      const calculation = calculateAirtimeOrder(airtimeFaceValue);

      // 4. Supplier Preflight Check for Airtime
      const preflight = await FulfilmentService.preflightCheckAirtime(
        airtimeNet,
        calculation.faceValuePesewas,
        phoneVal.normalized
      );
      if (!preflight.allowed) {
        res.status(400).json({
          error:
            preflight.customerMessage ||
            'Airtime Top-Up is temporarily unavailable. Please try again shortly.',
        });
        return;
      }

      // 5. Generate safe unique references
      const timestamp = Date.now();
      const randomHex = Math.floor(100000 + Math.random() * 900000);
      const publicRef = `MH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomHex}`;
      const paymentRef = `MH_PAY_AIRTIME_${airtimeNet.toUpperCase()}_${timestamp}_${randomHex}`;
      const nowIso = new Date().toISOString();

      // 6. Create pending Airtime order
      const newOrder: OrderRecord = {
        id: `ord_${timestamp}_${randomHex}`,
        public_reference: publicRef,
        customer_name: typeof customerName === 'string' ? customerName.trim() : null,
        customer_email: validEmail,
        customer_phone: phoneVal.normalized,
        recipient_phone: phoneVal.normalized,
        network: airtimeNet as 'mtn' | 'airteltigo' | 'telecel',
        service_type: 'airtime',
        product_id: `airtime-${airtimeNet}-${calculation.faceValueGhc}`,
        product_name_snapshot: `${airtimeNet.toUpperCase()} Airtime Top-Up`,
        bundle_size_snapshot: `GH₵${calculation.faceValueGhc.toFixed(2)} Airtime`,
        amount: calculation.totalPesewas, // Customer total with service fee
        face_value_minor: calculation.faceValuePesewas,
        service_fee_minor: calculation.serviceFeePesewas,
        currency: 'GHS',
        status: 'pending_payment',
        payment_provider: 'paystack',
        payment_reference: paymentRef,
        payment_status: 'pending',
        supplier_provider: 'success_biz_hub',
        supplier_order_id: null,
        supplier_response: null,
        supplier_cost_minor: null,
        supplier_offer_ref: 'sbh_airtime',
        supplier_last_checked_at: null,
        failure_reason: null,
        created_at: nowIso,
        updated_at: nowIso,
        paid_at: null,
        submitted_at: null,
        delivered_at: null,
      };

      const createResult = await OrdersStore.createOrderWithMtnDuplicateCheck(newOrder);
      if (!createResult.success) {
        res.status(409).json({
          code: ACTIVE_MTN_ORDER_CODE,
          message: ACTIVE_MTN_ORDER_MESSAGE,
          existingOrderReference: createResult.existingOrder.public_reference,
          existingOrderStatus: mapToSafeCustomerStatus(createResult.existingOrder.status),
        });
        return;
      }

      // 7. Initialize Paystack transaction with authoritative total
      const paystackRes = await PaystackServerService.initializeTransaction({
        email: validEmail,
        amountPesewas: calculation.totalPesewas,
        reference: paymentRef,
        metadata: {
          public_reference: publicRef,
          recipient_phone: phoneVal.normalized,
          network: airtimeNet,
          service_type: 'airtime',
          face_value_ghc: calculation.faceValueGhc,
          service_fee_ghc: calculation.serviceFeeGhc,
          product_name: `${airtimeNet.toUpperCase()} GH₵${calculation.faceValueGhc} Airtime`,
        },
      });

      if (!paystackRes.success) {
        res.status(500).json({ error: paystackRes.error || 'Failed to initialize payment with Paystack.' });
        return;
      }

      res.json({
        success: true,
        orderRef: publicRef,
        reference: paymentRef,
        accessCode: paystackRes.accessCode,
        authorizationUrl: paystackRes.authorizationUrl,
        amountGhc: calculation.totalGhc,
        faceValueGhc: calculation.faceValueGhc,
        serviceFeeGhc: calculation.serviceFeeGhc,
        amountPesewas: calculation.totalPesewas,
        currency: 'GHS',
        isSimulated: paystackRes.isSimulated || false,
      });
      return;
    }

    // ==========================================
    // B. DATA BUNDLE FLOW
    // ==========================================
    // 3. Load authoritative product from server catalog
    const product = getAuthoritativeProduct(productId);
    if (!product) {
      res.status(404).json({ error: 'Selected bundle product is currently unavailable or inactive.' });
      return;
    }

    // 3a. MTN Duplicate Active Order Protection
    // MTN network does not allow another bundle order for the same recipient while a previous one is processing.
    // Rejects before preflight and before Paystack payment initialization.
    if (product.network.toLowerCase() === 'mtn') {
      const activeMtnOrder = await OrdersStore.findActiveMtnOrder(phoneVal.normalized);
      if (activeMtnOrder) {
        res.status(409).json({
          code: ACTIVE_MTN_ORDER_CODE,
          message: ACTIVE_MTN_ORDER_MESSAGE,
          existingOrderReference: activeMtnOrder.public_reference,
          existingOrderStatus: mapToSafeCustomerStatus(activeMtnOrder.status),
        });
        return;
      }
    }

    // 4. Supplier Preflight Check (when fulfillment enabled)
    // Never take customer money for an order we already know cannot be submitted
    const preflight = await FulfilmentService.preflightCheck(
      product.network,
      product.dataAmount,
      phoneVal.normalized
    );
    if (!preflight.allowed) {
      res.status(400).json({
        error:
          preflight.customerMessage ||
          'This bundle is temporarily unavailable. Please try another package or try again shortly.',
      });
      return;
    }

    // 5. Generate safe unique references
    const timestamp = Date.now();
    const randomHex = Math.floor(100000 + Math.random() * 900000);
    const publicRef = `MH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomHex}`;
    const paymentRef = `MH_PAY_${product.network.toUpperCase()}_${timestamp}_${randomHex}`;

    const nowIso = new Date().toISOString();

    // 6. Create pending order in DB atomically with race-condition check
    const newOrder: OrderRecord = {
      id: `ord_${timestamp}_${randomHex}`,
      public_reference: publicRef,
      customer_name: typeof customerName === 'string' ? customerName.trim() : null,
      customer_email: validEmail,
      customer_phone: phoneVal.normalized,
      recipient_phone: phoneVal.normalized,
      network: product.network,
      service_type: 'data',
      product_id: product.id,
      product_name_snapshot: `${product.network.toUpperCase()} ${product.dataAmount}`,
      bundle_size_snapshot: product.dataAmount,
      amount: product.amountPesewas, // Stored safely in pesewas
      currency: 'GHS',
      status: 'pending_payment',
      payment_provider: 'paystack',
      payment_reference: paymentRef,
      payment_status: 'pending',
      supplier_provider: 'success_biz_hub',
      supplier_order_id: null,
      supplier_response: null,
      supplier_cost_minor: preflight.supplierCostMinor ?? null,
      supplier_offer_ref: null,
      supplier_last_checked_at: null,
      failure_reason: null,
      created_at: nowIso,
      updated_at: nowIso,
      paid_at: null,
      submitted_at: null,
      delivered_at: null,
    };

    const createResult = await OrdersStore.createOrderWithMtnDuplicateCheck(newOrder);
    if (!createResult.success) {
      res.status(409).json({
        code: ACTIVE_MTN_ORDER_CODE,
        message: ACTIVE_MTN_ORDER_MESSAGE,
        existingOrderReference: createResult.existingOrder.public_reference,
        existingOrderStatus: mapToSafeCustomerStatus(createResult.existingOrder.status),
      });
      return;
    }

    // 7. Initialize Paystack transaction on the server
    const paystackRes = await PaystackServerService.initializeTransaction({
      email: validEmail,
      amountPesewas: product.amountPesewas,
      reference: paymentRef,
      metadata: {
        public_reference: publicRef,
        recipient_phone: phoneVal.normalized,
        network: product.network,
        service_type: 'data',
        product_id: product.id,
        product_name: product.dataAmount,
      },
    });

    if (!paystackRes.success) {
      res.status(500).json({ error: paystackRes.error || 'Failed to initialize payment with Paystack.' });
      return;
    }

    res.json({
      success: true,
      orderRef: publicRef,
      reference: paymentRef,
      accessCode: paystackRes.accessCode,
      authorizationUrl: paystackRes.authorizationUrl,
      amountGhc: product.priceGhc,
      amountPesewas: product.amountPesewas,
      currency: 'GHS',
      isSimulated: paystackRes.isSimulated || false,
    });
  } catch (err) {
    console.error('Payment Initialize Controller Exception:', err);
    res.status(500).json({ error: 'An unexpected server error occurred initializing payment.' });
  }
});

/**
 * 2. GET /api/payments/verify/:reference
 * Server-side payment verification endpoint.
 * Dispatches to centralized fulfillment orchestration upon verified payment.
 */
apiRouter.get('/payments/verify/:reference', async (req: Request, res: Response) => {
  try {
    const ref = req.params.reference;
    if (!ref) {
      res.status(400).json({ error: 'Reference parameter is required.' });
      return;
    }

    const order = await OrdersStore.findOrder(ref);
    if (!order) {
      res.status(404).json({ error: 'Order reference not found.' });
      return;
    }

    // If already marked paid or beyond, return safe details immediately
    if (order.status !== 'pending_payment' && order.payment_status === 'success') {
      res.json({
        verified: true,
        order: toSafePublicOrder(order),
        message: 'Payment verified.',
      });
      return;
    }

    // Verify with Paystack API
    const verifyResult = await PaystackServerService.verifyTransaction(order.payment_reference);

    if (verifyResult.isVerified) {
      // 1. Validate currency requirement: must be GHS
      if (!verifyResult.currency || verifyResult.currency.toUpperCase() !== 'GHS') {
        console.warn(
          `Payment currency mismatch! Expected GHS, received ${verifyResult.currency || 'UNKNOWN'} for order ${order.public_reference}`
        );
        await OrdersStore.updateOrderStatus(order.id, 'failed', 'Payment currency mismatch detected');
        res.status(400).json({ error: 'Payment verification failed due to currency mismatch.' });
        return;
      }

      // 2. Validate amount match
      if (verifyResult.amountPesewas > 0 && verifyResult.amountPesewas !== order.amount) {
        console.warn(
          `Payment amount mismatch! Expected ${order.amount} pesewas, received ${verifyResult.amountPesewas}`
        );
        await OrdersStore.updateOrderStatus(order.id, 'failed', 'Payment amount mismatch detected');
        res.status(400).json({ error: 'Payment verification failed due to amount mismatch.' });
        return;
      }

      // 3. Centralized payment -> fulfillment dispatch
      const { order: dispatchedOrder } = await FulfilmentService.processPaidOrder(
        order.payment_reference,
        verifyResult.paidAt || new Date().toISOString(),
        'Paystack verify API'
      );

      res.json({
        verified: true,
        order: dispatchedOrder ? toSafePublicOrder(dispatchedOrder) : toSafePublicOrder(order),
        message: 'Payment verified successfully.',
      });
    } else {
      res.json({
        verified: false,
        order: toSafePublicOrder(order),
        message: verifyResult.error || 'Payment not yet confirmed by Paystack.',
      });
    }
  } catch (err) {
    console.error('Payment Verify Exception:', err);
    res.status(500).json({ error: 'Failed to verify payment.' });
  }
});

/**
 * 3. GET /api/orders/lookup/:reference
 * Returns safe public details of an order. No secrets or supplier credentials exposed.
 * If order is submitted or processing, best-effort throttled status refresh is performed.
 */
apiRouter.get('/orders/lookup/:reference', async (req: Request, res: Response) => {
  try {
    const ref = req.params.reference;
    if (!ref) {
      res.status(400).json({ error: 'Order reference parameter is required.' });
      return;
    }

    const order = await OrdersStore.findOrder(ref);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    // Refresh status from supplier if due (30-second throttle)
    const activeOrder = await FulfilmentService.refreshOrderStatusIfDue(order);

    res.json({
      success: true,
      order: toSafePublicOrder(activeOrder),
    });
  } catch (err) {
    console.error('Order Lookup Exception:', err);
    res.status(500).json({ error: 'Unable to retrieve order details.' });
  }
});

/**
 * 4. POST /api/webhooks/paystack
 * Idempotent, signature-verified Paystack Webhook Handler
 */
export async function handlePaystackWebhook(req: Request, res: Response): Promise<void> {
  try {
    const signature = (req.headers['x-paystack-signature'] as string) || '';
    const rawBody = (req as unknown as { rawBody?: Buffer | string }).rawBody || JSON.stringify(req.body);

    const isValidSignature = PaystackServerService.verifyWebhookSignature(rawBody, signature);

    if (!isValidSignature && process.env.NODE_ENV === 'production') {
      console.warn('Unauthorized Paystack Webhook Attempt — Invalid Signature.');
      res.status(401).json({ error: 'Invalid signature.' });
      return;
    }

    const eventData = req.body || {};
    const event = eventData.event;

    if (event === 'charge.success') {
      const data = eventData.data || {};
      const paymentRef = data.reference;
      const amountPesewas = data.amount;
      const currency = data.currency;

      if (paymentRef) {
        const order = await OrdersStore.findOrder(paymentRef);
        if (order) {
          // Idempotent update & centralized fulfillment
          if (currency === 'GHS' && amountPesewas === order.amount) {
            await FulfilmentService.processPaidOrder(
              paymentRef,
              data.paid_at || new Date().toISOString(),
              'Paystack charge.success webhook'
            );
          } else {
            console.warn(`Webhook amount/currency mismatch for order ${order.public_reference}`);
          }
        }
      }
    }

    // Webhooks must return 200 OK promptly
    res.status(200).json({ status: 'success' });
  } catch (err) {
    console.error('Paystack Webhook Handler Exception:', err);
    res.status(200).json({ status: 'error_logged' });
  }
}

/**
 * 5. POST /api/webhooks/success-biz-hub
 * Success Biz Hub Webhook Handler
 */
export const handleSuccessBizHubWebhook = SuccessBizHubWebhookHandler.handle.bind(
  SuccessBizHubWebhookHandler
);
