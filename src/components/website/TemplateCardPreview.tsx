import { SafeImage } from './SafeImage.js';
import React from 'react';
import { WebsiteTemplate } from '../../types';
import { Eye, Check, ArrowRight, Plus } from 'lucide-react';

interface TemplateCardPreviewProps {
  template: WebsiteTemplate;
  onPreview: () => void;
  onUseTemplate?: () => void;
  compact?: boolean;
}

/**
 * Gallery card: the design's own photography and sample business, the industry it is made for, and what the
 * design includes. Every design is part of the Free plan (the server does not gate templates), so the card never
 * suggests otherwise, and the sample business is labelled as a sample.
 */
export const TemplateCardPreview: React.FC<TemplateCardPreviewProps> = ({
  template: t,
  onPreview,
  onUseTemplate,
}) => {
  const isStartBlank = t.id === 'tmpl-start-blank';
  const accent = t.colorScheme?.accent || t.accentColor || '#00c365';
  const open = isStartBlank ? (onUseTemplate || onPreview) : onPreview;
  const name = isStartBlank ? 'Start blank' : t.categoryLabel || t.industry;

  return (
    <article
      onClick={open}
      className={`template-card group ${isStartBlank ? 'template-card-blank' : ''}`}
      style={{ '--template-accent': accent } as React.CSSProperties}
    >
      <div className="template-card-media">
        {isStartBlank ? (
          <div className="template-card-blueprint" aria-hidden="true">
            <span className="template-card-blueprint-bar">{t.demoBusinessName}</span>
            <span className="template-card-blueprint-hero"><i /><i /><b /></span>
            <span className="template-card-blueprint-row"><i /><i /></span>
            <span className="template-card-blueprint-bar template-card-blueprint-foot" />
            <span className="template-card-blueprint-plus"><Plus className="w-5 h-5" /></span>
          </div>
        ) : (
          <>
            {t.heroImage ? <SafeImage className="template-card-photo" src={t.heroImage} alt="" loading="lazy" /> : <span className="template-card-photo" />}
            <span className="template-card-shade" aria-hidden="true" />
            <span className="template-card-sample">
              <span className="template-card-sample-label">Sample</span>
              <span className="template-card-sample-name">{t.demoBusinessName}</span>
              <span className="template-card-sample-line">{t.demoHeroTagline}</span>
            </span>
            <span className="template-card-hover" aria-hidden="true"><Eye className="w-4 h-4" />Preview on phone and desktop</span>
          </>
        )}
      </div>

      <div className="template-card-body">
        <h3 className="template-card-title">{name}</h3>
        <p className="template-card-desc">{t.description}</p>
        <p className="template-card-free"><Check className="w-3.5 h-3.5" aria-hidden="true" />Included in Free</p>
      </div>

      <div className="template-card-actions">
        {isStartBlank ? (
          <button type="button" className="template-card-use" onClick={(e) => { e.stopPropagation(); open(); }}>
            <Plus className="w-4 h-4" aria-hidden="true" />Start blank
          </button>
        ) : (
          <>
            <button type="button" className="template-card-preview" aria-label={`Preview the ${name} design`} onClick={(e) => { e.stopPropagation(); onPreview(); }}>
              <Eye className="w-4 h-4" aria-hidden="true" />Preview
            </button>
            {onUseTemplate && (
              <button type="button" className="template-card-use" aria-label={`Use the ${name} design`} onClick={(e) => { e.stopPropagation(); onUseTemplate(); }}>
                Use design<ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
};
