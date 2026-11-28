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
 * - While a price campaign the server applies stacks with the benefit, eligible and guest customers also see the
 *   combined first-purchase figure, named as the campaign's.
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
  const combined = combinedWelcomeFigure(offer, bundles, catalogConfirmed);
  const eligible = offer!.state === 'eligible';
  const headline = figure ? `Up to ${figure.percent}% off` : 'A welcome saving';
  const spoken = `Welcome offer${eligible ? ', ready on your account' : ' for new customers'}: ${figure ? `up to ${figure.percent}% off` : 'a saving on'} your first data bundle${combined ? `, or up to ${combined.percent}% with the ${combined.campaignLabel}` : ''}.`;

  if (variant === 'line') {
    const content = <>
      {eligible ? <Check className="mh-wa-icon" aria-hidden="true" /> : <Gift className="mh-wa-icon" aria-hidden="true" />}
      <span className="mh-wa-text" aria-hidden="true">
        {eligible && <span className="mh-wa-ready">Ready: </span>}{figure
          ? <>{eligible ? 'up to ' : 'Up to '}<strong>{figure.percent}% off</strong> your first bundle</>
          : <>{eligible ? 'a ' : 'A '}<strong>welcome saving</strong> on your first bundle</>}
        {combined && <span className="mh-wa-wide"> · up to {combined.percent}% with the {combined.campaignLabel}</span>}
        {!eligible && onCreateAccount && <span className="mh-wa-wide"> · create a free account</span>}
      </span>
      <span className="sr-only">{spoken}</span>
      {!eligible && onCreateAccount && <ArrowRight className="mh-wa-arrow" aria-hidden="true" />}
    </>;
    return !eligible && onCreateAccount
      ? <button type="button" className="mh-wa mh-wa-line is-action" onClick={onCreateAccount}>{content}<span className="sr-only"> Create a free account.</span></button>
      : <p className={`mh-wa mh-wa-line${eligible ? ' is-eligible' : ''}`}>{content}</p>;
  }

  if (variant === 'chip') return (
    <span className={`mh-wa mh-wa-chip${eligible ? ' is-eligible' : ''}`}>
      {eligible ? <Check className="mh-wa-icon" aria-hidden="true" /> : <Gift className="mh-wa-icon" aria-hidden="true" />}
      <span aria-hidden="true"><strong>{headline}</strong><span className="mh-wa-wide"> your first bundle</span></span>
      <span className="sr-only">{spoken}</span>
    </span>
  );

  return (
    <aside className={`mh-wa mh-wa-card${eligible ? ' is-eligible' : ''}`} aria-labelledby={headingId}>
      <p className="mh-wa-kicker"><Gift className="mh-wa-icon" aria-hidden="true" />Welcome offer</p>
      <h3 id={headingId} className="mh-wa-big">{headline}<span>{figure ? 'your first data bundle' : 'on your first data bundle'}</span></h3>
      {combined && <p className="mh-wa-combined">Up to {combined.percent}% with the {combined.campaignLabel}</p>}
      <p className="mh-wa-note">{eligible ? <><Check className="mh-wa-icon" aria-hidden="true" />Ready on your account</> : 'For new customers'}</p>
      {!eligible && onCreateAccount && <button type="button" className="mh-wa-cta" onClick={onCreateAccount}>Create a free account<ArrowRight className="mh-wa-arrow" aria-hidden="true" /></button>}
    </aside>
  );
}
