import React, { useCallback, useEffect, useRef, useState } from 'react';
import './creativeStudio.css';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Globe, Info, Megaphone, MessageCircle, Phone, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';
import { getCloudinarySrcSet, getCloudinaryUrl } from '../../utils/cloudinary';
import { trackGrowth } from '../../utils/growthAnalytics';
import { workspacePath } from '../../utils/businessWorkspace';
import { creativeService, type CreativeServiceId } from '../../../shared/creativeStudio';
import {
  CREATIVE_CATEGORIES, CREATIVE_COMMERCE, CREATIVE_PACKAGES, creativeCedis, creativeFromPrice, creativePackage, creativePackagesIn, type CreativePackage,
} from '../../../shared/creativeCatalogue';
import { CREATIVE_KIND_SERVICE, CREATIVE_OWNER_LABEL, CREATIVE_PROJECTS, creativeProjectOf, creativeWorkById, type CreativeProject, type CreativeWork } from '../../data/creativeStudioWork';
import { ArtImage, CATEGORY_MAT, CreativeSheet, type SheetState } from './CreativeSheet';
import { Seasonal } from '../../seasonal/Seasonal';

const isPlainClick = (e: React.MouseEvent) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** The editorial serif is only needed here, so it is requested when Creative Studio first opens (Georgia until then). */
const SERIF_HREF = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,500;1,9..144,600&display=swap';
function useSerifFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${SERIF_HREF}"]`)) return;
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = SERIF_HREF; document.head.appendChild(link);
  }, []);
}

/** What the address says the page should show: a package sheet, the custom brief, or a category of the catalogue. */
function readUrl(): { sheet: SheetState; category: CreativeServiceId | '' } {
  if (typeof window === 'undefined') return { sheet: null, category: '' };
  const params = new URLSearchParams(window.location.search);
  const pkg = creativePackage(params.get('package'));
  const category = creativeService(params.get('service'))?.id || pkg?.category || '';
  return { sheet: pkg ? { kind: 'package', id: pkg.id } : params.get('brief') === 'custom' ? { kind: 'custom' } : null, category };
}
function writeUrl(sheet: SheetState, push: boolean) {
  const url = new URL(window.location.href);
  url.searchParams.delete('package'); url.searchParams.delete('brief');
  if (sheet?.kind === 'package') url.searchParams.set('package', sheet.id);
  if (sheet?.kind === 'custom') url.searchParams.set('brief', 'custom');
  const state = { ...(window.history.state || {}), page: 'creative', csSheet: Boolean(sheet) };
  if (push) window.history.pushState(state, '', `${url.pathname}${url.search}`);
  else window.history.replaceState(state, '', `${url.pathname}${url.search}`);
}

const HERO = { wide: creativeWorkById('ih-cover'), tall: creativeWorkById('ht-flyer'), square: creativeWorkById('lz-social') };
const HERO_OFFER = creativePackage('standard-flyer')!;
/** The package a portfolio piece leads to: the package it is a sample for, or the closest one for its kind of work. */
const KIND_PACKAGE: Record<string, string> = { flyers: 'standard-flyer', social: 'social-post', logo: 'logo-design', banners: 'cover-banner' };
const packageForWork = (work: CreativeWork) => CREATIVE_PACKAGES.find(pkg => pkg.art.includes(work.id))?.id || KIND_PACKAGE[CREATIVE_KIND_SERVICE[work.kind]];

/** One catalogue card: the artwork floats on a quiet mat with its price, so the work leads and the facts follow. */
function PackageCard({ pkg, index, onOpen }: { pkg: CreativePackage; index: number; onOpen: (id: string) => void }) {
  const work = creativeWorkById(pkg.art[0]);
  const shape = work.width > work.height * 1.15 ? 'wide' : work.height > work.width * 1.1 ? 'tall' : 'square';
  return (
    <li className="cs-card" style={{ '--cs-mat': CATEGORY_MAT[pkg.category], '--cs-tilt': `${index % 2 ? 2 : -2}deg` } as React.CSSProperties}>
      <a href={`/creative-studio?package=${pkg.id}`} onClick={e => { if (!isPlainClick(e)) return; e.preventDefault(); onOpen(pkg.id); }}
        aria-label={`${pkg.name}, ${creativeCedis(pkg.priceMinor)}${CREATIVE_COMMERCE.pricing === 'draft' ? ' draft price' : ''}. ${pkg.tagline}`}>
        <span className="cs-card-mat">
          <span className="cs-card-art" data-shape={shape}>
            <ArtImage work={work} widths={[320, 480, 720]} sizes="(min-width: 1100px) 230px, (min-width: 768px) 30vw, 44vw" />
          </span>
          <span className="cs-card-price">{creativeCedis(pkg.priceMinor)}</span>
        </span>
        <span className="cs-card-text">
          <strong>{pkg.name}</strong>
          <span className="cs-card-line">{pkg.tagline}</span>
          <span className="cs-card-meta">{pkg.turnaroundDays} days · {pkg.revisions} revisions</span>
        </span>
      </a>
    </li>
  );
}

/** Full-screen viewer for the portfolio. Native <dialog>: Escape closes, focus stays inside, arrows move. */
function WorkViewer({ viewing, onClose, onMove, onOrder }: { viewing: { list: readonly CreativeWork[]; index: number } | null; onClose: () => void; onMove: (step: number) => void; onOrder: (work: CreativeWork) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current; if (!dialog) return;
    if (viewing && !dialog.open) dialog.showModal();
    if (!viewing && dialog.open) dialog.close();
  }, [viewing]);
  const work = viewing ? viewing.list[viewing.index] : null;
  const project = work ? creativeProjectOf(work) : null;
  return (
    <dialog ref={ref} className="cs-lightbox" aria-label={work ? `${project!.name}: ${work.title}, enlarged` : 'Work sample'} onClose={onClose}
      onKeyDown={e => { if (e.key === 'ArrowRight') onMove(1); if (e.key === 'ArrowLeft') onMove(-1); }}
      onClick={e => { if (e.target === ref.current) onClose(); }}>
      {work && project && (
        <div className="cs-lightbox-inner">
          <div className="cs-lightbox-bar">
            <p aria-live="polite">{viewing!.index + 1} of {viewing!.list.length} · {CREATIVE_OWNER_LABEL[project.owner]}</p>
            <button type="button" className="cs-icon-btn" onClick={onClose} aria-label="Close"><X size={20} aria-hidden /></button>
          </div>
          <figure>
            <img key={work.id} src={getCloudinaryUrl(work.src, { width: 1600, crop: 'limit' })} srcSet={getCloudinarySrcSet(work.src, [640, 1000, 1600], { crop: 'limit' })} sizes="(min-width: 1100px) 1100px, 100vw" width={work.width} height={work.height} alt={work.alt} decoding="async" />
          </figure>
          <figcaption>
            <span className="cs-lightbox-text"><strong>{project.name}: {work.title}</strong><span>{work.note}</span></span>
            <span className="cs-lightbox-actions">
              <button type="button" className="cs-btn cs-btn-primary" onClick={() => onOrder(work)}>Order something similar</button>
              {viewing!.list.length > 1 && <span className="cs-lightbox-nav">
                <button type="button" className="cs-icon-btn" onClick={() => onMove(-1)} aria-label="Previous piece"><ChevronLeft size={20} aria-hidden /></button>
                <button type="button" className="cs-icon-btn" onClick={() => onMove(1)} aria-label="Next piece"><ChevronRight size={20} aria-hidden /></button>
              </span>}
            </span>
          </figcaption>
        </div>
      )}
    </dialog>
  );
}

/** One Studio Concept at a time: cover, story and the pieces, so three brands never become one endless scroll. */
function ProjectPanel({ project, onView, onOrder }: { project: CreativeProject; onView: (index: number) => void; onOrder: (id: string) => void }) {
  const offer = creativePackage(project.package)!;
  return (
    <div className="cs-project" role="tabpanel" id={`cs-panel-${project.id}`} aria-labelledby={`cs-tab-${project.id}`}>
      <button type="button" className="cs-project-cover" onClick={() => onView(0)} aria-label={`Enlarge ${project.name}, ${project.pieces[0].title}`}>
        <ArtImage work={project.pieces[0]} widths={[480, 800, 1200]} sizes="(min-width: 1000px) 680px, 92vw" />
      </button>
      <div className="cs-project-text">
        <p className="cs-project-label">{CREATIVE_OWNER_LABEL[project.owner]} · {project.sector}</p>
        <h3>{project.name}</h3>
        <p>{project.summary}</p>
        <ul className="cs-swatches" aria-label={`${project.name} colours`}>{project.palette.map(colour => <li key={colour} style={{ background: colour }} title={colour}><span className="sr-only">{colour}</span></li>)}</ul>
        <p className="cs-project-includes">{project.includes.join(' · ')}</p>
        <button type="button" className="cs-btn cs-btn-ghost" onClick={() => onOrder(offer.id)}>{offer.name} from {creativeCedis(offer.priceMinor)}<ArrowRight size={16} aria-hidden /></button>
      </div>
      <ul className="cs-strip" aria-label={`More from ${project.name}`}>
        {project.pieces.slice(1).map((work, i) => (
          <li key={work.id} style={{ aspectRatio: `${work.width} / ${work.height}` }}>
            <button type="button" onClick={() => onView(i + 1)} aria-label={`Enlarge ${project.name}, ${work.title}`}>
              <ArtImage work={work} widths={[320, 640]} sizes="(min-width: 760px) 400px, 260px" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const FAQ: { q: string; a: string }[] = [
  { q: 'What counts as a revision round?', a: 'One list of changes to the agreed design, sent together. Small fixes to our own mistakes are always free. A new idea, layout or wording after you approve a direction is new work, and we tell you the price before doing it.' },
  { q: 'When does the turnaround start?', a: 'From the working day after your order is confirmed and we have your wording, photos and logo. Working days are Monday to Saturday. Express extras shorten the time to your first draft.' },
  { q: 'What do I need to send?', a: 'The exact words, prices and dates for the design, plus any photos and your logo. After you send your order request, we collect files on WhatsApp.' },
  { q: 'How do I pay?', a: CREATIVE_COMMERCE.payments === 'off'
    ? 'Online payment for Creative Studio is not open yet. Sending an order request costs nothing: the team contacts you on WhatsApp to confirm the package, price and start date first. Secure checkout through Mystery Hub opens once launch prices are confirmed.'
    : 'You pay securely through Mystery Hub when you place your order. Design starts once payment is confirmed and your brief is complete.' },
  { q: 'Is printing included?', a: 'No. You receive print-ready files where the package says so, and you can take them to any printer.' },
  { q: 'Are the brands in the samples real clients?', a: 'No. Harmattan Table, Indigo Hour and Lonzero are Studio Concepts: fictional brands we designed to show our range. They are not client projects.' },
];

/**
 * Mystery Creative Studio (/creative-studio): fixed-price design packages.
 * Explore → choose a package → see what is included and add extras → send an order request → saved reference → the team
 * confirms. Custom projects keep the quoted brief. No payment is taken in this release (CREATIVE_COMMERCE.payments).
 */
export const CreativeStudioPage: React.FC = () => {
  const { setActivePage } = useApp();
  useSerifFont();
  const initial = useRef(readUrl());
  const [sheet, setSheet] = useState<SheetState>(initial.current.sheet);
  const [category, setCategory] = useState<CreativeServiceId | ''>(initial.current.category);
  const [customService, setCustomService] = useState<CreativeServiceId | ''>(initial.current.category);
  const [projectId, setProjectId] = useState(CREATIVE_PROJECTS[0].id);
  const [viewing, setViewing] = useState<{ list: readonly CreativeWork[]; index: number } | null>(null);
  const tracked = useRef(new Set<string>());
  const project = CREATIVE_PROJECTS.find(p => p.id === projectId)!;
  const draft = CREATIVE_COMMERCE.pricing === 'draft';

  const track = useCallback((id: CreativeServiceId) => {
    if (!tracked.current.has(id)) { tracked.current.add(id); trackGrowth('creative_service', { page: 'creative' }); }
  }, []);
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });

  const openPackage = useCallback((id: string) => {
    const pkg = creativePackage(id); if (!pkg) return;
    setViewing(null);
    const next: SheetState = { kind: 'package', id };
    writeUrl(next, !window.history.state?.csSheet);
    setSheet(next); track(pkg.category);
  }, [track]);
  const openCustom = () => { const next: SheetState = { kind: 'custom' }; writeUrl(next, !window.history.state?.csSheet); setSheet(next); };
  // Closing goes back through history when the sheet added an entry, so the phone's Back button and the X agree.
  const closeSheet = useCallback(() => {
    if (window.history.state?.csSheet && !initial.current.sheet) { window.history.back(); return; }
    initial.current.sheet = null;
    writeUrl(null, false); setSheet(null);
  }, []);
  useEffect(() => {
    const sync = () => setSheet(readUrl().sheet);
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  // A shared link (/creative-studio?service=logo) opens the catalogue on that category.
  useEffect(() => {
    if (initial.current.category && !initial.current.sheet) requestAnimationFrame(() => document.getElementById('catalogue')?.scrollIntoView({ block: 'start' }));
  }, []);

  const chooseCategory = (id: CreativeServiceId | '') => {
    setCategory(id);
    if (id) track(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('service', id); else url.searchParams.delete('service');
    window.history.replaceState({ ...(window.history.state || {}), page: 'creative' }, '', `${url.pathname}${url.search}`);
    const top = document.getElementById('catalogue-tabs')?.getBoundingClientRect().top ?? 0;
    if (top < 60) document.getElementById('catalogue-grid')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };
  const jump = (id: string) => (e: React.MouseEvent) => { if (!isPlainClick(e)) return; e.preventDefault(); scrollTo(id); };
  const go = (page: 'marketplace' | 'website') => (e: React.MouseEvent) => { if (!isPlainClick(e)) return; e.preventDefault(); setActivePage(page); };
  const openPromote = (e: React.MouseEvent) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    window.history.pushState({ page: 'business' }, '', workspacePath('promote'));
    setActivePage('business', false);
  };
  const tabKeys = (e: React.KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = CREATIVE_PROJECTS[(index + step + CREATIVE_PROJECTS.length) % CREATIVE_PROJECTS.length];
    setProjectId(next.id);
    document.getElementById(`cs-tab-${next.id}`)?.focus();
  };
  const shown = category ? CREATIVE_CATEGORIES.filter(c => c.id === category) : CREATIVE_CATEGORIES;
  const { contact } = BUSINESS_CONFIG;

  return (
    <div className="cs-page">
      {/* Hero: what the Studio sells, its prices, and the work itself. */}
      <section className="cs-hero" aria-labelledby="cs-title">
        <div className="cs-wrap cs-hero-grid">
          <div className="cs-hero-copy">
            <nav aria-label="Breadcrumb">
              <ol className="cs-crumbs">
                <li><a href="/marketplace" onClick={go('marketplace')}>Marketplace</a></li>
                <li aria-hidden="true">/</li>
                <li><span aria-current="page">Creative Studio</span></li>
              </ol>
            </nav>
            <p className="cs-eyebrow">Mystery Creative Studio</p>
            <h1 id="cs-title">Great design, <span className="cs-serif">clearly priced.</span></h1>
            <p className="cs-hero-lead">Flyers, social posts, logos and banners by the Mystery Hub studio team. Choose a package, see exactly what you get, and order in minutes.</p>
            <div className="cs-hero-actions">
              <a className="cs-btn cs-btn-primary" href="#catalogue" onClick={jump('catalogue')}>Explore designs<ArrowRight size={18} aria-hidden /></a>
              <a className="cs-btn cs-btn-ghost" href="#work" onClick={jump('work')}>Selected work</a>
            </div>
            <dl className="cs-hero-facts">
              <div><dt>Packages from</dt><dd>{creativeCedis(creativeFromPrice())}</dd></div>
              <div><dt>First draft in</dt><dd>2–8 days</dd></div>
              <div><dt>Changes included</dt><dd>2–3 rounds</dd></div>
            </dl>
          </div>

          <div className="cs-stage" aria-label="Studio Concept artwork">
            <Seasonal slot="creative-stage" />
            <figure className="cs-stage-wide"><ArtImage work={HERO.wide} widths={[480, 800]} sizes="(min-width: 960px) 360px, 64vw" eager /></figure>
            <figure className="cs-stage-tall"><ArtImage work={HERO.tall} widths={[320, 560]} sizes="(min-width: 960px) 240px, 42vw" eager /></figure>
            <figure className="cs-stage-square"><ArtImage work={HERO.square} widths={[320, 480]} sizes="(min-width: 960px) 210px, 38vw" /></figure>
            <a className="cs-stage-offer" href={`/creative-studio?package=${HERO_OFFER.id}`} onClick={e => { if (!isPlainClick(e)) return; e.preventDefault(); openPackage(HERO_OFFER.id); }}>
              <span className="cs-stage-offer-name">{HERO_OFFER.name}</span>
              <strong>{creativeCedis(HERO_OFFER.priceMinor)}</strong>
              <span className="cs-stage-offer-meta">{HERO_OFFER.turnaroundDays} days · {HERO_OFFER.revisions} revisions{draft ? ' · draft' : ''}</span>
            </a>
            <p className="cs-stage-note"><span aria-hidden="true" className="cs-stage-dots">{['#B5341C', '#E3A32B', '#1F2A5A', '#2438E8'].map(c => <i key={c} style={{ background: c }} />)}</span>Studio Concepts</p>
          </div>
        </div>
      </section>

      {/* The catalogue: every package, its price and its facts, filterable by category. */}
      <section className="cs-paper" id="catalogue" aria-labelledby="cs-catalogue-title">
        <div className="cs-wrap">
          <div className="cs-head">
            <div>
              <p className="cs-eyebrow cs-eyebrow-ink">The catalogue</p>
              <h2 className="cs-h2" id="cs-catalogue-title">Pick a design. <span className="cs-serif">See the price.</span></h2>
            </div>
            <p className="cs-lead">Every package lists what you get, how long it takes and how many changes are included. Tap one for the details.</p>
          </div>
          {(draft || CREATIVE_COMMERCE.payments === 'off') && (
            <p className="cs-notice"><Info size={18} aria-hidden /><span>{draft && <><strong>Draft prices.</strong> </>}Online payment isn’t open yet. Send an order request and the team confirms it with you on WhatsApp before you pay anything.</span></p>
          )}
          <div className="cs-tabs" id="catalogue-tabs" role="group" aria-label="Show packages by category">
            <button type="button" aria-pressed={category === ''} onClick={() => chooseCategory('')}>All<span>{CREATIVE_PACKAGES.length}</span></button>
            {CREATIVE_CATEGORIES.map(c => (
              <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => chooseCategory(c.id)}>{c.tab}<span>{creativePackagesIn(c.id).length}</span></button>
            ))}
          </div>
          <div id="catalogue-grid" className="cs-catalogue">
            {shown.map(c => {
              // The heading fills whatever the cards leave of the last row, so every row ends flush at 3 and 4 columns.
              const count = creativePackagesIn(c.id).length;
              const span = (columns: number) => columns - (count % columns) || columns;
              return (
                <section key={c.id} className="cs-group-block" aria-labelledby={`cs-cat-${c.id}`} style={{ '--cs-span3': span(3), '--cs-span4': span(4) } as React.CSSProperties}>
                  <div className="cs-group-head" data-row3={span(3) === 3 || undefined} data-row4={span(4) === 4 || undefined}>
                    <h3 id={`cs-cat-${c.id}`}>{c.name}</h3>
                    <p>{c.line}</p>
                    <ul className="cs-group-uses" aria-label={`${c.name} is good for`}>
                      {[...new Set(creativePackagesIn(c.id).flatMap(pkg => pkg.goodFor))].slice(0, 6).map(use => <li key={use}>{use}</li>)}
                    </ul>
                    <span className="cs-group-from"><small>From</small>{creativeCedis(creativeFromPrice(c.id))}</span>
                  </div>
                  <ul className="cs-cards" role="list">
                    {creativePackagesIn(c.id).map((pkg, i) => <PackageCard key={pkg.id} pkg={pkg} index={i} onOpen={openPackage} />)}
                  </ul>
                </section>
              );
            })}
          </div>

          <ol className="cs-flow" aria-label="How ordering works">
            <li><strong>Choose a package</strong><span>See the price, files, timing and changes before you commit.</span></li>
            <li><strong>Send your details</strong><span>The wording and a few answers. It takes about two minutes.</span></li>
            <li><strong>We confirm and design</strong><span>The team confirms on WhatsApp, then designs and checks your work.</span></li>
            <li><strong>Review and receive</strong><span>Ask for changes within your rounds, then get your final files.</span></li>
          </ol>
        </div>
      </section>

      {/* Portfolio: the three Studio Concepts, one at a time. */}
      <section className="cs-section" id="work" aria-labelledby="cs-work-title">
        <div className="cs-wrap">
          <div className="cs-head">
            <div><p className="cs-eyebrow">Selected work</p><h2 className="cs-h2" id="cs-work-title">Three brands, <span className="cs-serif">start to finish.</span></h2></div>
            <p className="cs-lead">Harmattan Table, Indigo Hour and Lonzero are fictional brands we created to show our range. They are not client projects.</p>
          </div>
          <div className="cs-projects-tabs" role="tablist" aria-label="Studio Concepts">
            {CREATIVE_PROJECTS.map((p, i) => (
              <button key={p.id} id={`cs-tab-${p.id}`} type="button" role="tab" aria-selected={p.id === projectId} aria-controls={`cs-panel-${p.id}`} tabIndex={p.id === projectId ? 0 : -1}
                onClick={() => setProjectId(p.id)} onKeyDown={e => tabKeys(e, i)}>
                <img src={getCloudinaryUrl(p.pieces[0].src, { width: 112, height: 112, crop: 'fill' })} alt="" width={56} height={56} loading="lazy" decoding="async" />
                <span><strong>{p.name}</strong><small>{p.sector}</small></span>
              </button>
            ))}
          </div>
          <ProjectPanel key={project.id} project={project} onView={index => setViewing({ list: project.pieces, index })} onOrder={openPackage} />
        </div>
        <WorkViewer viewing={viewing} onClose={() => setViewing(null)} onMove={step => setViewing(v => v && { ...v, index: (v.index + step + v.list.length) % v.list.length })}
          onOrder={work => openPackage(packageForWork(work))} />
      </section>

      {/* Custom projects and answers: the quoted path, and everything else in one place. */}
      <section className="cs-section cs-section-last" id="custom" aria-labelledby="cs-custom-title">
        <div className="cs-wrap cs-end-grid">
          <div className="cs-custom">
            <p className="cs-eyebrow">Custom project</p>
            <h2 className="cs-h2" id="cs-custom-title">Something <span className="cs-serif">bigger?</span></h2>
            <p>Brochures, signage, event branding, or several pieces at once. Tell us about it and the team sends a quote before any work starts.</p>
            <div className="cs-custom-actions">
              <a className="cs-btn cs-btn-primary" href="/creative-studio?brief=custom" onClick={e => { if (!isPlainClick(e)) return; e.preventDefault(); openCustom(); }}>Start a custom brief<ArrowRight size={18} aria-hidden /></a>
              <a className="cs-btn cs-btn-ghost" href={`${contact.supportWhatsAppUrl}?text=${encodeURIComponent('Hello Mystery Hub, I have a question about Creative Studio.')}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden />WhatsApp us<span className="sr-only"> (opens WhatsApp)</span></a>
            </div>
            <p className="cs-custom-help"><Phone size={15} aria-hidden /><span>Questions? Call <a href={contact.phoneLink}>{contact.supportPhone}</a>, {contact.supportHours}.</span></p>
            <div className="cs-diy">
              <p>Prefer to do it yourself?</p>
              <a href="/website-builder" onClick={go('website')}><Globe size={16} aria-hidden />Website Builder</a>
              <a href={workspacePath('promote')} onClick={openPromote}><Megaphone size={16} aria-hidden />Promotion Kit for Data Store owners</a>
            </div>
          </div>
          <div className="cs-faq">
            <h2 className="cs-faq-title">Good to know</h2>
            {FAQ.map(item => (
              <details key={item.q}>
                <summary>{item.q}<ChevronDown size={18} aria-hidden /></summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <CreativeSheet state={sheet} onClose={closeSheet} customService={customService} onCustomService={id => { setCustomService(id); track(id); }} />
    </div>
  );
};
