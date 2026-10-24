import React, { useEffect, useId, useState } from 'react';
import {
  ArrowRight, CheckCircle2, Clock, Compass, Copy, Download, EllipsisVertical, Gift, Globe, Home, Loader2, MonitorSmartphone,
  RefreshCw, Share, ShieldCheck, Smartphone, SquarePlus, Wallet, Wifi, Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAppInstall } from '../../pwa/useAppInstall';
import { appLandingState, INSTALL_CHECK_MS, type AppLandingState } from '../../pwa/installGuidance';
import { APP_SHARE_URL, copyAppLink } from '../../utils/appShare';
import type { ActivePage } from '../../types';
import { BrandMark } from '../common/BrandLogo';
import { AppPhonePreview } from './AppPhonePreview';
import { ShareAppButton } from './ShareAppButton';
import './app-landing.css';

const userAgent = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent || '');

/** Only what is live today. Each card opens that part of Mystery Hub, so nobody has to install to look around. */
const SERVICES: { page: ActivePage; icon: typeof Wifi; title: string; text: string; airtime?: boolean }[] = [
  { page: 'data', icon: Wifi, title: 'Data bundles', text: 'MTN, Telecel and AirtelTigo data, paid with Mobile Money.' },
  { page: 'data', icon: Zap, title: 'Airtime', text: 'Top up airtime for yourself or someone else.', airtime: true },
  { page: 'website', icon: Globe, title: 'Free business website', text: 'Create and publish your own website at no cost.' },
  { page: 'orders', icon: Clock, title: 'Order tracking', text: 'Follow each order from payment to delivery.' },
  { page: 'earn', icon: Gift, title: 'Mystery Earn', text: 'Invite people and earn rewards from qualifying purchases.' },
  { page: 'wallet', icon: Wallet, title: 'Mystery Wallet', text: 'Top up and pay for supported purchases from your balance.' },
];

const REASONS = [
  { icon: Smartphone, title: 'On your home screen', text: 'Open Mystery Hub with one tap. No searching for the link again.' },
  { icon: ShieldCheck, title: 'Your same account', text: 'Sign in once. Your orders, Wallet and websites are all there.' },
  { icon: RefreshCw, title: 'Light and always current', text: 'No app store download. It installs from this website and stays up to date by itself.' },
];

/** The install area: one honest next step for this exact browser, never a button that cannot work. */
const InstallPanel: React.FC<{ state: AppLandingState; onInstall: () => void; progress: 'idle' | 'installing' | 'installed'; declined: boolean; onOpen: () => void }> = ({
  state, onInstall, progress, declined, onOpen,
}) => {
  const { showToast } = useApp();
  const stepsId = useId();
  const copy = async () => {
    if (await copyAppLink(navigator.clipboard)) showToast('Link copied. Paste it into Chrome’s address bar.', 'success');
    else showToast(`Copy this link: ${APP_SHARE_URL}`, 'info');
  };
  const copyButton = <button type="button" className="mh-applp-link-button" onClick={() => { void copy(); }}><Copy aria-hidden="true" />Copy the link</button>;

  if (progress !== 'idle') {
    return <div className="mh-applp-install is-done" role="status">
      <CheckCircle2 className="mh-applp-done-icon" aria-hidden="true" />
      <div>
        <p className="mh-applp-install-title">{progress === 'installed' ? 'Mystery Hub is installed' : 'Installing Mystery Hub…'}</p>
        <p className="mh-applp-install-note">Find it on your home screen or in your app list, and open it any time.</p>
      </div>
    </div>;
  }

  if (state === 'installed') {
    return <div className="mh-applp-install">
      <p className="mh-applp-install-title">You’re using the Mystery Hub app.</p>
      <p className="mh-applp-install-note">It’s already on this device. Carry on where you left off, or share it with someone.</p>
      <div className="mh-applp-actions">
        <button type="button" className="mh-button" onClick={onOpen}><Home aria-hidden="true" />Open Mystery Hub</button>
        <ShareAppButton className="mh-button-secondary" />
      </div>
    </div>;
  }

  if (state === 'prompt') {
    return <div className="mh-applp-install">
      <div className="mh-applp-actions">
        <button type="button" className="mh-button mh-applp-primary" onClick={onInstall}><Download aria-hidden="true" />Install Mystery Hub</button>
      </div>
      <p className="mh-applp-install-note">It opens in its own window, like any app, and uses your same Mystery Hub account.</p>
    </div>;
  }

  if (state === 'checking') {
    return <div className="mh-applp-install" role="status">
      <p className="mh-applp-checking"><Loader2 className="animate-spin" aria-hidden="true" />Checking how this browser installs apps…</p>
    </div>;
  }

  if (state === 'apple') {
    return <div className="mh-applp-install">
      <p className="mh-applp-install-title"><SquarePlus aria-hidden="true" />Add Mystery Hub to your Home Screen</p>
      <ol className="mh-applp-steps" id={stepsId}>
        <li><span>1</span><p>Tap <Share className="mh-applp-inline-icon" aria-label="Share" /> <strong>Share</strong>. In newer Safari it sits inside the <strong>•••</strong> menu.</p></li>
        <li><span>2</span><p>Choose <strong>Add to Home Screen</strong>. You may need to scroll or tap <strong>More</strong> to see it.</p></li>
        <li><span>3</span><p>Tap <strong>Add</strong>. Mystery Hub opens from your Home Screen like an app.</p></li>
      </ol>
      <p className="mh-applp-install-note">Free, no App Store needed. Opened this from WhatsApp and can’t see <strong>Add to Home Screen</strong>? Open the page in Safari first (tap <Compass className="mh-applp-inline-icon" aria-label="Safari" /> at the bottom right).</p>
    </div>;
  }

  if (state === 'in-app') {
    return <div className="mh-applp-install">
      <p className="mh-applp-install-title"><Compass aria-hidden="true" />Open this page in your browser to install</p>
      <p className="mh-applp-install-note mh-applp-lead">You’re viewing it inside another app, which can’t install apps. Open it in your browser first:</p>
      <ol className="mh-applp-steps">
        <li><span>1</span><p>Tap <EllipsisVertical className="mh-applp-inline-icon" aria-label="menu" /> or <strong>•••</strong> at the top or bottom of this screen.</p></li>
        <li><span>2</span><p>Choose <strong>Open in Chrome</strong>, <strong>Open in browser</strong> or, on iPhone, <strong>Open in Safari</strong>.</p></li>
        <li><span>3</span><p>Follow the install step on the page that opens.</p></li>
      </ol>
      <p className="mh-applp-install-note">No menu? Copy the link and paste it into Chrome or Safari.</p>
      <div className="mh-applp-actions">{copyButton}</div>
    </div>;
  }

  if (state === 'android') {
    return <div className="mh-applp-install">
      <p className="mh-applp-install-title"><Smartphone aria-hidden="true" />{declined ? 'No problem. Install whenever you’re ready.' : 'Install from your browser menu'}</p>
      <ol className="mh-applp-steps">
        <li><span>1</span><p>Tap <EllipsisVertical className="mh-applp-inline-icon" aria-label="menu" /> in your browser, usually at the top right.</p></li>
        <li><span>2</span><p>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>, then confirm.</p></li>
      </ol>
      <p className="mh-applp-install-note">Don’t see it? Open this page in <strong>Chrome</strong>. If Mystery Hub is already on this phone, open it from your home screen.</p>
      <div className="mh-applp-actions">{copyButton}</div>
    </div>;
  }

  return <div className="mh-applp-install">
    <p className="mh-applp-install-title"><MonitorSmartphone aria-hidden="true" />Get it on your phone</p>
    <p className="mh-applp-install-note mh-applp-lead">Open <strong>mysterybundlehub.com/app</strong> on your phone in Chrome or Safari. On a computer, Chrome and Edge show an install icon in the address bar.</p>
    <div className="mh-applp-actions">{copyButton}<ShareAppButton className="mh-applp-link-button" label="Send it to my phone" /></div>
  </div>;
};

/**
 * /app: where WhatsApp links land. One screen explains Mystery Hub and offers the shortest install this browser
 * allows, using the same install prompt, detection and dismissal records as the Home install card. It loads no
 * account data: no Wallet, orders or websites are fetched to show it.
 */
export const AppLandingPage: React.FC = () => {
  const { setActivePage, openDataPage } = useApp();
  const { hasPrompt, installed, apple, progress, install } = useAppInstall();
  const [checked, setChecked] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [ua] = useState(userAgent);

  useEffect(() => { const timer = window.setTimeout(() => setChecked(true), INSTALL_CHECK_MS); return () => window.clearTimeout(timer); }, []);

  const state = appLandingState({ installed, hasPrompt, apple, userAgent: ua, checked });
  const go = (event: React.MouseEvent, page: ActivePage, airtime?: boolean) => {
    event.preventDefault();
    if (airtime) openDataPage('airtime'); else setActivePage(page);
  };

  return <div className="mh-applp">
    <section className="mh-applp-hero" aria-labelledby="app-landing-title">
      <div className="mh-applp-glow" aria-hidden="true" />
      <div className="mh-applp-container mh-applp-hero-grid">
        <div className="mh-applp-copy">
          <p className="mh-applp-eyebrow"><BrandMark size="sm" ariaHidden /><span>The Mystery Hub app</span></p>
          <h1 id="app-landing-title">Everything digital.<br /><span>One trusted place.</span></h1>
          <p className="mh-applp-sub">Your everyday digital services, one tap away. Buy data and airtime, build a free business website and follow every order from your home screen.</p>
          <InstallPanel state={state} progress={progress} declined={declined} onOpen={() => setActivePage('home')}
            onInstall={() => { void install().then(outcome => { if (outcome === 'dismissed') setDeclined(true); }); }} />
          {state !== 'installed' && <ul className="mh-applp-trust" aria-label="About installing">
            <li><CheckCircle2 aria-hidden="true" />Free to install</li>
            <li><CheckCircle2 aria-hidden="true" />No app store needed</li>
            <li><CheckCircle2 aria-hidden="true" />No sign-up needed to look around</li>
          </ul>}
        </div>
        <div className="mh-applp-visual">
          <AppPhonePreview />
        </div>
      </div>
    </section>

    <section className="mh-applp-section" aria-labelledby="app-landing-services">
      <div className="mh-applp-container">
        <h2 id="app-landing-services">What you can do with it</h2>
        <ul className="mh-applp-services">
          {SERVICES.map(({ page, icon: Icon, title, text, airtime }) => <li key={title}>
            <a href={page === 'website' ? '/website-builder' : `/${page}`} onClick={event => go(event, page, airtime)}>
              <span className="mh-applp-service-icon"><Icon aria-hidden="true" /></span>
              <span><strong>{title}</strong><span>{text}</span></span>
              <ArrowRight className="mh-applp-service-arrow" aria-hidden="true" />
            </a>
          </li>)}
        </ul>
      </div>
    </section>

    <section className="mh-applp-section" aria-labelledby="app-landing-why">
      <div className="mh-applp-container">
        <h2 id="app-landing-why">Why install it?</h2>
        <ul className="mh-applp-reasons">
          {REASONS.map(({ icon: Icon, title, text }) => <li key={title}><Icon aria-hidden="true" /><strong>{title}</strong><p>{text}</p></li>)}
        </ul>
      </div>
    </section>

    <section className="mh-applp-section mh-applp-share" aria-labelledby="app-landing-share">
      <div className="mh-applp-container mh-applp-share-inner">
        <div>
          <h2 id="app-landing-share">Know someone who’d use it?</h2>
          <p>Send them the link. It opens this page, so they can install Mystery Hub too.</p>
        </div>
        <div className="mh-applp-actions">
          <ShareAppButton className="mh-button-secondary" />
          <a href="/" className="mh-applp-link-button" onClick={event => go(event, 'home')}>Explore Mystery Hub<ArrowRight aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  </div>;
};
