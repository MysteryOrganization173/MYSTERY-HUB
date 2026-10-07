import { SafeImage } from './SafeImage.js';
import React, { useState } from 'react';
import { WebsiteTemplate, TemplateItem } from '../../types';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  Heart,
  BookOpen,
  GraduationCap,
  Scale,
  Shirt,
  DollarSign,
  Phone,
  Utensils,
  HardHat,
  Building,
  Building2,
  Hammer,
  Truck,
  ShieldCheck,
  Scissors,
  Star,
  Search,
  Bed,
  Bath,
  Maximize2,
  Camera,
  Film,
  Mail,
  Cpu,
  Zap,
  Server,
  Palmtree,
  ShoppingBag,
  Flame,
  RotateCcw,
  Check,
  Users,
  Compass,
} from 'lucide-react';

interface DynamicTemplateRendererProps {
  template: WebsiteTemplate;
  onCtaClick?: () => void;
  isMobileView?: boolean;
}

export const DynamicTemplateRenderer: React.FC<DynamicTemplateRendererProps> = ({
  template,
  onCtaClick,
  isMobileView,
}) => {
  // Extract and standardize template color scheme with safe fallbacks
  const p = template.colorScheme || {
    primary: '#0f172a',
    secondary: template.accentColor || '#00c365',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    mutedText: '#64748b',
    accent: template.accentColor || '#00c365',
    border: '#e2e8f0',
  };

  const layout = template.layoutType || template.category;

  // Determine typographic identity
  const getFontFamilyClass = () => {
    switch (layout) {
      case 'restaurant':
      case 'salon':
      case 'beauty':
      case 'hotel':
      case 'fashion':
        return 'font-serif';
      case 'portfolio':
      case 'agency':
        return 'font-mono';
      default:
        return 'font-sans';
    }
  };

  // Determine button corner curvature
  const getButtonRadiusClass = () => {
    switch (layout) {
      case 'restaurant':
      case 'salon':
      case 'beauty':
      case 'hotel':
      case 'portfolio':
      case 'fashion':
        return 'rounded-full';
      case 'construction':
      case 'agency':
        return 'rounded-lg';
      default:
        return 'rounded-xl';
    }
  };

  const fontClass = getFontFamilyClass();
  const btnRadius = getButtonRadiusClass();

  // Dynamic state for interactive components across compositions
  const [activeTab, setActiveTab] = useState<string>('All');
  const [selectedService, setSelectedService] = useState<string>(template.items?.[0]?.name || '');
  const [selectedStylist, setSelectedStylist] = useState<string>('Abena - Senior Stylist');
  const [partySize, setPartySize] = useState<number>(2);
  const [cartCount, setCartCount] = useState<number>(1);
  const [formSubmitted, setFormSubmitted] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  const items = template.items || [];
  const filteredItems = items.filter((item) => {
    if (activeTab === 'All') return true;
    return item.category === activeTab;
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (template.siteContent) { onCtaClick?.(); return; }
    setFormSubmitted(true);
    setTimeout(() => setFormSubmitted(false), 5000);
  };

  const handleAddToCart = (name: string) => {
    if (template.siteContent) { onCtaClick?.(); return; }
    setCartCount((prev) => prev + 1);
    setNotification(`Added "${name}" to cart!`);
    setTimeout(() => setNotification(null), 3000);
  };

  // -------------------------------------------------------------
  // Composition A: Culinary Editorial (Restaurant / Chop Bar)
  // -------------------------------------------------------------
  if (layout === 'restaurant') {
    const categories = ['All', 'Main Grills', 'Soups & Swallows', 'Beverages'];
    return (
      <div
        className={`${fontClass} min-h-full`}
        style={{ backgroundColor: p.background, color: p.text }}
      >
        {/* Top Announcement Bar */}
        <div
          className="px-3 sm:px-4 py-2 text-center text-xs tracking-wider uppercase font-sans flex items-center justify-center gap-2 text-white"
          style={{ backgroundColor: p.primary }}
        >
          <Sparkles className="w-3.5 h-3.5" style={{ color: p.secondary }} />
          <span className="truncate">Weekend Live Jazz & Osu Night Market Grills · Reserve Early</span>
        </div>

        {/* Navigation */}
        <nav
          className="border-b px-3 sm:px-8 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-30 font-sans backdrop-blur-md"
          style={{ backgroundColor: `${p.background}f0`, borderColor: p.border }}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm sm:text-base font-bold text-white shrink-0"
              style={{ backgroundColor: p.primary, color: p.secondary }}
            >
              G
            </div>
            <div>
              <span
                className="font-bold text-sm sm:text-base tracking-wide block leading-none font-serif truncate max-w-[150px] sm:max-w-none"
                style={{ color: p.primary }}
              >
                {template.demoBusinessName}
              </span>
              <span className="text-[10px] uppercase tracking-widest block mt-0.5" style={{ color: p.mutedText }}>
                Accra · Est. 2018
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-5 text-xs font-semibold uppercase tracking-wider" style={{ color: p.mutedText }}>
            <a href="#menu" className="hover:opacity-80 transition-opacity">Menu</a>
            <a href="#reserve" className="hover:opacity-80 transition-opacity">Reservations</a>
            <a href="#location" className="hover:opacity-80 transition-opacity">Find Us</a>
          </div>

          <button
            onClick={onCtaClick}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer font-sans shrink-0 ${btnRadius}`}
            style={{ backgroundColor: p.primary }}
          >
            <Calendar className="w-3.5 h-3.5" style={{ color: p.secondary }} />
            <span>Book Table</span>
          </button>
        </nav>

        {/* Hero Section */}
        <div
          className="relative py-10 sm:py-16 px-4 sm:px-12 text-white overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${p.primary} 0%, #150508 100%)`,
          }}
        >
          {template.heroImage && (
            <SafeImage className="absolute inset-0 opacity-45   " src={template.heroImage} alt={template.demoBusinessName} loading="eager" fetchPriority="high" />
          )}
          <div className="relative max-w-3xl space-y-4">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-sans font-semibold tracking-wider uppercase"
              style={{ backgroundColor: `${p.secondary}25`, color: p.secondary }}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Modern Ghanaian Gastronomy</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-normal tracking-tight leading-[1.15]">
              {template.demoHeroTagline}
            </h1>

            <p className="text-xs sm:text-sm text-slate-200 font-sans max-w-xl leading-relaxed">
              {template.demoSubtext}
            </p>

            <div className="pt-2 flex flex-wrap gap-2.5 font-sans">
              <a
                href="#reserve"
                className={`px-5 py-2.5 text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2 ${btnRadius}`}
                style={{ backgroundColor: p.secondary }}
              >
                <span>Reserve Table</span>
              </a>
              <a
                href="#menu"
                className={`px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs uppercase tracking-wider border border-white/20 transition-all flex items-center gap-2 ${btnRadius}`}
              >
                <span>Explore Digital Menu</span>
              </a>
            </div>

            {/* Metrics */}
            <div className="pt-4 grid grid-cols-3 gap-3 border-t border-white/15 max-w-md font-sans">
              {template.stats?.map((stat, i) => (
                <div key={i}>
                  <div className="text-lg sm:text-xl font-bold font-serif" style={{ color: p.secondary }}>
                    {stat.value}
                  </div>
                  <div className="text-[10px] text-slate-300 uppercase tracking-wider mt-0.5">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Menu Section */}
        <div id="menu" className="py-10 sm:py-14 px-4 sm:px-12 max-w-5xl mx-auto space-y-6 font-sans">
          <div className="text-center max-w-lg mx-auto space-y-1">
            <span className="text-xs uppercase tracking-widest font-bold" style={{ color: p.secondary }}>
              Curated Culinary Selection
            </span>
            <h2 className="text-xl sm:text-3xl font-serif" style={{ color: p.primary }}>
              Crafted with Fresh Ghanaian Produce
            </h2>
          </div>

          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider transition-all cursor-pointer ${
                  activeTab === cat
                    ? 'text-white shadow-sm'
                    : 'bg-white border text-slate-600'
                }`}
                style={
                  activeTab === cat
                    ? { backgroundColor: p.primary }
                    : { borderColor: p.border, color: p.mutedText }
                }
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 sm:p-4 rounded-2xl border shadow-sm flex gap-3.5 items-start transition-shadow hover:shadow-md"
                style={{ backgroundColor: p.surface, borderColor: p.border }}
              >
                {item.image && (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 bg-slate-100">
                    <SafeImage src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-xs sm:text-sm font-serif truncate" style={{ color: p.text }}>
                      {item.name}
                    </h3>
                    <span className="font-bold text-xs shrink-0" style={{ color: p.primary }}>
                      {item.price}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed line-clamp-2" style={{ color: p.mutedText }}>
                    {item.desc}
                  </p>
                  {item.tag && (
                    <span
                      className="inline-block text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                      style={{ backgroundColor: `${p.secondary}20`, color: p.secondary }}
                    >
                      {item.tag}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Table Reservation Card */}
        <div id="reserve" className="py-10 px-4 sm:px-12 border-t" style={{ backgroundColor: `${p.border}50`, borderColor: p.border }}>
          <div
            className="max-w-2xl mx-auto rounded-3xl p-5 sm:p-8 shadow-md border space-y-5 font-sans"
            style={{ backgroundColor: p.surface, borderColor: p.border }}
          >
            <div className="text-center space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: p.primary }}>
                Instant Online Booking
              </span>
              <h3 className="text-xl sm:text-2xl font-serif" style={{ color: p.text }}>
                Reserve Your Table in Osu
              </h3>
            </div>

            {formSubmitted ? (
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1.5 text-xs text-emerald-800">
                <Check className="w-8 h-8 text-emerald-500 mx-auto" />
                <div className="font-bold text-sm">Table Confirmed!</div>
                <p>We look forward to hosting you for dinner.</p>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: p.mutedText }}>
                      Date
                    </label>
                    <input
                      type="date"
                      defaultValue="2026-10-02"
                      className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none"
                      style={{ borderColor: p.border, backgroundColor: p.background }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: p.mutedText }}>
                      Time
                    </label>
                    <select
                      className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none"
                      style={{ borderColor: p.border, backgroundColor: p.background }}
                    >
                      <option>7:30 PM (Dinner)</option>
                      <option>1:00 PM (Lunch)</option>
                      <option>8:30 PM (Late)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: p.mutedText }}>
                      Party Size
                    </label>
                    <select
                      value={partySize}
                      onChange={(e) => setPartySize(Number(e.target.value))}
                      className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none"
                      style={{ borderColor: p.border, backgroundColor: p.background }}
                    >
                      <option value={2}>2 Guests</option>
                      <option value={4}>4 Guests</option>
                      <option value={6}>6+ Guests</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Full Name"
                    className="w-full border rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                    style={{ borderColor: p.border, backgroundColor: p.background }}
                    required
                  />
                  <input
                    type="tel"
                    placeholder="Ghana Phone / WhatsApp"
                    className="w-full border rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                    style={{ borderColor: p.border, backgroundColor: p.background }}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full py-3 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${btnRadius}`}
                  style={{ backgroundColor: p.primary }}
                >
                  <Calendar className="w-4 h-4" style={{ color: p.secondary }} />
                  <span>Confirm Table Booking</span>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer id="location" className="py-8 px-4 sm:px-12 text-xs text-white" style={{ backgroundColor: p.primary }}>
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-serif font-bold text-base" style={{ color: p.secondary }}>
                {template.demoBusinessName}
              </h4>
              <p className="text-slate-300 text-xs">{template.location}</p>
            </div>
            <div className="text-slate-300 text-xs">
              <div className="font-bold text-white uppercase text-[10px]">Reservations</div>
              <div>{template.hoursOrContact}</div>
            </div>
          </div>
          <div className="border-t border-white/10 mt-6 pt-4 text-center text-slate-400 text-[10px]">
            © 2026 {template.demoBusinessName}. Powered by Mystery Hub Sites Ghana.
          </div>
        </footer>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Composition B: Architectural Heavy Grid (Construction & Civil)
  // -------------------------------------------------------------
  if (layout === 'construction') {
    const categories = ['All', 'Commercial', 'Residential', 'Industrial'];
    return (
      <div
        className={`${fontClass} min-h-full`}
        style={{ backgroundColor: p.background, color: p.text }}
      >
        {/* Heavy Technical Utility Bar */}
        <div
          className="border-b px-3 sm:px-8 py-2 text-xs flex flex-col sm:flex-row items-center justify-between gap-1 text-slate-400"
          style={{ backgroundColor: '#070b10', borderColor: p.border }}
        >
          <div className="flex items-center gap-3 text-[10px] sm:text-[11px] truncate">
            <span className="flex items-center gap-1.5 text-slate-300">
              <MapPin className="w-3.5 h-3.5" style={{ color: p.secondary }} />
              <span className="truncate">{template.location}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
            <span style={{ color: p.secondary }} className="font-bold">ISO 9001:2015</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300">Class D1K1</span>
          </div>
        </div>

        {/* Navigation */}
        <nav
          className="border-b px-3 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md"
          style={{ backgroundColor: `${p.surface}f5`, borderColor: p.border }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-black shrink-0"
              style={{ backgroundColor: p.secondary }}
            >
              <HardHat className="w-5 h-5 text-black" />
            </div>
            <div>
              <span className="font-black text-sm sm:text-base tracking-tight text-white block uppercase leading-none truncate max-w-[170px] sm:max-w-none">
                {template.demoBusinessName}
              </span>
              <span className="text-[9px] uppercase tracking-widest font-mono font-bold block mt-0.5" style={{ color: p.secondary }}>
                Civil & Structural Engineers
              </span>
            </div>
          </div>

          <button
            onClick={onCtaClick}
            className={`px-3 sm:px-4 py-2 text-black font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0 ${btnRadius}`}
            style={{ backgroundColor: p.secondary }}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Request BOQ</span>
          </button>
        </nav>

        {/* Hero Section */}
        <div
          className="relative py-12 sm:py-20 px-4 sm:px-12 border-b overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${p.surface} 0%, #06090e 100%)`,
            borderColor: p.border,
          }}
        >
          {template.heroImage && (
            <SafeImage className="absolute inset-0 opacity-40   mix-blend-luminosity" src={template.heroImage} alt={template.demoBusinessName} loading="eager" fetchPriority="high" />
          )}
          <div className="relative max-w-3xl space-y-4 sm:space-y-5">
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold uppercase tracking-wider"
              style={{ backgroundColor: `${p.secondary}20`, color: p.secondary }}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Heavy Civil & Commercial EPC</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-white leading-[1.1]">
              {template.demoHeroTagline}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              {template.demoSubtext}
            </p>

            <div className="pt-2 flex flex-wrap gap-2.5">
              <a
                href="#projects"
                className={`px-5 py-3 text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 ${btnRadius}`}
                style={{ backgroundColor: p.secondary }}
              >
                <span>View Developments</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            {/* Industrial Stats Counters */}
            <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
              {template.stats?.map((stat, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border"
                  style={{ backgroundColor: `${p.surface}90`, borderColor: p.border }}
                >
                  <div className="text-xl sm:text-2xl font-black font-mono" style={{ color: p.secondary }}>
                    {stat.value}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Completed Projects Showcase */}
        <div id="projects" className="py-12 sm:py-16 px-4 sm:px-12 max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="text-xs uppercase tracking-widest font-mono font-bold block" style={{ color: p.secondary }}>
                Proven Track Record
              </span>
              <h2 className="text-xl sm:text-3xl font-black uppercase text-white mt-0.5">
                Completed Developments
              </h2>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveTab(cat)}
                  className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === cat ? 'text-black shadow' : 'text-slate-400 border hover:text-white'
                  }`}
                  style={
                    activeTab === cat
                      ? { backgroundColor: p.secondary }
                      : { borderColor: p.border, backgroundColor: p.surface }
                  }
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border overflow-hidden shadow-lg flex flex-col justify-between"
                style={{ backgroundColor: p.surface, borderColor: p.border }}
              >
                <div>
                  {item.image && (
                    <div className="h-40 overflow-hidden relative bg-slate-900">
                      <SafeImage src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      <div className="absolute top-2.5 right-2.5 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-white font-bold border border-white/20">
                        {item.price}
                      </div>
                    </div>
                  )}
                  <div className="p-4 space-y-2">
                    <div className="text-[10px] font-mono uppercase font-bold" style={{ color: p.secondary }}>
                      {item.category}
                    </div>
                    <h3 className="font-bold text-sm sm:text-base text-white">{item.name}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{item.desc}</p>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <div className="flex flex-wrap gap-1 pt-2 border-t" style={{ borderColor: p.border }}>
                    {item.specs?.map((spec, i) => (
                      <span
                        key={i}
                        className="text-[9px] text-slate-300 px-2 py-0.5 rounded font-mono"
                        style={{ backgroundColor: '#070b10' }}
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

        {/* Footer */}
        <footer className="border-t py-8 px-4 sm:px-12 text-xs text-slate-400" style={{ backgroundColor: '#070b10', borderColor: p.border }}>
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <div className="font-black text-white uppercase text-sm">{template.demoBusinessName}</div>
              <div className="text-xs text-slate-400 mt-1">{template.location}</div>
            </div>
            <div className="text-xs">{template.hoursOrContact}</div>
          </div>
          <div className="border-t border-slate-800 mt-6 pt-4 text-center text-slate-500 text-[10px]">
            © 2026 {template.demoBusinessName}. Powered by Mystery Hub Sites Ghana.
          </div>
        </footer>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Composition C: Dynamic Universal Layout (Salon, RealEstate, Portfolio, Tech, Hotel, Ecom, Church, etc.)
  // Conditionally applies colors, icons, cards, and sections dynamically!
  // -------------------------------------------------------------
  const isDarkTheme = p.background === '#09090b' || p.background === '#070a0f' || p.background === '#0b1118';

  return (
    <div
      className={`${fontClass} min-h-full`}
      style={{ backgroundColor: p.background, color: p.text }}
    >
      {/* Dynamic Announcement Ribbon */}
      <div
        className="px-3 sm:px-6 py-2 text-center text-xs tracking-wider font-semibold text-white flex items-center justify-center gap-2"
        style={{ backgroundColor: p.primary }}
      >
        <Sparkles className="w-3.5 h-3.5" style={{ color: p.secondary }} />
        <span className="truncate">
          {template.siteContent ? template.location || template.categoryLabel : layout === 'ecommerce' || layout === 'retail'
            ? 'Explore products and contact the business'
            : layout === 'hotel'
            ? '🌴 Ada Foah Beachfront Eco Chalets Booking Open'
            : layout === 'church'
            ? 'Worship, fellowship and community'
            : layout === 'agency'
            ? 'Digital services and enquiries'
            : layout === 'salon' || layout === 'beauty'
            ? '✨ Luxury Hair & Barbering Sessions Now Booking in East Legon'
            : template.industry}
        </span>
      </div>

      {/* Dynamic Brand Navigation */}
      <nav
        className="border-b px-3 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md"
        style={{
          backgroundColor: isDarkTheme ? `${p.surface}f0` : `${p.background}f5`,
          borderColor: p.border,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
            style={{ backgroundColor: p.primary }}
          >
            {layout === 'realestate' ? (
              <Building className="w-4 h-4 text-white" />
            ) : layout === 'portfolio' ? (
              <Camera className="w-4 h-4 text-white" />
            ) : layout === 'agency' ? (
              <Cpu className="w-4 h-4 text-white" />
            ) : layout === 'hotel' ? (
              <Palmtree className="w-4 h-4 text-white" />
            ) : layout === 'salon' || layout === 'beauty' ? (
              <Scissors className="w-4 h-4 text-white" />
            ) : layout === 'ecommerce' || layout === 'retail' ? (
              <ShoppingBag className="w-4 h-4 text-white" />
            ) : (
              <Sparkles className="w-4 h-4 text-white" />
            )}
          </div>
          <div>
            <span
              className="font-black text-sm sm:text-base tracking-tight block leading-none truncate max-w-[160px] sm:max-w-none"
              style={{ color: p.text }}
            >
              {template.demoBusinessName}
            </span>
            <span
              className="text-[10px] uppercase tracking-widest font-semibold block mt-0.5 truncate"
              style={{ color: p.secondary }}
            >
              {template.categoryLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {(layout === 'ecommerce' || layout === 'retail') && (
            <div className="relative p-1.5 rounded-lg border" style={{ borderColor: p.border }}>
              <ShoppingBag className="w-4 h-4" />
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                style={{ backgroundColor: p.secondary }}
              >
                {cartCount}
              </span>
            </div>
          )}

          <button
            onClick={onCtaClick}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0 ${btnRadius}`}
            style={{ backgroundColor: p.secondary }}
          >
            <span>
              {layout === 'realestate'
                ? 'Book Tour'
                : layout === 'hotel'
                ? 'Check Stay'
                : layout === 'salon' || layout === 'beauty'
                ? 'Book Session'
                : layout === 'ecommerce' || layout === 'retail'
                ? 'Checkout'
                : 'Inquire'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      {/* Dynamic Hero Section with Custom Background Styling */}
      <div
        className="relative py-12 sm:py-20 px-4 sm:px-12 text-white overflow-hidden"
        style={{
          background: isDarkTheme
            ? `radial-gradient(ellipse at 80% 20%, ${p.primary}80, ${p.background} 80%)`
            : `linear-gradient(135deg, ${p.primary} 0%, #111827 100%)`,
        }}
      >
        {template.heroImage && (
          <SafeImage className="absolute inset-0 opacity-40  " src={template.heroImage} alt={template.demoBusinessName} loading="eager" fetchPriority="high" />
        )}
        <div className="relative max-w-3xl space-y-4">
          <span
            className="inline-block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full border border-white/20 text-white"
            style={{ backgroundColor: `${p.secondary}40` }}
          >
            {template.badgeText || template.categoryLabel}
          </span>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white">
            {template.demoHeroTagline}
          </h1>

          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-xl">
            {template.demoSubtext}
          </p>

          <div className="pt-2 flex flex-wrap gap-2.5">
            <a
              href="#catalog"
              className={`px-5 py-2.5 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2 ${btnRadius}`}
              style={{ backgroundColor: p.secondary }}
            >
              <span>Explore Offerings</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Dynamic Stats Row */}
          {template.stats && template.stats.length > 0 && (
            <div className="pt-6 grid grid-cols-3 gap-3 border-t border-white/20 max-w-md">
              {template.stats.map((stat, i) => (
                <div key={i}>
                  <div className="text-lg sm:text-2xl font-black text-amber-300">
                    {stat.value}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-slate-300 uppercase tracking-wider mt-0.5">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Item / Product / Service Showcase Grid */}
      <div id="catalog" className="py-10 sm:py-16 px-4 sm:px-12 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <span className="text-xs uppercase tracking-widest font-bold" style={{ color: p.secondary }}>
              Featured Portfolio
            </span>
            <h2 className="text-xl sm:text-3xl font-black mt-0.5" style={{ color: p.text }}>
              Explore Options & Rates
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border shadow-sm overflow-hidden flex flex-col justify-between transition-all hover:shadow-lg"
              style={{ backgroundColor: p.surface, borderColor: p.border }}
            >
              <div>
                {item.image && (
                  <div className="h-44 sm:h-48 overflow-hidden relative bg-slate-950/20">
                    <SafeImage
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    {item.price && (
                      <div
                        className="absolute bottom-3 right-3 text-white px-2.5 py-1 rounded-lg text-xs font-black shadow-md"
                        style={{ backgroundColor: p.primary }}
                      >
                        {item.price}
                      </div>
                    )}
                    {item.tag && (
                      <div
                        className="absolute top-3 left-3 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                        style={{ backgroundColor: p.secondary }}
                      >
                        {item.tag}
                      </div>
                    )}
                  </div>
                )}
                <div className="p-4 sm:p-5 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: p.secondary }}>
                    {item.category}
                  </div>
                  <h3 className="font-bold text-sm sm:text-base" style={{ color: p.text }}>
                    {item.name}
                  </h3>
                  <p className="text-xs leading-relaxed line-clamp-2" style={{ color: p.mutedText }}>
                    {item.desc}
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-5 pt-0 space-y-3">
                {item.specs && item.specs.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2 border-t" style={{ borderColor: p.border }}>
                    {item.specs.map((s, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] px-2 py-0.5 rounded font-medium"
                        style={{ backgroundColor: `${p.primary}15`, color: p.text }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {(layout === 'ecommerce' || layout === 'retail') ? (
                  <button
                    onClick={() => handleAddToCart(item.name)}
                    className={`w-full py-2.5 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${btnRadius}`}
                    style={{ backgroundColor: p.secondary }}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Add to Bag</span>
                  </button>
                ) : (
                  <button
                    onClick={onCtaClick}
                    className={`w-full py-2 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${btnRadius}`}
                    style={{ backgroundColor: p.primary }}
                  >
                    <span>Select Option</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dynamic Location & Contact Footer */}
      <footer
        className="border-t py-8 px-4 sm:px-12 text-xs"
        style={{
          backgroundColor: isDarkTheme ? '#05070a' : p.primary,
          color: isDarkTheme ? '#94a3b8' : '#e2e8f0',
          borderColor: p.border,
        }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-bold text-white text-sm">{template.demoBusinessName}</h4>
            <p className="text-xs opacity-80">{template.location}</p>
          </div>
          <div className="text-xs opacity-90">{template.hoursOrContact}</div>
        </div>
        <div className="border-t border-white/10 mt-6 pt-4 text-center opacity-60 text-[10px]">
          © 2026 {template.demoBusinessName}. Powered by Mystery Hub Sites Ghana.
        </div>
      </footer>
    </div>
  );
};
