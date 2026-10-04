import { MARKETPLACE_LIMITS } from '../../shared/marketplaceLimits.js';
import { FULFILMENT_MODES, encouragesCredentials, productReadiness } from '../../shared/marketplacePolicy.js';
import { MarketplaceControlStore, MarketplaceInputError, plainText } from '../db/marketplaceControlStore.js';
import { toAdminMarketplaceProduct, MarketplaceProductRecord } from '../types/marketplace.js';
import { CreateMarketplaceProductInput, UpdateMarketplaceProductInput } from '../db/marketplaceStore.js';

export async function validateProductInput(body: Record<string, unknown>, existing?: MarketplaceProductRecord): Promise<CreateMarketplaceProductInput | UpdateMarketplaceProductInput> {
  const input: Record<string, unknown> = {};
  const lengths: Record<string,number> = {name:MARKETPLACE_LIMITS.productName,slug:256,category:64,tagline:200,description:4000,availabilityLabel:MARKETPLACE_LIMITS.availabilityLabel,badge:MARKETPLACE_LIMITS.badge,imageAlt:256,deliveryNote:1000,purchaseNote:1000,fulfilmentNote:1000,fulfilmentIdentifierLabel:100,fulfilmentIdentifierPlaceholder:150,adminNote:1000};
  for (const [key,limit] of Object.entries(lengths)) if (body[key] !== undefined) input[key] = plainText(body[key],key,limit);
  if (!existing) { input.name ??= ''; input.category ??= ''; input.priceType = body.priceType ?? 'fixed'; input.availability = body.availability ?? 'available'; input.productKind = body.productKind ?? 'physical'; input.fulfilmentMode = body.fulfilmentMode ?? (input.productKind === 'physical' ? 'both' : input.productKind === 'digital' ? 'digital_delivery' : 'manual_activation'); }
  for (const key of ['productKind','priceType','availability','fulfilmentMode']) if (body[key] !== undefined) input[key] = body[key];
  if (input.productKind !== undefined && (typeof input.productKind !== 'string' || !Object.keys(FULFILMENT_MODES).includes(input.productKind))) throw new MarketplaceInputError('Invalid product type.');
  if (input.priceType !== undefined && (typeof input.priceType !== 'string' || !['fixed','starting_at','quote'].includes(input.priceType))) throw new MarketplaceInputError('Invalid price type.');
  if (input.availability !== undefined && (typeof input.availability !== 'string' || !['available','check_availability','limited','coming_soon'].includes(input.availability))) throw new MarketplaceInputError('Invalid availability.');
  for (const key of ['purchaseEnabled','deliveryAvailable','paymentRequiredBeforeDelivery','fulfilmentIdentifierRequired','featured','published']) {
    if (body[key] !== undefined) { if (typeof body[key] !== 'boolean') throw new MarketplaceInputError(`${key} must be boolean.`); input[key] = body[key]; }
  }
  if (body.sortOrder !== undefined) { if (!Number.isSafeInteger(body.sortOrder) || Number(body.sortOrder) < 0 || Number(body.sortOrder) > 1000000) throw new MarketplaceInputError('Invalid sort position.'); input.sortOrder = body.sortOrder; }
  for (const [minor,ghc] of [['priceMinor','priceGhc'],['referralRewardMinor','referralRewardGhc']]) {
    const raw = body[minor] !== undefined ? body[minor] : body[ghc] !== undefined ? body[ghc] === null ? null : typeof body[ghc] === 'number' ? Math.round(Number(body[ghc])*100) : NaN : undefined;
    if (raw !== undefined) { if (raw !== null && (!Number.isSafeInteger(raw) || Number(raw) < 0 || Number(raw) > 2147483647)) throw new MarketplaceInputError(`Invalid ${ghc}.`); input[minor] = raw; }
  }
  for (const key of ['imageUrl','galleryUrls']) if (body[key] !== undefined) {
    const urls = key === 'imageUrl' ? [body[key]] : body[key];
    if (!Array.isArray(urls) || urls.length > 12) throw new MarketplaceInputError('Invalid image list.');
    const clean = urls.map(u => { if (u === null || u === '') return ''; if (typeof u !== 'string' || u.length > 2000) throw new MarketplaceInputError('Invalid image URL.'); try { if (!['http:','https:'].includes(new URL(u).protocol)) throw new Error(); } catch { throw new MarketplaceInputError('Image URLs must use HTTP or HTTPS.'); } return u.trim(); });
    input[key] = key === 'imageUrl' ? clean[0] || null : clean.filter(Boolean);
  }
  if (body.highlights !== undefined) { if (!Array.isArray(body.highlights) || body.highlights.length > 20) throw new MarketplaceInputError('Invalid highlights.'); input.highlights = body.highlights.map(h=>plainText(h,'Highlight',256,true)); }
  if (body.specs !== undefined) { if (!Array.isArray(body.specs) || body.specs.length > 30) throw new MarketplaceInputError('Invalid specifications.'); input.specs = body.specs.map(s=>({label:plainText(s?.label,'Specification label',100,true),value:plainText(s?.value,'Specification value',500,true)})); }
  if (body.pickupLocations !== undefined) {
    if (!Array.isArray(body.pickupLocations) || body.pickupLocations.length > 20) throw new MarketplaceInputError('Invalid pickup locations.');
    input.pickupLocations = body.pickupLocations.map(l=>{if(l?.active !== undefined && typeof l.active !== 'boolean')throw new MarketplaceInputError('Location active must be boolean.');return {id:plainText(l?.id,'Location ID',MARKETPLACE_LIMITS.pickupId,true),name:plainText(l?.name,'Location name',150,true),city:plainText(l?.city,'City',100,true),area:plainText(l?.area,'Area',150,true),addressOrLandmark:plainText(l?.addressOrLandmark,'Address',300),phone:plainText(l?.phone,'Phone',32),active:l?.active !== false};});
    if (new Set((input.pickupLocations as {id:string}[]).map(l=>l.id)).size !== body.pickupLocations.length) throw new MarketplaceInputError('Duplicate pickup IDs.');
  }
  if (body.variants !== undefined) {
    if (!Array.isArray(body.variants) || body.variants.length > 30) throw new MarketplaceInputError('Invalid variants.');
    input.variants = body.variants.map(v=>{ if(v?.active !== undefined && typeof v.active !== 'boolean')throw new MarketplaceInputError('Variant active must be boolean.');const priceMinor = v?.priceMinor ?? (typeof v?.priceGhc === 'number' ? Math.round(v.priceGhc*100) : NaN); if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0 || priceMinor > 2147483647) throw new MarketplaceInputError('Variant requires a positive price.'); return {id:plainText(v?.id,'Variant ID',MARKETPLACE_LIMITS.variantId,true),name:plainText(v?.name,'Variant name',150,true),priceMinor,priceGhc:priceMinor/100,active:v?.active !== false}; });
    if (new Set((input.variants as {id:string}[]).map(v=>v.id)).size !== body.variants.length) throw new MarketplaceInputError('Duplicate variant IDs.');
  }
  const merged = {...(existing ? toAdminMarketplaceProduct(existing) : {}), ...input};
  const kind = merged.productKind || 'physical'; const mode = merged.fulfilmentMode || 'both';
  if (!FULFILMENT_MODES[kind as keyof typeof FULFILMENT_MODES]?.includes(mode as never)) throw new MarketplaceInputError('Fulfilment mode does not match product type.');
  if(mode === 'inquiry_only' || merged.priceType === 'quote') {input.purchaseEnabled=false;merged.purchaseEnabled=false;}
  const allCategories = await MarketplaceControlStore.getCategories();
  if (merged.category && !allCategories.some(c => c.slug === merged.category && (c.active || existing?.category === c.slug))) throw new MarketplaceInputError('Select an active category.');
  if (encouragesCredentials([merged.fulfilmentIdentifierLabel,merged.fulfilmentIdentifierPlaceholder,merged.fulfilmentNote,merged.purchaseNote,merged.description,merged.deliveryNote].join(' '))) throw new MarketplaceInputError('Never request external passwords, security codes or credentials.');
  if (merged.fulfilmentIdentifierRequired && !merged.fulfilmentIdentifierLabel) throw new MarketplaceInputError('Required identifier needs a label.');
  if (merged.published) {
    if (existing?.archived) throw new MarketplaceInputError('Restore archived products before publishing.');
    const readiness = productReadiness(merged,allCategories);
    if (readiness.blockers.length) throw new MarketplaceInputError(readiness.blockers.join(' '));
    if (readiness.warnings.length && body.confirmWarnings !== true) throw new MarketplaceInputError(`Confirm publishing with warnings: ${readiness.warnings.join(' ')}`,409);
  }
  return input as unknown as CreateMarketplaceProductInput;
}
