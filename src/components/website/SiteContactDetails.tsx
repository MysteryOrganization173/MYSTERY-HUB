import React from 'react';
import type { SiteContent, WebsiteTemplate } from '../../types';
import { SafeImage } from './SafeImage';
import { resolveSectionCtaTarget } from './SectionSiteRenderer';
export function websiteContactTarget(content?: Partial<SiteContent>): string {
  const phone=(content?.whatsapp || '').replace(/\D/g,'').replace(/^0/,'233');
  const fallback=phone ? `https://wa.me/${phone}` : content?.email ? `mailto:${content.email}` : '#website-contact-details';
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
/** Existing dedicated layouts share these real saved business/contact fields. No forms/checkout. */
export function SiteContactDetails({template}:{template:WebsiteTemplate}) {
  const content=template.siteContent;
  if(!content)return null;
  return <section id="website-contact-details" aria-label="Business contact details" className="px-5 py-8 border-t" style={{backgroundColor:template.colorScheme?.background || '#fff',color:template.colorScheme?.text || '#0f172a'}}>
    <div className="max-w-6xl mx-auto space-y-3 break-words">
      {content.logoUrl && <SafeImage src={content.logoUrl} alt={`${content.businessName} logo`} className="w-20 h-20 rounded-lg" style={{objectFit:'contain'}} />}
      <strong className="block">{content.businessName}</strong>{content.location && <p>{content.location}</p>}
      <div className="flex flex-wrap gap-4 text-sm">{content.phone && <a href={`tel:${content.phone.replace(/[^\d+]/g,'')}`}>Call {content.phone}</a>}{content.email && <a href={`mailto:${content.email}`}>{content.email}</a>}{content.whatsapp && <a href={`https://wa.me/${content.whatsapp.replace(/\D/g,'').replace(/^0/,'233')}`}>WhatsApp {content.whatsapp}</a>}</div>
      <a href={websiteContactTarget(content)} className="inline-block px-4 py-3 rounded-xl text-white" style={{backgroundColor:template.accentColor,color:'#0f172a'}}>{content.ctaLabel || 'Contact us'}</a>
      <div className="flex flex-wrap gap-4 text-sm">{(['instagram','facebook','tiktok'] as const).map(network=>{const url=websiteSocialUrl(network,content.social?.[network]);return url?<a key={network} href={url} target="_blank" rel="noopener noreferrer" className="underline">{network}</a>:null;})}</div>
    </div>
  </section>;
}
