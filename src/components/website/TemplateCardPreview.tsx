import { SafeImage } from './SafeImage.js';
import React, { useEffect, useRef, useState } from 'react';
import { renderTemplateLayout } from '../../utils/templateRendererUtils';
import { WebsiteTemplate } from '../../types';
import { Eye, Check, ArrowRight, Plus } from 'lucide-react';

interface TemplateCardPreviewProps {
  template: WebsiteTemplate;
  onPreview: () => void;
  onUseTemplate?: () => void;
  compact?: boolean;
}

/**
 * The design itself, scaled into the card once the card scrolls into view. It renders at the visitor's own
 * window width, so the design's responsive layout (which follows the window) is exactly the one they would see. It is
 * the same renderer a published website uses, with the design's sample content: never a mock-up or screenshot.
 * It is inert, so it cannot be clicked, focused or read twice by a screen reader.
 */
function LiveTemplateThumb({ template, onLive }: { template: WebsiteTemplate; onLive: (phone: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ width: 0, scale: 0, phone: false }), [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = box.current; if (!el || typeof IntersectionObserver === 'undefined' || typeof ResizeObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: '200px' });
    // On a phone the design shows inside a phone-shaped screen, so more of it fits in the card than a full-width crop.
    const ro = new ResizeObserver(() => { const width = Math.max(360, window.innerWidth), phone = width < 768; setFrame({ width, phone, scale: el.clientWidth * (phone ? 0.56 : 1) / width }); });
    io.observe(el); ro.observe(el);
    return () => { io.disconnect(); ro.disconnect(); };
  }, []);
  useEffect(() => { if (visible && frame.scale) onLive(frame.phone); }, [visible, frame.scale, frame.phone]);
  const page = visible && frame.scale > 0 && <div className="template-card-live-frame" style={{ width: frame.width, transform: `scale(${frame.scale})` }}>{renderTemplateLayout(template)}</div>;
  return <div ref={box} className={`template-card-live${frame.phone ? ' is-phone' : ''}`} aria-hidden="true" inert>
    {frame.phone ? page && <div className="template-card-live-screen">{page}</div> : page}
  </div>;
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
  const name = isStartBlank ? 'Start blank' : t.title;
  const [live, setLive] = useState(false), [phoneLive, setPhoneLive] = useState(false);

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
            {(!live || phoneLive) && (t.heroImage ? <SafeImage className="template-card-photo" src={t.heroImage} alt="" loading="lazy" /> : <span className="template-card-photo" />)}
            <LiveTemplateThumb template={t} onLive={phone => { setLive(true); setPhoneLive(phone); }} />
            {(!live || phoneLive) && <span className={`template-card-shade${phoneLive ? ' is-backdrop' : ''}`} aria-hidden="true" />}
            <span className={`template-card-sample${live ? ' is-live' : ''}`}>
              <span className="template-card-sample-label">{live ? 'Live design · sample content' : 'Sample'}</span>
              {!live && <span className="template-card-sample-name">{t.demoBusinessName}</span>}
              {!live && <span className="template-card-sample-line">{t.demoHeroTagline}</span>}
            </span>
            <span className="template-card-hover" aria-hidden="true"><Eye className="w-4 h-4" />Preview on phone and desktop</span>
          </>
        )}
      </div>

      <div className="template-card-body">
        {!isStartBlank && t.categoryLabel && <p className="template-card-category">{t.categoryLabel}</p>}
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
