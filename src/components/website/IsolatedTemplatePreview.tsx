import { WebsiteSiteRenderer } from './WebsiteSiteRenderer';
import {websitePreviewCatalog,type WebsitePreviewProduct} from '../../utils/websitePreviewCatalog';
import React, { useEffect, useState } from 'react';
import type { WebsiteTemplate } from '../../types';
import { WEBSITE_TEMPLATES } from '../../data/templates';
import { renderTemplateLayout } from '../../utils/templateRendererUtils';
import {matchesVisualMessage, visualTargets} from '../../utils/websiteVisualEditing';
import {VisualSelectionSurface} from './editor/VisualSelectionSurface';

interface IsolatedTemplatePreviewProps {
  templateId: string;
}

export const IsolatedTemplatePreview: React.FC<IsolatedTemplatePreviewProps> = ({ templateId }) => {
  const template =
    WEBSITE_TEMPLATES.find((t) => t.id === templateId) ||
    WEBSITE_TEMPLATES[0];

  const ownerPreview = new URLSearchParams(window.location.search).get('owner_preview') === '1';
  const [ownerTemplate, setOwnerTemplate] = useState<WebsiteTemplate | null>(null);
  const [previewProducts,setPreviewProducts]=useState<WebsitePreviewProduct[]>([]);
  const [siteId,setSiteId] = useState<string | undefined>();
  const [editing,setEditing] = useState(false), [selected,setSelected] = useState<string|null>(null), [focusRequest,setFocusRequest] = useState(0), [reserveBottom,setReserveBottom] = useState(0);
  const params = new URLSearchParams(window.location.search);
  const channel = params.get('editor_channel') || '', expectedSite = params.get('editor_site') || '';
  // Inside a preview frame, reaching the top or bottom of the design must not scroll the page that hosts it.
  useEffect(() => {
    if (window.parent === window) return;
    document.documentElement.classList.add('mh-isolated-preview');
    return () => document.documentElement.classList.remove('mh-isolated-preview');
  }, []);
  useEffect(() => {
    setOwnerTemplate(null);
    const receiveContent = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const validIdentity = !channel || matchesVisualMessage(event,window.location.origin,window.parent,{channel,siteId:expectedSite,templateId:template.id},'MYSTERYHUB_PREVIEW_CONTENT');
      if (ownerPreview && validIdentity && event.data?.type === 'MYSTERYHUB_PREVIEW_CONTENT' && event.data.template?.id === template.id && event.data.template?.siteContent) {
        setOwnerTemplate(event.data.template);
        setPreviewProducts(websitePreviewCatalog(event.data.previewProducts));
        setSiteId(typeof event.data.siteId==='string'?event.data.siteId:undefined);
        const edit = !!channel && window.parent !== window && event.data.editMode === true;
        const targets = visualTargets(event.data.template);
        setEditing(edit);
        setSelected(edit && targets.some(t=>t.id===event.data.selectedTarget) ? event.data.selectedTarget : null);
        setFocusRequest(Number.isSafeInteger(event.data.focusRequest) ? event.data.focusRequest : 0);
        const reserve = Number(event.data.reserveBottom);
        setReserveBottom(Number.isFinite(reserve) ? Math.min(0.7, Math.max(0, reserve)) : 0);
      }
    };
    const dismissPreview = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !channel && window.parent !== window) {
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
  }, [template.id,ownerPreview,channel,expectedSite]);

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
      {ownerPreview ? editing ? <VisualSelectionSurface targets={visualTargets(shownTemplate)} selected={selected} focusRequest={focusRequest} reserveBottom={reserveBottom} onSelect={(targetId,hint)=>window.parent.postMessage({type:'MYSTERYHUB_VISUAL_SELECT',channel,siteId,templateId:template.id,targetId,...(hint?{hint}:{})},window.location.origin)} onOrder={targetIds=>window.parent.postMessage({type:'MYSTERYHUB_VISUAL_ORDER',channel,siteId,templateId:template.id,targetIds},window.location.origin)}><WebsiteSiteRenderer template={shownTemplate} siteId={siteId} preview previewProducts={previewProducts}/></VisualSelectionSurface> : <WebsiteSiteRenderer template={shownTemplate} siteId={siteId} preview previewProducts={previewProducts}/> : renderTemplateLayout(shownTemplate, { onCtaClick: handleCtaClick })}
    </div>
  );
};
