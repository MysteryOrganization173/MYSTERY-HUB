import React from 'react';
import { BrandLogo } from './BrandLogo';
import { useApp } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';
import { ROUTE_PATH_MAP } from '../../utils/routing';
import type { ActivePage } from '../../types';
import { ArrowUpRight, Mail, MessageCircle, Phone, ShieldCheck } from 'lucide-react';

type FooterLink = { label: string; page: ActivePage; note?: string; open?: () => void };

/** Shared first-party footer. Admin and published customer sites render outside this shell and never receive it. */
export const Footer: React.FC = () => {
  const { setActivePage, openDataPage } = useApp();
  const year = new Date().getFullYear();
  const { contact } = BUSINESS_CONFIG;
  const columns: { title: string; links: FooterLink[] }[] = [
    { title: 'Services', links: [
      { label: 'Data Bundles', page: 'data' },
      { label: 'Airtime', page: 'data', open: () => openDataPage('airtime') },
      { label: 'AFA Registration', page: 'afa' },
      { label: 'Website Builder', page: 'website', note: 'Beta' },
      { label: 'Marketplace', page: 'marketplace' },
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
    ] },
  ];
  const go = (event: React.MouseEvent, link: FooterLink) => { event.preventDefault(); if (link.open) link.open(); else setActivePage(link.page); };
  const linkClass = 'group inline-flex min-h-10 items-center gap-2 text-[15px] sm:text-sm text-slate-300 hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cedb3] rounded';

  return (
    <footer className="relative mt-10 sm:mt-14 border-t border-slate-800/80 bg-[#070b0e] text-slate-400 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-[env(safe-area-inset-bottom,0px)] overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_15%_0%,rgba(0,195,101,0.08),transparent_60%)]" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
        <div className="grid gap-7 lg:grid-cols-12 lg:gap-12">
          {/* Identity and community */}
          <div className="lg:col-span-5 space-y-5 text-left">
            <div className="space-y-2">
              <BrandLogo size="md" />
              <p className="font-['Outfit'] text-lg sm:text-xl font-semibold leading-snug text-white">Everything digital. One trusted place.</p>
              <p className="text-sm text-[#7cedb3]">Building digital opportunities in Ghana since 2024</p>
            </div>

            <section aria-labelledby="footer-channel" className="max-w-md border-l-2 border-[#00c365]/60 pl-4">
              <h2 id="footer-channel" className="font-['Outfit'] text-base font-semibold text-white">Stay connected with Mystery Hub</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">Service updates, new launches and special offers on our WhatsApp Channel.</p>
              <a href={contact.whatsappChannelUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#00c365] px-4 text-sm font-semibold text-[#02190d] hover:bg-[#19d679] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cedb3]">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />Join our WhatsApp Channel<ArrowUpRight className="h-4 w-4" aria-hidden="true" /><span className="sr-only">(opens WhatsApp)</span>
              </a>
            </section>
          </div>

          {/* Navigation */}
          <nav aria-label="Footer" className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 content-start gap-x-6 gap-y-5 text-left">
            {columns.map(column => (
              <div key={column.title} className={column.title === 'Help' ? 'col-span-2 sm:col-span-1' : undefined}>
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{column.title}</h2>
                <ul className={column.title === 'Help' ? 'grid grid-cols-2 gap-x-6 sm:grid-cols-1' : undefined}>
                  {column.links.map(link => (
                    <li key={link.label}>
                      <a href={ROUTE_PATH_MAP[link.page]} onClick={event => go(event, link)} className={linkClass}>
                        <span className="whitespace-nowrap">{link.label}</span>{link.note && <span className="hidden sm:inline rounded-full border border-slate-700 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-slate-400 group-hover:border-[#00c365]/50 group-hover:text-[#7cedb3]">{link.note}</span>}
                      </a>
                    </li>
                  ))}
                  {column.title === 'Help' && <>
                    <li><a href={contact.supportWhatsAppUrl} target="_blank" rel="noopener noreferrer" className={linkClass}><MessageCircle className="h-4 w-4 text-[#44df95]" aria-hidden="true" />WhatsApp support</a></li>
                    <li><a href={contact.phoneLink} className={linkClass}><Phone className="h-4 w-4 text-slate-500" aria-hidden="true" />{contact.supportPhone}</a></li>
                    <li className="col-span-2 sm:col-span-1"><a href={contact.emailLink} className={linkClass} title={contact.supportEmail}><Mail className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" /><span className="min-w-0">{contact.supportEmail.split('@')[0]}<wbr />@{contact.supportEmail.split('@')[1]}</span></a></li>
                  </>}
                </ul>
              </div>
            ))}
            {/* Not yet purchasable, so plain text rather than links. */}
            <p className="col-span-2 sm:col-span-3 text-sm text-slate-500"><span className="font-semibold text-slate-400">Coming soon:</span> ECG Prepaid Bills · WAEC Results PINs · DStv &amp; GOtv Pay</p>
          </nav>
        </div>

        {/* Payments, trust and legal */}
        <div className="mt-8 grid gap-3 border-t border-slate-800/70 py-5 text-xs text-left sm:grid-cols-[1fr_auto] sm:items-center">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1"><ShieldCheck className="h-4 w-4 shrink-0 text-[#44df95]" aria-hidden="true" /><span className="text-slate-400">Secure Mobile Money checkout</span><span className="font-semibold text-amber-300">MTN MoMo</span><span className="font-semibold text-red-300">Telecel Cash</span><span className="font-semibold text-sky-300">AT Money</span></p>
          <p className="text-slate-500">© {year} Mystery Hub. All rights reserved. <span className="text-slate-600">{contact.supportLocation}</span>
            <a href="/admin" onClick={event => { event.preventDefault(); setActivePage('admin'); }} className="ml-3 inline-flex min-h-10 items-center text-slate-600 hover:text-slate-400 transition-colors">Staff Portal</a></p>
        </div>
      </div>
    </footer>
  );
};
