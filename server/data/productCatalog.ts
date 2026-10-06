import { DIRECT_RETAIL_MINOR } from '../../shared/directPricing.js';
/**
 * Server-Authoritative Product Catalog
 * The browser is NEVER trusted for bundle prices or network attributes.
 * Prices are stored in pesewas (1 GHS = 100 Pesewas) to avoid floating point errors.
 *
 * Current canonical supplier catalog:
 * - MTN Express: 1GB, 2GB, 3GB, 4GB, 5GB, 6GB, 8GB, 10GB, 15GB, 20GB, 25GB, 30GB, 40GB
 * - AirtelTigo: 1GB, 2GB, 3GB, 4GB, 5GB
 * - Telecel Expiry: 10GB, 15GB, 20GB, 25GB, 30GB, 40GB, 50GB, 100GB
 *
 * Budget products and unsupported packages (e.g. Telecel 1GB, MTN 500MB, MTN 2.5GB) are removed.
 */

export interface AuthoritativeProduct {
  id: string;
  network: 'mtn' | 'telecel' | 'airteltigo';
  networkName: string;
  dataAmount: string; // e.g. "1GB"
  validity?: string;  // Offer validity detail (not prominent on cards)
  priceGhc: number;   // Retail selling price in GHS
  amountPesewas: number; // Retail selling price in Pesewas
  currency: 'GHS';
  isActive: boolean;
  description: string;
}

export const AUTHORITATIVE_PRODUCTS: Record<string, AuthoritativeProduct> = {
  // ==========================================
  // MTN EXPRESS (Ghana)
  // ==========================================
  'mtn-1gb': {
    id: 'mtn-1gb',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '1GB',
    validity: '90 Days',
    priceGhc: DIRECT_RETAIL_MINOR['mtn-1gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['mtn-1gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Fast 4G/5G data for regular social & browsing',
  },
  'mtn-2gb': {
    id: 'mtn-2gb',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '2GB',
    validity: '90 Days',
    priceGhc: DIRECT_RETAIL_MINOR['mtn-2gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['mtn-2gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Essential data for social apps & messaging',
  },
  'mtn-3gb': {
    id: 'mtn-3gb',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '3GB',
    validity: '90 Days',
    priceGhc: DIRECT_RETAIL_MINOR['mtn-3gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['mtn-3gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Great for weekly streaming, TikTok, and browsing',
  },
  'mtn-4gb': {
    id: 'mtn-4gb',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '4GB',
    validity: '90 Days',
    priceGhc: DIRECT_RETAIL_MINOR['mtn-4gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['mtn-4gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Comfortable allocation for daily video & social media',
  },
  'mtn-5gb': {
    id: 'mtn-5gb',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '5GB',
    validity: '90 Days',
    priceGhc: DIRECT_RETAIL_MINOR['mtn-5gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['mtn-5gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Our most chosen monthly student and work bundle',
  },
  'mtn-6gb': {
    id: 'mtn-6gb',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '6GB',
    validity: '90 Days',
    priceGhc: DIRECT_RETAIL_MINOR['mtn-6gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['mtn-6gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Smooth streaming, calls, and daily downloads',
  },
  'mtn-8gb': {
    id: 'mtn-8gb',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '8GB',
    validity: '90 Days',
    priceGhc: DIRECT_RETAIL_MINOR['mtn-8gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['mtn-8gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Generous data volume for active social & work use',
  },
  'mtn-10gb': {
    id: 'mtn-10gb',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '10GB',
    validity: '90 Days',
    priceGhc: DIRECT_RETAIL_MINOR['mtn-10gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['mtn-10gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Heavy browsing, YouTube, gaming, and remote work',
  },
  'mtn-15gb': {
    id: 'mtn-15gb',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '15GB',
    validity: '90 Days',
    priceGhc: DIRECT_RETAIL_MINOR['mtn-15gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['mtn-15gb'],
    currency: 'GHS',
    isActive: true,
    description: 'High capacity monthly allocation for power users',
  },
  'mtn-20gb': {
    id: 'mtn-20gb',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '20GB',
    validity: '90 Days',
    priceGhc: DIRECT_RETAIL_MINOR['mtn-20gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['mtn-20gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Heavy monthly streaming & hotspot bundle',
  },
  'mtn-25gb': {
    id: 'mtn-25gb',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '25GB',
    validity: '90 Days',
    priceGhc: DIRECT_RETAIL_MINOR['mtn-25gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['mtn-25gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Power user bundle for home and office sharing',
  },
  'mtn-30gb': {
    id: 'mtn-30gb',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '30GB',
    validity: '90 Days',
    priceGhc: DIRECT_RETAIL_MINOR['mtn-30gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['mtn-30gb'],
    currency: 'GHS',
    isActive: true,
    description: 'High volume data bundle for creators and families',
  },
  'mtn-40gb': {
    id: 'mtn-40gb',
    network: 'mtn',
    networkName: 'MTN Ghana',
    dataAmount: '40GB',
    validity: '90 Days',
    priceGhc: DIRECT_RETAIL_MINOR['mtn-40gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['mtn-40gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Maximum capacity MTN data bundle',
  },

  // ==========================================
  // AIRTELTIGO (AT) iShare
  // ==========================================
  'at-1gb': {
    id: 'at-1gb',
    network: 'airteltigo',
    networkName: 'AirtelTigo (AT)',
    dataAmount: '1GB',
    validity: '30 Days',
    priceGhc: DIRECT_RETAIL_MINOR['at-1gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['at-1gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Affordable AT Big Time data bundle',
  },
  'at-2gb': {
    id: 'at-2gb',
    network: 'airteltigo',
    networkName: 'AirtelTigo (AT)',
    dataAmount: '2GB',
    validity: '30 Days',
    priceGhc: DIRECT_RETAIL_MINOR['at-2gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['at-2gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Convenient AT bundle for messaging & everyday use',
  },
  'at-3gb': {
    id: 'at-3gb',
    network: 'airteltigo',
    networkName: 'AirtelTigo (AT)',
    dataAmount: '3GB',
    validity: '30 Days',
    priceGhc: DIRECT_RETAIL_MINOR['at-3gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['at-3gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Great value bundle for social apps and media',
  },
  'at-4gb': {
    id: 'at-4gb',
    network: 'airteltigo',
    networkName: 'AirtelTigo (AT)',
    dataAmount: '4GB',
    validity: '30 Days',
    priceGhc: DIRECT_RETAIL_MINOR['at-4gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['at-4gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Reliable AT allocation for downloads & work',
  },
  'at-5gb': {
    id: 'at-5gb',
    network: 'airteltigo',
    networkName: 'AirtelTigo (AT)',
    dataAmount: '5GB',
    validity: '30 Days',
    priceGhc: DIRECT_RETAIL_MINOR['at-5gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['at-5gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Monthly worry-free browsing with AT simple pricing',
  },

  // ==========================================
  // TELECEL GHANA Expiry
  // ==========================================
  'telecel-10gb': {
    id: 'telecel-10gb',
    network: 'telecel',
    networkName: 'Telecel Ghana',
    dataAmount: '10GB',
    validity: '30 Days',
    priceGhc: DIRECT_RETAIL_MINOR['telecel-10gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['telecel-10gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Stream seamlessly across your devices on Telecel 4G',
  },
  'telecel-15gb': {
    id: 'telecel-15gb',
    network: 'telecel',
    networkName: 'Telecel Ghana',
    dataAmount: '15GB',
    validity: '30 Days',
    priceGhc: DIRECT_RETAIL_MINOR['telecel-15gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['telecel-15gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Reliable Telecel connectivity for remote work & study',
  },
  'telecel-20gb': {
    id: 'telecel-20gb',
    network: 'telecel',
    networkName: 'Telecel Ghana',
    dataAmount: '20GB',
    validity: '30 Days',
    priceGhc: DIRECT_RETAIL_MINOR['telecel-20gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['telecel-20gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Pro monthly bundle for home office and creators',
  },
  'telecel-25gb': {
    id: 'telecel-25gb',
    network: 'telecel',
    networkName: 'Telecel Ghana',
    dataAmount: '25GB',
    validity: '30 Days',
    priceGhc: DIRECT_RETAIL_MINOR['telecel-25gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['telecel-25gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Heavy monthly allocation for multi-device hotspots',
  },
  'telecel-30gb': {
    id: 'telecel-30gb',
    network: 'telecel',
    networkName: 'Telecel Ghana',
    dataAmount: '30GB',
    validity: '30 Days',
    priceGhc: DIRECT_RETAIL_MINOR['telecel-30gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['telecel-30gb'],
    currency: 'GHS',
    isActive: true,
    description: 'High capacity Telecel data allocation',
  },
  'telecel-40gb': {
    id: 'telecel-40gb',
    network: 'telecel',
    networkName: 'Telecel Ghana',
    dataAmount: '40GB',
    validity: '30 Days',
    priceGhc: DIRECT_RETAIL_MINOR['telecel-40gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['telecel-40gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Extensive data capacity for families and developers',
  },
  'telecel-50gb': {
    id: 'telecel-50gb',
    network: 'telecel',
    networkName: 'Telecel Ghana',
    dataAmount: '50GB',
    validity: '30 Days',
    priceGhc: DIRECT_RETAIL_MINOR['telecel-50gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['telecel-50gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Super high capacity Telecel package',
  },
  'telecel-100gb': {
    id: 'telecel-100gb',
    network: 'telecel',
    networkName: 'Telecel Ghana',
    dataAmount: '100GB',
    validity: '30 Days',
    priceGhc: DIRECT_RETAIL_MINOR['telecel-100gb'] / 100,
    amountPesewas: DIRECT_RETAIL_MINOR['telecel-100gb'],
    currency: 'GHS',
    isActive: true,
    description: 'Ultimate 100GB Telecel monthly connectivity bundle',
  },
};

for (const product of Object.values(AUTHORITATIVE_PRODUCTS)) {
  product.amountPesewas = DIRECT_RETAIL_MINOR[product.id] ?? product.amountPesewas;
  product.priceGhc = product.amountPesewas / 100;
}

// Aliases mapping legacy product IDs to updated authoritative items
const LEGACY_PRODUCT_ALIASES: Record<string, string> = {
  'mtn-1gb-7d': 'mtn-1gb',
  'mtn-5gb-30d': 'mtn-5gb',
  'mtn-10gb-30d': 'mtn-10gb',
  'mtn-15gb-30d': 'mtn-15gb',
  'mtn-30gb-jumbo': 'mtn-30gb',
  'at-1gb-7d': 'at-1gb',
  'at-4gb-7d': 'at-4gb',
  'at-5gb-30d': 'at-5gb',
  'telecel-10gb-30d': 'telecel-10gb',
  'telecel-20gb-30d': 'telecel-20gb',
};

export function getAuthoritativeProduct(productId: string): AuthoritativeProduct | null {
  if (!productId || typeof productId !== 'string') return null;

  // Direct lookup
  let product = AUTHORITATIVE_PRODUCTS[productId];

  // Try alias lookup
  if (!product && LEGACY_PRODUCT_ALIASES[productId]) {
    product = AUTHORITATIVE_PRODUCTS[LEGACY_PRODUCT_ALIASES[productId]];
  }

  if (!product || !product.isActive) {
    return null;
  }
  return product;
}
