import React,{useEffect,useMemo,useRef} from 'react';
import type { WebsiteTemplate } from '../../types';
import type {WebsitePreviewProduct} from '../../utils/websitePreviewCatalog';
import {matchesVisualMessage, visualTargets} from '../../utils/websiteVisualEditing';
/** A real iframe viewport applies the same media queries as a public browser. */
export function WebsitePreviewFrame({template,siteId,viewportWidth,editMode=false,selectedTarget=null,onSelect,onOrder,focusRequest=0,reserveBottom=0,previewProducts}:{template:WebsiteTemplate;siteId:string;viewportWidth?:number;editMode?:boolean;selectedTarget?:string|null;onSelect?:(id:string|null,hint?:'settings'|'pricing')=>void;onOrder?:(ids:string[])=>void;focusRequest?:number;reserveBottom?:number;previewProducts?:WebsitePreviewProduct[]}) {
  const frame=useRef<HTMLIFrameElement>(null);
  const identity=useMemo(()=>({siteId,templateId:template.id,channel:crypto.randomUUID()}),[siteId,template.id]);
  const latest=useRef({template,editMode,selectedTarget,onSelect,onOrder,focusRequest,reserveBottom,previewProducts,identity});latest.current={template,editMode,selectedTarget,onSelect,onOrder,focusRequest,reserveBottom,previewProducts,identity};
  const send=()=>{const v=latest.current;frame.current?.contentWindow?.postMessage({type:'MYSTERYHUB_PREVIEW_CONTENT',...v.identity,template:v.template,editMode:v.editMode,selectedTarget:v.selectedTarget,focusRequest:v.focusRequest,reserveBottom:v.reserveBottom,previewProducts:v.previewProducts},window.location.origin);};
  useEffect(()=>{send();},[template,identity,editMode,selectedTarget,focusRequest,reserveBottom,previewProducts]);
  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      const v=latest.current;
      if(event.origin===window.location.origin && event.source===frame.current?.contentWindow && event.data?.type==='MYSTERYHUB_TEMPLATE_LOADED' && event.data.templateId===v.identity.templateId)send();
      if(!v.editMode)return;
      const source=frame.current?.contentWindow || null;
      const editable=(id:unknown)=>typeof id==='string' && visualTargets(v.template).some(t=>t.id===id && !t.id.startsWith('settings:'));
      if(matchesVisualMessage(event,window.location.origin,source,v.identity,'MYSTERYHUB_VISUAL_ORDER')){
        if(Array.isArray(event.data.targetIds) && event.data.targetIds.length<=200)v.onOrder?.(event.data.targetIds.filter(editable));
        return;
      }
      if(!matchesVisualMessage(event,window.location.origin,source,v.identity,'MYSTERYHUB_VISUAL_SELECT'))return;
      const id=event.data.targetId;
      if(id===null)v.onSelect?.(null,event.data.hint==='settings'||event.data.hint==='pricing'?event.data.hint:undefined);
      else if(editable(id))v.onSelect?.(id);
    };
    window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
  },[]);
  const src=`/?isolated_template_preview=${encodeURIComponent(template.id)}&owner_preview=1&editor_channel=${encodeURIComponent(identity.channel)}&editor_site=${encodeURIComponent(siteId)}`;
  return <iframe key={identity.channel} ref={frame} title="Draft website preview" style={viewportWidth?{width:viewportWidth}:undefined} src={src} onLoad={send} className="w-full h-full min-h-[320px] border-0"/>;
}
