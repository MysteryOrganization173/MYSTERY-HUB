import type { OrderRecord } from '../types';

export const POST_PURCHASE_INVITE_KEY = 'mh_earn_invite_v1';
export const POST_PURCHASE_INVITE_WINDOW_MS = 72 * 60 * 60 * 1000;
export const POST_PURCHASE_INVITE_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
type InviteMemory = { dismissed: string[]; snoozeUntil: number };
type InviteStorage = Pick<Storage, 'getItem' | 'setItem'>;

const eligibleServices = new Set(['data', 'airtime', 'instant_bundle', 'afa']);

/**
 * The invitation belongs only to a first-party Mystery Hub checkout that the server has confirmed as delivered.
 * Reference lookups, recovered payments, reseller storefront orders and anything uncertain stay invitation-free.
 */
export function postPurchaseInviteEligible(order: OrderRecord | null | undefined, now = Date.now()): boolean {
  if (!order || order.journey !== 'direct_checkout') return false;
  if (order.status !== 'delivered' || order.serverStatus !== 'delivered') return false;
  if (order.manualReview || order.customerResolution || order.paymentBasis) return false;
  if (!eligibleServices.has(order.serviceType || 'data')) return false;
  const created = Date.parse(order.createdAt);
  return Number.isFinite(created) && now - created >= 0 && now - created <= POST_PURCHASE_INVITE_WINDOW_MS;
}

function readMemory(storage?: InviteStorage | null): InviteMemory {
  try {
    const value = JSON.parse(storage?.getItem(POST_PURCHASE_INVITE_KEY) || 'null');
    return { dismissed: Array.isArray(value?.dismissed) ? value.dismissed.filter((item: unknown) => typeof item === 'string').slice(-20) : [], snoozeUntil: Number.isFinite(value?.snoozeUntil) ? value.snoozeUntil : 0 };
  } catch { return { dismissed: [], snoozeUntil: 0 }; }
}

export function postPurchaseInviteHidden(reference: string, storage?: InviteStorage | null, now = Date.now()) {
  const memory = readMemory(storage);
  return memory.dismissed.includes(reference) || memory.snoozeUntil > now;
}

/** Dismissal hides this order's invitation and quiets new ones on this device for two weeks. */
export function dismissPostPurchaseInvite(reference: string, storage?: InviteStorage | null, now = Date.now()) {
  const memory = readMemory(storage);
  try { storage?.setItem(POST_PURCHASE_INVITE_KEY, JSON.stringify({ dismissed: [...memory.dismissed.filter(item => item !== reference), reference].slice(-20), snoozeUntil: now + POST_PURCHASE_INVITE_SNOOZE_MS })); } catch { /* Storage can be unavailable; the in-memory dismissal still applies. */ }
}

export function safeLocalStorage(): InviteStorage | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

/** Short, order-aware invitation copy and the share topic that matches what was just bought. */
export function postPurchaseInviteCopy(serviceType: OrderRecord['serviceType']) {
  const service = serviceType || 'data';
  if (service === 'afa') return { heading: 'Know someone who needs MTN AFA?', topicId: 'afa' as const };
  if (service === 'airtime') return { heading: 'Know someone who needs airtime?', topicId: 'general' as const };
  return { heading: 'Know someone who needs data?', topicId: 'data' as const };
}
