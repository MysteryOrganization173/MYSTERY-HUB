/**
 * What an owner should look at next, worked out only from records the dashboard already loaded.
 * Nothing here is a guess: every item points at a real gap and at the place that fixes it.
 */
export type OwnerAttentionAction = 'edit' | 'pricing' | 'earnings' | 'share' | 'publish';
export interface OwnerAttentionItem {id: string; title: string; detail: string; action: OwnerAttentionAction; label: string; tone: 'warn' | 'info'}

export interface OwnerAttentionInput {
  reseller: boolean;
  published: boolean;
  content?: {phone?: string; whatsapp?: string; email?: string} | null;
  /** Owner bundle catalogue, when loaded: how many bundles customers can actually buy. */
  sellableBundles?: number | null;
  reconciliationRequired?: boolean;
  views?: number | null;
}

export function ownerAttention(input: OwnerAttentionInput): OwnerAttentionItem[] {
  const items: OwnerAttentionItem[] = [];
  const c = input.content || {};
  if (input.reseller && input.sellableBundles === 0) items.push({id: 'bundles', tone: 'warn', action: 'pricing', label: 'Set up bundles',
    title: 'No bundles on sale yet', detail: 'Customers see an empty store until you switch on bundles and set your prices.'});
  if (input.reconciliationRequired) items.push({id: 'earnings', tone: 'warn', action: 'earnings', label: 'View Store Earnings',
    title: 'Store Earnings are being reviewed', detail: 'Our team needs to check your earnings before you can withdraw.'});
  if (!String(c.phone || '').trim() && !String(c.whatsapp || '').trim()) items.push({id: 'contact', tone: 'warn', action: 'edit', label: 'Add a number',
    title: 'Customers can’t call or WhatsApp you', detail: 'Add a phone or WhatsApp number so customers can reach you from your website.'});
  if (!input.published) items.push({id: 'publish', tone: 'info', action: 'publish', label: 'Publish',
    title: 'Your website isn’t live yet', detail: 'Only you can see it. Publish when it looks right.'});
  else if (input.views === 0) items.push({id: 'share', tone: 'info', action: 'share', label: 'Share link',
    title: 'No visits in this period', detail: 'Share your link on WhatsApp status or with your customers to get your first visitors.'});
  return items;
}

export interface OwnerSuggestionInput {
  reseller: boolean;
  /** True for designs that show an item list (menu, services, products...). */
  hasItems: boolean;
  itemWord: string;
  content?: {logoUrl?: string; aboutText?: string; tagline?: string; location?: string; items?: unknown[]} | null;
}

/** Older Data starters told customers to order on WhatsApp; Data stores take orders and payment on the page. */
export const WHATSAPP_ORDERING_WORDING = /(order|buy)[^.]{0,40}(through|on|via|by)\s+whatsapp|whatsapp\s+(to\s+)?order/i;

/**
 * Optional improvements, tailored to the business type and worked out from the saved draft only.
 * They never change anything themselves; each opens the editor where the owner decides.
 */
export function ownerSuggestions(input: OwnerSuggestionInput): OwnerAttentionItem[] {
  const c = input.content || {}, items: OwnerAttentionItem[] = [];
  if (input.reseller && WHATSAPP_ORDERING_WORDING.test(`${c.tagline || ''} ${c.aboutText || ''}`)) items.push({id: 'wording', tone: 'info', action: 'edit', label: 'Review wording',
    title: 'Your description says to order on WhatsApp', detail: 'Customers buy and pay for bundles on your website. Updating this line stops people messaging you to place orders.'});
  if (!String(c.logoUrl || '').trim()) items.push({id: 'logo', tone: 'info', action: 'edit', label: 'Add logo',
    title: 'Add your logo', detail: 'Your logo appears at the top of every page and helps customers recognise you.'});
  if (input.hasItems && !(c.items || []).length) items.push({id: 'items', tone: 'info', action: 'edit', label: `Add ${input.itemWord}`,
    title: `Show your ${input.itemWord}`, detail: `Customers decide faster when they can see your ${input.itemWord} and prices.`});
  if (!String(c.location || '').trim()) items.push({id: 'location', tone: 'info', action: 'edit', label: 'Add location',
    title: 'Say where you are', detail: 'A town or area helps local customers trust and find you.'});
  return items.slice(0, 3);
}
