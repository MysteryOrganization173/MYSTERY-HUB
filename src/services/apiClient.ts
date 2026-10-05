/**
 * Frontend API Client Service
 * Connects React frontend with the Express backend endpoints.
 * Supports independent deployment (Netlify frontend + Render/Cloud backend via VITE_API_BASE_URL).
 */

import { SafePublicOrderDetails, AdminOrderDetails } from '../../server/types/orders';
import { SafeUserProfile, WaitlistChannel, AuthSessionResponse, WaitlistRecord, UserStatus } from '../../server/types/auth';
import { MarketplaceProduct } from '../types';

export interface AdminMarketplaceMetrics {
  needsReview?: number; physical?: number; digital?: number; service?: number; newInquiries?: number;
  total: number;
  published: number;
  drafts: number;
  featured: number;
  archived: number;
}

const rawBaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.VITE_API_BASE_URL) ||
  '';
export const API_BASE_URL = typeof rawBaseUrl === 'string' ? rawBaseUrl.replace(/\/$/, '') : '';

export interface InitializePaymentRequest {
  productId: string;
  recipientPhone: string;
  customerEmail?: string;
  customerName?: string;
  serviceType?: 'data' | 'airtime' | 'instant_bundle';
  network?: string;
  amount?: number;
}

export interface InitializeMarketplacePaymentRequest extends Omit<InitializePaymentRequest, 'serviceType' | 'recipientPhone'> {
  serviceType: 'marketplace';
  phone: string;
  customerEmail: string;
  productSlug?: string;
  variantId?: string;
  fulfilmentMethod: NonNullable<MarketplaceProduct['fulfilmentMode']>;
  fulfilmentIdentifier?: string;
  pickupLocationId?: string;
  deliveryCity?: string;
  deliveryArea?: string;
  deliveryLandmark?: string;
  deliveryNote?: string;
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
  paymentProcessingFeeGhc?: number;
  paymentProcessingFeePesewas?: number;
  estimatedTotalGhc?: number;
  estimatedTotalPesewas?: number;
  networkReferencePriceGhc?: number;
  savingsOnProductGhc?: number;
  availability: 'in_stock' | 'out_of_stock';
  category?: string;
  description?: string;
}

export interface InstantBundlesCatalogResponse {
  success: boolean;
  available: boolean;
  reason?: string;
  products: PublicInstantBundle[];
}

export interface InitializePaymentResponse {
  success: boolean;
  orderRef: string;
  reference: string;
  accessCode?: string;
  authorizationUrl?: string;
  amountGhc: number;
  faceValueGhc?: number;
  serviceFeeGhc?: number;
  amountPesewas: number;
  currency: 'GHS';
  isSimulated?: boolean;
  error?: string;
}

export interface VerifyPaymentResponse {
  verified: boolean;
  order: SafePublicOrderDetails;
  message?: string;
  error?: string;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  existingOrderReference?: string;
  existingOrderStatus?: string;
}

export interface LookupOrderResponse {
  success: boolean;
  order: SafePublicOrderDetails;
  error?: string;
}

export interface RegisterRequest {
  name: string;
  identifier: string;
  password: string;
  rememberMe?: boolean;
  referralCode?: string;
  visitorKey?: string;
  landingPath?: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
  rememberMe?: boolean;
}

export interface JoinWaitlistRequest {
  serviceKey: string;
  serviceTitle: string;
  channel: WaitlistChannel;
  contact: string;
  sourcePage?: string;
}

export interface JoinWaitlistResponse {
  success: boolean;
  alreadyJoined: boolean;
  message: string;
  record: {
    id: string;
    serviceKey: string;
    serviceTitle: string;
    channel: string;
    status: string;
    createdAt: string;
  };
  error?: string;
}

export async function initializePaymentOnServer(
  req: (InitializePaymentRequest | InitializeMarketplacePaymentRequest) & { referralCode?: string; visitorKey?: string },
  sessionToken?: string | null,
  timeoutMs = 35000
): Promise<InitializePaymentResponse> {
  const url = `${API_BASE_URL}/api/payments/initialize`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  const visitorKey =
    req.visitorKey ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('mh_visitor_key') || sessionStorage.getItem('mh_visitor_key')
      : undefined);
  const referralCode =
    req.referralCode ||
    (typeof window !== 'undefined'
      ? sessionStorage.getItem('mh_referral_code') || localStorage.getItem('mh_referral_code')
      : undefined);

  if (visitorKey) {
    headers['x-visitor-key'] = visitorKey;
  }

  const payload = {
    ...req,
    visitorKey: visitorKey || undefined,
    referralCode: referralCode || undefined,
  };

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutHandle);

    const data = await res.json();
    if (!res.ok) {
      const error: ApiError = new Error(data.message || data.error || 'Failed to initialize payment transaction.');
      error.code = data.code;
      error.existingOrderReference = data.existingOrderReference;
      error.existingOrderStatus = data.existingOrderStatus;
      throw error;
    }

    return data;
  } catch (err: unknown) {
    clearTimeout(timeoutHandle);
    if (err instanceof Error && err.name === 'AbortError') {
      const timeoutError: ApiError = new Error('Checkout is taking longer than expected. Please try again.');
      timeoutError.code = 'CHECKOUT_TIMEOUT';
      throw timeoutError;
    }
    throw err;
  }
}

export async function verifyPaymentOnServer(reference: string): Promise<VerifyPaymentResponse> {
  const url = `${API_BASE_URL}/api/payments/verify/${encodeURIComponent(reference)}`;
  const res = await fetch(url, { method: 'GET' });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to verify payment with server.');
  }

  return data;
}

export interface CancelPaymentResponse {
  success: boolean;
  cancelled: boolean;
  alreadyPaid: boolean;
  order?: SafePublicOrderDetails;
  error?: string;
}

export async function cancelPaymentOnServer(orderRef: string): Promise<CancelPaymentResponse> {
  const url = `${API_BASE_URL}/api/payments/cancel`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderRef }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to cancel payment.');
  }

  return data;
}

export async function lookupOrderOnServer(reference: string): Promise<LookupOrderResponse> {
  const url = `${API_BASE_URL}/api/orders/lookup/${encodeURIComponent(reference)}`;
  const res = await fetch(url, { method: 'GET' });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Order lookup failed.');
  }

  return data;
}

// ==========================================
// REAL SERVER AUTHENTICATION CLIENT METHODS
// ==========================================

export async function registerOnServer(req: RegisterRequest): Promise<AuthSessionResponse> {
  const url = `${API_BASE_URL}/api/auth/register`;
  const visitorKey =
    req.visitorKey ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('mh_visitor_key') || sessionStorage.getItem('mh_visitor_key')
      : undefined);
  const referralCode =
    req.referralCode ||
    (typeof window !== 'undefined'
      ? sessionStorage.getItem('mh_referral_code') || localStorage.getItem('mh_referral_code')
      : undefined);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (visitorKey) {
    headers['x-visitor-key'] = visitorKey;
  }

  const payload = {
    ...req,
    visitorKey: visitorKey || undefined,
    referralCode: referralCode || undefined,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'Registration failed.'), { status: res.status, code: data.code });
  }

  return data;
}

export async function loginOnServer(req: LoginRequest): Promise<AuthSessionResponse> {
  const url = `${API_BASE_URL}/api/auth/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Login failed.');
  }

  return data;
}

export async function getMeOnServer(token: string): Promise<{ success: boolean; user: SafeUserProfile }> {
  const url = `${API_BASE_URL}/api/auth/me`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'Failed to authenticate session.'), { status: res.status, code: data.code });
  }

  return data;
}

export async function getAccountOrdersOnServer(
  token: string,
  limit?: number
): Promise<{ success: boolean; orders: SafePublicOrderDetails[] }> {
  const query = limit ? `?limit=${limit}` : '';
  const url = `${API_BASE_URL}/api/account/orders${query}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch account orders.');
  }

  return data;
}

export async function logoutOnServer(token?: string | null): Promise<void> {
  if (!token) return;
  try {
    const url = `${API_BASE_URL}/api/auth/logout`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  } catch (err) {
    console.warn('Logout request error:', err);
  }
}

// ==========================================
// REAL WAITLIST CLIENT METHODS
// ==========================================

export async function joinWaitlistOnServer(
  req: JoinWaitlistRequest,
  sessionToken?: string | null
): Promise<JoinWaitlistResponse> {
  const url = `${API_BASE_URL}/api/waitlist/join`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(req),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to submit waitlist registration.');
  }

  return data;
}

export async function getMyOrdersOnServer(token: string): Promise<{ success: boolean; orders: SafePublicOrderDetails[] }> {
  const url = `${API_BASE_URL}/api/orders/my-orders`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch customer orders.');
  }

  return data;
}

// ==========================================
// ADMIN V1 API CLIENT METHODS
// ==========================================

export interface AdminOverviewMetrics {
  today: {
    ordersCount: number;
    revenueMinor: number;
    revenueGhc: number;
    deliveredCount: number;
    processingCount: number;
    attentionCount: number;
  };
  last7Days: {
    ordersCount: number;
    revenueMinor: number;
    revenueGhc: number;
    dataOrdersCount: number;
    airtimeOrdersCount: number;
  };
  allTime: {
    ordersCount: number;
    revenueMinor: number;
    revenueGhc: number;
    supplierCostMinor: number;
    supplierCostGhc: number;
    estimatedGrossMarginGhc: number | null;
    manualReviewPendingCount: number;
    totalCustomers: number;
    totalWaitlist: number;
    pendingWaitlist: number;
  };
  supplier: {
    status: 'connected' | 'unconfigured' | 'error';
    balanceGhc: number | null;
    isLowBalance: boolean;
    fulfilmentEnabled: boolean;
  };
  waitlistGrouped: {
    serviceCounts: Record<string, number>;
    channelCounts: Record<string, number>;
    totalPending: number;
    totalAll: number;
  };
}

export interface AdminOrdersResponse {
  success: boolean;
  orders: AdminOrderDetails[];
  pagination: {
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  };
}

export interface AdminWaitlistResponse {
  success: boolean;
  entries: WaitlistRecord[];
  stats: {
    serviceCounts: Record<string, number>;
    channelCounts: Record<string, number>;
    totalPending: number;
    totalAll: number;
  };
  pagination: {
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  };
}

export interface AdminCustomerProfile extends SafeUserProfile {
  orderCount: number;
  totalSpentGhc: number;
}

export interface AdminUsersResponse {
  success: boolean;
  users: AdminCustomerProfile[];
  pagination: {
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  };
}

export interface AdminSystemStatus {
  environment: string;
  nodeVersion: string;
  uptimeSeconds: number;
  components: {
    apiServer: { status: string; label: string };
    database: { status: string; type: string };
    paystack: { status: string; mode: string; currency: string };
    successBizHub: {
      status: string;
      walletBalanceGhc: number | null;
      isLowBalance: boolean;
      lowBalanceThresholdGhc: number;
    };
    geminiAi: { status: string; model: string };
    fulfilmentPipeline: { status: string; autoDispatch: boolean; uncertainSubmissionCount?: number };
  };
}

export async function getAdminOverviewOnServer(token: string): Promise<{ success: boolean; metrics: AdminOverviewMetrics }> {
  const url = `${API_BASE_URL}/api/admin/overview`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load admin overview.');
  return data;
}

export async function getAdminOrdersOnServer(
  token: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<AdminOrdersResponse> {
  const searchParams = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== '') searchParams.set(key, String(val));
  }
  const url = `${API_BASE_URL}/api/admin/orders?${searchParams.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to search orders.');
  return data;
}

export async function getAdminOrderOnServer(token: string, reference: string): Promise<{ success: boolean; order: AdminOrderDetails }> {
  const url = `${API_BASE_URL}/api/admin/orders/${encodeURIComponent(reference)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch order.');
  return data;
}

export async function refreshAdminOrderOnServer(token: string, reference: string): Promise<{ success: boolean; order: AdminOrderDetails; message: string }> {
  const url = `${API_BASE_URL}/api/admin/orders/${encodeURIComponent(reference)}/refresh`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to refresh supplier status.');
  return data;
}

export async function updateAdminOrderReviewOnServer(
  token: string,
  reference: string,
  body: { manualReview?: boolean; adminNote?: string | null }
): Promise<{ success: boolean; order: AdminOrderDetails; message: string }> {
  const url = `${API_BASE_URL}/api/admin/orders/${encodeURIComponent(reference)}/review`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update order review details.');
  return data;
}

export async function updateAdminOrderStatusOnServer(
  token: string,
  reference: string,
  body: { status?: string; marketplaceStatus?: string; adminNote?: string }
): Promise<{ success: boolean; order: AdminOrderDetails; message: string }> {
  const url = `${API_BASE_URL}/api/admin/orders/${encodeURIComponent(reference)}/status`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update order status.');
  return data;
}

export async function submitMarketplaceInquiry(payload: {
  productId: string;
  productName: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  inquiryType?: string;
  message?: string;
  budget?: string;
}): Promise<{ success: boolean; message: string }> {
  const url = `${API_BASE_URL}/api/marketplace/inquiries`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to submit inquiry.');
  return data;
}

export async function closeAdminTestOrderOnServer(
  token: string,
  reference: string,
  options: { confirmPaidTestOrder?: boolean; reason?: string } = {}
): Promise<{ success: boolean; order: AdminOrderDetails; message: string }> {
  const url = `${API_BASE_URL}/api/admin/orders/${encodeURIComponent(reference)}/close-test-order`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(options),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to close test order.');
  return data;
}

export async function getAdminWaitlistOnServer(
  token: string,
  params: Record<string, string | number | undefined> = {}
): Promise<AdminWaitlistResponse> {
  const searchParams = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== '') searchParams.set(key, String(val));
  }
  const url = `${API_BASE_URL}/api/admin/waitlist?${searchParams.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load waitlist registrations.');
  return data;
}

export async function updateAdminWaitlistOnServer(
  token: string,
  id: string,
  body: { status: string; adminNote?: string }
): Promise<{ success: boolean; entry: WaitlistRecord; message: string }> {
  const url = `${API_BASE_URL}/api/admin/waitlist/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update waitlist entry.');
  return data;
}

export async function downloadAdminWaitlistCsvOnServer(
  token: string,
  params: Record<string, string | number | undefined> = {}
): Promise<Blob> {
  const searchParams = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== '') searchParams.set(key, String(val));
  }
  const url = `${API_BASE_URL}/api/admin/waitlist-export?${searchParams.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to export waitlist CSV');
  return res.blob();
}

export async function getAdminUsersOnServer(
  token: string,
  params: Record<string, string | number | undefined> = {}
): Promise<AdminUsersResponse> {
  const searchParams = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== '') searchParams.set(key, String(val));
  }
  const url = `${API_BASE_URL}/api/admin/users?${searchParams.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to list customer accounts.');
  return data;
}

export async function getAdminUserDetailsOnServer(
  token: string,
  userId: string
): Promise<{ success: boolean; user: SafeUserProfile; orders: AdminOrderDetails[]; waitlist: WaitlistRecord[]; earn: import('../../server/types/adminEarn').EarnCustomerSummary | null }> {
  const url = `${API_BASE_URL}/api/admin/users/${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to retrieve customer details.');
  return data;
}

export async function updateAdminUserStatusOnServer(
  token: string,
  userId: string,
  status: UserStatus
): Promise<{ success: boolean; user: SafeUserProfile; message: string }> {
  const url = `${API_BASE_URL}/api/admin/users/${encodeURIComponent(userId)}/status`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update user account status.');
  return data;
}

export async function getAdminSystemOnServer(token: string): Promise<{ success: boolean; system: AdminSystemStatus }> {
  const url = `${API_BASE_URL}/api/admin/system`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to check system status.');
  return data;
}

/**
 * Public Instant Bundles Catalogue Discovery
 * Fetches live sellable Instant Bundles with server-calculated retail prices.
 */
export async function getInstantBundlesOnServer(timeoutMs = 15000): Promise<InstantBundlesCatalogResponse> {
  const url = `${API_BASE_URL}/api/instant-bundles`;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutHandle);
    const data = await res.json();
    return data;
  } catch (err: unknown) {
    clearTimeout(timeoutHandle);
    return {
      success: false,
      available: false,
      reason:
        err instanceof Error && err.name === 'AbortError'
          ? 'Instant bundle catalogue request timed out. Please try again.'
          : 'Unable to connect to Instant Bundles service.',
      products: [],
    };
  }
}

// ==========================================
// PUBLIC MARKETPLACE CATALOG CLIENT METHODS
// ==========================================

export async function getPublicMarketplaceProducts(params?: {
  category?: string;
  search?: string;
  featured?: boolean;
}): Promise<{ success: boolean; products: MarketplaceProduct[]; error?: string }> {
  const query = new URLSearchParams();
  if (params?.category && params.category !== 'all') query.set('category', params.category);
  if (params?.search) query.set('search', params.search);
  if (params?.featured !== undefined) query.set('featured', String(params.featured));

  const url = `${API_BASE_URL}/api/marketplace/products${query.toString() ? `?${query.toString()}` : ''}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch marketplace products');
    return data;
  } catch (err) {
    console.error('getPublicMarketplaceProducts error:', err);
    return {
      success: false,
      products: [],
      error: err instanceof Error ? err.message : 'Unable to load marketplace products.',
    };
  }
}

export async function getPublicMarketplaceProductBySlug(slug: string): Promise<{
  success: boolean;
  product?: MarketplaceProduct;
  error?: string;
}> {
  const url = `${API_BASE_URL}/api/marketplace/products/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch product');
    return data;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Product not found.',
    };
  }
}

// ==========================================
// ADMIN MARKETPLACE MANAGEMENT CLIENT METHODS
// ==========================================

export async function getAdminMarketplaceProducts(
  token: string,
  params?: { category?: string; status?: string; search?: string; productKind?: string }
): Promise<{ success: boolean; products: MarketplaceProduct[]; metrics: AdminMarketplaceMetrics }> {
  const query = new URLSearchParams();
  if (params?.category && params.category !== 'all') query.set('category', params.category);
  if (params?.status && params.status !== 'all') query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  if (params?.productKind) query.set('productKind',params.productKind);

  const url = `${API_BASE_URL}/api/admin/marketplace/products${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch admin marketplace products.');
  return data;
}

export async function createAdminMarketplaceProduct(
  token: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; product: MarketplaceProduct; message?: string }> {
  const url = `${API_BASE_URL}/api/admin/marketplace/products`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create product.');
  return data;
}

export async function updateAdminMarketplaceProduct(
  token: string,
  id: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; product: MarketplaceProduct; message?: string }> {
  const url = `${API_BASE_URL}/api/admin/marketplace/products/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update product.');
  return data;
}

export async function publishAdminMarketplaceProduct(
  token: string,
  id: string,
  confirmWarnings = false
): Promise<{ success: boolean; product: MarketplaceProduct; message?: string }> {
  const url = `${API_BASE_URL}/api/admin/marketplace/products/${encodeURIComponent(id)}/publish`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' },
    body: JSON.stringify({confirmWarnings}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to publish product.');
  return data;
}

export async function unpublishAdminMarketplaceProduct(
  token: string,
  id: string
): Promise<{ success: boolean; product: MarketplaceProduct; message?: string }> {
  const url = `${API_BASE_URL}/api/admin/marketplace/products/${encodeURIComponent(id)}/unpublish`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to unpublish product.');
  return data;
}

export async function featureAdminMarketplaceProduct(
  token: string,
  id: string
): Promise<{ success: boolean; product: MarketplaceProduct; message?: string }> {
  const url = `${API_BASE_URL}/api/admin/marketplace/products/${encodeURIComponent(id)}/feature`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to feature product.');
  return data;
}

export async function unfeatureAdminMarketplaceProduct(
  token: string,
  id: string
): Promise<{ success: boolean; product: MarketplaceProduct; message?: string }> {
  const url = `${API_BASE_URL}/api/admin/marketplace/products/${encodeURIComponent(id)}/unfeature`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to unfeature product.');
  return data;
}

export async function archiveAdminMarketplaceProduct(
  token: string,
  id: string
): Promise<{ success: boolean; product: MarketplaceProduct; message?: string }> {
  const url = `${API_BASE_URL}/api/admin/marketplace/products/${encodeURIComponent(id)}/archive`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to archive product.');
  return data;
}

export async function importMarketplaceProductWithAi(
  token: string,
  advertText: string
): Promise<{
  success: boolean;
  extraction: import('../../server/services/marketplaceAiImporter').MarketplaceAiExtractionResult;
  message?: string;
}> {
  const url = `${API_BASE_URL}/api/admin/marketplace/ai-import`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ advertText }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to parse supplier advert with AI.');
  return data;
}

// ==========================================
// WEBSITE BUILDER CLIENT METHODS
// ==========================================

import type {
  WebsiteSiteRecord,
  PublicWebsiteSite,
  SiteContent,
  SiteSettings,
} from '../types/index.js';

export async function createWebsiteOnServer(
  token: string,
  input: {
    templateId: string;
    name?: string;
    content?: Partial<SiteContent>;
    settings?: Partial<SiteSettings>;
  }
): Promise<{ success: boolean; site: WebsiteSiteRecord; alreadyExists?: boolean }> {
  const url = `${API_BASE_URL}/api/websites`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create website project.');
  return data;
}

export async function getMyWebsitesOnServer(
  token: string
): Promise<{ success: boolean; sites: WebsiteSiteRecord[] }> {
  const url = `${API_BASE_URL}/api/websites/mine`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load your websites.');
  return data;
}

export async function getWebsiteByIdOnServer(
  token: string,
  id: string
): Promise<{ success: boolean; site: WebsiteSiteRecord }> {
  const url = `${API_BASE_URL}/api/websites/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load website project.');
  return data;
}

export async function updateWebsiteOnServer(
  token: string,
  id: string,
  input: {
    name?: string;
    content?: Partial<SiteContent>;
    settings?: Partial<SiteSettings>;
  }
): Promise<{ success: boolean; site: WebsiteSiteRecord }> {
  const url = `${API_BASE_URL}/api/websites/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save website changes.');
  return data;
}

export async function publishWebsiteOnServer(
  token: string,
  id: string
): Promise<{ success: boolean; site: WebsiteSiteRecord; publicUrl: string }> {
  const url = `${API_BASE_URL}/api/websites/${encodeURIComponent(id)}/publish`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to publish website.');
  return data;
}

export async function unpublishWebsiteOnServer(
  token: string,
  id: string
): Promise<{ success: boolean; site: WebsiteSiteRecord }> {
  const url = `${API_BASE_URL}/api/websites/${encodeURIComponent(id)}/unpublish`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to unpublish website.');
  return data;
}

export async function getPublicSiteBySlug(
  slug: string
): Promise<{ success: boolean; site: PublicWebsiteSite }> {
  const url = `${API_BASE_URL}/api/public/sites/${encodeURIComponent(slug)}`;
  const res = await fetch(url, { method: 'GET' });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Website not found.');
  return data;
}

export async function deleteWebsiteOnServer(
  token: string,
  id: string
): Promise<{ success: boolean; message?: string }> {
  const url = `${API_BASE_URL}/api/websites/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete website.');
  return data;
}

// ==========================================
// MYSTERY EARN: REFERRAL API CLIENT
// ==========================================

export interface ReferralCaptureRequest {
  code: string;
  captureId?: string;
  visitorKey?: string | null;
  landingPath?: string | null;
}

export interface ReferralCaptureResponse {
  success: boolean;
  valid: boolean;
  clickRecorded: boolean;
  attributionRecorded: boolean;
  code?: string;
  referrerUserId?: string;
  reason?: string;
  error?: string;
}

export interface ReferralSummaryResponse {
  success: boolean;
  summary: {
    code: string;
    shareUrl: string;
    isEnabled: boolean;
    clicksCount: number;
    rawClicksCount: number;
    uniqueVisitorsCount: number;
    referredCustomersCount: number;
    networkLevel1Count?: number;
    networkLevel2Count?: number;
    networkLevel3Count?: number;
    networkTotalCount?: number;
    pendingRewardsMinor: number;
    pendingRewardsGhc: number;
    approvedRewardsMinor: number;
    approvedRewardsGhc: number;
    totalRewardsMinor: number;
    totalRewardsGhc: number;
  };
  error?: string;
}

export interface RewardLedgerItem {
  reward_stage?: 'standard' | 'acquisition' | 'recurring';
  id: string;
  service_type: 'data' | 'airtime' | 'instant_bundle' | 'marketplace' | 'website_builder' | 'manual_adjustment';
  network_level?: number;
  level_label?: string;
  amount_minor: number;
  amount_ghc: number;
  currency: 'GHS';
  status: 'pending' | 'approved' | 'rejected' | 'reversed';
  reason: string;
  created_at: string;
  approved_at: string | null;
  reversed_at: string | null;
}

export interface RewardLedgerResponse {
  success: boolean;
  ledger: RewardLedgerItem[];
  error?: string;
}

export interface PublicRewardRule {
  purchase_stage?: 'any' | 'acquisition' | 'recurring';
  id: string;
  service_type: string;
  product_key: string | null;
  network: string | null;
  reward_type: 'fixed_minor' | 'percent_bps';
  reward_minor: number | null;
  reward_percent_bps: number | null;
  enabled: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface RewardRulesResponse {
  success: boolean;
  rules: PublicRewardRule[];
  error?: string;
}

/**
 * Dispatches non-blocking referral code capture on visitor arrival
 */
export async function captureReferralOnServer(
  payload: ReferralCaptureRequest,
  token?: string
): Promise<ReferralCaptureResponse> {
  const url = `${API_BASE_URL}/api/referrals/capture`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (payload.visitorKey) {
    headers['x-visitor-key'] = payload.visitorKey;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    return {
      success: false,
      valid: false,
      clickRecorded: false,
      attributionRecorded: false,
      error: data.error || 'Failed to capture referral',
    };
  }
  return data;
}

/**
 * Loads authenticated user's lifetime referral profile, statistics, and rewards
 */
export async function getMyReferralSummary(token: string): Promise<ReferralSummaryResponse> {
  const url = `${API_BASE_URL}/api/referrals/summary`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load referral summary.');
  return data;
}

/**
 * Loads authenticated user's immutable reward ledger entries
 */
export async function getMyRewardLedger(
  token: string,
  limit = 50
): Promise<RewardLedgerResponse> {
  const url = `${API_BASE_URL}/api/referrals/ledger?limit=${encodeURIComponent(limit)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load reward ledger.');
  return data;
}

/**
 * Loads active reward opportunities and transparent rules
 */
export async function getActiveRewardRules(): Promise<RewardRulesResponse> {
  const url = `${API_BASE_URL}/api/referrals/rules`;
  const res = await fetch(url, { method: 'GET' });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load reward rules.');
  return data;
}

/**
 * Authoritative AFA Service Configuration from backend
 */
export interface AfaConfigResponse {
  success?: boolean;
  serviceId?: string;
  title?: string;
  tagline?: string;
  retailPriceGhc?: number;
  retailPricePesewas?: number;
  available?: boolean;
  error?: string;
}

export async function getAfaConfigOnServer(timeoutMs = 8000): Promise<AfaConfigResponse | null> {
  const url = `${API_BASE_URL}/api/afa/config`;
  try {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutHandle);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    return await res.json();
  } catch {
    return null;
  }
}






// Admin Mystery Earn: server-derived metrics and bounded read-only inspection.
export type { EarnOverview, EarnReferrer, EarnDetail, EarnLedgerRow, EarnCustomerSummary } from '../../server/types/adminEarn';
export type AdminEarnRule = ReturnType<typeof import('../../server/services/adminEarnControls').describeAdminRule>;
export type AdminEarnPolicy = Awaited<ReturnType<typeof import('../../server/services/adminEarnControls').recommendedPolicyStatus>>;
export async function adminEarnRequest<T>(token: string, path: string, params: Record<string,string|number|boolean|undefined> = {}, payload?: unknown, method = 'GET', signal?: AbortSignal): Promise<T> {
  const search = new URLSearchParams(); for (const [key,value] of Object.entries(params)) if(value!==undefined&&value!=='')search.set(key,String(value));
  const response = await fetch(`${API_BASE_URL}/api/admin/referrals/${path}?${search}`, {method,signal,
    headers:{Authorization:`Bearer ${token}`,...(payload!==undefined?{'Content-Type':'application/json'}:{})},
    ...(payload!==undefined?{body:JSON.stringify(payload)}:{})});
  const result=await response.json(); if(!response.ok)throw new Error(result.error||'Mystery Earn request failed.'); return result;
}

export interface ProfileUpdateRequest { name?: string; email?: string | null; phone?: string | null; currentPassword?: string; }
async function accountRequest<T>(token: string, path: string, method: string, body: unknown): Promise<T> {
  const response = await fetch(API_BASE_URL + '/api/' + path, { method, cache: 'no-store', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent('mystery-auth-invalid', { detail: { token } }));
    if (data.code === 'PASSWORD_CHANGE_REQUIRED') window.dispatchEvent(new Event('mystery-auth-refresh'));
    throw Object.assign(new Error(data.error || 'Account action failed.'), { status: response.status, code: data.code });
  }
  return data;
}
export const changePasswordOnServer = (token: string, body: { currentPassword?: string; newPassword: string }) => accountRequest<AuthSessionResponse>(token, 'auth/change-password', 'POST', body);
export const updateProfileOnServer = (token: string, body: ProfileUpdateRequest) => accountRequest<{ success: boolean; user: SafeUserProfile }>(token, 'auth/profile', 'PATCH', body);
export const revokeOwnSessionsOnServer = (token: string) => accountRequest<{ success: boolean }>(token, 'auth/logout-all', 'POST', {});
export const resetAdminCustomerPassword = (token: string, id: string) => accountRequest<{ success: boolean; temporaryPassword: string; user: SafeUserProfile }>(token, 'admin/users/' + encodeURIComponent(id) + '/reset-password', 'POST', { confirm: true });
export const revokeAdminCustomerSessions = (token: string, id: string) => accountRequest<{ success: boolean }>(token, 'admin/users/' + encodeURIComponent(id) + '/revoke-sessions', 'POST', { confirm: true });
export const updateAdminCustomerProfile = (token: string, id: string, body: ProfileUpdateRequest) => accountRequest<{ success: boolean; user: SafeUserProfile }>(token, 'admin/users/' + encodeURIComponent(id) + '/profile', 'PATCH', body);
