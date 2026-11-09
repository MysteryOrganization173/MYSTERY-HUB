import React from 'react';
import './kit.css';
import { ArrowRight, Check } from 'lucide-react';
import type { DataBundle } from '../../../types';
import { formatGhs } from '../../../../shared/money';
import type { WelcomeOffer } from '../../../utils/welcomeOfferPresentation';
import { welcomeFigure } from './welcome';

/**
 * The first-purchase invitation. Shown for the server's `guest` state (with a way to create an account) and its
 * `eligible` state (the saving is waiting at checkout); never for customers who are not eligible. The headline
 * figure comes from welcomeFigure (computed from the live offer and catalogue, within the approved ceiling); the
 * fine print always states the plain amount and the exact bundle the headline refers to.
 */
export function WelcomeCard({ offer, bundles, catalogConfirmed, onCreateAccount, headingId = 'xk-welcome-title' }: {
  offer: WelcomeOffer | null; bundles: DataBundle[]; catalogConfirmed: boolean; onCreateAccount?: () => void; headingId?: string;
}) {
  if (!offer?.enabled || !['guest', 'eligible'].includes(offer.state)) return null;
  const figure = welcomeFigure(offer, bundles, catalogConfirmed);
  const amount = formatGhs(offer.discountMinor);
  const eligible = offer.state === 'eligible';
  return (
    <aside className={`xk-welcome${eligible ? ' is-eligible' : ''}`} aria-labelledby={headingId}>
      <span className="xk-welcome-foil" aria-hidden="true" />
      <p className="xk-welcome-kicker">Welcome offer <span aria-hidden="true">·</span> {eligible ? 'Ready on your account' : 'For new customers'}</p>
      <h3 id={headingId} className="xk-welcome-big">
        {figure ? <>Up to <b>{figure.percent}%</b> off</> : <><b>{amount}</b> off</>}
        <span>your first data bundle</span>
      </h3>
      <p className="xk-welcome-fine">
        {amount} off one qualifying data purchase{figure ? `, which is ${figure.percent}% on the ${figure.label} bundle at ${formatGhs(figure.regularMinor)}` : ''}. The saving applies once, not to every bundle.
      </p>
      {eligible
        ? <p className="xk-welcome-ready"><Check className="size-4" aria-hidden="true" />Pick any qualifying bundle: checkout shows the saving before you pay.</p>
        : onCreateAccount && <button type="button" className="xk-welcome-cta" onClick={onCreateAccount}>Create a free account<ArrowRight className="size-4" aria-hidden="true" /></button>}
    </aside>
  );
}
