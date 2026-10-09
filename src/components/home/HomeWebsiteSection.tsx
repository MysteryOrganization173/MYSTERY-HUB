import React from 'react';
import { useApp } from '../../context/AppContext';
import { orderedWebsiteTemplates } from '../../data/templates';
import { TemplateCardPreview } from '../website/TemplateCardPreview';
import { Globe, ArrowRight, Check } from 'lucide-react';

export const HomeWebsiteSection: React.FC = () => {
  const { setActivePage, openTemplatePreview } = useApp();
  // Actual existing template and Cloudinary artwork, never a fabricated screenshot.
  const templates = orderedWebsiteTemplates();
  const template = templates.find(t => t.id === 'tmpl-data-reseller') || templates[0];
  return (
    <section className="home-container home-feature-section" aria-labelledby="website-heading">
      <div className="home-website-panel">
        <div className="home-website-copy">
          <p className="home-eyebrow"><Globe className="w-4 h-4" />Website Builder · Free plan</p>
          <h2 id="website-heading">Your business deserves<br /><span>a place online.</span></h2>
          <p>Pick a design, add your business details and photos, then publish your website. No coding needed.</p>
          <ol className="home-builder-steps">
            <li><span>01</span>Choose your design</li><li><span>02</span>Add your details</li><li><span>03</span>Publish for free</li>
          </ol>
          <a href="/website-builder" onClick={(e) => { e.preventDefault(); setActivePage('website'); }} className="mh-button">Browse Templates<ArrowRight className="w-4 h-4" /></a>
          <p className="home-feature-note"><Check className="w-4 h-4" />Designed for phones, tablets and desktop</p>
        </div>
        <div className="home-template-showcase">
          <div className="home-template-label"><span>See what you can create</span><span>Design preview</span></div>
          {template && <TemplateCardPreview template={template} onPreview={() => openTemplatePreview(template)} />}
          <p>Sample design and content. Your website uses your own business details.</p>
        </div>
      </div>
    </section>
  );
};
