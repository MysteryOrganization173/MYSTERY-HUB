import React, { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, Download, Share, SquarePlus, X } from 'lucide-react';
import { BrandMark } from '../common/BrandLogo';
import { useAppInstall } from '../../pwa/useAppInstall';
import { installCopy, installProgressCopy } from '../../pwa/invitationCopy';
import { noteDismissal, noteInvitationAnswered, registerInlineOffer, setInlineOfferInView } from '../../pwa/invitations';
import { isCoarsePointer } from '../../pwa/appEnvironment';
import {trackGrowth} from '../../utils/growthAnalytics';
import './pwa.css';

const onScreen = (element: HTMLElement) => {
  const box = element.getBoundingClientRect();
  return box.bottom > 0 && box.right > 0 && box.top < window.innerHeight && box.left < window.innerWidth;
};

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
 * dismissal, while an accepted install is pending, and everywhere else. While it is on the page, the floating Install
 * and Channel cards stay away from that page, and while it is on screen no floating card at all sits beside it (the
 * notification card waits, or steps aside when this card scrolls into view). Its "Not now" ends suggestions for the
 * rest of the visit.
 */
export const InstallAppPromo: React.FC<{ variant?: 'section' | 'compact'; className?: string }> = ({ variant = 'section', className = '' }) => {
  const { mode, progress, install, dismiss, stepsSeen } = useAppInstall();
  const [shownMode, setShownMode] = useState(mode);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [stepsRead, setStepsRead] = useState(false);
  const [phone] = useState(() => isCoarsePointer());
  const titleId = useId(), stepsId = useId(), offerId = useId();
  useEffect(() => { if (mode !== 'hidden') setShownMode(mode); }, [mode]);
  const offering = mode !== 'hidden' && progress === 'idle';
  const sectionRef = useRef<HTMLElement | null>(null);
  // Registered with where it really is right now (measured), then kept current by an observer, so a card below the
  // fold never knocks a floating card off while the observer's first report is on its way. Without an observer it
  // simply counts as on screen (the conservative answer).
  useEffect(() => {
    if (!offering) return;
    const section = sectionRef.current;
    const observe = Boolean(section) && typeof IntersectionObserver !== 'undefined';
    const release = registerInlineOffer(offerId, observe ? onScreen(section!) : true);
    if (!observe) return release;
    const observer = new IntersectionObserver(entries => { for (const entry of entries) setInlineOfferInView(offerId, entry.isIntersecting); });
    observer.observe(section!);
    return () => { observer.disconnect(); release(); };
  }, [offering, offerId]);

  const visible = mode !== 'hidden' || (progress !== 'idle' && shownMode !== 'hidden');
  if (!visible) return null;
  const apple = (mode === 'hidden' ? shownMode : mode) === 'apple';
  const notNow = () => { noteDismissal(); dismiss(); };
  // Closing after reading the iPhone steps is not a "no": Safari cannot tell us whether it was added.
  const close = () => { if (stepsRead) stepsSeen(); else notNow(); };

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
  return <section ref={sectionRef} aria-labelledby={titleId} className={`mh-install-promo mh-install-promo-${variant} ${className}`}>
    <button type="button" className="mh-install-close mh-compact-control" onClick={close} aria-label="Hide the app suggestion">
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
        ? <button type="button" className="mh-button" aria-expanded={stepsOpen} aria-controls={stepsId} onClick={() => {if(!stepsOpen){trackGrowth('install_action',{page:'home'});noteInvitationAnswered('install');setStepsRead(true);}setStepsOpen(open => !open);}}>
            <SquarePlus className="size-4" aria-hidden="true" />{stepsOpen ? 'Hide steps' : 'Add to Home Screen'}
          </button>
        : <button type="button" className="mh-button" onClick={() => { noteInvitationAnswered('install'); void install(); }}>
            <Download className="size-4" aria-hidden="true" />Install App
          </button>}
      <button type="button" className="mh-install-later" onClick={notNow}>Not now</button>
    </div>
    {apple && stepsOpen && <AppleInstallSteps id={stepsId} />}
  </section>;
};
