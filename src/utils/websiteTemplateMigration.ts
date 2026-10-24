import { SECTION_REGISTRY } from '../config/websiteBuilder.js';
import { WEBSITE_TEMPLATES } from '../data/templates.js';
import type { SiteContent } from '../types/index.js';
import { websiteStarterWording } from '../config/websiteStarters.js';

export function websiteMigrationSummary(fromId: string, targetId: string) {
  const from = WEBSITE_TEMPLATES.find(t => t.id === fromId);
  const target = WEBSITE_TEMPLATES.find(t => t.id === targetId);
  if (!target) throw new Error('Unknown template.');
  // Matching field names are not evidence that two industries share content. Designs for the same kind
  // of business (Classic Kitchen and Night Kitchen, Classic Shop and Boutique) share one content family.
  const compatible = !!from && websiteContentFamily(from) === websiteContentFamily(target);
  return { target, compatible,
    kept: ['Business name & logo', 'Phone, WhatsApp & email', 'Location & social links', 'Opening hours & policies', 'Site address & brand colours', 'Uploaded media library', ...(compatible ? ['Business content & image assignments'] : [])],
    reset: compatible ? ['Page layout', ...(from?.layoutType !== target.layoutType ? ['Section order & hidden sections'] : [])] : [`${from?.categoryLabel || 'Previous design'} content & item lists`, 'Cover & gallery image assignments', 'Statistics, testimonials & custom sections'],
  };
}

/** The preview and server action use the same identity-only migration across industries. */
export const websiteContentFamily = (template: { layoutType?: string; contentFamily?: string }) => template.contentFamily || template.layoutType || '';
export function migrateWebsiteTemplate(content: SiteContent, fromId: string, targetId: string): SiteContent {
  const {target, compatible} = websiteMigrationSummary(fromId, targetId);
  if (fromId === targetId) return structuredClone(content);
  // Legacy templates must retain their real renderer, rather than becoming a generic section page.
  const composition = target.composition ? structuredClone(target.composition) : compatible && content.composition ? structuredClone(content.composition) : undefined;
  const defaultCta = (id:string) => id==='tmpl-data-reseller'?'Shop Bundles':id==='tmpl-start-blank'?'Contact us':'Order via WhatsApp';
  const genericAction = /^(contact|message|talk|call)\b/i.test(content.ctaLabel || '');
  // A contact-style label still works on other designs, but the Data store's main button always opens its
  // bundles, so there it would mislead buyers: switching into the Data store gives it Buy Data.
  const keepAction = genericAction && targetId !== 'tmpl-data-reseller';
  // Text written for another kind of business starts fresh, with the new design's suggested wording
  // (claim-free and marked "Suggested" in the editor) instead of an empty headline.
  const starter = websiteStarterWording(targetId);
  const migrated: SiteContent = compatible ? structuredClone(content) : {
    ...(content.starterVersion!==undefined?{starterVersion:content.starterVersion}:{}),
    layoutMode: target.composition ? 'sections' : 'template',
    businessName: content.businessName, logoUrl: content.logoUrl,
    location: content.location, phone: content.phone, whatsapp: content.whatsapp, email: content.email,
    social: structuredClone(content.social || {}),
    tagline: starter?.tagline || '', aboutText: starter?.aboutText || '',
    // A design switch into the Data store starts with the neutral starter, written explicitly so it is never
    // confused with an older site's inherited banner. Other designs keep falling back to their own photo.
    heroImage: targetId === 'tmpl-data-reseller' ? target.heroImage || '' : '', ctaLabel: keepAction ? content.ctaLabel : defaultCta(targetId), ctaTarget: keepAction ? content.ctaTarget || '' : '',
    items: [], stats: [], features: [],
    // V5: opening hours, policies and the logo description describe the business, not the design.
    ...(content.hours ? { hours: structuredClone(content.hours) } : {}),
    ...(content.policies ? { policies: structuredClone(content.policies) } : {}),
    ...(content.imageMeta?.logoUrl ? { imageMeta: { logoUrl: structuredClone(content.imageMeta.logoUrl) } } : {}),
  };
  // Section choices belong to one design's own sections.
  if (WEBSITE_TEMPLATES.find(t => t.id === fromId)?.layoutType !== target.layoutType) delete migrated.sections;
  if (compatible && migrated.ctaLabel === defaultCta(fromId)) migrated.ctaLabel = defaultCta(targetId);
  if (!composition) { delete migrated.composition; return migrated; }
  migrated.composition = composition;
  for (const section of composition.sections) {
    const source = content.composition?.sections.find(s => s.type === section.type);
    if (!source || !compatible) continue;
    section.data = structuredClone(source.data);
    if(section.type==='hero' && section.data.ctaLabel===defaultCta(fromId)) section.data.ctaLabel=defaultCta(targetId);
    section.enabled = SECTION_REGISTRY[section.type].required ? true : source.enabled;
    if ((SECTION_REGISTRY[section.type].variants as readonly string[]).includes(source.variant)) section.variant = source.variant;
  }
  return migrated;
}
