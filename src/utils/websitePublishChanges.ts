import type { SiteContent, SiteSettings, WebsitePublishedSnapshot } from '../types/index.js';
import { WEBSITE_TEMPLATES } from '../data/templates.js';

/**
 * Plain-language list of what "Update live site" will change, compared with the published snapshot.
 * Purely informational: the server publishes the saved draft whatever this says.
 */
// PostgreSQL JSONB reorders object keys. Object ordering is not a draft change; array order is.
const stable=(value:unknown)=>JSON.stringify(value??null,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const same = (a: unknown, b: unknown) => stable(a) === stable(b);
const FIELDS: [keyof SiteContent, string][] = [
  ['businessName', 'Business name'], ['tagline', 'Headline'], ['aboutText', 'Description'], ['location', 'Location'],
  ['heroImage', 'Main photo'], ['logoUrl', 'Logo'], ['ctaLabel', 'Main button'], ['ctaTarget', 'Main button link'],
  ['hours', 'Opening hours'], ['policies', 'Delivery, payment & returns'], ['sections', 'Page sections'], ['gallery', 'Gallery photos'],
  ['imageMeta', 'Photo focus and descriptions'], ['copy', 'Headings and labels'], ['social', 'Social links'], ['composition', 'Custom sections'],
  ['pinnedBundles', 'Featured bundles'], ['features', 'Feature details'], ['stats', 'Business facts'],
];
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function websitePublishChanges(snapshot: WebsitePublishedSnapshot | null | undefined, draft: { templateId: string; content: SiteContent; settings: SiteSettings }, itemWord = 'item'): string[] {
  if (!snapshot) return [];
  const out: string[] = [];
  if (snapshot.templateId !== draft.templateId) out.push(`New design: ${WEBSITE_TEMPLATES.find(t => t.id === draft.templateId)?.title || 'a different design'}`);
  for (const [key, label] of FIELDS) if (!same(snapshot.content?.[key], draft.content[key])) out.push(label);
  const contacts = (['phone', 'whatsapp', 'email'] as const).filter(k => !same(snapshot.content?.[k], draft.content[k]));
  if (contacts.length) out.push('Contact details');
  const before = new Map((snapshot.content?.items || []).map((i, n) => [i.id || `#${n}`, i]));
  const after = new Map((draft.content.items || []).map((i, n) => [i.id || `#${n}`, i]));
  const added = [...after.keys()].filter(id => !before.has(id)).length;
  const removed = [...before.keys()].filter(id => !after.has(id)).length;
  const changed = [...after.entries()].filter(([id, item]) => before.has(id) && !same(before.get(id), item)).length;
  const order = !added && !removed && !changed && !same([...before.keys()], [...after.keys()]);
  if (added) out.push(`${plural(added, itemWord)} added`);
  if (removed) out.push(`${plural(removed, itemWord)} removed`);
  if (changed) out.push(`${plural(changed, itemWord)} changed`);
  if (order) out.push(`${itemWord[0].toUpperCase()}${itemWord.slice(1)} order`);
  if ((['primaryColor', 'accentColor', 'backgroundColor'] as const).some(k => !same(snapshot.settings?.[k], draft.settings[k]))) out.push('Colours');
  if (!same(snapshot.settings?.fontFamily, draft.settings.fontFamily)) out.push('Font');
  if (!same(snapshot.settings?.borderRadius, draft.settings.borderRadius)) out.push('Corner style');
  return out;
}
