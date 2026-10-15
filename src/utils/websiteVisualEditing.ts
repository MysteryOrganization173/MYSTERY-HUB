import type { SiteContent, SiteSettings, WebsiteTemplate } from '../types';
import { SECTION_REGISTRY, type SectionData } from '../config/websiteBuilder';
import { sanitizeUrl } from '../../server/types/website';
import {safeWebsiteText, safeWebsiteUrl, validateWebsiteContentPatch} from '../../server/services/websiteValidation';

export type VisualControl = 'text' | 'body' | 'image' | 'email' | 'phone' | 'url' | 'color';
export interface VisualTarget {
  id: string;
  label: string;
  control: VisualControl;
  maxLength: number;
  source: { kind: 'content'; field: keyof SiteContent } | { kind: 'section'; sectionId: string; field: keyof SectionData } | { kind: 'settings'; field: keyof SiteSettings };
  value: string;
  inherited?: boolean;
  destinationId?: string;
}
export const sectionTargetId = (sectionId: string, field: keyof SectionData) => `section:${sectionId}:${field}`;

/** A finite schema map, never a path evaluator. Section edits always create a local override. */
export function visualTargets(t: WebsiteTemplate): VisualTarget[] {
  const c = t.siteContent || {}, targets: VisualTarget[] = [];
  const field = (name: keyof SiteContent, label: string, control: VisualControl, maxLength: number, fallback = '') => {
    targets.push({ id: `content:${name}`, label, control, maxLength, source: { kind: 'content', field: name }, value: String(c[name] ?? fallback) });
  };
  field('businessName', 'Business name', 'text', 100, t.demoBusinessName);
  field('logoUrl', 'Business logo', 'image', 500);
  field('phone', 'Phone number', 'phone', 30);
  field('whatsapp', 'WhatsApp number', 'phone', 30);
  field('email', 'Email address', 'email', 100);
  field('location', 'Location', 'text', 150, t.location);
  if (!t.composition) {
    field('tagline', 'Hero heading', 'text', 150, t.demoHeroTagline);
    field('aboutText', 'Business description', 'body', 2000, t.demoSubtext);
    field('heroImage', 'Hero image', 'image', 500, t.heroImage);
    field('ctaLabel', 'Main button', 'text', 50, 'Contact us');
    if (t.id !== 'tmpl-data-reseller') {
      field('ctaTarget', 'Button destination', 'url', 500);
      targets.find(x => x.id === 'content:ctaLabel')!.destinationId = 'content:ctaTarget';
    }
  } else for (const s of t.composition.sections.filter(s => s.enabled)) {
    const add = (name: keyof SectionData, label: string, control: VisualControl, fallback = '') => targets.push({
      id: sectionTargetId(s.id, name), label: `${SECTION_REGISTRY[s.type].label} · ${label}`, control,
      maxLength: control === 'body' ? 2000 : control === 'url' || control === 'image' ? 500 : 150,
      source: { kind: 'section', sectionId: s.id, field: name },
      value: String(s.data[name] ?? fallback), inherited: s.data[name] === undefined,
    });
    if (!['header', 'footer'].includes(s.type)) add('heading', 'Heading', 'text', s.type === 'hero' ? c.tagline ?? t.demoHeroTagline : SECTION_REGISTRY[s.type].label);
    if (s.type !== 'header') add('body', 'Description', 'body', ['hero', 'about'].includes(s.type) ? c.aboutText ?? t.demoSubtext : s.type === 'location' ? c.location ?? '' : s.type === 'footer' ? c.businessName ?? t.demoBusinessName : '');
    if (s.type === 'hero' || s.data.image) add('image', 'Image', 'image', s.type === 'hero' ? c.heroImage || t.heroImage : '');
    if (['hero', 'contact'].includes(s.type) || s.data.ctaLabel) {
      add('ctaLabel', 'Button', 'text', s.type === 'hero' ? c.ctaLabel ?? 'Contact us' : 'Contact us');
      // The managed catalog destination is fixed by the renderer, not editable commerce.
      if (!(t.id === 'tmpl-data-reseller' && s.type === 'hero')) {
        add('ctaUrl', 'Button destination', 'url', s.type === 'hero' ? c.ctaTarget ?? '' : '');
        targets.find(x => x.id === sectionTargetId(s.id, 'ctaLabel'))!.destinationId = sectionTargetId(s.id, 'ctaUrl');
      }
    }
  }
  for (const [name, label] of [['primaryColor', 'Primary color'], ['accentColor', 'Accent color'], ['backgroundColor', 'Background color']] as const) {
    targets.push({ id: `settings:${name}`, label, control: 'color', maxLength: 7, source: { kind: 'settings', field: name }, value: name === 'accentColor' ? t.accentColor : t.colorScheme?.[name === 'primaryColor' ? 'primary' : 'background'] || '#ffffff' });
  }
  return targets;
}
export function visualValueError(target: VisualTarget, value: string): string {
  if (value.length > target.maxLength) return `Use no more than ${target.maxLength} characters.`;
  if (/[<>]/.test(value)) return 'Use plain text without HTML tags.';
  if (target.control === 'color' && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return 'Use a hex color such as #2563eb.';
  if (target.control === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
  if (['url', 'image'].includes(target.control) && value && (!sanitizeUrl(value) || (target.control === 'image' && !/^(https?:\/\/|\/(?!\/))/.test(value)))) return 'Use a safe website address or supported relative link.';
  try {
    if (target.source.kind === 'content') validateWebsiteContentPatch({[target.source.field]:value});
    if (target.source.kind === 'section') {
      safeWebsiteText(value,target.maxLength);
      if (target.control === 'image') safeWebsiteUrl(value);
    }
  } catch (error) {return error instanceof Error ? error.message : 'Check this value.';}
  return '';
}
export function applyVisualValue(content: SiteContent, settings: SiteSettings, template: WebsiteTemplate, id: string, value: string): {content: SiteContent; settings: SiteSettings} | null {
  const target = visualTargets(template).find(t => t.id === id);
  if (!target || visualValueError(target, value)) return null;
  if (target.source.kind === 'settings') return {content, settings: {...settings, [target.source.field]: value}};
  if (target.source.kind === 'content') return {content: {...content, [target.source.field]: value}, settings};
  const {sectionId, field} = target.source;
  const composition = content.composition ?? template.composition;
  if (!composition?.sections.some(s => s.id === sectionId && s.enabled)) return null;
  return {content: {...content, composition: {...composition, sections: composition.sections.map(s => s.id === sectionId ? {...s, data: {...s.data, [field]: value}} : s)}}, settings};
}

export interface VisualFrameIdentity {channel: string; siteId: string; templateId: string}
export function matchesVisualMessage(event: Pick<MessageEvent, 'origin' | 'source' | 'data'>, origin: string, source: MessageEventSource | null, identity: VisualFrameIdentity, type: string): boolean {
  const d = event.data;
  return !!source && event.origin === origin && event.source === source && !!d && d.type === type && d.channel === identity.channel && d.siteId === identity.siteId && d.templateId === identity.templateId;
}
