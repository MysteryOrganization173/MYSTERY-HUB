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
  | 'business_essentials';

export interface MarketplaceSpecItem {
  label: string;
  value: string;
}

export interface MarketplaceProductRecord {
  id: string;
  slug: string;
  name: string;
  category: string;
  tagline: string | null;
  description: string | null;
  price_type: MarketplaceProductPriceType;
  price_minor: number | null; // stored in pesewas (100 pesewas = 1 GHS)
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
}

export interface AdminMarketplaceProduct extends PublicMarketplaceProduct {
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

/**
 * Map raw database record to safe customer-facing PublicMarketplaceProduct
 */
export function toPublicMarketplaceProduct(record: MarketplaceProductRecord): PublicMarketplaceProduct {
  const categoryLabel = CATEGORY_LABELS[record.category] || record.category;
  const priceDisplay = formatMarketplacePrice(record.price_type, record.price_minor);
  const priceGhc = record.price_minor !== null ? record.price_minor / 100 : null;

  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    category: record.category,
    categoryLabel,
    tagline: record.tagline || '',
    description: record.description || '',
    priceType: record.price_type,
    priceMinor: record.price_minor,
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
  };
}

/**
 * Map raw database record to AdminMarketplaceProduct
 */
export function toAdminMarketplaceProduct(record: MarketplaceProductRecord): AdminMarketplaceProduct {
  const pub = toPublicMarketplaceProduct(record);
  return {
    ...pub,
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
