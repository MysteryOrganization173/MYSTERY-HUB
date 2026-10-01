/**
 * Success Biz Hub API v2 Types & Schemas
 * Canonical supplier interface for Data Bundles
 */

export interface SbhServiceItem {
  id?: string;
  name?: string;
  slug?: string;
  kind?: string;
  enabled?: boolean;
  available?: boolean;
  [key: string]: unknown;
}

export interface SbhServicesResponse {
  status: string;
  data: SbhServiceItem[] | { services?: SbhServiceItem[] };
  message?: string;
}

export interface SbhWalletData {
  currency: string;
  balanceMinor?: string | number;
  availableMinor: string | number;
  heldMinor?: string | number;
  [key: string]: unknown;
}

export interface SbhWalletResponse {
  status: string;
  data: SbhWalletData;
  message?: string;
}

export interface SbhPackage {
  id?: string;
  sizeLabel: string; // e.g. "1GB", "10GB", "30GB"
  priceMinor: string | number; // Wholesale supplier cost in pesewas (decimal string or number)
  validity?: string;
  [key: string]: unknown;
}

export interface SbhOffer {
  id?: string;
  slug?: string;
  name: string;
  network: string; // e.g. "MTN", "Telecel", "AirtelTigo", "AT"
  kind: string; // Must be "data"
  packages: SbhPackage[];
  enabled?: boolean;
  [key: string]: unknown;
}

export interface SbhCatalogResponse {
  status: string;
  data: SbhOffer[] | { offers?: SbhOffer[] };
  message?: string;
}

export interface SbhBeneficiaryCheckRequest {
  phones: string[];
  offerSlug?: string;
  offerId?: string;
}

export interface SbhBeneficiaryCheckItem {
  phone?: string;
  eligible?: boolean;
  reason?: string;
  [key: string]: unknown;
}

export interface SbhBeneficiaryCheckResponse {
  status?: string;
  success?: boolean;
  data?:
    | SbhBeneficiaryCheckItem[]
    | { results?: SbhBeneficiaryCheckItem[]; eligible?: boolean; reason?: string }
    | { eligible?: boolean; reason?: string }
    | SbhBeneficiaryCheckItem;
  eligible?: boolean;
  message?: string;
  [key: string]: unknown;
}

export interface SbhCreateOrderRequest {
  msisdn: string;
  data: string; // Exact sizeLabel from catalog e.g. "1GB"
  offerSlug?: string;
  offerId?: string;
}

export interface SbhOrderData {
  id?: string;
  publicId?: string;
  status: 'pending' | 'processing' | 'processed' | 'failed' | string;
  msisdn?: string;
  data?: string;
  createdAt?: string;
  updatedAt?: string;
  failureReason?: string;
  [key: string]: unknown;
}

export interface SbhOrderResponse {
  status: string;
  data: SbhOrderData;
  message?: string;
}

export interface SbhCreateAirtimeRequest {
  network: 'mtn' | 'airteltigo' | 'at' | 'telecel' | string;
  phone: string;
  amountMajor: string; // e.g. "10"
}

export interface SbhAirtimeData {
  id?: string;
  publicId?: string;
  status: 'pending' | 'processing' | 'processed' | 'failed' | string;
  network?: string;
  phone?: string;
  amountMinor?: string | number; // Pesewas e.g. 1000
  chargeMinor?: string | number; // Pesewas e.g. 985
  createdAt?: string;
  updatedAt?: string;
  failureReason?: string;
  [key: string]: unknown;
}

export interface SbhAirtimeResponse {
  status: string;
  data: SbhAirtimeData;
  message?: string;
}

export interface SbhWebhookOrderItem {
  orderId?: string;
  publicId?: string;
  id?: string;
  status: 'pending' | 'processing' | 'processed' | 'failed' | string;
  msisdn?: string;
  failureReason?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface SbhWebhookPayload {
  event: 'order.status.updated' | 'webhook.test' | 'balance.low' | string;
  event_id?: string;
  eventId?: string;
  id?: string;
  timestamp?: string;
  data?: SbhWebhookOrderItem | {
    order?: SbhWebhookOrderItem;
    orders?: SbhWebhookOrderItem[];
    items?: SbhWebhookOrderItem[];
    balanceMinor?: string | number;
    availableMinor?: string | number;
  };
  orders?: SbhWebhookOrderItem[];
  items?: SbhWebhookOrderItem[];
  [key: string]: unknown;
}

// ==========================================
// Instant Bundles (Success Biz Hub API v2)
// ==========================================

export interface SbhInstantBundlePackage {
  id: string;
  name: string;
  network: string; // e.g. "MTN", "Telecel", "AirtelTigo", "AT"
  isFlexi?: boolean;
  mode?: 'fixed' | 'flexi' | string;
  priceMinor?: string | number; // Wholesale supplier cost in pesewas (for fixed packages)
  payableRatio?: number; // Wholesale payable ratio (for flexi packages e.g. 0.95)
  minAmountMajor?: number | string;
  maxAmountMajor?: number | string;
  dataAmount?: string;
  validity?: string;
  category?: string;
  enabled?: boolean;
  available?: boolean;
  [key: string]: unknown;
}

export interface SbhInstantBundlesResponse {
  success?: boolean;
  status?: string;
  data:
    | SbhInstantBundlePackage[]
    | { packages?: SbhInstantBundlePackage[]; products?: SbhInstantBundlePackage[]; items?: SbhInstantBundlePackage[] };
  message?: string;
}

export interface SbhCreateInstantBundleRequest {
  packageId: string;
  phone: string;
  amountMajor?: number | string;
}

export interface SbhInstantBundleOrderData {
  id?: string;
  orderId?: string;
  publicId?: string;
  status: 'pending' | 'processing' | 'processed' | 'delivered' | 'failed' | string;
  packageId?: string;
  phone?: string;
  msisdn?: string;
  amountMajor?: string | number;
  amountMinor?: string | number;
  chargeMinor?: string | number;
  createdAt?: string;
  updatedAt?: string;
  failureReason?: string;
  [key: string]: unknown;
}

export interface SbhInstantBundleResponse {
  success?: boolean;
  status?: string;
  data: SbhInstantBundleOrderData;
  message?: string;
}
