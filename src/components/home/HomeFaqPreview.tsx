import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FaqAccordion } from '../common/FaqAccordion';
import { HOME_FAQS } from '../../data/helpFaqs';

export function HomeFaqPreview() {
  const { setActivePage } = useApp();
  return (
    <section className="home-faq-preview" aria-labelledby="home-faq-heading">
      <div className="home-section-heading">
        <div>
          <p className="home-eyebrow">A little clarity goes a long way</p>
          <h2 id="home-faq-heading">Questions? We’ve got answers.</h2>
          <p>From your first purchase to your next business idea.</p>
        </div>
        <a href="/help" onClick={event => { event.preventDefault(); setActivePage('help'); }} className="home-text-action">
          View All FAQs<ArrowUpRight size={17} aria-hidden="true" />
        </a>
      </div>
      <FaqAccordion questions={HOME_FAQS} />
    </section>
  );
}
