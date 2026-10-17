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
