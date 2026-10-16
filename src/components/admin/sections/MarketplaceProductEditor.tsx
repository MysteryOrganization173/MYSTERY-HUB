import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImagePlus, Link2, MapPin, Plus, RotateCcw, Sparkles, Star, Trash2, AlertTriangle, Check, Package, Cloud, Wrench } from 'lucide-react';
import type { MarketplaceProduct, MarketplacePickupLocation, MarketplaceAvailability } from '../../../types';
import type { MarketplaceAiExtractionResult } from '../../../../server/services/marketplaceAiImporter';
import { FULFILMENT_MODES, FULFILMENT_LABELS, type ProductKind, type FulfilmentMode, productReadiness } from '../../../../shared/marketplacePolicy';
import type { ManagedCategory } from '../../../services/marketplaceControls';
import { createAdminMarketplaceProduct, updateAdminMarketplaceProduct, importMarketplaceProductWithAi } from '../../../services/apiClient';
import { getMarketplaceMedia, preparePhoto, uploadMarketplacePhoto, marketplaceThumb, MARKETPLACE_PHOTO_TYPES, type MarketplaceMediaLibrary } from '../../../services/marketplaceMedia';
import { AdminButton, AdminNotice, AdminSheet, ConfirmAction, StatusPill, adminField as field, adminLabel } from '../ui/AdminUi';

const MAX_GALLERY = 8;
const KIND_COPY: Record<ProductKind, { label: string; hint: string; icon: React.ReactNode; defaultMode: FulfilmentMode }> = {
  physical: { label: 'Physical item', hint: 'Laptops, phones, accessories. Picked up or delivered.', icon: <Package className="h-5 w-5" />, defaultMode: 'both' },
  digital: { label: 'Digital product', hint: 'Subscriptions, software, codes. Sent to the customer.', icon: <Cloud className="h-5 w-5" />, defaultMode: 'digital_delivery' },
  service: { label: 'Service', hint: 'Setup, registration or activation done by you.', icon: <Wrench className="h-5 w-5" />, defaultMode: 'manual_activation' },
};
const AVAILABILITY: Array<[MarketplaceAvailability, string]> = [['available', 'In stock'], ['check_availability', 'Check availability first'], ['limited', 'Limited stock'], ['coming_soon', 'Coming soon']];

type Photo = { key: string; url: string | null; preview: string | null; progress: number; error: string | null; file?: File; uploading: boolean };
type Variant = { id: string; name: string; priceMinor: number; priceGhc: number; active: boolean };
type SavedLocation = Omit<MarketplacePickupLocation, 'id' | 'active'>;
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const locationKey = (l: { name?: string; city?: string; area?: string }) => [l.name, l.city, l.area].map(v => (v || '').trim().toLowerCase()).join('|');

export interface MarketplaceProductEditorProps {
  token: string;
  product: MarketplaceProduct | null;
  categories: ManagedCategory[];
  /** Other products, used only to offer pickup locations already saved on them. */
  products: MarketplaceProduct[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function MarketplaceProductEditor({ token, product, categories, products, onClose, onSaved }: MarketplaceProductEditorProps) {
  const p = product;
  const [kind, setKind] = useState<ProductKind | ''>(p?.productKind || 'physical');
  const [name, setName] = useState(p?.name || '');
  const [category, setCategory] = useState<string>(p?.category || '');
  const [tagline, setTagline] = useState(p?.tagline || '');
  const [description, setDescription] = useState(p?.description || '');
  const [priceType, setPriceType] = useState<'fixed' | 'starting_at' | 'quote'>(p?.priceType || 'fixed');
  const [priceGhc, setPriceGhc] = useState(p?.priceGhc != null ? String(p.priceGhc) : p?.priceMinor ? String(p.priceMinor / 100) : '');
  const [variants, setVariants] = useState<Variant[]>((p?.variants || []).map(v => ({ ...v })));
  const [mode, setMode] = useState<FulfilmentMode>(p?.fulfilmentMode || 'both');
  const [purchaseEnabled, setPurchaseEnabled] = useState(p ? p.purchaseEnabled !== false : true);
  const [deliveryAvailable, setDeliveryAvailable] = useState(p ? p.deliveryAvailable !== false : true);
  const [payBeforeDelivery, setPayBeforeDelivery] = useState(Boolean(p?.paymentRequiredBeforeDelivery));
  const [deliveryNote, setDeliveryNote] = useState(p?.deliveryNote || '');
  const [pickups, setPickups] = useState<MarketplacePickupLocation[]>((p?.pickupLocations || []).map(l => ({ ...l })));
  const [identifierLabel, setIdentifierLabel] = useState(p?.fulfilmentIdentifierLabel || '');
  const [identifierPlaceholder, setIdentifierPlaceholder] = useState(p?.fulfilmentIdentifierPlaceholder || '');
  const [identifierRequired, setIdentifierRequired] = useState(Boolean(p?.fulfilmentIdentifierRequired));
  const [fulfilmentNote, setFulfilmentNote] = useState(p?.fulfilmentNote || '');
  const [purchaseNote, setPurchaseNote] = useState(p?.purchaseNote || '');
  const [highlights, setHighlights] = useState<string[]>(p?.highlights?.length ? [...p.highlights] : []);
  const [specs, setSpecs] = useState<Array<{ label: string; value: string }>>(p?.specs?.map(s => ({ ...s })) || []);
  const [availability, setAvailability] = useState<MarketplaceAvailability>(p?.availability || 'available');
  const [availabilityLabel, setAvailabilityLabel] = useState(p?.availabilityLabel || '');
  const [badge, setBadge] = useState(p?.badge || '');
  const [rewardGhc, setRewardGhc] = useState(p?.referralRewardGhc != null ? String(p.referralRewardGhc) : p?.referralRewardMinor ? String(p.referralRewardMinor / 100) : '');
  const [slug, setSlug] = useState(p?.slug || '');
  const [sortOrder, setSortOrder] = useState(p?.sortOrder || 0);
  const [featured, setFeatured] = useState(Boolean(p?.featured));
  const [published, setPublished] = useState(Boolean(p?.published));
  const [adminNote, setAdminNote] = useState(p?.adminNote || '');
  const [imageAlt, setImageAlt] = useState(p?.imageAlt || '');
  const [photos, setPhotos] = useState<Photo[]>(() => [p?.imageUrl, ...(p?.galleryUrls || [])].filter((u): u is string => Boolean(u)).map(url => ({ key: newId('ph'), url, preview: null, progress: 100, error: null, uploading: false })));
  const [linkDraft, setLinkDraft] = useState('');
  const [library, setLibrary] = useState<MarketplaceMediaLibrary | null>(null);
  const [libraryError, setLibraryError] = useState('');
  const [showLibrary, setShowLibrary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmWarnings, setConfirmWarnings] = useState<string[] | null>(null);
  const [newLocation, setNewLocation] = useState<SavedLocation | null>(null);
  const [advert, setAdvert] = useState('');
  const [aiOpen, setAiOpen] = useState(!p);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [extraction, setExtraction] = useState<MarketplaceAiExtractionResult | null>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  useEffect(() => { let active = true; getMarketplaceMedia(token).then(data => { if (active) setLibrary(data); }).catch(e => { if (active) setLibraryError(e instanceof Error ? e.message : 'Photo uploads are unavailable.'); }); return () => { active = false; }; }, [token]);
  useEffect(() => () => { controllers.current.forEach(c => c.abort()); }, []);
  useEffect(() => () => { photos.forEach(ph => { if (ph.preview) URL.revokeObjectURL(ph.preview); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const savedLocations = useMemo(() => {
    const seen = new Set(pickups.map(locationKey)); const list: SavedLocation[] = [];
    for (const other of products) for (const l of other.pickupLocations || []) { const key = locationKey(l); if (!l.name || seen.has(key)) continue; seen.add(key); list.push({ name: l.name, city: l.city, area: l.area, addressOrLandmark: l.addressOrLandmark, phone: l.phone }); }
    return list;
  }, [products, pickups]);

  const imageUrl = photos.find(ph => ph.url)?.url || '';
  const galleryUrls = photos.filter(ph => ph.url).slice(1).map(ph => ph.url!) ;
  const uploading = photos.some(ph => ph.uploading);
  const priceMinor = priceType === 'quote' ? null : Math.round(Number(priceGhc) * 100);
  const readiness = productReadiness({ name, category, productKind: kind, priceType, priceMinor, purchaseEnabled, fulfilmentMode: mode, pickupLocations: pickups, deliveryAvailable, imageUrl, imageAlt, description, highlights: highlights.filter(Boolean), referralRewardMinor: Number(rewardGhc) * 100, fulfilmentIdentifierLabel: identifierLabel, fulfilmentIdentifierPlaceholder: identifierPlaceholder, fulfilmentIdentifierRequired: identifierRequired, fulfilmentNote, purchaseNote }, categories);

  // ---------- Photos ----------
  const maxBytes = library?.maxBytes || 8 * 1024 * 1024;
  const startUpload = async (key: string, original: File) => {
    const controller = new AbortController(); controllers.current.set(key, controller);
    setPhotos(list => list.map(ph => ph.key === key ? { ...ph, uploading: true, error: null, progress: 0 } : ph));
    try {
      const file = await preparePhoto(original, maxBytes);
      const asset = await uploadMarketplacePhoto(token, file, percent => setPhotos(list => list.map(ph => ph.key === key ? { ...ph, progress: percent } : ph)), controller.signal);
      setPhotos(list => list.map(ph => ph.key === key ? { ...ph, url: asset.url, uploading: false, progress: 100, error: null } : ph));
      setLibrary(lib => lib ? { ...lib, assets: [asset, ...lib.assets.filter(a => a.id !== asset.id)] } : lib);
    } catch (e) {
      if (controller.signal.aborted) return;
      setPhotos(list => list.map(ph => ph.key === key ? { ...ph, uploading: false, error: e instanceof Error ? e.message : 'Upload failed. Try again.' } : ph));
    } finally { controllers.current.delete(key); }
  };
  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_GALLERY + 1 - photos.length;
    const accepted = [...files].slice(0, Math.max(0, room));
    const added: Photo[] = accepted.map(file => ({ key: newId('ph'), url: null, preview: URL.createObjectURL(file), progress: 0, error: MARKETPLACE_PHOTO_TYPES.includes(file.type) ? null : 'Use a JPEG, PNG or WebP photo.', file, uploading: false }));
    setPhotos(list => [...list, ...added]);
    added.forEach(ph => { if (!ph.error && ph.file) void startUpload(ph.key, ph.file); });
  };
  const removePhoto = (key: string) => { controllers.current.get(key)?.abort(); setPhotos(list => { const target = list.find(ph => ph.key === key); if (target?.preview) URL.revokeObjectURL(target.preview); return list.filter(ph => ph.key !== key); }); };
  const makeMain = (key: string) => setPhotos(list => { const target = list.find(ph => ph.key === key); return target ? [target, ...list.filter(ph => ph.key !== key)] : list; });
  const addUrl = (url: string) => { const clean = url.trim(); try { if (!['http:', 'https:'].includes(new URL(clean).protocol)) throw new Error(); } catch { setSaveError('Image links must start with https://'); return; } if (photos.some(ph => ph.url === clean)) return; setPhotos(list => [...list, { key: newId('ph'), url: clean, preview: null, progress: 100, error: null, uploading: false }].slice(0, MAX_GALLERY + 1)); setLinkDraft(''); setSaveError(''); };

  // ---------- Mystery AI ----------
  const readAdvert = async () => {
    const text = advert.trim(); if (!text) { setAiError('Paste the supplier advert first.'); return; }
    if (text.length > 20000) { setAiError('This advert is too long. Paste only the product information you want to import.'); return; }
    setAiBusy(true); setAiError(''); setExtraction(null);
    try { const res = await importMarketplaceProductWithAi(token, text); if (res.success && res.extraction) setExtraction(res.extraction); else setAiError(res.message || 'Mystery AI could not read this advert.'); }
    catch (e) { setAiError(e instanceof Error ? e.message : 'Mystery AI could not read this advert right now. Your text is still here; retry or fill the form yourself.'); }
    finally { setAiBusy(false); }
  };
  const applyExtraction = (x: MarketplaceAiExtractionResult, groups: Set<string>) => {
    if (groups.has('basics')) {
      if (x.name) setName(x.name);
      if (x.category) setCategory(x.category);
      if (x.productKind) { setKind(x.productKind); setMode(x.fulfilmentMode || KIND_COPY[x.productKind].defaultMode); }
      if (x.tagline) setTagline(x.tagline);
      if (x.description) setDescription(x.description);
      if (x.highlights.length) setHighlights(x.highlights);
      if (x.imageAlt && !imageAlt) setImageAlt(x.imageAlt);
      if (x.badge) setBadge(x.badge);
      if (x.availability) setAvailability(x.availability === 'in_stock' ? 'available' : 'check_availability');
      if (x.availabilityLabel) setAvailabilityLabel(x.availabilityLabel);
    }
    if (groups.has('price')) {
      setPriceType(x.priceType); setPriceGhc(x.priceGhc != null ? String(x.priceGhc) : '');
      // Price options become purchasable options only, never duplicated as "Config" specifications.
      setVariants(x.detectedPriceOptions.length > 1 ? x.detectedPriceOptions.map(o => ({ id: newId('var'), name: o.label.slice(0, 120), priceMinor: Math.round(o.priceGhc * 100), priceGhc: o.priceGhc, active: true })) : []);
      if (x.priceType === 'quote') setPurchaseEnabled(false);
    }
    if (groups.has('specs') && x.specs.length) setSpecs(x.specs.map(s => ({ ...s })));
    if (groups.has('fulfilment')) {
      if (x.fulfilmentIdentifierLabel) { setIdentifierLabel(x.fulfilmentIdentifierLabel); setIdentifierPlaceholder(x.fulfilmentIdentifierPlaceholder || ''); setIdentifierRequired(x.fulfilmentIdentifierRequired); }
      const known = new Set(pickups.map(locationKey));
      const fresh = x.pickupLocations.filter(l => !known.has(locationKey(l))).map(l => ({ id: newId('loc'), name: l.name.slice(0, 150), city: l.city, area: l.area, addressOrLandmark: l.addressOrLandmark, active: Boolean(l.city && l.area) }));
      if (fresh.length) setPickups(list => [...list, ...fresh]);
      if (x.delivery.available !== null) { setDeliveryAvailable(x.delivery.available); if (x.delivery.terms) setDeliveryNote(x.delivery.terms.slice(0, 300)); }
      if (!x.fulfilmentMode && (x.productKind || kind) === 'physical') {
        if (x.delivery.available === true) setMode(fresh.length || pickups.length ? 'both' : 'delivery');
        else if (fresh.length || pickups.length) setMode('pickup');
      }
    }
    setPublished(false);
    setExtraction(null); setAiOpen(false);
  };

  // ---------- Save ----------
  const buildPayload = (publish: boolean): Record<string, unknown> => ({
    productKind: kind, fulfilmentNote, fulfilmentIdentifierLabel: identifierLabel, fulfilmentIdentifierPlaceholder: identifierPlaceholder, fulfilmentIdentifierRequired: identifierRequired, adminNote, variants, confirmWarnings: publish,
    name: name.trim(), slug: slug.trim() || undefined, category, tagline: tagline.trim() || undefined, description: description.trim() || undefined,
    priceType, priceGhc: priceType !== 'quote' ? parseFloat(priceGhc) : undefined,
    referralRewardGhc: rewardGhc && parseFloat(rewardGhc) > 0 ? parseFloat(rewardGhc) : null,
    availability, availabilityLabel: availabilityLabel.trim() || undefined, badge: badge.trim() || undefined,
    imageUrl: imageUrl || (p?.imageUrl ? '' : undefined), galleryUrls, imageAlt: imageAlt.trim() || undefined,
    highlights: highlights.map(h => h.trim()).filter(Boolean), specs: specs.filter(s => s.label.trim()).map(s => ({ label: s.label.trim(), value: s.value.trim() })),
    featured, published: publish, sortOrder,
    purchaseEnabled: purchaseEnabled && mode !== 'inquiry_only' && priceType !== 'quote', fulfilmentMode: mode,
    pickupLocations: kind === 'physical' ? pickups : [], deliveryAvailable: kind === 'physical' && deliveryAvailable,
    paymentRequiredBeforeDelivery: payBeforeDelivery, deliveryNote: deliveryNote.trim() || undefined, purchaseNote: purchaseNote.trim() || undefined,
  });
  const save = async (publish: boolean, warningsAccepted = false) => {
    setSaveError('');
    if (!name.trim()) { setSaveError('Give the product a name.'); return; }
    if (!kind) { setSaveError('Choose what you are selling.'); return; }
    if (priceType !== 'quote' && !(parseFloat(priceGhc) > 0)) { setSaveError('Enter a price in GH₵, or choose "Ask for a quote".'); return; }
    if (uploading) { setSaveError('Wait for photos to finish uploading.'); return; }
    if (photos.some(ph => !ph.url)) { setSaveError('Remove or retry the photos that did not upload.'); return; }
    if (publish && readiness.blockers.length) { setSaveError(readiness.blockers.join(' ')); return; }
    if (publish && readiness.warnings.length && !warningsAccepted) { setConfirmWarnings(readiness.warnings); return; }
    setSaving(true);
    try {
      if (p) await updateAdminMarketplaceProduct(token, p.id, buildPayload(publish)); else await createAdminMarketplaceProduct(token, buildPayload(publish));
      onSaved(publish ? `"${name.trim()}" is live on the marketplace.` : `"${name.trim()}" saved as a draft.`);
    } catch (e) { setSaveError(e instanceof Error ? e.message : 'Could not save the product.'); }
    finally { setSaving(false); }
  };

  const modes = kind ? FULFILMENT_MODES[kind] : [];
  const sectionTitle = (n: number, title: string, hint?: string) => <div className="mb-3"><h3 className="flex items-center gap-2 text-sm font-semibold text-white"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#00c365]/15 text-xs text-[#7dffbf]">{n}</span>{title}</h3>{hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}</div>;

  return (
    <AdminSheet wide title={p ? `Edit ${p.name}` : 'New product'} subtitle={p ? (p.published ? 'Live on the marketplace' : 'Draft · not visible to customers') : 'Saved as a draft until you publish'} busy={saving} onClose={() => { if (!saving) onClose(); }}
      footer={<div className="space-y-2">
        {saveError && <p role="alert" className="break-words text-sm text-rose-300">{saveError}</p>}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">{readiness.blockers.length ? <span className="text-amber-300">{readiness.blockers.length} thing{readiness.blockers.length === 1 ? '' : 's'} to fix before publishing</span> : readiness.warnings.length ? `${readiness.warnings.length} optional improvement${readiness.warnings.length === 1 ? '' : 's'}` : 'Ready to publish'}</p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <AdminButton disabled={saving || uploading} onClick={() => void save(false)}>{p?.published ? 'Move to drafts' : 'Save draft'}</AdminButton>
            <AdminButton variant="primary" busy={saving} disabled={saving || uploading || readiness.blockers.length > 0} onClick={() => void save(true)}>{p?.published ? 'Save changes' : 'Publish'}</AdminButton>
          </div>
        </div>
      </div>}>
      <div className="space-y-6 text-sm">
        {/* Mystery AI */}
        <section className="rounded-2xl border border-[#00c365]/30 bg-gradient-to-br from-[#0a1713] to-[#0b1217] p-4">
          <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={aiOpen} onClick={() => setAiOpen(!aiOpen)}>
            <span className="flex items-center gap-2 font-semibold text-white"><Sparkles className="h-4 w-4 text-[#00c365]" />Start from a supplier advert</span>
            <span className="text-xs text-slate-400">{aiOpen ? 'Hide' : 'Mystery AI'}</span>
          </button>
          {aiOpen && <div className="mt-3 space-y-3">
            <p className="text-xs text-slate-400">Paste the WhatsApp advert. Mystery AI drafts the fields it can find, flags anything uncertain, and never publishes, invents a price or location, or touches your photos.</p>
            <label className="block"><span className="sr-only">Supplier advert</span><textarea className={`${field} min-h-32`} value={advert} maxLength={20000} disabled={aiBusy} placeholder="Paste the supplier's advert here" onChange={e => setAdvert(e.target.value)} /></label>
            {aiError && <p role="alert" className="text-sm text-rose-300">{aiError}</p>}
            <AdminButton variant="primary" busy={aiBusy} disabled={aiBusy || !advert.trim()} onClick={() => void readAdvert()}>{aiBusy ? 'Reading advert…' : 'Read advert'}</AdminButton>
            {extraction && <AiReview extraction={extraction} hasExisting={Boolean(name || priceGhc || description || specs.length || pickups.length)} categories={categories} onApply={groups => applyExtraction(extraction, groups)} onDiscard={() => setExtraction(null)} />}
          </div>}
        </section>

        {/* 1. Type */}
        <section>
          {sectionTitle(1, 'What are you selling?')}
          <div role="radiogroup" aria-label="Product type" className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(KIND_COPY) as ProductKind[]).map(k => <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => { setKind(k); if (!FULFILMENT_MODES[k].includes(mode)) setMode(KIND_COPY[k].defaultMode); }} className={`flex min-h-16 items-start gap-3 rounded-2xl border p-3 text-left ${kind === k ? 'border-[#00c365]/70 bg-[#00c365]/10' : 'border-slate-800 hover:border-slate-600'}`}>
              <span className={kind === k ? 'text-[#7dffbf]' : 'text-slate-400'}>{KIND_COPY[k].icon}</span>
              <span><span className="block font-semibold text-white">{KIND_COPY[k].label}</span><span className="block text-xs text-slate-400">{KIND_COPY[k].hint}</span></span>
            </button>)}
          </div>
        </section>

        {/* 2. Photos */}
        <section>
          {sectionTitle(2, 'Photos', `The first photo is the main one customers see. Up to ${MAX_GALLERY + 1} photos.`)}
          {library && !library.configured && <AdminNotice tone="warning">Photo uploads are not configured on the server yet. You can still add an image link below.</AdminNotice>}
          {libraryError && <p className="text-xs text-amber-300">{libraryError}</p>}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.map((ph, index) => <figure key={ph.key} className={`relative aspect-square overflow-hidden rounded-xl border ${ph.error ? 'border-rose-500/50' : index === 0 ? 'border-[#00c365]/60' : 'border-slate-800'} bg-slate-900`}>
              {(ph.preview || ph.url) && <img src={ph.preview || marketplaceThumb(ph.url!)} alt="" className={`h-full w-full object-cover ${ph.uploading ? 'opacity-50' : ''}`} />}
              {index === 0 && !ph.error && <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-[#7dffbf]">Main</span>}
              {ph.uploading && <div className="absolute inset-x-1.5 bottom-1.5 space-y-1"><div className="h-1.5 overflow-hidden rounded-full bg-black/60"><div className="h-full bg-[#00c365] transition-all" style={{ width: `${ph.progress}%` }} /></div><p className="text-center text-[10px] text-white">{ph.progress < 100 ? `${ph.progress}%` : 'Checking…'}</p></div>}
              {ph.error && <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/75 p-1.5 text-center"><p className="text-[10px] leading-tight text-rose-200">{ph.error}</p>{ph.file && MARKETPLACE_PHOTO_TYPES.includes(ph.file.type) && <button type="button" className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-slate-800 px-2 text-[11px] text-white" onClick={() => void startUpload(ph.key, ph.file!)}><RotateCcw className="h-3 w-3" />Retry</button>}</div>}
              <figcaption className="absolute right-1 top-1 flex gap-1">
                {index > 0 && ph.url && <button type="button" aria-label="Make main photo" title="Make main photo" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/70 text-amber-300" onClick={() => makeMain(ph.key)}><Star className="h-4 w-4" /></button>}
                <button type="button" aria-label="Remove photo" title="Remove from this product" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/70 text-rose-300" onClick={() => removePhoto(ph.key)}><Trash2 className="h-4 w-4" /></button>
              </figcaption>
            </figure>)}
            {photos.length <= MAX_GALLERY && <>
              <button type="button" disabled={library?.configured === false} onClick={() => cameraInput.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-700 text-xs text-slate-300 hover:border-[#00c365]/60 disabled:opacity-40"><Camera className="h-5 w-5 text-[#00c365]" />Take photo</button>
              <button type="button" disabled={library?.configured === false} onClick={() => galleryInput.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-700 text-xs text-slate-300 hover:border-[#00c365]/60 disabled:opacity-40"><ImagePlus className="h-5 w-5 text-[#00c365]" />From gallery</button>
            </>}
          </div>
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={galleryInput} type="file" accept={MARKETPLACE_PHOTO_TYPES.join(',')} multiple className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
          <p className="mt-2 text-xs text-slate-500">Large phone photos are resized before upload. Removing a photo only removes it from this product.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className={adminLabel}><span>Describe the main photo</span><input className={field} value={imageAlt} maxLength={256} placeholder="e.g. HP EliteBook 840 G8, front view, open" onChange={e => setImageAlt(e.target.value)} /><span className="block text-xs text-slate-500">Read aloud by screen readers and shown if the photo fails to load.</span></label>
            <div className="space-y-2">
              {library && library.assets.length > 0 && <button type="button" className="inline-flex min-h-11 items-center gap-2 text-sm text-[#7dffbf]" aria-expanded={showLibrary} onClick={() => setShowLibrary(!showLibrary)}><ImagePlus className="h-4 w-4" />Reuse a recent upload</button>}
              <details><summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-300"><Link2 className="h-4 w-4" />Use an image link instead</summary>
                <div className="mt-2 flex gap-2"><input className={field} value={linkDraft} placeholder="https://…" inputMode="url" onChange={e => setLinkDraft(e.target.value)} /><AdminButton disabled={!linkDraft.trim()} onClick={() => addUrl(linkDraft)}>Add</AdminButton></div>
              </details>
            </div>
          </div>
          {showLibrary && library && <div className="mt-3 grid grid-cols-4 gap-2 rounded-2xl border border-slate-800 p-2 sm:grid-cols-6">{library.assets.map(asset => { const used = photos.some(ph => ph.url === asset.url); return <button key={asset.id} type="button" disabled={used || photos.length > MAX_GALLERY} onClick={() => addUrl(asset.url)} className="relative aspect-square overflow-hidden rounded-lg border border-slate-800 disabled:opacity-40" title={asset.filename}><img src={marketplaceThumb(asset.url, 160)} alt={asset.filename} className="h-full w-full object-cover" />{used && <Check className="absolute right-1 top-1 h-4 w-4 text-[#00c365]" />}</button>; })}</div>}
        </section>

        {/* 3. Basics */}
        <section>
          {sectionTitle(3, 'Name and category')}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`${adminLabel} sm:col-span-2`}><span>Product name</span><input className={field} value={name} maxLength={256} required placeholder="e.g. HP EliteBook 840 G8" onChange={e => setName(e.target.value)} /></label>
            <label className={adminLabel}><span>Category</span><select className={field} value={category} onChange={e => setCategory(e.target.value)}><option value="">Choose a category</option>{categories.filter(c => c.active || c.slug === category).map(c => <option key={c.slug} value={c.slug}>{c.label}{c.active ? '' : ' (hidden)'}</option>)}</select></label>
            <label className={adminLabel}><span>Short line under the name</span><input className={field} value={tagline} maxLength={200} placeholder="e.g. Neat UK-used business laptop" onChange={e => setTagline(e.target.value)} /></label>
            <label className={`${adminLabel} sm:col-span-2`}><span>Description</span><textarea className={`${field} min-h-24`} value={description} maxLength={2000} onChange={e => setDescription(e.target.value)} /></label>
          </div>
        </section>

        {/* 4. Price */}
        <section>
          {sectionTitle(4, 'Price')}
          <div role="radiogroup" aria-label="Price type" className="mb-3 flex flex-wrap gap-2">{([['fixed', 'Fixed price'], ['starting_at', 'From (has options)'], ['quote', 'Ask for a quote']] as const).map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={priceType === value} onClick={() => setPriceType(value)} className={`min-h-11 rounded-xl border px-3 text-sm ${priceType === value ? 'border-[#00c365]/70 bg-[#00c365]/10 text-white' : 'border-slate-700 text-slate-300'}`}>{label}</button>)}</div>
          {priceType !== 'quote' && <label className={`${adminLabel} max-w-xs`}><span>{priceType === 'starting_at' ? 'Lowest price (GH₵)' : 'Price (GH₵)'}</span><input className={field} inputMode="decimal" value={priceGhc} placeholder="0.00" onChange={e => setPriceGhc(e.target.value)} /></label>}
          {priceType === 'quote' && <p className="text-xs text-slate-400">Customers send an inquiry instead of paying online.</p>}
          {priceType !== 'quote' && <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-400">Options let customers pick a configuration with its own price (for example 8GB / 16GB RAM).</p>
            {variants.map((v, i) => <div key={v.id} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
              <label className={adminLabel}><span className="text-xs">Option {i + 1}</span><input className={field} value={v.name} maxLength={120} onChange={e => setVariants(variants.map(x => x.id === v.id ? { ...x, name: e.target.value } : x))} /></label>
              <label className={adminLabel}><span className="text-xs">GH₵</span><input className={field} inputMode="decimal" value={v.priceGhc || ''} onChange={e => { const ghc = Number(e.target.value); setVariants(variants.map(x => x.id === v.id ? { ...x, priceGhc: ghc, priceMinor: Math.round(ghc * 100) } : x)); }} /></label>
              <button type="button" aria-label={`Remove option ${i + 1}`} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-rose-300 hover:bg-rose-500/10" onClick={() => setVariants(variants.filter(x => x.id !== v.id))}><Trash2 className="h-4 w-4" /></button>
            </div>)}
            <AdminButton onClick={() => { setVariants([...variants, { id: newId('var'), name: '', priceMinor: 0, priceGhc: 0, active: true }]); if (priceType === 'fixed') setPriceType('starting_at'); }}><Plus className="h-4 w-4" />Add option</AdminButton>
          </div>}
        </section>

        {/* 5. Fulfilment */}
        {kind && <section>
          {sectionTitle(5, 'How customers get it')}
          <label className={`${adminLabel} max-w-sm`}><span>Fulfilment</span><select className={field} value={mode} onChange={e => setMode(e.target.value as FulfilmentMode)}>{modes.map(m => <option key={m} value={m}>{FULFILMENT_LABELS[m]}</option>)}</select></label>
          {mode !== 'inquiry_only' && priceType !== 'quote' && <label className="mt-2 flex min-h-11 items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[#00c365]" checked={purchaseEnabled} onChange={e => setPurchaseEnabled(e.target.checked)} />Customers can pay online</label>}
          {kind === 'physical' && mode !== 'inquiry_only' && <div className="mt-3 space-y-4">
            {(mode === 'pickup' || mode === 'both') && <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white">Pickup locations</h4>
              {!pickups.length && <p className="text-xs text-slate-400">No pickup location yet. Only add places where customers can really collect this item.</p>}
              {pickups.map(l => <div key={l.id} className={`flex items-start gap-3 rounded-xl border p-3 ${l.active ? 'border-slate-800' : 'border-amber-500/30'}`}>
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#00c365]" />
                <div className="min-w-0 flex-1"><p className="break-words font-semibold text-white">{l.name}</p><p className="text-xs text-slate-400">{[l.area, l.city].filter(Boolean).join(', ') || 'City and area missing'}{l.addressOrLandmark && l.addressOrLandmark !== l.name ? ` · ${l.addressOrLandmark}` : ''}</p>{(!l.city || !l.area) && <p className="text-xs text-amber-300">Add the city and area to use this location.</p>}</div>
                <div className="flex shrink-0 gap-1"><AdminButton variant="ghost" onClick={() => setNewLocation({ name: l.name, city: l.city, area: l.area, addressOrLandmark: l.addressOrLandmark, phone: l.phone })}>Edit</AdminButton><button type="button" aria-label={`Remove ${l.name}`} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-rose-300 hover:bg-rose-500/10" onClick={() => setPickups(pickups.filter(x => x.id !== l.id))}><Trash2 className="h-4 w-4" /></button></div>
              </div>)}
              <div className="flex flex-wrap gap-2">
                {savedLocations.length > 0 && <select aria-label="Add a saved pickup location" className={`${field} w-auto`} value="" onChange={e => { const l = savedLocations[Number(e.target.value)]; if (l) setPickups([...pickups, { ...l, id: newId('loc'), active: true }]); }}><option value="">Add a saved location…</option>{savedLocations.map((l, i) => <option key={i} value={i}>{l.name} · {l.area}, {l.city}</option>)}</select>}
                <AdminButton onClick={() => setNewLocation({ name: '', city: '', area: '', addressOrLandmark: '', phone: '' })}><Plus className="h-4 w-4" />New location</AdminButton>
              </div>
              {newLocation && <LocationForm initial={newLocation} onCancel={() => setNewLocation(null)} onSave={loc => { const key = locationKey(newLocation); const existing = pickups.find(x => locationKey(x) === key && newLocation.name); setPickups(existing ? pickups.map(x => x.id === existing.id ? { ...x, ...loc, active: true } : x) : [...pickups, { ...loc, id: newId('loc'), active: true }]); setNewLocation(null); }} />}
            </div>}
            {(mode === 'delivery' || mode === 'both') && <div className="space-y-2">
              <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[#00c365]" checked={deliveryAvailable} onChange={e => setDeliveryAvailable(e.target.checked)} />Delivery is available</label>
              {deliveryAvailable && <><label className={adminLabel}><span>Delivery terms customers see</span><input className={field} value={deliveryNote} maxLength={300} placeholder="e.g. Accra same day; other regions by VIP bus, fee paid on arrival" onChange={e => setDeliveryNote(e.target.value)} /></label>
              <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[#00c365]" checked={payBeforeDelivery} onChange={e => setPayBeforeDelivery(e.target.checked)} />Payment required before delivery</label></>}
            </div>}
          </div>}
          {kind !== 'physical' && mode !== 'inquiry_only' && <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className={adminLabel}><span>Ask the customer for (optional)</span><input className={field} value={identifierLabel} maxLength={100} placeholder="e.g. Account email" onChange={e => setIdentifierLabel(e.target.value)} /></label>
            <label className={adminLabel}><span>Example shown in the box</span><input className={field} value={identifierPlaceholder} maxLength={150} onChange={e => setIdentifierPlaceholder(e.target.value)} /></label>
            {identifierLabel && <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[#00c365]" checked={identifierRequired} onChange={e => setIdentifierRequired(e.target.checked)} />Required before payment</label>}
            <label className={`${adminLabel} sm:col-span-2`}><span>How you deliver it</span><textarea className={`${field} min-h-20`} value={fulfilmentNote} maxLength={1000} placeholder="e.g. Activation within 2 hours on WhatsApp" onChange={e => setFulfilmentNote(e.target.value)} /></label>
            <p className="text-xs text-slate-500 sm:col-span-2">Never ask customers for passwords, PINs or one-time codes. Publishing is blocked if you do.</p>
          </div>}
        </section>}

        {/* 6. More */}
        <details className="rounded-2xl border border-slate-800 p-4">
          <summary className="cursor-pointer font-semibold text-white">More details <span className="font-normal text-slate-400">· highlights, specifications, stock, Share &amp; Earn</span></summary>
          <div className="mt-4 space-y-5">
            <div className="space-y-2"><h4 className="text-sm font-semibold text-white">Highlights</h4>
              {highlights.map((h, i) => <div key={i} className="flex gap-2"><input aria-label={`Highlight ${i + 1}`} className={field} value={h} maxLength={256} onChange={e => setHighlights(highlights.map((x, n) => n === i ? e.target.value : x))} /><button type="button" aria-label={`Remove highlight ${i + 1}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-rose-300" onClick={() => setHighlights(highlights.filter((_, n) => n !== i))}><Trash2 className="h-4 w-4" /></button></div>)}
              <AdminButton onClick={() => setHighlights([...highlights, ''])}><Plus className="h-4 w-4" />Add highlight</AdminButton></div>
            <div className="space-y-2"><h4 className="text-sm font-semibold text-white">Specifications</h4>
              {specs.map((s, i) => <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2"><input aria-label={`Specification ${i + 1} label`} className={field} value={s.label} maxLength={100} placeholder="Label" onChange={e => setSpecs(specs.map((x, n) => n === i ? { ...x, label: e.target.value } : x))} /><input aria-label={`Specification ${i + 1} value`} className={field} value={s.value} maxLength={500} placeholder="Value" onChange={e => setSpecs(specs.map((x, n) => n === i ? { ...x, value: e.target.value } : x))} /><button type="button" aria-label={`Remove specification ${i + 1}`} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-rose-300" onClick={() => setSpecs(specs.filter((_, n) => n !== i))}><Trash2 className="h-4 w-4" /></button></div>)}
              <AdminButton onClick={() => setSpecs([...specs, { label: '', value: '' }])}><Plus className="h-4 w-4" />Add specification</AdminButton></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={adminLabel}><span>Stock</span><select className={field} value={availability} onChange={e => setAvailability(e.target.value as MarketplaceAvailability)}>{AVAILABILITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label className={adminLabel}><span>Stock label (optional)</span><input className={field} value={availabilityLabel} maxLength={64} placeholder="e.g. 3 left" onChange={e => setAvailabilityLabel(e.target.value)} /></label>
              <label className={adminLabel}><span>Badge (optional)</span><input className={field} value={badge} maxLength={64} placeholder="e.g. Best seller" onChange={e => setBadge(e.target.value)} /></label>
              <label className={adminLabel}><span>Share &amp; Earn reward (GH₵)</span><input className={field} inputMode="decimal" value={rewardGhc} placeholder="0.00" onChange={e => setRewardGhc(e.target.value)} /></label>
              <label className={`${adminLabel} sm:col-span-2`}><span>Note shown at checkout (optional)</span><input className={field} value={purchaseNote} maxLength={300} onChange={e => setPurchaseNote(e.target.value)} /></label>
              <label className={adminLabel}><span>Link name (slug)</span><input className={`${field} font-mono`} value={slug} maxLength={120} placeholder="Generated from the name" onChange={e => setSlug(e.target.value)} /></label>
              <label className={adminLabel}><span>Position in list</span><input className={field} type="number" min={0} value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} /></label>
              <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[#00c365]" checked={featured} onChange={e => setFeatured(e.target.checked)} />Feature on the marketplace</label>
              <label className={`${adminLabel} sm:col-span-2`}><span>Internal note (admins only)</span><textarea className={`${field} min-h-16`} value={adminNote} maxLength={1000} placeholder="Supplier, cost, anything to remember" onChange={e => setAdminNote(e.target.value)} /></label>
            </div>
          </div>
        </details>

        {/* Readiness */}
        {(readiness.blockers.length > 0 || readiness.warnings.length > 0) && <section className="rounded-2xl border border-slate-800 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">Before publishing</h3>
          <ul className="space-y-1.5 text-sm">
            {readiness.blockers.map(b => <li key={b} className="flex gap-2 text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{b}</li>)}
            {readiness.warnings.map(w => <li key={w} className="flex gap-2 text-slate-400"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />{w}</li>)}
          </ul>
        </section>}
      </div>
      {confirmWarnings && <ConfirmAction title="Publish with optional gaps?" summary={<ul className="list-disc space-y-1 pl-5">{confirmWarnings.map(w => <li key={w}>{w}</li>)}</ul>} warning="Customers will see this product as it is. You can keep improving it after publishing." confirmLabel="Publish anyway" busy={saving} onClose={() => setConfirmWarnings(null)} onConfirm={() => { setConfirmWarnings(null); void save(true, true); }} />}
    </AdminSheet>
  );
}

function LocationForm({ initial, onSave, onCancel }: { initial: SavedLocation; onSave: (l: SavedLocation) => void; onCancel: () => void }) {
  const [loc, setLoc] = useState<SavedLocation>({ ...initial });
  const valid = loc.name.trim().length >= 2 && loc.city.trim() && loc.area.trim();
  const set = (key: keyof SavedLocation) => (e: React.ChangeEvent<HTMLInputElement>) => setLoc({ ...loc, [key]: e.target.value });
  return <div className="space-y-3 rounded-2xl border border-[#00c365]/30 p-3">
    <div className="grid gap-2 sm:grid-cols-2">
      <label className={`${adminLabel} sm:col-span-2`}><span>Place name</span><input className={field} value={loc.name} maxLength={150} placeholder="e.g. DeeTech shop, Circle" onChange={set('name')} /></label>
      <label className={adminLabel}><span>City</span><input className={field} value={loc.city} maxLength={100} placeholder="e.g. Accra" onChange={set('city')} /></label>
      <label className={adminLabel}><span>Area</span><input className={field} value={loc.area} maxLength={150} placeholder="e.g. Kwame Nkrumah Circle" onChange={set('area')} /></label>
      <label className={adminLabel}><span>Landmark or address</span><input className={field} value={loc.addressOrLandmark || ''} maxLength={300} onChange={set('addressOrLandmark')} /></label>
      <label className={adminLabel}><span>Contact phone (optional)</span><input className={field} value={loc.phone || ''} maxLength={32} inputMode="tel" onChange={set('phone')} /></label>
    </div>
    <div className="flex gap-2"><AdminButton variant="primary" disabled={!valid} onClick={() => onSave({ ...loc, name: loc.name.trim(), city: loc.city.trim(), area: loc.area.trim() })}>Save location</AdminButton><AdminButton onClick={onCancel}>Cancel</AdminButton></div>
  </div>;
}

const GROUPS = [
  { id: 'basics', label: 'Name, type, category and description' },
  { id: 'price', label: 'Price and options' },
  { id: 'specs', label: 'Specifications' },
  { id: 'fulfilment', label: 'Pickup, delivery and what to ask the customer' },
] as const;

function AiReview({ extraction: x, hasExisting, categories, onApply, onDiscard }: { extraction: MarketplaceAiExtractionResult; hasExisting: boolean; categories: ManagedCategory[]; onApply: (groups: Set<string>) => void; onDiscard: () => void }) {
  const available = new Set<string>(['basics', 'price', ...(x.specs.length ? ['specs'] : []), ...(x.pickupLocations.length || x.delivery.available !== null || x.fulfilmentIdentifierLabel ? ['fulfilment'] : [])]);
  const [groups, setGroups] = useState(new Set(available));
  const unknown = (value: React.ReactNode) => value ? value : <span className="text-amber-300">Not stated · fill in yourself</span>;
  const categoryLabel = categories.find(c => c.slug === x.category)?.label;
  return <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-950/60 p-3">
    <div className="flex items-center justify-between gap-2"><h4 className="font-semibold text-white">What Mystery AI found</h4><StatusPill tone="info">Draft only</StatusPill></div>
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-slate-500">Name</dt><dd className="break-words">{unknown(x.name)}</dd></div>
      <div><dt className="text-xs text-slate-500">Type · category</dt><dd>{unknown(x.productKind && KIND_COPY[x.productKind].label)} · {unknown(categoryLabel)}</dd></div>
      <div><dt className="text-xs text-slate-500">Price</dt><dd>{x.priceType === 'quote' || x.priceGhc == null ? <span className="text-amber-300">No confirmed price · quote only</span> : `${x.priceType === 'starting_at' ? 'From ' : ''}GH₵${x.priceGhc.toLocaleString()}`}</dd></div>
      <div><dt className="text-xs text-slate-500">Options</dt><dd>{x.detectedPriceOptions.length > 1 ? x.detectedPriceOptions.map(o => <span key={o.label} className="block break-words">{o.label} · GH₵{o.priceGhc.toLocaleString()}</span>) : 'None'}</dd></div>
      <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Pickup locations stated in the advert</dt><dd>{x.pickupLocations.length ? x.pickupLocations.map(l => <span key={l.evidence} className="block break-words">{l.name}{(!l.city || !l.area) && <span className="text-amber-300"> · {!l.city ? 'city' : 'area'} not stated</span>}<span className="block text-xs text-slate-500">“{l.evidence}”</span></span>) : <span className="text-slate-400">None stated. No location will be added.</span>}</dd></div>
      <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Delivery</dt><dd>{x.delivery.available === null ? <span className="text-slate-400">Not stated</span> : x.delivery.available ? `Available${x.delivery.areas.length ? ` · ${x.delivery.areas.join(', ')}` : ''}` : 'Not offered'}{x.delivery.evidence && <span className="block text-xs text-slate-500">“{x.delivery.evidence}”</span>}</dd></div>
    </dl>
    {x.warnings.length > 0 && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3"><p className="mb-1 text-xs font-semibold text-amber-200">Check before publishing</p><ul className="list-disc space-y-1 pl-5 text-xs text-amber-100/90">{x.warnings.map(w => <li key={w}>{w}</li>)}</ul></div>}
    <fieldset className="space-y-1"><legend className="mb-1 text-xs text-slate-400">{hasExisting ? 'Apply to the form (replaces what you typed in these parts):' : 'Apply to the form:'}</legend>
      {GROUPS.filter(g => available.has(g.id)).map(g => <label key={g.id} className="flex min-h-10 items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[#00c365]" checked={groups.has(g.id)} onChange={e => { const next = new Set(groups); if (e.target.checked) next.add(g.id); else next.delete(g.id); setGroups(next); }} />{g.label}</label>)}
    </fieldset>
    <p className="text-xs text-slate-500">Your photos are never changed. The product stays a draft.</p>
    <div className="flex flex-wrap gap-2"><AdminButton variant="primary" disabled={!groups.size} onClick={() => onApply(groups)}><Check className="h-4 w-4" />Apply to draft</AdminButton><AdminButton variant="ghost" onClick={onDiscard}>Discard</AdminButton></div>
  </div>;
}

export default MarketplaceProductEditor;
