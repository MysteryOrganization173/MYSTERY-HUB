import React, {useLayoutEffect, useRef} from 'react';
import {readableWebsiteColor} from '../../utils/websiteBrand.js';
import {websiteTypefaceCss, websiteTypefaceHref, type WebsiteTypePreset} from '../../config/websiteTypography.js';

/** Legacy layouts contain fixed artwork/card colors as well as owner theme colors.
 * Resolve text against its real solid surface instead of replacing the entire design.
 * Image/gradient artwork is deliberately excluded; its template owns that foreground.
 */
export function WebsiteContrastBoundary({children,style,typeface}:{children:React.ReactNode;style:React.CSSProperties;typeface?:WebsiteTypePreset|null}) {
  const root=useRef<HTMLDivElement>(null);
  useWebsiteTypeface(typeface);
  useLayoutEffect(()=>{
    const scope=root.current;if(!scope)return;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
    const context=canvas.getContext('2d');if(!context)return;
    const colors=new Map<string,number[]>();
    const rgba=(value:string)=>{
      if(colors.has(value))return colors.get(value)!;
      context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);
      const pixel=Array.from(context.getImageData(0,0,1,1).data);colors.set(value,pixel);return pixel;
    };
    const hex=(rgb:number[])=>'#'+rgb.slice(0,3).map(n=>Math.round(n).toString(16).padStart(2,'0')).join('');
    const repaired=new Map<HTMLElement,{value:string;priority:string}>();
    const restore=()=>{for(const [element,previous] of repaired)element.style.setProperty('color',previous.value,previous.priority);repaired.clear();};
    const audit=()=>{
      restore();const changes:Array<[HTMLElement,string]>=[];
      for(const element of scope.querySelectorAll<HTMLElement>('*')) {
        if(!Array.from(element.childNodes).some(node=>node.nodeType===Node.TEXT_NODE&&node.textContent?.trim())&&!element.matches('input,textarea,select'))continue;
        const foreground=getComputedStyle(element);if(foreground.display==='none'||foreground.visibility==='hidden')continue;
        const layers:number[][]=[];let ancestor:HTMLElement|null=element,unknown=false;
        while(ancestor){const surface=getComputedStyle(ancestor);if(surface.backgroundImage!=='none'){unknown=true;break;}const color=rgba(surface.backgroundColor);layers.push(color);if(color[3]===255)break;if(ancestor===scope)break;ancestor=ancestor.parentElement;}
        if(unknown)continue;
        let background=[255,255,255];for(const layer of layers.reverse()){const alpha=layer[3]/255;background=background.map((value,index)=>layer[index]*alpha+value*(1-alpha));}
        const original=hex(rgba(foreground.color));const readable=readableWebsiteColor(original,[hex(background)]);
        if(readable!==original)changes.push([element,readable]);
      }
      // Batch writes after computed-style reads; do not change saved brand/background data.
      for(const [element,color] of changes){repaired.set(element,{value:element.style.getPropertyValue('color'),priority:element.style.getPropertyPriority('color')});element.style.setProperty('color',color,'important');}
    };
    audit();let frame=0;const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(audit);};
    const observer=new MutationObserver(schedule);observer.observe(scope,{childList:true,subtree:true});window.addEventListener('resize',schedule);
    return()=>{observer.disconnect();window.removeEventListener('resize',schedule);cancelAnimationFrame(frame);restore();};
  },[children,style]);
  useLayoutEffect(()=>{
    // Designed menus link to fixed sections (e.g. a salon's "Our Stylists"). Hide a link while its section isn't on the page.
    const scope=root.current;if(!scope)return;
    const sync=()=>{for(const link of scope.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')){const id=link.getAttribute('href')!.slice(1);if(!id)continue;const missing=!scope.querySelector(`[id="${CSS.escape(id)}"]`);if(link.hidden!==missing)link.hidden=missing;}};
    sync();const observer=new MutationObserver(sync);observer.observe(scope,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[children]);
  return <div ref={root} className={`website-presentation${typeface?` website-type-${typeface}`:''}`} style={style}>{typeface&&<style>{websiteTypefaceCss(typeface)}</style>}{children}</div>;
}

/** Loads a design's display face once per document (the public page and the editor's draft frame). */
export function useWebsiteTypeface(preset?:WebsiteTypePreset|null) {
  useLayoutEffect(()=>{
    if(!preset||typeof document==='undefined'||document.head.querySelector(`link[data-website-typeface="${preset}"]`))return;
    const link=document.createElement('link');link.rel='stylesheet';link.href=websiteTypefaceHref(preset);link.dataset.websiteTypeface=preset;document.head.appendChild(link);
  },[preset]);
}
