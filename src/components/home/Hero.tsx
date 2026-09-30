import React from 'react';
import { useApp } from '../../context/AppContext';
import { Wifi, ArrowRight, CheckCircle } from 'lucide-react';

export const Hero: React.FC = () => {
  const { setActivePage } = useApp();

  return (
    <section className="relative overflow-hidden pt-5 pb-8 sm:pt-8 sm:pb-12 lg:pt-14 lg:pb-18 bg-[#070b0e]">
      {/* Composed Backdrop Artwork Layer */}
      <div
        className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0"
        aria-hidden="true"
        role="presentation"
      >
        {/* Responsive Cloudinary Image */}
        <picture>
          {/* Mobile (< 768px): Cropped to east (illuminated Accra connectivity artwork), responsive sizing */}
          <source
            media="(max-width: 767px)"
            srcSet="https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_640,c_fill,g_east/v1790778037/ChatGPT_Image_Sep_30_2026_02_14_20_PM_baowst.png 640w,
                    https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_768,c_fill,g_east/v1790778037/ChatGPT_Image_Sep_30_2026_02_14_20_PM_baowst.png 768w"
            sizes="100vw"
          />
          {/* Tablet (768px - 1023px) */}
          <source
            media="(max-width: 1023px)"
            srcSet="https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_1024/v1790778037/ChatGPT_Image_Sep_30_2026_02_14_20_PM_baowst.png 1024w"
            sizes="100vw"
          />
          {/* Desktop (1024px+) */}
          <img
            src="https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_1600/v1790778037/ChatGPT_Image_Sep_30_2026_02_14_20_PM_baowst.png"
            srcSet="https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_1280/v1790778037/ChatGPT_Image_Sep_30_2026_02_14_20_PM_baowst.png 1280w,
                    https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_1600/v1790778037/ChatGPT_Image_Sep_30_2026_02_14_20_PM_baowst.png 1600w,
                    https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_1920/v1790778037/ChatGPT_Image_Sep_30_2026_02_14_20_PM_baowst.png 1920w"
            sizes="100vw"
            alt=""
            fetchPriority="high"
            loading="eager"
            decoding="async"
            className="w-full h-full object-cover object-[88%_top] sm:object-[80%_center] lg:object-right opacity-70 sm:opacity-85 lg:opacity-95"
          />
        </picture>

        {/* Desktop Horizontal Gradient Overlay:
            Solid dark on the left (0–38%) for maximum text contrast,
            smoothly transitioning across center (38–70%) so the illuminated Accra artwork emerges naturally */}
        <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-[#070b0e] via-[#070b0e]/85 to-transparent from-0% via-40% to-72%" />

        {/* Mobile Gradient Overlay:
            Rich dark fade from bottom/center so text and CTAs have crystal clear readability
            while letting the glowing Accra landmarks peek through the top/ambient background */}
        <div className="lg:hidden absolute inset-0 bg-gradient-to-b from-[#070b0e]/40 via-[#070b0e]/85 to-[#070b0e] from-0% via-45% to-95%" />

        {/* Top Edge Dissolve: Seamless transition from header */}
        <div className="absolute top-0 inset-x-0 h-16 sm:h-24 bg-gradient-to-b from-[#070b0e] to-transparent pointer-events-none" />

        {/* Bottom Edge Dissolve: Seamless transition into Popular Bundles section */}
        <div className="absolute bottom-0 inset-x-0 h-16 sm:h-28 bg-gradient-to-t from-[#070b0e] to-transparent pointer-events-none" />

        {/* Right Edge Soft Feather: Eliminates any hard frame boundaries */}
        <div className="hidden sm:block absolute top-0 bottom-0 right-0 w-24 sm:w-36 bg-gradient-to-l from-[#070b0e]/50 to-transparent pointer-events-none" />

        {/* Mystery Hub Signature Emerald Glow Ambient Bleed */}
        <div className="absolute top-1/4 right-1/4 w-[450px] h-[350px] bg-[#00c365]/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
      </div>

      {/* Hero Foreground Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 items-center min-h-[380px] lg:min-h-[480px]">
          {/* Left Column: Value Proposition & CTAs */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-6 text-left max-w-2xl">
            {/* Pill Header Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#11181e]/90 border border-slate-700/60 backdrop-blur-sm shadow-inner">
              <span className="w-2 h-2 rounded-full bg-[#00c365] animate-pulse" />
              <span className="text-xs font-medium text-slate-300 tracking-wide">
                Ghana&apos;s Digital Utility Platform
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.15] sm:leading-[1.1]">
              Your All-in-One <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E575] via-[#00c365] to-[#34d399]">
                Digital Solution
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-sm sm:text-lg text-slate-300 max-w-xl leading-relaxed">
              Buy data, create your own website, and access essential digital services — all in one place. Simple. Fast. Reliable.
            </p>

            {/* Primary & Secondary Action CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <a
                href="/website-builder"
                onClick={(e) => {
                  e.preventDefault();
                  setActivePage('website');
                }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-sm tracking-wide transition-all shadow-[0_0_25px_rgba(0,195,101,0.35)] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
              >
                <span>Create Your Website</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <a
                href="/data"
                onClick={(e) => {
                  e.preventDefault();
                  setActivePage('data');
                }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#141b22]/90 hover:bg-[#1a232c] text-white font-semibold text-sm border border-slate-700/80 backdrop-blur-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
              >
                <Wifi className="w-4 h-4 text-[#00c365]" />
                <span>Buy Data Bundles</span>
              </a>
            </div>

            {/* Trust and Key Signals */}
            <div className="pt-2 sm:pt-3 flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-[#00c365]" />
                <span>Secure MoMo Checkout</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-[#00c365]" />
                <span>MTN · AirtelTigo · Telecel</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-[#00c365]" />
                <span>Website Builder Beta</span>
              </div>
            </div>
          </div>

          {/* Right Column: Open spatial canvas allowing the illuminated Accra artwork to breathe */}
          <div className="hidden lg:block lg:col-span-5 pointer-events-none min-h-[420px]" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
};
