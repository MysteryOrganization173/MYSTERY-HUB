import React, { useEffect, useId, useState } from 'react';
import { CheckCircle2, Download, Share, SquarePlus, X } from 'lucide-react';
import { BrandMark } from '../common/BrandLogo';
import { useAppInstall } from '../../pwa/useAppInstall';
import './pwa.css';

const coarsePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

/**
 * "Mystery Hub, on your phone." Shown only where installing can actually work: Chromium browsers that offer
 * their install dialog, and iPhone/iPad browsers (Add to Home Screen steps). Hidden inside the installed app,
 * after a dismissal, and everywhere else. It is a card in the page, never a pop-up over buying or signing in.
 */
export const InstallAppPromo: React.FC<{ variant?: 'section' | 'compact'; className?: string }> = ({ variant = 'section', className = '' }) => {
  const { mode, progress, install, dismiss } = useAppInstall();
  const [shownMode, setShownMode] = useState(mode);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [phone] = useState(coarsePointer);
  const titleId = useId(), stepsId = useId();
  useEffect(() => { if (mode !== 'hidden') setShownMode(mode); }, [mode]);

  const visible = mode !== 'hidden' || (progress !== 'idle' && shownMode !== 'hidden');
  if (!visible) return null;
  const apple = (mode === 'hidden' ? shownMode : mode) === 'apple';

  if (progress !== 'idle') {
    return <section aria-labelledby={titleId} className={`mh-install-promo mh-install-promo-${variant} mh-install-promo-done ${className}`} role="status">
      <CheckCircle2 className="mh-install-done-icon" aria-hidden="true" />
      <div className="mh-install-copy">
        <h2 id={titleId}>{progress === 'installed' ? 'Mystery Hub is installed' : 'Installing Mystery Hub…'}</h2>
        <p>{phone ? 'Open it any time from your home screen or app list.' : 'Open it any time from your apps, dock or Start menu.'}</p>
      </div>
    </section>;
  }

  return <section aria-labelledby={titleId} className={`mh-install-promo mh-install-promo-${variant} ${className}`}>
    <button type="button" className="mh-install-close mh-compact-control" onClick={dismiss} aria-label="Hide the app suggestion">
      <X className="size-4" aria-hidden="true" />
    </button>
    <span className="mh-install-icon" aria-hidden="true"><BrandMark size="xl" ariaHidden /></span>
    <div className="mh-install-copy">
      <p className="mh-install-eyebrow">Free · no app store needed</p>
      <h2 id={titleId}>{phone ? 'Mystery Hub, on your phone.' : 'Mystery Hub, one click away.'}</h2>
      <p>{phone ? 'One tap away from data, orders, Wallet and more.' : 'Data, orders, Wallet and more in their own window, ready from your desktop.'}</p>
    </div>
    <div className="mh-install-actions">
      {apple
        ? <button type="button" className="mh-button" aria-expanded={stepsOpen} aria-controls={stepsId} onClick={() => setStepsOpen(open => !open)}>
            <SquarePlus className="size-4" aria-hidden="true" />{stepsOpen ? 'Hide steps' : 'Add to Home Screen'}
          </button>
        : <button type="button" className="mh-button" onClick={() => { void install(); }}>
            <Download className="size-4" aria-hidden="true" />Install Mystery Hub
          </button>}
      <button type="button" className="mh-install-later" onClick={dismiss}>Not now</button>
    </div>
    {apple && stepsOpen && <ol id={stepsId} className="mh-install-steps">
      <li><span aria-hidden="true">1</span><p>Tap <Share className="inline size-4 -mt-0.5" aria-hidden="true" /> <strong>Share</strong>. In newer Safari it sits inside the <strong>•••</strong> menu.</p></li>
      <li><span aria-hidden="true">2</span><p>Choose <strong>Add to Home Screen</strong>. You may need to scroll or tap <strong>More</strong> to see it.</p></li>
      <li><span aria-hidden="true">3</span><p>Tap <strong>Add</strong>. Mystery Hub opens from your home screen like an app.</p></li>
    </ol>}
    <p className="mh-install-note">It installs straight from this website, opens in its own window and uses the same account. There is no Play Store or App Store download.</p>
  </section>;
};
