import React,{useEffect,useRef} from 'react';
import type { WebsiteTemplate } from '../../types';
/** A real iframe viewport applies the same media queries as a public browser. */
export function WebsitePreviewFrame({template,siteId,viewportWidth}:{template:WebsiteTemplate;siteId:string;viewportWidth?:number}) {
  const frame=useRef<HTMLIFrameElement>(null),latest=useRef({template,siteId});latest.current={template,siteId};
  const send=()=>frame.current?.contentWindow?.postMessage({type:'MYSTERYHUB_PREVIEW_CONTENT',...latest.current},window.location.origin);
  useEffect(()=>{send();},[template,siteId]);
  useEffect(()=>{const receive=(event:MessageEvent)=>{if(event.origin===window.location.origin && event.source===frame.current?.contentWindow && event.data?.type==='MYSTERYHUB_TEMPLATE_LOADED')send();};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[]);
  return <iframe ref={frame} title="Draft website preview" style={viewportWidth?{width:viewportWidth}:undefined} src={`/?isolated_template_preview=${encodeURIComponent(template.id)}&owner_preview=1`} onLoad={send} className="w-full h-full min-h-[480px] border-0"/>;
}
