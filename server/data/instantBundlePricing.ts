/**
 * Server-Authoritative Instant Bundle Pricing Module
 * Controls the single source of truth for Instant Bundle commercial calculation.
 * 
 * Rules:
 * 1. Strict integer pesewa arithmetic — zero floating-point currency representation internally.
 * 2. Minimum margin guarantee — never produces negative expected gross margin.
 * 3. Accounts for gateway processing fee (Paystack).
 * 4. Fails safely if supplier package has no valid cost or invalid parameters.
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

  minMarginPesewas: (() => {
    const raw = process.env.INSTANT_BUNDLE_MIN_MARGIN_PESEWAS;
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
    return 50; // Default GH₵0.50 minimum gross profit per bundle
  })(),

  markupPercent: (() => {
    const raw = process.env.INSTANT_BUNDLE_MARKUP_PERCENT;
    if (raw) {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
    return 10; // Default 10% markup over wholesale cost
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
};

export interface InstantBundlePricingResult {
  supplierCostPesewas: number;
  grossMarginPesewas: number;
  retailPricePesewas: number;
  retailPriceGhc: number;
  gatewayFeePesewas: number;
  netPayoutPesewas: number;
}

/**
 * Calculates authoritative retail price for a fixed package from wholesale cost.
 * Guarantee: retailPricePesewas - gatewayFeePesewas - supplierCostPesewas >= grossMarginPesewas >= minMarginPesewas
 */
export function calculateFixedInstantBundlePrice(
  packageId: string,
  rawPriceMinor: string | number | undefined
): InstantBundlePricingResult {
  const wholesaleCost = parseMinorAmount(rawPriceMinor);
  if (wholesaleCost === null || wholesaleCost <= 0) {
    throw new Error(`Invalid or missing supplier priceMinor for instant package ${packageId}`);
  }

  // Check optional explicit override first
  const overridePesewas = INSTANT_BUNDLE_CONFIG.packageOverrides[packageId];
  if (typeof overridePesewas === 'number' && overridePesewas > wholesaleCost) {
    const gatewayFee = Math.round(overridePesewas * INSTANT_BUNDLE_CONFIG.gatewayFeeRate);
    const netPayout = overridePesewas - gatewayFee;
    return {
      supplierCostPesewas: wholesaleCost,
      grossMarginPesewas: netPayout - wholesaleCost,
      retailPricePesewas: overridePesewas,
      retailPriceGhc: Number((overridePesewas / 100).toFixed(2)),
      gatewayFeePesewas: gatewayFee,
      netPayoutPesewas: netPayout,
    };
  }

  // Calculate gross margin: max(minMargin, wholesale * markup%)
  const marginPesewas = Math.max(
    INSTANT_BUNDLE_CONFIG.minMarginPesewas,
    Math.round((wholesaleCost * INSTANT_BUNDLE_CONFIG.markupPercent) / 100)
  );

  const baseRequired = wholesaleCost + marginPesewas;
  const divisor = 1 - INSTANT_BUNDLE_CONFIG.gatewayFeeRate;
  const retailPesewas = Math.ceil(baseRequired / divisor);

  const gatewayFeePesewas = Math.round(retailPesewas * INSTANT_BUNDLE_CONFIG.gatewayFeeRate);
  const netPayoutPesewas = retailPesewas - gatewayFeePesewas;

  // Safety check: ensure net payout covers wholesale + at least minimum margin
  if (netPayoutPesewas < wholesaleCost + marginPesewas) {
    // Rounding adjustment
    const adjustedRetail = retailPesewas + 1;
    const adjFee = Math.round(adjustedRetail * INSTANT_BUNDLE_CONFIG.gatewayFeeRate);
    return {
      supplierCostPesewas: wholesaleCost,
      grossMarginPesewas: adjustedRetail - adjFee - wholesaleCost,
      retailPricePesewas: adjustedRetail,
      retailPriceGhc: Number((adjustedRetail / 100).toFixed(2)),
      gatewayFeePesewas: adjFee,
      netPayoutPesewas: adjustedRetail - adjFee,
    };
  }

  return {
    supplierCostPesewas: wholesaleCost,
    grossMarginPesewas: netPayoutPesewas - wholesaleCost,
    retailPricePesewas: retailPesewas,
    retailPriceGhc: Number((retailPesewas / 100).toFixed(2)),
    gatewayFeePesewas: gatewayFeePesewas,
    netPayoutPesewas: netPayoutPesewas,
  };
}

/**
 * Calculates authoritative retail price for a flexi package where customer specifies amount
 */
export function calculateFlexiInstantBundlePrice(
  packageId: string,
  amountGhc: number,
  payableRatio = 1.0,
  minMajor = 1,
  maxMajor = 500
): InstantBundlePricingResult {
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

  const marginPesewas = Math.max(
    INSTANT_BUNDLE_CONFIG.minMarginPesewas,
    Math.round((supplierCostPesewas * INSTANT_BUNDLE_CONFIG.markupPercent) / 100)
  );

  const baseRequired = supplierCostPesewas + marginPesewas;
  const divisor = 1 - INSTANT_BUNDLE_CONFIG.gatewayFeeRate;
  const retailPesewas = Math.ceil(baseRequired / divisor);
  const gatewayFeePesewas = Math.round(retailPesewas * INSTANT_BUNDLE_CONFIG.gatewayFeeRate);
  const netPayoutPesewas = retailPesewas - gatewayFeePesewas;

  return {
    supplierCostPesewas,
    grossMarginPesewas: netPayoutPesewas - supplierCostPesewas,
    retailPricePesewas: retailPesewas,
    retailPriceGhc: Number((retailPesewas / 100).toFixed(2)),
    gatewayFeePesewas,
    netPayoutPesewas,
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
  retailPriceGhc: number;
  retailPricePesewas: number;
  availability: 'in_stock' | 'out_of_stock';
  category?: string;
  description?: string;
}

/**
 * Maps raw supplier package to safe PublicInstantBundle model.
 * Strictly avoids exposing supplier cost, payableRatio, or accounting credentials.
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
    let retailPriceGhc = 0;
    let retailPricePesewas = 0;

    if (isFlexi) {
      minGhc = typeof pkg.minAmountMajor === 'number' ? pkg.minAmountMajor : parseFloat(String(pkg.minAmountMajor || '1')) || 1;
      maxGhc = typeof pkg.maxAmountMajor === 'number' ? pkg.maxAmountMajor : parseFloat(String(pkg.maxAmountMajor || '500')) || 500;
      const ratio = typeof pkg.payableRatio === 'number' ? pkg.payableRatio : 1.0;
      // Representative starting price at minimum amount
      const sample = calculateFlexiInstantBundlePrice(pkg.id, minGhc, ratio, minGhc, maxGhc);
      retailPriceGhc = sample.retailPriceGhc;
      retailPricePesewas = sample.retailPricePesewas;
    } else {
      const pricing = calculateFixedInstantBundlePrice(pkg.id, pkg.priceMinor);
      retailPriceGhc = pricing.retailPriceGhc;
      retailPricePesewas = pricing.retailPricePesewas;
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
      retailPriceGhc,
      retailPricePesewas,
      availability: pkg.available === false ? 'out_of_stock' : 'in_stock',
      category: pkg.category || undefined,
      description: `Instant ${network.toUpperCase()} bundle with direct automated delivery.`,
    };
  } catch (err) {
    console.warn(`[InstantBundlePricing] Skipping unsellable supplier package ${pkg.id}:`, err);
    return null;
  }
}
