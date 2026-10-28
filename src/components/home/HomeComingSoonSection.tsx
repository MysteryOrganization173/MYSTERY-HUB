import React from 'react';
import { useApp } from '../../context/AppContext';
import { DIGITAL_SERVICES } from '../../data/services';
import { openServicesAt, serviceSlug, servicesHref } from '../../utils/serviceDirectory';
import { ArrowRight, ChevronRight } from 'lucide-react';

/** Planned services open their preview on All Services first; the launch list is offered there, never from here. */
export const HomeComingSoonSection: React.FC = () => {
  const { setActivePage } = useApp();
  const futureServices = DIGITAL_SERVICES.filter(s => s.status === 'coming_soon');
  const open = (e: React.MouseEvent, service = '') => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    openServicesAt(setActivePage, { service });
  };
  return (
    <section className="home-container home-future" aria-labelledby="future-heading">
      <div className="home-future-panel">
        <div className="home-future-intro">
          <p className="home-future-badge">Coming Soon · Not available yet</p>
          <h2 id="future-heading">More services are on the way</h2>
          <p>Open one to see what’s planned. Launch updates are optional.</p>
          <a href="/services" onClick={e => open(e)} className="home-text-action">See What’s Coming<ArrowRight className="w-4 h-4" /></a>
        </div>
        <ul className="home-future-list">{futureServices.map(svc => (
          <li key={svc.id}><a href={servicesHref({ service: serviceSlug(svc) })} onClick={e => open(e, serviceSlug(svc))} className="home-future-item" aria-label={`Preview ${svc.title} — Coming Soon`}>
            <span>{svc.title}</span><ChevronRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </a></li>
        ))}</ul>
      </div>
    </section>
  );
};
