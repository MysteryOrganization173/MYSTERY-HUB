import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DATA_BUNDLES, GHANA_NETWORKS } from '../../data/bundles';
import { NetworkId } from '../../types';
import { BundleCard } from '../data/BundleCard';
import { getInstantBundlesOnServer } from '../../services/apiClient';
import { ArrowRight, Wifi, Zap } from 'lucide-react';

export const HomeFeaturedData: React.FC = () => {
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
    <section className="pt-2 pb-8 sm:pt-4 sm:pb-12 lg:pt-6 lg:pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00c365]">
              <Wifi className="w-3.5 h-3.5" />
              <span>Data Bundles</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Popular Data Bundles
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg">
              Reliable 4G/5G data packages with fast Mobile Money delivery to your phone.
            </p>
          </div>

          {/* Network Filter Pills */}
          <div className="flex items-center gap-2">
            {(['mtn', 'airteltigo', 'telecel'] as NetworkId[]).map((netId) => {
              const net = GHANA_NETWORKS[netId];
              const isSelected = selectedNetwork === netId;
              return (
                <button
                  key={netId}
                  onClick={() => setSelectedNetwork(netId)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-white text-black shadow-md'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: net.brandColor }}
                  />
                  <span>{netId === 'mtn' ? 'MTN' : netId === 'airteltigo' ? 'AirtelTigo' : 'Telecel'}</span>
                </button>
              );
            })}

            {instantAvailable && (
              <button
                type="button"
                onClick={() => openDataPage('instant')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer shadow-sm ml-1"
              >
                <Zap className="w-3.5 h-3.5 fill-amber-400" />
                <span>Instant Bundles</span>
              </button>
            )}

            <button
              onClick={() => setActivePage('data')}
              className="text-xs font-semibold text-[#00c365] hover:text-[#00e575] flex items-center gap-1 ml-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 4 Bundle Cards Grid matching screenshot */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {popularBundles.map((bundle) => (
            <BundleCard
              key={bundle.id}
              bundle={bundle}
              recipientPhone={homeQuickBuyPhone}
              onPhoneChange={setHomeQuickBuyPhone}
              onBuy={(b, opts) => openCheckout(b, opts)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
