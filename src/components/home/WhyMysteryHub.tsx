import React from 'react';
import { useApp } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';
import { ShieldCheck, DollarSign, Clock, ArrowRight, MessageCircle } from 'lucide-react';

export const WhyMysteryHub: React.FC = () => {
  const { setActivePage } = useApp();
  const reasons = [
    { icon: DollarSign, title: 'Clear Prices Before You Pay', desc: 'See your bundle price, any service fee and the total before confirming payment.' },
    { icon: Clock, title: 'Track Your Order', desc: 'Follow your order from confirmed payment to delivery. Timing depends on the service and network.' },
    { icon: ShieldCheck, title: 'Pay with Mobile Money', desc: 'Payments are handled by Paystack. Never share your MoMo PIN with Mystery Hub or support.' },
  ];
  return (
    <section className="home-container home-trust" aria-labelledby="trust-heading">
      <div className="home-section-heading"><div><p className="home-eyebrow">Know what to expect</p><h2 id="trust-heading">Clear prices. Orders you can track.</h2></div></div>
      <div className="home-trust-grid">{reasons.map(({ icon: Icon, title, desc }) => <div key={title} className="home-trust-item"><Icon className="w-5 h-5" /><h3>{title}</h3><p>{desc}</p></div>)}</div>
      <div className="home-support-strip">
        <div><h3>Help When You Need It</h3><p>Keep your order reference handy when you contact support.</p></div>
        <div className="home-support-actions"><button onClick={() => setActivePage('orders')} className="home-text-action">Track an Order<ArrowRight className="w-4 h-4" /></button><a href={BUSINESS_CONFIG.contact.supportWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="mh-button-secondary"><MessageCircle className="w-4 h-4" />WhatsApp Support</a></div>
      </div>
    </section>
  );
};
