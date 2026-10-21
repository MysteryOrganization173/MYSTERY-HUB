import type { WebsiteSiteRecord } from '../types/index.js';

/** Shared by the Danger Zone and the server: the name the owner types, and how it is compared. */
export const websiteDeletionName = (site: Pick<WebsiteSiteRecord, 'name' | 'content_json'>) => site.content_json?.businessName?.trim() || site.name;
export const normalizedDeletionName = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
export function deletionNameMatches(site: Pick<WebsiteSiteRecord, 'name' | 'content_json' | 'slug'>, typed: unknown): boolean {
  if (typeof typed !== 'string' || !typed.trim() || typed.length > 200) return false;
  // Older clients asked for the address; both remain exact, intentional confirmations.
  return [websiteDeletionName(site), site.name].some(name => normalizedDeletionName(name) === normalizedDeletionName(typed)) || typed.trim() === site.slug;
}

export interface WebsiteDeletionBlockerView { code: string; message: string; count?: number; amountMinor?: number }
export interface WebsiteDeletionCheckView {
  site: { id: string; name: string; slug: string; published: boolean; publicUrl: string; templateId: string };
  blockers: WebsiteDeletionBlockerView[];
  canDelete: boolean;
}

// Deleted in this browser session: a stale response or editor state can never bring these back.
const deleted = new Set<string>();
export const isDeletedWebsite = (id: string) => deleted.has(id);
export const withoutDeletedWebsites = <T extends { id: string }>(sites: T[]) => sites.filter(site => !deleted.has(site.id));

/** Per-site browser state that must not follow the owner into a new website. */
// A buyer's checkout recovery key is deliberately kept: it protects against paying twice.
export const websiteBrowserKeys = (id: string) => [`mh_builder_guide_dismissed_${id}`, `mh_website_draft_recovery:${id}`];
export function forgetDeletedWebsite(id: string, storages?: Array<(Pick<Storage, 'removeItem'> & Partial<Pick<Storage,'key'|'length'>>) | undefined>) {
  deleted.add(id);
  if(!storages){storages=[];if(typeof window!=='undefined')for(const name of ['localStorage','sessionStorage'] as const){try{storages.push(window[name]);}catch{/* Storage can be blocked. */}}}
  for (const storage of storages) { try {
    const keys=websiteBrowserKeys(id);
    for(let i=(storage?.length||0)-1;i>=0;i--){const key=storage?.key?.(i);if(key?.startsWith(`mh_website_draft_recovery:${id}:`))keys.push(key);}
    for(const key of keys)storage?.removeItem(key);
  } catch { /* The server deletion still succeeded when browser storage is unavailable. */ } }
}
