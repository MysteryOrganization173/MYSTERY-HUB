import { MARKETPLACE_LIMITS } from '../../../../shared/marketplaceLimits';
import { FULFILMENT_MODES, FULFILMENT_LABELS, ProductKind, FulfilmentMode, productReadiness } from '../../../../shared/marketplacePolicy';
import { marketplaceControlRequest, ManagedCategory } from '../../../services/marketplaceControls';
import { MarketplaceControlPanels, MarketplacePreviewAction } from './MarketplaceControlPanels';
import { MarketplaceProductEditor } from './MarketplaceProductEditor';
import { MarketplaceProductDetailModal } from '../../marketplace/MarketplaceProductDetailModal';
import React, { useState, useEffect, useCallback } from 'react';
import { MarketplaceProduct, MarketplaceCategory } from '../../../types';
import {
  getAdminMarketplaceProducts,
  createAdminMarketplaceProduct,
  updateAdminMarketplaceProduct,
  publishAdminMarketplaceProduct,
  unpublishAdminMarketplaceProduct,
  featureAdminMarketplaceProduct,
  unfeatureAdminMarketplaceProduct,
  archiveAdminMarketplaceProduct,
  importMarketplaceProductWithAi,
  AdminMarketplaceMetrics,
} from '../../../services/apiClient';

import { useApp } from '../../../context/AppContext';
import { AdminButton, AdminPageHeader, AdminStat, AdminTabs, ConfirmAction, adminField, adminLabel } from '../ui/AdminUi';
import {
  Store,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Star,
  Archive,
  Edit,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  ExternalLink,
  Layers,
  Sparkles,
  AlertTriangle,
  X,
  Check,
  ChevronDown,
  Info,
  Gift,
  MapPin,
} from 'lucide-react';

interface AdminMarketplaceSectionProps {
  sessionToken: string;
  /** Deep link from the admin hash route: products | inquiries | categories. */
  initialView?: string;
  /** Lets the shell refresh navigation badges after inquiry or product changes. */
  onChanged?: () => void;
}
type MarketplaceView = 'products' | 'inquiries' | 'categories';
const MARKETPLACE_VIEWS: MarketplaceView[] = ['products', 'inquiries', 'categories'];

export const AdminMarketplaceSection: React.FC<AdminMarketplaceSectionProps> = ({ sessionToken, initialView, onChanged }) => {
  const { showToast } = useApp();
  const [view, setView] = useState<MarketplaceView>(MARKETPLACE_VIEWS.includes(initialView as MarketplaceView) ? initialView as MarketplaceView : 'products');
  const changeView = (next: MarketplaceView) => {
    setView(next);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `#marketplace${next === 'products' ? '' : `/${next}`}`);
  };

  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [metrics, setMetrics] = useState<AdminMarketplaceMetrics>({
    total: 0,
    published: 0,
    drafts: 0,
    featured: 0,
    archived: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categories,setCategories] = useState<ManagedCategory[]>([]);
  const [selectedKind,setSelectedKind] = useState('all');
  const [preview,setPreview] = useState<MarketplaceProduct|null>(null);
  const loadCategories = useCallback(async()=>{try{const data=await marketplaceControlRequest('categories',sessionToken);setCategories(data.categories);}catch(e){setError(e instanceof Error?e.message:'Unable to load categories.');}},[sessionToken]);
  useEffect(()=>{loadCategories();},[loadCategories]);
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Product editor (null product = new)
  const [editor, setEditor] = useState<{ product: MarketplaceProduct | null } | null>(null);

  // Archive Confirmation Modal
  const [archiveTarget, setArchiveTarget] = useState<MarketplaceProduct | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminMarketplaceProducts(sessionToken, {
        productKind: selectedKind !== 'all' ? selectedKind : undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        status: selectedStatus !== 'all' && selectedStatus !== 'needs_review' ? selectedStatus : undefined,
        search: searchQuery.trim() || undefined,
      });
      const rows = data.products || [];
      // "Needs fixes" uses the server's readiness verdict returned with each product.
      setProducts(selectedStatus === 'needs_review' ? rows.filter(p => !p.archived && (p as MarketplaceProduct & { readiness?: { ready?: boolean } }).readiness?.ready === false) : rows);
      if (data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Failed to load admin marketplace products:', err);
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [sessionToken, selectedCategory, selectedStatus, searchQuery, selectedKind]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const openAddModal = () => setEditor({ product: null });
  const openEditModal = (p: MarketplaceProduct) => setEditor({ product: p });

  const [publishWarnings, setPublishWarnings] = useState<{ product: MarketplaceProduct; warnings: string[] } | null>(null);
  const handleTogglePublish = async (product: MarketplaceProduct, warningsAccepted = false) => {
    try {
      if (product.published) {
        await unpublishAdminMarketplaceProduct(sessionToken, product.id);
        showToast(`"${product.name}" moved to drafts.`, 'info');
      } else {
        const readiness=product.readiness || productReadiness(product,categories);
        if(readiness.blockers.length){showToast(readiness.blockers.join(' '),'warning');return;}
        if(readiness.warnings.length&&!warningsAccepted){setPublishWarnings({product,warnings:readiness.warnings});return;}
        await publishAdminMarketplaceProduct(sessionToken, product.id, true);
        showToast(`"${product.name}" published live to store!`, 'success');
      }
      fetchProducts();
      onChanged?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', 'warning');
    }
  };

  const handleToggleFeature = async (product: MarketplaceProduct) => {
    try {
      if (product.featured) {
        await unfeatureAdminMarketplaceProduct(sessionToken, product.id);
        showToast(`"${product.name}" removed from featured.`, 'info');
      } else {
        await featureAdminMarketplaceProduct(sessionToken, product.id);
        showToast(`"${product.name}" marked as featured.`, 'success');
      }
      fetchProducts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', 'warning');
    }
  };

  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    setIsArchiving(true);
    try {
      await archiveAdminMarketplaceProduct(sessionToken, archiveTarget.id);
      showToast(`Product "${archiveTarget.name}" archived.`, 'success');
      setArchiveTarget(null);
      fetchProducts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to archive', 'warning');
    } finally {
      setIsArchiving(false);
    }
  };

  const extraAction = async(p:MarketplaceProduct,action:string)=>{try{const result=await marketplaceControlRequest('products/'+p.id+'/'+action,sessionToken,'POST',{});await fetchProducts();if(action==='duplicate')openEditModal(result.product);}catch(e){showToast(e instanceof Error?e.message:'Action failed','warning');}};
  return (
    <div className="space-y-6 text-slate-100">
      <AdminPageHeader
        title="Marketplace"
        description="Physical products, digital subscriptions and services you sell to customers in Ghana."
        actions={view==='products'?<AdminButton variant="primary" onClick={openAddModal}><Plus className="h-4 w-4" />Add product</AdminButton>:undefined}
      />
      <AdminTabs label="Marketplace views" value={view} onChange={changeView} tabs={[
        {id:'products',label:'Products',count:metrics.total},
        {id:'inquiries',label:'Inquiries',count:metrics.newInquiries||null,tone:metrics.newInquiries?'warning':'neutral'},
        {id:'categories',label:'Categories'},
      ]} />
      {view==='products'&&<>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <AdminStat label="Live" value={metrics.published} tone="success" onClick={()=>setSelectedStatus('published')} actionLabel="Show" />
        <AdminStat label="Drafts" value={metrics.drafts} onClick={()=>setSelectedStatus('draft')} actionLabel="Show" />
        <AdminStat label="Need fixes" value={metrics.needsReview ?? 0} tone={metrics.needsReview?'warning':'neutral'} onClick={()=>setSelectedStatus('needs_review')} actionLabel="Show" />
      </div>
      <p className="text-xs text-slate-400">{metrics.featured} featured · <button type="button" className="text-[#7dffbf] underline-offset-2 hover:underline" onClick={()=>setSelectedStatus('archived')}>{metrics.archived} archived</button> · active catalogue {metrics.physical||0} physical, {metrics.digital||0} digital, {metrics.service||0} service. "Need fixes" counts products missing something required or recommended before publishing.</p>

      <div className="space-y-3 rounded-2xl border border-slate-800/90 bg-[#0b1116] p-3 sm:p-4">
        <label className="relative block">
          <span className="sr-only">Search products</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, tagline or slug" className={`${adminField} pl-10`} />
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className={adminLabel}><span className="text-xs">Status</span>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className={adminField}>
              <option value="all">All statuses</option>
              <option value="published">Live</option>
              <option value="draft">Drafts</option>
              <option value="needs_review">Needs fixes before publishing</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className={adminLabel}><span className="text-xs">Category</span>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className={adminField}>
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </select>
          </label>
          <label className={adminLabel}><span className="text-xs">Product Type</span>
            <select className={adminField} value={selectedKind} onChange={e=>setSelectedKind(e.target.value)}><option value="all">All types</option><option value="physical">Physical</option><option value="digital">Digital</option><option value="service">Service</option></select>
          </label>
        </div>
      </div>
      {/* 3. Product Listings Table / Cards */}
      {loading ? (
        <div className="p-12 text-center rounded-2xl bg-[#0f171d] border border-slate-800 space-y-3">
          <RefreshCw className="w-6 h-6 text-[#00c365] animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading marketplace catalogue...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center rounded-2xl bg-[#0f171d] border border-red-500/30 space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <h3 className="text-sm font-bold text-white">Failed to load marketplace products</h3>
          <p className="text-xs text-slate-400">{error}</p>
          <button
            onClick={fetchProducts}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
          >
            Retry
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0f171d] border border-slate-800 space-y-3">
          <Store className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">No products found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {metrics.total === 0
              ? 'No products have been added yet. Click "+ Add Product" to list your first sourcing item.'
              : 'No products match your search or filter criteria.'}
          </p>
          {metrics.total === 0 && (
            <button
              onClick={openAddModal}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00c365] text-black font-bold text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Product</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => {
            const isArchived = Boolean(p.archived);
            const isPublished = Boolean(p.published);

            return (
              <div
                key={p.id}
                className={`p-4 rounded-2xl bg-[#0f171d] border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isArchived
                    ? 'border-slate-800/50 opacity-60 bg-[#080d11]'
                    : isPublished
                    ? 'border-slate-800 hover:border-slate-700'
                    : 'border-amber-500/20 bg-[#12161b]'
                }`}
              >
                {/* Left: Product Info & Image Preview */}
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-xl bg-[#090d10] border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden relative">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.imageAlt || p.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-600" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white truncate">{p.name}</h4>
                      {p.featured && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.2 rounded-md">
                          <Star className="w-2.5 h-2.5 fill-amber-400" />
                          <span>Featured</span>
                        </span>
                      )}
                      {p.badge && (
                        <span className="text-[10px] font-semibold text-slate-300 bg-slate-800 px-2 py-0.2 rounded-md">
                          {p.badge}
                        </span>
                      )}
                      {p.referralRewardGhc && p.referralRewardGhc > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#00c365] bg-[#00c365]/10 border border-[#00c365]/30 px-2 py-0.5 rounded-md">
                          <Gift className="w-2.5 h-2.5 text-amber-400" />
                          <span>Earn GH₵{p.referralRewardGhc.toLocaleString()}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                      <span className="text-[#00c365] font-semibold">{p.categoryLabel}</span>
                      <span>·</span>
                      <span className="font-mono text-[11px] text-slate-400">/{p.slug}</span>
                      <span>·</span>
                      <span className="text-slate-300 font-bold">{p.priceDisplay}</span>
                    </div>

                    {p.tagline && (
                      <p className="text-xs text-slate-400 line-clamp-1">{p.tagline}</p>
                    )}
                  </div>
                </div>

                {/* Right: Status Badges & Operational Actions */}
                <div className="flex items-center gap-2 self-end md:self-auto shrink-0 flex-wrap">
                  {/* Published Status Pill */}
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                      isArchived
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : isPublished
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {isArchived ? 'Archived' : isPublished ? 'Live' : 'Draft'}{!isArchived && p.readiness && !p.readiness.ready ? (p.readiness.blockers.length ? ' · Needs fixes' : ' · Could be better') : ''}
                  </span>

                  {!isArchived && <button type="button" onClick={() => openEditModal(p)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#00c365] px-3 text-xs font-semibold text-black hover:bg-[#00e575]"><Edit className="h-3.5 w-3.5" />Edit</button>}
                  <details className="relative"><summary className="inline-flex min-h-10 cursor-pointer items-center rounded-xl border border-slate-700 px-3 text-xs">More</summary><div className="flex flex-wrap gap-2 pt-2">
                  <button type="button" className="px-3 py-2 rounded-lg bg-slate-900 text-xs" onClick={()=>extraAction(p,'duplicate')}>Duplicate</button>
                  {isArchived&&<button type="button" className="px-3 py-2 rounded-lg bg-slate-900 text-xs" onClick={()=>extraAction(p,'restore')}>Restore to Draft</button>}
                  <MarketplacePreviewAction product={p} onDraftPreview={()=>setPreview(p)} />
                  {/* Feature Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleFeature(p)}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      p.featured
                        ? 'bg-amber-400/15 border-amber-400/30 text-amber-400 hover:bg-amber-400/25'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                    title={p.featured ? 'Unfeature product' : 'Feature product'}
                  >
                    <Star className={`w-3.5 h-3.5 ${p.featured ? 'fill-amber-400' : ''}`} />
                  </button>

                  {/* Publish / Unpublish Action */}
                  {!isArchived && (
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(p)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        isPublished
                          ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                          : 'bg-[#00c365]/10 border-[#00c365]/30 text-[#00c365] hover:bg-[#00c365]/20 font-bold'
                      }`}
                    >
                      {isPublished ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Unpublish</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Publish</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Edit Action */}
                  <button
                    type="button"
                    onClick={() => openEditModal(p)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5 text-[#00c365]" />
                    <span>Edit</span>
                  </button>

                  {/* Archive Action */}
                  {!isArchived && (
                    <button
                      type="button"
                      onClick={() => setArchiveTarget(p)}
                      className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                      title="Archive product"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}
                  </div></details>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>}

      {view!=='products'&&<MarketplaceControlPanels token={sessionToken} view={view} categories={categories} onCategoriesChanged={loadCategories} products={products} onChanged={()=>{void fetchProducts();onChanged?.();}} onEditProduct={openEditModal} />}
      {preview&&<MarketplaceProductDetailModal product={preview} onClose={()=>setPreview(null)} onBuyNow={()=>showToast('Internal draft preview: purchasing is disabled.','info')} onInquire={()=>showToast('Internal draft preview.','info')} onShare={()=>showToast('Drafts cannot be shared publicly.','info')} formatGhcReward={n=>'GH₵'+(n ?? 0).toFixed(2)} />}
      {publishWarnings && (
        <ConfirmAction
          title={`Publish "${publishWarnings.product.name}"?`}
          summary={<ul className="list-disc space-y-1 pl-5">{publishWarnings.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
          warning="These are optional gaps. Customers will see the product as it is."
          confirmLabel="Publish anyway"
          onClose={() => setPublishWarnings(null)}
          onConfirm={() => { const target = publishWarnings.product; setPublishWarnings(null); void handleTogglePublish(target, true); }}
        />
      )}
      {editor && (
        <MarketplaceProductEditor
          token={sessionToken}
          product={editor.product}
          categories={categories}
          products={products}
          onClose={() => setEditor(null)}
          onSaved={message => { setEditor(null); showToast(message, 'success'); void fetchProducts(); onChanged?.(); }}
        />
      )}

      {/* 5. Archive Confirmation Dialog */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0e141a] border border-red-500/30 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
              <Archive className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-bold text-lg text-white">Archive Product?</h3>
              <p className="text-xs text-slate-300">
                Are you sure you want to archive <span className="font-bold text-white">"{archiveTarget.name}"</span>?
              </p>
              <p className="text-[11px] text-slate-400">
                Archived products are hidden from the public storefront and catalog queries, but remain in the Admin database for historical records.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isArchiving}
                onClick={handleConfirmArchive}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                {isArchiving ? 'Archiving...' : 'Archive Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
