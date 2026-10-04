import { marketplaceOptionPrice, purchasableOptions } from '../../shared/marketplaceVariants.js';
/**
 * Marketplace V1 Types & Presentation Utilities
 * Strict typing for PostgreSQL storage and safe customer-facing APIs.
 */

export type MarketplaceProductPriceType = 'fixed' | 'starting_at' | 'quote';

export type MarketplaceProductAvailability =
  | 'available'
  | 'check_availability'
  | 'limited'
  | 'coming_soon';

export type MarketplaceProductCategory =
  | 'all'
  | 'laptops_computers'
  | 'phones_accessories'
  | 'ai_productivity'
  | 'creator_tools'
  | 'business_software'
  | 'digital_products'
  | 'business_essentials'
  | (string & {});

export interface MarketplaceSpecItem {
  label: string;
  value: string;
}

export interface MarketplacePickupLocation {
  id: string;
  name: string;
  city: string;
  area: string;
  addressOrLandmark?: string;
  phone?: string;
  active: boolean;
}

export interface MarketplaceProductVariant {
  id: string;
  name: string;
  priceMinor: number;
  priceGhc: number;
  active: boolean;
}

export type MarketplaceProductKind = 'physical' | 'digital' | 'service';
export type MarketplaceFulfilmentMode = 'pickup' | 'delivery' | 'both' | 'digital_delivery' | 'manual_activation' | 'inquiry_only';

export interface MarketplaceProductRecord {
  product_kind?: MarketplaceProductKind;
  fulfilment_note?: string | null;
  fulfilment_identifier_label?: string | null;
  fulfilment_identifier_placeholder?: string | null;
  fulfilment_identifier_required?: boolean;
  admin_note?: string | null;
  id: string;
  slug: string;
  name: string;
  category: string;
  tagline: string | null;
  description: string | null;
  price_type: MarketplaceProductPriceType;
  price_minor: number | null; // stored in pesewas (100 pesewas = 1 GHS)
  referral_reward_minor?: number | null; // stored in pesewas (nullable, defaults to null/disabled)
  purchase_enabled?: boolean;
  fulfilment_mode?: MarketplaceFulfilmentMode;
  pickup_locations?: string | null; // JSON string of MarketplacePickupLocation[]
  delivery_available?: boolean;
  delivery_note?: string | null;
  purchase_note?: string | null;
  payment_required_before_delivery?: boolean;
  variants?: string | null; // JSON string of MarketplaceProductVariant[]
  availability: MarketplaceProductAvailability;
  availability_label: string | null;
  badge: string | null;
  image_url: string | null;
  image_alt: string | null;
  gallery_urls: string | null; // JSON array of string URLs
  highlights: string | null; // JSON array of strings
  specs: string | null; // JSON array of MarketplaceSpecItem
  featured: boolean;
  published: boolean;
  archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PublicMarketplaceProduct {
  productKind?: MarketplaceProductKind;
  fulfilmentNote?: string;
  fulfilmentIdentifierLabel?: string;
  fulfilmentIdentifierPlaceholder?: string;
  fulfilmentIdentifierRequired?: boolean;

  id: string;
  slug: string;
  name: string;
  category: string;
  categoryLabel: string;
  tagline: string;
  description: string;
  priceType: MarketplaceProductPriceType;
  priceMinor: number | null;
  priceGhc: number | null;
  priceDisplay: string;
  availability: MarketplaceProductAvailability;
  availabilityLabel: string;
  badge?: string;
  imageUrl?: string;
  imageAlt?: string;
  galleryUrls?: string[];
  highlights: string[];
  specs?: MarketplaceSpecItem[];
  featured: boolean;
  referralRewardMinor?: number | null;
  referralRewardGhc?: number | null;
  purchaseEnabled: boolean;
  fulfilmentMode: MarketplaceFulfilmentMode;
  pickupLocations: MarketplacePickupLocation[];
  deliveryAvailable: boolean;
  deliveryNote?: string;
  purchaseNote?: string;
  paymentRequiredBeforeDelivery: boolean;
  variants: MarketplaceProductVariant[];
}

export interface AdminMarketplaceProduct extends PublicMarketplaceProduct {
  adminNote?: string;
  readiness?: { blockers: string[]; warnings: string[]; ready: boolean };
  published: boolean;
  archived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const CATEGORY_LABELS: Record<string, string> = {
  all: 'All Sourced Products',
  laptops_computers: 'Laptops & Computers',
  phones_accessories: 'Phones & Accessories',
  ai_productivity: 'AI & Productivity Tools',
  creator_tools: 'Creator & Media Tools',
  business_software: 'Business Software',
  digital_products: 'Digital Products',
  business_essentials: 'Business Hardware',
};

/**
 * Format integer pesewas to GHS display string
 */
export function formatGhcAmount(minor: number | null | undefined): string {
  if (minor === null || minor === undefined || isNaN(minor)) {
    return '0';
  }
  const ghc = minor / 100;
  return ghc.toLocaleString('en-US', {
    minimumFractionDigits: ghc % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format price according to price_type rules:
 * - fixed: GH₵3,900
 * - starting_at: From GH₵3,900
 * - quote: Request Quote
 */
export function formatMarketplacePrice(
  priceType: MarketplaceProductPriceType,
  priceMinor: number | null | undefined
): string {
  if (priceType === 'quote') {
    return 'Request Quote';
  }

  const formatted = formatGhcAmount(priceMinor);
  if (priceType === 'starting_at') {
    return `From GH₵${formatted}`;
  }

  return `GH₵${formatted}`;
}

/**
 * Clean slug generator from product name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'product';
}

/**
 * Safely parse JSON array of strings
 */
export function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }
  } catch {
    // fallback if raw string with comma/newline
    if (typeof raw === 'string') {
      return raw.split('\n').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

/**
 * Safely parse JSON array of specs
 */
export function parseJsonSpecs(raw: string | null | undefined): MarketplaceSpecItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is MarketplaceSpecItem =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.label === 'string' &&
          typeof item.value === 'string' &&
          item.label.trim().length > 0
      );
    }
  } catch {
    // ignore malformed specs
  }
  return [];
}

export function parseJsonPickupLocations(raw: string | null | undefined): MarketplacePickupLocation[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (loc): loc is MarketplacePickupLocation =>
          typeof loc === 'object' &&
          loc !== null &&
          typeof loc.id === 'string' &&
          typeof loc.name === 'string' &&
          typeof loc.city === 'string' &&
          typeof loc.area === 'string'
      );
    }
  } catch {}
  return [];
}

// A malformed configured option list must fail closed, not become a base-price product.
export function hasConfiguredMarketplaceVariants(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try { const value=JSON.parse(raw); return !Array.isArray(value) || value.length > 0; }
  catch { return true; }
}

export function parseJsonVariants(raw: string | null | undefined): MarketplaceProductVariant[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (v): v is MarketplaceProductVariant =>
          typeof v === 'object' &&
          v !== null &&
          typeof v.id === 'string' &&
          typeof v.name === 'string' &&
          typeof v.priceMinor === 'number'
      );
    }
  } catch {}
  return [];
}

/**
 * Map raw database record to safe customer-facing PublicMarketplaceProduct
 */
export function toPublicMarketplaceProduct(record: MarketplaceProductRecord): PublicMarketplaceProduct {
  const categoryLabel = CATEGORY_LABELS[record.category] || record.category;
  const rawOptions = parseJsonVariants(record.variants);
  const hasOptions = hasConfiguredMarketplaceVariants(record.variants);
  const priceMinor = record.price_type === 'quote' || (hasOptions && !purchasableOptions(rawOptions).length) ? null : marketplaceOptionPrice(record.price_minor,rawOptions);
  const priceType = record.price_type === 'quote' ? 'quote' : purchasableOptions(rawOptions).length > 1 ? 'starting_at' : record.price_type;
  const priceDisplay = formatMarketplacePrice(priceType,priceMinor);
  const priceGhc = priceMinor !== null ? priceMinor / 100 : null;

  const pickupLocations = parseJsonPickupLocations(record.pickup_locations);
  const variants = rawOptions.map(v => ({...v,priceGhc:v.priceMinor/100}));
  const purchaseEnabled = record.price_type === 'quote' || record.fulfilment_mode === 'inquiry_only' || record.availability === 'coming_soon' || (hasOptions && !purchasableOptions(rawOptions).length) ? false : (record.purchase_enabled !== false);

  return {
    productKind: record.product_kind || 'physical',
    fulfilmentNote: record.fulfilment_note || undefined,
    fulfilmentIdentifierLabel: record.fulfilment_identifier_label || undefined,
    fulfilmentIdentifierPlaceholder: record.fulfilment_identifier_placeholder || undefined,
    fulfilmentIdentifierRequired: record.fulfilment_identifier_required === true,
    id: record.id,
    slug: record.slug,
    name: record.name,
    category: record.category,
    categoryLabel,
    tagline: record.tagline || '',
    description: record.description || '',
    priceType,
    priceMinor,
    priceGhc,
    priceDisplay,
    availability: record.availability,
    availabilityLabel: record.availability_label || getAvailabilityFallbackLabel(record.availability),
    badge: record.badge || undefined,
    imageUrl: record.image_url || undefined,
    imageAlt: record.image_alt || record.name,
    galleryUrls: parseJsonStringArray(record.gallery_urls),
    highlights: parseJsonStringArray(record.highlights),
    specs: parseJsonSpecs(record.specs),
    featured: Boolean(record.featured),
    referralRewardMinor: record.referral_reward_minor || null,
    referralRewardGhc: record.referral_reward_minor != null ? record.referral_reward_minor / 100 : null,
    purchaseEnabled,
    fulfilmentMode: record.fulfilment_mode || 'both',
    pickupLocations,
    deliveryAvailable: record.delivery_available !== false,
    deliveryNote: record.delivery_note || undefined,
    purchaseNote: record.purchase_note || undefined,
    paymentRequiredBeforeDelivery: record.payment_required_before_delivery !== false,
    variants,
  };
}

/**
 * Map raw database record to AdminMarketplaceProduct
 */
export function toAdminMarketplaceProduct(record: MarketplaceProductRecord): AdminMarketplaceProduct {
  const pub = toPublicMarketplaceProduct(record);
  return {
    ...pub,
    priceType:record.price_type,priceMinor:record.price_minor,priceGhc:record.price_minor !== null ? record.price_minor/100 : null,priceDisplay:formatMarketplacePrice(record.price_type,record.price_minor),
    adminNote: record.admin_note || undefined,
    published: Boolean(record.published),
    archived: Boolean(record.archived),
    sortOrder: record.sort_order || 0,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function getAvailabilityFallbackLabel(availability: MarketplaceProductAvailability): string {
  switch (availability) {
    case 'available':
      return 'Available';
    case 'check_availability':
      return 'Check Availability';
    case 'limited':
      return 'Limited Sourcing';
    case 'coming_soon':
      return 'Coming Soon';
    default:
      return 'Available';
  }
}
