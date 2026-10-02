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
import { MARKETPLACE_CATEGORIES } from '../../../data/marketplace';
import { useApp } from '../../../context/AppContext';
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
}

export const AdminMarketplaceSection: React.FC<AdminMarketplaceSectionProps> = ({ sessionToken }) => {
  const { showToast } = useApp();

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

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MarketplaceProduct | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Archive Confirmation Modal
  const [archiveTarget, setArchiveTarget] = useState<MarketplaceProduct | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formCategory, setFormCategory] = useState<string>('laptops_computers');
  const [formTagline, setFormTagline] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriceType, setFormPriceType] = useState<'fixed' | 'starting_at' | 'quote'>('fixed');
  const [formPriceGhc, setFormPriceGhc] = useState<string>('');
  const [formReferralRewardGhc, setFormReferralRewardGhc] = useState<string>('');
  const [formAvailability, setFormAvailability] = useState<
    'available' | 'check_availability' | 'limited' | 'coming_soon'
  >('available');
  const [formAvailabilityLabel, setFormAvailabilityLabel] = useState('');
  const [formBadge, setFormBadge] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formImageAlt, setFormImageAlt] = useState('');
  const [formFeatured, setFormFeatured] = useState(false);
  const [formPublished, setFormPublished] = useState(true);
  const [formSortOrder, setFormSortOrder] = useState<number>(0);
  const [formHighlights, setFormHighlights] = useState<string[]>(['']);
  const [formSpecs, setFormSpecs] = useState<Array<{ label: string; value: string }>>([
    { label: '', value: '' },
  ]);

  // Image Preview Error Handling
  const [imagePreviewError, setImagePreviewError] = useState(false);

  // AI Importer States
  const [aiAdvertInput, setAiAdvertInput] = useState('');
  const [isParsingAi, setIsParsingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiExtraction, setAiExtraction] = useState<{
    name: string;
    category: string;
    tagline: string;
    description: string;
    priceType: 'fixed' | 'starting_at' | 'quote';
    priceGhc: number | null;
    availability: 'in_stock' | 'sourcing_on_demand' | 'preorder' | 'out_of_stock';
    availabilityLabel: string | null;
    badge: string | null;
    imageAlt: string;
    highlights: string[];
    specs: { label: string; value: string }[];
    detectedPriceOptions: { label: string; priceGhc: number }[];
    detectedPickupLocations?: { city: string; area: string; address: string; landmark?: string }[];
    warnings: string[];
    sourceNotes: string[];
  } | null>(null);
  const [showAiOverwriteConfirm, setShowAiOverwriteConfirm] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminMarketplaceProducts(sessionToken, {
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        search: searchQuery.trim() || undefined,
      });
      setProducts(data.products || []);
      if (data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Failed to load admin marketplace products:', err);
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [sessionToken, selectedCategory, selectedStatus, searchQuery]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormSlug('');
    setFormCategory('laptops_computers');
    setFormTagline('');
    setFormDescription('');
    setFormPriceType('fixed');
    setFormPriceGhc('');
    setFormReferralRewardGhc('');
    setFormAvailability('available');
    setFormAvailabilityLabel('');
    setFormBadge('');
    setFormImageUrl('');
    setFormImageAlt('');
    setFormFeatured(false);
    setFormPublished(true);
    setFormSortOrder(0);
    setFormHighlights(['']);
    setFormSpecs([{ label: '', value: '' }]);
    setImagePreviewError(false);
    setAiAdvertInput('');
    setIsParsingAi(false);
    setAiError(null);
    setAiExtraction(null);
    setShowAiOverwriteConfirm(false);
    setIsModalOpen(true);
  };

  const openEditModal = (p: MarketplaceProduct) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormSlug(p.slug || '');
    setFormCategory(p.category);
    setFormTagline(p.tagline || '');
    setFormDescription(p.description || '');
    setFormPriceType(p.priceType || 'fixed');
    setFormPriceGhc(
      p.priceGhc !== null && p.priceGhc !== undefined
        ? String(p.priceGhc)
        : p.priceMinor
        ? String(p.priceMinor / 100)
        : ''
    );
    setFormReferralRewardGhc(
      p.referralRewardGhc !== null && p.referralRewardGhc !== undefined
        ? String(p.referralRewardGhc)
        : p.referralRewardMinor
        ? String(p.referralRewardMinor / 100)
        : ''
    );
    setFormAvailability(p.availability || 'available');
    setFormAvailabilityLabel(p.availabilityLabel || '');
    setFormBadge(p.badge || '');
    setFormImageUrl(p.imageUrl || '');
    setFormImageAlt(p.imageAlt || '');
    setFormFeatured(Boolean(p.featured));
    setFormPublished(Boolean(p.published));
    setFormSortOrder(p.sortOrder || 0);
    setFormHighlights(p.highlights && p.highlights.length > 0 ? [...p.highlights] : ['']);
    setFormSpecs(
      p.specs && p.specs.length > 0
        ? p.specs.map((s) => ({ label: s.label, value: s.value }))
        : [{ label: '', value: '' }]
    );
    setImagePreviewError(false);
    setAiAdvertInput('');
    setIsParsingAi(false);
    setAiError(null);
    setAiExtraction(null);
    setShowAiOverwriteConfirm(false);
    setIsModalOpen(true);
  };

  const handleParseWithAi = async () => {
    if (!aiAdvertInput || !aiAdvertInput.trim()) {
      setAiError('Please paste a supplier WhatsApp advert to parse.');
      return;
    }

    if (aiAdvertInput.trim().length > 20000) {
      setAiError('This advert is too long. Paste only the product information you want to import.');
      return;
    }

    setIsParsingAi(true);
    setAiError(null);
    setAiExtraction(null);

    try {
      const res = await importMarketplaceProductWithAi(sessionToken, aiAdvertInput.trim());
      if (res.success && res.extraction) {
        setAiExtraction(res.extraction);
      } else {
        setAiError(res.message || 'Failed to extract product details.');
      }
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'Mystery AI couldn\'t parse this advert right now. Your pasted text is still here, so you can retry or fill the form manually.'
      );
    } finally {
      setIsParsingAi(false);
    }
  };

  const handleApplyAiExtraction = (overrideConfirmation = false) => {
    if (!aiExtraction) return;

    // Safety check: if editing an existing product and form already contains field values
    const hasExistingData = Boolean(
      editingProduct &&
        (formName.trim() ||
          formTagline.trim() ||
          formDescription.trim() ||
          (formSpecs.length > 0 && formSpecs[0].label.trim()))
    );

    if (hasExistingData && !overrideConfirmation) {
      setShowAiOverwriteConfirm(true);
      return;
    }

    // Apply extracted values to form state
    setFormName(aiExtraction.name);
    setFormCategory(aiExtraction.category || 'laptops_computers');
    setFormTagline(aiExtraction.tagline || '');
    setFormDescription(aiExtraction.description || '');
    setFormPriceType(aiExtraction.priceType || 'fixed');
    setFormPriceGhc(aiExtraction.priceGhc !== null ? String(aiExtraction.priceGhc) : '');

    if (aiExtraction.availability) {
      const availMap: Record<string, 'available' | 'check_availability' | 'limited' | 'coming_soon'> = {
        in_stock: 'available',
        sourcing_on_demand: 'check_availability',
        preorder: 'check_availability',
        out_of_stock: 'check_availability',
      };
      setFormAvailability(availMap[aiExtraction.availability] || 'available');
    }

    setFormAvailabilityLabel(aiExtraction.availabilityLabel || '');
    if (aiExtraction.badge) setFormBadge(aiExtraction.badge);
    if (aiExtraction.imageAlt) setFormImageAlt(aiExtraction.imageAlt);

    if (aiExtraction.highlights && aiExtraction.highlights.length > 0) {
      setFormHighlights(aiExtraction.highlights);
    }

    // Build specs array with extracted specs and price option breakdown
    const newSpecs: Array<{ label: string; value: string }> = [];
    if (aiExtraction.specs && aiExtraction.specs.length > 0) {
      newSpecs.push(...aiExtraction.specs);
    }

    if (aiExtraction.detectedPriceOptions && aiExtraction.detectedPriceOptions.length > 1) {
      aiExtraction.detectedPriceOptions.forEach((opt) => {
        newSpecs.push({
          label: `Config: ${opt.label}`,
          value: `GH₵${opt.priceGhc.toLocaleString()}`,
        });
      });
    }

    if (newSpecs.length > 0) {
      setFormSpecs(newSpecs);
    }

    // NOTE: CRITICAL SAFETY RULE
    // DO NOT wipe or overwrite an existing manually entered formImageUrl!

    setShowAiOverwriteConfirm(false);
    showToast(`AI extraction applied for "${aiExtraction.name}". Image URL preserved.`, 'success');
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Product name is required.', 'warning');
      return;
    }

    if (formPriceType !== 'quote' && (!formPriceGhc || parseFloat(formPriceGhc) <= 0)) {
      showToast('Please enter a valid price in GHS.', 'warning');
      return;
    }

    setFormSubmitting(true);
    try {
      const cleanHighlights = formHighlights.map((h) => h.trim()).filter(Boolean);
      const cleanSpecs = formSpecs
        .filter((s) => s.label.trim().length > 0)
        .map((s) => ({ label: s.label.trim(), value: s.value.trim() }));

      const payload: Record<string, unknown> = {
        name: formName.trim(),
        slug: formSlug.trim() || undefined,
        category: formCategory,
        tagline: formTagline.trim() || undefined,
        description: formDescription.trim() || undefined,
        priceType: formPriceType,
        priceGhc: formPriceType !== 'quote' ? parseFloat(formPriceGhc) : undefined,
        referralRewardGhc: formReferralRewardGhc && parseFloat(formReferralRewardGhc) > 0 ? parseFloat(formReferralRewardGhc) : null,
        availability: formAvailability,
        availabilityLabel: formAvailabilityLabel.trim() || undefined,
        badge: formBadge.trim() || undefined,
        imageUrl: formImageUrl.trim() || undefined,
        imageAlt: formImageAlt.trim() || undefined,
        highlights: cleanHighlights,
        specs: cleanSpecs,
        featured: formFeatured,
        published: formPublished,
        sortOrder: formSortOrder,
      };

      if (editingProduct) {
        await updateAdminMarketplaceProduct(sessionToken, editingProduct.id, payload);
        showToast(`Product "${formName}" updated successfully!`, 'success');
      } else {
        await createAdminMarketplaceProduct(sessionToken, payload);
        showToast(`Product "${formName}" created successfully!`, 'success');
      }

      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      console.error('Failed to save product:', err);
      showToast(err instanceof Error ? err.message : 'Failed to save product.', 'warning');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleTogglePublish = async (product: MarketplaceProduct) => {
    try {
      if (product.published) {
        await unpublishAdminMarketplaceProduct(sessionToken, product.id);
        showToast(`"${product.name}" moved to drafts.`, 'info');
      } else {
        await publishAdminMarketplaceProduct(sessionToken, product.id);
        showToast(`"${product.name}" published live to store!`, 'success');
      }
      fetchProducts();
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

  return (
    <div className="space-y-6 text-slate-100">
      {/* 1. Header & Summary Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-[#00c365]" />
            <span>Marketplace Sourcing Catalogue</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Create, price, and manage quality hardware, creator gear, and software products sourced for Ghanaian customers.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#00c365]/20 cursor-pointer self-start sm:self-auto active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800/90">
          <span className="text-[11px] font-semibold text-slate-400 block">Total Products</span>
          <span className="text-2xl font-extrabold text-white mt-1 block tabular-nums">
            {metrics.total}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0f171d] border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-400">Published Live</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <span className="text-2xl font-extrabold text-white mt-1 block tabular-nums">
            {metrics.published}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800/90">
          <span className="text-[11px] font-semibold text-slate-400 block">Drafts / Unpublished</span>
          <span className="text-2xl font-extrabold text-slate-300 mt-1 block tabular-nums">
            {metrics.drafts}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0f171d] border border-amber-500/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-400">Featured</span>
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          </div>
          <span className="text-2xl font-extrabold text-white mt-1 block tabular-nums">
            {metrics.featured}
          </span>
        </div>
      </div>

      {/* 2. Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by name, tagline, or slug..."
              className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
            />
          </div>

          {/* Category Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00c365]"
            >
              <option value="all">All Categories</option>
              {MARKETPLACE_CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00c365]"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published Only</option>
              <option value="draft">Drafts Only</option>
              <option value="archived">Archived Only</option>
            </select>
          </div>
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
                    {isArchived ? 'Archived' : isPublished ? 'Live' : 'Draft'}
                  </span>

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
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-[#0e141a] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#090d11]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#00c365]/15 border border-[#00c365]/30 flex items-center justify-center text-[#00c365]">
                  <Store className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-white">
                  {editingProduct ? `Edit "${editingProduct.name}"` : 'Add New Marketplace Product'}
                </h3>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* ✨ Mystery AI Supplier Advert Importer Panel */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-[#0a1713] via-[#0b1418] to-[#0d1217] border border-[#00c365]/35 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[#00c365]/20 border border-[#00c365]/40 flex items-center justify-center text-[#00c365]">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-white">Import Product with AI</h4>
                      <p className="text-[11px] text-slate-300">
                        Paste a supplier advert and Mystery AI will extract product details for you. Nothing is published until you review and save.
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-block text-[10px] font-bold text-[#00c365] bg-[#00c365]/10 border border-[#00c365]/20 px-2 py-0.5 rounded-full">
                    Draft Only · Safe Review
                  </span>
                </div>

                <div className="space-y-2">
                  <textarea
                    rows={4}
                    value={aiAdvertInput}
                    onChange={(e) => setAiAdvertInput(e.target.value)}
                    placeholder="Paste the full WhatsApp supplier advert here (e.g. 💻 HP EliteBook 745 G6... Processor, RAM, Storage, Prices...)"
                    className="w-full bg-[#070b0e] border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00c365] font-mono leading-relaxed"
                  />

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400">
                      {aiAdvertInput.length > 0 ? `${aiAdvertInput.length.toLocaleString()} characters` : 'AI populates draft fields for review'}
                    </span>

                    <button
                      type="button"
                      disabled={isParsingAi || !aiAdvertInput.trim()}
                      onClick={handleParseWithAi}
                      className="px-4 py-2 rounded-xl bg-[#00c365] hover:bg-[#00e575] disabled:opacity-50 text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isParsingAi ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Reading Advert...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Parse & Fill Form</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Error Callout */}
                {aiError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Parsing Error</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">{aiError}</p>
                  </div>
                )}

                {/* AI Extraction Preview Panel */}
                {aiExtraction && (
                  <div className="p-3.5 rounded-xl bg-[#080d11] border border-[#00c365]/40 space-y-2.5 mt-2 shadow-inner text-xs">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-white text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[#00c365]" />
                        <span>Extracted Draft Preview</span>
                      </span>
                      <span className="text-[10px] font-semibold text-[#00c365] bg-[#00c365]/10 px-2 py-0.5 rounded">
                        Category: {aiExtraction.category}
                      </span>
                    </div>

                    <div className="space-y-2 text-slate-300">
                      <div className="flex justify-between font-bold text-white text-sm">
                        <span>{aiExtraction.name}</span>
                        <span className="text-[#00c365]">
                          {aiExtraction.priceGhc ? `GH₵${aiExtraction.priceGhc.toLocaleString()} (${aiExtraction.priceType})` : 'Quote'}
                        </span>
                      </div>
                      {aiExtraction.tagline && <p className="text-[11px] text-slate-300 italic">{aiExtraction.tagline}</p>}

                      {/* Detected Price Options */}
                      {aiExtraction.detectedPriceOptions && aiExtraction.detectedPriceOptions.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-[#0e141a] border border-slate-800 space-y-1 text-[11px]">
                          <span className="font-bold text-white block">Detected Price / Config Options ({aiExtraction.detectedPriceOptions.length}):</span>
                          {aiExtraction.detectedPriceOptions.map((opt, i) => (
                            <div key={i} className="flex justify-between text-slate-300">
                              <span>• {opt.label}</span>
                              <span className="font-mono text-white font-bold">GH₵{opt.priceGhc.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Detected Pickup Locations */}
                      {aiExtraction.detectedPickupLocations && aiExtraction.detectedPickupLocations.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-[#0e141a] border border-slate-800 space-y-1 text-[11px]">
                          <span className="font-bold text-white block flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#00c365]" />
                            <span>Detected Pickup Locations ({aiExtraction.detectedPickupLocations.length}):</span>
                          </span>
                          {aiExtraction.detectedPickupLocations.map((loc, i) => (
                            <div key={i} className="text-slate-300">
                              • <span className="font-bold text-white">{loc.city}</span> ({loc.area}): {loc.address}{' '}
                              {loc.landmark ? `[${loc.landmark}]` : ''}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Warnings */}
                      {aiExtraction.warnings && aiExtraction.warnings.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 space-y-1">
                          <span className="font-bold block flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            <span>Review Before Publishing:</span>
                          </span>
                          {aiExtraction.warnings.map((w, i) => (
                            <p key={i}>• {w}</p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setAiExtraction(null)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyAiExtraction(false)}
                        className="px-4 py-1.5 rounded-lg bg-[#00c365] hover:bg-[#00e575] text-black text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        Apply to Form
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Overwrite Confirmation Overlay / Callout */}
              {showAiOverwriteConfirm && (
                <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Confirm Applying AI Extraction</span>
                  </div>
                  <p className="text-[11px] text-slate-200 leading-relaxed">
                    Existing product form fields will be updated with extracted values. Your manually entered product image URL will be preserved.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleApplyAiExtraction(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-400 text-black font-bold text-xs cursor-pointer"
                    >
                      Overwrite & Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAiOverwriteConfirm(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-semibold text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Product Name & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-200 block">
                    Product Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Business Productivity Ultrabook (14&quot;)"
                    className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-200 block">
                    Custom Slug <span className="text-slate-500">(Auto-generated if empty)</span>
                  </label>
                  <input
                    type="text"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    placeholder="e.g. hp-probook-450-g9"
                    className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365] font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Category & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-200 block">Category <span className="text-red-400">*</span></label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#00c365]"
                  >
                    {MARKETPLACE_CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-200 block">
                    Badge Tag <span className="text-slate-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    placeholder="e.g. Popular for Work, High Performance"
                    className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
                  />
                </div>
              </div>

              {/* Tagline */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-200 block">Short Tagline</label>
                <input
                  type="text"
                  value={formTagline}
                  onChange={(e) => setFormTagline(e.target.value)}
                  placeholder="e.g. Lightweight, all-day battery life for Ghanaian professionals and founders"
                  className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
                />
              </div>

              {/* Pricing Section */}
              <div className="p-4 rounded-xl bg-[#090d10] border border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-xs">Price & Commercial Rules</span>
                  <span className="text-[10px] text-slate-400">Stored accurately in integer pesewas</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-300 block">Price Type</label>
                    <select
                      value={formPriceType}
                      onChange={(e) => setFormPriceType(e.target.value as 'fixed' | 'starting_at' | 'quote')}
                      className="w-full bg-[#11171d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00c365]"
                    >
                      <option value="fixed">Exact Price (e.g. GH₵3,900)</option>
                      <option value="starting_at">Starting From (e.g. From GH₵6,800)</option>
                      <option value="quote">Request Quote (Custom pricing)</option>
                    </select>
                  </div>

                  {formPriceType !== 'quote' && (
                    <div className="space-y-1.5">
                      <label className="font-semibold text-slate-300 block">
                         Price in GHS (GH₵) <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={formPriceGhc}
                        onChange={(e) => setFormPriceGhc(e.target.value)}
                        placeholder="e.g. 3900"
                        className="w-full bg-[#11171d] border border-slate-700 rounded-xl px-3.5 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
                      />
                    </div>
                  )}

                  {/* Mystery Earn Referral Reward */}
                  <div className="space-y-1.5 sm:col-span-2 pt-2 border-t border-slate-800">
                    <label className="font-semibold text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[#00c365]">
                        <Gift className="w-3.5 h-3.5 text-amber-400" />
                        <span>Mystery Earn Share & Earn Reward (GH₵)</span>
                      </span>
                      <span className="text-slate-500 font-normal text-[11px]">Optional fixed partner reward</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formReferralRewardGhc}
                      onChange={(e) => setFormReferralRewardGhc(e.target.value)}
                      placeholder="e.g. 200 (Leave blank or 0 to disable)"
                      className="w-full bg-[#11171d] border border-slate-700 rounded-xl px-3.5 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
                    />
                    <p className="text-[11px] text-slate-400">
                      When set &gt; 0, members can share this product and earn this amount when a referred customer completes an order.
                    </p>
                  </div>
                </div>
              </div>

              {/* Availability */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-200 block">Availability State</label>
                  <select
                    value={formAvailability}
                    onChange={(e) => setFormAvailability(e.target.value as any)}
                    className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#00c365]"
                  >
                    <option value="available">Available (Sourced on request)</option>
                    <option value="check_availability">Check Availability</option>
                    <option value="limited">Limited Sourcing</option>
                    <option value="coming_soon">Coming Soon</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-200 block">
                    Custom Availability Label <span className="text-slate-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formAvailabilityLabel}
                    onChange={(e) => setFormAvailabilityLabel(e.target.value)}
                    placeholder="e.g. Inquire for Setup, Ready in Accra"
                    className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
                  />
                </div>
              </div>

              {/* Product Image & Live Preview */}
              <div className="p-4 rounded-xl bg-[#090d10] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">Product Image</span>
                  <span className="text-[10px] text-slate-400">Cloudinary or HTTPS image URL</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-start">
                  <div className="sm:col-span-8 space-y-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-300 block">Image URL</label>
                      <input
                        type="url"
                        value={formImageUrl}
                        onChange={(e) => {
                          setFormImageUrl(e.target.value);
                          setImagePreviewError(false);
                        }}
                        placeholder="https://res.cloudinary.com/.../laptop.png"
                        className="w-full bg-[#11171d] border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365] font-mono text-[11px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-300 block">Image Alt Text</label>
                      <input
                        type="text"
                        value={formImageAlt}
                        onChange={(e) => setFormImageAlt(e.target.value)}
                        placeholder="e.g. Silver 14-inch Business Ultrabook front view"
                        className="w-full bg-[#11171d] border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
                      />
                    </div>
                  </div>

                  {/* Image Live Preview */}
                  <div className="sm:col-span-4 flex flex-col items-center justify-center p-2 rounded-xl bg-[#11171d] border border-slate-700 min-h-[100px] text-center overflow-hidden">
                    {formImageUrl && !imagePreviewError ? (
                      <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-[#090d10] border border-slate-800">
                        <img
                          src={formImageUrl}
                          alt="Live preview"
                          className="w-full h-full object-cover"
                          onError={() => setImagePreviewError(true)}
                        />
                      </div>
                    ) : imagePreviewError ? (
                      <div className="text-red-400 space-y-1 py-2">
                        <AlertCircle className="w-5 h-5 mx-auto" />
                        <span className="text-[10px] block">Image failed to load</span>
                      </div>
                    ) : (
                      <div className="text-slate-500 space-y-1 py-4">
                        <ImageIcon className="w-6 h-6 mx-auto opacity-50" />
                        <span className="text-[10px] block">No image preview</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-200 block">Product Description</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Detailed specifications, warranty details, and sourcing arrangements..."
                  className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365] resize-none"
                />
              </div>

              {/* Highlights (Repeatable rows) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200 block">
                    Bullet Highlights <span className="text-slate-500">(2–3 key selling points)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormHighlights([...formHighlights, ''])}
                    className="text-[#00c365] hover:text-[#00e575] font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Bullet</span>
                  </button>
                </div>

                {formHighlights.map((hl, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={hl}
                      onChange={(e) => {
                        const updated = [...formHighlights];
                        updated[i] = e.target.value;
                        setFormHighlights(updated);
                      }}
                      placeholder={`Highlight #${i + 1} (e.g. 16GB RAM / 512GB Fast SSD)`}
                      className="flex-1 bg-[#090d10] border border-slate-700/80 rounded-xl px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
                    />
                    {formHighlights.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFormHighlights(formHighlights.filter((_, idx) => idx !== i))}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Specifications (Label + Value repeatable) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200 block">
                    Technical Specifications <span className="text-slate-500">(Optional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormSpecs([...formSpecs, { label: '', value: '' }])}
                    className="text-[#00c365] hover:text-[#00e575] font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Spec Row</span>
                  </button>
                </div>

                {formSpecs.map((spec, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      value={spec.label}
                      onChange={(e) => {
                        const updated = [...formSpecs];
                        updated[i].label = e.target.value;
                        setFormSpecs(updated);
                      }}
                      placeholder="Label (e.g. RAM)"
                      className="col-span-5 bg-[#090d10] border border-slate-700/80 rounded-xl px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
                    />
                    <input
                      type="text"
                      value={spec.value}
                      onChange={(e) => {
                        const updated = [...formSpecs];
                        updated[i].value = e.target.value;
                        setFormSpecs(updated);
                      }}
                      placeholder="Value (e.g. 16GB DDR4)"
                      className="col-span-6 bg-[#090d10] border border-slate-700/80 rounded-xl px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
                    />
                    {formSpecs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFormSpecs(formSpecs.filter((_, idx) => idx !== i))}
                        className="col-span-1 p-1 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4 mx-auto" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Toggles: Featured & Published */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#090d10] border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formFeatured}
                    onChange={(e) => setFormFeatured(e.target.checked)}
                    className="w-4 h-4 rounded text-[#00c365] bg-slate-900 border-slate-700 focus:ring-0"
                  />
                  <div>
                    <span className="font-bold text-white block">Featured Product</span>
                    <span className="text-[10px] text-slate-400">Prioritized in marketplace sorting</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#090d10] border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formPublished}
                    onChange={(e) => setFormPublished(e.target.checked)}
                    className="w-4 h-4 rounded text-[#00c365] bg-slate-900 border-slate-700 focus:ring-0"
                  />
                  <div>
                    <span className="font-bold text-white block">Published Live</span>
                    <span className="text-[10px] text-slate-400">Visible to customer storefront</span>
                  </div>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-60"
                >
                  {formSubmitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
