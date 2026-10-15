import type { NetworkId } from '../types';
import { dataOrderPresentation } from './dataPurchasePresentation';

/** Presentation helpers for the Data checkout. The server still validates every recipient and payment. */

/** Local 10-digit number from typed or pasted input (024…, +233 24…, 233 24…). */
export function ghanaPhoneDigits(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length > 10) digits = '0' + digits.slice(3);
  return digits.slice(0, 10);
}

/** 024 123 4567 grouping, applied while typing so the number is easy to check aloud. */
export function formatGhanaPhone(input: string): string {
  const digits = ghanaPhoneDigits(input);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)].filter(Boolean).join(' ');
}

export function isCompleteGhanaPhone(input: string): boolean {
  return /^0\d{9}$/.test(ghanaPhoneDigits(input));
}

/** Browser connectivity failures carry no server answer; no Paystack window was opened. */
export function isConnectivityError(error: { message?: string; code?: string; name?: string }): boolean {
  return error.code === 'CHECKOUT_TIMEOUT' || error.name === 'TypeError' || /failed to fetch|network ?error|load failed|internet/i.test(error.message || '');
}

/**
 * The last payment this device opened, kept so a customer who leaves the payment screen
 * (MoMo prompt, app switch, reload) can come back and check it. It stores only the public
 * order reference and a product label; status always comes from the server lookup.
 */
export interface PendingCheckout {
  orderRef: string;
  label: string;
  network: NetworkId;
  startedAt: string;
}

const KEY = 'mystery_hub_pending_checkout';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) listener(); };

export function savePendingCheckout(entry: PendingCheckout): void {
  try { localStorage.setItem(KEY, JSON.stringify({orderRef:entry.orderRef,label:entry.label,network:entry.network,startedAt:entry.startedAt})); } catch { /* Storage can be unavailable; recovery is a convenience. */ }
  notify();
}

export function readPendingCheckout(now = Date.now()): PendingCheckout | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null') as PendingCheckout | null;
    if (!value || typeof value.orderRef !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value.orderRef)) return null;
    if(typeof value.label!=='string'||!value.label.trim()||value.label.length>160||!['mtn','telecel','airteltigo'].includes(value.network)||typeof value.startedAt!=='string')return null;
    if (!(now - Date.parse(value.startedAt) < MAX_AGE_MS) || Date.parse(value.startedAt)>now+60_000) { localStorage.removeItem(KEY); return null; }
    return {orderRef:value.orderRef,label:value.label,network:value.network,startedAt:value.startedAt};
  } catch {
    return null;
  }
}

export function clearPendingCheckout(orderRef?: string): void {
  try {
    if (orderRef && readPendingCheckout()?.orderRef !== orderRef) return;
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  notify();
}

export function subscribePendingCheckout(listener: () => void): () => void {
  listeners.add(listener);
  const storage = (event: StorageEvent) => { if (event.key === KEY) listener(); };
  window.addEventListener('storage', storage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', storage); };
}

/** Server states after which there is nothing left for this device to recover. */
export function isSettledForRecovery(status?: string): boolean {
  return ['paid', 'queued', 'submitted', 'processing', 'delivered', 'failed', 'refund_pending', 'refunded', 'expired'].includes(status || '');
}

/** Receipt record for an order found by public reference; the receipt keeps polling the server. */
export function orderRecordFromLookup(order: import('../services/apiClient').LookupOrderResponse['order']): import('../types').OrderRecord {
  const status = order.status;
  const presentation = dataOrderPresentation(status, order.manual_review, order.customer_resolution);
  return {
    id: order.public_reference,
    publicReference: order.public_reference,
    serverReference: order.public_reference,
    serverStatus: status,
    customerResolution: order.customer_resolution,
    serviceType: order.service_type,
    manualReview: order.manual_review,
    commercialPricing: order.commercial_pricing,
    statusMessage: status === 'refund_pending' || status === 'refunded' ? presentation.next : undefined,
    bundle: {
      id: 'lookup-bundle',
      network: order.network,
      dataAmount: order.bundle_size_snapshot,
      dataBytesValue: 0,
      validity: 'Standard',
      validityCategory: 'Daily',
      priceGhc: order.amount_ghc,
      description: order.product_name_snapshot,
    },
    recipientPhone: order.recipient_phone,
    network: order.network,
    paymentMethod: 'paystack',
    amountGhc: order.amount_ghc,
    status: status === 'delivered' ? 'delivered'
      : status === 'processing' || status === 'submitted' ? 'processing'
      : status === 'paid' || status === 'queued' ? 'placed'
      : status === 'failed' || status === 'refund_pending' || status === 'refunded' ? 'failed'
      : 'verifying',
    paymentReference: order.public_reference,
    createdAt: order.created_at,
    updatedAt: order.created_at,
  };
}
