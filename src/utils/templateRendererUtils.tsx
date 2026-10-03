import { SectionSiteRenderer } from '../components/website/SectionSiteRenderer.js';
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
import { DataResellerTemplateView } from '../components/website/templates/DataResellerTemplateView.js';
import { GenericTemplateView } from '../components/website/templates/GenericTemplateView.js';
import { DynamicTemplateRenderer } from '../components/website/DynamicTemplateRenderer.js';
import { WEBSITE_TEMPLATES } from '../data/templates.js';

/**
 * Merges user-edited content and settings with the base template definition
 */
export function mergeSiteWithTemplate(
  baseTemplate: WebsiteTemplate,
  content?: Partial<SiteContent>,
  settings?: Partial<SiteSettings>
): WebsiteTemplate {
  if (!content && !settings) return baseTemplate;

  const currentColors = baseTemplate.colorScheme || {
    primary: '#0f172a',
    secondary: baseTemplate.accentColor || '#00c365',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    mutedText: '#64748b',
    accent: baseTemplate.accentColor || '#00c365',
    border: '#e2e8f0',
  };

  const primaryColor = settings?.primaryColor || currentColors.primary;
  const accentColor = settings?.accentColor || currentColors.accent || baseTemplate.accentColor;
  const backgroundColor = settings?.backgroundColor || currentColors.background;

  return {
    ...baseTemplate,
    composition: content?.composition ?? baseTemplate.composition,
    siteContent: content,
    demoBusinessName: content?.businessName || baseTemplate.demoBusinessName,
    demoHeroTagline: content?.tagline || baseTemplate.demoHeroTagline,
    demoSubtext: content?.aboutText || baseTemplate.demoSubtext,
    location: content?.location || baseTemplate.location,
    hoursOrContact: content?.whatsapp || content?.phone || content?.email || baseTemplate.hoursOrContact,
    heroImage: content?.heroImage || baseTemplate.heroImage,
    accentColor,
    colorScheme: {
      ...currentColors,
      primary: primaryColor,
      secondary: accentColor,
      accent: accentColor,
      background: backgroundColor,
    },
    items: content?.items && content.items.length > 0 ? content.items : baseTemplate.items,
    stats: content?.stats && content.stats.length > 0 ? content.stats : baseTemplate.stats,
    features: content?.features && content.features.length > 0 ? content.features : baseTemplate.features,
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
  }
): React.ReactElement {
  if (template.composition) return <SectionSiteRenderer template={template} onCtaClick={options?.onCtaClick} />;
  const layout = (template.layoutType || template.category || '').toLowerCase();
  const { onCtaClick, isMobileView } = options || {};

  switch (layout) {
    case 'reseller':
      return <DataResellerTemplateView template={template} onCtaClick={onCtaClick} />;
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
    default:
      return (
        <DynamicTemplateRenderer
          template={template}
          onCtaClick={onCtaClick}
          isMobileView={isMobileView}
        />
      );
  }
}
