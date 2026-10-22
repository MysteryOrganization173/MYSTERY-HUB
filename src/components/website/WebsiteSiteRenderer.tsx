import React from 'react';
import type { WebsiteTemplate } from '../../types';
import { renderTemplateLayout } from '../../utils/templateRendererUtils';
import { ManagedDataStorefront } from './ManagedDataStorefront';
import './websitePresentation.css';
import type {WebsitePreviewProduct} from '../../utils/websitePreviewCatalog';
/** One presentation entry for owner drafts and public websites; commerce stays in its adapter. */
export function WebsiteSiteRenderer({template,siteId,preview=false,previewProducts}:{template:WebsiteTemplate;siteId?:string;preview?:boolean;previewProducts?:WebsitePreviewProduct[]}) {
  return <div onClickCapture={preview?event=>{const link=(event.target as HTMLElement).closest('a');if(link && !link.getAttribute('href')?.startsWith('#')){event.preventDefault();event.stopPropagation();}}:undefined} onSubmitCapture={preview?event=>{event.preventDefault();event.stopPropagation();}:undefined}>
    {template.id==='tmpl-data-reseller' && siteId ? <ManagedDataStorefront siteId={siteId} template={template} preview={preview} previewProducts={previewProducts}/> : renderTemplateLayout(template,{onCtaClick:preview?()=>{}:undefined})}
  </div>;
}
