import React from 'react';
import { useApp } from '../../context/AppContext';
import { DIGITAL_SERVICES } from '../../data/services';
import { ArrowRight, Plus } from 'lucide-react';

export const HomeComingSoonSection: React.FC = () => {
  const { setActivePage, openWaitlist } = useApp();
  const futureServices = DIGITAL_SERVICES.filter(s => s.status === 'coming_soon');
  return (
    <section className="home-container home-future" aria-labelledby="future-heading">
      <div className="home-future-panel">
        <div className="home-future-intro">
          <p className="home-future-badge">Coming Soon · Not available yet</p>
          <h2 id="future-heading">More services are on the way</h2>
          <p>Join a launch list if you would like availability updates.</p>
          <button type="button" onClick={() => setActivePage('services')} className="home-text-action">See What’s Coming<ArrowRight className="w-4 h-4" /></button>
        </div>
        <ul className="home-future-list">{futureServices.map(svc => (
          <li key={svc.id}><button type="button" onClick={() => openWaitlist(svc.title)} className="home-future-item" aria-label={`Join launch list for ${svc.title} — Coming Soon`}>
            <span>{svc.title}</span><Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button></li>
        ))}</ul>
      </div>
    </section>
  );
};
