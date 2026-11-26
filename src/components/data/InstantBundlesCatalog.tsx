import { DataNetworkSelector } from './DataNetworkSelector';
import { serviceControl, useServiceStatus } from '../../hooks/useServiceStatus';
import { ServiceMaintenanceState } from '../service/ServiceUpdate';
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { getInstantBundlesOnServer, PublicInstantBundle } from '../../services/apiClient';
import { InstantBundleCard, INSTANT_CATEGORY_TONE } from './InstantBundleCard';
import { NetworkId, DataBundle } from '../../types';
import { GHANA_NETWORKS } from '../../data/bundles';
import {
  getInstantBundlePresentation,
  InstantBundleCategoryType,
} from '../../utils/instantBundleUtils';
import { revealPressedChip, revealFocusedChip } from '../../utils/scroll';
import { instantBundleToCheckout } from '../../utils/instantBundleCheckout';
import { Search, RefreshCw, WifiOff, Clock, PackageX, X, Info } from 'lucide-react';

interface InstantBundlesCatalogProps {
  onSwitchToData: () => void;
  activeNetwork?: NetworkId | 'all';
  onSelectNetwork?: (net: NetworkId | 'all') => void;
}

export const InstantBundlesCatalog: React.FC<InstantBundlesCatalogProps> = ({
  onSwitchToData,
  activeNetwork: controlledNetwork,
  onSelectNetwork: controlledOnSelectNetwork,
}) => {
  const { openCheckout } = useApp();
  const serviceStatus = useServiceStatus();

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
  const [searchOpen, setSearchOpen] = useState(false);

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
      setError(err instanceof Error ? err.message : 'We couldn’t load these bundles. Please try again.');
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
      // 3.6.3: only types a customer can actually buy now (a paused network's packages are not offered).
      if (serviceControl('instant_bundle', p.network, serviceStatus)?.blocksPurchases) return;
      const info = getInstantBundlePresentation(p);
      foundSet.add(info.categoryKey);
    });

    return categoryOrder.filter((cat) => foundSet.has(cat));
  }, [products, serviceStatus]);
  const instantPaused = useMemo(() => Object.fromEntries((['mtn', 'airteltigo', 'telecel'] as NetworkId[]).map((n) => [n, Boolean(serviceControl('instant_bundle', n, serviceStatus)?.blocksPurchases)])), [serviceStatus]);
  const instantDelayed = useMemo(() => Object.fromEntries((['mtn', 'airteltigo', 'telecel'] as NetworkId[]).map((n) => [n, serviceControl('instant_bundle', n, serviceStatus)?.state === 'delayed'])), [serviceStatus]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 3.6.3: a network whose Instant Bundles are paused in the Service Control Center is not offered.
      if (serviceControl('instant_bundle', p.network, serviceStatus)?.blocksPurchases) return false;
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
  }, [products, selectedNetwork, selectedCategory, searchQuery, serviceStatus]);

  const handleBuy = (
    product: PublicInstantBundle,
    options?: { flexiAmount?: number }
  ) => {
    openCheckout(instantBundleToCheckout(product, options));
  };

  const getCategoryFilterLabel = (cat: InstantBundleCategoryType) => {
    switch (cat) {
      case 'data':
        return 'Standard Data';
      case 'video':
        return 'Video';
      case 'social':
        return 'Social';
      case 'midnight':
        return 'Midnight';
      case 'idd':
        return 'International calls';
      default:
        return cat;
    }
  };

  const sorted = useMemo(() => [...filteredProducts].sort((a, b) =>
    Number(a.availability === 'out_of_stock') - Number(b.availability === 'out_of_stock')), [filteredProducts]);
  const clearFilters = () => { setSelectedNetwork('all'); setSelectedCategory('all'); setSearchQuery(''); setSearchOpen(false); };
  const stateCard = 'mh-ds-panel mh-ds-swap text-center py-10 px-5 rounded-2xl bg-[#0e141a] border border-slate-800 space-y-3 max-w-md mx-auto';

  return (
    <section aria-labelledby="instant-title" className="space-y-4">
      <div className="space-y-3">
        <div>
          <h2 id="instant-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">Instant Bundles</h2>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Video, social, midnight and standard network packages. Each one shows its conditions, and a small checkout fee is added and shown before you pay.
          </p>
        </div>
        <DataNetworkSelector value={selectedNetwork} onChange={setSelectedNetwork} paused={instantPaused} delayed={instantDelayed} />
      </div>

      {/* Category chips, with search one tap away (the same pattern as Data). */}
      {isAvailable && products.length > 0 && (
        <div className="flex items-center gap-2">
          {searchOpen ? (
            <div className="mh-ds-search relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input type="search" value={searchQuery} autoFocus onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search Instant Bundles by size or type" placeholder="Search size or type, e.g. video" />
            </div>
          ) : (
            <div ref={revealPressedChip} onFocus={revealFocusedChip} role="group" aria-label="Filter by bundle type" className="mh-chip-scroll items-center gap-1.5 min-w-0 flex-1 -ml-4 pl-4 sm:ml-0 sm:pl-0">
              {(['all', ...(presentCategories.length > 1 ? presentCategories : [])] as const).map((catKey) => (
                <button key={catKey} type="button" aria-pressed={selectedCategory === catKey} onClick={() => setSelectedCategory(catKey)}
                  className="mh-ds-chip">
                  {catKey === 'all' ? 'All types' : <span className="inline-flex items-center gap-1.5">{React.createElement(INSTANT_CATEGORY_TONE[catKey].icon, { 'aria-hidden': true, className: 'w-3.5 h-3.5 shrink-0' })}{getCategoryFilterLabel(catKey)}</span>}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => { if (searchOpen) setSearchQuery(''); setSearchOpen(!searchOpen); }}
            aria-label={searchOpen ? 'Close search' : 'Search Instant Bundles'} aria-expanded={searchOpen}
            className="mh-ds-icon-btn">
            {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5" aria-busy="true" aria-label="Loading Instant Bundles">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="mh-ds-instant h-[92px] rounded-2xl bg-[#0e141a] border border-slate-800/80 p-3.5 flex items-center gap-3 animate-pulse motion-reduce:animate-none">
              <div className="w-9 h-9 rounded-xl bg-slate-800" />
              <div className="flex-1 space-y-2"><div className="w-16 h-4 rounded bg-slate-800" /><div className="w-28 h-3 rounded bg-slate-800" /></div>
              <div className="w-20 h-9 rounded-xl bg-slate-800" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className={stateCard} role="alert">
          <WifiOff className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-white">We couldn’t load Instant Bundles</h3>
          <p className="text-sm text-slate-400 leading-relaxed">Check your connection and try again. Nothing has been charged.</p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <button type="button" onClick={() => fetchCatalog()} className="mh-button"><RefreshCw className="w-4 h-4" />Try again</button>
            <button type="button" onClick={onSwitchToData} className="mh-button-secondary">Browse Data bundles</button>
          </div>
        </div>
      )}

      {!isLoading && !error && !isAvailable && (
        <div className={stateCard}>
          <Clock className="w-8 h-8 text-amber-300 mx-auto" />
          <h3 className="text-base font-bold text-white">Instant Bundles are unavailable right now</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            {unavailableReason || 'Instant Bundles are temporarily unavailable. You can still buy standard Data bundles.'}
          </p>
          <button type="button" onClick={onSwitchToData} className="mh-button">Browse Data bundles</button>
        </div>
      )}

      {selectedNetwork !== 'all' && serviceControl('instant_bundle', selectedNetwork, serviceStatus)?.blocksPurchases ? (
        <ServiceMaintenanceState control={serviceControl('instant_bundle', selectedNetwork, serviceStatus)!} onNetwork={setSelectedNetwork} />
      ) : !isLoading && !error && isAvailable && filteredProducts.length === 0 && (
        <div className={stateCard}>
          <PackageX className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">No packages match</h3>
          <p className="text-sm text-slate-400">Try another network or type, or clear your search.</p>
          <button type="button" onClick={clearFilters} className="mh-button">Show all packages</button>
        </div>
      )}

      {!isLoading && !error && isAvailable && filteredProducts.length > 0 && (
        <>
          <p className="text-xs text-slate-400" aria-live="polite">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'package' : 'packages'}
            {selectedNetwork !== 'all' ? ` · ${GHANA_NETWORKS[selectedNetwork].name}` : ' · all networks'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 items-start">
            {sorted.map((product) => (
              <InstantBundleCard key={product.productKey} product={product} onBuy={handleBuy} />
            ))}
          </div>
          <p className="flex items-start justify-center gap-2 pt-1 text-xs text-slate-400 text-center">
            <Info className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Package conditions are set by the network. Track delivery in Orders.</span>
          </p>
        </>
      )}
    </section>
  );
};
