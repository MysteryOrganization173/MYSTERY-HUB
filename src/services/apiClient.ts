/**
 * Frontend API Client Service
 * Connects React frontend with the Express backend endpoints.
 * Supports independent deployment (Netlify frontend + Render/Cloud backend via VITE_API_BASE_URL).
 */

import { SafePublicOrderDetails } from '../../server/types/orders';

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
}

export interface InitializePaymentResponse {
  success: boolean;
  orderRef: string;
  reference: string;
  accessCode?: string;
  authorizationUrl?: string;
  amountGhc: number;
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
  code?: string;
  existingOrderReference?: string;
  existingOrderStatus?: string;
}

export interface LookupOrderResponse {
  success: boolean;
  order: SafePublicOrderDetails;
  error?: string;
}

export async function initializePaymentOnServer(
  req: InitializePaymentRequest
): Promise<InitializePaymentResponse> {
  const url = `${API_BASE_URL}/api/payments/initialize`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  const data = await res.json();
  if (!res.ok) {
    const error: ApiError = new Error(data.message || data.error || 'Failed to initialize payment transaction.');
    error.code = data.code;
    error.existingOrderReference = data.existingOrderReference;
    error.existingOrderStatus = data.existingOrderStatus;
    throw error;
  }

  return data;
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

export async function lookupOrderOnServer(reference: string): Promise<LookupOrderResponse> {
  const url = `${API_BASE_URL}/api/orders/lookup/${encodeURIComponent(reference)}`;
  const res = await fetch(url, { method: 'GET' });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Order lookup failed.');
  }

  return data;
}
