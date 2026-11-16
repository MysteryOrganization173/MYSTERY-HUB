import type { NotificationInboxEntry, NotificationCategory } from '../services/customerNotifications';
import type { ActivePage } from '../types';

/**
 * 3.4.1 Notification Center presentation, kept free of React so it is testable. Every row is a real record from the
 * account's own inbox; nothing here counts, marks or implies that anything was read or delivered.
 */
export const CATEGORY_LABEL: Record<NotificationCategory, string> = { orders: 'Order update', announcements: 'Announcement', account: 'Account' };

/** "Just now", "5 min ago", "3 h ago", "Yesterday", then a date. Never in the future. */
export function notificationTime(iso: string, now = Date.now()): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return '';
  const minutes = Math.max(0, Math.floor((now - at) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const day = new Date(at), today = new Date(now), yesterday = new Date(now - 86_400_000);
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(day.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
}

/** The page an announcement may open: only the approved pages, as the server, payload and service worker enforce. */
const ANNOUNCEMENT_PAGES: Record<string, ActivePage> = { '/data': 'data', '/services': 'services', '/marketplace': 'marketplace', '/earn': 'earn' };

export type NotificationTarget =
  | { kind: 'order'; reference: string }   // the account's own order, opened with the account's own order list
  | { kind: 'orders' }                     // an order update without a readable reference: My Orders
  | { kind: 'page'; page: ActivePage }     // an announcement's approved page
  | { kind: 'none' };                      // account messages open nothing

export function notificationTarget(item: Pick<NotificationInboxEntry, 'category' | 'orderReference' | 'opens' | 'destination'>): NotificationTarget {
  if (item.category === 'orders' || item.destination === '/orders') return item.orderReference ? { kind: 'order', reference: item.orderReference } : { kind: 'orders' };
  if (item.category === 'announcements') { const page = item.opens ? ANNOUNCEMENT_PAGES[item.opens] : undefined; return page ? { kind: 'page', page } : { kind: 'page', page: 'home' }; }
  return { kind: 'none' };
}

/** Pages of 25, as the server sends them; another page is offered only when a full page came back. */
export const INBOX_PAGE = 25;
export function mergeInboxPage(current: NotificationInboxEntry[], next: NotificationInboxEntry[]): NotificationInboxEntry[] {
  const seen = new Set(current.map(item => item.id));
  return [...current, ...next.filter(item => !seen.has(item.id))];
}
