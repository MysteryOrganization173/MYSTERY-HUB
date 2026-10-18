import React from 'react';
import { BrandLogo } from './BrandLogo';
import { useApp } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';
import { ROUTE_PATH_MAP } from '../../utils/routing';
import type { ActivePage } from '../../types';
import { ArrowUpRight, Mail, MessageCircle, Phone, Radio, ShieldCheck } from 'lucide-react';

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
  const linkClass = 'group inline-flex min-h-10 items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cedb3] rounded';

  return (
    <footer className="relative mt-10 sm:mt-14 border-t border-slate-800/80 bg-[#070b0e] text-slate-400 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0 overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_15%_0%,rgba(0,195,101,0.10),transparent_60%)]" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-12">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Identity and community */}
          <div className="lg:col-span-5 space-y-6 text-left">
            <div className="space-y-3">
              <BrandLogo size="md" />
              <p className="font-['Outfit'] text-xl sm:text-2xl font-semibold leading-snug text-white max-w-md">Everything digital. One trusted place.</p>
              <p className="text-sm leading-relaxed text-slate-400 max-w-md">Data and airtime, AFA registration, business websites and Marketplace discovery for Ghana, with orders you can track and real people on WhatsApp.</p>
              <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-[#7cedb3]"><span aria-hidden="true" className="h-px w-6 bg-[#00c365]/60" />Building digital opportunities in Ghana since 2024</p>
            </div>

            <section aria-labelledby="footer-channel" className="relative max-w-md rounded-2xl border border-[#00c365]/25 bg-[linear-gradient(135deg,#0d2219,#0a1512_70%)] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#00c365]/15 text-[#44df95]"><Radio className="h-5 w-5" /></span>
                <div className="min-w-0 space-y-1">
                  <h2 id="footer-channel" className="font-['Outfit'] text-base font-semibold text-white">Stay in the loop with Mystery Hub</h2>
                  <p className="text-sm leading-relaxed text-slate-400">Product updates, new services, special offers and official Mystery Drops when one is running. Join only if you want to; you can leave anytime.</p>
                </div>
              </div>
              <a href={contact.whatsappChannelUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#00c365] px-4 text-sm font-semibold text-[#02190d] hover:bg-[#19d679] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cedb3]">
                Join the WhatsApp Channel <ArrowUpRight className="h-4 w-4" aria-hidden="true" /><span className="sr-only">(opens WhatsApp)</span>
              </a>
            </section>
          </div>

          {/* Navigation */}
          <nav aria-label="Footer" className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 content-start gap-x-6 gap-y-6 text-left">
            {columns.map(column => (
              <div key={column.title} className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{column.title}</h2>
                <ul className="space-y-0.5">
                  {column.links.map(link => (
                    <li key={link.label}>
                      <a href={ROUTE_PATH_MAP[link.page]} onClick={event => go(event, link)} className={linkClass}>
                        <span>{link.label}</span>{link.note && <span className="rounded-full border border-slate-700 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-slate-400 group-hover:border-[#00c365]/50 group-hover:text-[#7cedb3]">{link.note}</span>}
                      </a>
                    </li>
                  ))}
                  {column.title === 'Help' && <>
                    <li><a href={contact.supportWhatsAppUrl} target="_blank" rel="noopener noreferrer" className={linkClass}><MessageCircle className="h-4 w-4 text-[#44df95]" aria-hidden="true" />WhatsApp support</a></li>
                    <li><a href={contact.phoneLink} className={linkClass}><Phone className="h-4 w-4 text-slate-500" aria-hidden="true" />{contact.supportPhone}</a></li>
                    <li><a href={contact.emailLink} className={linkClass} title={contact.supportEmail}><Mail className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" /><span className="min-w-0">{contact.supportEmail.split('@')[0]}<wbr />@{contact.supportEmail.split('@')[1]}</span></a></li>
                  </>}
                </ul>
              </div>
            ))}
            <div className="col-span-2 sm:col-span-3 rounded-2xl border border-dashed border-slate-800 px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Coming soon</h2>
              <ul className="mt-1 flex flex-wrap gap-x-5 text-sm text-slate-400">
                {['ECG Prepaid Bills', 'WAEC Results PINs', 'DStv & GOtv Pay'].map(item => <li key={item}><a href={ROUTE_PATH_MAP.services} onClick={event => { event.preventDefault(); setActivePage('services'); }} className="inline-flex min-h-10 items-center hover:text-white transition-colors">{item}</a></li>)}
              </ul>
            </div>
          </nav>
        </div>

        {/* Payments and trust */}
        <div className="mt-10 flex flex-col gap-3 border-t border-slate-800/70 pt-5 sm:flex-row sm:items-center sm:justify-between text-left">
          <p className="flex items-center gap-2 text-xs text-slate-400"><ShieldCheck className="h-4 w-4 shrink-0 text-[#44df95]" aria-hidden="true" />Secure Mobile Money checkout · Orders you can track</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><span className="text-slate-500">Pay with</span><span className="font-semibold text-amber-300">MTN MoMo</span><span className="font-semibold text-red-300">Telecel Cash</span><span className="font-semibold text-sky-300">AT Money</span></p>
        </div>

        {/* Legal strip */}
        <div className="flex flex-col gap-2 border-t border-slate-800/70 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between text-left">
          <p>© {year} Mystery Hub. All rights reserved. <span className="text-slate-600">{contact.supportLocation}</span></p>
          <a href="/admin" onClick={event => { event.preventDefault(); setActivePage('admin'); }} className="self-start sm:self-auto inline-flex min-h-10 items-center text-slate-600 hover:text-slate-400 transition-colors">Staff Portal</a>
        </div>
      </div>
    </footer>
  );
};
