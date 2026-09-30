import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TEMPLATE_CATEGORIES, WEBSITE_TEMPLATES } from '../../data/templates';
import { TemplateCategory, WebsiteTemplate } from '../../types';
import { TemplateCardPreview } from './TemplateCardPreview';
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
  Search,
  SlidersHorizontal,
  Compass,
  Building,
  Utensils,
  Scissors,
  Laptop,
} from 'lucide-react';

export const WebsiteBuilderPage: React.FC = () => {
  const { openTemplatePreview, openWaitlist, showToast } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = WEBSITE_TEMPLATES.filter((t) => {
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
    if (!matchesCategory) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.demoBusinessName.toLowerCase().includes(q) ||
      t.industry.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.features.some((f) => f.toLowerCase().includes(q))
    );
  });

  const handleLaunchWaitlist = () => {
    openWaitlist('Mystery Hub Website Builder');
  };

  return (
    <div className="min-h-screen py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Hero Section */}
        <div className="relative rounded-3xl bg-gradient-to-br from-[#0c1613] via-[#091011] to-[#060a0c] border border-slate-800/80 p-6 sm:p-12 lg:p-16 overflow-hidden shadow-2xl">
          {/* Ambient Glow */}
          <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#00c365]/15 rounded-full blur-[100px] pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
            {/* Left Col */}
            <div className="lg:col-span-6 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#112019] border border-[#00c365]/30 text-xs font-semibold text-[#00c365]">
                <Globe className="w-3.5 h-3.5" />
                <span>Mystery Hub Website Studio</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
                Every Ghanaian Business <br />
                <span className="text-[#00c365]">Deserves a Great Website</span>
              </h1>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-lg">
                Build an exceptional, high-converting website for your chop bar, construction firm, hair studio, tech startup, church, or boutique. No coding required, with built-in Ghana Mobile Money and WhatsApp order routing.
              </p>

              {/* CTAs */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={handleLaunchWaitlist}
                  className="px-6 py-3.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,195,101,0.35)] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Get Free Launch Access</span>
                </button>

                <a
                  href="#templates-showcase"
                  className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider border border-slate-700/80 transition-colors flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4 text-slate-400" />
                  <span>Browse 12+ Templates</span>
                </a>
              </div>

              {/* Free Option Banner */}
              <div className="p-3.5 rounded-xl bg-[#0a120e] border border-[#00c365]/20 flex items-center gap-3 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-lg bg-[#00c365]/20 text-[#00c365] flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span>
                  <strong>100% Free Plan Included:</strong> Every registered entrepreneur gets 1 free published site on .mysteryhub.site with optional custom .com.gh domains.
                </span>
              </div>
            </div>

            {/* Right Col: Laptop & Mobile Screen Mockup */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="relative w-full max-w-lg">
                {/* Live Preview Ribbon */}
                <div className="absolute -top-3 -right-2 z-20 bg-gradient-to-r from-[#00c365] to-emerald-600 text-black text-xs font-extrabold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>12 Diverse Design Systems</span>
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
                      https://goldcoastgrill.mysteryhub.site
                    </div>
                    <span className="text-[#00c365] font-semibold text-[10px]">Mobile Ready</span>
                  </div>

                  {/* Rendered Template Preview inside Mockup */}
                  <div className="rounded-xl overflow-hidden bg-[#7a1c28] text-[#fcf9f5] border border-amber-900/40">
                    <div className="p-6 sm:p-8 space-y-3 relative overflow-hidden">
                      <div className="inline-block text-[10px] uppercase font-bold text-[#c99a45] tracking-widest">
                        Gold Coast Artisan Kitchen & Grill
                      </div>
                      <h3 className="text-xl sm:text-2xl font-serif font-normal tracking-tight leading-tight">
                        Authentic Ghanaian Flavours with Contemporary Craft
                      </h3>
                      <p className="text-xs text-pink-100/80 max-w-sm">
                        Char-grilled tilapia with banku, slow-braised goat light soup, and chilled hibiscus cocktails in Osu.
                      </p>
                      <div className="pt-2 flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-[#c99a45] text-black font-bold text-[11px]">
                          Reserve Table
                        </span>
                        <span className="px-3 py-1 rounded-full bg-white/20 text-white text-[11px]">
                          Digital Menu
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-[#5c131d] flex items-center justify-between text-xs text-amber-200">
                      <span>✓ Table Reservation System</span>
                      <span>✓ MoMo Pre-Orders</span>
                    </div>
                  </div>
                </div>

                {/* Companion Mobile Preview overlapping */}
                <div className="absolute -bottom-6 -left-4 sm:-left-6 w-36 sm:w-44 bg-[#0a0f14] border border-slate-700 rounded-2xl p-2 shadow-2xl hidden sm:block">
                  <div className="h-2 w-10 bg-slate-800 rounded-full mx-auto mb-2" />
                  <div className="bg-[#0f172a] rounded-xl p-2.5 text-white text-[10px] space-y-1.5 border border-slate-800">
                    <div className="font-bold text-[11px] text-[#f97316]">Apex Civil Works</div>
                    <div className="h-10 bg-slate-900 rounded flex items-center justify-center text-[9px] text-slate-400 font-mono">
                      148+ Projects
                    </div>
                    <div className="w-full py-1 bg-[#f97316] text-center font-bold text-black rounded text-[9px]">
                      Get Estimate
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Core Value Props */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00c365]">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">Distinct Design Systems</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every template has its own unique color personality, typography, section rhythm, and purpose-built components for its specific Ghanaian industry.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">Local MoMo & WhatsApp</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Accept deposits via MTN MoMo, Telecel Cash, and AT Money directly from day one, with one-tap WhatsApp customer order routing.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Layout className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">Commercial Quality</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              From civil engineering tender calculators to luxury real estate filters and digital restaurant menus — ready for serious commercial operations.
            </p>
          </div>
        </div>

        {/* Templates Showcase Grid & Filter Section */}
        <div id="templates-showcase" className="space-y-6 scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00c365] uppercase tracking-wider mb-1">
                <Compass className="w-3.5 h-3.5" />
                <span>Explore 12 Handcrafted Designs</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Choose Your Industry Website
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Click "Interactive Preview" on any design to test how it looks on desktop, tablet, and mobile.
              </p>
            </div>

            {/* Search Input Bar */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates (e.g. food, building, shop)..."
                className="w-full bg-[#10171f] border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
            {TEMPLATE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-[#00c365] text-black font-bold shadow-md'
                    : 'bg-[#10171f] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Result Count Indicator */}
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>
              Showing <strong>{filteredTemplates.length}</strong> template{filteredTemplates.length === 1 ? '' : 's'}
              {searchQuery && ` matching "${searchQuery}"`}
            </span>
            {selectedCategory !== 'all' && (
              <button
                onClick={() => setSelectedCategory('all')}
                className="text-[#00c365] hover:underline cursor-pointer"
              >
                Clear category filter
              </button>
            )}
          </div>

          {/* Templates Cards Grid */}
          {filteredTemplates.length === 0 ? (
            <div className="p-12 text-center bg-[#0d1217] rounded-3xl border border-slate-800 space-y-3">
              <p className="text-slate-400 text-sm">No templates matched your search.</p>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredTemplates.map((t) => (
                <TemplateCardPreview
                  key={t.id}
                  template={t}
                  onPreview={() => openTemplatePreview(t)}
                />
              ))}
            </div>
          )}
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
