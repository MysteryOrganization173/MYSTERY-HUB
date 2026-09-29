import React from 'react';
import { BrandLogo } from './BrandLogo';
import { useApp } from '../../context/AppContext';
import { MessageSquare, ShieldCheck, Heart, ArrowUpRight } from 'lucide-react';

export const Footer: React.FC = () => {
  const { setActivePage } = useApp();

  return (
    <footer className="bg-[#070b0e] border-t border-slate-800/80 text-slate-400 text-sm mt-20 pb-20 md:pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800/60">
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <BrandLogo size="md" />
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              Your Digital World. One Hub. Mystery Hub empowers individuals, creators, and businesses in Ghana with instant data, professional websites, and everyday digital utilities.
            </p>

            <div className="pt-2 flex items-center gap-3">
              <a
                href="https://wa.me/233550000000?text=Hello%20Mystery%20Hub%2C%20I%20need%20assistance%20with%20my%20order"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#00c365]/10 hover:bg-[#00c365]/20 text-[#00c365] text-xs font-semibold transition-colors border border-[#00c365]/30"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp Support (+233)</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 pt-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>MoMo Encrypted & Instant SIM Delivery</span>
            </div>
          </div>

          {/* Quick Links: Services */}
          <div className="space-y-3">
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider">Services</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => setActivePage('data')}
                  className="hover:text-white transition-colors text-left"
                >
                  MTN Data Bundles
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActivePage('data')}
                  className="hover:text-white transition-colors text-left"
                >
                  Telecel Data Bundles
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActivePage('data')}
                  className="hover:text-white transition-colors text-left"
                >
                  AirtelTigo (AT) Data
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActivePage('data')}
                  className="hover:text-white transition-colors text-left"
                >
                  Instant Airtime Top-Up
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActivePage('website')}
                  className="hover:text-white transition-colors text-left flex items-center gap-1.5"
                >
                  <span>Website Builder</span>
                  <span className="text-[10px] text-[#00c365] font-semibold">Popular</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Coming Soon Utilities */}
          <div className="space-y-3">
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider">Future Utilities</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => setActivePage('services')}
                  className="hover:text-white transition-colors text-left"
                >
                  ECG Prepaid Tokens
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActivePage('services')}
                  className="hover:text-white transition-colors text-left"
                >
                  WAEC Results Checker
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActivePage('services')}
                  className="hover:text-white transition-colors text-left"
                >
                  DStv / GOtv Subscriptions
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActivePage('services')}
                  className="hover:text-white transition-colors text-left"
                >
                  Business Registration (ORC)
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActivePage('services')}
                  className="hover:text-white transition-colors text-left"
                >
                  Mystery Hub Wallet
                </button>
              </li>
            </ul>
          </div>

          {/* Company & Legal */}
          <div className="space-y-3">
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider">Platform</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => setActivePage('about')}
                  className="hover:text-white transition-colors text-left"
                >
                  About Mystery Hub
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActivePage('orders')}
                  className="hover:text-white transition-colors text-left"
                >
                  Track My Order
                </button>
              </li>
              <li>
                <span className="text-slate-500">Accra, Ghana 🇬🇭</span>
              </li>
              <li>
                <span className="text-slate-500">Made for Ghana with Pride</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom row: Networks and copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>© 2026 Mystery Hub Ghana. All rights reserved.</span>
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
