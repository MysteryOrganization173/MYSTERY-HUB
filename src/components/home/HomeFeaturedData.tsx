import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DATA_BUNDLES, GHANA_NETWORKS } from '../../data/bundles';
import { NetworkId } from '../../types';
import { BundleCard } from '../data/BundleCard';
import { ArrowRight, Wifi } from 'lucide-react';

export const HomeFeaturedData: React.FC = () => {
  const { setActivePage, openCheckout } = useApp();
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkId>('mtn');

  // Popular 4 bundles for the selected network
  const popularBundles = DATA_BUNDLES.filter(
    (b) => b.network === selectedNetwork && b.isPopular
  ).slice(0, 4);

  return (
    <section className="py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00c365]">
              <Wifi className="w-3.5 h-3.5" />
              <span>Instant Data Bundles</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Popular Data Bundles
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg">
              Discounted 4G/5G data packages with instant Mobile Money delivery to your phone.
            </p>
          </div>

          {/* Network Filter Pills */}
          <div className="flex items-center gap-2">
            {(['mtn', 'telecel', 'airteltigo'] as NetworkId[]).map((netId) => {
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
                  <span>{netId === 'mtn' ? 'MTN' : netId === 'telecel' ? 'Telecel' : 'AirtelTigo'}</span>
                </button>
              );
            })}

            <button
              onClick={() => setActivePage('data')}
              className="text-xs font-semibold text-[#00c365] hover:text-[#00e575] flex items-center gap-1 ml-2 transition-colors whitespace-nowrap"
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
              onBuy={(b) => openCheckout(b)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
