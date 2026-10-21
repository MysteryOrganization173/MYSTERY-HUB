import React, { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import type { TemplateItem, WebsiteTemplate } from '../../../types';
import { SafeImage } from '../SafeImage.js';
import { ExampleTag } from '../ExampleTag';
import { SiteFooterContact, websiteContactTarget } from '../SiteContactDetails';
import { PublishedCatalogEmpty } from '../PublishedCatalogEmpty.js';
import { useIsVisualEditing, useTemplateCopy, useVisualEditMarkers } from '../editor/VisualEditMarkers';
import { mixWebsiteColor, readableWebsiteColor, resolveStoreTheme, websiteActionText } from '../../../utils/websiteBrand';
import { focalPosition, resolveWebsiteSections, websiteDirectionsUrl, type WebsitePolicies } from '../../../config/websiteContentV5';
import { hasPolicies, PolicyList } from '../storefront/BusinessInfo';
import { ItemDetailSheet, ORDER_LIST_CSS, OrderListSheet, useOrderList } from '../storefront/OrderList';
import { orderCount } from '../../../utils/websiteOrderList';

/** Gallery preview only, labelled as examples. Owners write their own or the section stays hidden. */
const EXAMPLE_POLICIES: WebsitePolicies = {
  delivery: 'Example: delivery within the city in 1–2 days, other regions by arrangement.',
  payment: 'Example: Mobile Money or cash on delivery. We confirm before you pay.',
  returns: 'Example: exchanges within 3 days if unused.',
};

const CSS = `
.bq{font-family:'Plus Jakarta Sans',system-ui,sans-serif;min-height:100%;-webkit-font-smoothing:antialiased}
.bq-wrap{width:100%;max-width:1180px;margin:0 auto;padding:0 16px}
@media(min-width:768px){.bq-wrap{padding:0 32px}}
.bq-head{position:sticky;top:0;z-index:20;border-bottom:1px solid var(--bq-line)}
.bq-head-in{display:flex;align-items:center;gap:12px;min-height:64px}
.bq-brand{display:flex;align-items:center;gap:10px;min-width:0;flex:1}
.bq-logo{width:38px;height:38px;flex:none;overflow:hidden}
.bq-name{font-size:22px;line-height:1.1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bq-sub{font-size:10px;letter-spacing:.22em;text-transform:uppercase;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bq-nav{display:none;gap:24px;font-size:13px;font-weight:600;letter-spacing:.04em}
.bq-nav a{color:inherit;text-decoration:none}
@media(min-width:900px){.bq-nav{display:flex}}
.bq-pill{min-height:40px;padding:0 14px;border:1px solid currentColor;border-radius:999px;background:transparent;color:inherit;font-weight:600;font-size:13px;flex:none}
.bq-hero{display:grid;gap:22px;padding-block:18px 34px}
@media(min-width:900px){.bq-hero{grid-template-columns:1.1fr .9fr;align-items:center;gap:48px;padding-block:40px 56px}.bq-hero-copy{order:-1}}
.bq-collage{display:grid;grid-template-columns:1.35fr 1fr;grid-template-rows:1fr 1fr;gap:8px;aspect-ratio:1/1.02}
.bq-collage>*:first-child{grid-row:1/3}
.bq-collage.solo{grid-template-columns:1fr;grid-template-rows:1fr;aspect-ratio:4/5}
.bq-eyebrow{font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;margin:0 0 12px}
.bq-h1{font-size:clamp(36px,10vw,64px);line-height:1.04;font-weight:500;margin:0;letter-spacing:-.01em}
.bq-lede{font-size:16px;line-height:1.6;margin:14px 0 0;max-width:500px}
.bq-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.bq-btn{min-height:50px;padding:0 22px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;letter-spacing:.02em;text-decoration:none;border:1px solid currentColor;border-radius:2px}
.bq-rail{display:flex;gap:22px;overflow-x:auto;border-bottom:1px solid var(--bq-line);scrollbar-width:none}
.bq-cat{flex:none;min-height:46px;background:none;border:0;border-bottom:2px solid transparent;padding:0;color:inherit;font-size:14px;font-weight:600;margin-bottom:-1px}
.bq-cat span{font-weight:400;opacity:.7;margin-left:4px}
.bq-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 12px;margin-top:22px}
@media(min-width:900px){.bq-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:36px 22px}}
.bq-card{position:relative;text-align:left;background:none;border:0;padding:0;color:inherit;display:flex;flex-direction:column;justify-content:flex-start;width:100%;height:100%}
.bq-card-img{aspect-ratio:4/5;border-radius:2px}
.bq-flag{position:absolute;top:8px;left:8px;z-index:2;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:4px 7px}
.bq-card h3{font-size:16px;line-height:1.3;font-weight:500;margin:10px 0 2px;overflow-wrap:anywhere}
.bq-price{font-weight:700;font-size:14px}
.bq-note{font-size:12px;margin-top:2px}
.bq-desc{font-size:13px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.bq-sec{padding-block:44px}
.bq-h2{font-size:clamp(28px,7vw,42px);line-height:1.1;font-weight:500;margin:0}
.bq-intro{font-size:15px;line-height:1.6;margin:10px 0 0;max-width:620px}
.bq-policies{display:grid;gap:0;margin-top:18px}
@media(min-width:900px){.bq-policies{grid-template-columns:repeat(3,1fr);gap:32px}}
.bq-policy{padding:16px 0;border-top:1px solid var(--bq-line)}
.bq-policy h3{font-size:20px;font-weight:500;margin:0 0 6px}
.bq-policy p{font-size:15px;line-height:1.6;margin:0}
.bq-gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:18px}
.bq-gallery>*{aspect-ratio:1/1}
.bq-foot{padding-block:40px 28px}
.bq-float{position:sticky;bottom:0;z-index:30;padding:10px 12px calc(10px + env(safe-area-inset-bottom));pointer-events:none}
.bq-float button{pointer-events:auto;display:flex;align-items:center;justify-content:space-between;width:100%;max-width:560px;margin:0 auto;min-height:54px;padding:0 18px;border:0;border-radius:2px;font-weight:700;font-size:15px;box-shadow:0 12px 28px rgba(0,0,0,.22)}
`;

interface Props { template: WebsiteTemplate; onCtaClick?: () => void }

export const BoutiqueTemplateView: React.FC<Props> = ({ template, onCtaClick }) => {
  const edit = useVisualEditMarkers();
  const editing = useIsVisualEditing();
  const copy = useTemplateCopy(template);
  const content = template.siteContent;
  const owner = !!content;
  const order = useOrderList();
  const [detail, setDetail] = useState<TemplateItem | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [cat, setCat] = useState('All');

  const theme = resolveStoreTheme(template.colorScheme || {});
  const dark = theme.text.toLowerCase() === '#f8fafc';
  const muted = readableWebsiteColor(dark ? '#c9bfb4' : '#6b5e55', [theme.background, theme.surface]);
  const ink = theme.text, paper = theme.background, accentText = theme.accentText, line = theme.hairline;
  const footBg = dark ? mixWebsiteColor(paper, '#000000', 0.35) : '#1f1a17';

  const name = template.demoBusinessName;
  const items = template.items || [];
  const whatsapp = owner ? content?.whatsapp : '';
  const policies = owner ? content?.policies : EXAMPLE_POLICIES;
  const directions = websiteDirectionsUrl(owner ? content?.location : undefined);
  const link = owner && !editing && typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : undefined;
  const contact = { businessName: name, whatsapp, link, demo: !owner, onContact: () => { if (onCtaClick) onCtaClick(); else window.location.assign(websiteContactTarget(content)); } };

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items) if (i.category && i.category !== 'All') counts.set(i.category, (counts.get(i.category) || 0) + 1);
    return [['All', items.length] as const, ...counts.entries()];
  }, [items]);
  const shown = cat === 'All' ? items : items.filter(i => i.category === cat);
  // The collage uses the owner's cover photo, then their first product photos.
  const collage = [template.heroImage, ...items.map(i => i.image)].filter((s, i, all): s is string => !!s && all.indexOf(s) === i).slice(0, 3);
  const gallery = (owner ? content?.gallery || [] : []).slice(0, 6);
  const heroMeta = content?.imageMeta?.heroImage;
  const count = orderCount(order.lines);
  const open = (item: TemplateItem) => { if (!editing) setDetail(item); };
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const blocks: Record<string, React.ReactNode> = {
    collection: <section key="collection" id="collection" className="bq-wrap bq-sec scroll-mt-16" style={{ paddingTop: 8 }} aria-labelledby="bq-collection">
      <h2 id="bq-collection" className="bq-h2 site-display" {...copy.edit('collectionHeading')}>{copy.text('collectionHeading')}</h2>
      <p className="bq-intro" style={{ color: muted }} {...copy.edit('collectionIntro')}>{copy.text('collectionIntro')}</p>
      {categories.length > 1 && <div className="bq-rail" role="tablist" aria-label="Categories" style={{ marginTop: 18 }}>
        {categories.map(([c, n]) => <button key={c} type="button" role="tab" aria-selected={cat === c} className="bq-cat" onClick={() => setCat(c)} style={cat === c ? { borderBottomColor: ink } : { color: muted }}>{c === 'All' ? 'All' : c}<span>{n}</span></button>)}
      </div>}
      {owner && !shown.length && <div className="mt-6"><PublishedCatalogEmpty onContact={contact.onContact} /></div>}
      <div className="bq-grid">{shown.map(item => <div key={item.id || item.name} className="relative" {...edit(`item:${item.id}`)}>
        <ExampleTag item={item} corner="right" />
        <button type="button" className="bq-card" onClick={() => open(item)} aria-label={`${item.name}${item.price ? `, ${item.price}` : ''}, details`}>
          {(item.label || item.tag) && <span className="bq-flag" style={{ backgroundColor: paper, color: ink }}>{item.label || item.tag}</span>}
          <SafeImage src={item.image} alt={item.alt || item.name} className="bq-card-img" style={{ objectPosition: focalPosition(item.focal), backgroundColor: mixWebsiteColor(paper, ink, 0.08) }} />
          <h3 className="site-display">{item.name}</h3>
          <span className="bq-price">{item.price || 'Ask for the price'}</span>
          {item.desc && <p className="bq-note bq-desc" style={{ color: muted }}>{item.desc}</p>}
          {item.options?.length ? <p className="bq-note" style={{ color: muted }}>{item.options.length} option{item.options.length === 1 ? '' : 's'}</p> : null}
        </button>
      </div>)}</div>
    </section>,
    gallery: gallery.length > 0 && <section key="gallery" className="bq-wrap bq-sec" aria-label="Photos">
      <div className="bq-gallery">{gallery.map((src, i) => <SafeImage key={src + i} src={src} alt={`${name}, photo ${i + 1}`} />)}</div>
    </section>,
    policies: hasPolicies(policies) && <section key="policies" id="policies" className="bq-wrap bq-sec scroll-mt-16" aria-labelledby="bq-policies">
      <h2 id="bq-policies" className="bq-h2 site-display" {...copy.edit('policiesHeading')}>{copy.text('policiesHeading')}</h2>
      <div className="bq-policies"><PolicyList policies={policies} itemClassName="bq-policy" headingClassName="site-display" /></div>
      <p className="bq-note" style={{ color: muted, marginTop: 12 }}>{owner ? `Written by ${name}.` : 'Example wording. Each owner writes their own.'}</p>
    </section>,
    visit: <section key="visit" id="visit" className="bq-wrap bq-sec scroll-mt-16" aria-labelledby="bq-visit">
      <h2 id="bq-visit" className="bq-h2 site-display" {...copy.edit('visitHeading')}>{copy.text('visitHeading')}</h2>
      {template.location && <p className="bq-intro" style={{ color: muted, display: 'flex', gap: 8 }} {...edit('content:location')}><MapPin size={18} aria-hidden="true" style={{ flex: 'none', marginTop: 3 }} />{template.location}</p>}
      <div className="bq-actions">
        {directions && <a className="bq-btn" href={directions} target="_blank" rel="noopener noreferrer" style={{ backgroundColor: ink, color: paper, borderColor: ink }}>Get directions</a>}
        <SiteFooterContact template={template} only={['whatsapp', 'phone']} className="text-sm font-semibold" />
      </div>
    </section>,
  };
  const sections = resolveWebsiteSections('boutique', content?.sections);
  const nav = sections.filter(s => s.visible && s.nav && blocks[s.id]);
  const anchors: Record<string, string> = { collection: '#collection', policies: '#policies', visit: '#visit' };

  return <div className="bq" style={{ backgroundColor: paper, color: ink, '--bq-line': line, '--ol-bg': theme.surface, '--ol-text': ink, '--ol-muted': muted, '--ol-line': line, '--ol-accent': ink, '--ol-on-accent': paper, '--ol-radius': '4px' } as React.CSSProperties}>
    <style>{CSS + ORDER_LIST_CSS}</style>
    <header className="bq-head" style={{ backgroundColor: `${paper}f2` }}><div className="bq-wrap bq-head-in">
      <div className="bq-brand">
        {content?.logoUrl && <SafeImage {...edit('content:logoUrl')} src={content.logoUrl} alt={content.imageMeta?.logoUrl?.alt || `${name} logo`} className="bq-logo" style={{ objectFit: 'contain', background: 'transparent' }} />}
        <div className="min-w-0"><p className="bq-name site-display" {...edit('content:businessName')}>{name}</p>
          {template.location && <p className="bq-sub" style={{ color: muted }}>{template.location}</p>}</div>
      </div>
      <nav className="bq-nav" aria-label="Website">{nav.map(s => anchors[s.id] && <a key={s.id} href={anchors[s.id]}>{s.nav}</a>)}</nav>
      <button type="button" className="bq-pill" onClick={() => { if (!editing) setListOpen(true); }} data-order-list-pill>Order list ({count})</button>
    </div></header>

    <section className="bq-wrap bq-hero" aria-labelledby="bq-title">
      <div className={`bq-collage${collage.length < 3 ? ' solo' : ''}`} {...edit('content:heroImage')}>
        {(collage.length < 3 ? collage.slice(0, 1) : collage).map((src, i) => <SafeImage key={src + i} src={src} alt={i === 0 ? heroMeta?.alt || '' : ''} loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : undefined} style={{ objectPosition: i === 0 ? focalPosition(heroMeta) : undefined, backgroundColor: mixWebsiteColor(paper, ink, 0.08), borderRadius: 2 }} />)}
      </div>
      <div className="bq-hero-copy">
        <p className="bq-eyebrow" style={{ color: accentText }} {...copy.edit('eyebrow')}>{copy.text('eyebrow')}</p>
        <h1 id="bq-title" className="bq-h1 site-display" {...edit('content:tagline')}>{template.demoHeroTagline}</h1>
        <p className="bq-lede" style={{ color: muted }} {...edit('content:aboutText')}>{template.demoSubtext}</p>
        <div className="bq-actions">
          <button type="button" className="bq-btn" data-website-primary-cta="true" onClick={() => scrollTo('collection')} style={{ backgroundColor: ink, color: websiteActionText(ink), borderColor: ink }} {...edit('content:ctaLabel')}>{content?.ctaLabel && !/^contact us$/i.test(content.ctaLabel) ? content.ctaLabel : copy.text('primary')}</button>
          <button type="button" className="bq-btn" onClick={() => scrollTo('visit')} style={{ background: 'transparent', color: ink }}><span {...copy.edit('secondary')}>{copy.text('secondary')}</span></button>
        </div>
      </div>
    </section>

    {sections.filter(s => !s.essential || s.id === 'collection').map(s => s.visible ? (blocks[s.id] || null) : null)}

    <footer className="bq-foot" style={{ backgroundColor: footBg, color: '#f4efe7' }}><div className="bq-wrap" style={{ display: 'grid', gap: 8 }}>
      <p className="bq-h2 site-display" style={{ fontSize: 28 }}>{name}</p>
      {template.location && <p style={{ opacity: .75, fontSize: 14 }}>{template.location}</p>}
      <SiteFooterContact template={template} className="text-sm" />
      <p style={{ opacity: .6, fontSize: 12, marginTop: 12 }}>© {new Date().getFullYear()} {name}. Orders are confirmed by {owner ? name : 'the business'} on WhatsApp; nothing is paid on this website.</p>
    </div></footer>

    {count > 0 && <div className="bq-float"><button type="button" onClick={() => setListOpen(true)} style={{ backgroundColor: ink, color: paper }} data-order-bar><span>{count} item{count === 1 ? '' : 's'} on your list</span><span>Review →</span></button></div>}
    {detail && <ItemDetailSheet item={detail} contact={contact} onAdd={order.add} onClose={() => setDetail(null)} />}
    {listOpen && <OrderListSheet lines={order.lines} contact={contact} onQuantity={order.setQuantity} onClear={() => { order.clear(); setListOpen(false); }} onClose={() => setListOpen(false)} noun="products" />}
  </div>;
};
