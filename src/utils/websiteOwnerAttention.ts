/**
 * What an owner should look at next, worked out only from records the dashboard already loaded.
 * Nothing here is a guess: every item points at a real gap and at the place that fixes it.
 */
export type OwnerAttentionAction = 'edit' | 'pricing' | 'earnings' | 'share' | 'publish' | 'orders' | 'support';
export interface OwnerAttentionItem {id: string; title: string; detail: string; action: OwnerAttentionAction; label: string; tone: 'warn' | 'info'}

export interface OwnerAttentionInput {
  reseller: boolean;
  published: boolean;
  content?: {phone?: string; whatsapp?: string; email?: string} | null;
  /** Owner bundle catalogue, when loaded: how many bundles customers can actually buy. */
  sellableBundles?: number | null;
  reconciliationRequired?: boolean;
  views?: number | null;
  /** Loaded Data orders on review or failed/refund paths (server statuses only). */
  ordersNeedingCheck?: number;
}

export function ownerAttention(input: OwnerAttentionInput): OwnerAttentionItem[] {
  const items: OwnerAttentionItem[] = [];
  const c = input.content || {};
  if (input.reseller && input.ordersNeedingCheck) items.push({id: 'orders', tone: 'warn', action: 'orders', label: 'See orders',
    title: input.ordersNeedingCheck === 1 ? '1 order needs a check' : `${input.ordersNeedingCheck} orders need a check`, detail: 'Mystery Hub is reviewing delivery or a refund. Tell the customer not to pay again for the same order.'});
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

/**
 * A new Data store's three launch steps, from records the dashboard already loaded. The card disappears once
 * bundles are on sale and the store is published; sharing is never marked done because it never finishes.
 */
/**
 * Reseller Experience V1: one answer to "can customers buy from my store right now, and if not, what next?".
 * Built only from the owner bundle catalogue the dashboard already loads (`/bundles`: each product's server
 * `eligible`, `configured`, `enabled`, `retailMinor`, and the store `policy.enabled` switch) plus the site's
 * publish state. It never says a store is open unless the server would let a customer start checkout.
 */
export interface ResellerCatalogueSummary {
  /** Bundles customers can buy now (server `eligible`: checkout on, Mystery Hub cost set, owner on sale at or above the minimum). */
  sellable: number;
  /** Bundles the owner priced and switched on, whatever Mystery Hub's side currently allows. */
  ownerOnSale: number;
  /** Bundles Mystery Hub can supply to reseller stores right now (server `configured`). */
  available: number;
  /** Mystery Hub's store checkout switch (server `policy.enabled`). */
  checkoutEnabled: boolean;
}
export function resellerCatalogueSummary(response: {products?: Array<{eligible?: boolean; configured?: boolean; enabled?: boolean; retailMinor?: number}>; policy?: {enabled?: boolean}} | null | undefined): ResellerCatalogueSummary | null {
  if (!response || !Array.isArray(response.products)) return null;
  const products = response.products;
  return {
    sellable: products.filter(p => p.eligible).length,
    ownerOnSale: products.filter(p => p.enabled && Number(p.retailMinor) > 0).length,
    available: products.filter(p => p.configured).length,
    checkoutEnabled: response.policy?.enabled === true,
  };
}

export type ResellerStoreState = 'checkout-paused' | 'catalogue-unavailable' | 'needs-bundles' | 'needs-publish' | 'open';
export interface ResellerStoreStatus {
  state: ResellerStoreState;
  /** ready: customers can buy; setup: the owner has a step to take; blocked: waiting on Mystery Hub, nothing for the owner to fix. */
  tone: 'ready' | 'setup' | 'blocked';
  label: string;
  title: string;
  detail: string;
  action?: {action: OwnerAttentionAction; label: string};
}
const bundles = (n: number) => n === 1 ? '1 bundle' : `${n} bundles`;
export function resellerStoreStatus(input: {published: boolean; catalogue: ResellerCatalogueSummary | null}): ResellerStoreStatus | null {
  const c = input.catalogue;
  if (!c) return null;
  if (!c.checkoutEnabled) return {state: 'checkout-paused', tone: 'blocked', label: 'Checkout paused',
    title: 'Customers can’t pay on your store right now',
    detail: `Mystery Hub has paused online checkout for reseller stores, so no orders can be placed.${c.ownerOnSale ? ' Your prices are kept, and bundles priced at or above their minimum go back on sale when checkout reopens.' : ' You can still set up your bundles and prices now.'}`,
    action: {action: 'support', label: 'Ask Mystery Hub'}};
  if (!c.available) return {state: 'catalogue-unavailable', tone: 'blocked', label: 'Bundles unavailable',
    title: 'Mystery Hub can’t supply bundles right now',
    detail: 'None of the bundles can be sold at the moment, so your store shows no bundles. Your prices are kept. Nothing for you to fix; check back later.',
    action: {action: 'support', label: 'Ask Mystery Hub'}};
  if (!c.sellable) return {state: 'needs-bundles', tone: 'setup', label: input.published ? 'Live, no bundles' : 'Not ready yet',
    title: input.published ? 'Your store is live but has nothing to buy' : 'Choose the bundles you want to sell',
    detail: c.ownerOnSale ? 'None of the bundles you switched on can be sold right now. Open Bundles & Pricing to see which need a new price or are unavailable.' : 'Pick your networks and add your profit. Quick setup does it in one go.',
    action: {action: 'pricing', label: 'Set up bundles'}};
  if (!input.published) return {state: 'needs-publish', tone: 'setup', label: 'Not published',
    title: 'Publish to open your store',
    detail: `${bundles(c.sellable)} ready at your prices. Your store link starts working for customers once you publish.`,
    action: {action: 'publish', label: 'Publish'}};
  return {state: 'open', tone: 'ready', label: 'Open for orders',
    title: `Customers can buy ${bundles(c.sellable)}`,
    detail: 'Each order is paid on your store and sent by Mystery Hub. A bundle can still be briefly unavailable if the network has a problem.',
    action: {action: 'share', label: 'Share your store'}};
}

export type ResellerLaunchStep = {id: 'bundles' | 'publish' | 'share'; title: string; detail: string; done: boolean; action: OwnerAttentionAction; label: string; ready: boolean};
export function resellerLaunchSteps(input: {sellableBundles?: number | null; published: boolean}): ResellerLaunchStep[] | null {
  const onSale = input.sellableBundles ?? null;
  if (onSale === null || (onSale > 0 && input.published)) return null;
  return [
    {id: 'bundles', action: 'pricing', label: onSale > 0 ? 'Edit bundles' : 'Set up bundles', ready: true, done: onSale > 0,
      title: onSale > 0 ? `${onSale === 1 ? '1 bundle' : `${onSale} bundles`} on sale` : 'Put bundles on sale',
      detail: onSale > 0 ? 'Customers can buy these at the prices you set.' : 'Choose the MTN, Telecel and AirtelTigo bundles to sell and set your prices.'},
    {id: 'publish', action: 'publish', label: 'Publish', ready: true, done: input.published,
      title: input.published ? 'Store published' : 'Publish your store', detail: input.published ? 'Your store link works for customers.' : 'Your store link starts working for customers once you publish.'},
    {id: 'share', action: 'share', label: 'Share link', ready: input.published, done: false,
      title: 'Share your store link', detail: input.published ? 'Send it to customers on WhatsApp or post it on your status.' : 'Available once your store is published.'},
  ];
}
