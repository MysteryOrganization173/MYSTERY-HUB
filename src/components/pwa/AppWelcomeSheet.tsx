import React, { useId, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { BrandMark } from '../common/BrandLogo';
import { STORAGE_KEYS, writeTimestamp } from '../../pwa/launchPolicy';
import './pwa.css';

/**
 * First screen of the installed app for a signed-out visitor: one short sheet, not a carousel. Signing in is
 * optional; buying, order tracking and browsing keep working for guests exactly as on the website.
 */
export const AppWelcomeSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { openAuth } = useApp();
  const titleId = useId();
  const [phone] = useState(() => window.matchMedia?.('(pointer: coarse)').matches === true);
  const ref = useDialogFocus(true, onClose);
  const auth = (mode: 'login' | 'signup') => { onClose(); openAuth(mode); };
  const guest = () => { writeTimestamp(STORAGE_KEYS.welcomeGuest); onClose(); };

  return <div className="mh-app-sheet-layer" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="mh-app-sheet mh-welcome-sheet">
      <button type="button" className="mh-app-sheet-close mh-compact-control" onClick={onClose} aria-label="Close welcome">
        <X className="size-4" aria-hidden="true" />
      </button>
      <span className="mh-welcome-mark" aria-hidden="true"><BrandMark size="xl" ariaHidden priority="high" /></span>
      <h2 id={titleId} tabIndex={-1} data-autofocus>Welcome to Mystery Hub</h2>
      <p>Sign in to see your orders, Wallet and websites in one place on this {phone ? 'phone' : 'device'}.</p>
      <div className="mh-welcome-actions">
        <button type="button" className="mh-button" onClick={() => auth('login')}>Sign in</button>
        <button type="button" className="mh-button-secondary" onClick={() => auth('signup')}>Create a free account</button>
      </div>
      <button type="button" className="mh-welcome-guest" onClick={guest}>
        Continue as a guest<ArrowRight className="size-4" aria-hidden="true" />
      </button>
      <p className="mh-welcome-note">You can still buy data and track an order without an account.</p>
    </div>
  </div>;
};
