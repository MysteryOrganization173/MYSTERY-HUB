import React from 'react';
import { useApp } from '../../context/AppContext';
import { DIGITAL_SERVICES } from '../../data/services';
import { ArrowRight, Plus } from 'lucide-react';

export const HomeComingSoonSection: React.FC = () => {
  const { setActivePage, openWaitlist } = useApp();
  const futureServices = DIGITAL_SERVICES.filter(s => s.status === 'coming_soon').slice(0, 4);
  return (
    <section className="home-container home-future" aria-labelledby="future-heading">
      <div className="home-section-heading"><div><p className="home-eyebrow">More Services Are Coming</p><h2 id="future-heading">A growing world of services</h2><p>These services are not available yet. Join a launch list if you would like availability updates.</p></div><button onClick={() => setActivePage('services')} className="home-text-action">See What’s Coming<ArrowRight className="w-4 h-4" /></button></div>
      <div className="home-future-list">{futureServices.map(svc => (
        <button key={svc.id} onClick={() => openWaitlist(svc.title)} className="home-future-item" aria-label={`Join launch list for ${svc.title} — Coming Soon`}>
          <span><span className="home-future-category">{svc.category} · Coming Soon</span><strong>{svc.title}</strong></span><Plus className="w-5 h-5 shrink-0" />
        </button>
      ))}</div>
    </section>
  );
};
