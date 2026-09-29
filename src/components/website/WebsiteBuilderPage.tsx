import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TEMPLATE_CATEGORIES, WEBSITE_TEMPLATES } from '../../data/templates';
import { TemplateCategory, WebsiteTemplate } from '../../types';
import {
  Globe,
  Sparkles,
  Smartphone,
  Eye,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Layout,
  Check,
  FileCode,
  DollarSign
} from 'lucide-react';

export const WebsiteBuilderPage: React.FC = () => {
  const { openTemplatePreview, openWaitlist, showToast } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('all');
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(1);

  const filteredTemplates = WEBSITE_TEMPLATES.filter((t) => {
    if (selectedCategory === 'all') return true;
    return t.category === selectedCategory;
  });

  const handleLaunchWaitlist = () => {
    openWaitlist('Mystery Hub Website Builder');
  };

  return (
    <div className="min-h-screen py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Hero Section matching the reference screenshot */}
        <div className="relative rounded-3xl bg-gradient-to-br from-[#0c1613] via-[#091011] to-[#060a0c] border border-slate-800/80 p-6 sm:p-12 lg:p-16 overflow-hidden shadow-2xl">
          {/* Ambient Glow */}
          <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#00c365]/15 rounded-full blur-[100px] pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
            {/* Left Col */}
            <div className="lg:col-span-6 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#112019] border border-[#00c365]/30 text-xs font-semibold text-[#00c365]">
                <Globe className="w-3.5 h-3.5" />
                <span>Website Builder</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
                Create Your Own <br />
                <span className="text-[#00c365]">Website in Minutes</span>
              </h1>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-lg">
                Build a professional website for your business, church, restaurant, salon, or personal brand in Ghana — no coding required. Includes Ghana Mobile Money payments and WhatsApp ordering.
              </p>

              {/* CTAs */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={handleLaunchWaitlist}
                  className="px-6 py-3.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,195,101,0.35)] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Get Notified (Free Beta)</span>
                </button>

                <a
                  href="#templates-showcase"
                  className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider border border-slate-700/80 transition-colors flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4 text-slate-400" />
                  <span>Explore Templates</span>
                </a>
              </div>

              {/* Free Option Banner */}
              <div className="p-3.5 rounded-xl bg-[#0a120e] border border-[#00c365]/20 flex items-center gap-3 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-lg bg-[#00c365]/20 text-[#00c365] flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span>
                  <strong>Free Plan Available:</strong> Every Ghanaian entrepreneur gets 1 free published site on .mysteryhub.site with optional upgrades for custom .com.gh domains.
                </span>
              </div>
            </div>

            {/* Right Col: Laptop & Mobile Screen Mockup */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="relative w-full max-w-lg">
                {/* Coming Soon Ribbon Tag */}
                <div className="absolute -top-3 -right-2 z-20 bg-gradient-to-r from-[#00c365] to-emerald-600 text-black text-xs font-extrabold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Coming Soon · Beta Preview</span>
                </div>

                {/* Laptop Mockup Housing */}
                <div className="bg-[#121921] rounded-2xl border border-slate-700/80 p-3 shadow-2xl overflow-hidden">
                  {/* Laptop Window Bar */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 px-2 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    </div>
                    <div className="bg-slate-900 px-3 py-0.5 rounded text-[10px] text-slate-400 font-mono">
                      https://accrabuild.mysteryhub.site
                    </div>
                    <span className="text-[#00c365] font-semibold text-[10px]">Mobile Ready</span>
                  </div>

                  {/* Rendered Template Preview inside Mockup */}
                  <div className="rounded-xl overflow-hidden bg-white text-slate-900 border border-slate-200">
                    <div className="bg-[#0b131a] text-white p-6 sm:p-8 space-y-3 relative overflow-hidden">
                      <div className="inline-block text-[10px] uppercase font-bold text-[#00c365] tracking-widest">
                        Ghanaian Architecture & Civil Engineering
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                        Apex Build & Civil Contractors
                      </h3>
                      <p className="text-xs text-slate-300 max-w-sm">
                        Building commercial landmarks and modern family residences across Greater Accra and Kumasi.
                      </p>
                      <div className="pt-2 flex items-center gap-2">
                        <span className="px-3 py-1 rounded bg-[#00c365] text-black font-bold text-[11px]">
                          Get Free Estimate
                        </span>
                        <span className="px-3 py-1 rounded bg-slate-800 text-white text-[11px]">
                          WhatsApp Chat
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
                      <span>✓ MoMo Deposits Accepted</span>
                      <span>✓ 100% Mobile Responsive</span>
                    </div>
                  </div>
                </div>

                {/* Companion Mobile Preview overlapping */}
                <div className="absolute -bottom-6 -left-4 sm:-left-6 w-36 sm:w-44 bg-[#0a0f14] border border-slate-700 rounded-2xl p-2 shadow-2xl hidden sm:block">
                  <div className="h-2 w-10 bg-slate-800 rounded-full mx-auto mb-2" />
                  <div className="bg-white rounded-xl p-2.5 text-slate-900 text-[10px] space-y-1.5">
                    <div className="font-bold text-[11px]">Apex Mobile</div>
                    <div className="h-12 bg-slate-200 rounded flex items-center justify-center text-[9px] text-slate-500">
                      Fast 4G View
                    </div>
                    <div className="w-full py-1 bg-[#00c365] text-center font-bold text-black rounded text-[9px]">
                      Call Office
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Core Value Props matching reference screenshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00c365]">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">Mobile Responsive</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every website automatically looks stunning and loads fast on Android smartphones, iPhones, tablets, and desktop computers across Ghana.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">Easy to Use</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              No technical or coding knowledge required. Simply type your business name, select services, upload photos, and connect your WhatsApp number.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Layout className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">Professional Templates</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Handcrafted for Ghanaian industries: churches, chop bars, beauty salons, civil engineers, boutiques, and creative consultancies.
            </p>
          </div>
        </div>

        {/* Conceptual Workflow: 4-Step Process */}
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs font-bold text-[#00c365] uppercase tracking-wider">
              How It Works
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              From Idea to Live Website in 4 Simple Steps
            </h2>
            <p className="text-xs text-slate-400">
              We took away all the technical complexity so you can focus on running your business.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                step: 1,
                title: 'Choose a Template',
                desc: 'Select a layout designed specifically for your industry or craft.',
              },
              {
                step: 2,
                title: 'Add Business Details',
                desc: 'Enter your business name, phone number, location, and photos.',
              },
              {
                step: 3,
                title: 'Customize Content',
                desc: 'Set your service rates, operating hours, and WhatsApp inquiry buttons.',
              },
              {
                step: 4,
                title: 'Publish Instantly',
                desc: 'Go live on your own custom link with instant Mobile Money integration.',
              },
            ].map((s) => (
              <div
                key={s.step}
                className="p-5 rounded-2xl bg-[#0d1217] border border-slate-800 space-y-3 relative group hover:border-[#00c365]/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-[#00c365]/10 border border-[#00c365]/30 flex items-center justify-center text-sm font-bold text-[#00c365]">
                  0{s.step}
                </div>
                <h3 className="font-bold text-sm text-white">{s.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Templates Showcase Grid */}
        <div id="templates-showcase" className="space-y-6 scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Explore Industry Templates
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Click any template to test the interactive preview.
              </p>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-[#00c365] text-black font-bold'
                      : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Templates Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {filteredBundlesShowcase(filteredTemplates, openTemplatePreview)}
          </div>
        </div>

        {/* Free Plan vs Upgrades Announcement */}
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-[#0c141a] to-[#091116] border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl text-left">
            <span className="text-xs font-bold text-[#00c365] uppercase tracking-wider">
              Accessible to All Ghanaians
            </span>
            <h3 className="text-2xl font-bold text-white">
              Start Free. Upgrade As Your Business Grows.
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Every Mystery Hub user gets a completely free website on our platform. As your sales grow, you can easily connect your own custom domain (e.g. .com or .com.gh), remove badges, and unlock advanced customer booking features.
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              onClick={handleLaunchWaitlist}
              className="px-6 py-3.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Join Free Beta Waitlist</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function filteredBundlesShowcase(
  templates: WebsiteTemplate[],
  onPreview: (t: WebsiteTemplate) => void
) {
  return templates.map((t) => (
    <div
      key={t.id}
      className="rounded-2xl bg-[#0f151b] border border-slate-800 overflow-hidden hover:border-[#00c365]/50 transition-all duration-200 flex flex-col justify-between group shadow-sm hover:shadow-xl"
    >
      <div>
        {/* Mock Template Screen Header */}
        <div
          className="h-32 sm:h-36 p-4 flex flex-col justify-between relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, #090e12 0%, #151f28 100%)`,
          }}
        >
          <div className="flex items-center justify-between z-10">
            <span className="text-[10px] font-bold text-white bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded border border-white/10">
              {t.categoryLabel}
            </span>
            {t.isFreeTier && (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                Free Starter
              </span>
            )}
          </div>

          <div className="z-10">
            <div className="font-extrabold text-sm text-white drop-shadow-md">
              {t.demoBusinessName}
            </div>
            <div className="text-[10px] text-slate-300 truncate mt-0.5">
              {t.demoHeroTagline}
            </div>
          </div>

          {/* Accent decoration bar */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1"
            style={{ backgroundColor: t.accentColor }}
          />
        </div>

        {/* Details Content */}
        <div className="p-4 space-y-3">
          <div>
            <h4 className="font-bold text-sm text-white group-hover:text-[#00c365] transition-colors">
              {t.title}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
              {t.description}
            </p>
          </div>

          {/* Features pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {t.features.slice(0, 2).map((feat, i) => (
              <span
                key={i}
                className="text-[10px] text-slate-300 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded"
              >
                {feat}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="p-4 pt-0">
        <button
          onClick={() => onPreview(t)}
          className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-[#00c365] hover:text-black text-white text-xs font-semibold border border-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Interactive Preview</span>
        </button>
      </div>
    </div>
  ));
}
