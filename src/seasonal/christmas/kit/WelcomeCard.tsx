import React from 'react';
// Styles: kit.css, loaded by each seasonal homepage's chunk (this file stays importable by tests).
import { ArrowRight } from 'lucide-react';
import type { DataBundle } from '../../../types';
import type { WelcomeOffer } from '../../../utils/welcomeOfferPresentation';
import { welcomeFigure } from './welcome';

/**
 * The first-purchase invitation: a short advertisement, not an explanation. It shows for the server's `guest` state
 * (with a way to create an account) and its `eligible` state (the saving is waiting on this account), never for
 * customers who are not eligible. The headline figure comes from welcomeFigure: computed from the live offer and
 * catalogue, never above the approved ceiling. Checkout stays the place that shows the exact saving and the total
 * before anyone pays, so the card carries no worked example, fine print or money amount.
 * - Until the server's catalogue is on screen nothing is advertised (no figure can be verified yet).
 * - If the confirmed catalogue has no qualifying bundle, the card stays an invitation with no percentage.
 */
export function WelcomeCard({ offer, bundles, catalogConfirmed, onCreateAccount, headingId = 'xk-welcome-title' }: {
  offer: WelcomeOffer | null; bundles: DataBundle[]; catalogConfirmed: boolean; onCreateAccount?: () => void; headingId?: string;
}) {
  if (!offer?.enabled || !['guest', 'eligible'].includes(offer.state) || !catalogConfirmed) return null;
  const figure = welcomeFigure(offer, bundles, catalogConfirmed);
  const eligible = offer.state === 'eligible';
  return (
    <aside className={`xk-welcome${eligible ? ' is-eligible' : ''}`} aria-labelledby={headingId}>
      <span className="xk-welcome-foil" aria-hidden="true" />
      <h3 id={headingId} className="xk-welcome-big">
        {figure ? <>Up to <b>{figure.percent}%</b> off</> : <>Welcome <b>saving</b></>}
        <span>{figure ? 'Your first data bundle' : 'On your first data bundle'}</span>
      </h3>
      <p className="xk-welcome-note">{eligible ? 'Ready on your account' : 'For new customers'}</p>
      {!eligible && onCreateAccount && <button type="button" className="xk-welcome-cta" onClick={onCreateAccount}>Create Your Free Account<ArrowRight className="size-4" aria-hidden="true" /></button>}
    </aside>
  );
}
