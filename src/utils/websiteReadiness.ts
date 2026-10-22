import type { SiteContent, WebsitePublishedSnapshot, SiteSettings } from '../types/index.js';
import { whatsappOrderUrl } from './websiteOrderList.js';
import { websiteStarterWording } from '../config/websiteStarters.js';
import { websitePublishChanges } from './websitePublishChanges.js';

/**
 * V5.1 publish readiness: honest, short checks before a website goes public. The
 * editor and server share the same contact policy; drafts may remain incomplete.
 */
export type WebsiteContactNeed = 'whatsapp' | 'contact' | 'none';
// Designs whose main customer action sends an order or enquiry to the owner's WhatsApp.
const WHATSAPP_FIRST = new Set(['tmpl-buka-bistro', 'tmpl-night-kitchen', 'tmpl-boutique', 'tmpl-makola-mart']);
export function websiteContactNeed(templateId: string): WebsiteContactNeed {
  // Data stores sell through Mystery Hub's own checkout; WhatsApp is only for help.
  if (templateId === 'tmpl-data-reseller') return 'none';
  return WHATSAPP_FIRST.has(templateId) ? 'whatsapp' : 'contact';
}
/** Same rule the published website uses to build its wa.me links (024…, 23324… and +233… all work). */
export const hasWorkingWhatsApp = (value?: string) => !!whatsappOrderUrl(value, '');
export function hasWorkingContact(content: Partial<SiteContent>): boolean {
  return hasWorkingWhatsApp(content.whatsapp) || (content.phone || '').replace(/\D/g, '').length >= 9 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((content.email || '').trim());
}
/** Legacy live pages stay online. Unchanged content (including a colours-only update) may be
 * republished; new publications, design switches and changed public content must meet the rule.
 * Callers pass a snapshot only while the site is currently published, never after unpublishing. */
export function websiteContactIssue(templateId:string,content:Partial<SiteContent>,published?:WebsitePublishedSnapshot|null):'whatsapp'|'contact'|null {
  const need=websiteContactNeed(templateId);
  if(need==='none'||(need==='whatsapp'?hasWorkingWhatsApp(content.whatsapp):hasWorkingContact(content)))return null;
  if(published&&published.templateId===templateId&&!websitePublishChanges(published,{templateId,content:content as SiteContent,settings:published.settings}).length)return null;
  return need;
}
const CONTACT_LABEL = /^(contact|message|talk|call|chat)\b/i;

export interface WebsiteReadinessItem {
  id: 'name' | 'whatsapp' | 'contact' | 'tagline' | 'bundles' | 'cta';
  /** required: the publish button waits for it. warning: shown, never blocks. */
  level: 'required' | 'warning';
  title: string; detail: string;
  /** One-tap fix with suggested wording; the owner still chooses to apply it. */
  fix?: { label: string; patch: Partial<SiteContent> };
}
export function websiteReadiness({ templateId, content, layoutMode = 'template', sellableBundles = null, publishedSnapshot }: { templateId: string; content: Partial<SiteContent>; layoutMode?: string; sellableBundles?: number | null; publishedSnapshot?:WebsitePublishedSnapshot|null }): WebsiteReadinessItem[] {
  const out: WebsiteReadinessItem[] = [];
  const need = websiteContactIssue(templateId,content,publishedSnapshot), data = templateId === 'tmpl-data-reseller';
  if (!content.businessName?.trim()) out.push({ id: 'name', level: 'required', title: 'Add your business name', detail: 'It appears at the top of your website and in your link previews.' });
  if (need === 'whatsapp' && !hasWorkingWhatsApp(content.whatsapp)) out.push({ id: 'whatsapp', level: 'required', title: content.whatsapp?.trim() ? 'Check your WhatsApp number' : 'Add your WhatsApp number', detail: 'Customers send their orders to your WhatsApp. Without a working number, your order button has nowhere to go.' });
  if (need === 'contact' && !hasWorkingContact(content)) out.push({ id: 'contact', level: 'required', title: 'Add a way to reach you', detail: 'Add a WhatsApp number, phone or email so your website’s buttons open a real conversation.' });
  if (layoutMode === 'template' && !content.tagline?.trim()) {
    const starter = websiteStarterWording(templateId);
    out.push({ id: 'tagline', level: 'warning', title: 'Your main heading is empty', detail: 'Visitors see a blank space at the top of your website.', ...(starter ? { fix: { label: 'Use suggested wording', patch: { tagline: starter.tagline, ...(content.aboutText?.trim() ? {} : { aboutText: starter.aboutText }) } } } : {}) });
  }
  if (data && sellableBundles === 0) out.push({ id: 'bundles', level: 'warning', title: 'No bundles on sale yet', detail: 'Your store can go live, but customers can’t buy anything until you put bundles on sale.' });
  if (data && CONTACT_LABEL.test(content.ctaLabel || '')) out.push({ id: 'cta', level: 'warning', title: `Your main button says “${content.ctaLabel}”`, detail: 'On a Data store this button opens your bundles, so customers expect it to say Buy Data.', fix: { label: 'Use “Buy Data”', patch: { ctaLabel: 'Buy Data' } } });
  return out;
}

/** One status vocabulary for the website card, editor, dashboard and publish sheet. */
export type WebsiteLiveState = 'not-published' | 'live' | 'live-changes';
export function websiteLiveState(site: { status: string; template_id: string; content_json: SiteContent; settings_json: SiteSettings; published_snapshot_json?: WebsitePublishedSnapshot | null; published_at?: string | null; updated_at: string }): WebsiteLiveState {
  if (site.status !== 'published') return 'not-published';
  // Compare with what visitors actually see; older sites without a snapshot fall back to timestamps.
  if (site.published_snapshot_json) return websitePublishChanges(site.published_snapshot_json, { templateId: site.template_id, content: site.content_json, settings: site.settings_json }).length ? 'live-changes' : 'live';
  return site.published_at && Date.parse(site.updated_at) - Date.parse(site.published_at) > 1000 ? 'live-changes' : 'live';
}
export const WEBSITE_LIVE_LABELS: Record<WebsiteLiveState, { short: string; long: string }> = {
  'not-published': { short: 'Not published', long: 'Not published yet. Only you can see it.' },
  live: { short: 'Live', long: 'Live. Visitors see your latest version.' },
  'live-changes': { short: 'Live · changes waiting', long: 'Live. Your newer changes are saved but visitors don’t see them until you update the live site.' },
};
