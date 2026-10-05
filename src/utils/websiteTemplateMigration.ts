import { createWebsiteComposition, SECTION_REGISTRY, type WebsiteSectionType } from '../config/websiteBuilder.js';
import { WEBSITE_TEMPLATES } from '../data/templates.js';
import type { SiteContent } from '../types/index.js';
/** Same mapping drives the confirmation preview and the independently computed server action. */
export function migrateWebsiteTemplate(content: SiteContent, fromId: string, targetId: string): SiteContent {
  const target = WEBSITE_TEMPLATES.find(t => t.id === targetId);
  if (!target) throw new Error('Unknown template.');
  const from = WEBSITE_TEMPLATES.find(t => t.id === fromId);
  const itemsType: WebsiteSectionType = ['restaurant','ecommerce','fashion','reseller'].includes(target.layoutType || '') ? 'products' : target.layoutType === 'portfolio' ? 'gallery' : 'services';
  const composition = structuredClone(target.composition || createWebsiteComposition(['header','hero',itemsType,'about','contact','location','footer']));
  const compatible = from?.layoutType === target.layoutType;
  // The existing website store persists the editable item vocabulary, not demo-only
  // specs/ratings. Target defaults must use that same contract so the next full save works.
  const items=(compatible ? content.items : target.items)?.map(({specs:_specs,rating:_rating,...item})=>structuredClone(item));
  const stats=compatible ? content.stats : (target.stats || []).slice(0,8).map(stat=>({label:stat.label.replace(/[<>]/g,'').slice(0,50).trim(),value:stat.value.replace(/[<>]/g,'').slice(0,50).trim()}));
  const migrated = { ...content, items:items || [], stats, features: compatible ? content.features : [...target.features], composition };
  for (const section of composition.sections) {
    const source = content.composition?.sections.find(s => s.type === section.type);
    if (!source) continue;
    section.data = structuredClone(source.data);
    section.enabled = SECTION_REGISTRY[section.type].required ? true : source.enabled;
    if ((SECTION_REGISTRY[section.type].variants as readonly string[]).includes(source.variant)) section.variant = source.variant;
  }
  return migrated;
}
