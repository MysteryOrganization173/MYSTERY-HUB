import React from 'react';
import type { WebsiteTemplate } from '../../types/index.js';
import { SECTION_REGISTRY, type SectionItem } from '../../config/websiteBuilder.js';
import { SafeImage, isSafeImageSource } from './SafeImage.js';
import { websiteSocialUrl } from './SiteContactDetails.js';
export function resolveSectionCtaTarget(url: string | undefined, fallback: string): string {
  if (!url) return fallback;
  if (isSafeImageSource(url)) return url;
  if (/^tel:\+?[\d ()-]{7,30}$/.test(url) || /^mailto:[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(url) || /^#[a-zA-Z0-9_-]+$/.test(url)) return url;
  return fallback;
}
function accentText(color: string): string {
  const hex = color.replace('#', '');
  const expanded = hex.length === 3 ? [...hex].map(c => c + c).join('') : hex;
  const channels = [0, 2, 4].map(start => parseInt(expanded.slice(start, start + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 > 0.179 ? '#000000' : '#ffffff';
}
export function SectionSiteRenderer({ template: t, onCtaClick }: { template: WebsiteTemplate; onCtaClick?: () => void }) {
  const c = t.siteContent;
  const palette = t.colorScheme;
  const buttonStyle = { backgroundColor: t.accentColor, color: accentText(t.accentColor) };
  const business = c?.businessName ?? t.demoBusinessName;
  const sections = [...(t.composition?.sections || [])].sort((a,b) => a.order - b.order).filter(s => s.enabled);
  const phone = (c?.whatsapp || c?.phone || '').replace(/[^\d+]/g, '');
  const contactUrl = phone ? `https://wa.me/${phone.replace(/^\+/, '').replace(/^0/, '233')}` : c?.email ? `mailto:${encodeURIComponent(c.email)}` : `#${sections.find(s => s.type === 'contact')?.id || sections[0]?.id || ''}`;
  const safeCta = (url?: string) => resolveSectionCtaTarget(url, contactUrl);
  return <div className="bg-white text-slate-900 font-sans" style={{ backgroundColor: palette?.background || '#ffffff', color: palette?.text || '#0f172a', borderTop: `3px solid ${palette?.primary || '#0f172a'}` }}>
    {sections.map(s => {
      const d = s.data;
      const centered = s.variant === 'centered';
      const heading = d.heading ?? (s.type === 'hero' ? c?.tagline ?? t.demoHeroTagline : SECTION_REGISTRY[s.type].label);
      const items: SectionItem[] = d.items ?? (['services', 'products', 'pricing'].includes(s.type) ? (c?.items || []).map(i => ({ title: i.name, text: i.desc, image: i.image, price: i.price })) : s.type === 'trust' ? (c?.stats || []).map(i => ({ title: i.value, text: i.label })) : []);
      if (s.type === 'header') return <header key={s.id} data-section={s.id} className={`p-5 border-b ${centered ? 'text-center' : 'flex flex-wrap justify-between gap-4'}`}><div className="flex items-center gap-3">{c?.logoUrl && <SafeImage src={c.logoUrl} alt={`${business} logo`} className="w-12 h-12 rounded-lg" style={{objectFit:'contain'}} />}<strong>{business}</strong></div><nav className="flex flex-wrap gap-3 justify-center">{sections.filter(x => !['header','hero','footer'].includes(x.type)).map(x => <a key={x.id} href={`#${x.id}`}>{x.data.heading || SECTION_REGISTRY[x.type].label}</a>)}</nav></header>;
      if (s.type === 'footer') return <footer key={s.id} data-section={s.id} className={`p-6 border-t ${centered ? 'text-center' : ''}`}>{d.body ?? business}<div className="flex flex-wrap gap-4 mt-3">{(['instagram','facebook','tiktok'] as const).map(network=>{const url=websiteSocialUrl(network,c?.social?.[network]);return url?<a key={network} href={url} target="_blank" rel="noopener noreferrer">{network}</a>:null;})}</div></footer>;
      return <section id={s.id} key={s.id} data-section={s.id} style={s.type === 'hero' ? { backgroundColor: palette?.surface || '#f1f5f9' } : undefined} className={`px-5 py-10 sm:px-10 ${centered ? 'text-center' : ''} ${s.type === 'hero' ? 'bg-slate-100' : ''}`}>
        <div className={`max-w-6xl mx-auto ${s.type === 'hero' && s.variant === 'split' ? 'grid md:grid-cols-2 gap-8 items-center' : ''}`}>
          <div><h2 className={`${s.type === 'hero' ? 'text-3xl sm:text-5xl' : 'text-2xl'} font-bold mb-4`}>{heading}</h2>
            {['hero', 'about'].includes(s.type) && <p className="max-w-2xl whitespace-pre-wrap">{d.body ?? c?.aboutText ?? t.demoSubtext}</p>}
            {!['hero', 'about', 'contact', 'location'].includes(s.type) && d.body && <p className="mb-5 whitespace-pre-wrap">{d.body}</p>}
            {s.type === 'contact' && <div className="space-y-3"><p>{d.body}</p>{c?.phone && <a className="block" href={`tel:${c.phone.replace(/[^\d+]/g,'')}`}>{c.phone}</a>}{c?.email && <a className="block underline" href={`mailto:${c.email}`}>{c.email}</a>}{c?.whatsapp && <p>WhatsApp {c.whatsapp}</p>}<a data-website-primary-cta="true" href={safeCta(d.ctaUrl)} style={buttonStyle} className="inline-block rounded-xl bg-slate-900 text-white px-5 py-3">{d.ctaLabel || 'Contact us'}</a></div>}
            {s.type === 'location' && <p className="whitespace-pre-wrap">{d.body ?? c?.location}</p>}
            {s.type === 'hero' && <a data-website-primary-cta="true" href={safeCta(d.ctaUrl || c?.ctaTarget)} style={buttonStyle} onClick={onCtaClick ? e => { e.preventDefault(); onCtaClick(); } : undefined} className="inline-block mt-6 rounded-xl bg-slate-900 text-white px-5 py-3">{d.ctaLabel ?? c?.ctaLabel ?? 'Contact us'}</a>}
            {!['hero','contact'].includes(s.type) && d.ctaLabel && <a data-website-primary-cta="true" href={safeCta(d.ctaUrl)} style={buttonStyle} className="inline-block mt-4 rounded-xl px-5 py-3">{d.ctaLabel}</a>}
          </div>
          {(d.image || (s.type === 'hero' && (c?.heroImage || t.heroImage))) && <SafeImage src={d.image || c?.heroImage || t.heroImage} alt={d.alt || business} className="w-full aspect-[16/10] rounded-2xl my-5" loading={s.type === 'hero' ? 'eager' : 'lazy'} fetchPriority={s.type === 'hero' ? 'high' : 'auto'} />}
          {items.length > 0 && <div className={`mt-6 grid gap-5 ${s.variant === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3' : ''}`}>{items.map((i, n) => s.type === 'faq' ? <details key={n} className="border rounded-xl p-5"><summary>{i.title}</summary><p>{i.text}</p></details> : <article key={n} className="rounded-xl border p-5">{i.image && <SafeImage src={i.image} alt={i.title} className="w-full aspect-[4/3] rounded-lg mb-3" />}<h3 className="font-bold">{i.title}</h3><p className="whitespace-pre-wrap">{i.text}</p>{i.price && <p className="mt-3 font-semibold">{i.price}</p>}</article>)}</div>}
        </div>
      </section>;
    })}
  </div>;
}
