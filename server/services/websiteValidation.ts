import { SECTION_REGISTRY, sectionEligible, resolveWebsitePlan, type WebsiteComposition, type WebsiteSectionType, type SectionData, type UltraEnquiryInput } from '../../src/config/websiteBuilder.js';
import { sanitizeUrl } from '../types/website.js';
export class WebsiteInputError extends Error {}
function fail(message: string): never { throw new WebsiteInputError(message); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Expected an object.');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) fail('Unsupported fields or capabilities.');
}
export function safeWebsiteText(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || /[<>]|javascript\s*:|on\w+\s*=/i.test(value)) fail('Invalid or unsafe text.');
  const result = value.trim();
  if (required && !result) fail('Required text is missing.');
  return result;
}
export function safeWebsiteUrl(value: unknown): string {
  const raw = safeWebsiteText(value, 500);
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw) || raw.includes('\\')) fail('Invalid URL. Use a full HTTP or HTTPS address.');
  try { const url = new URL(raw); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || /\s/.test(raw)) fail('Invalid URL.'); return url.href; }
  catch { return fail('Invalid URL. Use a full HTTP or HTTPS address.'); }
}
export function validateWebsiteComposition(value: unknown, userId: string): WebsiteComposition {
  const config = object(value); keys(config, ['version', 'sections']);
  if (config.version !== 1 || !Array.isArray(config.sections) || config.sections.length < 2 || config.sections.length > 25) fail('Invalid section version/count.');
  const ids = new Set<string>();
  const sections = config.sections.map(raw => {
    const section = object(raw); keys(section, ['id', 'type', 'enabled', 'variant', 'order', 'data']);
    const id = safeWebsiteText(section.id, 64, true);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) fail('Invalid or duplicate section id.'); ids.add(id);
    if (typeof section.type !== 'string' || !Object.hasOwn(SECTION_REGISTRY, section.type)) fail('Unknown section type.');
    const type = section.type as WebsiteSectionType;
    if (typeof section.enabled !== 'boolean' || !Number.isInteger(section.order) || (section.order as number) < 0) fail('Invalid section enabled/order.');
    const variant = safeWebsiteText(section.variant, 40, true);
    if (!sectionEligible(type, variant, resolveWebsitePlan(userId))) fail('Unsupported section variant/capability.');
    const rawData = object(section.data); keys(rawData, ['heading', 'body', 'image', 'alt', 'ctaLabel', 'ctaUrl', 'items']);
    const data: SectionData = {};
    for (const key of ['heading', 'body', 'alt', 'ctaLabel'] as const) if (rawData[key] !== undefined) data[key] = safeWebsiteText(rawData[key], key === 'body' ? 2000 : 150);
    if (rawData.image !== undefined) data.image = safeWebsiteUrl(rawData.image);
    if (rawData.ctaUrl !== undefined) {
      const raw = safeWebsiteText(rawData.ctaUrl, 500);
      const result = sanitizeUrl(raw);
      if (raw && !result) fail('Invalid CTA destination.');
      data.ctaUrl = result;
    }
    if (rawData.items !== undefined) {
      if (!Array.isArray(rawData.items) || rawData.items.length > 30) fail('Invalid section items.');
      data.items = rawData.items.map(rawItem => {
        const item = object(rawItem); keys(item, ['title', 'text', 'image', 'price']);
        return { title: safeWebsiteText(item.title, 150, true), ...(item.text !== undefined ? { text: safeWebsiteText(item.text, 1000) } : {}), ...(item.price !== undefined ? { price: safeWebsiteText(item.price, 40) } : {}), ...(item.image !== undefined ? { image: safeWebsiteUrl(item.image) } : {}) };
      });
    }
    return { id, type, enabled: section.enabled as boolean, variant, order: section.order as number, data };
  }).sort((a, b) => a.order - b.order);
  if (sections.some((s, i) => s.order !== i)) fail('Section order must be unique and contiguous.');
  for (const type of ['header', 'footer'] as const) if (sections.filter(s => s.type === type).length !== 1 || !sections.find(s => s.type === type)?.enabled) fail('One enabled header and footer are required.');
  if (sections[0].type !== 'header' || sections.at(-1)?.type !== 'footer') fail('Header must be first and footer last.');
  return { version: 1, sections };
}
/** Validate only supplied fields, so historical contact snapshots can still be read/edited. */
export function validateWebsiteContentPatch(value: unknown): void {
  if (value === undefined) return;
  const content = object(value);
  keys(content, ['composition','businessName','tagline','aboutText','location','phone','whatsapp','email','heroImage','logoUrl','ctaLabel','ctaTarget','social','items','stats','features']);
  const limits = { businessName:100, tagline:150, aboutText:2000, location:150, phone:30, whatsapp:30, email:100, ctaLabel:50 };
  for (const [key, max] of Object.entries(limits)) if (content[key] !== undefined) safeWebsiteText(content[key], max);
  for (const key of ['phone','whatsapp']) {
    const value = content[key];
    if (value && (typeof value !== 'string' || !/^\+?[\d ()-]+$/.test(value) || value.replace(/\D/g,'').length < 7 || value.replace(/\D/g,'').length > 15)) fail('Enter a valid contact phone number.');
  }
  if (content.email && (typeof content.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.email))) fail('Enter a valid email address.');
  for (const key of ['heroImage','logoUrl','ctaTarget']) if (content[key] !== undefined) {
    const raw = safeWebsiteText(content[key],500);
    if (raw && !sanitizeUrl(raw)) fail('Invalid image or CTA URL.');
    if (key !== 'ctaTarget' && raw && !/^https?:\/\//i.test(raw) && !/^\/(?!\/)/.test(raw)) fail('Invalid image URL.');
  }
  if (content.social !== undefined) {
    const social = object(content.social); keys(social,['instagram','facebook','tiktok']);
    for (const [key,value] of Object.entries(social)) {
      const raw = safeWebsiteText(value,key === 'facebook' ? 100 : 50);
      if (raw && !/^[a-zA-Z0-9_.@-]+$/.test(raw) && !/^https?:\/\//.test(raw)) fail('Use a social username or a full URL.');
      if (/^https?:/.test(raw) && !sanitizeUrl(raw)) fail('Invalid social URL.');
    }
  }
  if (content.stats !== undefined) {
    if (!Array.isArray(content.stats) || content.stats.length > 8) fail('Too many statistics.');
    for (const raw of content.stats) { const stat = object(raw); keys(stat,['label','value']); safeWebsiteText(stat.label,50); safeWebsiteText(stat.value,50); }
  }
  if (content.features !== undefined) {
    if (!Array.isArray(content.features) || content.features.length > 10) fail('Too many features.');
    content.features.forEach(value => safeWebsiteText(value,80));
  }
  if (content.items !== undefined) {
    if (!Array.isArray(content.items) || content.items.length > 50) fail('Too many business items.');
    for (const raw of content.items) {
      const item = object(raw); keys(item,['id','name','price','category','network','desc','tag','image']);
      for (const [key,max] of Object.entries({ id:64,name:100,price:40,category:50,network:50,desc:300,tag:40 })) if (item[key] !== undefined) safeWebsiteText(item[key],max);
      if (item.image !== undefined) { const url = safeWebsiteText(item.image,500); if (url && (!sanitizeUrl(url) || !/^https?:\/\//.test(url))) fail('Invalid item image.'); }
    }
  }
}
export function validateUltraEnquiry(value: unknown): UltraEnquiryInput {
  const input = object(value); keys(input, ['businessName', 'businessType', 'contactName', 'phone', 'email', 'existingDomain', 'estimatedPages', 'featuresRequirements', 'preferredStyle', 'referenceWebsite', 'projectNotes']);
  if (!['yes', 'no'].includes(input.existingDomain as string) || !Number.isInteger(input.estimatedPages) || (input.estimatedPages as number) < 1 || (input.estimatedPages as number) > 100) fail('Invalid domain/pages selection.');
  const phone = safeWebsiteText(input.phone, 30, true);
  const digits = phone.replace(/\D/g, '');
  if (!/^\+?[\d ()-]{7,30}$/.test(phone) || digits.length < 7 || digits.length > 15) fail('Invalid phone number.');
  const email = safeWebsiteText(input.email ?? '', 150);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Invalid email.');
  return { businessName: safeWebsiteText(input.businessName, 150, true), businessType: safeWebsiteText(input.businessType, 100, true), contactName: safeWebsiteText(input.contactName, 100, true), phone, email, existingDomain: input.existingDomain as 'yes' | 'no', estimatedPages: input.estimatedPages as number, featuresRequirements: safeWebsiteText(input.featuresRequirements, 2000, true), preferredStyle: safeWebsiteText(input.preferredStyle, 300, true), referenceWebsite: safeWebsiteUrl(input.referenceWebsite ?? ''), projectNotes: safeWebsiteText(input.projectNotes, 2000) };
}
