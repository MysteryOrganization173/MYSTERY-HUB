import React, { useMemo, useState } from 'react';
import { MapPin, MessageCircle, Phone, Plus } from 'lucide-react';
import type { TemplateItem, WebsiteTemplate } from '../../../types';
import { SafeImage } from '../SafeImage.js';
import { ExampleTag } from '../ExampleTag';
import { SiteFooterContact, websiteContactTarget } from '../SiteContactDetails';
import { BusinessEnquiry } from '../BusinessEnquiry.js';
import { PublishedCatalogEmpty } from '../PublishedCatalogEmpty.js';
import { useIsVisualEditing, useTemplateCopy, useVisualEditMarkers } from '../editor/VisualEditMarkers';
import { readableWebsiteColor, resolveStoreTheme, websiteActionText } from '../../../utils/websiteBrand';
import { focalPosition, resolveWebsiteSections, websiteDirectionsUrl, type WebsiteHours } from '../../../config/websiteContentV5';
import { HoursList, OpenBadge } from '../storefront/BusinessInfo';
import { ItemDetailSheet, ORDER_LIST_CSS, OrderBar, OrderListSheet, useOrderList } from '../storefront/OrderList';

/** Gallery preview only: clearly example hours, so the open-now badge and hours table can be seen. */
const EXAMPLE_HOURS: WebsiteHours = { days: [0, 1, 2, 3, 4, 5, 6].map(i => i === 6 ? { closed: false, open: '12:00', close: '20:00' } : { closed: false, open: '11:00', close: '21:00' }) };

const CSS = `
.nk{font-family:'Plus Jakarta Sans',system-ui,sans-serif;min-height:100%;-webkit-font-smoothing:antialiased}
.nk-wrap{width:100%;max-width:1120px;margin:0 auto;padding:0 16px}
@media(min-width:768px){.nk-wrap{padding:0 32px}}
.nk-head{position:absolute;inset:0 0 auto;z-index:20}
.nk-head-in{display:flex;align-items:center;gap:12px;min-height:64px}
.nk-brand{display:flex;align-items:center;gap:10px;min-width:0;flex:1}
.nk-logo{width:40px;height:40px;border-radius:12px;flex:none;overflow:hidden;display:flex;align-items:center;justify-content:center;font-weight:700}
.nk-name{font-size:19px;line-height:1.15;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 1px 12px rgba(0,0,0,.45)}
.nk-nav{display:none;gap:22px;font-size:14px;font-weight:600}
.nk-nav a{color:inherit;text-decoration:none;opacity:.9}
@media(min-width:900px){.nk-nav{display:flex}}
.nk-pill{min-height:44px;padding:0 16px;border-radius:999px;display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:14px;text-decoration:none;border:1px solid rgba(255,255,255,.35);color:#fff;background:rgba(0,0,0,.28);backdrop-filter:blur(8px)}
.nk-hero{position:relative;min-height:min(86svh,720px);display:flex;align-items:flex-end;overflow:hidden;color:#fff}
@media(min-width:900px){.nk-hero{min-height:min(84vh,760px)}}
.nk-hero-img{position:absolute;inset:0}
.nk-hero-fade{position:absolute;inset:auto 0 0;height:78%;pointer-events:none}
.nk-hero-top{position:absolute;inset:0 0 auto;height:120px;background:linear-gradient(rgba(0,0,0,.5),transparent);pointer-events:none}
.nk-hero-copy{position:relative;padding-bottom:28px;padding-top:120px;max-width:680px}
.nk-open{display:inline-flex;align-items:center;font-size:13px;font-weight:700;padding:7px 12px;border-radius:999px;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);margin:0 0 14px}
.nk-eyebrow{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin:0 0 8px}
.nk-h1{font-size:clamp(38px,10.5vw,68px);line-height:1.02;font-weight:500;margin:0;letter-spacing:-.02em}
.nk-lede{font-size:16px;line-height:1.55;margin:14px 0 0;max-width:520px;opacity:.88}
.nk-actions{display:grid;grid-template-columns:1.25fr 1fr;gap:10px;margin-top:22px;max-width:480px}
.nk-btn{min-height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;gap:6px;font-weight:700;font-size:15px;white-space:nowrap;text-decoration:none;border:0;padding:0 12px;text-align:center}
.nk-btn-icon{flex:none}
@media(max-width:389px){.nk-btn{font-size:14px;padding:0 8px}.nk-btn-icon{display:none}}
.nk-btn-ghost{background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.4);color:#fff;backdrop-filter:blur(6px)}
.nk-tabs{position:sticky;top:0;z-index:15;border-bottom:1px solid var(--nk-line)}
.nk-tabs-in{display:flex;gap:8px;overflow-x:auto;padding:10px 0;scrollbar-width:none}
.nk-tab{flex:none;min-height:40px;padding:0 16px;border-radius:999px;font-weight:600;font-size:14px;border:1px solid transparent;background:transparent;color:inherit}
.nk-sec{padding-block:40px}
.nk-label{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin:0 0 6px}
.nk-h2{font-size:clamp(28px,7vw,40px);line-height:1.1;font-weight:500;margin:0}
.nk-picks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}
@media(min-width:900px){.nk-picks{grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}}
.nk-pick{text-align:left;background:none;border:0;padding:0;color:inherit;display:flex;flex-direction:column;justify-content:flex-start;height:100%}
.nk-pick-img{aspect-ratio:4/5;border-radius:18px;overflow:hidden}
.nk-pick h3{font-size:17px;line-height:1.25;font-weight:500;margin:10px 0 2px}
.nk-rows{display:grid;gap:0;margin-top:14px}
@media(min-width:900px){.nk-rows{grid-template-columns:1fr 1fr;column-gap:40px}}
.nk-row{display:flex;gap:14px;padding:16px 0;border-bottom:1px solid var(--nk-line);align-items:flex-start;position:relative}
.nk-row-main{display:block;width:100%;text-align:left;background:none;border:0;padding:0;color:inherit}
.nk-row h3{font-size:18px;line-height:1.25;font-weight:500;margin:0;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.nk-chip{font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;letter-spacing:.02em}
.nk-desc{font-size:14px;line-height:1.5;margin:4px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.nk-row-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px}
.nk-price{font-weight:700;font-size:15px}
.nk-add{min-height:40px;min-width:72px;padding:0 12px;border-radius:999px;font-weight:700;font-size:14px;display:inline-flex;align-items:center;justify-content:center;gap:4px;background:transparent}
.nk-thumb{width:92px;height:92px;flex:none;border-radius:16px;overflow:hidden}
.nk-gallery{display:grid;grid-template-columns:2fr 1fr;grid-template-rows:1fr 1fr;gap:10px;margin-top:18px;aspect-ratio:4/3}
@media(min-width:900px){.nk-gallery{aspect-ratio:21/9}}
.nk-gallery>*{border-radius:18px}
.nk-gallery>*:first-child{grid-row:1/3}
.nk-gallery.two{grid-template-columns:1fr 1fr;grid-template-rows:1fr}
.nk-gallery.two>*:first-child,.nk-gallery.one>*:first-child{grid-row:auto}
.nk-gallery.one{grid-template-columns:1fr;grid-template-rows:1fr}
.nk-info{display:grid;gap:14px}
@media(min-width:900px){.nk-info{grid-template-columns:1fr 1fr}}
.nk-card{border-radius:22px;padding:22px;border:1px solid var(--nk-line)}
.nk-card .nk-h2{font-size:30px}
.nk-hours{margin:14px 0 0;font-size:15px}
.nk-foot{padding-block:36px 28px;border-top:1px solid var(--nk-line)}
`;

interface Props { template: WebsiteTemplate; onCtaClick?: () => void }

export const NightKitchenTemplateView: React.FC<Props> = ({ template, onCtaClick }) => {
  const edit = useVisualEditMarkers();
  const editing = useIsVisualEditing();
  const copy = useTemplateCopy(template);
  const content = template.siteContent;
  const owner = !!content;
  const order = useOrderList();
  const [detail, setDetail] = useState<TemplateItem | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [tab, setTab] = useState('All');

  const theme = resolveStoreTheme(template.colorScheme || {});
  const dark = theme.text.toLowerCase() === '#f8fafc';
  const muted = readableWebsiteColor(dark ? '#c5b3a6' : '#6b5e55', [theme.background, theme.surface]);
  const accent = theme.accent, onAccent = websiteActionText(accent), accentText = theme.accentText;
  const line = theme.hairline;

  const name = template.demoBusinessName;
  const items = template.items || [];
  const hours = owner ? content?.hours : EXAMPLE_HOURS;
  const whatsapp = owner ? content?.whatsapp : '';
  const phone = owner ? content?.phone : '';
  const directions = websiteDirectionsUrl(owner ? content?.location : undefined);
  const link = owner && !editing && typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : undefined;
  const contact = { businessName: name, whatsapp, link, demo: !owner, onContact: () => { if (onCtaClick) onCtaClick(); else window.location.assign(websiteContactTarget(content)); } };

  const categories = useMemo(() => ['All', ...new Set(items.map(i => i.category).filter((c): c is string => !!c && c !== 'All'))], [items]);
  const shown = tab === 'All' ? items : items.filter(i => i.category === tab);
  const picks = items.filter(i => i.pinned).slice(0, 4);
  const gallery = (owner ? content?.gallery || [] : items.map(i => i.image).filter((s): s is string => !!s)).slice(0, 3);

  // A tap opens the dish; the owner's editor keeps taps for editing.
  const open = (item: TemplateItem) => { if (!editing) setDetail(item); };
  const add = (item: TemplateItem) => { if (editing) return; if (item.options?.length) setDetail(item); else order.add(item); };

  const heroMeta = content?.imageMeta?.heroImage;
  const primary = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '').replace(/^0/, '233')}` : '#menu';

  const blocks: Record<string, React.ReactNode> = {
    picks: picks.length > 0 && <section key="picks" className="nk-sec" aria-labelledby="nk-picks"><div className="nk-wrap">
      <p className="nk-label" style={{ color: accentText }} {...copy.edit('picksEyebrow')}>{copy.text('picksEyebrow')}</p>
      <h2 id="nk-picks" className="nk-h2 site-display" {...copy.edit('picksHeading')}>{copy.text('picksHeading')}</h2>
      <div className="nk-picks">{picks.map(item => <button key={item.id || item.name} type="button" className="nk-pick" onClick={() => open(item)} {...edit(`item:${item.id}`)}>
        <SafeImage src={item.image} alt={item.alt || item.name} className="nk-pick-img" style={{ objectPosition: focalPosition(item.focal), backgroundColor: theme.surface }} />
        <h3 className="site-display">{item.name}</h3>
        <span className="nk-price" style={{ color: accentText }}>{item.price || 'Ask'}</span>
      </button>)}</div>
    </div></section>,
    menu: <section key="menu" id="menu" className="scroll-mt-4" aria-labelledby="nk-menu">
      {categories.length > 1 && <div className="nk-tabs" style={{ backgroundColor: theme.background }}><div className="nk-wrap"><div className="nk-tabs-in" role="tablist" aria-label="Menu categories">
        {categories.map(c => <button key={c} type="button" role="tab" aria-selected={tab === c} className="nk-tab" onClick={() => setTab(c)} style={tab === c ? { backgroundColor: theme.text, color: theme.background } : { color: muted, borderColor: line }}>{c}</button>)}
      </div></div></div>}
      <div className="nk-wrap nk-sec" style={{ paddingTop: 28 }}>
        <p className="nk-label" style={{ color: accentText }}>{tab === 'All' ? 'Menu' : tab}</p>
        <h2 id="nk-menu" className="nk-h2 site-display" {...copy.edit('menuHeading')}>{copy.text('menuHeading')}</h2>
        <p className="nk-desc" style={{ color: muted, WebkitLineClamp: 'unset', display: 'block' }} {...copy.edit('menuIntro')}>{copy.text('menuIntro')}</p>
        {owner && !shown.length && <div className="mt-4"><PublishedCatalogEmpty onContact={contact.onContact} /></div>}
        <div className="nk-rows">{shown.map(item => <div key={item.id || item.name} className="nk-row" {...edit(`item:${item.id}`)}>
          <ExampleTag item={item} corner="right" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <button type="button" className="nk-row-main" onClick={() => open(item)} aria-label={`${item.name}, details`}>
              <h3 className="site-display">{item.name}{(item.label || item.tag) && <span className="nk-chip" style={{ backgroundColor: `${accent}26`, color: accentText }}>{item.label || item.tag}</span>}</h3>
              {item.desc && <p className="nk-desc" style={{ color: muted }}>{item.desc}</p>}
            </button>
            <div className="nk-row-foot">
              <span className="nk-price">{item.price || 'Ask'}</span>
              <button type="button" className="nk-add" onClick={() => add(item)} style={{ color: accentText, border: `1px solid ${line}` }} aria-label={`Add ${item.name} to your order`}><Plus size={16} aria-hidden="true" />Add</button>
            </div>
          </div>
          {item.image && <SafeImage src={item.image} alt="" className="nk-thumb" style={{ objectPosition: focalPosition(item.focal), backgroundColor: theme.surface }} />}
        </div>)}</div>
      </div>
    </section>,
    gallery: gallery.length > 0 && <section key="gallery" className="nk-sec" aria-label="Photos"><div className="nk-wrap">
      <div className={`nk-gallery${gallery.length === 1 ? ' one' : gallery.length === 2 ? ' two' : ''}`}>{gallery.map((src, i) => <SafeImage key={src + i} src={src} alt={`${name}, photo ${i + 1}`} style={{ backgroundColor: theme.surface }} />)}</div>
    </div></section>,
    hours: hours && <section key="hours" id="hours" className="nk-wrap" style={{ paddingBottom: 14 }} aria-labelledby="nk-hours"><div className="nk-card" style={{ backgroundColor: theme.surface }}>
      <h2 id="nk-hours" className="nk-h2 site-display" {...copy.edit('hoursHeading')}>{copy.text('hoursHeading')}</h2>
      <HoursList hours={hours} className="nk-hours" />
      {!owner && <p className="nk-desc" style={{ color: muted }}>Example hours. Each owner enters their own.</p>}
    </div></section>,
    findus: (content?.location || !owner) && <section key="findus" id="find-us" className="nk-wrap" style={{ paddingBottom: 14 }} aria-labelledby="nk-find"><div className="nk-card" style={{ backgroundColor: theme.surface }}>
      <h2 id="nk-find" className="nk-h2 site-display" {...copy.edit('findHeading')}>{copy.text('findHeading')}</h2>
      <p className="nk-desc" style={{ color: muted, display: 'flex', gap: 8, WebkitLineClamp: 'unset', fontSize: 16 }} {...edit('content:location')}><MapPin size={18} aria-hidden="true" style={{ flex: 'none', marginTop: 2 }} />{template.location}</p>
      {directions && <a href={directions} target="_blank" rel="noopener noreferrer" className="nk-btn" style={{ marginTop: 16, backgroundColor: theme.text, color: theme.background, maxWidth: 260 }}>Get directions</a>}
    </div></section>,
    enquiry: <section key="enquiry" className="nk-wrap nk-sec" aria-labelledby="nk-enquiry"><div className="nk-card" style={{ backgroundColor: theme.surface }}>
      <h2 id="nk-enquiry" className="nk-h2 site-display" {...copy.edit('enquiryHeading')}>{copy.text('enquiryHeading')}</h2>
      <div style={{ marginTop: 14, color: theme.surfaceText }}>{owner ? <BusinessEnquiry onContact={contact.onContact} template={template} askLabel="Ask about" dateLabel="Date of your visit" /> : <p className="nk-desc" style={{ color: muted, WebkitLineClamp: 'unset' }}>Customers can ask about a table or a group order. The message goes to the business on WhatsApp; nothing is booked here.</p>}</div>
    </div></section>,
  };
  const sections = resolveWebsiteSections('nightkitchen', content?.sections);
  const nav = sections.filter(s => s.visible && s.nav && blocks[s.id]);
  const anchor: Record<string, string> = { menu: '#menu', hours: '#hours', findus: '#find-us' };

  return <div className="nk" style={{ backgroundColor: theme.background, color: theme.text, '--nk-line': line, '--ol-bg': theme.background, '--ol-text': theme.text, '--ol-muted': muted, '--ol-line': line, '--ol-accent': accent, '--ol-on-accent': onAccent, '--ol-radius': '22px' } as React.CSSProperties}>
    <style>{CSS + ORDER_LIST_CSS}</style>
    <header className="nk-head"><div className="nk-wrap nk-head-in" style={{ color: '#fff' }}>
      <div className="nk-brand">
        {content?.logoUrl ? <span className="nk-logo" style={{ background: '#fff' }}><SafeImage {...edit('content:logoUrl')} src={content.logoUrl} alt={content.imageMeta?.logoUrl?.alt || `${name} logo`} className="w-full h-full" style={{ objectFit: 'contain' }} /></span> : null}
        <span className="nk-name site-display" {...edit('content:businessName')}>{name}</span>
      </div>
      <nav className="nk-nav" aria-label="Website">{nav.map(s => anchor[s.id] && <a key={s.id} href={anchor[s.id]}>{s.nav}</a>)}</nav>
      {phone ? <a className="nk-pill" href={`tel:${phone.replace(/[^\d+]/g, '')}`} {...edit('content:phone')}><Phone size={16} aria-hidden="true" />Call</a> : !owner ? <span className="nk-pill"><Phone size={16} aria-hidden="true" />Call</span> : null}
    </div></header>

    <section className="nk-hero" aria-labelledby="nk-title">
      <SafeImage {...edit('content:heroImage')} src={template.heroImage} alt={heroMeta?.alt || ''} loading="eager" fetchPriority="high" className="nk-hero-img" style={{ objectPosition: focalPosition(heroMeta) }} />
      <div className="nk-hero-top" />
      <div className="nk-hero-fade" style={{ background: `linear-gradient(to top, ${theme.background} 4%, ${theme.background}d9 32%, transparent)` }} />
      <div className="nk-wrap"><div className="nk-hero-copy" style={{ color: theme.text }}>
        <OpenBadge hours={hours} className="nk-open" />
        <p className="nk-eyebrow" style={{ color: accentText }} {...copy.edit('eyebrow')}>{copy.text('eyebrow')}</p>
        <h1 id="nk-title" className="nk-h1 site-display" {...edit('content:tagline')}>{template.demoHeroTagline}</h1>
        <p className="nk-lede" {...edit('content:aboutText')}>{template.demoSubtext}</p>
        <div className="nk-actions">
          <a href={primary} target={whatsapp ? '_blank' : undefined} rel={whatsapp ? 'noopener noreferrer' : undefined} data-website-primary-cta="true" data-website-event={whatsapp ? 'whatsapp_click' : undefined} className="nk-btn" style={{ backgroundColor: accent, color: onAccent }} {...edit('content:ctaLabel')}><MessageCircle size={18} aria-hidden="true" className="nk-btn-icon" />{content?.ctaLabel && !/^contact us$/i.test(content.ctaLabel) ? content.ctaLabel : copy.text('primary')}</a>
          {directions ? <a href={directions} target="_blank" rel="noopener noreferrer" className="nk-btn nk-btn-ghost" style={dark ? undefined : { color: theme.text, borderColor: line, background: 'transparent' }}>Directions</a>
            : <a href="#menu" className="nk-btn nk-btn-ghost" style={dark ? undefined : { color: theme.text, borderColor: line, background: 'transparent' }}>See the menu</a>}
        </div>
      </div></div>
    </section>

    {sections.filter(s => !s.essential || s.id === 'menu').map(s => s.visible ? (blocks[s.id] || null) : null)}

    <footer className="nk-foot"><div className="nk-wrap" style={{ display: 'grid', gap: 8 }}>
      <p className="nk-h2 site-display" style={{ fontSize: 26 }}>{name}</p>
      {template.location && <p className="nk-desc" style={{ color: muted }}>{template.location}</p>}
      <SiteFooterContact template={template} className="text-sm" />
      <p className="nk-desc" style={{ color: muted, fontSize: 12, marginTop: 12 }}>© {new Date().getFullYear()} {name}. Orders, payment and delivery are agreed directly with {owner ? name : 'the business'}.</p>
    </div></footer>

    <OrderBar lines={order.lines} onOpen={() => setListOpen(true)} />
    {detail && <ItemDetailSheet item={detail} contact={contact} onAdd={order.add} onClose={() => setDetail(null)} />}
    {listOpen && <OrderListSheet lines={order.lines} contact={contact} onQuantity={order.setQuantity} onClear={() => { order.clear(); setListOpen(false); }} onClose={() => setListOpen(false)} noun="dishes" />}
  </div>;
};
