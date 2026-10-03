import { SafeImage } from '../SafeImage.js';
import React, { useState } from 'react';
import { WebsiteTemplate } from '../../../types';
import {
  Utensils,
  Clock,
  MapPin,
  Calendar,
  Users,
  MessageSquare,
  Sparkles,
  Check,
  Star,
  Phone,
  Flame,
} from 'lucide-react';

interface TemplateViewProps {
  template: WebsiteTemplate;
  onCtaClick?: () => void;
}

export const RestaurantTemplateView: React.FC<TemplateViewProps> = ({ template, onCtaClick }) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedPartySize, setSelectedPartySize] = useState<number>(2);
  const [reservationDate, setReservationDate] = useState<string>('2026-10-02');
  const [reservationTime, setReservationTime] = useState<string>('19:30');
  const [isBooked, setIsBooked] = useState<boolean>(false);

  const categories = ['All', 'Main Grills', 'Soups & Swallows', 'Beverages'];
  const menuItems = template.items || [];

  const filteredItems = menuItems.filter((item) => {
    if (activeCategory === 'All') return true;
    return item.category === activeCategory;
  });

  const handleBookTable = (e: React.FormEvent) => {
    e.preventDefault();
    setIsBooked(true);
    setTimeout(() => setIsBooked(false), 5000);
  };

  return (
    <div className="bg-[#fcf9f5] text-[#1c1917] font-serif min-h-full">
      {/* Editorial Announcement Bar */}
      <div className="bg-[#7a1c28] text-[#fcf9f5] px-4 py-2 text-center text-xs tracking-wider uppercase font-sans flex items-center justify-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-[#c99a45]" />
        <span>Weekend Live Jazz & Osu Night Market Grills · Reserve Early</span>
      </div>

      {/* Restaurant Navigation */}
      <nav className="bg-[#fcf9f5]/95 backdrop-blur-md border-b border-[#f3ece2] px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-30 font-sans">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#7a1c28] text-[#c99a45] flex items-center justify-center font-serif text-lg font-bold">
            G
          </div>
          <div>
            <span className="font-bold text-base sm:text-lg tracking-wide text-[#7a1c28] font-serif block leading-none">
              {template.demoBusinessName}
            </span>
            <span className="text-[10px] text-[#78716c] uppercase tracking-widest block mt-0.5">
              Accra · Est. 2018
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 text-xs font-semibold uppercase tracking-wider text-[#78716c]">
          <a href="#menu" className="hover:text-[#7a1c28] transition-colors">
            Our Menu
          </a>
          <a href="#story" className="hover:text-[#7a1c28] transition-colors">
            Chef’s Craft
          </a>
          <a href="#reserve" className="hover:text-[#7a1c28] transition-colors">
            Reservations
          </a>
          <a href="#location" className="hover:text-[#7a1c28] transition-colors">
            Find Us
          </a>
        </div>

        <button
          onClick={onCtaClick}
          className="px-4 py-2 rounded-full bg-[#7a1c28] hover:bg-[#5d151e] text-[#fcf9f5] text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer font-sans"
        >
          <Calendar className="w-3.5 h-3.5 text-[#c99a45]" />
          <span>Reserve Table</span>
        </button>
      </nav>

      {/* Hero Section */}
      <div className="relative py-14 sm:py-20 px-6 sm:px-12 bg-gradient-to-br from-[#2a0e14] via-[#3b151d] to-[#1c090d] text-[#fcf9f5] overflow-hidden">
        <SafeImage className="absolute inset-0 opacity-45   " src={template.heroImage || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5'} alt={template.demoBusinessName} loading="eager" fetchPriority="high" />
        <div className="relative max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#c99a45]/20 border border-[#c99a45]/40 text-[#c99a45] text-xs font-sans font-semibold tracking-wider uppercase">
            <Utensils className="w-3.5 h-3.5" />
            <span>Modern Ghanaian Gastronomy</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-normal tracking-tight leading-[1.15] text-[#fcf9f5]">
            {template.demoHeroTagline}
          </h1>

          <p className="text-sm sm:text-base text-slate-300 font-sans max-w-xl leading-relaxed">
            {template.demoSubtext}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3 font-sans">
            <a
              href="#reserve"
              className="px-6 py-3 rounded-full bg-[#c99a45] hover:bg-[#b58735] text-[#1c1917] font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-2"
            >
              <span>Book an Evening Table</span>
            </a>
            <a
              href="#menu"
              className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs uppercase tracking-wider border border-white/20 transition-all flex items-center gap-2"
            >
              <span>Explore Digital Menu</span>
            </a>
          </div>

          {/* Key Restaurant Statistics */}
          <div className="pt-6 grid grid-cols-3 gap-4 border-t border-white/15 max-w-md font-sans">
            {template.stats?.map((stat, i) => (
              <div key={i}>
                <div className="text-xl font-bold text-[#c99a45] font-serif">{stat.value}</div>
                <div className="text-[11px] text-slate-300 uppercase tracking-wider mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Food Menu Section */}
      <div id="menu" className="py-14 px-4 sm:px-12 max-w-5xl mx-auto space-y-8 font-sans">
        <div className="text-center max-w-lg mx-auto space-y-2">
          <span className="text-xs uppercase tracking-widest text-[#c99a45] font-bold">
            Curated Culinary Selection
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif text-[#7a1c28]">
            Crafted with Fresh Ghanaian Produce
          </h2>
          <p className="text-xs text-[#78716c]">
            Every dish is prepared to order with fresh herbs from our local farmers in Aburi.
          </p>
        </div>

        {/* Menu Category Filter Pills */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-[#7a1c28] text-white shadow-sm'
                  : 'bg-white border border-[#f3ece2] text-[#78716c] hover:border-[#7a1c28]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white p-4 rounded-2xl border border-[#f3ece2] shadow-sm hover:shadow-md transition-shadow flex gap-4 items-start"
            >
              {item.image && (
                <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-100">
                  <SafeImage
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-sm text-[#1c1917] font-serif">{item.name}</h3>
                  <span className="font-bold text-xs text-[#7a1c28] shrink-0 font-sans">
                    {item.price}
                  </span>
                </div>
                <p className="text-xs text-[#78716c] leading-relaxed line-clamp-2">
                  {item.desc}
                </p>
                {item.tag && (
                  <span className="inline-block text-[10px] font-bold text-[#c99a45] bg-[#c99a45]/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {item.tag}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Table Reservation Card */}
      <div id="reserve" className="py-12 px-4 sm:px-12 bg-[#f3ece2]/60 border-y border-[#e7ded1] font-sans">
        <div className="max-w-3xl mx-auto bg-white rounded-3xl p-6 sm:p-10 shadow-lg border border-[#e2d5c3] space-y-6">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold text-[#7a1c28] uppercase tracking-widest">
              Instant Online Booking
            </span>
            <h3 className="text-2xl font-serif text-[#1c1917]">Reserve Your Table in Osu</h3>
            <p className="text-xs text-[#78716c]">
              No deposit required for parties under 8 guests. Instant SMS & WhatsApp confirmation.
            </p>
          </div>

          {isBooked ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto">
                <Check className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-emerald-800 text-base">Table Reservation Confirmed!</h4>
              <p className="text-xs text-emerald-700">
                We have reserved a table for {selectedPartySize} on {reservationDate} at {reservationTime}. See you in Osu!
              </p>
            </div>
          ) : (
            <form onSubmit={handleBookTable} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#78716c] uppercase mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={reservationDate}
                    onChange={(e) => setReservationDate(e.target.value)}
                    className="w-full bg-[#fcf9f5] border border-[#e7ded1] rounded-xl px-3 py-2 text-xs text-[#1c1917] focus:outline-none focus:border-[#7a1c28]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#78716c] uppercase mb-1">
                    Time
                  </label>
                  <select
                    value={reservationTime}
                    onChange={(e) => setReservationTime(e.target.value)}
                    className="w-full bg-[#fcf9f5] border border-[#e7ded1] rounded-xl px-3 py-2 text-xs text-[#1c1917] focus:outline-none focus:border-[#7a1c28]"
                  >
                    <option value="12:30">12:30 PM (Lunch)</option>
                    <option value="14:00">2:00 PM (Afternoon)</option>
                    <option value="18:30">6:30 PM (Sunset)</option>
                    <option value="19:30">7:30 PM (Dinner)</option>
                    <option value="20:30">8:30 PM (Late Night)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#78716c] uppercase mb-1">
                    Guests
                  </label>
                  <select
                    value={selectedPartySize}
                    onChange={(e) => setSelectedPartySize(Number(e.target.value))}
                    className="w-full bg-[#fcf9f5] border border-[#e7ded1] rounded-xl px-3 py-2 text-xs text-[#1c1917] focus:outline-none focus:border-[#7a1c28]"
                  >
                    <option value={1}>1 Guest (Solo)</option>
                    <option value={2}>2 Guests (Couple)</option>
                    <option value={4}>4 Guests (Table)</option>
                    <option value={6}>6 Guests (Family)</option>
                    <option value={10}>10+ Guests (Private Area)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Your Full Name"
                  className="w-full bg-[#fcf9f5] border border-[#e7ded1] rounded-xl px-3.5 py-2.5 text-xs text-[#1c1917] focus:outline-none focus:border-[#7a1c28]"
                  required
                />
                <input
                  type="tel"
                  placeholder="WhatsApp Mobile (+233 24 000 0000)"
                  className="w-full bg-[#fcf9f5] border border-[#e7ded1] rounded-xl px-3.5 py-2.5 text-xs text-[#1c1917] focus:outline-none focus:border-[#7a1c28]"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-[#7a1c28] hover:bg-[#5d151e] text-[#fcf9f5] font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-[#c99a45]" />
                <span>Confirm Reservation (Instant WhatsApp Confirmation)</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Location & Contact Footer */}
      <footer id="location" className="bg-[#1c1917] text-[#fcf9f5] py-10 px-6 sm:px-12 font-sans text-xs">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="font-serif font-bold text-base text-[#c99a45]">
              {template.demoBusinessName}
            </h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Authentic Ghanaian heritage dishes reimagined with fresh coastal produce in the heart of Osu.
            </p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase tracking-wider text-[11px]">
              Location & Hours
            </h5>
            <p className="text-slate-400 text-xs">
              {template.location}
            </p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase tracking-wider text-[11px]">
              Direct Reservations
            </h5>
            <p className="text-slate-400 text-xs">
              {template.hoursOrContact}
            </p>
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                <Check className="w-3.5 h-3.5" />
                <span>MoMo & Cashless Accepted</span>
              </span>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 mt-8 pt-4 text-center text-slate-500 text-[10px]">
          © 2026 {template.demoBusinessName}. Built on Mystery Hub Sites Ghana.
        </div>
      </footer>
    </div>
  );
};
