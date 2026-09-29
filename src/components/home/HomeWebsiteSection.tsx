import React from 'react';
import { useApp } from '../../context/AppContext';
import { WEBSITE_TEMPLATES } from '../../data/templates';
import { Globe, ArrowRight, Eye, Smartphone, Zap, Sparkles } from 'lucide-react';

export const HomeWebsiteSection: React.FC = () => {
  const { setActivePage, openTemplatePreview } = useApp();

  // 3 sample templates for the home showcase
  const previewTemplates = WEBSITE_TEMPLATES.slice(0, 3);

  return (
    <section className="py-12 sm:py-16 bg-[#090d10] border-y border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
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
            <div
              key={t.id}
              className="rounded-2xl bg-[#0e141a] border border-slate-800 overflow-hidden hover:border-[#00c365]/50 transition-all duration-200 flex flex-col justify-between group shadow-sm"
            >
              <div>
                {/* Visual Header */}
                <div
                  className="h-32 p-4 flex flex-col justify-between relative"
                  style={{
                    background: `linear-gradient(135deg, #0a1014 0%, #17242e 100%)`,
                  }}
                >
                  <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded w-fit">
                    {t.categoryLabel}
                  </span>
                  <div>
                    <div className="font-extrabold text-sm text-white">
                      {t.demoBusinessName}
                    </div>
                    <div className="text-[10px] text-slate-300 truncate">
                      {t.demoHeroTagline}
                    </div>
                  </div>
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1"
                    style={{ backgroundColor: t.accentColor }}
                  />
                </div>

                <div className="p-4 space-y-2">
                  <h4 className="font-bold text-sm text-white group-hover:text-[#00c365] transition-colors">
                    {t.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {t.description}
                  </p>
                </div>
              </div>

              <div className="p-4 pt-0">
                <button
                  onClick={() => openTemplatePreview(t)}
                  className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-[#00c365] hover:text-black text-white text-xs font-semibold border border-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Demo Site</span>
                </button>
              </div>
            </div>
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
