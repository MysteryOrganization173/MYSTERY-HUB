import React, { useState } from 'react';
import { WebsiteTemplate } from '../../../types';
import {
  Sparkles,
  ArrowRight,
  CheckCircle,
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
} from 'lucide-react';

interface TemplateViewProps {
  template: WebsiteTemplate;
  onCtaClick?: () => void;
}

export const GenericTemplateView: React.FC<TemplateViewProps> = ({ template, onCtaClick }) => {
  const [formSubmitted, setFormSubmitted] = useState<boolean>(false);
  const items = template.items || [];
  const palette = template.colorScheme || {
    primary: '#0f172a',
    secondary: template.accentColor || '#00c365',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    mutedText: '#64748b',
    accent: template.accentColor || '#00c365',
    border: '#e2e8f0',
  };

  const isChurch = template.layoutType === 'church' || template.category === 'church';
  const isEdu = template.layoutType === 'education' || template.category === 'education';
  const isFashion = template.layoutType === 'fashion' || template.category === 'fashion';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    setTimeout(() => setFormSubmitted(false), 5000);
  };

  return (
    <div
      className="font-sans min-h-full"
      style={{ backgroundColor: palette.background, color: palette.text }}
    >
      {/* Top Banner */}
      <div
        className="px-4 py-2 text-xs text-center font-semibold text-white tracking-wider flex items-center justify-center gap-2"
        style={{ backgroundColor: palette.primary }}
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
        <span>
          {isChurch
            ? '🔴 Sunday Worship Live at 9:00 AM GMT · Online Fellowship Open'
            : isEdu
            ? '🎓 2026 Admissions Open for STEM & Software Cohorts in Accra'
            : isFashion
            ? '✨ Handcrafted Bonwire Kente & Made-to-Measure Kaftans in East Legon'
            : 'Corporate Advisory, GRA Tax Filings & ORC Incorporations'}
        </span>
      </div>

      {/* Navigation */}
      <nav
        className="border-b px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold"
            style={{ backgroundColor: palette.primary }}
          >
            {isChurch ? <Heart className="w-5 h-5" /> : isEdu ? <GraduationCap className="w-5 h-5" /> : isFashion ? <Shirt className="w-5 h-5" /> : <Scale className="w-5 h-5" />}
          </div>
          <div>
            <span
              className="font-black text-base sm:text-lg tracking-tight block leading-none"
              style={{ color: palette.primary }}
            >
              {template.demoBusinessName}
            </span>
            <span
              className="text-[10px] uppercase tracking-widest font-semibold block mt-0.5"
              style={{ color: palette.secondary }}
            >
              {template.industry.split(',')[0]}
            </span>
          </div>
        </div>

        <button
          onClick={onCtaClick}
          className="px-4 py-2 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          style={{ backgroundColor: palette.secondary }}
        >
          <span>
            {isChurch ? 'Give Online (MoMo)' : isEdu ? 'Apply for Cohort' : isFashion ? 'Book Fitting' : 'Schedule Consult'}
          </span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </nav>

      {/* Hero */}
      <div
        className="relative py-14 sm:py-20 px-6 sm:px-12 text-white overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${palette.primary} 0%, #000000 100%)`,
        }}
      >
        {template.heroImage && (
          <div
            className="absolute inset-0 opacity-20 bg-cover bg-center"
            style={{ backgroundImage: `url(${template.heroImage})` }}
          />
        )}
        <div className="relative max-w-3xl space-y-5">
          <span
            className="inline-block text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full text-white/90 border border-white/20"
            style={{ backgroundColor: `${palette.secondary}40` }}
          >
            {template.categoryLabel}
          </span>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-white">
            {template.demoHeroTagline}
          </h1>

          <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-xl">
            {template.demoSubtext}
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <a
              href="#details"
              className="px-6 py-3 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-2"
              style={{ backgroundColor: palette.secondary }}
            >
              <span>{isChurch ? 'View Service Schedules' : isEdu ? 'Explore Programs' : 'View Offerings'}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Stats Bar */}
          <div className="pt-6 grid grid-cols-3 gap-4 border-t border-white/20 max-w-md">
            {template.stats?.map((stat, i) => (
              <div key={i}>
                <div className="text-2xl font-black text-amber-300">{stat.value}</div>
                <div className="text-[10px] text-slate-300 uppercase tracking-wider mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div id="details" className="py-14 px-4 sm:px-12 max-w-5xl mx-auto space-y-8">
        <div className="text-center max-w-md mx-auto space-y-1">
          <span className="text-xs uppercase tracking-widest font-bold" style={{ color: palette.secondary }}>
            {isChurch ? 'Fellowship With Us' : isEdu ? 'Accredited Curriculum' : 'Services & Offerings'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: palette.primary }}>
            {isChurch ? 'Weekly Worship Celebrations' : isEdu ? 'Career Training Programs' : 'Featured Capabilities'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-6 rounded-2xl border shadow-sm space-y-3 flex flex-col justify-between"
              style={{
                backgroundColor: palette.surface,
                borderColor: palette.border,
              }}
            >
              <div>
                {item.image && (
                  <div className="h-44 rounded-xl overflow-hidden mb-3">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between text-xs font-bold">
                  <span style={{ color: palette.secondary }}>{item.category}</span>
                  {item.price && <span className="font-mono text-sm">{item.price}</span>}
                </div>
                <h3 className="font-bold text-base mt-1" style={{ color: palette.text }}>
                  {item.name}
                </h3>
                <p className="text-xs leading-relaxed mt-1" style={{ color: palette.mutedText }}>
                  {item.desc}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-2 border-t" style={{ borderColor: palette.border }}>
                {item.specs?.map((s, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] px-2 py-0.5 rounded font-medium"
                    style={{ backgroundColor: `${palette.primary}10`, color: palette.primary }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action / Intake Section */}
      <div className="py-14 px-4 sm:px-12 border-t" style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
        <div className="max-w-2xl mx-auto rounded-3xl p-6 sm:p-10 border shadow-lg space-y-6" style={{ backgroundColor: palette.background, borderColor: palette.border }}>
          <div className="text-center space-y-1">
            <h3 className="text-2xl font-bold" style={{ color: palette.primary }}>
              {isChurch ? 'Online Giving & Tithes' : isEdu ? 'Enroll in Next Cohort' : 'Direct Client Consultation'}
            </h3>
            <p className="text-xs" style={{ color: palette.mutedText }}>
              {isChurch
                ? 'Support God’s work through MTN Mobile Money, Telecel Cash, and Bank Transfer.'
                : 'Submit your contact details for instant curriculum prospectus and entrance evaluation.'}
            </p>
          </div>

          {formSubmitted ? (
            <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="font-bold text-emerald-900 text-base">Request Submitted!</h4>
              <p className="text-xs text-emerald-700">
                We have received your submission and forwarded details to your WhatsApp / Phone.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Full Name"
                  className="w-full border rounded-xl px-3.5 py-2.5 focus:outline-none"
                  style={{ backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }}
                  required
                />
                <input
                  type="tel"
                  placeholder="Ghana WhatsApp Number"
                  className="w-full border rounded-xl px-3.5 py-2.5 focus:outline-none"
                  style={{ backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }}
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                style={{ backgroundColor: palette.secondary }}
              >
                <span>{isChurch ? 'Proceed to MoMo Tithe Prompt' : 'Submit Application'}</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer
        className="py-10 px-6 sm:px-12 text-xs text-slate-400"
        style={{ backgroundColor: palette.primary }}
      >
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="font-bold text-white text-base">
              {template.demoBusinessName}
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {template.description}
            </p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase text-xs">Address</h5>
            <p className="text-xs text-slate-300">{template.location}</p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase text-xs">Contact Information</h5>
            <p className="text-xs text-slate-300">{template.hoursOrContact}</p>
          </div>
        </div>
        <div className="border-t border-white/10 mt-8 pt-4 text-center text-slate-400 text-[10px]">
          © 2026 {template.demoBusinessName}. Powered by Mystery Hub Sites Ghana.
        </div>
      </footer>
    </div>
  );
};
