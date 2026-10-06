import { SafeImage } from '../SafeImage.js';
import React, { useState } from 'react';
import { WebsiteTemplate } from '../../../types';
import {
  Cpu,
  Zap,
  Terminal,
  Server,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface TemplateViewProps {
  template: WebsiteTemplate;
  onCtaClick?: () => void;
}

export const TechAgencyTemplateView: React.FC<TemplateViewProps> = ({ template, onCtaClick }) => {
  const [scheduled, setScheduled] = useState<boolean>(false);
  const products = template.items || [];

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (template.siteContent) { onCtaClick?.(); return; }
    setScheduled(true);
    setTimeout(() => setScheduled(false), 5000);
  };

  return (
    <div className="bg-[var(--website-background,#070a0f)] text-slate-100 font-sans min-h-full">
      {/* Top Cyber Line */}
      <div className="bg-[#0f141c] border-b border-slate-800/80 px-4 sm:px-8 py-2 text-xs flex items-center justify-between text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#06b6d4] " />
          <span className="text-slate-300">{template.demoBusinessName}</span>
        </div>
        <div className="text-[11px] text-cyan-400">{template.location}</div>
      </div>

      {/* Navigation */}
      <nav className="bg-[#090d14]/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[var(--website-accent,#8b5cf6)] to-[#06b6d4] p-0.5 flex items-center justify-center font-black">
            <Cpu className="w-5 h-5 text-black" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-white block leading-none font-mono">
              {template.demoBusinessName}
            </span>
            <span className="text-[10px] text-[#06b6d4] uppercase tracking-widest font-mono font-bold block mt-0.5">
              Cloud & Fintech Infrastructure
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 text-xs font-mono tracking-wider text-slate-400">
          <a href="#solutions" className="hover:text-[#06b6d4] transition-colors">
            Architecture
          </a>
          <a href="#metrics" className="hover:text-[#06b6d4] transition-colors">
            Highlights
          </a>
          <a href="#discovery" className="hover:text-[#06b6d4] transition-colors">
            Discovery Call
          </a>
        </div>

        <button
          onClick={onCtaClick}
          className="px-4 py-2 rounded-xl bg-[var(--website-accent,#8b5cf6)] hover:bg-[#7c3aed] text-white font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] flex items-center gap-1.5 cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>{template.siteContent?.ctaLabel || 'Book Discovery Call'}</span>
        </button>
      </nav>

      {/* Hero Section */}
      <div className="relative py-16 sm:py-24 px-6 sm:px-12 bg-gradient-to-b from-[#090d14] via-[#0d131f] to-[var(--website-background,#070a0f)] border-b border-slate-800 overflow-hidden">
        <SafeImage className="absolute inset-0 opacity-40  " src={template.heroImage || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa'} alt={template.demoBusinessName} loading="eager" fetchPriority="high" />
        <div className="relative max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--website-accent,#8b5cf6)]/15 border border-[var(--website-accent,#8b5cf6)]/40 text-[#c084fc] text-xs font-mono font-bold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5 text-[#06b6d4]" />
            <span>Mission-Critical African Enterprise Engineering</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.08] text-white">
            {template.demoHeroTagline}
          </h1>

          <p className="text-sm sm:text-base text-slate-300 font-sans max-w-xl leading-relaxed">
            {template.demoSubtext}
          </p>

          <div className="pt-2 flex flex-wrap gap-3 font-mono">
            <a
              href="#discovery"
              className="px-6 py-3.5 rounded-xl bg-[#06b6d4] hover:bg-[#0891b2] text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center gap-2"
            >
              <span>Schedule Architecture Audit</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#solutions"
              className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider border border-slate-700 transition-all flex items-center gap-2"
            >
              <span>Explore Tech Stack</span>
            </a>
          </div>

          {/* Live Metrics */}
          <div id="metrics" className="pt-8 grid grid-cols-3 gap-4 border-t border-slate-800/90 max-w-lg font-mono">
            {template.stats?.map((stat, idx) => (
              <div key={idx} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <div className="text-2xl font-bold text-[#06b6d4]">{stat.value}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Case Studies / Solutions Showcase */}
      <div id="solutions" className="py-16 px-4 sm:px-12 max-w-6xl mx-auto space-y-8 font-mono">
        <div className="space-y-1">
          <span className="text-xs uppercase text-[var(--website-accent,#8b5cf6)] tracking-widest font-bold">
            Flagship Systems
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">Engineered for Scale</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
          {products.map((item) => (
            <div
              key={item.id}
              className="bg-[#0f141c] rounded-2xl border border-slate-800 p-6 space-y-4 hover:border-[var(--website-accent,#8b5cf6)]/50 transition-colors"
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#06b6d4] font-bold">{item.category}</span>
                <span className="text-slate-500">Sub-second Latency</span>
              </div>
              <h3 className="font-bold text-lg text-white font-mono">{item.name}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>

              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/80 font-mono">
                {item.specs?.map((s, i) => (
                  <span
                    key={i}
                    className="text-[10px] bg-slate-900 text-slate-300 px-2.5 py-1 rounded-md border border-slate-800"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Discovery Call Booking */}
      <div id="discovery" className="py-16 px-4 sm:px-12 max-w-3xl mx-auto font-mono">
        <div className="bg-[#0f141c] border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#06b6d4] uppercase tracking-widest">
              Direct Engagement
            </span>
            <h3 className="text-2xl font-black text-white">Schedule 30-Min Technical Discovery</h3>
            <p className="text-xs text-slate-400 font-sans">
              Contact us to discuss your project and arrange a conversation.
            </p>
          </div>

          {scheduled ? (
            <div className="p-6 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-center space-y-2">
              <CheckCircle className="w-10 h-10 text-cyan-400 mx-auto" />
              <h4 className="font-bold text-cyan-300 text-base">Example conversation</h4>
              <p className="text-xs text-slate-300 font-sans">
                Preview only. No invitation has been sent.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSchedule} className="space-y-4 font-sans text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="CTO / Lead Engineer Name"
                  className="w-full bg-[var(--website-background,#070a0f)] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[var(--website-accent,#8b5cf6)]"
                  required
                />
                <input
                  type="email"
                  placeholder="Enterprise Work Email"
                  className="w-full bg-[var(--website-background,#070a0f)] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[var(--website-accent,#8b5cf6)]"
                  required
                />
              </div>

              <select className="w-full bg-[var(--website-background,#070a0f)] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[var(--website-accent,#8b5cf6)]">
                <option>Fintech API Switch & MoMo Settlement Rails</option>
                <option>Cloud Infrastructure Migration & DevSecOps</option>
                <option>Enterprise Microservices Architecture</option>
              </select>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-[var(--website-accent,#8b5cf6)] hover:bg-[#7c3aed] text-white font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                <span>{template.siteContent ? 'Contact to Arrange a Session' : 'Confirm Architecture Session'}</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#05080c] border-t border-slate-800 py-10 px-6 sm:px-12 text-xs font-mono text-slate-400">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="font-bold text-white text-base font-mono">
              {template.demoBusinessName}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              {template.demoSubtext}
            </p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase text-xs">Engineering HQ</h5>
            <p className="text-xs">{template.location}</p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase text-xs">Operations Switch</h5>
            <p className="text-xs">{template.hoursOrContact}</p>
          </div>
        </div>
        <div className="border-t border-slate-900 mt-8 pt-4 text-center text-slate-600 text-[10px]">
          © 2026 {template.demoBusinessName}. Powered by Mystery Hub Sites Ghana.
        </div>
      </footer>
    </div>
  );
};
