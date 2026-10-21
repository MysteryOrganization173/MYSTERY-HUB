import type { SiteContent, SiteSettings, WebsiteSiteRecord } from '../types/index.js';

/**
 * Unsaved editor work mirrored on this device, one key per website. It is cleared once the server confirms
 * the save, and when the website is deleted (see websiteBrowserKeys).
 */
export interface DraftRecovery { base: string; at: number; name: string; content: SiteContent; settings: SiteSettings }
const key = (id: string) => `mh_website_draft_recovery:${id}`;
const RECOVERY_MAX_AGE = 14 * 24 * 60 * 60 * 1000;

export function writeDraftRecovery(id: string, draft: Omit<DraftRecovery, 'at'>) {
  try { localStorage.setItem(key(id), JSON.stringify({ ...draft, at: Date.now() })); } catch { /* storage full or blocked: the server draft still autosaves */ }
}
export function clearDraftRecovery(id: string) { try { localStorage.removeItem(key(id)); } catch { /* unavailable */ } }

/** A recovery is offered only when it holds something the saved draft does not. */
export function readDraftRecovery(site: Pick<WebsiteSiteRecord, 'id' | 'name' | 'content_json' | 'settings_json'>, now = Date.now()): DraftRecovery | null {
  try {
    const raw = localStorage.getItem(key(site.id)); if (!raw) return null;
    const r = JSON.parse(raw) as DraftRecovery;
    if (!r || typeof r !== 'object' || !r.content || !r.settings || typeof r.at !== 'number' || now - r.at > RECOVERY_MAX_AGE) { clearDraftRecovery(site.id); return null; }
    if (JSON.stringify([r.name, r.content, r.settings]) === JSON.stringify([site.name, site.content_json, site.settings_json])) { clearDraftRecovery(site.id); return null; }
    return r;
  } catch { return null; }
}


/** V5 fields merge on the server, so a field the owner removed is sent as null to clear it. */
const V5_CLEARABLE = ['hours','policies','sections','imageMeta','gallery','pinnedBundles'] as const;
export function withV5Clears(saved: SiteContent, draft: SiteContent): SiteContent {
  const out: any = {...draft};
  for (const key of V5_CLEARABLE) if (saved?.[key] !== undefined && draft[key] === undefined) out[key] = null;
  return out;
}

