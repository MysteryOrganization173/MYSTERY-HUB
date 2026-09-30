import React from 'react';
import { useApp } from '../../context/AppContext';
import { WEBSITE_TEMPLATES } from '../../data/templates';
import { TemplateCardPreview } from '../website/TemplateCardPreview';
import { Globe, ArrowRight, Smartphone, Zap, Sparkles } from 'lucide-react';

export const HomeWebsiteSection: React.FC = () => {
  const { setActivePage, openTemplatePreview } = useApp();

  // 3 sample templates for the home showcase
  const previewTemplates = WEBSITE_TEMPLATES.slice(0, 3);

  return (
    <section className="py-8 sm:py-12 lg:py-16 bg-[#090d10] border-y border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8 lg:space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00c365]">
              <Globe className="w-3.5 h-3.5" />
              <span>Built for Ghanaian Businesses</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Start Your Business. <br />
              <span className="text-[#00c365]">Create Your Website.</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl leading-relaxed">
              Launch a professional online presence in minutes without writing a single line of code. Designed for restaurants, contractors, boutiques, salons, and consultancies in Ghana.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActivePage('website')}
              className="px-5 py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,195,101,0.25)] flex items-center gap-2 cursor-pointer"
            >
              <span>Explore All Templates</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3 Template Previews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {previewTemplates.map((t) => (
            <TemplateCardPreview
              key={t.id}
              template={t}
              onPreview={() => openTemplatePreview(t)}
            />
          ))}
        </div>

        {/* Value Prop strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs text-slate-300">
          <div className="p-4 rounded-xl bg-[#0e141a] border border-slate-800/80 flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-[#00c365] shrink-0" />
            <span>100% Mobile responsive on all Ghana smartphone devices</span>
          </div>
          <div className="p-4 rounded-xl bg-[#0e141a] border border-slate-800/80 flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-400 shrink-0" />
            <span>Native WhatsApp and Ghana Mobile Money integration</span>
          </div>
          <div className="p-4 rounded-xl bg-[#0e141a] border border-slate-800/80 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-sky-400 shrink-0" />
            <span>Free starter plan included for every new business</span>
          </div>
        </div>
      </div>
    </section>
  );
};
