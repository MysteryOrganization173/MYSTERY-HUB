import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock3, RefreshCcw, X } from 'lucide-react';
import { getCloudinarySrcSet, getCloudinaryUrl } from '../../utils/cloudinary';
import { creativeService, type CreativeServiceId } from '../../../shared/creativeStudio';
import {
  CREATIVE_COMMERCE, creativeCategory, creativeCedis, creativeDays, creativePackage, creativeRounds, priceCreativeOrder, type CreativePackage,
} from '../../../shared/creativeCatalogue';
import { CREATIVE_OWNER_LABEL, creativeProjectOf, creativeWorkById, type CreativeWork } from '../../data/creativeStudioWork';
import { CreativeBriefForm } from './CreativeBriefForm';

/** The quiet "mat" colour each category's artwork floats on. */
export const CATEGORY_MAT: Record<CreativeServiceId, string> = { flyers: '#e8dccb', social: '#e3d7dc', logo: '#d8ddd2', banners: '#d6dbe5' };

/** An artwork at its own proportions (never cropped), sized for the slot it sits in. */
export function ArtImage({ work, sizes, widths, eager, className }: { work: CreativeWork; sizes: string; widths: number[]; eager?: boolean; className?: string }) {
  return (
    <img className={className} src={getCloudinaryUrl(work.src, { width: widths[Math.min(1, widths.length - 1)], crop: 'limit' })} srcSet={getCloudinarySrcSet(work.src, widths, { crop: 'limit' })} sizes={sizes}
      width={work.width} height={work.height} alt={work.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager ? 'high' : undefined} />
  );
}

export type SheetState = { kind: 'package'; id: string } | { kind: 'custom' } | null;

/**
 * The one overlay for buying: a package's details, extras and total, then its order step; or the custom project brief.
 * A native modal <dialog>, so Escape closes it and focus stays inside. A bottom sheet on phones, a two-panel modal on
 * larger screens. The page behind does not scroll while it is open.
 */
export function CreativeSheet({ state, onClose, customService, onCustomService }: {
  state: SheetState; onClose: () => void; customService: CreativeServiceId | ''; onCustomService: (id: CreativeServiceId) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // A tap on the backdrop closes a package's details, but never a form someone may be filling in.
  const typing = useRef(false);
  const pkg = state?.kind === 'package' ? creativePackage(state.id) : undefined;
  const open = Boolean(pkg || state?.kind === 'custom');
  useEffect(() => {
    const dialog = ref.current; if (!dialog) return;
    // Focus the sheet's heading rather than the close button, so screen readers start at the package name and no
    // focus ring appears on the X for touch users.
    if (open && !dialog.open) { dialog.showModal(); requestAnimationFrame(() => dialog.querySelector<HTMLElement>('#cs-sheet-title')?.focus({ preventScroll: true })); }
    if (!open && dialog.open) dialog.close();
    if (!open) typing.current = false;
    const root = document.documentElement;
    if (open) { root.classList.add('cs-locked'); return () => root.classList.remove('cs-locked'); }
  }, [open]);
  return (
    <dialog ref={ref} className="cs-dialog" data-kind={state?.kind || undefined} aria-labelledby="cs-sheet-title"
      onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current && state?.kind === 'package' && !typing.current) onClose(); }}>
      {pkg && <PackageSheet key={pkg.id} pkg={pkg} onClose={onClose} onStep={step => { typing.current = step === 'order'; }} />}
      {state?.kind === 'custom' && (
        <div className="cs-sh cs-sh-custom">
          <header className="cs-sh-bar">
            <p className="cs-sh-crumb">Custom project</p>
            <button type="button" className="cs-icon-btn" onClick={onClose} aria-label="Close"><X size={20} aria-hidden /></button>
          </header>
          <div className="cs-sh-main">
            <div className="cs-sh-side"><div className="cs-sh-scroll">
              <h2 id="cs-sheet-title" className="cs-sh-title" tabIndex={-1}>Tell us about your project</h2>
              <p className="cs-sh-summary">For work that doesn’t fit a package: brochures, signage, event branding or several pieces together. The team reads your brief and sends a quote before any work starts.</p>
              <CreativeBriefForm service={customService} onService={onCustomService} />
            </div></div>
          </div>
        </div>
      )}
    </dialog>
  );
}

function PackageSheet({ pkg, onClose, onStep }: { pkg: CreativePackage; onClose: () => void; onStep: (step: 'details' | 'order') => void }) {
  const [extras, setExtras] = useState<string[]>([]);
  const [step, setStep] = useState<'details' | 'order'>('details');
  const [shot, setShot] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [ordered, setOrdered] = useState(false);
  const price = useMemo(() => priceCreativeOrder(pkg.id, extras), [pkg.id, extras]);
  const extraIds = useMemo(() => price.extras.map(extra => extra.id), [price]);
  const art = pkg.art.map(creativeWorkById);
  const work = art[shot] || art[0];
  const project = creativeProjectOf(work);
  const category = creativeCategory(pkg.category)!;
  const draft = CREATIVE_COMMERCE.pricing === 'draft';
  const toggle = (id: string) => setExtras(list => list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  const go = (next: 'details' | 'order') => {
    setStep(next); onStep(next); if (next === 'order') setOrdered(true);
    requestAnimationFrame(() => {
      // Phones scroll the whole sheet; larger screens scroll only the text column.
      scroller.current?.scrollTo({ top: 0 });
      scroller.current?.querySelector('.cs-sh-scroll')?.scrollTo({ top: 0 });
      titleRef.current?.focus({ preventScroll: true });
    });
  };

  return (
    <div className="cs-sh" data-step={step} style={{ '--cs-mat': CATEGORY_MAT[pkg.category] } as React.CSSProperties}>
      <header className="cs-sh-bar">
        {step === 'order'
          ? <button type="button" className="cs-sh-back" onClick={() => go('details')}><ArrowLeft size={18} aria-hidden />Package details</button>
          : <p className="cs-sh-crumb">{category.name}</p>}
        <button type="button" className="cs-icon-btn" onClick={onClose} aria-label="Close"><X size={20} aria-hidden /></button>
      </header>
      <div className="cs-sh-main" ref={scroller}>
        <div className="cs-sh-art">
          <figure className="cs-sh-figure" data-shape={work.width > work.height * 1.15 ? 'wide' : work.height > work.width * 1.1 ? 'tall' : 'square'}>
            <ArtImage key={work.id} work={work} widths={[480, 800, 1200]} sizes="(min-width: 900px) 460px, 86vw" eager />
          </figure>
          <p className="cs-sh-art-label">{CREATIVE_OWNER_LABEL[project.owner]} · {project.name}</p>
          {art.length > 1 && (
            <div className="cs-sh-thumbs" role="group" aria-label="Sample designs">
              {art.map((piece, i) => (
                <button key={piece.id} type="button" aria-pressed={i === shot} aria-label={`Show ${piece.title}`} onClick={() => setShot(i)}>
                  <img src={getCloudinaryUrl(piece.src, { width: 120, height: 120, crop: 'fill' })} alt="" width={60} height={60} loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="cs-sh-side">
          <div className="cs-sh-scroll">
            <div hidden={step !== 'details'}>
                <h2 id={step === 'details' ? 'cs-sheet-title' : undefined} className="cs-sh-title" ref={step === 'details' ? titleRef : undefined} tabIndex={-1}>{pkg.name}</h2>
                <div className="cs-sh-price">
                  <strong>{creativeCedis(pkg.priceMinor)}</strong>
                  {draft && <span className="cs-draft">Draft price</span>}
                </div>
                <p className="cs-sh-summary">{pkg.summary}</p>
                <ul className="cs-sh-facts">
                  <li><Clock3 size={17} aria-hidden /><span><strong>{creativeDays(pkg.turnaroundDays)}</strong>to the first draft</span></li>
                  <li><RefreshCcw size={17} aria-hidden /><span><strong>{creativeRounds(pkg.revisions)}</strong>of changes included</span></li>
                </ul>
                <h3 className="cs-sh-h3">What you get</h3>
                <ul className="cs-sh-list">
                  {pkg.deliverables.map(item => <li key={item}><Check size={16} aria-hidden />{item}</li>)}
                  <li><Check size={16} aria-hidden />Files: {pkg.files}</li>
                </ul>
                {pkg.extras.length > 0 && <>
                  <h3 className="cs-sh-h3" id="cs-extras-title">Add extras</h3>
                  <div className="cs-extras" role="group" aria-labelledby="cs-extras-title">
                    {pkg.extras.map(extra => (
                      <label key={extra.id} className="cs-extra">
                        <input type="checkbox" checked={extras.includes(extra.id)} onChange={() => toggle(extra.id)} />
                        <span className="cs-extra-box" aria-hidden="true"><Check size={14} /></span>
                        <span className="cs-extra-text"><strong>{extra.name}</strong><small>{extra.detail}</small></span>
                        <span className="cs-extra-price">+{creativeCedis(extra.priceMinor)}</span>
                      </label>
                    ))}
                  </div>
                </>}
                <h3 className="cs-sh-h3">Good to know</h3>
                <ul className="cs-sh-notes">
                  {pkg.limits.map(item => <li key={item}>{item}</li>)}
                  <li>A revision round is one list of changes to the agreed design. A new idea after you approve a direction is new work.</li>
                </ul>
            </div>
            {/* The order step stays mounted once opened, so going back to change extras never loses what was typed. */}
            {(step === 'order' || ordered) && <div hidden={step !== 'order'}>
                <h2 id={step === 'order' ? 'cs-sheet-title' : undefined} className="cs-sh-title" ref={step === 'order' ? titleRef : undefined} tabIndex={-1}>Your order details</h2>
                <div className="cs-order-line">
                  <img src={getCloudinaryUrl(art[0].src, { width: 120, height: 120, crop: 'fill' })} alt="" width={52} height={52} />
                  <span><strong>{pkg.name}</strong><small>{price.extras.length ? price.extras.map(extra => extra.name).join(' · ') : 'No extras'}</small></span>
                  <em>{creativeCedis(price.totalMinor)}</em>
                </div>
                <CreativeBriefForm service={pkg.category} pkg={pkg} extras={extraIds} />
            </div>}
          </div>
          {step === 'details' && (
            <footer className="cs-sh-foot">
              <div className="cs-sh-total" aria-live="polite">
                <span>{draft ? 'Draft total' : 'Total'}</span>
                <strong>{creativeCedis(price.totalMinor)}</strong>
              </div>
              <button type="button" className="cs-btn cs-btn-primary" onClick={() => go('order')}>Continue<ArrowRight size={18} aria-hidden /></button>
              <p className="cs-sh-foot-note">No payment is taken in the next step.</p>
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}

/** The service a sheet asks about, for analytics and the custom brief. */
export const sheetService = (state: SheetState): CreativeServiceId | '' => state?.kind === 'package' ? creativeService(creativePackage(state.id)?.category)?.id || '' : '';
