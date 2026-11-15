import React, { useEffect, useId, useState } from 'react';
import { CheckCircle2, Download, Share, SquarePlus, X } from 'lucide-react';
import { BrandMark } from '../common/BrandLogo';
import { useAppInstall } from '../../pwa/useAppInstall';
import { installCopy, installProgressCopy } from '../../pwa/invitationCopy';
import { noteDismissal, registerInlineOffer } from '../../pwa/invitations';
import {trackGrowth} from '../../utils/growthAnalytics';
import './pwa.css';

const coarsePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

/** iPhone and iPad: Share → Add to Home Screen. Shared by the page card and the floating invitation. */
export const AppleInstallSteps: React.FC<{ id: string }> = ({ id }) => (
  <ol id={id} className="mh-install-steps">
    <li><span aria-hidden="true">1</span><p>Tap <Share className="inline size-4 -mt-0.5" aria-hidden="true" /> <strong>Share</strong>. In newer Safari it sits inside the <strong>•••</strong> menu.</p></li>
    <li><span aria-hidden="true">2</span><p>Choose <strong>Add to Home Screen</strong>. You may need to scroll or tap <strong>More</strong> to see it.</p></li>
    <li><span aria-hidden="true">3</span><p>Tap <strong>Add</strong>. Mystery Hub opens from your home screen like an app.</p></li>
  </ol>
);

/**
 * The install card inside a page. Shown only where installing can actually work: Chromium browsers that offer
 * their install dialog, and iPhone/iPad Safari (Add to Home Screen steps). Hidden inside the installed app, after a
 * dismissal, while an accepted install is pending, and everywhere else. While it is on the page, the floating
 * invitations stay away, and its "Not now" ends suggestions for the rest of the visit.
 */
export const InstallAppPromo: React.FC<{ variant?: 'section' | 'compact'; className?: string }> = ({ variant = 'section', className = '' }) => {
  const { mode, progress, install, dismiss } = useAppInstall();
  const [shownMode, setShownMode] = useState(mode);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [phone] = useState(coarsePointer);
  const titleId = useId(), stepsId = useId(), offerId = useId();
  useEffect(() => { if (mode !== 'hidden') setShownMode(mode); }, [mode]);
  const offering = mode !== 'hidden' && progress === 'idle';
  useEffect(() => (offering ? registerInlineOffer(offerId) : undefined), [offering, offerId]);

  const visible = mode !== 'hidden' || (progress !== 'idle' && shownMode !== 'hidden');
  if (!visible) return null;
  const apple = (mode === 'hidden' ? shownMode : mode) === 'apple';
  const notNow = () => { noteDismissal(); dismiss(); };

  if (progress !== 'idle') {
    const copy = installProgressCopy(progress, phone);
    return <section aria-labelledby={titleId} className={`mh-install-promo mh-install-promo-${variant} mh-install-promo-done ${className}`} role="status">
      <CheckCircle2 className="mh-install-done-icon" aria-hidden="true" />
      <div className="mh-install-copy">
        <h2 id={titleId}>{copy.title}</h2>
        <p>{copy.text}</p>
      </div>
    </section>;
  }

  const copy = installCopy(phone);
  return <section aria-labelledby={titleId} className={`mh-install-promo mh-install-promo-${variant} ${className}`}>
    <button type="button" className="mh-install-close mh-compact-control" onClick={notNow} aria-label="Hide the app suggestion">
      <X className="size-4" aria-hidden="true" />
    </button>
    <span className="mh-install-icon" aria-hidden="true"><BrandMark size="xl" ariaHidden /></span>
    <div className="mh-install-copy">
      <p className="mh-install-eyebrow">Free · no app store needed</p>
      <h2 id={titleId}>{copy.title}</h2>
      <p>{copy.text}</p>
    </div>
    <div className="mh-install-actions">
      {apple
        ? <button type="button" className="mh-button" aria-expanded={stepsOpen} aria-controls={stepsId} onClick={() => {if(!stepsOpen)trackGrowth('install_action',{page:'home'});setStepsOpen(open => !open);}}>
            <SquarePlus className="size-4" aria-hidden="true" />{stepsOpen ? 'Hide steps' : 'Add to Home Screen'}
          </button>
        : <button type="button" className="mh-button" onClick={() => { void install(); }}>
            <Download className="size-4" aria-hidden="true" />Install App
          </button>}
      <button type="button" className="mh-install-later" onClick={notNow}>Not now</button>
    </div>
    {apple && stepsOpen && <AppleInstallSteps id={stepsId} />}
  </section>;
};
