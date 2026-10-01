/**
 * Server-Authoritative Instant Bundle Pricing & Commercial Model
 * Controls the single source of truth for Instant Bundle pricing, undercutting, and payment processing fees.
 * 
 * Rules:
 * 1. Strict integer pesewa arithmetic — zero floating-point currency representation internally.
 * 2. Competitive product pricing — allows displayed product price to slightly undercut verified network price.
 * 3. Transparent separate payment processing fee — covers gateway cost + optional processing margin.
 * 4. Profitability guarantee — never undercuts below supplier cost + minimum product margin.
 * 5. Wholesale supplier costs and accounting internals are NEVER exposed to browser.
 */

import { SbhInstantBundlePackage } from '../suppliers/successBizHub/types.js';
import { parseMinorAmount } from '../suppliers/successBizHub/money.js';

// Configuration defaults with environment overrides
export const INSTANT_BUNDLE_CONFIG = {
  gatewayFeeRate: (() => {
    const raw = process.env.INSTANT_BUNDLE_GATEWAY_FEE_RATE;
    if (raw) {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed) && parsed >= 0 && parsed < 0.2) return parsed;
    }
    return 0.02; // Default 2% Paystack gateway fee
  })(),

  minProductMarginPesewas: (() => {
    const raw = process.env.INSTANT_BUNDLE_MIN_PRODUCT_MARGIN_PESEWAS || process.env.INSTANT_BUNDLE_MIN_MARGIN_PESEWAS;
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
    return 5; // Default 5 pesewas (GH₵0.05) minimum product margin to keep small bundles competitive
  })(),

  processingMarginPesewas: (() => {
    const raw = process.env.INSTANT_BUNDLE_PROCESSING_MARGIN_PESEWAS;
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
    return 10; // Default 10 pesewas (GH₵0.10) Mystery Hub processing margin
  })(),

  processingMarginPercent: (() => {
    const raw = process.env.INSTANT_BUNDLE_PROCESSING_MARGIN_PERCENT;
    if (raw) {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed) && parsed >= 0 && parsed < 0.2) return parsed;
    }
    return 0; // Default 0%
  })(),

  undercutPesewas: (() => {
    const raw = process.env.INSTANT_BUNDLE_UNDERCUT_PESEWAS;
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
    return 1; // Default 1 pesewa undercut below network reference price
  })(),

  maxFinalPremiumPesewas: (() => {
    const raw = process.env.INSTANT_BUNDLE_MAX_FINAL_PREMIUM_PESEWAS;
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
    return 100; // Default GH₵1.00 maximum premium over network price
  })(),

  fallbackMarkupPercent: (() => {
    const raw = process.env.INSTANT_BUNDLE_MARKUP_PERCENT || process.env.INSTANT_BUNDLE_FALLBACK_MARKUP_PERCENT;
    if (raw) {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
    return 10; // Default 10% fallback markup when no reference price is configured
  })(),

  // Verified network reference prices in integer pesewas (packageId -> pesewas)
  networkReferencePrices: (() => {
    try {
      const raw = process.env.INSTANT_BUNDLE_NETWORK_REFERENCE_PRICES;
      if (raw) {
        return JSON.parse(raw) as Record<string, number>;
      }
    } catch {
      // ignore
    }
    return {} as Record<string, number>;
  })(),

  // Optional package-specific retail price overrides (in pesewas)
  packageOverrides: (() => {
    try {
      const raw = process.env.INSTANT_BUNDLE_RETAIL_OVERRIDES;
      if (raw) {
        return JSON.parse(raw) as Record<string, number>;
      }
    } catch {
      // ignore
    }
    return {} as Record<string, number>;
  })(),

  // Backward compatibility alias
  minMarginPesewas: 5,
  markupPercent: 10,
};

export interface InstantBundleCommercialResult {
  supplierCostPesewas: number;
  networkReferencePricePesewas?: number;
  networkReferencePriceGhc?: number;
  undercutApplied: boolean;
  savingsOnProductGhc?: number;
  // Product price (displayed on catalogue/card)
  productRetailPricePesewas: number;
  productRetailPriceGhc: number;
  productGrossProfitPesewas: number;
  productGrossProfitGhc: number;
  // Payment processing breakdown
  paymentProcessingCostPesewas: number; // estimated gateway charge
  processingMarginPesewas: number; // Mystery Hub processing margin
  paymentProcessingFeePesewas: number; // total fee charged to customer
  paymentProcessingFeeGhc: number;
  // Final customer total (charged via Paystack)
  customerTotalPesewas: number;
  customerTotalGhc: number;
  // Total expected net profit
  expectedTotalGrossProfitPesewas: number;
  expectedTotalGrossProfitGhc: number;
  // Commercial guardrail
  isCommerciallyWeak?: boolean;
  commercialNotes?: string[];

  // Backward compatibility aliases
  retailPricePesewas: number;
  retailPriceGhc: number;
  grossMarginPesewas: number;
  gatewayFeePesewas: number;
  netPayoutPesewas: number;
}

export type InstantBundlePricingResult = InstantBundleCommercialResult;

/**
 * Calculates authoritative commercial pricing for a fixed package.
 */
export function calculateFixedInstantBundlePrice(
  packageId: string,
  rawPriceMinor: string | number | undefined
): InstantBundleCommercialResult {
  const wholesaleCost = parseMinorAmount(rawPriceMinor);
  if (wholesaleCost === null || wholesaleCost <= 0) {
    throw new Error(`Invalid or missing supplier priceMinor for instant package ${packageId}`);
  }

  const networkRefPesewas = INSTANT_BUNDLE_CONFIG.networkReferencePrices[packageId];
  let productRetailPricePesewas: number;
  let undercutApplied = false;
  const commercialNotes: string[] = [];

  // 1. Check explicit price override first
  const overridePesewas = INSTANT_BUNDLE_CONFIG.packageOverrides[packageId];
  if (typeof overridePesewas === 'number' && overridePesewas > wholesaleCost) {
    productRetailPricePesewas = overridePesewas;
    commercialNotes.push('Applied explicit package retail price override');
  }
  // 2. Check verified network reference price with competitive undercut
  else if (typeof networkRefPesewas === 'number' && networkRefPesewas > 0) {
    const targetUndercut = networkRefPesewas - INSTANT_BUNDLE_CONFIG.undercutPesewas;
    const marginAtTarget = targetUndercut - wholesaleCost;

    // Must yield positive product margin >= minProductMarginPesewas
    if (marginAtTarget >= INSTANT_BUNDLE_CONFIG.minProductMarginPesewas) {
      productRetailPricePesewas = targetUndercut;
      undercutApplied = true;
      commercialNotes.push(`Applied ${INSTANT_BUNDLE_CONFIG.undercutPesewas}p undercut below network reference price`);
    } else {
      // Unprofitable to undercut; fall back to safe profitable price
      productRetailPricePesewas = wholesaleCost + Math.max(
        INSTANT_BUNDLE_CONFIG.minProductMarginPesewas,
        Math.round((wholesaleCost * INSTANT_BUNDLE_CONFIG.fallbackMarkupPercent) / 100)
      );
      undercutApplied = false;
      commercialNotes.push('Undercut rejected as unprofitable; used safe profitable fallback');
    }
  }
  // 3. Fallback when no network reference price exists
  else {
    const marginPesewas = Math.max(
      INSTANT_BUNDLE_CONFIG.minProductMarginPesewas,
      Math.round((wholesaleCost * INSTANT_BUNDLE_CONFIG.fallbackMarkupPercent) / 100)
    );
    productRetailPricePesewas = wholesaleCost + marginPesewas;
    commercialNotes.push('Calculated using standard fallback markup');
  }

  // Safety invariant: Product retail must strictly exceed wholesale cost
  if (productRetailPricePesewas <= wholesaleCost) {
    productRetailPricePesewas = wholesaleCost + INSTANT_BUNDLE_CONFIG.minProductMarginPesewas;
  }

  const productGrossProfitPesewas = productRetailPricePesewas - wholesaleCost;

  // 4. Calculate Payment Processing Fee using Gross-Up Formula
  const r = INSTANT_BUNDLE_CONFIG.gatewayFeeRate;
  const m = INSTANT_BUNDLE_CONFIG.processingMarginPesewas +
    Math.round((productRetailPricePesewas * INSTANT_BUNDLE_CONFIG.processingMarginPercent) / 100);

  let customerTotalPesewas = Math.ceil((productRetailPricePesewas + m) / (1 - r));
  let paymentProcessingFeePesewas = customerTotalPesewas - productRetailPricePesewas;
  let estimatedGatewayCost = Math.round(customerTotalPesewas * r);
  let actualProcessingMargin = paymentProcessingFeePesewas - estimatedGatewayCost;

  // Adjust for rounding to ensure processing margin is not diluted
  if (actualProcessingMargin < m) {
    customerTotalPesewas += 1;
    paymentProcessingFeePesewas = customerTotalPesewas - productRetailPricePesewas;
    estimatedGatewayCost = Math.round(customerTotalPesewas * r);
    actualProcessingMargin = paymentProcessingFeePesewas - estimatedGatewayCost;
  }

  const expectedTotalGrossProfitPesewas = customerTotalPesewas - estimatedGatewayCost - wholesaleCost;

  // 5. Commercial Guardrail Check
  let isCommerciallyWeak = false;
  if (typeof networkRefPesewas === 'number' && networkRefPesewas > 0) {
    const finalPremium = customerTotalPesewas - networkRefPesewas;
    if (finalPremium > INSTANT_BUNDLE_CONFIG.maxFinalPremiumPesewas) {
      isCommerciallyWeak = true;
      commercialNotes.push(`Final total exceeds network price by ${finalPremium}p (guardrail: ${INSTANT_BUNDLE_CONFIG.maxFinalPremiumPesewas}p)`);
    }
  }

  const networkRefGhc = typeof networkRefPesewas === 'number' ? Number((networkRefPesewas / 100).toFixed(2)) : undefined;
  const productRetailGhc = Number((productRetailPricePesewas / 100).toFixed(2));
  const savingsOnProductGhc = networkRefGhc && networkRefGhc > productRetailGhc ? Number((networkRefGhc - productRetailGhc).toFixed(2)) : undefined;

  return {
    supplierCostPesewas: wholesaleCost,
    networkReferencePricePesewas: networkRefPesewas,
    networkReferencePriceGhc: networkRefGhc,
    undercutApplied,
    savingsOnProductGhc,
    productRetailPricePesewas,
    productRetailPriceGhc: productRetailGhc,
    productGrossProfitPesewas,
    productGrossProfitGhc: Number((productGrossProfitPesewas / 100).toFixed(2)),
    paymentProcessingCostPesewas: estimatedGatewayCost,
    processingMarginPesewas: actualProcessingMargin,
    paymentProcessingFeePesewas,
    paymentProcessingFeeGhc: Number((paymentProcessingFeePesewas / 100).toFixed(2)),
    customerTotalPesewas,
    customerTotalGhc: Number((customerTotalPesewas / 100).toFixed(2)),
    expectedTotalGrossProfitPesewas,
    expectedTotalGrossProfitGhc: Number((expectedTotalGrossProfitPesewas / 100).toFixed(2)),
    isCommerciallyWeak,
    commercialNotes,

    // Aliases for backward compatibility
    retailPricePesewas: productRetailPricePesewas,
    retailPriceGhc: productRetailGhc,
    grossMarginPesewas: productGrossProfitPesewas,
    gatewayFeePesewas: estimatedGatewayCost,
    netPayoutPesewas: customerTotalPesewas - estimatedGatewayCost,
  };
}

/**
 * Calculates authoritative commercial pricing for a flexi package where customer specifies amount.
 */
export function calculateFlexiInstantBundlePrice(
  packageId: string,
  amountGhc: number,
  payableRatio = 1.0,
  minMajor = 1,
  maxMajor = 500
): InstantBundleCommercialResult {
  if (typeof amountGhc !== 'number' || isNaN(amountGhc) || amountGhc <= 0) {
    throw new Error('Please enter a valid flexi amount.');
  }

  if (amountGhc < minMajor) {
    throw new Error(`Minimum amount for this package is GH₵${minMajor}.`);
  }

  if (amountGhc > maxMajor) {
    throw new Error(`Maximum amount for this package is GH₵${maxMajor}.`);
  }

  const safeFaceGhc = Number(Number(amountGhc).toFixed(2));
  const faceValuePesewas = Math.round(safeFaceGhc * 100);

  // Supplier cost = faceValue * payableRatio
  const supplierCostPesewas = Math.round(faceValuePesewas * Math.max(0.5, Math.min(1.2, payableRatio)));

  // For flexi bundles, product retail price matches the customer face value (or covers supplier cost + min margin)
  const productRetailPricePesewas = Math.max(
    faceValuePesewas,
    supplierCostPesewas + INSTANT_BUNDLE_CONFIG.minProductMarginPesewas
  );
  const productGrossProfitPesewas = productRetailPricePesewas - supplierCostPesewas;

  // Calculate gross-up processing fee
  const r = INSTANT_BUNDLE_CONFIG.gatewayFeeRate;
  const m = INSTANT_BUNDLE_CONFIG.processingMarginPesewas +
    Math.round((productRetailPricePesewas * INSTANT_BUNDLE_CONFIG.processingMarginPercent) / 100);

  let customerTotalPesewas = Math.ceil((productRetailPricePesewas + m) / (1 - r));
  let paymentProcessingFeePesewas = customerTotalPesewas - productRetailPricePesewas;
  let estimatedGatewayCost = Math.round(customerTotalPesewas * r);
  let actualProcessingMargin = paymentProcessingFeePesewas - estimatedGatewayCost;

  if (actualProcessingMargin < m) {
    customerTotalPesewas += 1;
    paymentProcessingFeePesewas = customerTotalPesewas - productRetailPricePesewas;
    estimatedGatewayCost = Math.round(customerTotalPesewas * r);
    actualProcessingMargin = paymentProcessingFeePesewas - estimatedGatewayCost;
  }

  const expectedTotalGrossProfitPesewas = customerTotalPesewas - estimatedGatewayCost - supplierCostPesewas;
  const productRetailGhc = Number((productRetailPricePesewas / 100).toFixed(2));

  return {
    supplierCostPesewas,
    undercutApplied: false,
    productRetailPricePesewas,
    productRetailPriceGhc: productRetailGhc,
    productGrossProfitPesewas,
    productGrossProfitGhc: Number((productGrossProfitPesewas / 100).toFixed(2)),
    paymentProcessingCostPesewas: estimatedGatewayCost,
    processingMarginPesewas: actualProcessingMargin,
    paymentProcessingFeePesewas,
    paymentProcessingFeeGhc: Number((paymentProcessingFeePesewas / 100).toFixed(2)),
    customerTotalPesewas,
    customerTotalGhc: Number((customerTotalPesewas / 100).toFixed(2)),
    expectedTotalGrossProfitPesewas,
    expectedTotalGrossProfitGhc: Number((expectedTotalGrossProfitPesewas / 100).toFixed(2)),
    isCommerciallyWeak: false,
    commercialNotes: ['Flexi bundle commercial calculation'],

    // Aliases
    retailPricePesewas: productRetailPricePesewas,
    retailPriceGhc: productRetailGhc,
    grossMarginPesewas: productGrossProfitPesewas,
    gatewayFeePesewas: estimatedGatewayCost,
    netPayoutPesewas: customerTotalPesewas - estimatedGatewayCost,
  };
}

export interface PublicInstantBundle {
  productKey: string;
  packageId: string;
  name: string;
  network: 'mtn' | 'telecel' | 'airteltigo';
  dataAmount: string;
  validity: string;
  isFlexi: boolean;
  minAmountGhc?: number;
  maxAmountGhc?: number;
  retailPriceGhc: number; // Product retail price
  retailPricePesewas: number;
  paymentProcessingFeeGhc: number; // Transparent processing fee
  paymentProcessingFeePesewas: number;
  estimatedTotalGhc: number; // Final customer total
  estimatedTotalPesewas: number;
  networkReferencePriceGhc?: number;
  savingsOnProductGhc?: number;
  availability: 'in_stock' | 'out_of_stock';
  category?: string;
  description?: string;
}

/**
 * Maps raw supplier package to safe PublicInstantBundle model.
 * Strictly avoids exposing supplier cost, payableRatio, or internal margins.
 */
export function toPublicInstantBundle(pkg: SbhInstantBundlePackage): PublicInstantBundle | null {
  try {
    const rawNet = (pkg.network || '').toLowerCase().trim();
    let network: 'mtn' | 'telecel' | 'airteltigo' = 'mtn';
    if (rawNet.includes('telecel') || rawNet === 't') network = 'telecel';
    else if (rawNet.includes('airtel') || rawNet.includes('tigo') || rawNet === 'at') network = 'airteltigo';
    else if (rawNet.includes('mtn')) network = 'mtn';

    const isFlexi = Boolean(pkg.isFlexi || pkg.mode === 'flexi');
    let minGhc: number | undefined;
    let maxGhc: number | undefined;
    let pricing: InstantBundleCommercialResult;

    if (isFlexi) {
      minGhc = typeof pkg.minAmountMajor === 'number' ? pkg.minAmountMajor : parseFloat(String(pkg.minAmountMajor || '1')) || 1;
      maxGhc = typeof pkg.maxAmountMajor === 'number' ? pkg.maxAmountMajor : parseFloat(String(pkg.maxAmountMajor || '500')) || 500;
      const ratio = typeof pkg.payableRatio === 'number' ? pkg.payableRatio : 1.0;
      // Representative starting price at minimum amount
      pricing = calculateFlexiInstantBundlePrice(pkg.id, minGhc, ratio, minGhc, maxGhc);
    } else {
      pricing = calculateFixedInstantBundlePrice(pkg.id, pkg.priceMinor);
    }

    const dataAmount = (pkg.dataAmount || pkg.name || '').trim();

    return {
      productKey: `instant-${pkg.id}`,
      packageId: pkg.id,
      name: pkg.name || `${dataAmount} Instant Bundle`,
      network,
      dataAmount: dataAmount || 'Instant Data',
      validity: pkg.validity || 'Instant Direct',
      isFlexi,
      minAmountGhc: minGhc,
      maxAmountGhc: maxGhc,
      retailPriceGhc: pricing.productRetailPriceGhc,
      retailPricePesewas: pricing.productRetailPricePesewas,
      paymentProcessingFeeGhc: pricing.paymentProcessingFeeGhc,
      paymentProcessingFeePesewas: pricing.paymentProcessingFeePesewas,
      estimatedTotalGhc: pricing.customerTotalGhc,
      estimatedTotalPesewas: pricing.customerTotalPesewas,
      networkReferencePriceGhc: pricing.networkReferencePriceGhc,
      savingsOnProductGhc: pricing.savingsOnProductGhc,
      availability: pkg.available === false ? 'out_of_stock' : 'in_stock',
      category: pkg.category || undefined,
      description: `Instant ${network.toUpperCase()} bundle with direct automated delivery.`,
    };
  } catch (err) {
    console.warn(`[InstantBundlePricing] Skipping unsellable supplier package ${pkg.id}:`, err);
    return null;
  }
}
