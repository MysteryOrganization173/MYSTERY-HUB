import { createWebsiteComposition, SECTION_REGISTRY, type WebsiteSectionType } from '../config/websiteBuilder.js';
import { WEBSITE_TEMPLATES } from '../data/templates.js';
import type { SiteContent } from '../types/index.js';

export function websiteMigrationSummary(fromId: string, targetId: string) {
  const from = WEBSITE_TEMPLATES.find(t => t.id === fromId);
  const target = WEBSITE_TEMPLATES.find(t => t.id === targetId);
  if (!target) throw new Error('Unknown template.');
  // Matching field names are not evidence that two industries share content.
  const compatible = !!from?.layoutType && from.layoutType === target.layoutType;
  return { target, compatible,
    kept: ['Business name & logo', 'Phone, WhatsApp & email', 'Location & social links', 'Site address & brand colours', 'Uploaded media library', ...(compatible ? ['Business content & image assignments'] : [])],
    reset: compatible ? ['Page layout'] : [`${from?.title || 'Previous design'} content & item lists`, 'Cover & gallery image assignments', 'Statistics, testimonials & custom sections'],
  };
}

/** The preview and server action use the same identity-only migration across industries. */
export function migrateWebsiteTemplate(content: SiteContent, fromId: string, targetId: string): SiteContent {
  const {target, compatible} = websiteMigrationSummary(fromId, targetId);
  if (fromId === targetId) return structuredClone(content);
  const itemsType: WebsiteSectionType = ['restaurant','ecommerce','fashion','reseller'].includes(target.layoutType || '') ? 'products' : target.layoutType === 'portfolio' ? 'gallery' : 'services';
  const composition = structuredClone(target.composition || createWebsiteComposition(['header','hero',itemsType,'about','contact','location','footer']));
  const defaultCta = (id:string) => id==='tmpl-data-reseller'?'Buy Data':id==='tmpl-start-blank'?'Contact us':'Order via WhatsApp';
  const genericAction = /^(contact|message|talk|call)\b/i.test(content.ctaLabel || '');
  const migrated: SiteContent = compatible ? structuredClone(content) : {
    businessName: content.businessName, logoUrl: content.logoUrl,
    location: content.location, phone: content.phone, whatsapp: content.whatsapp, email: content.email,
    social: structuredClone(content.social || {}),
    tagline: '', aboutText: '', heroImage: '', ctaLabel: genericAction ? content.ctaLabel : defaultCta(targetId), ctaTarget: genericAction ? content.ctaTarget || '' : '',
    items: [], stats: [], features: [],
  };
  if (compatible && migrated.ctaLabel === defaultCta(fromId)) migrated.ctaLabel = defaultCta(targetId);
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
