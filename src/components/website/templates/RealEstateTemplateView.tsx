import React, { useState } from 'react';
import { WebsiteTemplate } from '../../../types';
import {
  Building,
  MapPin,
  Search,
  Bed,
  Bath,
  Maximize2,
  Calendar,
  ArrowRight,
  Phone,
  Shield,
  CheckCircle,
} from 'lucide-react';

interface TemplateViewProps {
  template: WebsiteTemplate;
  onCtaClick?: () => void;
}

export const RealEstateTemplateView: React.FC<TemplateViewProps> = ({ template, onCtaClick }) => {
  const [propertyType, setPropertyType] = useState<string>('All');
  const [selectedLocation, setSelectedLocation] = useState<string>('All Locations');
  const [tourScheduled, setTourScheduled] = useState<boolean>(false);

  const listings = template.items || [];

  const filteredListings = listings.filter((item) => {
    if (propertyType !== 'All' && item.category !== propertyType) return false;
    return true;
  });

  const handleTourSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTourScheduled(true);
    setTimeout(() => setTourScheduled(false), 5000);
  };

  return (
    <div className="bg-[#f8fafc] text-slate-900 font-sans min-h-full">
      {/* Top Gold Coast Prestige Banner */}
      <div className="bg-[#0f172a] text-slate-300 text-xs px-4 py-2 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#0ea5e9]" />
          <span>Exclusive Developer Listings in Greater Accra & Aburi Hills</span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-[11px]">
          <span>Titled Properties Only</span>
          <span>·</span>
          <span>USD & GHS Accepted</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0f172a] text-[#0ea5e9] flex items-center justify-center font-bold">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-[#0f172a] block leading-none">
              {template.demoBusinessName}
            </span>
            <span className="text-[10px] text-[#0ea5e9] uppercase tracking-widest font-bold block mt-0.5">
              Luxury Property & Estates Ghana
            </span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-6 text-xs font-bold text-slate-600 uppercase tracking-wider">
          <a href="#search" className="hover:text-[#0ea5e9] transition-colors">
            Property Search
          </a>
          <a href="#featured" className="hover:text-[#0ea5e9] transition-colors">
            Featured Homes
          </a>
          <a href="#tour" className="hover:text-[#0ea5e9] transition-colors">
            Schedule Tour
          </a>
          <a href="#contact" className="hover:text-[#0ea5e9] transition-colors">
            Advisors
          </a>
        </div>

        <button
          onClick={onCtaClick}
          className="px-4 py-2 rounded-xl bg-[#0f172a] hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5 text-[#0ea5e9]" />
          <span>Book Private Tour</span>
        </button>
      </nav>

      {/* Hero with Embedded Property Search Bar */}
      <div className="relative py-14 sm:py-20 px-6 sm:px-12 bg-gradient-to-r from-[#0c131f] via-[#111e31] to-[#0a101b] text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 bg-cover bg-center"
          style={{
            backgroundImage: `url(${template.heroImage || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9'})`,
          }}
        />
        <div className="relative max-w-4xl mx-auto space-y-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0ea5e9]/20 border border-[#0ea5e9]/40 text-[#38bdf8] text-xs font-semibold uppercase tracking-wider">
            <span>Prime Real Estate in Ghana</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-white">
            {template.demoHeroTagline}
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
            {template.demoSubtext}
          </p>

          {/* Embedded Real Estate Search Box */}
          <div id="search" className="bg-white p-3 sm:p-4 rounded-2xl shadow-2xl text-left max-w-3xl mx-auto text-slate-900 grid grid-cols-1 sm:grid-cols-4 gap-3 mt-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none"
              >
                <option value="All Locations">All Prime Areas</option>
                <option value="Cantonments">Cantonments</option>
                <option value="Airport Residential">Airport Residential</option>
                <option value="East Legon">East Legon Hills</option>
                <option value="Aburi">Aburi Mountain</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Property Type
              </label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none"
              >
                <option value="All">All Types</option>
                <option value="For Sale">Villas & Penthouses (Sale)</option>
                <option value="For Rent">Luxury Rentals</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Bedrooms
              </label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none">
                <option>Any Beds</option>
                <option>3+ Bedrooms</option>
                <option>4+ Bedrooms</option>
                <option>5+ Bedrooms</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                className="w-full py-2.5 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>Search Listings</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Properties Grid */}
      <div id="featured" className="py-14 px-4 sm:px-12 max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-widest text-[#0ea5e9] font-bold block">
              Curated Portfolio
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] mt-1">
              Featured Luxury Residences
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {['All', 'For Sale', 'For Rent'].map((type) => (
              <button
                key={type}
                onClick={() => setPropertyType(type)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  propertyType === type
                    ? 'bg-[#0f172a] text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-[#0ea5e9]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredListings.map((prop) => (
            <div
              key={prop.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
            >
              <div>
                {prop.image && (
                  <div className="h-48 overflow-hidden relative bg-slate-100">
                    <img
                      src={prop.image}
                      alt={prop.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute top-3 left-3 bg-[#0f172a]/90 backdrop-blur-sm px-2.5 py-1 rounded-md text-[10px] font-bold text-white uppercase tracking-wider">
                      {prop.category}
                    </div>
                    <div className="absolute bottom-3 right-3 bg-[#0ea5e9] text-white px-3 py-1 rounded-lg text-xs font-black shadow-md">
                      {prop.price}
                    </div>
                  </div>
                )}
                <div className="p-5 space-y-2">
                  <h3 className="font-bold text-base text-[#0f172a]">{prop.name}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {prop.desc}
                  </p>
                </div>
              </div>

              <div className="p-5 pt-0 space-y-4">
                {/* Bed/Bath/SqFt Metrics */}
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-center text-slate-600 text-xs font-semibold">
                  <span className="flex items-center justify-center gap-1">
                    <Bed className="w-3.5 h-3.5 text-[#0ea5e9]" />
                    <span>{prop.specs?.[0] || '4 Beds'}</span>
                  </span>
                  <span className="flex items-center justify-center gap-1">
                    <Bath className="w-3.5 h-3.5 text-[#0ea5e9]" />
                    <span>{prop.specs?.[1] || '4 Baths'}</span>
                  </span>
                  <span className="flex items-center justify-center gap-1">
                    <Maximize2 className="w-3.5 h-3.5 text-[#0ea5e9]" />
                    <span>{prop.specs?.[2] || '420 m²'}</span>
                  </span>
                </div>

                <a
                  href="#tour"
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-[#0ea5e9] hover:text-white text-[#0f172a] text-xs font-bold text-center block transition-colors cursor-pointer"
                >
                  Schedule Private Tour
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Schedule Tour Form */}
      <div id="tour" className="py-14 px-4 sm:px-12 bg-slate-100 border-t border-slate-200">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 sm:p-10 shadow-lg border border-slate-200 space-y-6">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold text-[#0ea5e9] uppercase tracking-widest">
              VIP Buyer Concierge
            </span>
            <h3 className="text-2xl font-extrabold text-[#0f172a]">Schedule a Viewing</h3>
            <p className="text-xs text-slate-500">
              Our licensed broker will accompany you for an in-person or virtual walkthrough.
            </p>
          </div>

          {tourScheduled ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="font-bold text-emerald-900 text-base">Viewing Booked!</h4>
              <p className="text-xs text-emerald-700">
                Our lead property advisor has reached out via WhatsApp to confirm the security gate pass for Cantonments.
              </p>
            </div>
          ) : (
            <form onSubmit={handleTourSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Property of Interest
                  </label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#0ea5e9]">
                    {listings.map((l) => (
                      <option key={l.id}>{l.name} ({l.price})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Preferred Viewing Date
                  </label>
                  <input
                    type="date"
                    defaultValue="2026-10-05"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#0ea5e9]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Full Name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#0ea5e9]"
                  required
                />
                <input
                  type="tel"
                  placeholder="WhatsApp Mobile (+233 24 000 0000)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#0ea5e9]"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-[#0f172a] hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-[#0ea5e9]" />
                <span>Confirm Private Walkthrough</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer id="contact" className="bg-[#0f172a] text-slate-400 py-10 px-6 sm:px-12 text-xs">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="font-bold text-white text-base">
              {template.demoBusinessName}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ghana’s premier luxury real estate advisory. Connecting high-net-worth investors and discerning homeowners to titled residential and commercial assets.
            </p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase text-xs">Office Suite</h5>
            <p className="text-xs">{template.location}</p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase text-xs">Direct Broker Contact</h5>
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
