/**
 * Success Biz Hub Catalog Resolver
 * Resolves live data offers and packages from Success Biz Hub API v2 catalog.
 * Enforces strict network mapping and exact package size matching without approximation.
 */

import { SbhOffer, SbhPackage } from './types.js';

export interface ResolvedSupplierPackage {
  offer: SbhOffer;
  offerSlug?: string;
  offerId?: string;
  package: SbhPackage;
  sizeLabel: string;
  supplierCostMinor: number;
}

/**
 * Normalizes Mystery Hub network ID to canonical supplier network name
 */
export function normalizeNetwork(mysteryHubNetwork: string): 'mtn' | 'telecel' | 'airteltigo' | null {
  const clean = (mysteryHubNetwork || '').toLowerCase().trim();
  if (clean === 'mtn') return 'mtn';
  if (clean === 'telecel' || clean === 'vodafone') return 'telecel';
  if (clean === 'airteltigo' || clean === 'at' || clean === 'airtel' || clean === 'tigo') return 'airteltigo';
  return null;
}

/**
 * Checks if a supplier offer's network matches the requested network
 */
export function isNetworkMatch(supplierOfferNetwork: string, targetNetwork: 'mtn' | 'telecel' | 'airteltigo'): boolean {
  const norm = (supplierOfferNetwork || '').toLowerCase().replace(/[\s\-_]/g, '');
  if (targetNetwork === 'mtn') {
    return norm === 'mtn' || norm.includes('mtnghana') || norm.includes('mtn');
  }
  if (targetNetwork === 'telecel') {
    return norm === 'telecel' || norm.includes('telecelghana') || norm.includes('telecel') || norm.includes('vodafone');
  }
  if (targetNetwork === 'airteltigo') {
    return (
      norm === 'at' ||
      norm === 'airteltigo' ||
      norm === 'airteltigoghana' ||
      norm.includes('airteltigo') ||
      norm.includes('atmoney') ||
      norm === 'at'
    );
  }
  return false;
}

/**
 * Canonical size label normalization for EXACT comparisons
 * e.g., "1 GB" -> "1GB", "10gb" -> "10GB", "500 mb" -> "500MB"
 * Strictly preserves numeric value and unit without approximation!
 */
export function normalizeSizeLabel(label: string): string {
  if (!label || typeof label !== 'string') return '';
  // Remove spaces, convert to uppercase
  return label.replace(/\s+/g, '').toUpperCase();
}

/**
 * Resolves a live supplier offer and exact package for a Mystery Hub product
 *
 * Requirements:
 * 1. Filter kind === 'data'
 * 2. Filter matching network
 * 3. Fail closed if multiple unresolvable offers exist for that network
 * 4. Find EXACT packages[].sizeLabel match
 * 5. Return resolved package with supplier cost in pesewas
 */
export function resolveSupplierPackage(
  catalogOffers: SbhOffer[],
  mysteryHubNetwork: string,
  mysteryHubBundleSize: string // e.g. "1GB", "2.5GB", "10GB", "30GB"
): { resolved: ResolvedSupplierPackage | null; error?: string } {
  const targetNetwork = normalizeNetwork(mysteryHubNetwork);
  if (!targetNetwork) {
    return {
      resolved: null,
      error: `Unsupported network identifier: "${mysteryHubNetwork}".`,
    };
  }

  // 1. Filter for kind === 'data' and matching network
  const matchingDataOffers = catalogOffers.filter((offer) => {
    const isData = (offer.kind || '').toLowerCase().trim() === 'data';
    const matchesNet = isNetworkMatch(offer.network || offer.name, targetNetwork);
    const isEnabled = offer.enabled !== false;
    return isData && matchesNet && isEnabled;
  });

  if (matchingDataOffers.length === 0) {
    return {
      resolved: null,
      error: `No active data offers found in supplier catalog for network "${targetNetwork.toUpperCase()}".`,
    };
  }

  // 2. Offer selection:
  // If exactly one suitable data offer exists for that network: use it.
  // If multiple offers exist, fail closed unless there is a single primary offer clearly marked.
  let selectedOffer: SbhOffer;
  if (matchingDataOffers.length === 1) {
    selectedOffer = matchingDataOffers[0];
  } else {
    // Check if only one has packages matching
    const normalizedTargetSize = normalizeSizeLabel(mysteryHubBundleSize);
    const offersWithMatchingPackage = matchingDataOffers.filter((o) =>
      Array.isArray(o.packages) &&
      o.packages.some((p) => normalizeSizeLabel(p.sizeLabel) === normalizedTargetSize)
    );

    if (offersWithMatchingPackage.length === 1) {
      selectedOffer = offersWithMatchingPackage[0];
    } else {
      // Multiple ambiguous offers: Fail closed
      const offerSummaries = matchingDataOffers.map((o) => ({
        id: o.id,
        slug: o.slug,
        name: o.name,
        network: o.network,
      }));
      return {
        resolved: null,
        error: `Multiple ambiguous supplier data offers found for network "${targetNetwork.toUpperCase()}". Failing closed to prevent incorrect routing. Available offers: ${JSON.stringify(offerSummaries)}`,
      };
    }
  }

  // 3. Find EXACT packages[].sizeLabel match
  const targetSizeNormalized = normalizeSizeLabel(mysteryHubBundleSize);
  const packages = Array.isArray(selectedOffer.packages) ? selectedOffer.packages : [];

  const matchedPackage = packages.find((pkg) => {
    return normalizeSizeLabel(pkg.sizeLabel) === targetSizeNormalized;
  });

  if (!matchedPackage) {
    const availableSizes = packages.map((p) => p.sizeLabel).join(', ');
    return {
      resolved: null,
      error: `No exact package match for size "${mysteryHubBundleSize}" under supplier offer "${selectedOffer.name || selectedOffer.slug}". Available supplier sizes: [${availableSizes}]. Approximate mappings are forbidden.`,
    };
  }

  return {
    resolved: {
      offer: selectedOffer,
      offerSlug: selectedOffer.slug || undefined,
      offerId: selectedOffer.id || undefined,
      package: matchedPackage,
      sizeLabel: matchedPackage.sizeLabel,
      supplierCostMinor: matchedPackage.priceMinor,
    },
  };
}
