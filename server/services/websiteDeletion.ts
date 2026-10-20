import { getPool } from '../db/connection.js';
import { websiteDatabase } from '../db/websiteTransaction.js';
import { WebsiteStore } from '../db/websiteStore.js';
import { FinanceStore } from '../db/financeStore.js';
import { WebsiteOperationError } from './websiteCloudinary.js';
import type { WebsiteSiteRecord } from '../types/website.js';
import type { OrderRecord } from '../types/orders.js';
import { PUBLIC_ORIGIN } from '../../src/utils/socialMetadata.js';
import { deletionNameMatches as deletionConfirmed, websiteDeletionName } from '../../src/utils/websiteDeletion.js';
export { deletionConfirmed, websiteDeletionName };

/**
 * Website deletion (V5). Deleting archives the website; it never deletes, refunds, reverses or retries
 * anything financial. It is refused while money or an order could still move for this website, because
 * an archived website can no longer be used to see orders or withdraw store earnings.
 */
export type WebsiteDeletionBlockerCode = 'orders_in_progress' | 'payment_pending' | 'order_review' | 'earnings_available' | 'earnings_pending' | 'withdrawal_reserved' | 'reconciliation';
export interface WebsiteDeletionBlocker { code: WebsiteDeletionBlockerCode; message: string; count?: number; amountMinor?: number }
export interface WebsiteDeletionCheck {
  site: { id: string; name: string; slug: string; published: boolean; publicUrl: string; templateId: string };
  blockers: WebsiteDeletionBlocker[];
  canDelete: boolean;
}

const IN_PROGRESS = ['paid', 'queued', 'submitted', 'processing', 'refund_pending'];
/** An unpaid checkout can still be completed in Paystack for a while; give it a day to settle or expire. */
export const DELETION_PENDING_PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

type OrderRow = Pick<OrderRecord, 'status' | 'payment_status' | 'manual_review' | 'created_at'>;
async function unresolvedOrders(siteId: string, now: number): Promise<OrderRow[]> {
  const since = new Date(now - DELETION_PENDING_PAYMENT_WINDOW_MS).toISOString();
  // Inside the owner's website transaction this reads through the same connection (no second checkout).
  const db = websiteDatabase();
  if (db) return (await db.query<OrderRow>(
    `SELECT status, payment_status, manual_review, created_at FROM orders WHERE store_context->>'siteId' = $1
     AND (status = ANY($2::text[]) OR manual_review = TRUE OR (status = 'pending_payment' AND created_at > $3))`,
    [siteId, IN_PROGRESS, since])).rows;
  const { OrdersStore } = await import('../db/ordersStore.js');
  return OrdersStore.adminDevOrders().filter(o => o.store_context?.siteId === siteId
    && (IN_PROGRESS.includes(o.status) || o.manual_review || (o.status === 'pending_payment' && o.created_at > since)));
}

function orderBlockers(rows: OrderRow[]): WebsiteDeletionBlocker[] {
  const blockers: WebsiteDeletionBlocker[] = [];
  const active = rows.filter(o => IN_PROGRESS.includes(o.status)).length;
  const pending = rows.filter(o => o.status === 'pending_payment').length;
  const review = rows.filter(o => o.manual_review && !IN_PROGRESS.includes(o.status)).length;
  if (active) blockers.push({ code: 'orders_in_progress', count: active, message: `${active} paid ${active === 1 ? 'order is' : 'orders are'} still being delivered or refunded. Wait until ${active === 1 ? 'it finishes' : 'they finish'}.` });
  if (pending) blockers.push({ code: 'payment_pending', count: pending, message: `${pending} ${pending === 1 ? 'customer has' : 'customers have'} an unfinished payment from the last 24 hours. It can still complete, so wait for it to finish or expire.` });
  if (review) blockers.push({ code: 'order_review', count: review, message: `${review} ${review === 1 ? 'order is' : 'orders are'} being checked by Mystery Hub support. Contact support before deleting.` });
  return blockers;
}

async function financeBlockers(userId: string): Promise<WebsiteDeletionBlocker[]> {
  const earnings = await FinanceStore.read(userId, tx => tx.storeEarnings());
  const blockers: WebsiteDeletionBlocker[] = [];
  if (earnings.availableMinor > 0) blockers.push({ code: 'earnings_available', amountMinor: earnings.availableMinor, message: 'You have store earnings ready to withdraw. Withdraw them first, because a deleted website cannot request a withdrawal.' });
  if (earnings.pendingMinor > 0) blockers.push({ code: 'earnings_pending', amountMinor: earnings.pendingMinor, message: 'Some store earnings are still pending. Wait until they become available and withdraw them first.' });
  if (earnings.reservedMinor > 0) blockers.push({ code: 'withdrawal_reserved', amountMinor: earnings.reservedMinor, message: 'A store earnings withdrawal is still being processed. Wait until it is paid.' });
  if (earnings.reconciliationRequired) blockers.push({ code: 'reconciliation', message: 'Your store earnings need a check by Mystery Hub support. Contact support before deleting.' });
  return blockers;
}

function summary(site: WebsiteSiteRecord): WebsiteDeletionCheck['site'] {
  return { id: site.id, name: websiteDeletionName(site), slug: site.slug, published: site.status === 'published', publicUrl: `${PUBLIC_ORIGIN}/sites/${site.slug}`, templateId: site.template_id };
}

export class WebsiteDeletionService {
  /** Read-only. Shows the owner exactly what will happen and anything that must settle first. */
  static async check(site: WebsiteSiteRecord, now = Date.now()): Promise<WebsiteDeletionCheck> {
    const blockers = [...orderBlockers(await unresolvedOrders(site.id, now)), ...await financeBlockers(site.user_id)];
    return { site: summary(site), blockers, canDelete: blockers.length === 0 };
  }

  /**
   * Archive under the owner's website lock. The finance read happens first, on its own short read-only
   * connection; inside the lock, orders are re-read on the lock's connection, so a checkout that
   * started meanwhile still blocks. Checkout itself re-reads the site after locking its row and refuses
   * an archived website, so no new purchase can begin afterwards.
   */
  static async archive(siteId: string, userId: string, confirmation: unknown, now = Date.now()) {
    const { withWebsiteLock } = await import('../db/websiteTransaction.js');
    const first = await WebsiteStore.findSiteRecordById(siteId);
    if (!first || (first.user_id !== userId && first.status === 'archived')) throw new WebsiteOperationError('Website not found.', 404);
    if (first.user_id !== userId) throw new WebsiteOperationError('You do not own this website.', 403);
    if (first.status === 'archived') return { site: first, alreadyDeleted: true };
    if (!deletionConfirmed(first, confirmation)) throw new WebsiteOperationError('Type the website name exactly as shown to confirm.');
    const money = await financeBlockers(userId);
    if (money.length) throw new WebsiteDeletionBlockedError(money);
    return withWebsiteLock(userId, async () => {
      const current = await WebsiteStore.findSiteRecordById(siteId);
      if (!current || current.user_id !== userId) throw new WebsiteOperationError('Website not found.', 404);
      if (current.status === 'archived') return { site: current, alreadyDeleted: true };
      const orders = orderBlockers(await unresolvedOrders(siteId, now));
      if (orders.length) throw new WebsiteDeletionBlockedError(orders);
      const result = await WebsiteStore.archiveSite(siteId, userId);
      if (!result) throw new WebsiteOperationError('Website not found.', 404);
      return { site: result.site, alreadyDeleted: result.alreadyArchived };
    });
  }

  /** Public closed page: no name, branding or redirect; only whether order tracking stays available. */
  static async closedSite(slug: string) {
    const site = await WebsiteStore.findArchivedSiteBySlug(slug);
    if (!site) return null;
    const pool = getPool();
    const { OrdersStore } = await import('../db/ordersStore.js');
    const hadOrders = pool
      ? (await pool.query("SELECT 1 FROM orders WHERE store_context->>'siteId' = $1 LIMIT 1", [site.id])).rows.length > 0
      : OrdersStore.adminDevOrders().some(o => o.store_context?.siteId === site.id);
    return { closed: true as const, orderTracking: hadOrders ? { siteId: site.id } : null };
  }
}

export class WebsiteDeletionBlockedError extends WebsiteOperationError {
  readonly code = 'WEBSITE_DELETION_BLOCKED';
  constructor(public blockers: WebsiteDeletionBlocker[]) { super(blockers[0]?.message || 'This website cannot be deleted yet.', 409); }
}
