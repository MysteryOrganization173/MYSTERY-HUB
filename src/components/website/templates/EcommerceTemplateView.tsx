import { SafeImage } from '../SafeImage.js';
import React, { useState } from 'react';
import { WebsiteTemplate } from '../../../types';
import {
  ShoppingBag,
  Search,
  Truck,
  ShieldCheck,
  Star,
  Check,
  ArrowRight,
  Flame,
  Phone,
  RotateCcw,
} from 'lucide-react';

interface TemplateViewProps {
  template: WebsiteTemplate;
  onCtaClick?: () => void;
}

export const EcommerceTemplateView: React.FC<TemplateViewProps> = ({ template, onCtaClick }) => {
  const [cartCount, setCartCount] = useState<number>(1);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [notification, setNotification] = useState<string | null>(null);

  const products = template.items || [];
  const filteredProducts = products.filter((p) => {
    if (activeCategory === 'All') return true;
    return p.category === activeCategory;
  });

  const handleAddToCart = (productName: string) => {
    if (template.siteContent) { onCtaClick?.(); return; }
    setCartCount((prev) => prev + 1);
    setNotification(`Added "${productName}" to cart!`);
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="bg-[#f8fafc] text-slate-900 font-sans min-h-full">
      {/* Top E-Commerce Announcement Bar */}
      <div className="bg-[var(--website-accent,#2563eb)] text-white text-xs px-4 py-2 text-center font-bold tracking-wide flex items-center justify-center gap-2">
        <Flame className="w-3.5 h-3.5 text-amber-300" />
        <span>⚡ Flash Sale: Same-Day Delivery in Accra on all orders placed before 3:00 PM!</span>
      </div>

      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--website-accent,#2563eb)] text-white flex items-center justify-center font-black">
            GH
          </div>
          <div>
            <span className="font-black text-base sm:text-lg tracking-tight text-slate-900 block leading-none">
              {template.demoBusinessName}
            </span>
            <span className="text-[10px] text-slate-500 block font-semibold mt-0.5">
              Original Electronics Ghana
            </span>
          </div>
        </div>

        {/* Mock Search Input */}
        <div className="hidden md:flex items-center bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 w-64 text-xs text-slate-500">
          <Search className="w-3.5 h-3.5 mr-2 text-slate-400" />
          <input
            type="text"
            placeholder="Search laptops, AirPods, chargers..."
            className="bg-transparent border-none focus:outline-none w-full text-slate-800 text-xs"
            readOnly
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onCtaClick}
            className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors cursor-pointer"
            title={template.siteContent ? 'Contact this business' : 'Cart'}
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#ef4444] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {template.siteContent ? <Phone className="w-3 h-3" /> : cartCount}
            </span>
          </button>

          <button
            onClick={onCtaClick}
            className="px-3.5 py-2 rounded-xl bg-[var(--website-accent,#2563eb)] hover:bg-[#1d4ed8] text-white font-bold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <span>{template.siteContent?.ctaLabel || (template.siteContent ? 'Contact' : 'Checkout')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Hero Showcase */}
      <div className="relative py-12 sm:py-16 px-6 sm:px-12 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 text-white overflow-hidden">
        <SafeImage className="absolute inset-0 opacity-40  " src={template.heroImage || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e'} alt={template.demoBusinessName} loading="eager" fetchPriority="high" />
        <div className="relative max-w-2xl space-y-4">
          <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30">
            100% Genuine Guaranteed · Official Warranty
          </span>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight text-white">
            {template.demoHeroTagline}
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-lg">
            {template.demoSubtext}
          </p>

          <div className="pt-2 flex flex-wrap gap-2.5">
            <a
              href="#products"
              className="px-5 py-2.5 rounded-xl bg-[var(--website-accent,#2563eb)] hover:bg-[#1d4ed8] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2"
            >
              <span>Browse Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={onCtaClick}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs uppercase tracking-wider border border-white/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Order via WhatsApp MoMo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Trust Badges Bar */}
      <div className="bg-white border-b border-slate-200 py-4 px-6 sm:px-12">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-[var(--website-accent,#2563eb)] shrink-0" />
            <div>
              <div className="font-bold text-slate-800">Same-Day Dispatch</div>
              <div className="text-[10px] text-slate-500">Across Greater Accra</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <div className="font-bold text-slate-800">12-Month Warranty</div>
              <div className="text-[10px] text-slate-500">Official replacements</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Check className="w-5 h-5 text-[var(--website-accent,#2563eb)] shrink-0" />
            <div>
              <div className="font-bold text-slate-800">Pay on Delivery</div>
              <div className="text-[10px] text-slate-500">MoMo or Cash in Accra</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <RotateCcw className="w-5 h-5 text-slate-700 shrink-0" />
            <div>
              <div className="font-bold text-slate-800">7-Day Easy Return</div>
              <div className="text-[10px] text-slate-500">Hassle-free exchange</div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Catalog Grid */}
      <div id="products" className="py-12 px-4 sm:px-12 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Trending Hardware & Gadgets
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All items in stock at our Circle retail showroom.
            </p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {(template.siteContent ? ['All', ...new Set(products.map(item=>item.category).filter((category):category is string=>Boolean(category) && category!=='All'))] : ['All', 'Laptops', 'Audio', 'Accessories']).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-[var(--website-accent,#2563eb)] text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group"
            >
              <div>
                {p.image && (
                  <div className="h-48 overflow-hidden relative bg-slate-50 p-4 flex items-center justify-center">
                    <SafeImage
                      src={p.image}
                      alt={p.name}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                    />
                    {p.tag && (
                      <span className="absolute top-3 left-3 bg-[#ef4444] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                        {p.tag}
                      </span>
                    )}
                  </div>
                )}
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-1 text-amber-400 text-xs">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span className="text-[11px] text-slate-500 font-semibold ml-1">(48)</span>
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 group-hover:text-[var(--website-accent,#2563eb)] transition-colors">
                    {p.name}
                  </h3>
                  <div className="font-extrabold text-base text-slate-900">
                    {p.price}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {p.desc}
                  </p>
                </div>
              </div>

              <div className="p-4 pt-0 space-y-2">
                <button
                  onClick={() => handleAddToCart(p.name)}
                  className="w-full py-2.5 rounded-xl bg-[var(--website-accent,#2563eb)] hover:bg-[#1d4ed8] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>{template.siteContent ? 'Enquire' : 'Add to Bag'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10 px-6 sm:px-12 text-xs">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="font-bold text-white text-base">
              {template.demoBusinessName}
            </h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Ghana’s verified electronics superstore. All genuine products backed by full warranty and rapid MoMo dispatch.
            </p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase text-xs">Showroom Address</h5>
            <p className="text-xs">{template.location}</p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase text-xs">Order Desk</h5>
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
