import { SafeImage } from '../SafeImage.js';
import React, { useState } from 'react';
import { WebsiteTemplate } from '../../../types';
import {
  Sparkles,
  Scissors,
  Clock,
  MapPin,
  Calendar,
  Check,
  Star,
  Heart,
  Smile,
  Phone,
} from 'lucide-react';

interface TemplateViewProps {
  template: WebsiteTemplate;
  onCtaClick?: () => void;
}

export const SalonTemplateView: React.FC<TemplateViewProps> = ({ template, onCtaClick }) => {
  const [selectedStylist, setSelectedStylist] = useState<string>('Abena - Braiding Artisan');
  const [selectedService, setSelectedService] = useState<string>('Goddess Knotless Box Braids (Mid-Back)');
  const [bookingConfirmed, setBookingConfirmed] = useState<boolean>(false);

  const services = template.items || [];

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (template.siteContent) { onCtaClick?.(); return; }
    setBookingConfirmed(true);
    setTimeout(() => setBookingConfirmed(false), 5000);
  };

  return (
    <div className="bg-[var(--website-background,#fff9fa)] text-[#2e1020] font-sans min-h-full">
      {/* Top Rose Gold Announcement */}
      <div className="bg-[var(--website-accent,#ec4899)] text-white text-xs px-4 py-2 text-center tracking-wider font-semibold flex items-center justify-center gap-2">
        <Sparkles className="w-3.5 h-3.5" />
        <span>{template.location}</span>
      </div>

      {/* Navigation */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-[#fae3ec] px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#fdf2f6] border border-[var(--website-accent,#ec4899)]/30 text-[var(--website-accent,#ec4899)] flex items-center justify-center">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base sm:text-lg tracking-tight text-[var(--website-primary,#3b1828)] block leading-none font-serif">
              {template.demoBusinessName}
            </span>
            <span className="text-[10px] text-[var(--website-accent,#ec4899)] uppercase tracking-widest font-semibold block mt-0.5">
              Hair · Barbershop · Esthetics
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 text-xs font-semibold tracking-wider text-[#836574]">
          <a href="#services" className="hover:text-[var(--website-accent,#ec4899)] transition-colors">
            Services & Rates
          </a>
          <a href="#stylists" className="hover:text-[var(--website-accent,#ec4899)] transition-colors">
            Our Stylists
          </a>
          <a href="#book" className="hover:text-[var(--website-accent,#ec4899)] transition-colors">
            Book Appointment
          </a>
          <a href="#salon-info" className="hover:text-[var(--website-accent,#ec4899)] transition-colors">
            Location
          </a>
        </div>

        <button
          onClick={onCtaClick}
          className="px-4 py-2 rounded-full bg-[var(--website-accent,#ec4899)] hover:bg-[#db2777] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>{template.siteContent?.ctaLabel || 'Book Session'}</span>
        </button>
      </nav>

      {/* Hero Banner */}
      <div className="relative py-16 sm:py-24 px-6 sm:px-12 bg-gradient-to-r from-[#381425] via-[#4d1b33] to-[#2b0f1d] text-white overflow-hidden">
        <SafeImage className="absolute inset-0 opacity-45   " src={template.heroImage || 'https://images.unsplash.com/photo-1560066984-138dadb4c035'} alt={template.demoBusinessName} loading="eager" fetchPriority="high" />
        <div className="relative max-w-2xl space-y-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[#fbcfe8] text-xs font-semibold uppercase tracking-wider">
            <Heart className="w-3.5 h-3.5 text-[var(--website-accent,#ec4899)]" />
            <span>Accra’s Premier Luxury Studio</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-serif tracking-tight leading-tight text-white">
            {template.demoHeroTagline}
          </h1>

          <p className="text-sm sm:text-base text-pink-100 max-w-lg leading-relaxed">
            {template.demoSubtext}
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <a
              href="#book"
              className="px-6 py-3 rounded-full bg-[var(--website-accent,#ec4899)] hover:bg-[#db2777] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-2"
            >
              <span>Schedule Your Glow Up</span>
            </a>
            <a
              href="#services"
              className="px-6 py-3 rounded-full bg-white/15 hover:bg-white/25 text-white font-semibold text-xs uppercase tracking-wider border border-white/20 transition-all flex items-center gap-2"
            >
              <span>View Service Rate Card</span>
            </a>
          </div>

          {/* Salon Metrics */}
          <div className="pt-6 grid grid-cols-3 gap-4 border-t border-pink-400/20 max-w-md">
            {template.stats?.map((stat, i) => (
              <div key={i}>
                <div className="text-xl font-bold text-[#fbcfe8] font-serif">{stat.value}</div>
                <div className="text-[10px] text-pink-200 uppercase tracking-wider mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Services & Treatment Menu */}
      <div id="services" className="py-14 px-4 sm:px-12 max-w-5xl mx-auto space-y-8">
        <div className="text-center max-w-md mx-auto space-y-2">
          <span className="text-xs uppercase tracking-widest text-[var(--website-accent,#ec4899)] font-bold">
            Transparent Pricing in Ghana Cedis
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif text-[var(--website-primary,#3b1828)]">
            Luxury Hair & Grooming Menu
          </h2>
          <p className="text-xs text-[#836574]">
            All treatments include scalp therapy and complimentary chilled hibiscus tea.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {services.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-[#fae3ec] overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                {item.image && (
                  <div className="h-44 overflow-hidden relative">
                    <SafeImage
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-xs font-bold text-pink-200">
                      {item.price}
                    </div>
                  </div>
                )}
                <div className="p-5 space-y-2">
                  <span className="text-[10px] font-bold text-[var(--website-accent,#ec4899)] uppercase tracking-wider">
                    {item.category}
                  </span>
                  <h3 className="font-bold text-base text-[var(--website-primary,#3b1828)] font-serif">{item.name}</h3>
                  <p className="text-xs text-[#836574] leading-relaxed">{item.desc}</p>
                </div>
              </div>

              <div className="p-5 pt-0 space-y-3">
                <div className="flex flex-wrap gap-1">
                  {item.specs?.map((s, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-[#fdf2f6] text-[#836574] px-2 py-0.5 rounded-full font-medium"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <a
                  href="#book"
                  onClick={() => setSelectedService(item.name)}
                  className="w-full py-2 rounded-xl bg-[#fdf2f6] hover:bg-[var(--website-accent,#ec4899)] hover:text-white text-[var(--website-accent,#ec4899)] text-xs font-bold text-center block transition-colors cursor-pointer"
                >
                  Book This Treatment
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Stylist & Slot Booking Section */}
      <div id="book" className="py-14 px-4 sm:px-12 bg-[#fdf2f6] border-y border-[#fae3ec]">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 sm:p-10 shadow-lg border border-[#f5d0e0] space-y-6">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold text-[var(--website-accent,#ec4899)] uppercase tracking-widest">
              {template.siteContent ? 'Appointment Enquiry' : 'Appointment enquiry'}
            </span>
            <h3 className="text-2xl font-serif text-[var(--website-primary,#3b1828)]">Book Your Glow Session</h3>
            <p className="text-xs text-[#836574]">
              Select your master stylist and preferred time slot in East Legon.
            </p>
          </div>

          {bookingConfirmed ? (
            <div className="p-6 rounded-2xl bg-pink-50 border border-pink-200 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-[var(--website-accent,#ec4899)] text-white flex items-center justify-center mx-auto">
                <Check className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-[var(--website-primary,#3b1828)] text-base">Example appointment</h4>
              <p className="text-xs text-[#836574]">
                Your session with {selectedStylist} for {selectedService} is recorded. We have sent confirmation to your WhatsApp.
              </p>
            </div>
          ) : (
            <form onSubmit={handleBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#836574] uppercase mb-1">
                  Selected Treatment
                </label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full bg-[var(--website-background,#fff9fa)] border border-[#f5d0e0] rounded-xl px-3.5 py-2.5 text-xs text-[var(--website-primary,#3b1828)] focus:outline-none focus:border-[var(--website-accent,#ec4899)]"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.price})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#836574] uppercase mb-1">
                    Select Stylist
                  </label>
                  <select
                    value={selectedStylist}
                    onChange={(e) => setSelectedStylist(e.target.value)}
                    className="w-full bg-[var(--website-background,#fff9fa)] border border-[#f5d0e0] rounded-xl px-3.5 py-2.5 text-xs text-[var(--website-primary,#3b1828)] focus:outline-none focus:border-[var(--website-accent,#ec4899)]"
                  >
                    <option value="Abena - Braiding Artisan">Abena (Senior Braiding Specialist)</option>
                    <option value="Kweku - Master Barber">Kweku (Master Barber & Fades)</option>
                    <option value="Efia - Esthetician">Efia (Skin & Hydra-Facial Specialist)</option>
                    <option value="First Available">First Available Master Stylist</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#836574] uppercase mb-1">
                    Preferred Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    defaultValue="2026-10-03T11:00"
                    className="w-full bg-[var(--website-background,#fff9fa)] border border-[#f5d0e0] rounded-xl px-3.5 py-2.5 text-xs text-[var(--website-primary,#3b1828)] focus:outline-none focus:border-[var(--website-accent,#ec4899)]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Your Full Name"
                  className="w-full bg-[var(--website-background,#fff9fa)] border border-[#f5d0e0] rounded-xl px-3.5 py-2.5 text-xs text-[var(--website-primary,#3b1828)] focus:outline-none focus:border-[var(--website-accent,#ec4899)]"
                  required
                />
                <input
                  type="tel"
                  placeholder="Ghana WhatsApp Number"
                  className="w-full bg-[var(--website-background,#fff9fa)] border border-[#f5d0e0] rounded-xl px-3.5 py-2.5 text-xs text-[var(--website-primary,#3b1828)] focus:outline-none focus:border-[var(--website-accent,#ec4899)]"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-[var(--website-accent,#ec4899)] hover:bg-[#db2777] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                <span>{template.siteContent ? 'Contact to Arrange Appointment' : 'Preview appointment enquiry'}</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer id="salon-info" className="bg-[#240c17] text-pink-100 py-10 px-6 sm:px-12 text-xs">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="font-serif font-bold text-base text-white">
              {template.demoBusinessName}
            </h4>
            <p className="text-pink-200/80 text-xs leading-relaxed">
              Your crown is our priority. Specialized in natural hair care, painless knotless styling, and royal men's grooming.
            </p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase text-xs">Studio Location</h5>
            <p className="text-pink-200/80 text-xs">{template.location}</p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase text-xs">Direct Studio Line</h5>
            <p className="text-pink-200/80 text-xs">{template.hoursOrContact}</p>
          </div>
        </div>
        <div className="border-t border-pink-900/40 mt-8 pt-4 text-center text-pink-300/60 text-[10px]">
          © 2026 {template.demoBusinessName}. Powered by Mystery Hub Sites Ghana.
        </div>
      </footer>
    </div>
  );
};
