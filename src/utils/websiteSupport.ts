import { formatGhs } from '../../shared/money.js';
import type { WebsiteDeletionBlockerView } from './websiteDeletion.js';

/**
 * Owner-facing wording for the server's deletion blockers. The server decides whether deletion is
 * allowed; this only explains its answer. Amounts and counts always come from the server.
 */
export function deletionBlockerSummary(b: WebsiteDeletionBlockerView, withdrawalMinimumMinor?: number): { title: string; why: string; resolve?: 'Orders' | 'Store Earnings' } {
  const n = b.count || 0, amount = b.amountMinor ? formatGhs(b.amountMinor) : '';
  const belowMinimum = !!b.amountMinor && !!withdrawalMinimumMinor && b.amountMinor < withdrawalMinimumMinor;
  switch (b.code) {
    case 'earnings_available': return belowMinimum
      ? { title: `${amount} in Store Earnings`, why: `This is below the ${formatGhs(withdrawalMinimumMinor!)} withdrawal minimum, so you can’t withdraw it yourself yet, and a deleted website can’t request a withdrawal. Support can tell you how to settle it.`, resolve: 'Store Earnings' }
      : { title: `${amount || 'Money'} ready to withdraw`, why: 'Withdraw it from Store Earnings first, because a deleted website can’t request a withdrawal.', resolve: 'Store Earnings' };
    case 'earnings_pending': return { title: `${amount || 'Earnings'} still pending`, why: 'These earnings become available after delivery is confirmed. Withdraw them once they are available.', resolve: 'Store Earnings' };
    case 'withdrawal_reserved': return { title: `${amount || 'A'} withdrawal in progress`, why: 'Wait until Mystery Hub has paid this withdrawal.', resolve: 'Store Earnings' };
    case 'reconciliation': return { title: 'Store Earnings need a check', why: 'Mystery Hub support needs to check your earnings before the website can close.' };
    case 'orders_in_progress': return { title: `${n || 'Some'} paid ${n === 1 ? 'order is' : 'orders are'} still in progress`, why: 'Wait until delivery or refund finishes.', resolve: 'Orders' };
    case 'payment_pending': return { title: `${n || 'Some'} unfinished ${n === 1 ? 'payment' : 'payments'}`, why: 'Wait for the payment to complete or expire. Contact support if it stays pending.', resolve: 'Orders' };
    case 'order_review': return { title: `${n || 'Some'} ${n === 1 ? 'order is' : 'orders are'} being checked`, why: 'Mystery Hub support is reviewing delivery. Contact support before deleting.', resolve: 'Orders' };
    default: return { title: 'Something still needs to finish', why: b.message };
  }
}

/**
 * A ready-to-send WhatsApp message to Mystery Hub support about closing a website. Contains only
 * what the owner can already see and support needs: website name, public address, what blocks
 * deletion and server-reported amounts. Never tokens, internal IDs, customer numbers or ledgers.
 */
export function websiteDeletionSupportUrl(supportUrl: string, site: { name: string; publicAddress: string }, blockers: WebsiteDeletionBlockerView[], withdrawalMinimumMinor?: number): string {
  const lines = blockers.map(b => {
    const s = deletionBlockerSummary(b, withdrawalMinimumMinor);
    const note = b.code === 'earnings_available' && b.amountMinor && withdrawalMinimumMinor && b.amountMinor < withdrawalMinimumMinor ? ` (below the ${formatGhs(withdrawalMinimumMinor)} withdrawal minimum)` : '';
    return `- ${s.title}${note}`;
  });
  const earnings = blockers.some(b => ['earnings_available', 'earnings_pending', 'withdrawal_reserved', 'reconciliation'].includes(b.code));
  const text = [
    'Hello Mystery Hub Support.',
    `I want to close my website "${site.name}" (${site.publicAddress}), but ${earnings ? 'I have remaining Store Earnings that prevent deletion' : 'deletion is blocked'}:`,
    ...lines,
    `Please help me understand how to settle ${blockers.length === 1 ? 'this' : 'these'} so I can close or recreate my website.`,
  ].join('\n');
  return `${supportUrl}${supportUrl.includes('?') ? '&' : '?'}text=${encodeURIComponent(text)}`;
}
