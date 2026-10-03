/** Shared, serializable builder vocabulary. No executable customer/AI content. */
export type WebsitePlan = 'FREE' | 'PLUS' | 'PRO';
export type WebsiteCapability = 'premiumTemplates' | 'advancedSections' | 'removeMysteryHubBranding' | 'customDomain' | 'aiOnboarding' | 'aiEditing' | 'advancedCommerce' | 'customCodeOrAdvancedCustomization' | 'prioritySupport';
const upcoming = { premiumTemplates: true, advancedSections: true, removeMysteryHubBranding: true, customDomain: true, aiOnboarding: true, aiEditing: true, advancedCommerce: false, customCodeOrAdvancedCustomization: false, prioritySupport: false };
export const WEBSITE_PLANS = {
  FREE: { label: 'Free', monthlyMinor: 0, available: true, maxSites: 1, planned: { ...upcoming, premiumTemplates: false, advancedSections: false, removeMysteryHubBranding: false, customDomain: false, aiEditing: false } },
  PLUS: { label: 'Plus', monthlyMinor: 4900, available: false, maxSites: 3, planned: upcoming },
  PRO: { label: 'Pro', monthlyMinor: 19900, available: false, maxSites: 10, planned: { ...upcoming, advancedCommerce: true, customCodeOrAdvancedCustomization: true, prioritySupport: true } },
} as const;
/** No subscription source is live. Only a future trusted server entitlement resolver may change this. */
export function resolveWebsitePlan(_userId?: string): WebsitePlan { return 'FREE'; }
export function hasWebsiteCapability(_plan: WebsitePlan, _capability: WebsiteCapability): boolean { return false; }
export function showWebsiteAttribution(plan: WebsitePlan): boolean { return !hasWebsiteCapability(plan, 'removeMysteryHubBranding'); }
export const ULTRA_SERVICE = { startingMinor: 149900, subscription: false, label: 'Ultra' } as const;
export const RESELLER_INTEGRATIONS = [
  { id: 'managed', label: 'Mystery Hub Managed Fulfilment', status: 'upcoming' },
  { id: 'own-provider', label: 'Connect My Own Provider', status: 'upcoming' },
] as const;

export const SECTION_REGISTRY = {
  header: { label: 'Header', required: true, variants: ['simple', 'centered'] },
  hero: { label: 'Hero', required: false, variants: ['simple', 'split'] },
  trust: { label: 'Trust', required: false, variants: ['grid', 'list'] },
  services: { label: 'Services', required: false, variants: ['grid', 'list'] },
  products: { label: 'Products', required: false, variants: ['grid', 'list'] },
  gallery: { label: 'Gallery', required: false, variants: ['grid', 'list'] },
  about: { label: 'About', required: false, variants: ['simple', 'centered'] },
  testimonials: { label: 'Testimonials', required: false, variants: ['grid', 'list'] },
  pricing: { label: 'Pricing', required: false, variants: ['grid', 'list'] },
  faq: { label: 'FAQ', required: false, variants: ['list'] },
  contact: { label: 'Contact', required: false, variants: ['simple', 'centered'] },
  location: { label: 'Location', required: false, variants: ['simple', 'centered'] },
  footer: { label: 'Footer', required: true, variants: ['simple', 'centered'] },
} as const;
export type WebsiteSectionType = keyof typeof SECTION_REGISTRY;
export interface SectionItem { title: string; text?: string; image?: string; price?: string; }
export interface SectionData { heading?: string; body?: string; image?: string; alt?: string; ctaLabel?: string; ctaUrl?: string; items?: SectionItem[]; }
export interface WebsiteSection { id: string; type: WebsiteSectionType; enabled: boolean; variant: string; order: number; data: SectionData; }
export interface WebsiteComposition { version: 1; sections: WebsiteSection[]; }
export function createWebsiteComposition(types: WebsiteSectionType[] = ['header', 'hero', 'contact', 'footer']): WebsiteComposition {
  return { version: 1, sections: types.map((type, order) => ({ id: `${type}-${order}`, type, enabled: true, variant: SECTION_REGISTRY[type].variants[0], order, data: {} })) };
}
/** All currently registered sections/variants are basic and usable on existing Free sites. */
export function sectionEligible(type: WebsiteSectionType, variant: string, _plan: WebsitePlan): boolean {
  return (SECTION_REGISTRY[type].variants as readonly string[]).includes(variant);
}
export interface StructuredWebsiteBrief {
  identity: { businessName: string; businessType: string; location?: string; description: string };
  brand: { primaryColor: string; accentColor: string; designSystemId: string };
  templateId: string;
  composition: WebsiteComposition;
  images: { url: string; alt: string; purpose: 'hero' | 'gallery' | 'product' }[];
  contact: { phone?: string; whatsapp?: string; email?: string; ctaLabel?: string; ctaUrl?: string };
}
export interface UltraEnquiryInput {
  businessName: string; businessType: string; contactName: string; phone: string; email?: string;
  existingDomain: 'yes' | 'no'; estimatedPages: number; featuresRequirements: string;
  preferredStyle: string; referenceWebsite?: string; projectNotes: string;
}
