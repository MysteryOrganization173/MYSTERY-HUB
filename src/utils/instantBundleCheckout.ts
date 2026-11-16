import type { DataBundle } from '../types';
import type { PublicInstantBundle } from '../services/apiClient';
import { getInstantBundlePresentation } from './instantBundleUtils';

/**
 * The checkout bundle for a public Instant Bundle, exactly as the Instant catalogue builds it. Shared by the catalogue
 * and Buy Again so both open the same checkout. The server prices it again at payment.
 */
export function instantBundleToCheckout(product: PublicInstantBundle, options?: { flexiAmount?: number }): DataBundle {
  const finalPrice = product.isFlexi && options?.flexiAmount ? options.flexiAmount : product.retailPriceGhc;
  // The catalogue prices Flexi at its minimum; another amount gets checkout's fee estimate instead.
  const catalogPriced = !product.isFlexi || finalPrice === product.retailPriceGhc;
  const info = getInstantBundlePresentation(product);
  return {
    id: product.productKey,
    network: product.network,
    dataAmount: info.formattedAmount,
    dataBytesValue: 0,
    validity: product.validity || 'Instant Direct',
    validityCategory: 'Daily',
    priceGhc: finalPrice,
    faceValueGhc: finalPrice,
    serviceFeeGhc: catalogPriced ? product.paymentProcessingFeeGhc : undefined,
    estimatedTotalGhc: catalogPriced ? product.estimatedTotalGhc : undefined,
    networkReferencePriceGhc: product.networkReferencePriceGhc,
    savingsOnProductGhc: product.savingsOnProductGhc,
    serviceType: 'instant_bundle',
    category: info.categoryLabel,
    restrictionNote: info.restrictionNote,
    description:
      info.restrictionNote ||
      product.description ||
      `Instant ${product.network.toUpperCase()} bundle with direct automated delivery.`,
    packageId: product.packageId,
    isFlexi: product.isFlexi,
    minAmountGhc: product.minAmountGhc,
    maxAmountGhc: product.maxAmountGhc,
  };
}
