import React, { useEffect, useRef } from 'react';
import './member.css';
import type { SeasonStatus } from '../../../../shared/seasonal';
import type { MemberHomeViewProps } from '../../../components/home/MemberHomeView';
import { directCatalogConfirmed, useDirectCatalog } from '../../../hooks/useDirectCatalog';
import { useWelcomeOffer } from '../../../hooks/useWelcomeOffer';
import { loadSeasonalSerif } from '../font';
import { useReveal } from '../kit/motion';
import { WelcomeCard } from '../kit/WelcomeCard';
import { ChristmasMemberView } from './ChristmasMemberView';

/**
 * The signed-in customer's Christmas homepage (its own lazy chunk; see SeasonalMemberHome). It receives the account
 * data MemberDashboard already read for this session and adds only presentation: the season's greeting, materials
 * and motion. The one extra read is the existing welcome-offer quote, and only for a customer with no orders yet;
 * the card appears only when the server says the offer is waiting on this account.
 */
function MemberWelcomeOffer() {
  const bundles = useDirectCatalog();
  const offer = useWelcomeOffer(bundles);
  return <WelcomeCard offer={offer} bundles={bundles} catalogConfirmed={directCatalogConfirmed()} headingId="xm-welcome-offer" />;
}

export function ChristmasMemberHome({ view, status }: { view: MemberHomeViewProps; status: SeasonStatus }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(loadSeasonalSerif, []);
  // Entrances play once per visit (a re-render, an order refresh or Back to the homepage never replays them).
  useReveal(root, 'member');
  const firstPurchase = !view.loading && !view.error && view.orders.length === 0;
  return <ChristmasMemberView {...view} status={status} rootRef={root} welcome={firstPurchase ? <MemberWelcomeOffer /> : undefined} />;
}

export default ChristmasMemberHome;
