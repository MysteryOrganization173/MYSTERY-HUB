import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { getInstantBundlesOnServer, PublicInstantBundle } from '../../services/apiClient';
import { InstantBundleCard } from './InstantBundleCard';
import { NetworkId, DataBundle } from '../../types';
import { GHANA_NETWORKS } from '../../data/bundles';
import {
  Zap,
  Search,
  RefreshCw,
  AlertCircle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Wifi,
  PackageX,
} from 'lucide-react';

interface InstantBundlesCatalogProps {
  quickBuyPhone: string;
  onQuickBuyPhoneChange: (phone: string) => void;
  onSwitchToData: () => void;
}

export const InstantBundlesCatalog: React.FC<InstantBundlesCatalogProps> = ({
  quickBuyPhone,
  onQuickBuyPhoneChange,
  onSwitchToData,
}) => {
  const { openCheckout } = useApp();

  const [products, setProducts] = useState<PublicInstantBundle[]>([]);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNetwork, setSelectedNetwork] = useState<NetworkId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // In-session memory cache to avoid unnecessary repeated fetching when switching tabs
  const fetchCatalog = async (force = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getInstantBundlesOnServer();
      if (res.success && res.available && res.products.length > 0) {
        setProducts(res.products);
        setIsAvailable(true);
        setUnavailableReason('');
      } else {
        setProducts([]);
        setIsAvailable(false);
        setUnavailableReason(
          res.reason || 'Instant Bundles service is currently unavailable. Please select a standard Data Bundle.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Instant Bundles catalogue.');
      setIsAvailable(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Network filter
      if (selectedNetwork !== 'all' && p.network !== selectedNetwork) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchData = (p.dataAmount || '').toLowerCase().includes(q);
        const matchNet = p.network.toLowerCase().includes(q);
        return matchName || matchData || matchNet;
      }
      return true;
    });
  }, [products, selectedNetwork, searchQuery]);

  const handleBuy = (
    product: PublicInstantBundle,
    options?: { recipientPhone?: string; flexiAmount?: number }
  ) => {
    const finalPrice =
      product.isFlexi && options?.flexiAmount ? options.flexiAmount : product.retailPriceGhc;

    const convertedBundle: DataBundle = {
      id: product.productKey,
      network: product.network,
      dataAmount: product.dataAmount || product.name,
      dataBytesValue: 0,
      validity: product.validity || 'Instant Direct',
      validityCategory: 'Daily',
      priceGhc: finalPrice,
      serviceType: 'instant_bundle',
      description:
        product.description ||
        `Instant ${product.network.toUpperCase()} bundle with direct automated delivery.`,
      packageId: product.packageId,
      isFlexi: product.isFlexi,
      minAmountGhc: product.minAmountGhc,
      maxAmountGhc: product.maxAmountGhc,
    };

    openCheckout(convertedBundle, { recipientPhone: options?.recipientPhone });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Instant Bundles Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-xs font-bold text-amber-400 mb-2">
            <Zap className="w-3.5 h-3.5 fill-amber-400" />
            <span>Instant SIM Delivery</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Live Instant Bundles
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Fast direct top-up packages dispatched in real time upon MoMo payment confirmation.
          </p>
        </div>

        {/* Network Filter Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedNetwork('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedNetwork === 'all'
                ? 'bg-amber-400 text-black shadow-md'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All Networks
          </button>
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
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
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

      {/* Search Input */}
      {isAvailable && products.length > 0 && (
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search instant packages (e.g. 5GB, 10GB)..."
            className="w-full bg-[#0e141a] border border-slate-800 focus:border-amber-500/80 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white focus:outline-none transition-colors"
          />
        </div>
      )}

      {/* Loading Skeleton State */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-[#0f151b] border border-slate-800/80 animate-pulse space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-800" />
                  <div className="w-20 h-4 rounded bg-slate-800" />
                </div>
                <div className="w-16 h-5 rounded-full bg-slate-800" />
              </div>
              <div className="space-y-2">
                <div className="w-28 h-6 rounded bg-slate-800" />
                <div className="w-full h-3 rounded bg-slate-800" />
              </div>
              <div className="w-full h-9 rounded-xl bg-slate-800" />
              <div className="flex justify-between items-center pt-2">
                <div className="w-16 h-5 rounded bg-slate-800" />
                <div className="w-24 h-8 rounded-xl bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="text-center py-12 px-4 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-4 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Temporary Catalogue Issue</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{error}</p>
          </div>
          <div className="flex justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => fetchCatalog(true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={onSwitchToData}
              className="px-4 py-2 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs transition-colors cursor-pointer"
            >
              Browse Standard Bundles
            </button>
          </div>
        </div>
      )}

      {/* Service Unavailable State */}
      {!isLoading && !error && !isAvailable && (
        <div className="text-center py-12 px-4 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-4 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Instant Bundles Unavailable</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {unavailableReason ||
                'Instant Bundles are temporarily unavailable from suppliers. You can still purchase standard Data Bundles with fast automated delivery.'}
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={onSwitchToData}
              className="px-5 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
            >
              Browse Data Bundles
            </button>
          </div>
        </div>
      )}

      {/* Empty Filter State */}
      {!isLoading && !error && isAvailable && filteredProducts.length === 0 && (
        <div className="text-center py-12 px-4 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-4 max-w-md mx-auto">
          <PackageX className="w-10 h-10 text-slate-500 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-white">No Matching Packages</h3>
            <p className="text-xs text-slate-400 mt-1">
              No instant bundles match your selected filter or search query.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedNetwork('all');
              setSearchQuery('');
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Live Products Grid */}
      {!isLoading && !error && isAvailable && filteredProducts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <InstantBundleCard
              key={product.productKey}
              product={product}
              recipientPhone={quickBuyPhone}
              onPhoneChange={onQuickBuyPhoneChange}
              onBuy={handleBuy}
            />
          ))}
        </div>
      )}
    </div>
  );
};
