/**
 * Server-Authoritative Product Catalog
 * The browser is NEVER trusted for bundle prices or network attributes.
 * Prices are stored in pesewas (1 GHS = 100 Pesewas) to avoid floating point errors.
 */

export interface AuthoritativeProduct {
  id: string;
  network: 'mtn' | 'telecel' | 'airteltigo';
  networkName: string;
  dataAmount: string; // e.g. "1GB"
  validity: string;   // e.g. "7 Days"
  priceGhc: number;   // e.g. 4.99
  amountPesewas: number; // e.g. 499
  currency: 'GHS';
  isActive: boolean;
  description: string;
}

export const AUTHORITATIVE_PRODUCTS: Record<string, AuthoritativeProduct> = {
  // MTN
  'mtn-1gb-7d': {
    id: 'mtn-1gb-7d',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '1GB',
    validity: '7 Days',
    priceGhc: 4.99,
    amountPesewas: 499,
    currency: 'GHS',
    isActive: true,
    description: 'Fast 4G/5G data for regular social & browsing',
  },
  'mtn-2.5gb-7d': {
    id: 'mtn-2.5gb-7d',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '2.5GB',
    validity: '7 Days',
    priceGhc: 12.99,
    amountPesewas: 1299,
    currency: 'GHS',
    isActive: true,
    description: 'Great for weekly streaming, TikTok, and video calls',
  },
  'mtn-5gb-30d': {
    id: 'mtn-5gb-30d',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '5GB',
    validity: '30 Days',
    priceGhc: 24.99,
    amountPesewas: 2499,
    currency: 'GHS',
    isActive: true,
    description: 'Our most chosen monthly student and work bundle',
  },
  'mtn-10gb-30d': {
    id: 'mtn-10gb-30d',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '10GB',
    validity: '30 Days',
    priceGhc: 44.99,
    amountPesewas: 4499,
    currency: 'GHS',
    isActive: true,
    description: 'Heavy browsing, YouTube, gaming, and remote work',
  },
  'mtn-500mb-1d': {
    id: 'mtn-500mb-1d',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '500MB',
    validity: '1 Day',
    priceGhc: 2.99,
    amountPesewas: 299,
    currency: 'GHS',
    isActive: true,
    description: 'Quick daily boost for messaging and urgent lookups',
  },
  'mtn-15gb-30d': {
    id: 'mtn-15gb-30d',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '15GB',
    validity: '30 Days',
    priceGhc: 64.99,
    amountPesewas: 6499,
    currency: 'GHS',
    isActive: true,
    description: 'Power user monthly bundle for hotspotting & downloads',
  },
  'mtn-30gb-jumbo': {
    id: 'mtn-30gb-jumbo',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '30GB',
    validity: 'Non-Expiry',
    priceGhc: 119.99,
    amountPesewas: 11999,
    currency: 'GHS',
    isActive: true,
    description: 'Non-expiring Jumbo bundle — use at your own pace',
  },

  // Telecel Ghana
  'telecel-1gb-7d': {
    id: 'telecel-1gb-7d',
    network: 'telecel',
    networkName: 'Telecel Ghana',
    dataAmount: '1GB',
    validity: '7 Days',
    priceGhc: 4.80,
    amountPesewas: 480,
    currency: 'GHS',
    isActive: true,
    description: 'Weekly Telecel connection for messaging & browsing',
  },
  'telecel-3gb-7d': {
    id: 'telecel-3gb-7d',
    network: 'telecel',
    networkName: 'Telecel Ghana',
    dataAmount: '3GB',
    validity: '7 Days',
    priceGhc: 13.50,
    amountPesewas: 1350,
    currency: 'GHS',
    isActive: true,
    description: 'Popular weekly streaming & social bundle',
  },
  'telecel-6gb-30d': {
    id: 'telecel-6gb-30d',
    network: 'telecel',
    networkName: 'Telecel Ghana',
    dataAmount: '6GB',
    validity: '30 Days',
    priceGhc: 26.00,
    amountPesewas: 2600,
    currency: 'GHS',
    isActive: true,
    description: 'Reliable monthly Telecel allocation for study & work',
  },
  'telecel-12gb-30d': {
    id: 'telecel-12gb-30d',
    network: 'telecel',
    networkName: 'Telecel Ghana',
    dataAmount: '12GB',
    validity: '30 Days',
    priceGhc: 48.00,
    amountPesewas: 4800,
    currency: 'GHS',
    isActive: true,
    description: 'High-speed monthly Telecel bundle for video & downloads',
  },

  // AirtelTigo (AT)
  'at-1.5gb-7d': {
    id: 'at-1.5gb-7d',
    network: 'airteltigo',
    networkName: 'AirtelTigo (AT)',
    dataAmount: '1.5GB',
    validity: '7 Days',
    priceGhc: 4.50,
    amountPesewas: 450,
    currency: 'GHS',
    isActive: true,
    description: 'Best value weekly AT data allocation',
  },
  'at-4gb-7d': {
    id: 'at-4gb-7d',
    network: 'airteltigo',
    networkName: 'AirtelTigo (AT)',
    dataAmount: '4GB',
    validity: '7 Days',
    priceGhc: 12.00,
    amountPesewas: 1200,
    currency: 'GHS',
    isActive: true,
    description: 'Heavy weekly data for streaming & hotspotting',
  },
  'at-8gb-30d': {
    id: 'at-8gb-30d',
    network: 'airteltigo',
    networkName: 'AirtelTigo (AT)',
    dataAmount: '8GB',
    validity: '30 Days',
    priceGhc: 23.50,
    amountPesewas: 2350,
    currency: 'GHS',
    isActive: true,
    description: 'Super affordable monthly bundle for all AT users',
  },
  'at-15gb-30d': {
    id: 'at-15gb-30d',
    network: 'airteltigo',
    networkName: 'AirtelTigo (AT)',
    dataAmount: '15GB',
    validity: '30 Days',
    priceGhc: 42.00,
    amountPesewas: 4200,
    currency: 'GHS',
    isActive: true,
    description: 'Maximum AT monthly capacity for business & gaming',
  },
};

export function getAuthoritativeProduct(productId: string): AuthoritativeProduct | null {
  const product = AUTHORITATIVE_PRODUCTS[productId];
  if (!product || !product.isActive) {
    return null;
  }
  return product;
}
