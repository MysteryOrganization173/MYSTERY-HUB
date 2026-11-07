import { API_BASE_URL } from './apiClient';
import { getOrGenerateVisitorKey, getStoredReferralCode } from '../utils/referralCapture';
import type { CheckerConfig, CheckerProductKey, CheckerReceipt } from '../../shared/resultsCheckers';

export async function getCheckerConfig(): Promise<CheckerConfig> {
  const res = await fetch(`${API_BASE_URL}/api/results-checkers/config`, { cache: 'no-store' });
  const data = await res.json().catch(() => null);
  if (!data || !Array.isArray(data.products)) throw new Error('Results checkers are temporarily unavailable.');
  return data;
}

/** The amount is decided on the server. Only the choice is sent. */
export async function initializeCheckerPayment(input: { product: CheckerProductKey; qty: number; customerEmail: string; phone: string }, token: string): Promise<{ authorizationUrl: string; orderRef: string; reference: string; isSimulated?: boolean }> {
  const res = await fetch(`${API_BASE_URL}/api/results-checkers/payments/initialize`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...input, visitorKey: getOrGenerateVisitorKey(), referralCode: getStoredReferralCode() || undefined }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.authorizationUrl) throw Object.assign(new Error(data.error || 'Unable to start your purchase. Please try again.'), { field: data.field, status: res.status });
  return data;
}

export async function getCheckerReceipt(reference: string, token: string, signal?: AbortSignal): Promise<CheckerReceipt> {
  const res = await fetch(`${API_BASE_URL}/api/results-checkers/orders/${encodeURIComponent(reference)}/receipt`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'We could not open this receipt just now. Please try again.');
  return data;
}
