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
    <footer className="bg-[#070b0e] border-t border-slate-800/80 text-slate-400 text-sm mt-16 sm:mt-20 pb-24 md:pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 sm:gap-10 pb-12 border-b border-slate-800/60">
          {/* Brand Col & Direct Contact */}
          <div className="lg:col-span-2 space-y-4 text-left">
            <BrandLogo size="md" />
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-sm">
              Your Digital World. One Hub. Mystery Hub empowers individuals, creators, and businesses in Ghana with reliable data, professional websites, tech marketplace sourcing, and everyday digital utilities.
            </p>

            {/* Direct Contact Links */}
            <div className="pt-1 flex flex-wrap items-center gap-2">
              <a
                href={BUSINESS_CONFIG.contact.supportWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00c365]/10 hover:bg-[#00c365]/20 text-[#00c365] text-xs font-semibold transition-colors border border-[#00c365]/30 cursor-pointer min-h-[38px]"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat on WhatsApp</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>

              <a
                href={BUSINESS_CONFIG.contact.phoneLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-800 transition-colors min-h-[38px]"
              >
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>0592066298</span>
              </a>

              <a
                href={BUSINESS_CONFIG.contact.emailLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-800 transition-colors min-h-[38px]"
              >
                <Mail className="w-3.5 h-3.5 text-sky-400" />
                <span>Email Us</span>
              </a>
            </div>

            {/* Official WhatsApp Channel Follow Card */}
            <div className="p-3.5 rounded-xl bg-[#091512] border border-[#00c365]/25 max-w-sm space-y-1.5">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#00c365]" />
                <span className="text-xs font-bold text-white">
                  Follow Mystery Hub on WhatsApp
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Get service updates, tech product drops, new website templates, and announcements on our official WhatsApp Channel.
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

            <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Secure MoMo Checkout & Direct Fulfillment</span>
            </div>
          </div>

          {/* Quick Links: Services */}
          <div className="space-y-3 text-left">
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider">Services</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => setActivePage('data')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  MTN Data Bundles
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActivePage('data')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Telecel Data Bundles
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActivePage('data')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  AirtelTigo (AT) Data
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActivePage('website')}
                  className="hover:text-white transition-colors text-left flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Website Builder</span>
                  <span className="text-[10px] text-[#00c365] font-semibold">Beta</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActivePage('marketplace')}
                  className="hover:text-white transition-colors text-left flex items-center gap-1.5 cursor-pointer"
                >
                  <ShoppingBag className="w-3 h-3 text-[#00c365]" />
                  <span>Tech Marketplace</span>
                  <span className="text-[10px] text-[#00c365] font-semibold">New</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Coming Soon Utilities */}
          <div className="space-y-3 text-left">
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider">Future Utilities</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => setActivePage('services')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  ECG Prepaid Tokens
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActivePage('services')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  WAEC Results Checker
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActivePage('services')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  DStv / GOtv Subscriptions
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActivePage('services')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Business Registration (ORC)
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActivePage('services')}
                  className="hover:text-white transition-colors text-left flex items-center gap-1 cursor-pointer"
                >
                  <span>Mystery Hub Wallet</span>
                  <span className="text-[9px] text-slate-500 uppercase">Coming Soon</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Company & Legal */}
          <div className="space-y-3 text-left">
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider">Platform & Support</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => setActivePage('about')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  About Mystery Hub
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActivePage('orders')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Track My Order
                </button>
              </li>
              <li>
                <a
                  href={BUSINESS_CONFIG.contact.phoneLink}
                  className="hover:text-white transition-colors text-left block"
                >
                  Phone: 0592066298
                </a>
              </li>
              <li>
                <a
                  href={BUSINESS_CONFIG.contact.emailLink}
                  className="hover:text-white transition-colors text-left block truncate"
                  title="aryeeteyemmanuel852@gmail.com"
                >
                  aryeeteyemmanuel852@gmail.com
                </a>
              </li>
              <li>
                <span className="text-slate-500">Accra, Ghana 🇬🇭</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom row: Networks and copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
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

          <div className="flex items-center gap-4 text-slate-400">
            <span className="text-[11px] text-slate-500">Accepted Networks:</span>
            <span className="text-amber-400 font-semibold text-xs">MTN MoMo</span>
            <span className="text-slate-600">·</span>
            <span className="text-red-400 font-semibold text-xs">Telecel Cash</span>
            <span className="text-slate-600">·</span>
            <span className="text-sky-400 font-semibold text-xs">AT Money</span>
          </div>

          <div className="flex items-center gap-1 text-[11px]">
            <span>Crafted with</span>
            <Heart className="w-3 h-3 text-red-500 fill-red-500" />
            <span>for Ghana</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
