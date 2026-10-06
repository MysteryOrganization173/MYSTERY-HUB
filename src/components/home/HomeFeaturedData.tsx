import {useDirectCatalog} from '../../hooks/useDirectCatalog';
import {WelcomeOfferNotice} from '../data/WelcomeOfferNotice';
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DATA_BUNDLES, GHANA_NETWORKS } from '../../data/bundles';
import { NetworkId } from '../../types';
import { BundleCard } from '../data/BundleCard';
import { getInstantBundlesOnServer } from '../../services/apiClient';
import { ArrowRight, Wifi, Zap } from 'lucide-react';

export const HomeFeaturedData: React.FC = () => {
  const DATA_BUNDLES=useDirectCatalog();
  const { setActivePage, openCheckout, openDataPage } = useApp();
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkId>('mtn');
  const [homeQuickBuyPhone, setHomeQuickBuyPhone] = useState('');
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

  // Popular 4 bundles for the selected network
  const popularBundles = DATA_BUNDLES.filter(
    (b) => b.network === selectedNetwork && b.isPopular
  ).slice(0, 4);

  return (
    <section className="pt-1 pb-6 sm:pt-3 sm:pb-10 lg:pt-4 lg:pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
        <WelcomeOfferNotice/>
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4">
          <div className="space-y-1 sm:space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00c365]">
              <Wifi className="w-3.5 h-3.5" />
              <span>Data Bundles</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
              Popular Data Bundles
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg">
              Reliable 4G/5G data packages with fast Mobile Money delivery to your phone.
            </p>
          </div>

          {/* Network Filter Pills */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {(['mtn', 'airteltigo', 'telecel'] as NetworkId[]).map((netId) => {
              const net = GHANA_NETWORKS[netId];
              const isSelected = selectedNetwork === netId;
              return (
                <button
                  key={netId}
                  type="button"
                  onClick={() => setSelectedNetwork(netId)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-white text-black shadow-md'
                      : 'bg-[#10171e] text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: net.brandColor }}
                  />
                  <span>{netId === 'mtn' ? 'MTN' : netId === 'airteltigo' ? 'AT' : 'Telecel'}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4 Cards Grid with tighter mobile layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {popularBundles.map((b) => (
            <BundleCard
              key={b.id}
              bundle={b}
              recipientPhone={homeQuickBuyPhone}
              onPhoneChange={setHomeQuickBuyPhone}
              onBuy={(bundle, opts) => openCheckout(bundle, opts)}
            />
          ))}
        </div>

        {/* Action Footnotes */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            {instantAvailable && (
              <button
                type="button"
                onClick={() => openDataPage('instant')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs font-semibold hover:bg-amber-400/20 transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 fill-amber-400" />
                <span>Need data right now? Browse Instant Bundles</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => openDataPage('data')}
            className="text-xs font-bold text-[#00c365] hover:text-[#00e575] flex items-center gap-1 cursor-pointer"
          >
            <span>View all {GHANA_NETWORKS[selectedNetwork].name} bundles</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
