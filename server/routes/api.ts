/**
 * Production API Routes for Real Payments & Persistent Orders
 */

import { Router, Request, Response } from 'express';
import { validateAndNormalizeGhanaPhone } from '../utils/phone.js';
import { getAuthoritativeProduct } from '../data/productCatalog.js';
import { OrdersStore } from '../db/ordersStore.js';
import { OrderRecord, toSafePublicOrder } from '../types/orders.js';
import { PaystackServerService } from '../services/paystackService.js';
import { getActiveSupplierProvider } from '../suppliers/supplierInterface.js';

export const apiRouter = Router();

/**
 * 1. POST /api/payments/initialize
 * Creates pending order and initializes Paystack from the SERVER.
 * Authoritative price is loaded from the catalog — browser input price is ignored.
 */
apiRouter.post('/payments/initialize', async (req: Request, res: Response) => {
  try {
    const { productId, recipientPhone, customerEmail, customerName } = req.body || {};

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

    // 3. Load authoritative product from server catalog
    const product = getAuthoritativeProduct(productId);
    if (!product) {
      res.status(404).json({ error: 'Selected bundle product is currently unavailable or inactive.' });
      return;
    }

    // 4. Generate safe unique references
    const timestamp = Date.now();
    const randomHex = Math.floor(100000 + Math.random() * 900000);
    const publicRef = `MH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomHex}`;
    const paymentRef = `MH_PAY_${product.network.toUpperCase()}_${timestamp}_${randomHex}`;

    const nowIso = new Date().toISOString();

    // 5. Create pending order in DB
    const newOrder: OrderRecord = {
      id: `ord_${timestamp}_${randomHex}`,
      public_reference: publicRef,
      customer_name: typeof customerName === 'string' ? customerName.trim() : null,
      customer_email: validEmail,
      customer_phone: phoneVal.normalized,
      recipient_phone: phoneVal.normalized,
      network: product.network,
      product_id: product.id,
      product_name_snapshot: `${product.dataAmount} (${product.validity})`,
      bundle_size_snapshot: product.dataAmount,
      amount: product.amountPesewas, // Stored safely in pesewas
      currency: 'GHS',
      status: 'pending_payment',
      payment_provider: 'paystack',
      payment_reference: paymentRef,
      payment_status: 'pending',
      supplier_provider: 'unconfigured',
      supplier_order_id: null,
      supplier_response: null,
      failure_reason: null,
      created_at: nowIso,
      updated_at: nowIso,
      paid_at: null,
      submitted_at: null,
      delivered_at: null,
    };

    await OrdersStore.createOrder(newOrder);

    // 6. Initialize Paystack transaction on the server
    const paystackRes = await PaystackServerService.initializeTransaction({
      email: validEmail,
      amountPesewas: product.amountPesewas,
      reference: paymentRef,
      metadata: {
        public_reference: publicRef,
        recipient_phone: phoneVal.normalized,
        network: product.network,
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

    // If already marked paid, return safe details immediately
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
      // Validate amount match
      if (verifyResult.amountPesewas > 0 && verifyResult.amountPesewas !== order.amount) {
        console.warn(
          `Payment amount mismatch! Expected ${order.amount} pesewas, received ${verifyResult.amountPesewas}`
        );
        await OrdersStore.updateOrderStatus(order.id, 'failed', 'Payment amount mismatch detected');
        res.status(400).json({ error: 'Payment verification failed due to amount mismatch.' });
        return;
      }

      const supplierNotice = 'Order paid and queued for automated dispatch.';
      const { order: updatedOrder } = await OrdersStore.markOrderPaid(
        order.payment_reference,
        verifyResult.paidAt || new Date().toISOString(),
        supplierNotice
      );

      res.json({
        verified: true,
        order: updatedOrder ? toSafePublicOrder(updatedOrder) : toSafePublicOrder(order),
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

    res.json({
      success: true,
      order: toSafePublicOrder(order),
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
          // Idempotent update
          if (currency === 'GHS' && amountPesewas === order.amount) {
            const supplier = getActiveSupplierProvider();
            const queueNotice = `Paid via Paystack Webhook. Supplier status: ${supplier.providerName}`;
            await OrdersStore.markOrderPaid(
              paymentRef,
              data.paid_at || new Date().toISOString(),
              queueNotice
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
    console.error('Webhook Handler Exception:', err);
    res.status(200).json({ status: 'error_logged' });
  }
}
