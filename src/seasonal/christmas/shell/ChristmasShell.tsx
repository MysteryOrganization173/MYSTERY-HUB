import React from 'react';
import './shell.css';
import { ArrowUpRight, Mail, MessageCircle, Phone, Send, ShieldCheck } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { BUSINESS_CONFIG } from '../../../config/business';
import { ROUTE_PATH_MAP } from '../../../utils/routing';
import { BrandMark } from '../../../components/common/BrandLogo';
import type { ActivePage } from '../../../types';
import { isChristmasPhase, type SeasonStatus } from '../../../../shared/seasonal';
import { loadSeasonalSerif } from '../font';

/**
 * The seasonal shell: what every visitor sees around the page while a pack applies, signed in or not.
 * - `logo-hat`: a velvet Santa hat fitted onto the official brand mark in the header (never on a navigation icon),
 *   through Boxing Day only: from 27 December the site greets the New Year and the logo goes back to plain.
 * - `menu-header`: a quiet festive heading at the top of the phone menu.
 * - `ChristmasFooter`: the season's footer. The ordinary footer is untouched and returns the moment the season ends.
 * Everything here is presentation: links, contacts and routes are the ordinary footer's own.
 */

loadSeasonalSerif();

export type ShellSlotName = 'logo-hat' | 'menu-header';

/**
 * A Santa hat drawn for the official mark's right peak: fur brim tilted with the peak, velvet cap with one fold, the
 * tip drooping toward the wordmark and a soft pompom. It sits on top of the unchanged logo image (the mark itself is
 * never redrawn) and casts a faint shadow onto it.
 */
export function LogoHat() {
  return (
    <svg className="xs-hat" viewBox="0 0 40 34" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="xs-hat-velvet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0566a" /><stop offset=".38" stopColor="#d32a42" /><stop offset=".78" stopColor="#a3162d" /><stop offset="1" stopColor="#7c0f22" />
        </linearGradient>
        <linearGradient id="xs-hat-fold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5e0918" stopOpacity="0" /><stop offset="1" stopColor="#5e0918" stopOpacity=".55" />
        </linearGradient>
        <linearGradient id="xs-hat-fur" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" /><stop offset=".6" stopColor="#f3eee6" /><stop offset="1" stopColor="#d6cfc3" />
        </linearGradient>
        <radialGradient id="xs-hat-pom" cx="38%" cy="34%" r="70%">
          <stop offset="0" stopColor="#ffffff" /><stop offset=".7" stopColor="#efe9df" /><stop offset="1" stopColor="#cfc7ba" />
        </radialGradient>
        <filter id="xs-hat-soft" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="1" /></filter>
      </defs>
      <g transform="rotate(-11 18 24)">
        {/* Shadow on the mark, under the brim. */}
        <ellipse cx="18" cy="29.5" rx="13" ry="2.6" fill="#03140b" opacity=".45" filter="url(#xs-hat-soft)" />
        {/* Velvet cap, rising from the brim and drooping to the right. */}
        <path className="xs-hat-cap" d="M6 22 C7 13 12 5.5 19 4.5 C26 3.6 31 7.4 34 12.2 C35.6 14.8 36.2 17.4 35.3 19.6 L31.6 15.8 C30.3 14 28.8 13 27.3 12.9 C28.8 15.6 29.6 18.6 30 22 Z" fill="url(#xs-hat-velvet)" />
        <path d="M27.3 12.9 C28.8 15.6 29.6 18.6 30 22 L22 22 C23.5 18 25 14.8 27.3 12.9 Z" fill="url(#xs-hat-fold)" />
        <path d="M8.6 19.5 C9.6 13.4 13 8.3 18.4 6.8" fill="none" stroke="#ff9aa6" strokeOpacity=".55" strokeWidth="1.1" strokeLinecap="round" />
        {/* Fur brim with a soft, uneven top edge. */}
        <rect x="3.5" y="20.5" width="29" height="7.6" rx="3.8" fill="url(#xs-hat-fur)" />
        <g fill="#ffffff">
          <circle cx="6.5" cy="21" r="2" /><circle cx="10.5" cy="20.4" r="2.2" /><circle cx="15" cy="20.2" r="2.1" />
          <circle cx="19.5" cy="20.3" r="2.2" /><circle cx="24" cy="20.5" r="2" /><circle cx="28.3" cy="20.9" r="2" />
        </g>
        <path d="M4.5 26.6 C12 28.6 24 28.6 31.5 26.4" fill="none" stroke="#b9b0a2" strokeOpacity=".7" strokeWidth=".9" strokeLinecap="round" />
        {/* Pompom at the drooping tip. */}
        <g className="xs-hat-pom">
          <circle cx="35.6" cy="20.6" r="3.9" fill="url(#xs-hat-pom)" />
          <circle cx="34.4" cy="19.4" r="1.2" fill="#ffffff" />
        </g>
      </g>
    </svg>
  );
}

function MenuHeader({ status }: { status: SeasonStatus }) {
  const christmas = isChristmasPhase(status.phase);
  return (
    <div className="xs-menu-head" aria-hidden="true">
      <span className="xs-menu-lights">{Array.from({ length: 7 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}</span>
      <p><span lang="ak">Afehyia pa</span> · {christmas ? 'Merry Christmas from Mystery Hub' : 'Happy New Year from Mystery Hub'}</p>
    </div>
  );
}

export function ShellSlot({ slot, status }: { slot: ShellSlotName; status: SeasonStatus }) {
  switch (slot) {
    case 'logo-hat': return isChristmasPhase(status.phase) ? <LogoHat /> : null;
    case 'menu-header': return <MenuHeader status={status} />;
    default: return null;
  }
}

/* ───────────────────────── Footer ───────────────────────── */

type FooterLink = { label: string; page: ActivePage; note?: string; open?: () => void };

/**
 * The season's footer: a short brand statement, the real ways to get help, compact navigation and a quiet legal line.
 * It keeps every destination of the ordinary footer (services, account, help, both announcement channels, WhatsApp
 * support, phone, email and the staff route) and drops only the repeated "Coming soon" list, which the pages above
 * already explain.
 */
export function ChristmasFooter({ status }: { status: SeasonStatus }) {
  const { setActivePage, openDataPage, activePage } = useApp();
  const { contact } = BUSINESS_CONFIG;
  const christmas = isChristmasPhase(status.phase);
  const year = new Date().getFullYear();
  const columns: { title: string; links: FooterLink[] }[] = [
    { title: 'Buy & build', links: [
      { label: 'Data Bundles', page: 'data' },
      { label: 'Airtime', page: 'data', open: () => openDataPage('airtime') },
      { label: 'AFA Registration', page: 'afa' },
      { label: 'Website Builder', page: 'website', note: 'Beta' },
      { label: 'Marketplace', page: 'marketplace' },
      { label: 'Creative Studio', page: 'creative' },
    ] },
    { title: 'Your account', links: [
      { label: 'Track My Order', page: 'orders' },
      { label: 'Mystery Wallet', page: 'wallet' },
      { label: 'Mystery Earn', page: 'earn' },
      { label: 'More Services', page: 'services' },
    ] },
    { title: 'Mystery Hub', links: [
      { label: 'Help & FAQs', page: 'help' },
      { label: 'About Mystery Hub', page: 'about' },
    ] },
  ];
  const go = (event: React.MouseEvent, link: FooterLink) => { event.preventDefault(); if (link.open) link.open(); else setActivePage(link.page); };
  const [emailUser, emailDomain] = contact.supportEmail.split('@');

  return (
    <footer className="xs-footer" aria-labelledby="xs-footer-title">
      <div className="xs-footer-edge" aria-hidden="true"><span /><i /><span /></div>
      <div className="xs-footer-inner">
        {activePage !== 'home' && (
          <p className="xs-footer-greeting">{christmas ? 'Wishing you a wonderful Christmas.' : 'Wishing you a happy New Year.'} <span lang="ak">Afehyia pa!</span></p>
        )}
        <div className="xs-footer-top">
          <div className="xs-footer-brand">
            <a href="/" onClick={event => { event.preventDefault(); setActivePage('home'); }} className="xs-footer-logo" aria-label="Mystery Hub Homepage">
              <BrandMark size="md" ariaHidden /><span>Mystery <b>Hub</b></span>
            </a>
            <h2 id="xs-footer-title">Everything digital. <em>One trusted place.</em></h2>
            <p>Data, airtime, websites and tech for customers across Ghana, with every order tracked from payment to delivery.</p>
          </div>

          <section className="xs-footer-help" aria-labelledby="xs-footer-help-title">
            <h3 id="xs-footer-help-title">Need help?</h3>
            <a href={contact.supportWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="xs-footer-whatsapp">
              <MessageCircle className="h-5 w-5 shrink-0" aria-hidden="true" /><span><strong>WhatsApp support</strong><small>Message us with your order reference</small></span><ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="sr-only">(opens WhatsApp)</span>
            </a>
            <ul className="xs-footer-contacts">
              <li><a href={contact.phoneLink}><Phone className="h-4 w-4" aria-hidden="true" />{contact.supportPhone}</a></li>
              <li><a href={contact.emailLink} title={contact.supportEmail}><Mail className="h-4 w-4" aria-hidden="true" /><span>{emailUser}<wbr />@{emailDomain}</span></a></li>
            </ul>
            <div className="xs-footer-channels" aria-label="Announcements">
              <a href={contact.whatsappChannelUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" aria-hidden="true" />Join WhatsApp Channel<span className="sr-only"> (opens in a new tab)</span></a>
              <a href={contact.telegramChannelUrl} target="_blank" rel="noopener noreferrer"><Send className="h-4 w-4" aria-hidden="true" />Join Telegram Channel<span className="sr-only"> (opens in a new tab)</span></a>
            </div>
          </section>
        </div>

        <nav aria-label="Footer" className="xs-footer-nav">
          {columns.map(column => (
            <div key={column.title}>
              <h3>{column.title}</h3>
              <ul>
                {column.links.map(link => (
                  <li key={link.label}><a href={ROUTE_PATH_MAP[link.page]} onClick={event => go(event, link)}>{link.label}{link.note && <span className="xs-footer-note">{link.note}</span>}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="xs-footer-legal">
          <p className="xs-footer-pay"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" /><span>Secure Mobile Money checkout</span>{['MTN MoMo', 'Telecel Cash', 'AT Money'].map(method => <b key={method}>{method}</b>)}</p>
          <p className="xs-footer-copy">© {year} Mystery Hub · {contact.supportLocation}
            <a href="/admin" onClick={event => { event.preventDefault(); setActivePage('admin'); }} className="xs-footer-staff">Staff Portal</a></p>
        </div>
      </div>
    </footer>
  );
}
