import { WebsiteContrastBoundary } from '../components/website/WebsiteContrastBoundary.js';
import { normalizeWebsiteColor, normalizeWebsitePalette, readableWebsiteColor, websiteActionText } from './websiteBrand.js';
import { SectionSiteRenderer } from '../components/website/SectionSiteRenderer.js';
import { websiteContactTarget } from '../components/website/SiteContactDetails.js';
import {websiteLayoutMode} from './websiteLayout.js';
import {websiteTypePreset} from '../config/websiteTypography.js';
/**
 * Shared Template & Site Rendering Utilities
 * Ensures Editor Preview, Template Preview, and Published Live Sites
 * all use the exact same core renderer.
 */

import React from 'react';
import { WebsiteTemplate, SiteContent, SiteSettings, TemplateItem } from '../types/index.js';
import { RestaurantTemplateView } from '../components/website/templates/RestaurantTemplateView.js';
import { ConstructionTemplateView } from '../components/website/templates/ConstructionTemplateView.js';
import { SalonTemplateView } from '../components/website/templates/SalonTemplateView.js';
import { RealEstateTemplateView } from '../components/website/templates/RealEstateTemplateView.js';
import { PortfolioTemplateView } from '../components/website/templates/PortfolioTemplateView.js';
import { TechAgencyTemplateView } from '../components/website/templates/TechAgencyTemplateView.js';
import { HotelTemplateView } from '../components/website/templates/HotelTemplateView.js';
import { EcommerceTemplateView } from '../components/website/templates/EcommerceTemplateView.js';
import { DataResellerTemplateView, type ResellerStoreSummary } from '../components/website/templates/DataResellerTemplateView.js';
import { DynamicTemplateRenderer } from '../components/website/DynamicTemplateRenderer.js';
import { PersonalityTemplateView, personalityPreset } from '../components/website/templates/PersonalityTemplateView';
import { WEBSITE_TEMPLATES, LEGACY_DEMO_BUSINESS_NAMES } from '../data/templates.js';
import { resolveDataResellerHeroImage } from './dataResellerArtwork.js';

/**
 * Merges user-edited content and settings with the base template definition
 */
export function mergeSiteWithTemplate(
  baseTemplate: WebsiteTemplate,
  content?: Partial<SiteContent>,
  settings?: Partial<SiteSettings>
): WebsiteTemplate {
  if (!content && !settings) return baseTemplate;

  const currentColors = normalizeWebsitePalette(baseTemplate.colorScheme || {
    primary: '#0f172a',
    secondary: baseTemplate.accentColor || '#00c365',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    mutedText: '#64748b',
    accent: baseTemplate.accentColor || '#00c365',
    border: '#e2e8f0',
  });

  const primaryColor = normalizeWebsiteColor(settings?.primaryColor, currentColors.primary);
  const accentColor = normalizeWebsiteColor(settings?.accentColor, currentColors.accent || baseTemplate.accentColor);
  const backgroundColor = normalizeWebsiteColor(settings?.backgroundColor, currentColors.background);

  return {
    ...baseTemplate,
    composition: websiteLayoutMode(baseTemplate.id,content)==='sections' ? content?.composition ?? baseTemplate.composition : undefined,
    siteContent: content,
    // Owner content without a stored name keeps the sample name it has always rendered (frozen in V5).
    demoBusinessName: content?.businessName ?? (content ? LEGACY_DEMO_BUSINESS_NAMES[baseTemplate.id] : undefined) ?? baseTemplate.demoBusinessName,
    demoHeroTagline: content?.tagline ?? baseTemplate.demoHeroTagline,
    demoSubtext: content?.aboutText ?? baseTemplate.demoSubtext,
    location: content?.location ?? baseTemplate.location,
    hoursOrContact: content ? content.whatsapp || content.phone || content.email || '' : baseTemplate.hoursOrContact,
    // A Data Business owner's empty hero keeps the legacy banner it has always rendered, never the new starter.
    heroImage: content && baseTemplate.layoutType === 'reseller' ? resolveDataResellerHeroImage(content.heroImage, true) : content?.heroImage || baseTemplate.heroImage,
    accentColor,
    colorScheme: {
      ...currentColors,
      primary: primaryColor,
      secondary: accentColor,
      accent: accentColor,
      background: backgroundColor,
      text: readableWebsiteColor(currentColors.text, [backgroundColor, currentColors.surface]),
      mutedText: readableWebsiteColor(currentColors.mutedText, [backgroundColor, currentColors.surface]),
    },
    items: content ? content.items ?? [] : baseTemplate.items,
    stats: content ? content.stats ?? [] : baseTemplate.stats,
    features: content ? content.features ?? [] : baseTemplate.features,
  };
}

/**
 * Finds the base template definition by templateId
 */
export function getTemplateById(templateId: string): WebsiteTemplate {
  return (
    WEBSITE_TEMPLATES.find((t) => t.id === templateId) ||
    WEBSITE_TEMPLATES[0]
  );
}

/**
 * Renders the matching layout component for any website template
 */
export function renderTemplateLayout(
  template: WebsiteTemplate,
  options?: {
    onCtaClick?: () => void;
    isMobileView?: boolean;
    managedCheckout?: React.ReactNode;
    managedAvailability?: 'loading' | 'available' | 'empty' | 'error';
    managedSummary?: ResellerStoreSummary;
  }
): React.ReactElement {
  const legacy = renderLegacyLayout(template, { ...options, onCtaClick: options?.onCtaClick || (template.siteContent && template.layoutType !== 'reseller' ? () => { window.location.assign(websiteContactTarget(template.siteContent)); } : undefined) });
  if (template.composition) return legacy;
  const variables = { '--website-primary':template.colorScheme?.primary, '--website-accent':template.accentColor, '--website-background':template.colorScheme?.background, '--website-text':template.colorScheme?.text, '--website-on-primary':websiteActionText(template.colorScheme?.primary || '#0f172a'), '--website-on-accent':websiteActionText(template.accentColor) } as React.CSSProperties;
  return <WebsiteContrastBoundary style={variables} typeface={websiteTypePreset(template)}>{legacy}</WebsiteContrastBoundary>;
}
function renderLegacyLayout(template: WebsiteTemplate, options?: { onCtaClick?: () => void; isMobileView?: boolean; managedCheckout?: React.ReactNode; managedAvailability?: 'loading' | 'available' | 'empty' | 'error'; managedSummary?: ResellerStoreSummary }): React.ReactElement {
  if (template.composition) return <SectionSiteRenderer template={template} onCtaClick={options?.onCtaClick} managedCheckout={options?.managedCheckout} />;
  const layout = (template.layoutType || template.category || '').toLowerCase();
  const { onCtaClick, isMobileView } = options || {};

  switch (layout) {
    case 'reseller':
      return <DataResellerTemplateView template={template} onCtaClick={onCtaClick} managedCheckout={options?.managedCheckout} managedAvailability={options?.managedAvailability} managedSummary={options?.managedSummary} />;
    case 'restaurant':
      return <RestaurantTemplateView template={template} onCtaClick={onCtaClick} />;
    case 'construction':
      return <ConstructionTemplateView template={template} onCtaClick={onCtaClick} />;
    case 'salon':
    case 'beauty':
      return <SalonTemplateView template={template} onCtaClick={onCtaClick} />;
    case 'realestate':
      return <RealEstateTemplateView template={template} onCtaClick={onCtaClick} />;
    case 'portfolio':
      return <PortfolioTemplateView template={template} onCtaClick={onCtaClick} />;
    case 'agency':
      return <TechAgencyTemplateView template={template} onCtaClick={onCtaClick} />;
    case 'hotel':
      return <HotelTemplateView template={template} onCtaClick={onCtaClick} />;
    case 'ecommerce':
    case 'retail':
      return <EcommerceTemplateView template={template} onCtaClick={onCtaClick} />;
    default: {
      const preset = personalityPreset(layout);
      if (preset) return <PersonalityTemplateView template={template} onCtaClick={onCtaClick} preset={preset} />;
      return (
        <DynamicTemplateRenderer
          template={template}
          onCtaClick={onCtaClick}
          isMobileView={isMobileView}
        />
      );
    }
  }
}
