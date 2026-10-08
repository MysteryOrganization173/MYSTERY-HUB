import React from 'react';
import { useApp } from '../../context/AppContext';
import { Wifi, Smartphone, ShieldCheck, Gift, ArrowRight } from 'lucide-react';

export const QuickServicesBar: React.FC = () => {
  const { setActivePage, openDataPage } = useApp();
  const services = [
    { id: 'data', title: 'Data Bundles', desc: 'MTN, Telecel & AirtelTigo', icon: Wifi, action: () => openDataPage('data'), tag: 'Available', tone: 'amber' },
    { id: 'airtime', title: 'Airtime Top-Up', desc: 'Top up your number', icon: Smartphone, action: () => openDataPage('airtime'), tag: 'Available', tone: 'green' },
    { id: 'afa', title: 'AFA Registration', desc: 'Check availability', icon: ShieldCheck, action: () => setActivePage('afa'), tag: 'Check Status', tone: 'blue' },
    { id: 'earn', title: 'Mystery Earn', desc: 'Refer friends & earn', icon: Gift, action: () => setActivePage('earn'), tag: 'Available', tone: 'violet' },
  ];
  return (
    <section className="home-container home-everyday" aria-labelledby="everyday-heading">
      <div className="home-section-heading">
        <div><p className="home-eyebrow">Explore Mystery Hub</p><h2 id="everyday-heading">Your everyday essentials</h2></div>
        <button onClick={() => setActivePage('services')} className="home-text-action">All Services<ArrowRight className="w-4 h-4" /></button>
      </div>
      <div className="home-utility-grid">
        {services.map(({ icon: Icon, ...service }) => (
          <button key={service.id} onClick={service.action} className={`home-utility home-utility-${service.tone}`}>
            <div className="home-utility-top"><Icon className="w-6 h-6" /><ArrowRight className="w-4 h-4" /></div>
            <h3>{service.title}</h3><p>{service.desc}</p><span className="home-utility-status">{service.tag}</span>
          </button>
        ))}
      </div>
    </section>
  );
};
