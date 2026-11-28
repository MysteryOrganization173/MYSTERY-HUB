import {directCatalogConfirmed,useDirectCatalog} from '../../hooks/useDirectCatalog';
import {WelcomeAdvert} from '../offers/WelcomeAdvert';
import {useWelcomeOfferState} from '../../hooks/useWelcomeOffer';
import {welcomeCombinedLikely} from '../../utils/welcomeAdvert';
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { GHANA_NETWORKS } from '../../data/bundles';
import { NetworkId } from '../../types';
import { CompactBundleRow } from '../data/CompactBundleRow';
import { getInstantBundlesOnServer } from '../../services/apiClient';
import { ArrowRight, Wifi, Zap, ReceiptText, ShieldCheck, PackageSearch } from 'lucide-react';
import { useServiceStatus, serviceControl, useOpenNetworkChoice } from '../../hooks/useServiceStatus';
import { ServiceInlineNotice } from '../service/ServiceUpdate';

const NETWORKS: { id: NetworkId; label: string }[] = [
  { id: 'mtn', label: 'MTN' },
  { id: 'airteltigo', label: 'AirtelTigo' },
  { id: 'telecel', label: 'Telecel' },
];
const NETWORK_IDS = NETWORKS.map((n) => n.id);

// What happens after Buy; timing depends on the network, so no delivery promises.
const STEPS = [
  { icon: ReceiptText, title: 'Check the total and number', desc: 'Checkout shows the bundle price, any fee and the recipient before you pay.' },
  { icon: ShieldCheck, title: 'Pay with MoMo through Paystack', desc: 'Payments are handled by Paystack. Never share your MoMo PIN with anyone, including support.' },
  { icon: PackageSearch, title: 'Track your order', desc: 'Follow it from confirmed payment to delivery. Timing depends on the network.' },
];

export const HomeFeaturedData: React.FC = () => {
  const DATA_BUNDLES=useDirectCatalog();
  const {offer:welcomeOffer,settled:welcomeSettled}=useWelcomeOfferState(DATA_BUNDLES);
  const { openCheckout, openDataPage, setActivePage, openAuth, sessionToken } = useApp();
  // 3.7 closeout: room for the Welcome card is held only while the server's answer is still coming, and never for
  // longer than 8 seconds, so a disabled offer or a failed read leaves no empty box behind.
  const [welcomeWaitOver, setWelcomeWaitOver] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setWelcomeWaitOver(true), 8000); return () => window.clearTimeout(timer); }, []);
  const welcomeReserve = !sessionToken && !welcomeSettled && !welcomeWaitOver ? (welcomeCombinedLikely(DATA_BUNDLES, directCatalogConfirmed()) ? 'tall' : 'card') : undefined;
  // 3.6.3: the first network open for purchases is shown first; a paused network stays in the switch and explains itself.
  const serviceStatus = useServiceStatus();
  const [selectedNetwork, setSelectedNetwork] = useOpenNetworkChoice<NetworkId>('data', NETWORK_IDS, serviceStatus);
  const incident = serviceControl('data', selectedNetwork, serviceStatus);
  const [instantAvailable, setInstantAvailable] = useState(false);

  useEffect(() => {
    let mounted = true;
    getInstantBundlesOnServer()
      .then((res) => {
        if (mounted && res.success && res.available && res.products.length > 0) {
          setInstantAvailable(true);
        }
      })
      .catch(() => {
        // fail silently
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Popular 4 bundles for the selected network, from the live catalogue.
  const popularBundles = DATA_BUNDLES.filter(
    (b) => b.network === selectedNetwork && b.isPopular
  ).slice(0, 4);

  return (
    <section className="home-bundles" aria-labelledby="popular-data-heading">
      <div className="home-container">
        <div className="home-section-heading">
          <div>
            <p className="home-eyebrow"><Wifi className="w-3.5 h-3.5" />Data Bundles</p>
            <h2 id="popular-data-heading">Popular data bundles</h2>
            <p>Pick a bundle. You confirm the recipient number and total before you pay.</p>
          </div>
          {/* 3.7 closeout: the year-round Welcome Offer. For a signed-out visitor (the server's guest state whenever the
              offer is on) its room is kept from the first paint until the server answers, so the card fills it without
              moving the page. */}
          <div className="home-welcome-slot" data-reserve={welcomeReserve}>
            <WelcomeAdvert variant="card" offer={welcomeOffer} bundles={DATA_BUNDLES} catalogConfirmed={directCatalogConfirmed()} onCreateAccount={() => openAuth('signup')} headingId="home-welcome-title" />
          </div>
        </div>

        <div className="home-buy-layout">
          <div className="home-buy-panel">
            <div className="home-network-switch" role="group" aria-label="Choose network">
              {NETWORKS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selectedNetwork === id}
                  onClick={() => setSelectedNetwork(id)}
                  style={{ '--network-color': GHANA_NETWORKS[id].brandColor } as React.CSSProperties}
                >
                  <span className="home-network-dot" style={{ backgroundColor: GHANA_NETWORKS[id].brandColor }} aria-hidden="true" />
                  {label}
                  {serviceControl('data', id, serviceStatus)?.blocksPurchases && <span className="sr-only">, under maintenance</span>}
                </button>
              ))}
            </div>

            <div className="home-bundle-list">
              {popularBundles.map((b) => (
                <CompactBundleRow
                  key={b.id}
                  bundle={b}
                  directWelcomeOffer={welcomeOffer}
                  onBuy={(bundle) => openCheckout(bundle)}
                />
              ))}
              {incident?.blocksPurchases ? <ServiceInlineNotice control={incident}> Other networks are available.</ServiceInlineNotice>
                : popularBundles.length === 0 && <p className="home-empty-state" role="status">No popular bundles to show for this network. Browse all bundles to check availability.</p>}
            </div>

            <div className="home-buy-footer">
              <button type="button" onClick={() => openDataPage('data', selectedNetwork)} className="home-text-action">
                <span>View all {GHANA_NETWORKS[selectedNetwork].name} bundles</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              {instantAvailable && (
                <button type="button" onClick={() => openDataPage('instant')} className="home-instant-action">
                  <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Browse Instant Bundles</span>
                </button>
              )}
            </div>
          </div>

          <aside className="home-buy-steps" aria-labelledby="buy-steps-heading">
            <h3 id="buy-steps-heading">How buying works</h3>
            <ol>
              {STEPS.map(({ icon: Icon, title, desc }, index) => (
                <li key={title}>
                  <span className="home-step-index" aria-hidden="true">{index + 1}</span>
                  <div><strong><Icon className="w-4 h-4" aria-hidden="true" />{title}</strong><p>{desc}</p></div>
                </li>
              ))}
            </ol>
            <button type="button" onClick={() => setActivePage('orders')} className="home-text-action">Track an existing order<ArrowRight className="w-4 h-4" /></button>
          </aside>
        </div>
      </div>
    </section>
  );
};
