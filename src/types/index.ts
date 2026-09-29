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
  dataAmount: string; // e.g., '1GB', '2.5GB', '10GB'
  dataBytesValue: number; // in MB for sorting
  validity: string; // e.g., '7 Days', '30 Days', 'No Expiry'
  validityCategory: BundleValidity;
  priceGhc: number; // editable price in Ghanaian Cedis
  isPopular?: boolean;
  isBestValue?: boolean;
  description?: string;
}

export type OrderStatus = 'placed' | 'processing' | 'delivered' | 'failed';

export interface OrderRecord {
  id: string; // e.g. MH1234567
  bundle: DataBundle;
  recipientPhone: string;
  network: NetworkId;
  paymentMethod: 'momo' | 'card' | 'bank';
  amountGhc: number;
  status: OrderStatus;
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
  | 'retail';

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
  targetPage?: 'data' | 'website' | 'services' | 'about';
}

export type ActivePage = 'home' | 'data' | 'website' | 'services' | 'about' | 'orders';
