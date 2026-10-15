import {useDirectCatalog} from '../../hooks/useDirectCatalog';
import {WelcomeOfferNotice} from '../data/WelcomeOfferNotice';
import {useWelcomeOffer} from '../../hooks/useWelcomeOffer';
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { GHANA_NETWORKS } from '../../data/bundles';
import { NetworkId } from '../../types';
import { CompactBundleRow } from '../data/CompactBundleRow';
import { getInstantBundlesOnServer } from '../../services/apiClient';
import { ArrowRight, Wifi, Zap, ReceiptText, ShieldCheck, PackageSearch } from 'lucide-react';

const NETWORKS: { id: NetworkId; label: string }[] = [
  { id: 'mtn', label: 'MTN' },
  { id: 'airteltigo', label: 'AirtelTigo' },
  { id: 'telecel', label: 'Telecel' },
];

// What happens after Buy; timing depends on the network, so no delivery promises.
const STEPS = [
  { icon: ReceiptText, title: 'Check the total and number', desc: 'Checkout shows the bundle price, any fee and the recipient before you pay.' },
  { icon: ShieldCheck, title: 'Pay with MoMo through Paystack', desc: 'Payments are handled by Paystack. Never share your MoMo PIN with anyone, including support.' },
  { icon: PackageSearch, title: 'Track your order', desc: 'Follow it from confirmed payment to delivery. Timing depends on the network.' },
];

export const HomeFeaturedData: React.FC = () => {
  const DATA_BUNDLES=useDirectCatalog();
  const welcomeOffer=useWelcomeOffer(DATA_BUNDLES);
  const { openCheckout, openDataPage, setActivePage } = useApp();
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkId>('mtn');
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
                >
                  <span className="home-network-dot" style={{ backgroundColor: GHANA_NETWORKS[id].brandColor }} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>

            <div className="home-welcome-offer"><WelcomeOfferNotice offer={welcomeOffer}/></div>

            <div className="home-bundle-list">
              {popularBundles.map((b) => (
                <CompactBundleRow
                  key={b.id}
                  bundle={b}
                  directWelcomeOffer={welcomeOffer}
                  onBuy={(bundle) => openCheckout(bundle)}
                />
              ))}
              {popularBundles.length === 0 && <p className="home-empty-state" role="status">No popular bundles to show for this network. Browse all bundles to check availability.</p>}
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
