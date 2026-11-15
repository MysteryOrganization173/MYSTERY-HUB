import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { useApp } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';
import { ROUTE_PATH_MAP } from '../../utils/routing';
import type { ActivePage } from '../../types';
import { ArrowUpRight, Mail, MessageCircle, MessageSquareText, Phone, Send, ShieldCheck } from 'lucide-react';
import { Seasonal } from '../../seasonal/Seasonal';
import { isInstalledApp } from '../../pwa/appEnvironment';
import './footer.css';

type FooterLink = { label: string; page: ActivePage; note?: string; open?: () => void };

/**
 * Shared first-party footer. Admin and published customer sites render outside this shell and never receive it.
 * Private support (WhatsApp, SMS, call, email) and community following (WhatsApp Channel, Telegram) are separate
 * groups, so an announcement channel is never mistaken for a support chat.
 */
export const Footer: React.FC = () => {
  const { setActivePage, openDataPage } = useApp();
  const [installed] = useState(isInstalledApp);
  const year = new Date().getFullYear();
  const { contact } = BUSINESS_CONFIG;
  const [emailUser, emailDomain] = contact.supportEmail.split('@');
  const columns: { title: string; links: FooterLink[] }[] = [
    { title: 'Services', links: [
      { label: 'Data Bundles', page: 'data' },
      { label: 'Airtime', page: 'data', open: () => openDataPage('airtime') },
      { label: 'AFA Registration', page: 'afa' },
      { label: 'Website Builder', page: 'website', note: 'Beta' },
      { label: 'Marketplace', page: 'marketplace' },
      { label: 'Creative Studio', page: 'creative' },
    ] },
    { title: 'Your account', links: [
      { label: 'Mystery Earn', page: 'earn', note: 'Rewards' },
      { label: 'Mystery Wallet', page: 'wallet' },
      { label: 'Track My Order', page: 'orders' },
      { label: 'More Services', page: 'services' },
    ] },
    { title: 'Help', links: [
      { label: 'Help & FAQs', page: 'help' },
      { label: 'About Mystery Hub', page: 'about' },
      // A voluntary way to install, always available; pointless inside the installed app itself.
      ...(installed ? [] : [{ label: 'Get the app', page: 'app' as ActivePage }]),
    ] },
  ];
  const go = (event: React.MouseEvent, link: FooterLink) => { event.preventDefault(); if (link.open) link.open(); else setActivePage(link.page); };
  const linkClass = 'group inline-flex min-h-10 items-center gap-2 text-[15px] sm:text-sm text-slate-300 hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cedb3] rounded';

  return (
    <footer className="relative mt-10 sm:mt-14 border-t border-slate-800/80 bg-[#070b0e] text-slate-400 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-[env(safe-area-inset-bottom,0px)] overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00c365]/50 to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_15%_0%,rgba(0,195,101,0.08),transparent_60%)]" />
      <Seasonal slot="footer" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
        <div className="mh-footer-grid text-left">
          <div className="mh-footer-brand space-y-2">
            <BrandLogo size="md" />
            <p className="font-['Outfit'] text-xl sm:text-2xl font-semibold leading-tight tracking-tight text-white">Everything digital. One trusted place.</p>
            <p className="text-sm text-[#7cedb3]">Building digital opportunities in Ghana since 2024</p>
          </div>

          <section aria-labelledby="footer-support" className="mh-footer-support">
            <h2 id="footer-support" className="mh-footer-heading">Contact support</h2>
            <a href={contact.supportWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="mh-footer-whatsapp">
              <MessageCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="mh-footer-line"><strong>WhatsApp support</strong> <small>{contact.supportWhatsAppDisplay}</small></span>
              <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="sr-only"> (opens WhatsApp)</span>
            </a>
            <ul className="mh-footer-lines">
              <li><a href={contact.smsLink}><MessageSquareText className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="mh-footer-line"><strong>SMS</strong> <small>{contact.supportSmsDisplay}</small></span></a></li>
              <li><a href={contact.phoneLink}><Phone className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="mh-footer-line"><strong>Call</strong> <small>{contact.supportPhoneDisplay}</small></span></a></li>
              <li className="is-wide"><a href={contact.emailLink}><Mail className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="mh-footer-line"><strong>Email</strong> <small>{emailUser}<wbr />@{emailDomain}</small></span></a></li>
            </ul>
          </section>

          <section aria-labelledby="footer-community" className="mh-footer-community">
            <h2 id="footer-community" className="mh-footer-heading">Follow Mystery Hub</h2>
            <p>Bundle updates, new launches and offers. For help with an order, contact support.</p>
            <div className="mh-footer-follow">
              <a href={contact.whatsappChannelUrl} target="_blank" rel="noopener noreferrer" className="is-whatsapp">
                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />WhatsApp Channel<ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="sr-only"> (opens WhatsApp)</span>
              </a>
              <a href={contact.telegramChannelUrl} target="_blank" rel="noopener noreferrer" className="is-telegram">
                <Send className="h-4 w-4 shrink-0" aria-hidden="true" />Telegram<ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="sr-only"> (opens Telegram)</span>
              </a>
            </div>
          </section>

          <nav aria-label="Footer" className="mh-footer-nav grid grid-cols-2 sm:grid-cols-3 content-start gap-x-6 gap-y-5">
            {columns.map(column => (
              <div key={column.title} className={column.title === 'Help' ? 'col-span-2 sm:col-span-1' : undefined}>
                <h2 className="mh-footer-heading">{column.title}</h2>
                <ul className={column.title === 'Help' ? 'flex flex-wrap gap-x-6 sm:block' : undefined}>
                  {column.links.map(link => (
                    <li key={link.label}>
                      <a href={ROUTE_PATH_MAP[link.page]} onClick={event => go(event, link)} className={linkClass}>
                        <span className="whitespace-nowrap">{link.label}</span>{link.note && <span className="hidden sm:inline rounded-full border border-slate-700 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-slate-400 group-hover:border-[#00c365]/50 group-hover:text-[#7cedb3]">{link.note}</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          {/* Not yet purchasable, so plain text rather than links. */}
          <div className="mh-footer-soon flex flex-wrap items-center gap-2 text-xs text-slate-400"><span className="font-semibold uppercase tracking-[0.12em] text-slate-400">Coming soon</span>{['ECG Prepaid Bills', 'WAEC Results PINs', 'DStv & GOtv Pay'].map(item => <span key={item} className="rounded-full border border-dashed border-slate-700 px-2.5 py-0.5">{item}</span>)}</div>
        </div>

        {/* Payments, trust and legal */}
        <div className="mt-6 sm:mt-8 grid gap-3 border-t border-slate-800/70 py-4 sm:py-5 text-xs text-left sm:grid-cols-[1fr_auto] sm:items-center">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1"><ShieldCheck className="h-4 w-4 shrink-0 text-[#44df95]" aria-hidden="true" /><span className="text-slate-400">Secure Mobile Money checkout</span>{['MTN MoMo', 'Telecel Cash', 'AT Money'].map(method => <span key={method} className="rounded-md border border-slate-700/80 bg-slate-900/60 px-2 py-0.5 font-semibold text-slate-200">{method}</span>)}</p>
          <p className="text-slate-400">© {year} Mystery Hub. All rights reserved. <span className="text-slate-400">{contact.supportLocation}</span>
            <a href="/admin" onClick={event => { event.preventDefault(); setActivePage('admin'); }} className="ml-3 inline-flex min-h-11 items-center text-slate-400 hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cedb3] rounded">Staff Portal</a></p>
        </div>
      </div>
    </footer>
  );
};
