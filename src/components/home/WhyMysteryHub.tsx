import React from 'react';
import { useApp } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';
import { ShieldCheck, ArrowRight, MessageCircle } from 'lucide-react';

/** Support entry points beside the FAQ; the buying promises live next to the bundles. */
export const WhyMysteryHub: React.FC = () => {
  const { setActivePage } = useApp();
  return (
    <section className="home-support" aria-labelledby="trust-heading">
      <p className="home-eyebrow">Help when you need it</p>
      <h2 id="trust-heading">Need help with an order?</h2>
      <p>Keep your order reference handy. You can check its status any time, or message our support team on WhatsApp.</p>
      <div className="home-support-actions">
        <button type="button" onClick={() => setActivePage('orders')} className="mh-button">Track an Order<ArrowRight className="w-4 h-4" /></button>
        <a href={BUSINESS_CONFIG.contact.supportWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="mh-button-secondary"><MessageCircle className="w-4 h-4" />WhatsApp Support</a>
      </div>
      <p className="home-support-safety"><ShieldCheck className="w-4 h-4" aria-hidden="true" />Mystery Hub and its support team will never ask for your MoMo PIN.</p>
    </section>
  );
};
