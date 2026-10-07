import { BusinessEnquiry } from '../BusinessEnquiry.js';
import { SafeImage } from '../SafeImage.js';
import React, { useState } from 'react';
import { WebsiteTemplate } from '../../../types';
import {
  HardHat,
  Building2,
  ShieldCheck,
  Hammer,
  Truck,
  ArrowRight,
  CheckCircle2,
  Phone,
  FileText,
  Clock,
  MapPin,
} from 'lucide-react';

interface TemplateViewProps {
  template: WebsiteTemplate;
  onCtaClick?: () => void;
}

export const ConstructionTemplateView: React.FC<TemplateViewProps> = ({ template, onCtaClick }) => {
  const [activeTab, setActiveTab] = useState<string>('All');
  const [quoteSubmitted, setQuoteSubmitted] = useState<boolean>(false);

  const projects = template.items || [];
  const filteredProjects = projects.filter((p) => {
    if (activeTab === 'All') return true;
    return p.category === activeTab;
  });

  const handleQuoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (template.siteContent) { onCtaClick?.(); return; }
    setQuoteSubmitted(true);
    setTimeout(() => setQuoteSubmitted(false), 5000);
  };

  return (
    <div className="bg-[var(--website-background,#0b1118)] text-slate-100 font-sans min-h-full">
      {/* Heavy Engineering Utility Top Bar */}
      <div className="bg-[#070b10] border-b border-slate-800 px-4 sm:px-8 py-2 text-xs flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-400">
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-[var(--website-accent,#f97316)]" />
            <span>{template.location}</span>
          </span>
          <span className="hidden md:inline-flex items-center gap-1 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Contact for opening hours</span>
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-[var(--website-accent,#f97316)] font-bold">Project enquiries welcome</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300">Discuss your requirements</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="bg-[#0e1620]/95 backdrop-blur-md border-b border-slate-800/90 px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--website-accent,#f97316)] text-black flex items-center justify-center font-black text-xl tracking-tighter">
            <HardHat className="w-6 h-6 text-black" />
          </div>
          <div>
            <span className="font-black text-base sm:text-lg tracking-tight text-white block uppercase leading-none">
              {template.demoBusinessName}
            </span>
            <span className="text-[10px] text-[var(--website-accent,#f97316)] uppercase tracking-widest font-mono font-bold block mt-0.5">
              Civil & Structural Engineers Ghana
            </span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-6 text-xs font-bold uppercase tracking-wider text-slate-300">
          <a href="#projects" className="hover:text-[var(--website-accent,#f97316)] transition-colors">
            Projects Portfolio
          </a>
          <a href="#capabilities" className="hover:text-[var(--website-accent,#f97316)] transition-colors">
            Capabilities
          </a>
          <a href="#quote" className="hover:text-[var(--website-accent,#f97316)] transition-colors">
            Tender Estimate
          </a>
          <a href="#safety" className="hover:text-[var(--website-accent,#f97316)] transition-colors">
            Capabilities
          </a>
        </div>

        <button
          onClick={onCtaClick}
          className="px-4 py-2 rounded-lg bg-[var(--website-accent,#f97316)] hover:bg-[#ea580c] text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(249,115,22,0.3)] flex items-center gap-1.5 cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{template.siteContent?.ctaLabel || 'Request Tender Consultation'}</span>
        </button>
      </nav>

      {/* Hero Section */}
      <div className="relative py-16 sm:py-24 px-6 sm:px-12 bg-gradient-to-r from-[#090d13] via-[#0d1520] to-[#121c29] border-b border-slate-800 overflow-hidden">
        <SafeImage className="absolute inset-0 opacity-40   mix-blend-luminosity" src={template.heroImage || 'https://images.unsplash.com/photo-1504307651254-35680f356dfd'} alt={template.demoBusinessName} loading="eager" fetchPriority="high" />
        {/* Architectural diagonal lines overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="relative max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[var(--website-accent,#f97316)]/15 border border-[var(--website-accent,#f97316)]/40 text-[var(--website-accent,#f97316)] text-xs font-mono font-bold uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5" />
            <span>Heavy Civil & Commercial Engineering</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white leading-[1.08]">
            {template.demoHeroTagline}
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
            {template.demoSubtext}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <a
              href="#quote"
              className="px-6 py-3.5 rounded-lg bg-[var(--website-accent,#f97316)] hover:bg-[#ea580c] text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-2"
            >
              <span>{template.siteContent ? 'Request a Project Estimate' : 'Instant Tender Cost Calculator'}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#projects"
              className="px-6 py-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider border border-slate-700 transition-all flex items-center gap-2"
            >
              <span>View projects</span>
            </a>
          </div>

          {/* Industrial Key Statistics Grid */}
          <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-800 max-w-2xl">
            {template.stats?.map((stat, idx) => (
              <div key={idx} className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                <div className="text-2xl font-black text-[var(--website-accent,#f97316)] font-mono">{stat.value}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Projects Showcase Section */}
      <div id="projects" className="py-16 px-4 sm:px-12 max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-widest text-[var(--website-accent,#f97316)] font-mono font-bold block">
              Project portfolio
            </span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase text-white mt-1">
              Our projects
            </h2>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {(template.siteContent ? ['All', ...new Set(projects.map(item=>item.category).filter((category):category is string=>Boolean(category) && category!=='All'))] : ['All', 'Commercial', 'Residential', 'Industrial']).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`px-3.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === cat
                    ? 'bg-[var(--website-accent,#f97316)] text-black shadow'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Project Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredProjects.map((p) => (
            <div
              key={p.id}
              className="bg-[#101822] rounded-xl border border-slate-800 overflow-hidden shadow-lg hover:border-[var(--website-accent,#f97316)]/50 transition-colors flex flex-col justify-between group"
            >
              <div>
                {p.image && (
                  <div className="h-44 overflow-hidden relative bg-slate-900">
                    <SafeImage
                      src={p.image}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2.5 right-2.5 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-[var(--website-accent,#f97316)] font-bold border border-[var(--website-accent,#f97316)]/30">
                      {p.price}
                    </div>
                  </div>
                )}
                <div className="p-5 space-y-2">
                  <div className="text-[10px] font-mono uppercase text-[var(--website-accent,#f97316)] font-bold">
                    {p.category} Construction
                  </div>
                  <h3 className="font-bold text-base text-white">{p.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{p.desc}</p>
                </div>
              </div>

              <div className="p-5 pt-0">
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800">
                  {p.specs?.map((spec, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Core Engineering Capabilities Grid */}
      <div id="capabilities" className="py-14 px-4 sm:px-12 bg-[#080d13] border-y border-slate-800">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <span className="text-xs font-mono font-bold text-[var(--website-accent,#f97316)] uppercase">
              Technical Capabilities
            </span>
            <h3 className="text-2xl font-black uppercase text-white">Full-Spectrum Contracting</h3>
            <p className="text-xs text-slate-400">
              End-to-end engineering, procurement, and construction (EPC) solutions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Building2,
                title: 'Commercial High-Rises',
                desc: 'Deep piling, post-tensioned slabs, and curtain-wall installations.',
              },
              {
                icon: Hammer,
                title: 'Structural Steelwork',
                desc: 'Precision steel fabrication, heavy warehouse trusses, and aircraft hangars.',
              },
              {
                icon: Truck,
                title: 'Civil & Road Infrastructure',
                desc: 'Asphalt paving, bridge construction, stormwater drainage, and culverts.',
              },
              {
                icon: ShieldCheck,
                title: 'Turnkey Project Delivery',
                desc: 'Architectural compliance, MEP engineering, and Ministry of Works sign-offs.',
              },
            ].map((cap, i) => (
              <div
                key={i}
                className="p-5 bg-[#0f1722] rounded-xl border border-slate-800 space-y-3 hover:border-[var(--website-accent,#f97316)]/40 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-[var(--website-accent,#f97316)]/10 text-[var(--website-accent,#f97316)] flex items-center justify-center">
                  <cap.icon className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-white">{cap.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{cap.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Instant Project Consultation & Tender Cost Estimator */}
      <div id="quote" className="py-16 px-4 sm:px-12 max-w-4xl mx-auto">
        <div className="bg-[#111923] border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold text-[var(--website-accent,#f97316)] uppercase">
              Tender Intake Portal
            </span>
            <h3 className="text-2xl font-black uppercase text-white">
              Request Project Estimate & Feasibility
            </h3>
            <p className="text-xs text-slate-400">
              Contact the business to discuss project scope, qualifications and estimates.
            </p>
          </div>

          {template.siteContent ? <BusinessEnquiry onContact={onCtaClick}/> : quoteSubmitted ? (
            <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="font-bold text-emerald-300 text-base">Tender Request Received</h4>
              <p className="text-xs text-slate-300">
                Example only. No project request has been sent.
              </p>
            </div>
          ) : (
            <form onSubmit={handleQuoteSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                    Project Type
                  </label>
                  <select className="w-full bg-[var(--website-background,#0b1118)] border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--website-accent,#f97316)]">
                    <option>Commercial Multi-Storey Building</option>
                    <option>Residential Estate / Luxury Villa</option>
                    <option>Industrial Warehouse / Logistics Yard</option>
                    <option>Road Paving & Civil Infrastructure</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                    Site Location in Ghana
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Airport Residential, Accra"
                    className="w-full bg-[var(--website-background,#0b1118)] border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--website-accent,#f97316)]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                    Contact Person / Company Name
                  </label>
                  <input
                    type="text"
                    placeholder="Full Name / Company Name"
                    className="w-full bg-[var(--website-background,#0b1118)] border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--website-accent,#f97316)]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                    Ghana Phone / WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +233 24 000 0000"
                    className="w-full bg-[var(--website-background,#0b1118)] border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--website-accent,#f97316)]"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-lg bg-[var(--website-accent,#f97316)] hover:bg-[#ea580c] text-black font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <HardHat className="w-4 h-4 text-black" />
                <span>{template.siteContent ? 'Contact About Your Project' : 'Submit Tender Intake for Certified BOQ'}</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Industrial Footer */}
      <footer id="safety" className="bg-[#070b10] border-t border-slate-800 py-10 px-6 sm:px-12 text-xs">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-slate-400">
          <div className="space-y-2">
            <h4 className="font-black text-white text-base uppercase">
              {template.demoBusinessName}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              {template.demoSubtext}
            </p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase text-xs">Operating Headquarters</h5>
            <p className="text-xs">{template.location}</p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase text-xs">Direct Contract Lines</h5>
            <p className="text-xs">{template.hoursOrContact}</p>
          </div>
        </div>
        <div className="border-t border-slate-800 mt-8 pt-4 text-center text-slate-500 text-[10px]">
          © 2026 {template.demoBusinessName}. Powered by Mystery Hub Sites Ghana.
        </div>
      </footer>
    </div>
  );
};
