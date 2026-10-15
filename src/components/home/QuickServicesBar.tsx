import React from 'react';
import { useApp } from '../../context/AppContext';
import { Wifi, Smartphone, Globe, Gift, ShieldCheck, Store, ArrowRight } from 'lucide-react';

type Service = { id: string; title: string; desc: string; icon: React.ComponentType<{ className?: string }>; action: () => void; tag: string; tone: 'live' | 'free' | 'neutral' };

/** One directory for everything customers can use today. Planned services live in HomeComingSoonSection. */
export const QuickServicesBar: React.FC = () => {
  const { setActivePage, openDataPage } = useApp();
  const services: Service[] = [
    { id: 'data', title: 'Data Bundles', desc: 'MTN, Telecel & AirtelTigo', icon: Wifi, action: () => openDataPage('data'), tag: 'Available', tone: 'live' },
    { id: 'airtime', title: 'Airtime Top-Up', desc: 'Top up any Ghana number', icon: Smartphone, action: () => openDataPage('airtime'), tag: 'Available', tone: 'live' },
    { id: 'website', title: 'Website Builder', desc: 'A website for your business', icon: Globe, action: () => setActivePage('website'), tag: 'Free plan', tone: 'free' },
    { id: 'earn', title: 'Mystery Earn', desc: 'Refer friends & earn', icon: Gift, action: () => setActivePage('earn'), tag: 'Available', tone: 'live' },
    { id: 'afa', title: 'AFA Registration', desc: 'MTN AFA bundles', icon: ShieldCheck, action: () => setActivePage('afa'), tag: 'Check Status', tone: 'neutral' },
    { id: 'marketplace', title: 'Marketplace', desc: 'Tech, by enquiry', icon: Store, action: () => setActivePage('marketplace'), tag: 'Enquiry', tone: 'neutral' },
  ];
  return (
    <section className="home-container home-everyday" aria-labelledby="everyday-heading">
      <div className="home-section-heading">
        <div><p className="home-eyebrow">Explore Mystery Hub</p><h2 id="everyday-heading">What would you like to do?</h2></div>
        <button type="button" onClick={() => setActivePage('services')} className="home-text-action">All Services<ArrowRight className="w-4 h-4" /></button>
      </div>
      <div className="home-utility-grid">
        {services.map(({ icon: Icon, ...service }) => (
          <button type="button" key={service.id} onClick={service.action} className={`home-utility home-utility-${service.tone}`}>
            <span className="home-utility-icon"><Icon className="w-5 h-5" /></span>
            <span className="home-utility-text">
              <span className="home-utility-title">{service.title}</span>
              <span className="home-utility-desc">{service.desc}</span>
              <span className="home-utility-status">{service.tag}</span>
            </span>
            <ArrowRight className="home-utility-arrow w-4 h-4" aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
};
