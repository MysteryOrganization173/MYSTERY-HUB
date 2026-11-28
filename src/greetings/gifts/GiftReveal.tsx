import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { AlertCircle, Check, Clock, RefreshCw, Search } from 'lucide-react';
import type { GiftNetwork, GiftStatus, PublicGreetingGift } from '../../../shared/mysteryGifts';

/*
 * Mystery Gifts V1 (3.7.2), recipient side. DORMANT DESIGN FOUNDATION: nothing in production renders this yet.
 *
 * It is the second reveal under an opened greeting letter: a small gift tag ("A little extra surprise") that opens
 * into a card naming what was gifted and a calm, accurate delivery status. It reads only the minimized public gift
 * (shared/mysteryGifts.ts): network, allowance and status. It never shows a phone number, price, reference or date,
 * because a greeting link can be forwarded. The letter never depends on it: the message stays readable whatever
 * happens to the gift. Wiring it into /g waits for the 3.5 association contract (docs/mystery-gifts-3-7-2.md).
 */

export const GIFT_NETWORK_COPY: Record<GiftNetwork, { name: string; color: string; ink: string }> = {
  // The same brand colours as the Data store's network selector (src/components/data/DataNetworkSelector.tsx).
  mtn: { name: 'MTN', color: '#ffcc00', ink: '#191500' },
  telecel: { name: 'Telecel', color: '#c90000', ink: '#ffffff' },
  airteltigo: { name: 'AirtelTigo', color: '#004b93', ink: '#ffffff' },
};

export interface GiftStatusCopy { title: string; detail: string }
/** Recipient wording for each status. Never asks the recipient to act, and never discusses money. */
export function giftStatusCopy(status: GiftStatus, network: GiftNetwork): GiftStatusCopy {
  const name = GIFT_NETWORK_COPY[network].name;
  switch (status) {
    case 'delivered': return { title: 'Delivered', detail: `The bundle has been delivered to your number. You can check your data balance with ${name}.` };
    case 'pending': return { title: 'On its way', detail: 'Delivery to your number is in progress. Networks sometimes take a little while.' };
    case 'review': return { title: 'Being checked', detail: 'Its delivery is being checked. There’s nothing you need to do.' };
    case 'undeliverable': return { title: 'Couldn’t be delivered', detail: 'This bundle couldn’t be delivered to your number. Mystery Hub will look after it with your sender. There’s nothing you need to do.' };
    case 'status_unavailable': return { title: 'Status unavailable', detail: 'We couldn’t check this gift’s delivery just now. Please try again in a moment.' };
  }
}

/** Who chose the gift, without revealing a hidden sender (the letter calls them "a mystery sender"). */
export function giftFromLine(status: GiftStatus, senderName: string | null): string {
  const who = senderName?.trim() || 'Your mystery sender';
  return status === 'undeliverable'
    ? `${who} chose an internet bundle to go with this greeting.`
    : `${who} bought you an internet bundle to go with this greeting.`;
}

const ICONS: Record<GiftStatus, typeof Check> = { delivered: Check, pending: Clock, review: Search, undeliverable: AlertCircle, status_unavailable: RefreshCw };

/**
 * The tag opens with one tap (or Enter/Space); focus then moves to the card's heading so screen readers hear the gift.
 * Without motion it simply appears. `initiallyOpen` is for previews and review screens only.
 */
export function GiftReveal({ gift, senderName, onRetry, initiallyOpen = false, onOpen }: {
  gift: PublicGreetingGift; senderName: string | null; onRetry?: () => void; initiallyOpen?: boolean; onOpen?: () => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useLayoutEffect(() => { if (open && moved.current) { heading.current?.focus({ preventScroll: true }); moved.current = false; } }, [open]);
  const net = GIFT_NETWORK_COPY[gift.network];
  const copy = giftStatusCopy(gift.status, gift.network);
  const Icon = ICONS[gift.status];
  return (
    <section className="mgg-gift" data-open={open || undefined} aria-label="Data gift">
      {!open ? (
        <div className="mgg-tag">
          <span className="mgg-tag-string" aria-hidden="true" />
          <span className="mgg-tag-hole" aria-hidden="true" />
          <p className="mgg-tag-kicker">A little extra surprise</p>
          <p className="mgg-tag-line">There’s something else with this greeting.</p>
          <button type="button" className="mg-btn mg-btn-ghost mgg-tag-open" onClick={() => { moved.current = true; setOpen(true); onOpen?.(); }}>
            Reveal your extra gift
          </button>
        </div>
      ) : (
        <article className="mgg-card" data-network={gift.network} data-status={gift.status}
          style={{ '--mgg-net': net.color, '--mgg-net-ink': net.ink } as CSSProperties}>
          <div className="mgg-card-top">
            <p className="mgg-kind">A little extra surprise</p>
            <span className="mgg-net"><span className="mgg-net-dot" aria-hidden="true" />{net.name}</span>
          </div>
          <h2 ref={heading} tabIndex={-1} className="mgg-allowance">
            <span className="mgg-allowance-value">{gift.allowance}</span>{' '}
            <span className="mgg-allowance-label">Data Gift</span>
          </h2>
          <p className="mgg-from">{giftFromLine(gift.status, senderName)}</p>
          <div className="mgg-tear" aria-hidden="true" />
          <div className="mgg-status" data-status={gift.status} role="status">
            <span className="mgg-status-icon" aria-hidden="true"><Icon /></span>
            <p><strong className="mgg-status-title">{copy.title}</strong> <span className="mgg-status-detail">{copy.detail}</span></p>
          </div>
          {gift.status === 'status_unavailable' && onRetry && (
            <button type="button" className="mg-btn mg-btn-quiet mgg-retry" onClick={onRetry}><RefreshCw className="mg-icon" aria-hidden="true" />Check again</button>
          )}
        </article>
      )}
    </section>
  );
}
