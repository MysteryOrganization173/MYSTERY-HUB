export type ProductKind = 'physical' | 'digital' | 'service';
export type FulfilmentMode = 'pickup' | 'delivery' | 'both' | 'digital_delivery' | 'manual_activation' | 'inquiry_only';
export const FULFILMENT_MODES: Record<ProductKind, FulfilmentMode[]> = {
  physical: ['pickup', 'delivery', 'both', 'inquiry_only'],
  digital: ['digital_delivery', 'manual_activation', 'inquiry_only'],
  service: ['manual_activation', 'inquiry_only'],
};
export const FULFILMENT_LABELS: Record<FulfilmentMode, string> = {
  pickup: 'Pickup', delivery: 'Doorstep Delivery', both: 'Pickup + Delivery',
  digital_delivery: 'Digital Delivery', manual_activation: 'Manual Activation', inquiry_only: 'Inquiry Required',
};
export interface ReadinessProduct {
  name?: string; category?: string; productKind?: string; priceType?: string; priceMinor?: number | null;
  purchaseEnabled?: boolean; fulfilmentMode?: string; pickupLocations?: { active?: boolean; name?: string; city?: string; area?: string }[];
  deliveryAvailable?: boolean; imageUrl?: string; imageAlt?: string; description?: string; highlights?: string[];
  referralRewardMinor?: number | null; fulfilmentIdentifierLabel?: string; fulfilmentIdentifierPlaceholder?: string;
  fulfilmentIdentifierRequired?: boolean; fulfilmentNote?: string; purchaseNote?: string;
}
// Reject credential-collection instructions, including common separator obfuscations.
export function encouragesCredentials(text: string): boolean {
  return /pass\s*word|passcode|otp|one[ -]?time[ -]?(?:code|password)|secret|security[ -]?(?:code|answer)|credential|pin\b/i.test(text.replace(/[_.\-]/g, ' '));
}
export function productReadiness(p: ReadinessProduct, categories?: { slug: string; active: boolean }[]) {
  const blockers: string[] = []; const warnings: string[] = [];
  const kind = p.productKind ?? 'physical'; const mode = p.fulfilmentMode || 'both';
  if (!p.name || p.name.trim().length < 2) blockers.push('Enter a product name (at least 2 characters).');
  if (!p.category || p.category === 'all' || (categories && !categories.some(c => c.slug === p.category && c.active))) blockers.push('Select an active category.');
  if (!['fixed', 'starting_at', 'quote'].includes(p.priceType || '')) blockers.push('Select a valid price type.');
  if (p.priceType !== 'quote' && (!Number.isSafeInteger(p.priceMinor) || p.priceMinor! <= 0)) blockers.push('Enter a positive price.');
  if (!FULFILMENT_MODES[kind as ProductKind]?.includes(mode as FulfilmentMode)) blockers.push('Fulfilment mode does not match product type.');
  if (kind === 'physical' && p.purchaseEnabled !== false && p.priceType !== 'quote' && mode !== 'inquiry_only') {
    const pickup = p.pickupLocations?.some(l => l.active !== false && l.name?.trim() && l.city?.trim() && l.area?.trim());
    const delivery = p.deliveryAvailable !== false;
    if ((mode === 'pickup' && !pickup) || (mode === 'delivery' && !delivery) || (mode === 'both' && !pickup && !delivery)) blockers.push('Configure an active pickup location or available delivery.');
  }
  if (p.fulfilmentIdentifierRequired && !p.fulfilmentIdentifierLabel?.trim()) blockers.push('Required identifier needs a label.');
  if (encouragesCredentials([p.fulfilmentIdentifierLabel, p.fulfilmentIdentifierPlaceholder, p.fulfilmentNote, p.purchaseNote].join(' '))) blockers.push('Never request passwords, security codes, or credentials.');
  if (!p.imageUrl) warnings.push('No product image.');
  if (!p.imageAlt) warnings.push('No image alt text.');
  if (!p.description) warnings.push('No description.');
  if (!p.highlights?.length) warnings.push('No highlights.');
  if (!p.referralRewardMinor) warnings.push('No Share & Earn reward configured.');
  return { blockers, warnings, ready: !blockers.length && !warnings.length };
}
export function whatsappLink(phone: string | null | undefined): string | null {
  const digits = (phone || '').replace(/[\s()+-]/g, '');
  const normalized = /^0\d{9}$/.test(digits) ? `233${digits.slice(1)}` : digits;
  return /^233\d{9}$/.test(normalized) ? `https://wa.me/${normalized}` : null;
}
