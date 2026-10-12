import React from 'react';
import { ArrowUpRight, MessageCircle, Sparkles } from 'lucide-react';
import { BUSINESS_CONFIG } from '../../config/business';
import { HELP_CATEGORIES } from '../../data/helpFaqs';
import { useApp } from '../../context/AppContext';
import { FaqAccordion } from '../common/FaqAccordion';
import '../home/homepage.css';

export function HelpPage() {
  const { openMysteryAi } = useApp();
  return (
    <div className="help-page home-container">
      <header className="help-intro">
        <p className="home-eyebrow">Help & FAQs</p>
        <h1>Useful answers.<br /><span>More confidence.</span></h1>
        <p>Find your next step, understand an order or get to know Mystery Hub.</p>
        <div className="help-intro-actions">
          <a className="mh-button" href="/orders">Track an Order<ArrowUpRight size={17} aria-hidden="true" /></a>
          <a className="mh-button-secondary" href={BUSINESS_CONFIG.contact.supportWhatsAppUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={17} aria-hidden="true" />WhatsApp Support
          </a>
        </div>
      </header>
      <nav aria-label="FAQ categories" className="help-category-nav">
        {HELP_CATEGORIES.map(category => <a key={category.id} href={'#' + category.id}>{category.title}</a>)}
      </nav>
      <div className="help-categories">
        {HELP_CATEGORIES.map(category => (
          <section key={category.id} id={category.id} aria-labelledby={category.id + '-heading'} className="help-category">
            <div><h2 id={category.id + '-heading'}>{category.title}</h2><p>{category.description}</p></div>
            <FaqAccordion questions={category.questions} />
          </section>
        ))}
      </div>
      <section className="help-support" aria-labelledby="help-support-heading">
        <div>
          <p className="home-eyebrow">Still have a question?</p>
          <h2 id="help-support-heading">The right help for your next step.</h2>
          <p>Contact support with your order reference for purchase help. For general guidance, you can also ask Mystery AI.</p>
        </div>
        <div className="help-intro-actions">
          <a className="mh-button-secondary" href={BUSINESS_CONFIG.contact.supportWhatsAppUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={17} aria-hidden="true" />Contact Support
          </a>
          <button type="button" className="mh-button-secondary" onClick={() => openMysteryAi()}>
            <Sparkles size={17} aria-hidden="true" />Ask Mystery AI
          </button>
        </div>
      </section>
    </div>
  );
}
