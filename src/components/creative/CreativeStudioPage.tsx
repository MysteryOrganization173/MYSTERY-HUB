import React, { useCallback, useEffect, useRef, useState } from 'react';
import './creativeStudio.css';
import { ArrowRight, BadgeCheck, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Globe, Info, Megaphone, MessageCircle, Phone, ShieldCheck, UserRound, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';
import { getCloudinarySrcSet, getCloudinaryUrl } from '../../utils/cloudinary';
import { trackGrowth } from '../../utils/growthAnalytics';
import { workspacePath } from '../../utils/businessWorkspace';
import { CREATIVE_SERVICES, creativeService, type CreativeServiceId } from '../../../shared/creativeStudio';
import { CREATIVE_WORK, CREATIVE_WORK_OWNER_LABEL, type CreativeWork } from '../../data/creativeStudioWork';
import { CreativeBriefForm } from './CreativeBriefForm';

const isPlainClick = (e: React.MouseEvent) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);
const serviceFromUrl = (): CreativeServiceId | '' => {
  if (typeof window === 'undefined') return '';
  const id = new URLSearchParams(window.location.search).get('service');
  return creativeService(id)?.id || '';
};
/** The editorial serif is only needed here, so it is requested when Creative Studio first opens (Georgia until then). */
const SERIF_HREF = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,500;1,9..144,600&display=swap';
function useSerifFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${SERIF_HREF}"]`)) return;
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = SERIF_HREF; document.head.appendChild(link);
  }, []);
}
const HERO = { banner: CREATIVE_WORK.find(w => w.id === 'earn-launch')!, portrait: CREATIVE_WORK.find(w => w.id === 'earn-portrait')!, mark: CREATIVE_WORK.find(w => w.id === 'ai-mark')! };

function WorkImage({ work, sizes, widths, eager, crop }: { work: CreativeWork; sizes: string; widths: number[]; eager?: boolean; crop?: boolean }) {
  return (
    <img src={getCloudinaryUrl(work.src, { width: widths[1] || widths[0], crop: crop ? 'limit' : undefined })} srcSet={getCloudinarySrcSet(work.src, widths)} sizes={sizes}
      width={work.width} height={work.height} alt={work.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager ? 'high' : undefined} />
  );
}

/** Full-screen viewer for one work sample, with previous/next. Native <dialog>: Escape closes, focus stays inside. */
function WorkViewer({ index, onClose, onMove }: { index: number | null; onClose: () => void; onMove: (step: number) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current; if (!dialog) return;
    if (index !== null && !dialog.open) dialog.showModal();
    if (index === null && dialog.open) dialog.close();
  }, [index]);
  const work = index === null ? null : CREATIVE_WORK[index];
  return (
    <dialog ref={ref} className="cs-lightbox" aria-label={work ? `${work.title}, enlarged` : 'Work sample'} onClose={onClose}
      onKeyDown={e => { if (e.key === 'ArrowRight') onMove(1); if (e.key === 'ArrowLeft') onMove(-1); }}
      onClick={e => { if (e.target === ref.current) onClose(); }}>
      {work && (
        <div className="cs-lightbox-inner">
          <div className="cs-lightbox-bar">
            <p>{index! + 1} of {CREATIVE_WORK.length} · {CREATIVE_WORK_OWNER_LABEL[work.owner]}</p>
            <button type="button" className="cs-icon-btn" onClick={onClose} aria-label="Close"><X size={20} aria-hidden /></button>
          </div>
          <figure>
            <img src={getCloudinaryUrl(work.src, { width: 1600, crop: 'limit' })} width={work.width} height={work.height} alt={work.alt} decoding="async" />
          </figure>
          <figcaption>
            <span><strong>{work.title}</strong><br /><span>{work.kind} · {work.note}</span></span>
            <span className="cs-lightbox-nav">
              <button type="button" className="cs-icon-btn" onClick={() => onMove(-1)} aria-label="Previous sample"><ChevronLeft size={20} aria-hidden /></button>
              <button type="button" className="cs-icon-btn" onClick={() => onMove(1)} aria-label="Next sample"><ChevronRight size={20} aria-hidden /></button>
            </span>
          </figcaption>
        </div>
      )}
    </dialog>
  );
}

/**
 * Mystery Creative Studio (/creative-studio): design services on quote, part of the Marketplace family.
 * Discover → explore services → see work → choose a service → send a brief → saved reference → the team follows up.
 */
export const CreativeStudioPage: React.FC = () => {
  const { setActivePage } = useApp();
  useSerifFont();
  const [service, setService] = useState<CreativeServiceId | ''>(serviceFromUrl);
  const [viewing, setViewing] = useState<number | null>(null);
  const tracked = useRef(new Set<string>());

  const chooseService = useCallback((id: CreativeServiceId, scroll = false) => {
    setService(id);
    const url = new URL(window.location.href); url.searchParams.set('service', id);
    window.history.replaceState({ ...(window.history.state || {}), page: 'creative' }, '', `${url.pathname}${url.search}`);
    if (!tracked.current.has(id)) { tracked.current.add(id); trackGrowth('creative_service', { page: 'creative' }); }
    if (scroll) {
      const brief = document.getElementById('brief');
      brief?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      window.setTimeout(() => document.querySelector<HTMLInputElement>(`input[name="cs-service"][value="${id}"]`)?.focus({ preventScroll: true }), 450);
    }
  }, []);

  // A shared link (/creative-studio?service=logo) opens with that service chosen, at the brief.
  useEffect(() => {
    const initial = serviceFromUrl();
    if (initial) requestAnimationFrame(() => document.getElementById('brief')?.scrollIntoView({ block: 'start' }));
  }, []);

  const jump = (id: string) => (e: React.MouseEvent) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };
  const go = (page: 'marketplace' | 'website') => (e: React.MouseEvent) => { if (!isPlainClick(e)) return; e.preventDefault(); setActivePage(page); };
  const openPromote = (e: React.MouseEvent) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    window.history.pushState({ page: 'business' }, '', workspacePath('promote'));
    setActivePage('business', false);
  };
  const move = (step: number) => setViewing(i => i === null ? i : (i + step + CREATIVE_WORK.length) % CREATIVE_WORK.length);
  const { contact } = BUSINESS_CONFIG;

  return (
    <div className="cs-page">
      <section className="cs-hero" aria-labelledby="cs-title">
        <div className="cs-wrap">
          <nav aria-label="Breadcrumb">
            <ol className="cs-crumbs" style={{ listStyle: 'none', padding: 0 }}>
              <li><a href="/marketplace" onClick={go('marketplace')}>Marketplace</a></li>
              <li aria-hidden="true">/</li>
              <li><span aria-current="page">Creative Studio</span></li>
            </ol>
          </nav>
          <div className="cs-hero-grid">
            <div className="cs-hero-copy">
              <p className="cs-eyebrow">Mystery Creative Studio</p>
              <h1 id="cs-title">Design that gets your message <span className="cs-serif">seen.</span></h1>
              <p>Flyers, posters, logos, social media graphics and banners, designed by the Mystery Hub team. Tell us what you need, get a quote, and decide before any work starts.</p>
              <div className="cs-hero-actions">
                <a className="cs-btn cs-btn-primary" href="#brief" onClick={jump('brief')}>Request a design<ArrowRight size={18} aria-hidden /></a>
                <a className="cs-btn cs-btn-ghost" href="#work" onClick={jump('work')}>See our work</a>
              </div>
              <ul className="cs-facts" aria-label="How Creative Studio works">
                <li><BadgeCheck size={17} aria-hidden />Quoted per project</li>
                <li><UserRound size={17} aria-hidden />No account needed</li>
                <li><MessageCircle size={17} aria-hidden />Follow-up on WhatsApp or phone</li>
              </ul>
            </div>
            <div className="cs-stack">
              <figure className="cs-stack-a"><WorkImage work={HERO.banner} widths={[480, 720]} sizes="(min-width: 960px) 320px, 62vw" eager /></figure>
              <figure className="cs-stack-b"><WorkImage work={HERO.portrait} widths={[320, 480]} sizes="(min-width: 960px) 240px, 46vw" eager /></figure>
              <figure className="cs-stack-c"><WorkImage work={HERO.mark} widths={[320, 480]} sizes="(min-width: 960px) 230px, 44vw" /></figure>
              <p className="cs-stack-note">Mystery Hub’s own artwork</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cs-section" id="services" aria-labelledby="cs-services-title">
        <div className="cs-wrap">
          <div className="cs-section-head">
            <div><p className="cs-eyebrow">Services</p><h2 className="cs-h2" id="cs-services-title">Four things we <span className="cs-serif">design</span> for you</h2></div>
            <p className="cs-lead">Each one is quoted after we read your brief, because the price depends on how much you need and how soon.</p>
          </div>
          <ul className="cs-services">
            {CREATIVE_SERVICES.map((s, i) => (
              <li key={s.id} className="cs-service" data-selected={service === s.id}>
                <div className="cs-service-top">
                  <span className="cs-service-num" aria-hidden="true">0{i + 1}</span>
                  <div><h3>{s.name}</h3><p className="cs-service-short">{s.short}</p></div>
                </div>
                <ul className="cs-uses" aria-label={`Good for, ${s.name}`}>{s.uses.map(u => <li key={u}>{u}</li>)}</ul>
                <details>
                  <summary>What you can ask for<ChevronDown size={18} aria-hidden /></summary>
                  <p>{s.summary}</p>
                  <ul>{s.options.map(o => <li key={o}>{o}</li>)}</ul>
                  <p>Exact files, sizes and the number of changes are agreed in your quote.</p>
                </details>
                <div className="cs-service-foot">
                  <span className="cs-price"><strong>Price:</strong> quoted for your project</span>
                  <button type="button" className="cs-btn cs-btn-primary" onClick={() => chooseService(s.id, true)} aria-label={`Request ${s.name.toLowerCase()}`}>{service === s.id ? 'Chosen, go to brief' : 'Request this'}<ArrowRight size={16} aria-hidden /></button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="cs-section" id="work" aria-labelledby="cs-work-title">
        <div className="cs-wrap">
          <div className="cs-section-head">
            <div><p className="cs-eyebrow">Work</p><h2 className="cs-h2" id="cs-work-title">Made for <span className="cs-serif">Mystery Hub</span></h2></div>
            <p className="cs-lead">Logos, campaign graphics and banners we use for our own brand and launches.</p>
          </div>
          <p className="cs-work-note"><Info size={18} aria-hidden /><span>These pieces were made for Mystery Hub itself, and most were created with AI image tools. They are not client projects, and no client work is shown yet. Client work will appear here only when the client agrees to share it.</span></p>
          <ul className="cs-work">
            {CREATIVE_WORK.map((work, i) => (
              <li key={work.id}>
                <button type="button" onClick={() => setViewing(i)} aria-label={`Enlarge ${work.title}`}>
                  <WorkImage work={work} widths={[400, 640, 900]} sizes="(min-width: 1000px) 370px, (min-width: 520px) 46vw, 92vw" />
                  <span className="cs-badge">{CREATIVE_WORK_OWNER_LABEL[work.owner]}</span>
                  <span className="cs-work-meta"><strong>{work.title}</strong><span>{work.kind}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <WorkViewer index={viewing} onClose={() => setViewing(null)} onMove={move} />
      </section>

      <section className="cs-section" id="process" aria-labelledby="cs-process-title">
        <div className="cs-wrap">
          <div className="cs-section-head">
            <div><p className="cs-eyebrow">How it works</p><h2 className="cs-h2" id="cs-process-title">From brief to <span className="cs-serif">finished design</span></h2></div>
            <p className="cs-lead">You always see the price before anything starts.</p>
          </div>
          <ol className="cs-steps">
            <li><h3>Send a short brief</h3><p>Choose a service and tell us what you need. It takes about two minutes. No account or payment needed.</p></li>
            <li><h3>We confirm the details</h3><p>The team reads your brief and contacts you on WhatsApp or by phone to agree exactly what you will receive.</p></li>
            <li><h3>You get a quote</h3><p>You see the price and timing first. Sending a brief is free and does not commit you.</p></li>
            <li><h3>Design and delivery</h3><p>Work starts only after you accept the quote. Changes and final files follow what you agreed.</p></li>
          </ol>
          <div className="cs-know">
            <div><h3>Prices</h3><p>Every project is quoted, because a single flyer and a full brand set are very different jobs. Your quote shows the full price before you decide.</p></div>
            <div><h3>Timing and changes</h3><p>How long it takes and how many rounds of changes you get are agreed in your quote, before work starts.</p></div>
            <div><h3>Who designs it</h3><p>The Mystery Hub team prepares your design and may use digital and AI-assisted tools. A person on the team checks every design before you see it.</p></div>
          </div>
        </div>
      </section>

      <section className="cs-brief-section" id="brief" aria-labelledby="cs-brief-title">
        <div className="cs-wrap cs-brief-grid">
          <div className="cs-brief-intro">
            <p className="cs-eyebrow">Your brief</p>
            <h2 className="cs-h2" id="cs-brief-title">Tell us what you <span className="cs-serif">need</span></h2>
            <p className="cs-lead">A few details are enough. We ask for anything else when we contact you.</p>
            <ul>
              <li><ClipboardList size={18} aria-hidden />You get a reference as soon as your brief is saved.</li>
              <li><MessageCircle size={18} aria-hidden />We contact you on the number you give to agree the details.</li>
              <li><ShieldCheck size={18} aria-hidden />Nothing is charged until you accept a quote.</li>
            </ul>
          </div>
          <CreativeBriefForm service={service} onService={id => chooseService(id)} />
        </div>
      </section>

      <section className="cs-section" aria-labelledby="cs-diy-title">
        <div className="cs-wrap">
          <div className="cs-section-head">
            <div><p className="cs-eyebrow">Prefer to do it yourself?</p><h2 className="cs-h2" id="cs-diy-title">Free tools already in <span className="cs-serif">Mystery Hub</span></h2></div>
            <p className="cs-lead">These are self-service tools you use on your own. Creative Studio is for designs the team makes for you.</p>
          </div>
          <div className="cs-diy">
            <a href="/website-builder" onClick={go('website')}>
              <span className="cs-diy-icon"><Globe size={22} aria-hidden /></span>
              <span><strong>Website Builder</strong><p>Choose a design, add your details and photos, and publish a free business website yourself.</p><em>Build a website<ArrowRight size={15} aria-hidden /></em></span>
            </a>
            <a href={workspacePath('promote')} onClick={openPromote}>
              <span className="cs-diy-icon"><Megaphone size={22} aria-hidden /></span>
              <span><strong>Promotion Kit, for Data Store owners</strong><p>If you run a Mystery Hub Data Store, ready-made adverts with your published bundles and prices are in My Business, under Promote.</p><em>Open Promote<ArrowRight size={15} aria-hidden /></em></span>
            </a>
          </div>
          <div className="cs-contact">
            <div><h3>Questions before you send a brief?</h3><p>Talk to Mystery Hub support. {contact.supportHours}.</p></div>
            <div className="cs-contact-actions">
              <a className="cs-btn cs-btn-primary" href={`${contact.supportWhatsAppUrl}?text=${encodeURIComponent('Hello Mystery Hub, I have a question about Creative Studio.')}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden />WhatsApp us<span className="sr-only"> (opens WhatsApp)</span></a>
              <a className="cs-btn cs-btn-ghost" href={contact.phoneLink}><Phone size={18} aria-hidden />Call {contact.supportPhone}</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
