import React from 'react';
import { useApp } from '../../context/AppContext';
import { airtimeCardLine, openNetworksLabel, pausedLabel, useServiceStatus } from '../../hooks/useServiceStatus';
import { Wifi, Smartphone, Globe, Gift, ShieldCheck, Store, ArrowRight } from 'lucide-react';

type Service = { id: string; title: string; desc: string; icon: React.ComponentType<{ className?: string }>; action: () => void; tag: string; tone: 'live' | 'free' | 'neutral' };

/** One directory for everything customers can use today. Planned services live in HomeComingSoonSection. */
export const QuickServicesBar: React.FC = () => {
  const { setActivePage, openDataPage } = useApp();
  // 3.6.4: only the networks selling now are named; a paused network is never advertised (Service Control Center).
  const serviceStatus = useServiceStatus();
  const dataNetworks = openNetworksLabel('data', serviceStatus), airtimeOpen = openNetworksLabel('airtime', serviceStatus);
  const services: Service[] = [
    { id: 'data', title: 'Data Bundles', desc: dataNetworks ?? pausedLabel('data', serviceStatus), icon: Wifi, action: () => openDataPage('data'), tag: dataNetworks ? 'Available' : 'Paused', tone: dataNetworks ? 'live' : 'neutral' },
    { id: 'airtime', title: 'Airtime Top-Up', desc: airtimeCardLine(serviceStatus), icon: Smartphone, action: () => openDataPage('airtime'), tag: airtimeOpen ? 'Available' : 'Paused', tone: airtimeOpen ? 'live' : 'neutral' },
    { id: 'website', title: 'Website Builder', desc: 'A website for your business', icon: Globe, action: () => setActivePage('website'), tag: 'Free plan', tone: 'free' },
    { id: 'earn', title: 'Mystery Earn', desc: 'Refer friends & earn', icon: Gift, action: () => setActivePage('earn'), tag: 'Available', tone: 'live' },
    { id: 'afa', title: 'AFA Registration', desc: 'Existing registrations and support', icon: ShieldCheck, action: () => setActivePage('afa'), tag: 'Check Status', tone: 'neutral' },
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
