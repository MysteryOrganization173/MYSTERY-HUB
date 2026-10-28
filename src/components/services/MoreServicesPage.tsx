import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './services.css';
import { ArrowRight, Search, X } from 'lucide-react';
import { getAfaConfig } from '../../services/afaApi';
import { useApp } from '../../context/AppContext';
import { DIGITAL_SERVICES } from '../../data/services';
import type { DigitalService } from '../../types';
import {
  SERVICES_URL_EVENT,
  filterServices,
  findServiceBySlug,
  isUpcoming,
  readServicesUrl,
  serviceActionLabel,
  serviceAvailability,
  serviceCategories,
  serviceHref,
  serviceSlug,
  serviceStatusLabel,
  servicesHref,
  type AfaAvailability,
  type ServiceAvailability,
} from '../../utils/serviceDirectory';
import { SERVICE_PREVIEWS } from '../../data/servicePreviews';
import { ServicePreview } from './ServicePreview';
import { ServiceIcon, ServiceVisual, accentStyle } from './ServiceVisual';

/** The everyday purchases and the free website lead "Available now". */
const FEATURED = new Set(['srv-data', 'srv-airtime', 'srv-website']);
const NETWORKS = ['MTN', 'Telecel', 'AirtelTigo'];
const CATEGORIES = serviceCategories(DIGITAL_SERVICES);
const isPlainClick = (e: React.MouseEvent) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);

const StatusBadge: React.FC<{ service: DigitalService; availability: ServiceAvailability }> = ({ service, availability }) => (
  <span className={`sd-badge sd-badge-${availability}`}>{serviceStatusLabel(service, availability)}</span>
);

/**
 * All Services (/services): a static directory of what customers can use today and what is planned.
 * State lives in the address (?q=&category= for the directory, ?service=<slug> for a preview), so Back, refresh and
 * shared links all work without a router. The only request is the public AFA availability check.
 */
export const MoreServicesPage: React.FC = () => {
  const { setActivePage, openDataPage, openWaitlist, user } = useApp();
  const initial = useMemo(() => readServicesUrl(typeof window === 'undefined' ? '' : window.location.search, DIGITAL_SERVICES), []);
  const [query, setQuery] = useState(initial.q);
  const [category, setCategory] = useState(initial.category);
  const [previewSlug, setPreviewSlug] = useState(initial.service);
  const [afa, setAfa] = useState<AfaAvailability>('checking');
  const listScroll = useRef(0);
  const returnFocus = useRef('');

  useEffect(() => {
    let active = true;
    getAfaConfig().then(config => { if (active) setAfa(config.available ? 'available' : 'unavailable'); }).catch(() => { if (active) setAfa('unavailable'); });
    return () => { active = false; };
  }, []);

  // Back/forward and links from other pages move between the directory and a preview.
  useEffect(() => {
    const sync = () => {
      if (window.location.pathname.replace(/\/+$/, '').toLowerCase() !== '/services') return;
      const next = readServicesUrl(window.location.search, DIGITAL_SERVICES);
      setQuery(next.q); setCategory(next.category); setPreviewSlug(next.service);
    };
    window.addEventListener('popstate', sync);
    window.addEventListener(SERVICES_URL_EVENT, sync);
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener(SERVICES_URL_EVENT, sync); };
  }, []);

  // The directory's search and category stay in the address (replaced, not pushed, so Back is not flooded).
  useEffect(() => {
    if (previewSlug) return;
    const timer = window.setTimeout(() => {
      const href = servicesHref({ q: query, category });
      if (`${window.location.pathname}${window.location.search}` !== href) window.history.replaceState({ ...(window.history.state || {}), page: 'services' }, '', href);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, category, previewSlug]);

  // Returning from a preview restores the list where the customer left it.
  useEffect(() => {
    if (previewSlug) { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); return; }
    if (!returnFocus.current) return;
    const id = returnFocus.current; returnFocus.current = '';
    requestAnimationFrame(() => {
      window.scrollTo({ top: listScroll.current, behavior: 'instant' as ScrollBehavior });
      document.querySelector<HTMLElement>(`[data-service-id="${id}"]`)?.focus({ preventScroll: true });
    });
  }, [previewSlug]);

  const availabilityOf = useCallback((service: DigitalService) => serviceAvailability(service, afa), [afa]);

  const openService = useCallback((service: DigitalService, event?: React.MouseEvent) => {
    if (event && !isPlainClick(event)) return; // let the browser open the link in a new tab
    event?.preventDefault();
    if (isUpcoming(service)) {
      if (!previewSlug) { listScroll.current = window.scrollY; returnFocus.current = service.id; }
      // servicePreview counts the previews pushed since the list, so "All services" can step straight back to it.
      const depth = previewSlug ? Number(window.history.state?.servicePreview) || 0 : 0;
      window.history.pushState({ page: 'services', servicePreview: depth + 1 }, '', servicesHref({ service: serviceSlug(service) }));
      setPreviewSlug(serviceSlug(service));
      return;
    }
    if (service.dataMode) openDataPage(service.dataMode);
    else if (service.targetPage) setActivePage(service.targetPage);
  }, [openDataPage, setActivePage, previewSlug]);

  const closePreview = useCallback(() => {
    // Opened from this list: step back through history. Arrived by a link: replace the preview with the list.
    const depth = Number(window.history.state?.servicePreview) || 0;
    if (depth > 0) { window.history.go(-depth); return; }
    window.history.replaceState({ page: 'services' }, '', servicesHref({ q: query, category }));
    setPreviewSlug('');
  }, [query, category]);

  const live = DIGITAL_SERVICES.filter(s => !isUpcoming(s));
  const upcoming = DIGITAL_SERVICES.filter(isUpcoming);

  if (previewSlug) {
    const service = findServiceBySlug(DIGITAL_SERVICES, previewSlug);
    return (
      <div className="sd-page">
        <div className="sd-inner">
          <ServicePreview
            key={previewSlug}
            service={service}
            availability={service ? availabilityOf(service) : 'coming_soon'}
            liveServices={live.filter(s => availabilityOf(s) === 'available').slice(0, 4)}
            upcomingServices={upcoming}
            onBack={closePreview}
            onOpen={(s, e) => openService(s, e)}
            onNotify={s => openWaitlist(s.title)}
          />
        </div>
      </div>
    );
  }

  const matches = filterServices(DIGITAL_SERVICES, { category, q: query });
  const usable = matches.filter(s => ['available', 'checking'].includes(availabilityOf(s)));
  const featured = usable.filter(s => FEATURED.has(s.id));
  const standard = usable.filter(s => !FEATURED.has(s.id));
  const paused = matches.filter(s => availabilityOf(s) === 'unavailable');
  const soon = matches.filter(isUpcoming);
  const filtering = Boolean(query.trim()) || category !== 'all';
  const reset = () => { setQuery(''); setCategory('all'); };

  const card = (service: DigitalService) => {
    const availability = availabilityOf(service);
    const isFeatured = FEATURED.has(service.id);
    return (
      <a
        key={service.id}
        data-service-id={service.id}
        href={serviceHref(service)}
        onClick={e => openService(service, e)}
        className={`sd-card${isFeatured ? ' sd-card-featured' : ''}${service.tagline ? ' sd-card-tile' : ''}${service.id === 'srv-data' ? ' sd-card-primary' : ''}`}
        style={accentStyle(service)}
      >
        <span className="sd-icon"><ServiceIcon service={service} size={isFeatured ? 24 : 22} /></span>
        <div className="sd-card-top"><h3>{service.title}</h3><StatusBadge service={service} availability={availability} /></div>
        <span className="sd-card-desc">{service.description}</span>
        {service.tagline && <span className="sd-card-tagline">{service.tagline}</span>}
        {service.dataMode && <span className="sd-networks" aria-label="Networks">{NETWORKS.map(n => <span key={n}>{n}</span>)}</span>}
        <span className="sd-card-foot" style={{ gridColumn: '1 / -1' }}>
          <span className="sd-card-action">{serviceActionLabel(service, availability)}<ArrowRight size={16} aria-hidden /></span>
          {service.id === 'srv-wallet' && !user && <span className="sd-card-meta">Sign in to use</span>}
        </span>
      </a>
    );
  };

  return (
    <div className="sd-page">
      <div className="sd-inner">
        <header className="sd-intro">
          <div className="sd-intro-copy">
            <p className="sd-eyebrow">All services</p>
            <h1>Explore Mystery Hub</h1>
            <p>Find the digital services you need, all in one place.</p>
          </div>
          <form role="search" className="sd-search" onSubmit={e => { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); }}>
            <Search size={18} aria-hidden />
            <label htmlFor="sd-search-input" className="sd-sr">Search services</label>
            <input
              id="sd-search-input"
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value.slice(0, 80))}
              onKeyDown={e => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); } }}
              placeholder="Search data, ECG, TV…"
              autoComplete="off"
              enterKeyHint="search"
            />
            {query && <button type="button" className="sd-search-clear mh-compact-control" onClick={() => { setQuery(''); document.getElementById('sd-search-input')?.focus(); }} aria-label="Clear search"><X size={18} aria-hidden /></button>}
          </form>
          <div className="sd-chips" role="group" aria-label="Filter by category">
            <button type="button" className="sd-chip" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>All<span className="sd-chip-count">{DIGITAL_SERVICES.length}</span></button>
            {CATEGORIES.map(c => (
              <button key={c.slug} type="button" className="sd-chip" aria-pressed={category === c.slug} onClick={() => setCategory(category === c.slug ? 'all' : c.slug)}>
                {c.label}<span className="sd-chip-count">{c.count}</span>
              </button>
            ))}
          </div>
          <p className={filtering ? 'sd-results' : 'sd-sr'} role="status" aria-live="polite">
            {filtering ? `${matches.length} ${matches.length === 1 ? 'service' : 'services'}${query.trim() ? ` for “${query.trim()}”` : ''}` : ''}
          </p>
        </header>

        {matches.length === 0 ? (
          <div className="sd-empty">
            <Search size={28} aria-hidden className="text-slate-500" />
            <h2>No services match{query.trim() ? ` “${query.trim()}”` : ' this filter'}</h2>
            <p>Try another word, such as data, airtime, website or electricity, or browse everything.</p>
            <div className="sd-empty-links">
              <button type="button" className="mh-button" onClick={reset}>Show all services</button>
              <button type="button" className="mh-button-secondary" onClick={() => setActivePage('help')}>Help &amp; FAQs</button>
            </div>
          </div>
        ) : <>
          {(usable.length > 0 || paused.length > 0) && (
            <section className="sd-section" aria-labelledby="sd-available">
              <div className="sd-section-head">
                <h2 id="sd-available">Available now<span className="sd-count">{usable.length}</span></h2>
                <p>Ready to use today</p>
              </div>
              {featured.length > 0 && <div className="sd-grid sd-featured">{featured.map(card)}</div>}
              {standard.length > 0 && <div className="sd-grid">{standard.map(card)}</div>}
              {paused.map(service => (
                <a key={service.id} data-service-id={service.id} href={serviceHref(service)} onClick={e => openService(service, e)} className="sd-paused" style={accentStyle(service)}>
                  <span className="sd-icon"><ServiceIcon service={service} /></span>
                  <p><strong>{service.title}</strong> is paused right now. Check its page for the latest status.</p>
                  <StatusBadge service={service} availability="unavailable" />
                </a>
              ))}
            </section>
          )}

          {soon.length > 0 && (
            <section className="sd-section" aria-labelledby="sd-soon">
              <div className="sd-section-head">
                <h2 id="sd-soon">Coming soon<span className="sd-count">{soon.length}</span></h2>
                <p>Not available yet. Open one to see what’s planned.</p>
              </div>
              <div className="sd-soon-grid">
                {soon.map(service => (
                  <a key={service.id} data-service-id={service.id} href={serviceHref(service)} onClick={e => openService(service, e)} className="sd-soon" style={accentStyle(service)}>
                    <ServiceVisual service={service} sizes="(min-width: 1024px) 280px, (min-width: 480px) 50vw, 88px" />
                    <div className="sd-soon-body">
                      <StatusBadge service={service} availability="coming_soon" />
                      <h3>{service.title}</h3>
                      <p>{SERVICE_PREVIEWS[service.id]?.intro || service.description}</p>
                      <span className="sd-card-action">Preview<ArrowRight size={15} aria-hidden /></span>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}
        </>}

        <div className="sd-help">
          <p><strong>Can’t find what you need?</strong>Our Help Centre answers common questions about payments, orders and services.</p>
          <button type="button" className="mh-button-secondary" onClick={() => setActivePage('help')}>Help &amp; FAQs</button>
        </div>
      </div>
    </div>
  );
};
