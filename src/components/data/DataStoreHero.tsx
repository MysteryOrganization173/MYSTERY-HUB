import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Smartphone, Receipt, UserRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatGhanaPhone, isCompleteGhanaPhone } from '../../utils/checkoutRecovery';
import { SeasonalDataStore } from '../../seasonal/Seasonal';

/**
 * The Data page's ordinary artwork: coverage rings spreading from a lit point, with a few signals travelling on them.
 * Original, drawn in code, decorative only. The rings breathe very slowly; reduced motion holds them still.
 */
export const SignalArt = () => (
  <svg viewBox="0 0 240 200" className="mh-ds-signal" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="mh-ds-core" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#7dffbf" />
        <stop offset=".35" stopColor="#00c365" />
        <stop offset="1" stopColor="#00c365" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="mh-ds-ring" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#44df95" stopOpacity=".9" />
        <stop offset="1" stopColor="#44df95" stopOpacity=".05" />
      </linearGradient>
    </defs>
    <g className="mh-ds-signal-rings" fill="none" stroke="url(#mh-ds-ring)">
      <circle cx="170" cy="150" r="30" strokeWidth="1.6" />
      <circle cx="170" cy="150" r="58" strokeWidth="1.3" strokeOpacity=".8" />
      <circle cx="170" cy="150" r="88" strokeWidth="1.1" strokeOpacity=".55" />
      <circle cx="170" cy="150" r="120" strokeWidth="1" strokeOpacity=".32" />
    </g>
    <g className="mh-ds-signal-orbit">
      <circle cx="170" cy="62" r="3.4" fill="#d9ffe9" />
      <circle cx="82" cy="150" r="2.6" fill="#8ff0bf" />
      <circle cx="113" cy="107" r="2.2" fill="#44df95" />
    </g>
    <g className="mh-ds-signal-orbit is-slow">
      <circle cx="170" cy="30" r="2.4" fill="#44df95" />
      <circle cx="68" cy="94" r="2" fill="#d9ffe9" />
    </g>
    <circle className="mh-ds-signal-core" cx="170" cy="150" r="26" fill="url(#mh-ds-core)" />
    <circle cx="170" cy="150" r="7" fill="#eafff3" />
  </svg>
);

/**
 * Says how this visitor's checkout will go before they choose anything. Guests learn they need no account; signed-in
 * customers see which number checkout starts with and that it can be changed. Nothing here is a default recipient:
 * checkout always shows the number again and lets the customer change it before paying.
 */
export type DataStoreMode = 'data' | 'instant' | 'airtime';

function JourneyLine({ mode }: { mode: DataStoreMode }) {
  const { user, isAuthChecking } = useApp();
  if (isAuthChecking) return <p className="mh-ds-journey" aria-hidden="true">&nbsp;</p>;
  // Airtime takes its number in the form on this page; Data and Instant take it in checkout. The line says which.
  if (!user) return (
    <p className="mh-ds-journey"><ShieldCheck aria-hidden="true" /><span><strong>No account needed.</strong> {mode === 'airtime'
      ? <>Enter the number below<span className="mh-ds-wide">, then confirm it and the total before you pay</span>.</>
      : mode === 'instant' ? <>Enter the number at checkout<span className="mh-ds-wide">, then confirm the total before you pay</span>.</>
      : <>Enter the number and a receipt email at checkout<span className="mh-ds-wide">, then confirm the total before you pay</span>.</>}</span></p>
  );
  const first = (user.name || '').trim().split(/\s+/)[0];
  const phone = user.phone && isCompleteGhanaPhone(user.phone) ? formatGhanaPhone(user.phone) : '';
  return (
    <p className="mh-ds-journey is-member" data-journey="member">
      <UserRound aria-hidden="true" />
      <span>
        <strong>{first ? `Signed in as ${first}.` : 'Signed in.'}</strong>{' '}
        {mode === 'airtime' ? 'Airtime goes to the number you enter below.' : phone ? <><span className="mh-ds-wide">Checkout starts with your number</span><span className="mh-ds-narrow">Checkout starts with</span> <span className="mh-ds-journey-phone">{phone}</span><span className="mh-ds-wide">. Change it there to send to someone else.</span><span className="mh-ds-narrow">, which you can change.</span></>
          : 'Enter the number you are buying for at checkout.'}
      </span>
    </p>
  );
}

/** The title panel settles in once per visit; coming back to the page (or a re-render) never replays it. */
let heroShown = false;

export function DataStoreHero({ mode = 'data', offer = null }: { mode?: DataStoreMode; offer?: React.ReactNode }) {
  // Read once on mount (a pure initializer, safe under StrictMode); remembered after the panel has been shown.
  const [seen] = useState(() => heroShown);
  useEffect(() => { heroShown = true; }, []);
  // Ambient artwork motion pauses whenever the panel is off-screen, so scrolling the catalogue never pays for it.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) el.removeAttribute('data-ds-idle'); else el.setAttribute('data-ds-idle', ''); });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section ref={ref} className="mh-ds-hero" aria-labelledby="data-store-title" data-ds-reveal {...(seen ? { 'data-ds-seen': '' } : {})}>
      <div className="mh-ds-hero-copy">
        <SeasonalDataStore part="line" />
        <p className="mh-ds-eyebrow">Data &amp; Airtime</p>
        <h1 id="data-store-title" className="mh-ds-title">Stay connected.</h1>
      </div>
      {/* 3.7 closeout: one line under the title, always the same height. It holds the Welcome Offer once the server
          confirms it applies to this visitor, and otherwise a plain reassurance, so no answer ever moves the page and
          nobody sees an empty gap. */}
      <div className="mh-ds-offer-slot">{offer || <p className="mh-ds-offer-default"><Receipt aria-hidden="true" />Total shown before you pay</p>}</div>
      <div className="mh-ds-hero-body">
        <p className="mh-ds-lede">Data, Instant Bundles and airtime for MTN, AirtelTigo and Telecel.</p>
        <ul className="mh-ds-assure" aria-label="How buying works">
          <li><Smartphone aria-hidden="true" />Mobile Money via Paystack</li>
          <li><ShieldCheck aria-hidden="true" />Track every order</li>
        </ul>
      </div>
      <div className="mh-ds-hero-art">
        <SeasonalDataStore part="art" fallback={<SignalArt />} />
      </div>
      <JourneyLine mode={mode} />
    </section>
  );
}
