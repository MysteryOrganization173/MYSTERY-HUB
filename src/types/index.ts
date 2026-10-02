export type NetworkId = 'mtn' | 'telecel' | 'airteltigo';

export interface NetworkInfo {
  id: NetworkId;
  name: string;
  tagline: string;
  brandColor: string;
  badgeBg: string;
  textColor: string;
  momoName: string;
  prefixes: string[]; // e.g. ['024', '054', '055', '059']
}

export type BundleValidity = 'Daily' | 'Weekly' | 'Monthly' | 'Non-Expiry';

export interface DataBundle {
  id: string;
  network: NetworkId;
  dataAmount: string; // e.g., '1GB', '2.5GB', 'GH₵10 Airtime'
  dataBytesValue: number; // in MB for sorting, 0 for airtime
  validity: string; // e.g., '7 Days', '30 Days', 'No Expiry', 'Direct Credit'
  validityCategory: BundleValidity;
  priceGhc: number; // editable price or total in Ghanaian Cedis
  isPopular?: boolean;
  isBestValue?: boolean;
  description?: string;
  serviceType?: 'data' | 'airtime' | 'instant_bundle';
  category?: string;
  restrictionNote?: string;
  faceValueGhc?: number;
  serviceFeeGhc?: number;
  estimatedTotalGhc?: number;
  networkReferencePriceGhc?: number;
  savingsOnProductGhc?: number;
  packageId?: string;
  isFlexi?: boolean;
  minAmountGhc?: number;
  maxAmountGhc?: number;
}

export type OrderStatus = 'placed' | 'verifying' | 'processing' | 'delivered' | 'failed';

export type PaymentMethod = 'paystack' | 'momo' | 'card' | 'bank';

export interface OrderRecord {
  id: string; // Local client ID e.g. MH1234567
  publicReference?: string; // Real authoritative backend reference e.g. MH-20260930-592025
  serverReference?: string; // Alias for backward compatibility
  serviceType?: 'data' | 'airtime' | 'instant_bundle';
  bundle: DataBundle;
  recipientPhone: string;
  network: NetworkId;
  paymentMethod: PaymentMethod;
  amountGhc: number;
  faceValueGhc?: number;
  serviceFeeGhc?: number;
  status: OrderStatus;
  serverStatus?: string; // Raw backend status e.g. 'refund_pending', 'delivered'
  statusMessage?: string; // Customer-friendly status message (e.g. for refund pending)
  paymentReference?: string;
  createdAt: string;
  updatedAt: string;
}

export type TemplateCategory =
  | 'all'
  | 'construction'
  | 'restaurant'
  | 'fashion'
  | 'beauty'
  | 'church'
  | 'services'
  | 'portfolio'
  | 'retail'
  | 'realestate'
  | 'hotel'
  | 'education'
  | 'agency';

export type TemplateLayoutType =
  | 'construction'
  | 'restaurant'
  | 'salon'
  | 'realestate'
  | 'portfolio'
  | 'agency'
  | 'hotel'
  | 'education'
  | 'ecommerce'
  | 'church'
  | 'fashion'
  | 'services'
  | 'reseller';

export interface SiteSocialLinks {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
}

export interface SiteContent {
  businessName: string;
  tagline: string;
  aboutText: string;
  location: string;
  phone: string;
  whatsapp: string;
  email: string;
  heroImage: string;
  logoUrl?: string;
  ctaLabel: string;
  ctaTarget: string;
  social?: SiteSocialLinks;
  items?: TemplateItem[];
  stats?: Array<{ label: string; value: string }>;
  features?: string[];
}

export interface SiteSettings {
  primaryColor: string;
  accentColor: string;
  backgroundColor?: string;
  fontFamily?: string;
  borderRadius?: string;
}

export interface WebsiteSiteRecord {
  id: string;
  user_id: string;
  template_id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  content_json: SiteContent;
  settings_json: SiteSettings;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
}

export interface PublicWebsiteSite {
  id: string;
  template_id: string;
  name: string;
  slug: string;
  content: SiteContent;
  settings: SiteSettings;
  published_at?: string | null;
}

export interface TemplateColorScheme {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  accent: string;
  border: string;
}

export interface TemplateItem {
  id?: string;
  name: string;
  price?: string;
  category?: string;
  desc?: string;
  image?: string;
  tag?: string;
  specs?: string[];
  rating?: number;
}

export interface WebsiteTemplate {
  id: string;
  title: string;
  category: TemplateCategory;
  categoryLabel: string;
  description: string;
  industry: string;
  features: string[];
  accentColor: string;
  demoBusinessName: string;
  demoHeroTagline: string;
  demoSubtext: string;
  previewImageUrl?: string;
  isFreeTier: boolean;
  layoutType?: TemplateLayoutType;
  colorScheme?: TemplateColorScheme;
  heroImage?: string;
  galleryImages?: string[];
  items?: TemplateItem[];
  stats?: Array<{ label: string; value: string }>;
  testimonials?: Array<{ quote: string; author: string; role?: string }>;
  badgeText?: string;
  location?: string;
  hoursOrContact?: string;
}

export type ServiceStatus = 'active' | 'coming_soon' | 'beta';

export interface DigitalService {
  id: string;
  title: string;
  category: string;
  description: string;
  status: ServiceStatus;
  iconName: string;
  accentColor: string;
  targetPage?: 'data' | 'website' | 'marketplace' | 'services' | 'about';
}

export type ActivePage = 'home' | 'data' | 'website' | 'marketplace' | 'services' | 'about' | 'orders' | 'admin' | 'earn';

export type MarketplaceAvailability = 'available' | 'check_availability' | 'limited' | 'coming_soon';

export type MarketplaceCategory =
  | 'all'
  | 'laptops_computers'
  | 'phones_accessories'
  | 'ai_productivity'
  | 'creator_tools'
  | 'business_software'
  | 'digital_products'
  | 'business_essentials';

export interface MarketplaceProduct {
  id: string;
  slug: string;
  name: string;
  category: MarketplaceCategory;
  categoryLabel: string;
  tagline: string;
  description: string;
  priceDisplay: string; // e.g. "GH₵ 3,900", "From GH₵ 6,800", "Request Quote"
  priceType: 'fixed' | 'starting_at' | 'quote';
  priceMinor?: number | null;
  priceGhc?: number | null;
  availability: MarketplaceAvailability;
  availabilityLabel: string;
  featured?: boolean;
  type?: 'hardware' | 'software' | 'digital_tool' | 'essential';
  badge?: string;
  imageUrl?: string;
  imageAlt?: string;
  galleryUrls?: string[];
  highlights: string[];
  specs?: Array<{ label: string; value: string }>;
  iconName?: string;
  accentColor?: string;
  published?: boolean;
  archived?: boolean;
  sortOrder?: number;
  referralRewardMinor?: number | null;
  referralRewardGhc?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SafeEditorAiContext {
  experienceMode: 'website_editor';
  templateId: string;
  templateName: string;
  siteStatus: 'draft' | 'published';
  activeEditorSection: string;
  previewDevice: 'desktop' | 'tablet' | 'mobile';
  hasUnsavedChanges: boolean;
}


