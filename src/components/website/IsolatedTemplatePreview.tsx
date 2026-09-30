import React, { useEffect } from 'react';
import { WEBSITE_TEMPLATES } from '../../data/templates';
import { RestaurantTemplateView } from './templates/RestaurantTemplateView';
import { ConstructionTemplateView } from './templates/ConstructionTemplateView';
import { SalonTemplateView } from './templates/SalonTemplateView';
import { RealEstateTemplateView } from './templates/RealEstateTemplateView';
import { PortfolioTemplateView } from './templates/PortfolioTemplateView';
import { TechAgencyTemplateView } from './templates/TechAgencyTemplateView';
import { HotelTemplateView } from './templates/HotelTemplateView';
import { EcommerceTemplateView } from './templates/EcommerceTemplateView';
import { DynamicTemplateRenderer } from './DynamicTemplateRenderer';

interface IsolatedTemplatePreviewProps {
  templateId: string;
}

export const IsolatedTemplatePreview: React.FC<IsolatedTemplatePreviewProps> = ({ templateId }) => {
  const template =
    WEBSITE_TEMPLATES.find((t) => t.id === templateId) ||
    WEBSITE_TEMPLATES[0];

  useEffect(() => {
    // Notify parent window that preview iframe has mounted successfully
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: 'MYSTERYHUB_TEMPLATE_LOADED', templateId: template.id },
        '*'
      );
    }
  }, [template.id]);

  const handleCtaClick = () => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: 'MYSTERYHUB_TEMPLATE_CTA', templateId: template.id },
        '*'
      );
    }
  };

  const layout = (template.layoutType || template.category || '').toLowerCase();

  const renderTemplateView = () => {
    switch (layout) {
      case 'restaurant':
        return <RestaurantTemplateView template={template} onCtaClick={handleCtaClick} />;
      case 'construction':
        return <ConstructionTemplateView template={template} onCtaClick={handleCtaClick} />;
      case 'salon':
      case 'beauty':
        return <SalonTemplateView template={template} onCtaClick={handleCtaClick} />;
      case 'realestate':
        return <RealEstateTemplateView template={template} onCtaClick={handleCtaClick} />;
      case 'portfolio':
        return <PortfolioTemplateView template={template} onCtaClick={handleCtaClick} />;
      case 'agency':
        return <TechAgencyTemplateView template={template} onCtaClick={handleCtaClick} />;
      case 'hotel':
        return <HotelTemplateView template={template} onCtaClick={handleCtaClick} />;
      case 'ecommerce':
      case 'retail':
        return <EcommerceTemplateView template={template} onCtaClick={handleCtaClick} />;
      default:
        return (
          <DynamicTemplateRenderer
            template={template}
            onCtaClick={handleCtaClick}
            isMobileView={false} // Will dynamically respond to iframe viewport width via CSS media queries
          />
        );
    }
  };

  const bg = template.colorScheme?.background || '#ffffff';

  return (
    <div
      className="min-h-screen w-full text-slate-900 antialiased selection:bg-[#00c365] selection:text-black overflow-x-hidden"
      style={{ backgroundColor: bg }}
    >
      {renderTemplateView()}
    </div>
  );
};
