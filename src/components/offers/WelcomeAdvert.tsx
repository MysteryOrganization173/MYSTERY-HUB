import React from 'react';
import { ArrowRight, Check, Gift } from 'lucide-react';
import type { DataBundle } from '../../types';
import type { WelcomeOffer } from '../../utils/welcomeOfferPresentation';
import { combinedWelcomeFigure, welcomeFigure } from '../../utils/welcomeAdvert';
// Styles: welcomeAdvert.css, imported by the pages that show it (HomePage, DataPage), so this file stays importable by tests.

/**
 * 3.7 closeout: the permanent Welcome Offer, advertised the same way all year (ordinary homepage, member homepage and
 * Data page; the seasonal homepages keep their own Welcome card with the same figure).
 *
 * - Shown only for the server's `guest` state (with a way to create an account) and its `eligible` state ("ready on
 *   your account"). Never for customers who have used it, are holding it on a pending payment, or cannot get it.
 * - The figure comes from welcomeFigure: the confirmed server offer against the confirmed catalogue on screen, never
 *   above the approved "up to 18%" ceiling. Until both are confirmed, nothing is advertised.
 * - While a price campaign the server applies stacks with the benefit, the homepage card also shows the combined
 *   first-purchase figure, named as the campaign's (the one-line variants keep to the welcome figure).
 * - With no worked-out figure, nothing is shown.
 * - Checkout stays the place that shows the exact saving and the total before anyone pays.
 */
export interface WelcomeAdvertProps {
  offer: WelcomeOffer | null; bundles: DataBundle[]; catalogConfirmed: boolean; onCreateAccount?: () => void;
  variant: 'card' | 'line' | 'chip'; headingId?: string;
}

export function welcomeAdvertShown(offer: WelcomeOffer | null, catalogConfirmed: boolean) {
  return Boolean(offer?.enabled && ['guest', 'eligible'].includes(offer.state) && catalogConfirmed);
}

export function WelcomeAdvert({ offer, bundles, catalogConfirmed, onCreateAccount, variant, headingId = 'mh-welcome-advert' }: WelcomeAdvertProps) {
  if (!welcomeAdvertShown(offer, catalogConfirmed)) return null;
  const figure = welcomeFigure(offer, bundles, catalogConfirmed);
  // No worked-out figure (no qualifying bundle on screen): advertise nothing rather than a vague claim.
  if (!figure) return null;
  const eligible = offer!.state === 'eligible';
  const headline = `Up to ${figure.percent}% off`;
  const dot = <span aria-hidden="true"> · </span>;

  // Line and chip: the visible words are what a screen reader says, in the same order (phones show shorter wording,
  // mh-wa-narrow, in place of mh-wa-wide), and a short sentence after them says whose offer it is.
  if (variant === 'line') {
    const action = !eligible && onCreateAccount;
    const content = <>
      {eligible ? <Check className="mh-wa-icon" aria-hidden="true" /> : <Gift className="mh-wa-icon" aria-hidden="true" />}
      <span className="mh-wa-text">
        {eligible && <span className="mh-wa-ready">Ready: </span>}{eligible ? 'up to ' : 'Up to '}<strong>{figure.percent}% off</strong> your first bundle
        {action && <>{dot}<span className="mh-wa-wide">create a free account</span><span className="mh-wa-narrow">sign up</span></>}
      </span>
      <span className="sr-only">{eligible ? ' Welcome offer, on your account.' : ' Welcome offer for new customers.'}</span>
      {action && <ArrowRight className="mh-wa-arrow" aria-hidden="true" />}
    </>;
    return action
      ? <button type="button" className="mh-wa mh-wa-line is-action" onClick={onCreateAccount}>{content}</button>
      : <p className={`mh-wa mh-wa-line${eligible ? ' is-eligible' : ''}`}>{content}</p>;
  }

  if (variant === 'chip') return (
    <span className={`mh-wa mh-wa-chip${eligible ? ' is-eligible' : ''}`}>
      {eligible ? <Check className="mh-wa-icon" aria-hidden="true" /> : <Gift className="mh-wa-icon" aria-hidden="true" />}
      <span><strong>{headline}</strong><span className="mh-wa-wide"> your first bundle</span></span>
      <span className="sr-only">{eligible ? ', welcome offer ready on your account.' : ', welcome offer for new customers.'}</span>
    </span>
  );

  // Card: the combined December figure appears here only (it does not fit the one-line variants).
  const combined = combinedWelcomeFigure(offer, bundles, catalogConfirmed);
  return (
    <aside className={`mh-wa mh-wa-card${eligible ? ' is-eligible' : ''}`} aria-labelledby={headingId}>
      <p className="mh-wa-kicker"><Gift className="mh-wa-icon" aria-hidden="true" />Welcome offer</p>
      <h3 id={headingId} className="mh-wa-big">{headline}<span>your first data bundle</span></h3>
      {combined && <p className="mh-wa-combined">Up to {combined.percent}% with the {combined.campaignLabel}</p>}
      <p className="mh-wa-note">{eligible ? <><Check className="mh-wa-icon" aria-hidden="true" />Ready on your account</> : 'For new customers'}</p>
      {!eligible && onCreateAccount && <button type="button" className="mh-wa-cta" onClick={onCreateAccount}>Create a free account<ArrowRight className="mh-wa-arrow" aria-hidden="true" /></button>}
    </aside>
  );
}
