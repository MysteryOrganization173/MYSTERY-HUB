import {useVisualEditMarkers} from './editor/VisualEditMarkers';
import React from 'react';
import type { SiteContent, WebsiteTemplate } from '../../types';
import { resolveSectionCtaTarget } from './SectionSiteRenderer';
export function websiteContactTarget(content?: Partial<SiteContent>): string {
  const whatsapp=(content?.whatsapp || '').replace(/\D/g,'').replace(/^0/,'233');
  const phone=(content?.phone || '').replace(/[^\d+]/g,'');
  // Always a real destination: the owner's WhatsApp, phone or email, else the footer contact
  // block, which SiteFooterContact renders for every saved site (even one with no details yet).
  const fallback=whatsapp ? `https://wa.me/${whatsapp}` : phone ? `tel:${phone}` : content?.email ? `mailto:${content.email}` : '#website-contact-details';
  return resolveSectionCtaTarget(content?.ctaTarget,fallback);
}
export function websiteSocialUrl(network: 'instagram'|'facebook'|'tiktok', value?: string): string {
  if(!value) return '';
  const raw=value.trim();
  const domains={instagram:'instagram.com',facebook:'facebook.com',tiktok:'tiktok.com'};
  if(/^https?:\/\//.test(raw)) {
    try{const url=new URL(raw);if(!url.username && !url.password && [domains[network],`www.${domains[network]}`].includes(url.hostname))return url.href;}catch{}
    return '';
  }
  if(!/^@?[a-zA-Z0-9_.-]+$/.test(raw))return '';
  return `https://www.${domains[network]}/${network==='tiktok'?'@':''}${raw.replace(/^@/,'')}`;
}
type FooterContactPart='phone'|'whatsapp'|'email'|'social';
const whatsappHref=(value:string)=>`https://wa.me/${value.replace(/\D/g,'').replace(/^0/,'233')}`;
/**
 * The saved contact details, rendered inside each legacy template's own footer so the footer
 * stays the last thing on the page and keeps the template's colours. It inherits text colour
 * from the footer. Template galleries (no saved content) keep the template's sample line.
 * The id is the fallback target for main buttons when no WhatsApp number, phone or email is saved.
 */
export function SiteFooterContact({template,className='',only}:{template:WebsiteTemplate;className?:string;only?:FooterContactPart[]}) {
  const edit=useVisualEditMarkers();
  const content=template.siteContent;
  if(!content)return template.hoursOrContact && !only ? <p className={className}>{template.hoursOrContact}</p> : null;
  const show=(part:FooterContactPart)=>!only || only.includes(part);
  const phone=show('phone')?content.phone:'',whatsapp=show('whatsapp')?content.whatsapp:'',email=show('email')?content.email:'';
  const social=(['instagram','facebook','tiktok'] as const).map(network=>({network,url:websiteSocialUrl(network,content.social?.[network])})).filter(item=>item.url && show('social'));
  const link='underline-offset-4 hover:underline focus-visible:underline break-all';
  if(!phone && !whatsapp && !email && !social.length) {
    if(only)return null;
    // A new website with no details yet still gives the main button somewhere honest to land,
    // and in the editor a tap here opens the WhatsApp field so the owner can fill it in.
    return <p id="website-contact-details" {...edit("content:whatsapp")} className={`opacity-80 ${className}`}>Contact details coming soon.</p>;
  }
  return <div id={only?undefined:"website-contact-details"} aria-label="Contact details" className={`flex flex-col gap-1.5 ${className}`}>
    {phone && <a {...edit("content:phone")} className={link} href={`tel:${phone.replace(/[^\d+]/g,'')}`}>Call {phone}</a>}
    {whatsapp && <a {...edit("content:whatsapp")} className={link} data-website-event="whatsapp_click" href={whatsappHref(whatsapp)}>WhatsApp {whatsapp}</a>}
    {email && <a {...edit("content:email")} className={link} href={`mailto:${email}`}>{email}</a>}
    {social.length>0 && <p className="flex flex-wrap gap-x-4 gap-y-1 pt-1">{social.map(({network,url})=><a key={network} href={url} target="_blank" rel="noopener noreferrer" className={`${link} capitalize`}>{network==='tiktok'?'TikTok':network}</a>)}</p>}
  </div>;
}
