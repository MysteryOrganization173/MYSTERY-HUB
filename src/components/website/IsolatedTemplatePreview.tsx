import React, { useEffect } from 'react';
import { WEBSITE_TEMPLATES } from '../../data/templates';
import { renderTemplateLayout } from '../../utils/templateRendererUtils';

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

  const bg = template.colorScheme?.background || '#ffffff';

  return (
    <div
      className="min-h-screen w-full text-slate-900 antialiased selection:bg-[#00c365] selection:text-black overflow-x-hidden"
      style={{ backgroundColor: bg }}
    >
      {renderTemplateLayout(template, { onCtaClick: handleCtaClick })}
    </div>
  );
};
