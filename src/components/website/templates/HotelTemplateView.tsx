import React, { useState } from 'react';
import { WebsiteTemplate } from '../../../types';
import {
  Palmtree,
  Calendar,
  Users,
  Compass,
  Star,
  Check,
  Wifi,
  Coffee,
  Waves,
  ArrowRight,
} from 'lucide-react';

interface TemplateViewProps {
  template: WebsiteTemplate;
  onCtaClick?: () => void;
}

export const HotelTemplateView: React.FC<TemplateViewProps> = ({ template, onCtaClick }) => {
  const [booked, setBooked] = useState<boolean>(false);
  const suites = template.items || [];

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setBooked(true);
    setTimeout(() => setBooked(false), 5000);
  };

  return (
    <div className="bg-[#f8f6f0] text-[#192b23] font-sans min-h-full">
      {/* Top Banner */}
      <div className="bg-[#132e23] text-[#f8f6f0] text-xs px-4 py-2 text-center tracking-wider flex items-center justify-center gap-2">
        <Palmtree className="w-3.5 h-3.5 text-[#10b981]" />
        <span>Where the Volta River Meets the Atlantic · Private Eco Chalets in Ada Foah</span>
      </div>

      {/* Navigation */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-[#e8e5dc] px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#132e23] text-[#10b981] flex items-center justify-center font-bold">
            <Palmtree className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-[#132e23] block leading-none font-serif">
              {template.demoBusinessName}
            </span>
            <span className="text-[10px] text-[#10b981] uppercase tracking-widest font-bold block mt-0.5">
              Eco-Resort & Beachfront Villas
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-[#687e74] uppercase tracking-wider">
          <a href="#suites" className="hover:text-[#132e23] transition-colors">
            Villas & Suites
          </a>
          <a href="#experiences" className="hover:text-[#132e23] transition-colors">
            Experiences
          </a>
          <a href="#reserve" className="hover:text-[#132e23] transition-colors">
            Book Stay
          </a>
          <a href="#location" className="hover:text-[#132e23] transition-colors">
            Ada Location
          </a>
        </div>

        <button
          onClick={onCtaClick}
          className="px-4 py-2 rounded-full bg-[#132e23] hover:bg-[#1f4838] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5 text-[#10b981]" />
          <span>Check Availability</span>
        </button>
      </nav>

      {/* Hero Section */}
      <div className="relative py-16 sm:py-24 px-6 sm:px-12 bg-gradient-to-r from-[#0d1e17] via-[#143025] to-[#0b1812] text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 bg-cover bg-center"
          style={{
            backgroundImage: `url(${template.heroImage || 'https://images.unsplash.com/photo-1566073771259-6a8506099945'})`,
          }}
        />
        <div className="relative max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10b981]/20 border border-[#10b981]/40 text-[#a7f3d0] text-xs font-semibold uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5 text-[#10b981]" />
            <span>Ada Foah Estuary Sanctuary</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-serif tracking-tight leading-tight text-white">
            {template.demoHeroTagline}
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
            {template.demoSubtext}
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <a
              href="#reserve"
              className="px-6 py-3 rounded-full bg-[#10b981] hover:bg-[#059669] text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-2"
            >
              <span>Reserve Eco Chalet</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#suites"
              className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs uppercase tracking-wider border border-white/20 transition-all flex items-center gap-2"
            >
              <span>Explore Suites</span>
            </a>
          </div>

          {/* Key Metrics */}
          <div className="pt-6 grid grid-cols-3 gap-4 border-t border-white/15 max-w-md">
            {template.stats?.map((stat, i) => (
              <div key={i}>
                <div className="text-xl font-bold text-[#a7f3d0] font-serif">{stat.value}</div>
                <div className="text-[10px] text-slate-300 uppercase tracking-wider mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Check-in Reservation Bar */}
      <div id="reserve" className="bg-white p-4 sm:p-6 border-b border-[#e8e5dc] shadow-md">
        <div className="max-w-5xl mx-auto">
          {booked ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center text-xs text-emerald-800 font-bold">
              ✓ Availability confirmed! We have reserved your provisional dates. Proceeding to WhatsApp concierge.
            </div>
          ) : (
            <form onSubmit={handleBooking} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-[#687e74] uppercase mb-1">
                  Check-In
                </label>
                <input
                  type="date"
                  defaultValue="2026-10-10"
                  className="w-full bg-[#f8f6f0] border border-[#e8e5dc] rounded-xl p-2.5 text-[#192b23] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#687e74] uppercase mb-1">
                  Check-Out
                </label>
                <input
                  type="date"
                  defaultValue="2026-10-12"
                  className="w-full bg-[#f8f6f0] border border-[#e8e5dc] rounded-xl p-2.5 text-[#192b23] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#687e74] uppercase mb-1">
                  Guests
                </label>
                <select className="w-full bg-[#f8f6f0] border border-[#e8e5dc] rounded-xl p-2.5 text-[#192b23] focus:outline-none">
                  <option>2 Adults (Couples Getaway)</option>
                  <option>4 Adults (Family Chalet)</option>
                  <option>Private Group Booking</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-[#132e23] hover:bg-[#10b981] hover:text-black text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Confirm Stay Dates
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Chalets & Suites Showcase */}
      <div id="suites" className="py-14 px-4 sm:px-12 max-w-5xl mx-auto space-y-8">
        <div className="text-center max-w-md mx-auto space-y-2">
          <span className="text-xs uppercase tracking-widest text-[#10b981] font-bold">
            Private Eco Sanctuary
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif text-[#132e23]">
            Oceanfront Villas & River Chalets
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {suites.map((suite) => (
            <div
              key={suite.id}
              className="bg-white rounded-3xl border border-[#e8e5dc] overflow-hidden shadow-sm hover:shadow-lg transition-shadow flex flex-col justify-between"
            >
              <div>
                {suite.image && (
                  <div className="h-56 overflow-hidden relative">
                    <img
                      src={suite.image}
                      alt={suite.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute bottom-3 right-3 bg-[#132e23] text-white px-3 py-1 rounded-full text-xs font-bold">
                      {suite.price}
                    </div>
                  </div>
                )}
                <div className="p-6 space-y-2">
                  <h3 className="font-bold text-lg text-[#132e23] font-serif">{suite.name}</h3>
                  <p className="text-xs text-[#687e74] leading-relaxed">{suite.desc}</p>
                </div>
              </div>

              <div className="p-6 pt-0 space-y-4">
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                  {suite.specs?.map((s, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-[#f8f6f0] text-[#192b23] px-2.5 py-0.5 rounded-full font-medium"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <button
                  onClick={onCtaClick}
                  className="w-full py-2.5 rounded-xl bg-[#132e23] hover:bg-[#10b981] hover:text-black text-white text-xs font-bold text-center block transition-colors cursor-pointer"
                >
                  Book This Suite
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer id="location" className="bg-[#0e2119] text-emerald-100 py-10 px-6 sm:px-12 text-xs">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="font-serif font-bold text-base text-white">
              {template.demoBusinessName}
            </h4>
            <p className="text-emerald-200/80 text-xs leading-relaxed">
              Sustainable luxury eco-resort nestled on the serene shores of Ada Foah, Ghana.
            </p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase text-xs">Resort Location</h5>
            <p className="text-emerald-200/80 text-xs">{template.location}</p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase text-xs">Concierge Reservations</h5>
            <p className="text-emerald-200/80 text-xs">{template.hoursOrContact}</p>
          </div>
        </div>
        <div className="border-t border-emerald-900/60 mt-8 pt-4 text-center text-emerald-400/60 text-[10px]">
          © 2026 {template.demoBusinessName}. Powered by Mystery Hub Sites Ghana.
        </div>
      </footer>
    </div>
  );
};
