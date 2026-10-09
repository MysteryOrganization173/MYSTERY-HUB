import React from 'react';
import { BrandLogo } from './BrandLogo';
import { useApp } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';
import {
  MessageSquare,
  ShieldCheck,
  Heart,
  ArrowUpRight,
  Phone,
  Mail,
  Radio,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';

export const Footer: React.FC = () => {
  const { setActivePage } = useApp();

  return (
    <footer className="bg-[#070b0e] border-t border-slate-800/80 text-slate-400 text-sm mt-8 sm:mt-12 lg:mt-14 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8 lg:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-8 lg:gap-10 pb-5 sm:pb-8 border-b border-slate-800/60">
          {/* Brand Col & Direct Contact */}
          <div className="lg:col-span-2 space-y-3 text-left">
            <BrandLogo size="md" />
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-sm">
              Everything digital. One trusted place. Buy data and airtime, build a business website and explore Marketplace items in Ghana. More services are coming soon.
            </p>

            {/* Direct Contact Links */}
            <div className="pt-0.5 flex flex-wrap items-center gap-2">
              <a
                href={BUSINESS_CONFIG.contact.supportWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00c365]/10 hover:bg-[#00c365]/20 text-[#00c365] text-xs font-semibold transition-colors border border-[#00c365]/30 cursor-pointer min-h-[36px]"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>

              <a
                href={BUSINESS_CONFIG.contact.phoneLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-800 transition-colors min-h-[36px]"
              >
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>0592066298</span>
              </a>

              <a
                href={BUSINESS_CONFIG.contact.emailLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-800 transition-colors min-h-[36px]"
              >
                <Mail className="w-3.5 h-3.5 text-sky-400" />
                <span>Email</span>
              </a>
            </div>

            {/* Official WhatsApp Channel Follow Card */}
            <div className="p-2.5 sm:p-3 rounded-xl bg-[#091512] border border-[#00c365]/25 max-w-sm space-y-1">
              <div className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#00c365]" />
                <span className="text-xs font-bold text-white">
                  Follow Mystery Hub Channel
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Service updates, tech product drops, and announcements on our WhatsApp Channel.
              </p>
              <a
                href={BUSINESS_CONFIG.contact.whatsappChannelUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00c365] hover:text-[#00e575] transition-colors pt-0.5"
              >
                <span>Join Official Channel</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 pt-0.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Secure checkout · Orders you can track</span>
            </div>
          </div>

          {/* Grouped Link Columns: 2 cols on mobile, 3 cols on sm/desktop */}
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-5 sm:gap-6 lg:gap-8">
            {/* Quick Links: Services */}
            <div className="space-y-2 text-left">
              <h4 className="text-white font-semibold text-xs uppercase tracking-wider">Services</h4>
              <ul className="space-y-1 sm:space-y-1.5 text-xs">
                <li>
                  <button
                    onClick={() => setActivePage('data')}
                    className="hover:text-white transition-colors text-left py-0.5 cursor-pointer block"
                  >
                    Data Bundles
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActivePage('afa')}
                    className="hover:text-white transition-colors text-left py-0.5 flex items-center gap-1 cursor-pointer"
                  >
                    <span>AFA Registration</span>
                    <span className="text-[9px] text-[#00c365] font-semibold">Check Status</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActivePage('website')}
                    className="hover:text-white transition-colors text-left py-0.5 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Website Builder</span>
                    <span className="text-[9px] text-sky-400 font-semibold">Beta</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActivePage('marketplace')}
                    className="hover:text-white transition-colors text-left py-0.5 flex items-center gap-1 cursor-pointer"
                  >
                    <ShoppingBag className="w-3 h-3 text-[#00c365]" />
                    <span>Marketplace</span>
                    <span className="text-[9px] text-[#00c365] font-semibold">New</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActivePage('earn')}
                    className="hover:text-white transition-colors text-left py-0.5 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Mystery Earn</span>
                    <span className="text-[9px] text-amber-400 font-semibold">Rewards</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActivePage('wallet')}
                    className="hover:text-white transition-colors text-left py-0.5 cursor-pointer block"
                  >
                    Mystery Wallet
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActivePage('services')}
                    className="text-slate-400 hover:text-white transition-colors text-left py-0.5 cursor-pointer block"
                  >
                    More Services →
                  </button>
                </li>
              </ul>
            </div>

            {/* Platform & Support */}
            <div className="space-y-2 text-left">
              <h4 className="text-white font-semibold text-xs uppercase tracking-wider">About &amp; Support</h4>
              <ul className="space-y-1 sm:space-y-1.5 text-xs">
                <li>
                  <button
                    onClick={() => setActivePage('about')}
                    className="hover:text-white transition-colors text-left py-0.5 cursor-pointer block"
                  >
                    About Mystery Hub
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActivePage('orders')}
                    className="hover:text-white transition-colors text-left py-0.5 cursor-pointer block"
                  >
                    Track My Order
                  </button>
                </li>
                <li>
                  <a
                    href={BUSINESS_CONFIG.contact.phoneLink}
                    className="hover:text-white transition-colors text-left py-0.5 block truncate"
                  >
                    0592066298
                  </a>
                </li>
                <li>
                  <a
                    href={BUSINESS_CONFIG.contact.emailLink}
                    className="hover:text-white transition-colors text-left py-0.5 block truncate"
                    title="aryeeteyemmanuel852@gmail.com"
                  >
                    aryeeteyemmanuel852@gmail.com
                  </a>
                </li>
                <li>
                  <span className="text-slate-500 py-0.5 block">Accra, Ghana 🇬🇭</span>
                </li>
              </ul>
            </div>

            {/* Upcoming Utilities */}
            <div className="col-span-2 sm:col-span-1 space-y-2 text-left">
              <h4 className="text-white font-semibold text-xs uppercase tracking-wider">Coming Soon</h4>
              <ul className="grid grid-cols-2 sm:grid-cols-1 gap-1 sm:gap-1.5 text-xs">
                <li>
                  <button
                    onClick={() => setActivePage('services')}
                    className="hover:text-white transition-colors text-left py-0.5 cursor-pointer block"
                  >
                    ECG Prepaid Bills
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActivePage('services')}
                    className="hover:text-white transition-colors text-left py-0.5 cursor-pointer block"
                  >
                    WAEC Results PINs
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActivePage('services')}
                    className="hover:text-white transition-colors text-left py-0.5 cursor-pointer block"
                  >
                    DStv & GOtv Pay
                  </button>
                </li>

              </ul>
            </div>
          </div>
        </div>

        {/* Bottom row: Networks and copyright */}
        <div className="pt-4 sm:pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span>© 2026 Mystery Hub Ghana. All rights reserved.</span>
            <span className="text-slate-700">·</span>
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                setActivePage('admin');
              }}
              className="text-slate-600 hover:text-slate-400 text-[11px] transition-colors cursor-pointer"
            >
              Staff Portal
            </a>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <span className="text-[11px] text-slate-500 hidden xs:inline">Accepted:</span>
            <span className="text-amber-400 font-semibold text-xs">MTN MoMo</span>
            <span className="text-slate-600">·</span>
            <span className="text-red-400 font-semibold text-xs">Telecel Cash</span>
            <span className="text-slate-600">·</span>
            <span className="text-sky-400 font-semibold text-xs">AT Money</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>Crafted with</span>
            <Heart className="w-3 h-3 text-red-500 fill-red-500 inline mx-0.5" />
            <span>for Ghana</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
