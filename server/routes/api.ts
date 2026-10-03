/**
 * Production API Routes for Real Payments & Persistent Orders
 */

import { Router, Request, Response } from 'express';
import { validateAndNormalizeGhanaPhone } from '../utils/phone.js';
import { getAuthoritativeProduct } from '../data/productCatalog.js';
import { calculateAirtimeOrder, validateAirtimeAmount, AIRTIME_SERVICE_FEE_PERCENT } from '../data/airtimePricing.js';
import {
  calculateFixedInstantBundlePrice,
  calculateFlexiInstantBundlePrice,
  toPublicInstantBundle,
  PublicInstantBundle,
} from '../data/instantBundlePricing.js';
import { SbhInstantBundlePackage } from '../suppliers/successBizHub/types.js';
import { OrdersStore } from '../db/ordersStore.js';
import { AuthStore } from '../db/authStore.js';
import { WaitlistStore } from '../db/waitlistStore.js';
import { MarketplaceStore } from '../db/marketplaceStore.js';
import { parseJsonVariants, parseJsonPickupLocations } from '../types/marketplace.js';
import { ReferralStore } from '../db/referralStore.js';
import { ReferralService } from '../services/referralService.js';
import { OrderRecord, toSafePublicOrder } from '../types/orders.js';
import { toSafeUserProfile, WaitlistChannel } from '../types/auth.js';
import { hashPassword, verifyPassword, generateSessionToken } from '../utils/crypto.js';
import { parseIdentifier, validatePassword } from '../utils/authValidation.js';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware.js';
import { loginRateLimiter, signupRateLimiter, waitlistRateLimiter } from '../middleware/rateLimiter.js';
import { PaystackServerService } from '../services/paystackService.js';
import { FulfilmentService } from '../services/fulfilmentService.js';
import { validateOrderPayment } from '../services/paymentValidation.js';
import { SuccessBizHubWebhookHandler } from '../suppliers/successBizHub/webhookHandler.js';
import { websiteRouter, handlePublicSiteBySlug } from './websiteApi.js';
import {
  ACTIVE_MTN_ORDER_CODE,
  ACTIVE_MTN_ORDER_MESSAGE,
  mapToSafeCustomerStatus,
} from '../services/duplicateOrderProtection.js';

export const apiRouter = Router();

// Mount Website Builder endpoints
apiRouter.use('/websites', websiteRouter);
apiRouter.get('/public/sites/:slug', handlePublicSiteBySlug);

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
 * 0b. GET /api/instant-bundles
 * Returns live Instant Bundle offers with server-calculated Mystery Hub retail pricing.
 * Wholesale supplier costs, API keys, and accounting internals are NEVER returned.
 */
apiRouter.get('/instant-bundles', async (_req: Request, res: Response) => {
  try {
    const provider = FulfilmentService.getProvider();
    const serviceCheck = await provider.client.checkInstantBundlesService();

    if (!serviceCheck.permitted || !serviceCheck.available) {
      res.json({
        success: true,
        available: false,
        reason: serviceCheck.reason || 'Instant Bundles service is currently unavailable.',
        products: [],
      });
      return;
    }

    const catalogRes = await provider.client.getInstantBundles();
    let rawList: SbhInstantBundlePackage[] = [];
    if (Array.isArray(catalogRes.data)) {
      rawList = catalogRes.data;
    } else if (catalogRes.data && Array.isArray((catalogRes.data as { packages?: SbhInstantBundlePackage[] }).packages)) {
      rawList = (catalogRes.data as { packages?: SbhInstantBundlePackage[] }).packages!;
    } else if (catalogRes.data && Array.isArray((catalogRes.data as { products?: SbhInstantBundlePackage[] }).products)) {
      rawList = (catalogRes.data as { products?: SbhInstantBundlePackage[] }).products!;
    }

    const publicProducts: PublicInstantBundle[] = [];
    for (const pkg of rawList) {
      if (pkg.enabled === false) continue;
      const mapped = toPublicInstantBundle(pkg);
      if (mapped) {
        publicProducts.push(mapped);
      }
    }

    res.json({
      success: true,
      available: publicProducts.length > 0,
      reason: publicProducts.length === 0 ? 'No sellable instant bundle packages are currently available.' : undefined,
      products: publicProducts,
    });
  } catch (err) {
    console.error('Error in GET /api/instant-bundles:', err);
    res.json({
      success: true,
      available: false,
      reason: 'Instant Bundles are temporarily unavailable.',
      products: [],
    });
  }
});

/**
 * 1. POST /api/payments/initialize
 * Creates pending order and initializes Paystack from the SERVER.
 * Authoritative price is loaded from the catalog — browser input price is ignored.
 * If fulfillment is enabled, performs supplier preflight checks before taking customer payment.
 */
apiRouter.post('/payments/initialize', optionalAuth, async (req: Request, res: Response) => {
  const reqStart = performance.now();
  try {
    const { productId, recipientPhone, phone: bodyPhone, customerPhone, customerEmail, customerName, serviceType, network: reqNetwork, amount: reqAmount } = req.body || {};

    if (!productId || typeof productId !== 'string') {
      res.status(400).json({ error: 'Missing or invalid productId parameter.' });
      return;
    }

    const rawPhone = recipientPhone || bodyPhone || customerPhone;
    const phoneVal = validateAndNormalizeGhanaPhone(rawPhone);
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

    // 2b. Mystery Earn: Resolve authoritative referral context
    const visitorKey = (req.headers['x-visitor-key'] as string) || (req.body?.visitorKey as string) || null;
    const explicitReferralCode =
      (req.body?.referralCode as string) ||
      (req.body?.ref as string) ||
      (req.query?.ref as string) ||
      null;

    const referralContext = await ReferralService.resolveReferralContextForOrder({
      userId: req.user?.id || null,
      visitorKey,
      explicitCode: explicitReferralCode,
    });

    const isMarketplace =
      serviceType === 'marketplace' ||
      (typeof productId === 'string' && productId.startsWith('mp_'));

    // ==========================================
    // M. MARKETPLACE COMMERCE FLOW
    // ==========================================
    if (isMarketplace) {
      let productRecord = await MarketplaceStore.getProductById(productId);
      if (!productRecord) {
        productRecord = await MarketplaceStore.getProductBySlug(productId);
      }

      if (!productRecord) {
        res.status(404).json({ error: 'Selected marketplace product was not found.' });
        return;
      }

      if (!productRecord.published) {
        res.status(400).json({ error: 'This product is no longer available for direct purchase.' });
        return;
      }

      if (productRecord.archived) {
        res.status(400).json({ error: 'This product is archived and cannot be purchased.' });
        return;
      }

      if (productRecord.price_type === 'quote') {
        res.status(400).json({ error: 'This item requires a custom quote. Please click Inquire.' });
        return;
      }

      if (productRecord.purchase_enabled === false) {
        res.status(400).json({ error: 'This item is no longer available for direct purchase. You can still inquire with Mystery Hub.' });
        return;
      }

      let authorPriceMinor = productRecord.price_minor;
      let selectedVariantSnapshot: string | null = null;
      let selectedVariantId: string | null = null;

      const variants = parseJsonVariants(productRecord.variants);
      if (req.body?.variantId && typeof req.body.variantId === 'string') {
        const matchingVar = variants.find((v) => v.id === req.body.variantId && v.active !== false);
        if (!matchingVar) {
          res.status(400).json({ error: 'Selected product variant is invalid or inactive.' });
          return;
        }
        authorPriceMinor = matchingVar.priceMinor;
        selectedVariantSnapshot = matchingVar.name;
        selectedVariantId = matchingVar.id;
      } else if (variants.length > 0) {
        const activeVariants = variants.filter((v) => v.active !== false);
        if (activeVariants.length > 0 && !req.body?.variantId) {
          res.status(400).json({ error: 'Please select a valid product variant configuration before payment.' });
          return;
        }
      }

      if (authorPriceMinor === null || authorPriceMinor <= 0) {
        res.status(400).json({ error: 'This item does not have a fixed direct purchase price. Please click Inquire.' });
        return;
      }

      const reqFulfilmentMethod = req.body?.fulfilmentMethod;
      if (reqFulfilmentMethod !== 'pickup' && reqFulfilmentMethod !== 'delivery') {
        res.status(400).json({ error: 'Please choose a valid fulfilment method (pickup or delivery).' });
        return;
      }

      const productMode = productRecord.fulfilment_mode || 'both';
      if (productMode === 'inquiry_only') {
        res.status(400).json({ error: 'This product is available for inquiry only.' });
        return;
      }
      if (reqFulfilmentMethod === 'pickup' && productMode === 'delivery') {
        res.status(400).json({ error: 'Pickup is not available for this product.' });
        return;
      }
      if (reqFulfilmentMethod === 'delivery' && (productMode === 'pickup' || productRecord.delivery_available === false)) {
        res.status(400).json({ error: 'Delivery is not available for this product.' });
        return;
      }

      let selectedPickupSnapshot: string | null = null;
      let selectedPickupId: string | null = null;

      if (reqFulfilmentMethod === 'pickup') {
        const pickupLocs = parseJsonPickupLocations(productRecord.pickup_locations);
        const reqLocId = req.body?.pickupLocationId;
        const targetLoc = pickupLocs.find((loc) => loc.id === reqLocId && loc.active !== false);
        if (!targetLoc) {
          res.status(400).json({ error: 'Please select an active, valid pickup location.' });
          return;
        }
        selectedPickupId = targetLoc.id;
        selectedPickupSnapshot = `${targetLoc.name} (${targetLoc.area}, ${targetLoc.city}${targetLoc.addressOrLandmark ? ` · ${targetLoc.addressOrLandmark}` : ''})`;
      }

      let deliveryCity: string | null = null;
      let deliveryArea: string | null = null;
      let deliveryLandmark: string | null = null;
      let deliveryNote: string | null = null;

      if (reqFulfilmentMethod === 'delivery') {
        deliveryCity = typeof req.body?.deliveryCity === 'string' ? req.body.deliveryCity.trim() : null;
        deliveryArea = typeof req.body?.deliveryArea === 'string' ? req.body.deliveryArea.trim() : null;
        deliveryLandmark = typeof req.body?.deliveryLandmark === 'string' ? req.body.deliveryLandmark.trim() : null;
        deliveryNote = typeof req.body?.deliveryNote === 'string' ? req.body.deliveryNote.trim() : null;

        if (!deliveryCity || !deliveryArea) {
          res.status(400).json({ error: 'Please provide your delivery city and area.' });
          return;
        }
      }

      const timestamp = Date.now();
      const randomHex = Math.floor(100000 + Math.random() * 900000);
      const publicRef = `MH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomHex}`;
      const paymentRef = `MH_PAY_MKT_${timestamp}_${randomHex}`;
      const nowIso = new Date().toISOString();

      const newOrder: OrderRecord = {
        id: `ord_${timestamp}_${randomHex}`,
        user_id: req.user?.id || null,
        public_reference: publicRef,
        customer_name: typeof customerName === 'string' && customerName.trim() ? customerName.trim() : (req.user?.name || 'Customer'),
        customer_email: validEmail,
        customer_phone: phoneVal.normalized,
        recipient_phone: phoneVal.normalized,
        network: 'mtn',
        service_type: 'marketplace',
        product_id: productRecord.id,
        product_slug: productRecord.slug,
        product_name_snapshot: productRecord.name,
        bundle_size_snapshot: selectedVariantSnapshot || productRecord.availability_label || 'Direct Purchase',
        variant_id: selectedVariantId,
        variant_snapshot: selectedVariantSnapshot,
        amount: authorPriceMinor,
        currency: 'GHS',
        status: 'pending_payment',
        payment_provider: 'paystack',
        payment_reference: paymentRef,
        payment_status: 'pending',
        supplier_provider: 'manual_supplier',
        supplier_order_id: null,
        supplier_response: null,
        supplier_cost_minor: null,
        supplier_offer_ref: null,
        supplier_last_checked_at: null,
        failure_reason: null,
        fulfilment_method: reqFulfilmentMethod,
        pickup_location_id: selectedPickupId,
        pickup_location_snapshot: selectedPickupSnapshot,
        delivery_city: deliveryCity,
        delivery_area: deliveryArea,
        delivery_landmark: deliveryLandmark,
        delivery_note: deliveryNote,
        marketplace_status: 'pending_payment',
        created_at: nowIso,
        updated_at: nowIso,
        paid_at: null,
        submitted_at: null,
        delivered_at: null,
        referrer_user_id: referralContext.referrerUserId,
        referral_attribution_id: referralContext.attributionId,
        referral_code: referralContext.referralCode,
      };

      await OrdersStore.createOrder(newOrder);

      const paystackRes = await PaystackServerService.initializeTransaction({
        email: validEmail,
        amountPesewas: authorPriceMinor,
        reference: paymentRef,
        metadata: {
          public_reference: publicRef,
          recipient_phone: phoneVal.normalized,
          service_type: 'marketplace',
          product_id: productRecord.id,
          product_slug: productRecord.slug,
          product_name: productRecord.name,
          fulfilment_method: reqFulfilmentMethod,
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
        amountGhc: Number((authorPriceMinor / 100).toFixed(2)),
        amountPesewas: authorPriceMinor,
        currency: 'GHS',
        isSimulated: paystackRes.isSimulated || false,
      });
      return;
    }

    const isAirtime =
      serviceType === 'airtime' ||
      productId.startsWith('airtime-') ||
      productId === 'airtime';

    const isInstantBundle =
      serviceType === 'instant_bundle' ||
      productId.startsWith('instant-');

    // ==========================================
    // A. INSTANT BUNDLE FLOW
    // ==========================================
    if (isInstantBundle) {
      const provider = FulfilmentService.getProvider();

      // 1. Check service availability
      const serviceCheck = await provider.client.checkInstantBundlesService();
      if (!serviceCheck.permitted || !serviceCheck.available) {
        res.status(400).json({
          error: serviceCheck.reason || 'Instant Bundles are temporarily unavailable. Please select a standard Data Bundle.',
        });
        return;
      }

      // 2. Resolve package from live catalogue
      const catalogRes = await provider.client.getInstantBundles();
      let rawList: SbhInstantBundlePackage[] = [];
      if (Array.isArray(catalogRes.data)) {
        rawList = catalogRes.data;
      } else if (catalogRes.data && Array.isArray((catalogRes.data as { packages?: SbhInstantBundlePackage[] }).packages)) {
        rawList = (catalogRes.data as { packages?: SbhInstantBundlePackage[] }).packages!;
      } else if (catalogRes.data && Array.isArray((catalogRes.data as { products?: SbhInstantBundlePackage[] }).products)) {
        rawList = (catalogRes.data as { products?: SbhInstantBundlePackage[] }).products!;
      }

      const targetPkgId = productId.startsWith('instant-') ? productId.replace('instant-', '') : productId;
      const pkg = rawList.find((p) => p.id === targetPkgId || p.id === productId || `instant-${p.id}` === productId);

      if (!pkg || pkg.enabled === false) {
        res.status(404).json({ error: 'Selected Instant Bundle package is no longer available.' });
        return;
      }

      const isFlexi = Boolean(pkg.isFlexi || pkg.mode === 'flexi');
      let pricing;
      let requestedMajorVal: number | string | undefined;

      if (isFlexi) {
        const reqVal = typeof reqAmount === 'number' ? reqAmount : parseFloat(String(reqAmount || '0'));
        const minVal = typeof pkg.minAmountMajor === 'number' ? pkg.minAmountMajor : parseFloat(String(pkg.minAmountMajor || '1')) || 1;
        const maxVal = typeof pkg.maxAmountMajor === 'number' ? pkg.maxAmountMajor : parseFloat(String(pkg.maxAmountMajor || '500')) || 500;
        const ratio = typeof pkg.payableRatio === 'number' ? pkg.payableRatio : 1.0;

        try {
          pricing = calculateFlexiInstantBundlePrice(pkg.id, reqVal, ratio, minVal, maxVal);
          requestedMajorVal = reqVal;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Invalid flexi package amount.';
          res.status(400).json({ error: msg });
          return;
        }
      } else {
        try {
          pricing = calculateFixedInstantBundlePrice(pkg.id, pkg.priceMinor);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unable to calculate retail price for this package.';
          res.status(400).json({ error: msg });
          return;
        }
      }

      const rawNet = (pkg.network || reqNetwork || 'mtn').toLowerCase().trim();
      let network: 'mtn' | 'telecel' | 'airteltigo' = 'mtn';
      if (rawNet.includes('telecel') || rawNet === 't') network = 'telecel';
      else if (rawNet.includes('airtel') || rawNet.includes('tigo') || rawNet === 'at') network = 'airteltigo';

      // 3. Fast MTN duplicate check
      if (network === 'mtn') {
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

      // 4. Wallet check feasibility (if fulfillment enabled)
      if (provider.client.isFulfillmentEnabled() && provider.client.isConfigured()) {
        try {
          const wallet = await provider.getBalance();
          if (wallet.balancePesewas < pricing.supplierCostPesewas) {
            console.error(`[Instant Bundle Preflight] Insufficient wallet: Available ${wallet.balancePesewas}p < required ${pricing.supplierCostPesewas}p`);
            res.status(400).json({
              error: 'Instant Bundles are temporarily unavailable due to supplier limits. Please try standard Data Bundles.',
            });
            return;
          }
        } catch (walletErr) {
          console.warn('[Instant Bundle Preflight] Wallet check failed:', walletErr);
        }
      }

      // 5. Generate references
      const timestamp = Date.now();
      const randomHex = Math.floor(100000 + Math.random() * 900000);
      const publicRef = `MH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomHex}`;
      const paymentRef = `MH_PAY_INSTANT_${network.toUpperCase()}_${timestamp}_${randomHex}`;
      const nowIso = new Date().toISOString();

      // 6. Create pending order in DB
      const newOrder: OrderRecord = {
        id: `ord_${timestamp}_${randomHex}`,
        user_id: req.user?.id || null,
        public_reference: publicRef,
        customer_name: typeof customerName === 'string' ? customerName.trim() : (req.user?.name || null),
        customer_email: validEmail,
        customer_phone: phoneVal.normalized,
        recipient_phone: phoneVal.normalized,
        network,
        service_type: 'instant_bundle',
        product_id: `instant-${pkg.id}`,
        product_name_snapshot: pkg.name || `${pkg.dataAmount || 'Instant'} Data`,
        bundle_size_snapshot: isFlexi ? `GH₵${requestedMajorVal} Flexi` : (pkg.dataAmount || pkg.name || 'Instant Data'),
        amount: pricing.customerTotalPesewas,
        face_value_minor: pricing.productRetailPricePesewas,
        service_fee_minor: pricing.paymentProcessingFeePesewas,
        currency: 'GHS',
        status: 'pending_payment',
        payment_provider: 'paystack',
        payment_reference: paymentRef,
        payment_status: 'pending',
        supplier_provider: 'success_biz_hub',
        supplier_order_id: null,
        supplier_response: null,
        supplier_cost_minor: pricing.supplierCostPesewas,
        supplier_offer_ref: pkg.id,
        supplier_last_checked_at: null,
        failure_reason: null,
        created_at: nowIso,
        updated_at: nowIso,
        paid_at: null,
        submitted_at: null,
        delivered_at: null,
        referrer_user_id: referralContext.referrerUserId,
        referral_attribution_id: referralContext.attributionId,
        referral_code: referralContext.referralCode,
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

      // 7. Initialize Paystack
      const paystackRes = await PaystackServerService.initializeTransaction({
        email: validEmail,
        amountPesewas: pricing.customerTotalPesewas,
        reference: paymentRef,
        metadata: {
          public_reference: publicRef,
          recipient_phone: phoneVal.normalized,
          network,
          service_type: 'instant_bundle',
          package_id: pkg.id,
          product_name: newOrder.product_name_snapshot,
          amount_major: requestedMajorVal,
          product_retail_minor: pricing.productRetailPricePesewas,
          processing_fee_minor: pricing.paymentProcessingFeePesewas,
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
        amountGhc: pricing.customerTotalGhc,
        faceValueGhc: pricing.productRetailPriceGhc,
        serviceFeeGhc: pricing.paymentProcessingFeeGhc,
        amountPesewas: pricing.customerTotalPesewas,
        currency: 'GHS',
        isSimulated: paystackRes.isSimulated || false,
      });
      return;
    }

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

      // 2b. Fast MTN duplicate check before preflight
      if (airtimeNet.toLowerCase() === 'mtn') {
        const dupStart = performance.now();
        const activeMtnOrder = await OrdersStore.findActiveMtnOrder(phoneVal.normalized);
        const dupMs = Math.round(performance.now() - dupStart);
        console.info(`[Checkout Timing] duplicateCheck=${dupMs}ms`);

        if (activeMtnOrder) {
          console.info(`[Checkout Timing] total=${Math.round(performance.now() - reqStart)}ms`);
          res.status(409).json({
            code: ACTIVE_MTN_ORDER_CODE,
            message: ACTIVE_MTN_ORDER_MESSAGE,
            existingOrderReference: activeMtnOrder.public_reference,
            existingOrderStatus: mapToSafeCustomerStatus(activeMtnOrder.status),
          });
          return;
        }
      }

      // 3. Server-authoritative fee and total calculation (2% service fee)
      const calculation = calculateAirtimeOrder(airtimeFaceValue);

      // 4. Supplier Preflight Check for Airtime
      const preflight = await FulfilmentService.preflightCheckAirtime(
        airtimeNet,
        calculation.faceValuePesewas,
        phoneVal.normalized
      );
      if (preflight.timings) {
        console.info(`[Checkout Timing] preflight.services=${preflight.timings.servicesMs}ms`);
        console.info(`[Checkout Timing] preflight.wallet=${preflight.timings.walletMs}ms`);
      }
      if (!preflight.allowed) {
        console.info(`[Checkout Timing] total=${Math.round(performance.now() - reqStart)}ms`);
        const safeCode = preflight.code || 'SERVICE_TEMPORARILY_UNAVAILABLE';
        const safeMessage =
          preflight.customerMessage ||
          'Airtime Top-Up is temporarily unavailable. Please try again shortly.';
        res.status(400).json({
          code: safeCode,
          message: safeMessage,
          error: safeMessage,
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
        user_id: req.user?.id || null,
        public_reference: publicRef,
        customer_name: typeof customerName === 'string' ? customerName.trim() : (req.user?.name || null),
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
        referrer_user_id: referralContext.referrerUserId,
        referral_attribution_id: referralContext.attributionId,
        referral_code: referralContext.referralCode,
      };

      const dbStart = performance.now();
      const createResult = await OrdersStore.createOrderWithMtnDuplicateCheck(newOrder);
      const dbMs = Math.round(performance.now() - dbStart);
      console.info(`[Checkout Timing] databaseInsert=${dbMs}ms`);

      if (!createResult.success) {
        console.info(`[Checkout Timing] total=${Math.round(performance.now() - reqStart)}ms`);
        res.status(409).json({
          code: ACTIVE_MTN_ORDER_CODE,
          message: ACTIVE_MTN_ORDER_MESSAGE,
          existingOrderReference: createResult.existingOrder.public_reference,
          existingOrderStatus: mapToSafeCustomerStatus(createResult.existingOrder.status),
        });
        return;
      }

      // 7. Initialize Paystack transaction with authoritative total
      const paystackStart = performance.now();
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
      const paystackMs = Math.round(performance.now() - paystackStart);
      console.info(`[Checkout Timing] paystackInit=${paystackMs}ms`);

      const totalMs = Math.round(performance.now() - reqStart);
      console.info(`[Checkout Timing] total=${totalMs}ms`);

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
      const dupStart = performance.now();
      const activeMtnOrder = await OrdersStore.findActiveMtnOrder(phoneVal.normalized);
      const dupMs = Math.round(performance.now() - dupStart);
      console.info(`[Checkout Timing] duplicateCheck=${dupMs}ms`);

      if (activeMtnOrder) {
        console.info(`[Checkout Timing] total=${Math.round(performance.now() - reqStart)}ms`);
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

    if (preflight.timings) {
      console.info(`[Checkout Timing] preflight.services=${preflight.timings.servicesMs}ms`);
      console.info(`[Checkout Timing] preflight.catalog=${preflight.timings.catalogMs}ms`);
      console.info(`[Checkout Timing] preflight.beneficiary=${preflight.timings.beneficiaryMs}ms`);
      console.info(`[Checkout Timing] preflight.wallet=${preflight.timings.walletMs}ms`);
    }

    if (!preflight.allowed) {
      console.info(`[Checkout Timing] total=${Math.round(performance.now() - reqStart)}ms`);
      const safeCode = preflight.code || 'SERVICE_TEMPORARILY_UNAVAILABLE';
      const safeMessage =
        preflight.customerMessage ||
        'This bundle is temporarily unavailable. Please try another package or try again shortly.';
      res.status(400).json({
        code: safeCode,
        message: safeMessage,
        error: safeMessage,
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
      user_id: req.user?.id || null,
      public_reference: publicRef,
      customer_name: typeof customerName === 'string' ? customerName.trim() : (req.user?.name || null),
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
      referrer_user_id: referralContext.referrerUserId,
      referral_attribution_id: referralContext.attributionId,
      referral_code: referralContext.referralCode,
    };

    const dbStart = performance.now();
    const createResult = await OrdersStore.createOrderWithMtnDuplicateCheck(newOrder);
    const dbMs = Math.round(performance.now() - dbStart);
    console.info(`[Checkout Timing] databaseInsert=${dbMs}ms`);

    if (!createResult.success) {
      console.info(`[Checkout Timing] total=${Math.round(performance.now() - reqStart)}ms`);
      res.status(409).json({
        code: ACTIVE_MTN_ORDER_CODE,
        message: ACTIVE_MTN_ORDER_MESSAGE,
        existingOrderReference: createResult.existingOrder.public_reference,
        existingOrderStatus: mapToSafeCustomerStatus(createResult.existingOrder.status),
      });
      return;
    }

    // 7. Initialize Paystack transaction on the server
    const paystackStart = performance.now();
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
    const paystackMs = Math.round(performance.now() - paystackStart);
    console.info(`[Checkout Timing] paystackInit=${paystackMs}ms`);

    const totalMs = Math.round(performance.now() - reqStart);
    console.info(`[Checkout Timing] total=${totalMs}ms`);

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
      const validationError = validateOrderPayment(order, verifyResult);
      if (validationError) {
        console.warn(`[Payment Verify] Rejected payment for ${order.public_reference}: ${validationError}`);
        res.status(400).json({ error: 'Payment verification did not match the saved order.' });
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
 * 2b. POST /api/payments/cancel
 * Handles customer-initiated transaction cancellations (e.g., closing checkout popup).
 * Transitions pending order to 'cancelled' status cleanly and records reason.
 */
apiRouter.post('/payments/cancel', async (req: Request, res: Response) => {
  try {
    const { orderRef } = req.body || {};
    if (!orderRef) {
      res.status(400).json({ error: 'Order reference is required.' });
      return;
    }

    const result = await OrdersStore.cancelOrder(orderRef, 'customer_closed_checkout');
    if (!result.order) {
      res.status(404).json({ error: 'Order reference not found.' });
      return;
    }

    res.json({
      success: true,
      cancelled: result.cancelled,
      alreadyPaid: result.alreadyPaid,
      order: toSafePublicOrder(result.order),
    });
  } catch (err) {
    console.error('Payment Cancel Exception:', err);
    res.status(500).json({ error: 'Failed to cancel payment.' });
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
          const validationError = validateOrderPayment(order, {
            isVerified: data.status === 'success', status: data.status,
            reference: paymentRef, currency, amountPesewas,
          });
          if (!validationError) {
            await FulfilmentService.processPaidOrder(
              paymentRef,
              data.paid_at || new Date().toISOString(),
              'Paystack charge.success webhook'
            );
          } else {
            console.warn(`[Paystack Webhook] Rejected payment for ${order.public_reference}: ${validationError}`);
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

// ==========================================
// AUTHENTICATION & USER MANAGEMENT ENDPOINTS
// ==========================================

/**
 * 6. POST /api/auth/register
 * Real server-side account registration with scrypt password hashing & session generation
 */
apiRouter.post('/auth/register', signupRateLimiter, async (req: Request, res: Response) => {
  try {
    const { name, identifier, password, rememberMe } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'Please enter a valid full name or business name (at least 2 characters).' });
      return;
    }

    if (name.trim().length > 128) {
      res.status(400).json({ error: 'Name must not exceed 128 characters.' });
      return;
    }

    const parsedId = parseIdentifier(identifier);
    if (!parsedId) {
      res.status(400).json({
        error: 'Please enter a valid Ghana phone number (e.g. 0241234567) or email address.',
      });
      return;
    }

    const passValidation = validatePassword(password);
    if (!passValidation.isValid) {
      res.status(400).json({ error: passValidation.error || 'Password must be at least 8 characters.' });
      return;
    }

    // Check if account with this identifier already exists
    const existing = await AuthStore.findUserByIdentifier(parsedId.normalized);
    if (existing) {
      res.status(409).json({
        error: 'An account with this email or phone number already exists. Please log in.',
      });
      return;
    }

    // Hash password securely with unique random salt using crypto.scrypt
    const passwordHash = await hashPassword(password);
    const userId = `usr_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;

    const user = await AuthStore.createUser({
      id: userId,
      name: name.trim(),
      email: parsedId.type === 'email' ? parsedId.normalized : null,
      phone: parsedId.type === 'phone' ? parsedId.normalized : null,
      passwordHash,
      role: 'customer',
      status: 'active',
    });

    // Create session
    const rawToken = generateSessionToken();
    const session = await AuthStore.createSession(user.id, rawToken, Boolean(rememberMe));

    // Mystery Earn: Ensure permanent referral profile is generated
    try {
      await ReferralStore.getOrCreateProfile(user.id);
    } catch (refErr) {
      console.warn('[Auth] Failed to initialize referral profile:', refErr);
    }

    // Mystery Earn: Bind first-touch referral attribution if supplied
    const refCode = (req.body?.referralCode || req.body?.ref || req.query?.ref) as string | undefined;
    const visitorKey = (req.body?.visitorKey || req.headers['x-visitor-key']) as string | undefined;
    if (refCode) {
      try {
        await ReferralService.captureVisitorReferral({
          code: refCode,
          visitorKey: visitorKey || null,
          landingPath: req.body?.landingPath || null,
          userAgent: (req.headers['user-agent'] as string) || null,
          currentUserId: user.id,
        });
      } catch (bindErr) {
        console.warn('[Auth] Failed to bind referral code on signup:', bindErr);
      }
    } else if (visitorKey) {
      try {
        const guestAttr = await ReferralStore.findAttributionByVisitorKey(visitorKey);
        if (guestAttr && guestAttr.referrer_user_id !== user.id) {
          await ReferralStore.bindAttributionToUser({
            referredUserId: user.id,
            referrerUserId: guestAttr.referrer_user_id,
            sourceCode: guestAttr.source_code,
            visitorKey,
          });
        }
      } catch (bindErr) {
        console.warn('[Auth] Failed to bind visitor key referral on signup:', bindErr);
      }
    }

    res.status(201).json({
      success: true,
      user: toSafeUserProfile(user),
      token: rawToken,
      expiresAt: session.expires_at,
    });
  } catch (err) {
    console.error('Registration Controller Exception:', err);
    res.status(500).json({ error: 'An unexpected server error occurred creating your account.' });
  }
});

/**
 * 7. POST /api/auth/login
 * Real server-side authentication verifying scrypt password hash & returning session token
 */
apiRouter.post('/auth/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { identifier, password, rememberMe } = req.body || {};

    if (!identifier || typeof identifier !== 'string' || !password || typeof password !== 'string') {
      res.status(400).json({ error: 'Please provide both your phone/email and password.' });
      return;
    }

    const cleanIdentifier = identifier.trim();
    const user = await AuthStore.findUserByIdentifier(cleanIdentifier);

    if (!user) {
      res.status(401).json({
        error: 'Invalid credentials. Please check your phone/email and password.',
      });
      return;
    }

    if (user.status === 'disabled') {
      res.status(403).json({
        error: 'Your account has been disabled. Please contact support.',
      });
      return;
    }

    // Constant-time scrypt password verification
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({
        error: 'Invalid credentials. Please check your phone/email and password.',
      });
      return;
    }

    // Update last login timestamp
    await AuthStore.updateUserLastLogin(user.id);

    // Create fresh session
    const rawToken = generateSessionToken();
    const session = await AuthStore.createSession(user.id, rawToken, Boolean(rememberMe));

    res.json({
      success: true,
      user: toSafeUserProfile(user),
      token: rawToken,
      expiresAt: session.expires_at,
    });
  } catch (err) {
    console.error('Login Controller Exception:', err);
    res.status(500).json({ error: 'An unexpected server error occurred during login.' });
  }
});

/**
 * 8. GET /api/auth/me
 * Returns authenticated user profile using Bearer session token
 */
apiRouter.get('/auth/me', requireAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    user: toSafeUserProfile(req.user!),
  });
});

/**
 * 9. POST /api/auth/logout
 * Securely revokes active session token
 */
apiRouter.post('/auth/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const rawToken = authHeader.substring(7).trim();
      if (rawToken) {
        await AuthStore.revokeSession(rawToken);
      }
    }
    res.json({ success: true, message: 'Successfully logged out.' });
  } catch (err) {
    console.error('Logout Controller Exception:', err);
    res.status(500).json({ error: 'Failed to process logout.' });
  }
});

// ==========================================
// WAITLIST & EARLY ACCESS ENDPOINTS
// ==========================================

/**
 * 10. POST /api/waitlist/join
 * Persists waitlist submission in PostgreSQL with intelligent deduplication
 */
apiRouter.post('/waitlist/join', waitlistRateLimiter, optionalAuth, async (req: Request, res: Response) => {
  try {
    const { serviceKey, serviceTitle, channel, contact, sourcePage } = req.body || {};

    if (!serviceKey || typeof serviceKey !== 'string') {
      res.status(400).json({ error: 'Missing service key.' });
      return;
    }

    if (!serviceTitle || typeof serviceTitle !== 'string') {
      res.status(400).json({ error: 'Missing service title.' });
      return;
    }

    if (!channel || !['whatsapp', 'sms', 'email'].includes(channel)) {
      res.status(400).json({ error: 'Please choose a valid alert channel (WhatsApp, SMS, or Email).' });
      return;
    }

    if (!contact || typeof contact !== 'string' || !contact.trim()) {
      res.status(400).json({ error: 'Please enter your contact information.' });
      return;
    }

    const normalized = WaitlistStore.normalizeContact(channel as WaitlistChannel, contact);
    if (!normalized) {
      if (channel === 'email') {
        res.status(400).json({ error: 'Please provide a valid email address.' });
      } else {
        res.status(400).json({ error: 'Please provide a valid Ghana phone number.' });
      }
      return;
    }

    const result = await WaitlistStore.addToWaitlist({
      serviceKey,
      serviceTitle,
      channel: channel as WaitlistChannel,
      contact,
      sourcePage: typeof sourcePage === 'string' ? sourcePage : null,
      userId: req.user?.id || null,
    });

    res.json({
      success: true,
      alreadyJoined: result.alreadyJoined,
      message: result.alreadyJoined
        ? "You're already on the VIP launch list for this service!"
        : `Successfully registered for ${serviceTitle} launch updates!`,
      record: {
        id: result.record.id,
        serviceKey: result.record.service_key,
        serviceTitle: result.record.service_title,
        channel: result.record.channel,
        status: result.record.status,
        createdAt: result.record.created_at,
      },
    });
  } catch (err: unknown) {
    console.error('Waitlist Controller Exception:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to join waitlist. Please try again.',
    });
  }
});

/**
 * 11. GET /api/waitlist/my-entries
 * Returns waitlist entries for the authenticated user
 */
apiRouter.get('/waitlist/my-entries', requireAuth, async (req: Request, res: Response) => {
  try {
    const entries = await WaitlistStore.findUserWaitlists(req.user!.id);
    res.json({
      success: true,
      entries,
    });
  } catch (err) {
    console.error('My Waitlist Controller Exception:', err);
    res.status(500).json({ error: 'Failed to retrieve waitlist registrations.' });
  }
});

// ==========================================
// CUSTOMER AUTHENTICATED ORDERS ENDPOINT
// ==========================================

/**
 * 12. GET /api/orders/my-orders
 * Returns all orders linked to the logged-in customer (by user_id, phone, or email)
 */
apiRouter.get('/orders/my-orders', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const rawLimit = req.query.limit;
    let limit = 20;
    if (typeof rawLimit === 'string') {
      const parsed = parseInt(rawLimit, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 50);
      }
    }
    const orders = await OrdersStore.findOrdersByUserId(user.id, limit);
    const safeOrders = orders.map(toSafePublicOrder);

    res.json({
      success: true,
      orders: safeOrders,
    });
  } catch (err) {
    console.error('My Orders Controller Exception:', err);
    res.status(500).json({ error: 'Failed to retrieve orders.' });
  }
});

/**
 * 12b. GET /api/account/orders
 * Dedicated customer account orders endpoint.
 * Protected with requireAuth middleware. Supports ?limit= parameter (default 20, max 50).
 */
apiRouter.get('/account/orders', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const rawLimit = req.query.limit;
    let limit = 20;
    if (typeof rawLimit === 'string') {
      const parsed = parseInt(rawLimit, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 50);
      }
    }

    const orders = await OrdersStore.findOrdersByUserId(userId, limit);
    const safeOrders = orders.map(toSafePublicOrder);

    res.json({
      success: true,
      orders: safeOrders,
    });
  } catch (err) {
    console.error('Account Orders API Exception:', err);
    res.status(500).json({ error: 'Failed to retrieve account orders.' });
  }
});

// ==========================================
// PUBLIC MARKETPLACE SOURCING CATALOG ROUTES
// ==========================================

/**
 * 13. GET /api/marketplace/products
 * Returns live published marketplace products (only published = true, archived = false)
 * Wholesale costs, internal audit IDs, and admin fields are NEVER exposed.
 */
apiRouter.get('/marketplace/products', async (req: Request, res: Response) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const featured =
      req.query.featured === 'true'
        ? true
        : req.query.featured === 'false'
        ? false
        : undefined;

    const products = await MarketplaceStore.getPublicProducts({ category, search, featured });

    res.json({
      success: true,
      products,
    });
  } catch (err) {
    console.error('Public Marketplace Products API error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve marketplace products.',
      products: [],
    });
  }
});

/**
 * 14. GET /api/marketplace/products/:slug
 * Returns single published marketplace product by unique slug
 */
apiRouter.get('/marketplace/products/:slug', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    if (!slug) {
      res.status(400).json({ error: 'Product slug is required.' });
      return;
    }

    const product = await MarketplaceStore.getPublicProductBySlug(slug);
    if (!product) {
      res.status(404).json({ error: 'Marketplace product not found or not published.' });
      return;
    }

    res.json({
      success: true,
      product,
    });
  } catch (err) {
    console.error('Public Marketplace Product Slug API error:', err);
    res.status(500).json({ error: 'Failed to retrieve marketplace product.' });
  }
});

// ==========================================
// MYSTERY EARN: REFERRAL & REWARD ENDPOINTS
// ==========================================

/**
 * 15. POST /api/referrals/capture
 * Captures visitor referral clicks, records non-invasive click analytics,
 * and binds lifetime attribution to active user or guest session.
 */
apiRouter.post('/referrals/capture', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { code, visitorKey, landingPath } = req.body || {};
    if (!code || typeof code !== 'string') {
      res.status(400).json({ valid: false, error: 'Referral code parameter is required.' });
      return;
    }

    const result = await ReferralService.captureVisitorReferral({
      code,
      visitorKey: visitorKey || (req.headers['x-visitor-key'] as string) || null,
      landingPath: landingPath || null,
      userAgent: (req.headers['user-agent'] as string) || null,
      currentUserId: req.user?.id || null,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('Referral Capture API Exception:', err);
    res.status(500).json({ valid: false, error: 'Failed to record referral click.' });
  }
});

/**
 * 16. GET /api/referrals/summary (or /api/referrals/me)
 * Returns authenticated user's lifetime referral statistics, share link, and rewards.
 */
apiRouter.get(['/referrals/summary', '/referrals/me'], requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const summary = await ReferralStore.getReferralSummary(userId);

    res.json({
      success: true,
      summary,
    });
  } catch (err) {
    console.error('Referral Summary API Exception:', err);
    res.status(500).json({ error: 'Failed to load referral summary.' });
  }
});

/**
 * 17. GET /api/referrals/ledger
 * Returns authenticated user's immutable reward ledger entries (pesewas & formatted GHS).
 */
apiRouter.get('/referrals/ledger', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;
    const ledger = await ReferralStore.getLedgerForUser(userId, isNaN(limit) ? 50 : limit);

    res.json({
      success: true,
      ledger,
    });
  } catch (err) {
    console.error('Referral Ledger API Exception:', err);
    res.status(500).json({ error: 'Failed to load referral reward ledger.' });
  }
});

/**
 * 18. GET /api/referrals/rules
 * Returns active reward rules for public disclosure & transparency.
 */
apiRouter.get('/referrals/rules', async (_req: Request, res: Response) => {
  try {
    const rules = await ReferralStore.getAllRules();
    const activeRules = rules.filter((r) => r.enabled);

    res.json({
      success: true,
      rules: activeRules,
    });
  } catch (err) {
    console.error('Referral Rules API Exception:', err);
    res.status(500).json({ error: 'Failed to retrieve referral rules.' });
  }
});

/**
 * 19. POST /api/marketplace/inquiries
 * Records customer product sourcing & availability inquiries.
 */
apiRouter.post('/marketplace/inquiries', async (req: Request, res: Response) => {
  try {
    const { productId, productName, customerName, customerPhone, customerEmail, inquiryType, message, budget } = req.body || {};

    if (!productName || typeof productName !== 'string' || !productName.trim()) {
      res.status(400).json({ error: 'Product name is required for inquiries.' });
      return;
    }

    const created = await MarketplaceStore.createInquiry({
      productId: typeof productId === 'string' ? productId.trim() : undefined,
      productName: productName.trim(),
      customerName: typeof customerName === 'string' ? customerName.trim() : undefined,
      customerPhone: typeof customerPhone === 'string' ? customerPhone.trim() : undefined,
      customerEmail: typeof customerEmail === 'string' ? customerEmail.trim() : undefined,
      inquiryType: typeof inquiryType === 'string' ? inquiryType.trim() : 'general',
      message: typeof message === 'string' ? message.trim() : undefined,
      budget: typeof budget === 'string' ? budget.trim() : undefined,
    });

    res.json({
      success: true,
      inquiryId: created.id,
      message: 'Product inquiry recorded successfully.',
    });
  } catch (err) {
    console.error('Marketplace Inquiry API Exception:', err);
    res.status(500).json({ error: 'Failed to record product inquiry.' });
  }
});

