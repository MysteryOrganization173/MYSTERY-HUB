import React, { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Bell, CheckCircle2, Info, Search } from 'lucide-react';
import type { DigitalService } from '../../types';
import { SERVICE_PREVIEWS } from '../../data/servicePreviews';
import { serviceActionLabel, serviceHref, serviceSlug, servicesHref, type ServiceAvailability } from '../../utils/serviceDirectory';
import { ServiceIcon, ServiceVisual, accentStyle } from './ServiceVisual';

interface PreviewProps {
  /** Undefined when the address names no known service. */
  service?: DigitalService;
  availability: ServiceAvailability;
  /** Services shown under "Explore other services". */
  liveServices: DigitalService[];
  upcomingServices: DigitalService[];
  onBack: () => void;
  onOpen: (service: DigitalService, event: React.MouseEvent) => void;
  onNotify: (service: DigitalService) => void;
}

const BackLink: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <a href="/services" onClick={e => { e.preventDefault(); onBack(); }} className="sd-back"><ArrowLeft size={18} aria-hidden />All services</a>
);

/**
 * One reusable preview for every planned service, driven by data/servicePreviews.ts.
 * The waitlist only opens from the explicit "Notify me" button; nothing here takes a payment or an order.
 */
export const ServicePreview: React.FC<PreviewProps> = ({ service, availability, liveServices, upcomingServices, onBack, onOpen, onNotify }) => {
  const heading = useRef<HTMLHeadingElement>(null);
  const content = service ? SERVICE_PREVIEWS[service.id] : undefined;

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    const previous = document.title;
    document.title = service ? `${service.title}${availability === 'coming_soon' ? ' (coming soon)' : ''} — Mystery Hub` : 'Service not found — Mystery Hub';
    return () => { document.title = previous; };
  }, [service, availability]);

  // Unknown address: say so and offer the directory, never fall back to the homepage.
  if (!service) {
    return (
      <div className="sd-preview">
        <BackLink onBack={onBack} />
        <div className="sd-empty">
          <Search size={28} aria-hidden className="text-slate-500" />
          <h1 ref={heading} tabIndex={-1} className="sd-preview-missing">We couldn’t find that service</h1>
          <p>The link may be old or mistyped. Everything Mystery Hub offers, and what is coming next, is on All Services.</p>
          <a href="/services" onClick={e => { e.preventDefault(); onBack(); }} className="mh-button">See all services</a>
        </div>
      </div>
    );
  }

  // A live service has no preview: its own page is the experience. Direct links get a short pointer to it.
  if (availability !== 'coming_soon' || !content) {
    return (
      <div className="sd-preview" style={accentStyle(service)}>
        <BackLink onBack={onBack} />
        <div className="sd-panel">
          <div className="sd-preview-kicker"><span className="sd-icon"><ServiceIcon service={service} /></span><span>{service.category}</span></div>
          <h1 ref={heading} tabIndex={-1} className="sd-preview-title">{service.title}</h1>
          <p className="sd-card-desc">{service.description}</p>
          <a href={serviceHref(service)} onClick={e => onOpen(service, e)} className="mh-button justify-self-start">{serviceActionLabel(service, availability)}<ArrowRight size={16} aria-hidden /></a>
        </div>
      </div>
    );
  }

  const others = upcomingServices.filter(s => s.id !== service.id);
  return (
    <article className="sd-preview" style={accentStyle(service)} aria-labelledby="sd-preview-title">
      <BackLink onBack={onBack} />

      <header className="sd-preview-hero">
        <ServiceVisual service={service} sizes="(min-width: 1024px) 560px, 100vw" priority alt={`Concept artwork for ${service.title}. Not a screenshot of a working service.`} />
        <div className="sd-preview-head">
          <div className="sd-preview-kicker"><span className="sd-badge sd-badge-coming_soon">Coming soon</span><span>{service.category}</span></div>
          <h1 id="sd-preview-title" ref={heading} tabIndex={-1}>{service.title}</h1>
          <p>{content.intro}</p>
        </div>
      </header>

      <p className="sd-notice" role="note"><Info size={18} aria-hidden /><span><strong>Not available yet.</strong> You can’t pay for or order this on Mystery Hub today. This page explains what is planned.</span></p>

      <div className="sd-preview-cols">
        <section className="sd-panel" aria-labelledby="sd-helps">
          <h2 id="sd-helps">What it’s meant to help with</h2>
          <ul className="sd-list">{content.helpsWith.map(line => <li key={line}><CheckCircle2 size={16} aria-hidden />{line}</li>)}</ul>
        </section>
        <section className="sd-panel" aria-labelledby="sd-planned">
          <h2 id="sd-planned">What we’re planning</h2>
          <ul className="sd-list">{content.planned.map(line => <li key={line}><ServiceIcon service={service} size={16} />{line}</li>)}</ul>
          <p className="sd-fine">Plans can change before launch. No launch date, prices or providers have been announced.</p>
        </section>
        <section className="sd-panel sd-journey" aria-labelledby="sd-journey">
          <h2 id="sd-journey">How it could work</h2>
          <ol>{content.journey.map(step => <li key={step}><span>{step}</span></li>)}</ol>
          <p className="sd-fine">An illustration of the planned steps, not a working form.</p>
        </section>
      </div>

      {content.note && <p className="sd-fine">{content.note}</p>}

      <section className="sd-notify" aria-labelledby="sd-notify">
        <h2 id="sd-notify">Want to know when it’s ready?</h2>
        <p>Optional: leave a phone number or email and the Mystery Hub team can tell you when {service.title} becomes available. It is saved for this service only.</p>
        <button type="button" className="mh-button" onClick={() => onNotify(service)}><Bell size={16} aria-hidden />Notify me when available</button>
      </section>

      <section className="sd-explore" aria-labelledby="sd-explore">
        <h2 id="sd-explore">Explore other services</h2>
        <h3>Available now</h3>
        <div className="sd-explore-links">
          {liveServices.map(s => (
            <a key={s.id} href={serviceHref(s)} onClick={e => onOpen(s, e)} style={accentStyle(s)}><ServiceIcon service={s} size={16} />{s.title}</a>
          ))}
        </div>
        {others.length > 0 && <>
          <h3>Also coming soon</h3>
          <div className="sd-explore-links">
            {others.map(s => (
              <a key={s.id} href={servicesHref({ service: serviceSlug(s) })} onClick={e => onOpen(s, e)} style={accentStyle(s)}><ServiceIcon service={s} size={16} />{s.title}</a>
            ))}
          </div>
        </>}
        <a href="/services" onClick={e => { e.preventDefault(); onBack(); }} className="sd-back">See all services<ArrowRight size={16} aria-hidden /></a>
      </section>
    </article>
  );
};
