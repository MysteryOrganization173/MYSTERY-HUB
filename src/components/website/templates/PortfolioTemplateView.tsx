import { BusinessEnquiry } from '../BusinessEnquiry';
import { SafeImage } from '../SafeImage.js';
import React, { useState } from 'react';
import { WebsiteTemplate } from '../../../types';
import {
  Camera,
  Film,
  Award,
  Mail,
  ArrowRight,
  Eye,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';

interface TemplateViewProps {
  template: WebsiteTemplate;
  onCtaClick?: () => void;
}

export const PortfolioTemplateView: React.FC<TemplateViewProps> = ({ template, onCtaClick }) => {
  const [filter, setFilter] = useState<string>('All');
  const [commissionBooked, setCommissionBooked] = useState<boolean>(false);

  const works = template.items || [];
  const filteredWorks = works.filter((w) => {
    if (filter === 'All') return true;
    return w.category === filter;
  });

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (template.siteContent) { onCtaClick?.(); return; }
    setCommissionBooked(true);
    setTimeout(() => setCommissionBooked(false), 5000);
  };

  return (
    <div className="bg-[var(--website-primary,#09090b)] text-[#fafafa] font-sans min-h-full selection:bg-[var(--website-accent,#00c365)] selection:text-black">
      {/* Top Minimal Strip */}
      <div className="bg-black/90 border-b border-[#27272a] px-4 sm:px-8 py-2 text-xs flex items-center justify-between text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--website-accent,#00c365)] animate-pulse" />
          <span>Project enquiries</span>
        </div>
        <div className="text-[11px] text-zinc-500 font-mono">{template.location}</div>
      </div>

      {/* Navigation */}
      <nav className="bg-[var(--website-primary,#09090b)]/90 backdrop-blur-md border-b border-[#27272a] px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-base tracking-tighter text-white">
            KOFI LENS
          </span>
          <span className="text-[10px] text-[var(--website-accent,#00c365)] font-mono">/ visual dir.</span>
        </div>

        <div className="hidden md:flex items-center gap-6 text-xs font-mono tracking-wider text-zinc-400">
          <a href="#work" className="hover:text-white transition-colors">
            Selected Works
          </a>
          <a href="#exhibitions" className="hover:text-white transition-colors">
            Exhibitions & Press
          </a>
          <a href="#gear" className="hover:text-white transition-colors">
            Gear & Rates
          </a>
          <a href="#commission" className="hover:text-white transition-colors">
            Commission
          </a>
        </div>

        <button
          onClick={onCtaClick}
          className="px-4 py-1.5 rounded-full bg-[#fafafa] hover:bg-[var(--website-accent,#00c365)] hover:text-black text-black font-mono font-bold text-xs uppercase transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          <Mail className="w-3.5 h-3.5" />
          <span>{template.siteContent?.ctaLabel || 'Inquire Shoot'}</span>
        </button>
      </nav>

      {/* Full-Bleed Editorial Statement Hero */}
      <div className="relative py-20 sm:py-32 px-6 sm:px-12 border-b border-[#27272a] overflow-hidden">
        <SafeImage className="absolute inset-0 opacity-40   grayscale" src={template.heroImage || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32'} alt={template.demoBusinessName} loading="eager" fetchPriority="high" />
        <div className="relative max-w-4xl mx-auto space-y-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs font-mono">
            <Camera className="w-3.5 h-3.5 text-[var(--website-accent,#00c365)]" />
            <span>Documentary & Fashion Cinematography</span>
          </div>

          <h1 className="text-3xl sm:text-6xl font-black tracking-tight leading-[1.05] text-white">
            {template.demoHeroTagline}
          </h1>

          <p className="text-sm sm:text-base text-zinc-400 font-mono max-w-xl mx-auto leading-relaxed">
            {template.demoSubtext}
          </p>

          <div className="pt-4 flex flex-wrap justify-center gap-3 font-mono">
            <a
              href="#work"
              className="px-6 py-3 rounded-full bg-[var(--website-accent,#00c365)] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2"
            >
              <span>Explore Selected Work</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#commission"
              className="px-6 py-3 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider border border-zinc-700 transition-all flex items-center gap-2"
            >
              <span>Request Rate Card</span>
            </a>
          </div>

          {/* Exhibition Metrics */}
          <div className="pt-8 grid grid-cols-3 gap-4 border-t border-zinc-800/80 max-w-md mx-auto font-mono">
            {template.stats?.map((stat, i) => (
              <div key={i}>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Masonry Photography Showcase */}
      <div id="work" className="py-16 px-4 sm:px-12 max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 font-mono">
          <div>
            <span className="text-xs uppercase text-[var(--website-accent,#00c365)] tracking-widest block">
              Archive 2024 — 2026
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">Selected Projects</h2>
          </div>

          <div className="flex items-center gap-2">
            {(template.siteContent ? ['All', ...new Set(works.map(item=>item.category).filter((category):category is string=>Boolean(category) && category!=='All'))] : ['All', 'Documentary', 'Fashion', 'Landscape']).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                  filter === cat
                    ? 'bg-white text-black'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredWorks.map((work) => (
            <div
              key={work.id}
              className="group relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all"
            >
              {work.image && (
                <div className="h-72 overflow-hidden bg-zinc-950">
                  <SafeImage
                    src={work.image}
                    alt={work.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              )}
              <div className="p-5 space-y-1">
                <span className="text-[10px] font-mono text-[var(--website-accent,#00c365)] uppercase tracking-wider">
                  {work.category}
                </span>
                <h3 className="font-bold text-base text-white">{work.name}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{work.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Equipment & Rate Card */}
      <div id="gear" className="py-14 px-4 sm:px-12 bg-zinc-950 border-y border-zinc-800 font-mono text-xs">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-1">
            <span className="text-xs uppercase text-[var(--website-accent,#00c365)] tracking-widest">Production Setup</span>
            <h3 className="text-2xl font-black text-white">Commercial Kit & Day Rates</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-2">
              <h4 className="font-bold text-white text-sm">Cinema & Stills Package</h4>
              <p className="text-zinc-400 leading-relaxed">
                Sony FX6 Full-Frame Cinema Line, Leica M11 Rangefinder, G-Master f/1.2 primes, Aputure 600d lighting kit, and DJI Ronin 4D stabilization.
              </p>
            </div>
            <div className="p-5 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-2">
              <h4 className="font-bold text-white text-sm">Standard Commercial Day Rate</h4>
              <p className="text-zinc-400 leading-relaxed">
                Full-day shoot (up to 8 hours), master color grading, commercial licensing release, and RAW deliverables archived via cloud storage.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Commission Inquiry Form */}
      <div id="commission" className="py-16 px-4 sm:px-12 max-w-2xl mx-auto font-mono">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold text-[var(--website-accent,#00c365)] uppercase tracking-widest">
              Direct Booking
            </span>
            <h3 className="text-2xl font-black text-white">Commission a Shoot</h3>
            <p className="text-xs text-zinc-400 font-sans">
              Editorial campaigns, documentary features, and high-impact commercial imagery.
            </p>
          </div>

          {template.siteContent ? <BusinessEnquiry onContact={onCtaClick} /> : commissionBooked ? (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="font-bold text-emerald-300 text-base">Example enquiry</h4>
              <p className="text-xs text-zinc-300 font-sans">
                Preview only. No enquiry has been sent.
              </p>
            </div>
          ) : (
            <form onSubmit={handleBooking} className="space-y-4 font-sans text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Your Name / Organization"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[var(--website-accent,#00c365)]"
                  required
                />
                <input
                  type="email"
                  placeholder="Official Email Address"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[var(--website-accent,#00c365)]"
                  required
                />
              </div>

              <select className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[var(--website-accent,#00c365)]">
                <option>Commercial Advertising Campaign</option>
                <option>Documentary Film Project</option>
                <option>Fashion Editorial / Lookbook</option>
                <option>Private Collection / Exhibition Commission</option>
              </select>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-[var(--website-accent,#00c365)] hover:bg-[#00e575] text-black font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                <span>Submit Production Brief</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Minimal Footer */}
      <footer className="bg-black border-t border-zinc-900 py-8 px-6 text-center text-zinc-500 font-mono text-[10px]">
        © 2026 {template.demoBusinessName}. All rights reserved. Powered by Mystery Hub Sites Ghana.
      </footer>
    </div>
  );
};
