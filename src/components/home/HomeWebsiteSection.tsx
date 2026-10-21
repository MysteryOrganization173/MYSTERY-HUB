import React from 'react';
import { useApp } from '../../context/AppContext';
import { orderedWebsiteTemplates, isReadyDesign } from '../../data/templates';
import { TemplateCardPreview } from '../website/TemplateCardPreview';
import { Globe, ArrowRight, Check, Eye } from 'lucide-react';

export const HomeWebsiteSection: React.FC = () => {
  const { setActivePage, openTemplatePreview } = useApp();
  // Actual existing templates and Cloudinary artwork, never a fabricated screenshot.
  const designs = orderedWebsiteTemplates().filter(isReadyDesign);
  const template = designs.find(t => t.id === 'tmpl-data-reseller') || designs[0];
  const more = designs.filter(t => t.id !== template?.id).slice(0, 4);
  return (
    <section className="home-container home-feature-section" aria-labelledby="website-heading">
      <div className="home-website-panel">
        <div className="home-website-copy">
          <p className="home-eyebrow"><Globe className="w-4 h-4" />Website Builder · Free plan</p>
          <h2 id="website-heading">Your business deserves<br /><span>a place online.</span></h2>
          <p>Pick one of {designs.length} ready-made designs, add your business details and photos, then publish. No coding needed.</p>
          <ol className="home-builder-steps">
            <li><span>1</span>Choose your design</li><li><span>2</span>Add your details</li><li><span>3</span>Publish for free</li>
          </ol>
          <div className="home-website-actions">
            <a href="/website-builder" onClick={(e) => { e.preventDefault(); setActivePage('website'); }} className="mh-button">Browse Templates<ArrowRight className="w-4 h-4" /></a>
            <p className="home-feature-note"><Check className="w-4 h-4" />Works on phones, tablets and desktop</p>
          </div>
          {more.length > 0 && <div className="home-template-chips">
            <p>Preview a design</p>
            <ul>{more.map(t => (
              <li key={t.id}><button type="button" onClick={() => openTemplatePreview(t)} aria-label={`Preview ${t.demoBusinessName || t.title} design`}><Eye className="w-3.5 h-3.5" aria-hidden="true" />{t.demoBusinessName || t.title}</button></li>
            ))}</ul>
          </div>}
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
