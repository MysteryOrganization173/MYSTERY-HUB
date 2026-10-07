import React, { useEffect, useState } from 'react';
import type { WebsiteTemplate } from '../../types';
import { WEBSITE_TEMPLATES } from '../../data/templates';
import { renderTemplateLayout } from '../../utils/templateRendererUtils';

interface IsolatedTemplatePreviewProps {
  templateId: string;
}

export const IsolatedTemplatePreview: React.FC<IsolatedTemplatePreviewProps> = ({ templateId }) => {
  const template =
    WEBSITE_TEMPLATES.find((t) => t.id === templateId) ||
    WEBSITE_TEMPLATES[0];

  const ownerPreview = new URLSearchParams(window.location.search).get('owner_preview') === '1';
  const [ownerTemplate, setOwnerTemplate] = useState<WebsiteTemplate | null>(null);
  useEffect(() => {
    setOwnerTemplate(null);
    const receiveContent = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (event.data?.type === 'MYSTERYHUB_PREVIEW_CONTENT' && event.data.template?.id === template.id && event.data.template?.siteContent) {
        setOwnerTemplate(event.data.template);
      }
    };
    const dismissPreview = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && window.parent !== window) {
        event.preventDefault();
        window.parent.postMessage({type:'MYSTERYHUB_PREVIEW_CLOSE'},window.location.origin);
      }
    };
    window.addEventListener('keydown', dismissPreview);
    window.addEventListener('message', receiveContent);
    // Notify parent window that preview iframe has mounted successfully
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: 'MYSTERYHUB_TEMPLATE_LOADED', templateId: template.id },
        window.location.origin
      );
    }
    return () => {window.removeEventListener('message', receiveContent);window.removeEventListener('keydown', dismissPreview);};
  }, [template.id]);

  const handleCtaClick = () => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: 'MYSTERYHUB_TEMPLATE_CTA', templateId: template.id },
        window.location.origin
      );
    }
  };

  const shownTemplate = ownerPreview ? ownerTemplate : template;
  if (!shownTemplate) return <p role="status" className="p-6">Loading your website preview…</p>;
  const bg = shownTemplate.colorScheme?.background || '#ffffff';

  return (
    <div
      className="min-h-screen w-full text-slate-900 antialiased selection:bg-[#00c365] selection:text-black overflow-x-hidden"
      style={{ backgroundColor: bg }}
    >
      {renderTemplateLayout(shownTemplate, { onCtaClick: handleCtaClick })}
    </div>
  );
};
