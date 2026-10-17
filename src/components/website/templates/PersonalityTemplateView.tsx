import { ExampleTag } from '../ExampleTag';
import { SiteFooterContact } from '../SiteContactDetails';
import { useVisualEditMarkers, useTemplateCopy } from '../editor/VisualEditMarkers';
import { websiteActionText, readableWebsiteColor } from '../../../utils/websiteBrand';
import { getCloudinarySrcSet } from '../../../utils/cloudinary';
import { SafeImage } from '../SafeImage.js';
import React from 'react';
import type { WebsiteTemplate, TemplateItem } from '../../../types';
import { ArrowRight, MapPin, Check } from 'lucide-react';

/**
 * One shared structure, four voices. Education reads as a campus prospectus, church as a warm
 * welcome with a weekly rhythm, fashion as a lookbook and services as a calm practice page.
 * Every visible word is the owner's content, a copy slot, or a short fixed label of the design.
 */
export type PersonalityPreset = 'campus' | 'sanctuary' | 'atelier' | 'counsel';
const PRESET_BY_LAYOUT: Record<string, PersonalityPreset> = { education: 'campus', church: 'sanctuary', fashion: 'atelier', services: 'counsel' };
export const personalityPreset = (layout: string): PersonalityPreset | null => PRESET_BY_LAYOUT[layout] || null;

const LABELS: Record<PersonalityPreset, { nav: string; visit: string; visitIntro: string }> = {
  campus: { nav: 'Enquire', visit: 'Admissions & enquiries', visitIntro: 'Ask about courses, start dates and fees.' },
  sanctuary: { nav: 'Plan a visit', visit: 'Visit us', visitIntro: 'Everyone is welcome. Come as you are.' },
  atelier: { nav: 'Book a fitting', visit: 'Visit the atelier', visitIntro: 'Fittings and orders by appointment.' },
  counsel: { nav: 'Book a consultation', visit: 'Talk to us', visitIntro: 'Tell us what you need and we will reply.' },
};

export const storeMonogram = (name: string) => name.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).slice(0, 2).map(w => w.replace(/[^A-Za-z0-9]/g, '')[0] || '').join('').toUpperCase() || '·';

const CSS = `
.pv{--pv-wrap:1120px;-webkit-tap-highlight-color:transparent}
.pv-wrap{max-width:var(--pv-wrap);margin:0 auto;padding:0 20px}
@media (min-width:768px){.pv-wrap{padding:0 32px}}
.pv-nav{position:sticky;top:0;z-index:30;border-bottom:1px solid;backdrop-filter:blur(10px)}
.pv-nav-in{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:64px}
.pv-brand{display:flex;align-items:center;gap:10px;min-width:0}
.pv-mark{width:38px;height:38px;flex:none;display:grid;place-items:center;overflow:hidden;font-weight:800;font-size:14px;letter-spacing:.02em}
.pv-name{display:block;font-weight:800;font-size:15px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:52vw}
.pv-sub{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin-top:2px;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:52vw}
.pv-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 18px;font-weight:700;font-size:14px;cursor:pointer;transition:transform .15s ease,filter .15s ease;text-decoration:none;white-space:nowrap}
.pv-btn:hover{filter:brightness(1.06)}.pv-btn:active{transform:scale(.97)}
.pv-btn-ghost{background:transparent;border:1px solid}
.pv-nav .pv-btn{min-height:40px;padding:0 14px;font-size:13px}
.pv-eyebrow{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.pv-title{font-size:clamp(2rem,7.2vw,3.5rem);line-height:1.06;font-weight:800;margin-top:14px;text-wrap:balance}
.pv-lede{font-size:16px;line-height:1.6;margin-top:14px;max-width:40rem}
.pv-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
.pv-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:28px}
.pv-stat strong{display:block;font-size:clamp(1.25rem,5vw,1.75rem);font-weight:800;line-height:1}
.pv-stat span{display:block;font-size:11px;line-height:1.35;margin-top:6px;letter-spacing:.04em;text-transform:uppercase;opacity:.8}
.pv-art{overflow:hidden;position:relative}
.pv-art img{width:100%;height:100%;object-fit:cover;display:block}
.pv-section{padding:56px 0}
@media (min-width:768px){.pv-section{padding:80px 0}}
.pv-h2{font-size:clamp(1.6rem,5vw,2.4rem);line-height:1.12;font-weight:800;margin-top:8px;text-wrap:balance}
.pv-items{display:grid;gap:16px;margin-top:28px}
.pv-item{position:relative;display:flex;flex-direction:column;min-width:0}
.pv-item h3{font-size:18px;line-height:1.3;font-weight:700}
.pv-item p{font-size:14px;line-height:1.6}
.pv-chips{display:flex;flex-wrap:wrap;gap:6px}
.pv-chip{font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px}
.pv-visit{display:grid;gap:20px;padding:28px;border:1px solid}
@media (min-width:768px){.pv-visit{grid-template-columns:1.2fr 1fr;align-items:center;padding:40px}}
.pv-foot{padding:28px 0;font-size:13px}
.pv-foot-in{display:flex;flex-wrap:wrap;gap:8px 24px;justify-content:space-between;align-items:center}

/* Campus: prospectus. Framed photo beside the promise, course cards with a coloured spine. */
.pv-campus .pv-mark{border-radius:10px}.pv-campus .pv-btn{border-radius:12px}
.pv-campus .pv-hero{padding:36px 0 48px}
.pv-campus .pv-hero-grid{display:grid;gap:28px}
@media (min-width:900px){.pv-campus .pv-hero-grid{grid-template-columns:1.1fr .9fr;align-items:center;gap:56px}.pv-campus .pv-hero{padding:72px 0}}
.pv-campus .pv-art{border-radius:20px;aspect-ratio:4/3}
.pv-campus .pv-stat{padding:14px;border-radius:14px;border:1px solid}
.pv-campus .pv-items{grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))}
.pv-campus .pv-item{border:1px solid;border-radius:18px;padding:22px 22px 22px 26px;overflow:hidden}
.pv-campus .pv-item::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--pv-accent)}
.pv-campus .pv-visit{border-radius:22px}

/* Sanctuary: a warm welcome over the photo, then the week as a calm schedule. */
.pv-sanctuary .pv-mark{border-radius:50%}.pv-sanctuary .pv-btn{border-radius:999px}
.pv-sanctuary .pv-hero{position:relative;color:#fff;text-align:center;overflow:hidden}
.pv-sanctuary .pv-hero .pv-art{position:absolute;inset:0}
.pv-sanctuary .pv-hero-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,12,20,.55),rgba(10,12,20,.78))}
.pv-sanctuary .pv-hero-in{position:relative;padding:72px 0 64px;display:flex;flex-direction:column;align-items:center}
@media (min-width:900px){.pv-sanctuary .pv-hero-in{padding:120px 0 104px}}
.pv-sanctuary .pv-lede{margin-left:auto;margin-right:auto;color:rgba(255,255,255,.88)}
.pv-sanctuary .pv-actions{justify-content:center}
.pv-sanctuary .pv-stats{max-width:560px;width:100%;border-top:1px solid rgba(255,255,255,.25);padding-top:20px}
.pv-sanctuary .pv-items{gap:0;border-top:1px solid var(--pv-border)}
.pv-sanctuary .pv-item{display:grid;grid-template-columns:1fr;gap:6px 24px;padding:22px 0;border-bottom:1px solid var(--pv-border)}
@media (min-width:768px){.pv-sanctuary .pv-item{grid-template-columns:200px 1fr auto;align-items:start}}
.pv-sanctuary .pv-when{font-weight:800;font-size:15px}
.pv-sanctuary .pv-visit{border-radius:28px;text-align:left}

/* Atelier: a lookbook. Quiet capitals, tall photographs, prices set like a label. */
.pv-atelier .pv-mark{border-radius:0;font-size:15px}.pv-atelier .pv-btn{border-radius:0;letter-spacing:.12em;text-transform:uppercase;font-size:12px}
.pv-atelier .pv-name{letter-spacing:.06em;text-transform:uppercase;font-size:14px}
.pv-atelier .pv-hero{padding:40px 0 0}
.pv-atelier .pv-title{font-weight:700;font-size:clamp(2.4rem,9vw,4.6rem);line-height:1}
.pv-atelier .pv-art{margin-top:32px;aspect-ratio:4/5}
@media (min-width:768px){.pv-atelier .pv-art{aspect-ratio:21/9}}
.pv-atelier .pv-stats{border-top:1px solid var(--pv-border);padding-top:18px}
.pv-atelier .pv-items{grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:32px 20px}
.pv-atelier .pv-look{aspect-ratio:4/5;overflow:hidden;background:var(--pv-surface)}
.pv-atelier .pv-look img{width:100%;height:100%;object-fit:cover;transition:transform .5s ease}
@media (hover:hover){.pv-atelier .pv-item:hover .pv-look img{transform:scale(1.03)}}
.pv-atelier .pv-item h3{font-size:22px;font-weight:700;margin-top:14px}
.pv-atelier .pv-visit{border-radius:0}

/* Counsel: a calm practice page. Numbered practice areas separated by fine rules. */
.pv-counsel .pv-mark{border-radius:6px}.pv-counsel .pv-btn{border-radius:8px}
.pv-counsel .pv-hero{padding:40px 0 48px;border-bottom:1px solid var(--pv-border)}
.pv-counsel .pv-hero-grid{display:grid;gap:28px}
@media (min-width:900px){.pv-counsel .pv-hero-grid{grid-template-columns:1.3fr .7fr;gap:56px;align-items:end}.pv-counsel .pv-hero{padding:80px 0 64px}}
.pv-counsel .pv-rule{width:56px;height:3px;background:var(--pv-accent);margin-bottom:18px}
.pv-counsel .pv-art{border-radius:12px;aspect-ratio:16/10}
.pv-counsel .pv-stats{grid-template-columns:1fr;gap:0;margin-top:0}
.pv-counsel .pv-stat{display:flex;align-items:baseline;gap:14px;padding:14px 0;border-bottom:1px solid var(--pv-border)}
.pv-counsel .pv-stat span{margin-top:0}
.pv-counsel .pv-items{gap:0;border-top:1px solid var(--pv-border)}
.pv-counsel .pv-item{display:grid;grid-template-columns:44px 1fr;gap:4px 16px;padding:26px 0;border-bottom:1px solid var(--pv-border)}
@media (min-width:768px){.pv-counsel .pv-item{grid-template-columns:72px 1fr auto;align-items:start}}
.pv-counsel .pv-num{font-size:24px;font-weight:800;line-height:1;opacity:.9}
.pv-counsel .pv-visit{border-radius:16px}
@media (prefers-reduced-motion:reduce){.pv-btn,.pv-atelier .pv-look img{transition:none}}
`;

export function PersonalityTemplateView({ template, onCtaClick, preset }: { template: WebsiteTemplate; onCtaClick?: () => void; preset: PersonalityPreset }) {
  const edit = useVisualEditMarkers();
  const copy = useTemplateCopy(template);
  const p = template.colorScheme || { primary: '#0f172a', secondary: template.accentColor || '#00c365', background: '#ffffff', surface: '#f8fafc', text: '#0f172a', mutedText: '#64748b', accent: template.accentColor || '#00c365', border: '#e2e8f0' };
  const accentText = readableWebsiteColor(p.secondary, [p.background, p.surface]);
  const primaryText = readableWebsiteColor(p.primary, [p.background, p.surface]);
  const items = template.items || [];
  const stats = (template.stats || []).filter(s => s.value && s.label).slice(0, 3);
  const label = LABELS[preset];
  const logo = template.siteContent?.logoUrl;
  const hero = template.heroImage;
  const heroSrcSet = hero ? getCloudinarySrcSet(hero, [480, 768, 1024, 1440], { format: 'auto', quality: 'auto' }) : undefined;
  const solid = { backgroundColor: p.secondary, color: websiteActionText(p.secondary) };
  const deep = { backgroundColor: p.primary, color: websiteActionText(p.primary) };
  const onHero = preset === 'sanctuary';

  const heroArt = hero ? <div {...edit('content:heroImage')} className="pv-art" style={{ backgroundColor: p.surface }}>
    <SafeImage src={hero} srcSet={heroSrcSet} sizes={preset === 'sanctuary' || preset === 'atelier' ? '100vw' : '(min-width: 900px) 45vw, 100vw'} alt={onHero ? '' : template.demoBusinessName} className="w-full h-full" loading="eager" fetchPriority="high" />
  </div> : null;

  const heroText = <>
    <span className="pv-eyebrow" style={{ color: onHero ? '#fff' : accentText }} {...copy.edit('eyebrow')}>{copy.text('eyebrow')}</span>
    <h1 className="pv-title site-display" style={{ color: onHero ? '#fff' : p.text }} {...edit('content:tagline')}>{template.demoHeroTagline}</h1>
    <p className="pv-lede" style={{ color: onHero ? undefined : p.mutedText }} {...edit('content:aboutText')}>{template.demoSubtext}</p>
    <div className="pv-actions">
      <a href="#catalog" className="pv-btn" style={preset === 'atelier' ? deep : solid}><span {...copy.edit('primary')}>{copy.text('primary')}</span><ArrowRight className="w-4 h-4" aria-hidden="true" /></a>
    </div>
  </>;

  const statRow = stats.length > 0 && <div className="pv-stats">{stats.map((s, i) =>
    <div key={i} className="pv-stat" style={preset === 'campus' ? { borderColor: p.border, backgroundColor: p.surface } : undefined}>
      <strong className="site-display" style={{ color: onHero ? '#fff' : primaryText }}>{s.value}</strong><span style={{ color: onHero ? 'rgba(255,255,255,.85)' : p.mutedText }}>{s.label}</span>
    </div>)}</div>;

  const itemAction = (item: TemplateItem) => <button type="button" onClick={onCtaClick} className={`pv-btn ${preset === 'campus' ? '' : 'pv-btn-ghost'}`}
    style={preset === 'campus' ? deep : { borderColor: `${p.text}40`, color: p.text }} aria-label={`${copy.text('itemButton')}: ${item.name}`}>
    <span>{copy.text('itemButton')}</span>
  </button>;
  const chips = (specs?: string[]) => specs && specs.length > 0 ? <div className="pv-chips">{specs.map((s, i) => <span key={i} className="pv-chip" style={{ backgroundColor: `${p.primary}12`, color: p.text }}>{s}</span>)}</div> : null;
  const photo = (item: TemplateItem, cls = '') => item.image ? <div className={cls || 'pv-art'} style={cls ? undefined : { borderRadius: 14, aspectRatio: '16/10', marginBottom: 14 }}><SafeImage src={item.image} alt={item.name} className="w-full h-full object-cover" /></div> : null;

  const renderItem = (item: TemplateItem, index: number) => {
    const common = edit(`item:${item.id}`);
    if (preset === 'sanctuary') {
      const [when, ...rest] = item.specs || [];
      return <article key={item.id} {...common} className="pv-item">
        <ExampleTag item={item} corner="right" flow />
        <div><p className="pv-when site-display" style={{ color: primaryText }}>{when || item.category}</p>{when && item.category && <p style={{ color: p.mutedText, fontSize: 13 }}>{item.category}</p>}</div>
        <div className="min-w-0 space-y-2">{photo(item)}<h3 style={{ color: p.text }}>{item.name}</h3>{item.desc && <p style={{ color: p.mutedText }}>{item.desc}</p>}{chips([...rest, ...(item.tag ? [item.tag] : [])])}{item.price && <p className="font-semibold" style={{ color: p.text }}>{item.price}</p>}</div>
        <div>{itemAction(item)}</div>
      </article>;
    }
    if (preset === 'atelier') return <article key={item.id} {...common} className="pv-item">
      <ExampleTag item={item} corner="left" />
      <div className="pv-look">{item.image ? <SafeImage src={item.image} alt={item.name} className="w-full h-full" /> : <div className="w-full h-full grid place-items-center site-display" style={{ color: p.mutedText, fontSize: 40 }} aria-hidden="true">{storeMonogram(item.name)}</div>}</div>
      <div className="flex items-baseline justify-between gap-3"><h3 className="site-display" style={{ color: p.text }}>{item.name}</h3>{item.price && <span className="shrink-0 text-sm font-semibold tracking-wide" style={{ color: p.text }}>{item.price}</span>}</div>
      {(item.category || item.tag) && <p className="pv-eyebrow" style={{ color: accentText, fontSize: 11, marginTop: 4 }}>{[item.category, item.tag].filter(Boolean).join(' · ')}</p>}
      {item.desc && <p style={{ color: p.mutedText, marginTop: 8 }}>{item.desc}</p>}
      <div style={{ marginTop: 14 }}>{itemAction(item)}</div>
    </article>;
    if (preset === 'counsel') return <article key={item.id} {...common} className="pv-item">
      <ExampleTag item={item} corner="right" flow />
      <span className="pv-num site-display" style={{ color: accentText }} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <div className="min-w-0 space-y-2">{photo(item)}{(item.category || item.tag) && <p className="pv-eyebrow" style={{ color: p.mutedText, fontSize: 11 }}>{[item.category, item.tag].filter(Boolean).join(' · ')}</p>}<h3 style={{ color: p.text }}>{item.name}</h3>{item.desc && <p style={{ color: p.mutedText }}>{item.desc}</p>}
        {item.specs && item.specs.length > 0 && <ul className="space-y-1.5 pt-1">{item.specs.map((s, i) => <li key={i} className="flex gap-2 text-sm" style={{ color: p.text }}><Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accentText }} aria-hidden="true" />{s}</li>)}</ul>}
        {item.price && <p className="font-semibold" style={{ color: p.text }}>{item.price}</p>}
      </div>
      <div className="col-start-2 md:col-start-auto">{itemAction(item)}</div>
    </article>;
    return <article key={item.id} {...common} className="pv-item" style={{ backgroundColor: p.surface, borderColor: p.border, '--pv-accent': p.secondary } as React.CSSProperties}>
      <ExampleTag item={item} corner="right" />
      {photo(item)}
      <div className="flex items-center justify-between gap-3">{item.category && <span className="pv-chip" style={{ backgroundColor: `${p.secondary}22`, color: p.text }}>{item.category}</span>}{item.tag && <span className="text-xs font-semibold" style={{ color: p.mutedText }}>{item.tag}</span>}</div>
      <h3 className="site-display" style={{ color: p.text, marginTop: 12 }}>{item.name}</h3>
      {item.desc && <p style={{ color: p.mutedText, marginTop: 6 }}>{item.desc}</p>}
      <div style={{ marginTop: 14 }}>{chips(item.specs)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginTop: 'auto', paddingTop: 18 }}>
        {item.price ? <strong className="site-display text-lg" style={{ color: primaryText }}>{item.price}</strong> : <span />}{itemAction(item)}
      </div>
    </article>;
  };

  return (
    <div className={`pv pv-${preset} min-h-full font-sans antialiased`} style={{ backgroundColor: p.background, color: p.text, '--pv-accent': p.secondary, '--pv-border': p.border, '--pv-surface': p.surface } as React.CSSProperties}>
      <style>{CSS}</style>
      <header className="pv-nav" style={{ backgroundColor: `${p.background}f2`, borderColor: p.border }}>
        <div className="pv-wrap pv-nav-in">
          <div className="pv-brand">
            <span className="pv-mark site-display" style={logo ? { border: `1px solid ${p.border}`, backgroundColor: p.surface } : deep}>
              {logo ? <SafeImage {...edit('content:logoUrl')} src={logo} alt={`${template.demoBusinessName} logo`} className="w-full h-full" style={{ objectFit: 'contain' }} />
                : <span {...edit('content:logoUrl')} aria-hidden="true">{storeMonogram(template.demoBusinessName)}</span>}
            </span>
            <div className="min-w-0">
              <span className="pv-name site-display" style={{ color: p.text }} {...edit('content:businessName')}>{template.demoBusinessName}</span>
              <span className="pv-sub" style={{ color: p.mutedText }}>{template.categoryLabel}</span>
            </div>
          </div>
          <button type="button" onClick={onCtaClick} className="pv-btn" style={solid}>{label.nav}</button>
        </div>
      </header>

      {preset === 'sanctuary' ? (
        <section className="pv-hero" style={{ backgroundColor: p.primary }}>
          {heroArt}<div className="pv-hero-scrim" aria-hidden="true" />
          <div className="pv-wrap pv-hero-in">{heroText}{statRow}</div>
        </section>
      ) : preset === 'atelier' ? (
        <section className="pv-hero">
          <div className="pv-wrap">{heroText}</div>
          <div className="pv-wrap" style={{ maxWidth: 1440 }}>{heroArt}</div>
          {stats.length > 0 && <div className="pv-wrap">{statRow}</div>}
        </section>
      ) : (
        <section className="pv-hero">
          <div className="pv-wrap pv-hero-grid">
            <div className="min-w-0">{preset === 'counsel' && <div className="pv-rule" aria-hidden="true" />}{heroText}{preset === 'campus' && statRow}</div>
            <div className="min-w-0">{heroArt}{preset === 'counsel' && statRow}</div>
          </div>
        </section>
      )}

      <main id="catalog" className="pv-section scroll-mt-20" style={preset === 'campus' ? { backgroundColor: p.surface } : undefined}>
        <div className="pv-wrap">
          <span className="pv-eyebrow" style={{ color: accentText }} {...copy.edit('itemsEyebrow')}>{copy.text('itemsEyebrow')}</span>
          <h2 className="pv-h2 site-display" style={{ color: p.text }} {...copy.edit('itemsHeading')}>{copy.text('itemsHeading')}</h2>
          <div className="pv-items">{items.map(renderItem)}</div>
        </div>
      </main>

      <footer>
      <section className="pv-section" style={{ paddingTop: 0 }} aria-labelledby="pv-visit-title">
        <div className="pv-wrap">
          <div className="pv-visit" style={{ backgroundColor: preset === 'campus' ? p.background : p.surface, borderColor: p.border }}>
            <div className="min-w-0 space-y-3">
              <h2 id="pv-visit-title" className="pv-h2 site-display" style={{ color: p.text, marginTop: 0 }}>{label.visit}</h2>
              <p style={{ color: p.mutedText }}>{label.visitIntro}</p>
              {template.location && <p className="flex gap-2 items-start text-sm" style={{ color: p.text }}><MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accentText }} aria-hidden="true" /><span {...edit('content:location')}>{template.location}</span></p>}
            </div>
            <div className="min-w-0 space-y-4">
              <SiteFooterContact template={template} className="text-sm" />
              <button type="button" onClick={onCtaClick} className="pv-btn" style={deep}>{label.nav}<ArrowRight className="w-4 h-4" aria-hidden="true" /></button>
            </div>
          </div>
        </div>
      </section>

      <div className="pv-foot" style={deep}>
        <div className="pv-wrap pv-foot-in">
          <strong className="site-display" {...edit('content:businessName')}>{template.demoBusinessName}</strong>
          <span style={{ opacity: .8 }}>© {new Date().getFullYear()} {template.demoBusinessName}</span>
        </div>
      </div>
      </footer>
    </div>
  );
}
