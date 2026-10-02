import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { getInstantBundlesOnServer, PublicInstantBundle } from '../../services/apiClient';
import { InstantBundleCard } from './InstantBundleCard';
import { NetworkId, DataBundle } from '../../types';
import { GHANA_NETWORKS } from '../../data/bundles';
import {
  getInstantBundlePresentation,
  InstantBundleCategoryType,
} from '../../utils/instantBundleUtils';
import {
  Zap,
  Search,
  RefreshCw,
  AlertCircle,
  Clock,
  PackageX,
} from 'lucide-react';

interface InstantBundlesCatalogProps {
  quickBuyPhone: string;
  onQuickBuyPhoneChange: (phone: string) => void;
  onSwitchToData: () => void;
  activeNetwork?: NetworkId | 'all';
  onSelectNetwork?: (net: NetworkId | 'all') => void;
}

export const InstantBundlesCatalog: React.FC<InstantBundlesCatalogProps> = ({
  quickBuyPhone,
  onQuickBuyPhoneChange,
  onSwitchToData,
  activeNetwork: controlledNetwork,
  onSelectNetwork: controlledOnSelectNetwork,
}) => {
  const { openCheckout } = useApp();

  const [products, setProducts] = useState<PublicInstantBundle[]>([]);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [internalSelectedNetwork, setInternalSelectedNetwork] = useState<NetworkId | 'all'>('all');
  const selectedNetwork = controlledNetwork !== undefined ? controlledNetwork : internalSelectedNetwork;
  const setSelectedNetwork = (net: NetworkId | 'all') => {
    setInternalSelectedNetwork(net);
    controlledOnSelectNetwork?.(net);
  };

  const [selectedCategory, setSelectedCategory] = useState<InstantBundleCategoryType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch live catalogue
  const fetchCatalog = async () => {
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

  // Compute actual categories present in the loaded catalogue
  const presentCategories = useMemo(() => {
    const categoryOrder: InstantBundleCategoryType[] = ['data', 'video', 'social', 'midnight', 'idd'];
    const foundSet = new Set<InstantBundleCategoryType>();
    
    products.forEach((p) => {
      const info = getInstantBundlePresentation(p);
      foundSet.add(info.categoryKey);
    });

    return categoryOrder.filter((cat) => foundSet.has(cat));
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Network filter
      if (selectedNetwork !== 'all' && p.network !== selectedNetwork) {
        return false;
      }
      
      const info = getInstantBundlePresentation(p);

      // 2. Category filter
      if (selectedCategory !== 'all' && info.categoryKey !== selectedCategory) {
        return false;
      }

      // 3. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchData = (p.dataAmount || '').toLowerCase().includes(q);
        const matchNet = p.network.toLowerCase().includes(q);
        const matchCat = info.categoryLabel.toLowerCase().includes(q);
        return matchName || matchData || matchNet || matchCat;
      }
      return true;
    });
  }, [products, selectedNetwork, selectedCategory, searchQuery]);

  const handleBuy = (
    product: PublicInstantBundle,
    options?: { recipientPhone?: string; flexiAmount?: number }
  ) => {
    const finalPrice =
      product.isFlexi && options?.flexiAmount ? options.flexiAmount : product.retailPriceGhc;

    const info = getInstantBundlePresentation(product);

    const convertedBundle: DataBundle = {
      id: product.productKey,
      network: product.network,
      dataAmount: info.formattedAmount,
      dataBytesValue: 0,
      validity: product.validity || 'Instant Direct',
      validityCategory: 'Daily',
      priceGhc: finalPrice,
      faceValueGhc: finalPrice,
      serviceFeeGhc: product.paymentProcessingFeeGhc,
      estimatedTotalGhc: product.estimatedTotalGhc,
      networkReferencePriceGhc: product.networkReferencePriceGhc,
      savingsOnProductGhc: product.savingsOnProductGhc,
      serviceType: 'instant_bundle',
      category: info.categoryLabel,
      restrictionNote: info.restrictionNote,
      description:
        info.restrictionNote ||
        product.description ||
        `Instant ${product.network.toUpperCase()} bundle with direct automated delivery.`,
      packageId: product.packageId,
      isFlexi: product.isFlexi,
      minAmountGhc: product.minAmountGhc,
      maxAmountGhc: product.maxAmountGhc,
    };

    openCheckout(convertedBundle, { recipientPhone: options?.recipientPhone });
  };

  const getCategoryFilterLabel = (cat: InstantBundleCategoryType) => {
    switch (cat) {
      case 'data':
        return 'Standard Data';
      case 'video':
        return 'Video';
      case 'social':
        return 'Social Media';
      case 'midnight':
        return '🌙 Midnight';
      case 'idd':
        return '📞 International Calls';
      default:
        return cat;
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
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

      {/* Category Filter Pills & Search Bar (Only render if categories exist) */}
      {isAvailable && products.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-[#0e141a] border border-slate-800">
          {/* Second-Level Category Filter Pills */}
          {presentCategories.length > 1 ? (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-[#00c365] text-black shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
                }`}
              >
                All
              </button>
              {presentCategories.map((catKey) => {
                const isSelected = selectedCategory === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setSelectedCategory(catKey)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      isSelected
                        ? catKey === 'midnight'
                          ? 'bg-amber-400 text-black font-bold shadow-sm'
                          : 'bg-[#00c365] text-black font-bold shadow-sm'
                        : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
                    }`}
                  >
                    {getCategoryFilterLabel(catKey)}
                  </button>
                );
              })}
            </div>
          ) : (
            <div />
          )}

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search category, size..."
              className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
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
              onClick={() => fetchCatalog()}
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
              setSelectedCategory('all');
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
