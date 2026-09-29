import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  Zap,
  TrendingUp,
  Heart,
  Users,
  Building,
  GraduationCap,
  Sparkles,
  ArrowRight,
  MessageSquare
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  const { setActivePage, openWaitlist } = useApp();

  return (
    <div className="min-h-screen py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* About Hero Banner matching reference screenshot */}
        <div className="relative rounded-3xl bg-gradient-to-br from-[#0c1613] via-[#091012] to-[#060a0d] border border-slate-800/80 p-6 sm:p-12 lg:p-16 overflow-hidden shadow-2xl text-center">
          {/* Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#00c365]/10 rounded-full blur-[120px] pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#112019] border border-[#00c365]/30 text-xs font-semibold text-[#00c365]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>About Mystery Hub</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Your Digital World. <br />
              <span className="text-[#00c365]">One Unified Hub.</span>
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
              We&apos;re building something special in Accra — a Ghana-focused digital platform to make everyday connectivity affordable and help local businesses establish a professional online presence without code.
            </p>

            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => openWaitlist('Mystery Hub VIP Updates')}
                className="px-6 py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Join Our Journey
              </button>
              <button
                onClick={() => setActivePage('data')}
                className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider border border-slate-700 transition-colors cursor-pointer"
              >
                Explore Live Data Offers
              </button>
            </div>
          </div>
        </div>

        {/* Mission Statement & 3 Pillars matching screenshot */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 space-y-4 text-left">
            <span className="text-xs font-bold text-[#00c365] uppercase tracking-wider">
              Our Core Mission
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
              To provide accessible, affordable and reliable digital services for everyone in Ghana.
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Ghanaian mobile users and entrepreneurs deserve modern tools designed specifically for local needs — native Mobile Money payments, lightning-fast 4G/5G data dispatch, and websites tailored to Ghanaian customer habits.
            </p>
          </div>

          <div className="lg:col-span-7 space-y-4">
            {/* Pillar 1: Convenience */}
            <div className="p-5 rounded-2xl bg-[#0f151b] border border-slate-800 flex items-start gap-4 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00c365] shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-white">Convenience</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Everything you need in one place. No more switching between multiple apps, slow bank transfers, or unreliable vendors. One dashboard manages your data, business presence, and bill payments.
                </p>
              </div>
            </div>

            {/* Pillar 2: Trust */}
            <div className="p-5 rounded-2xl bg-[#0f151b] border border-slate-800 flex items-start gap-4 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-white">Trust & Reliability</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Secure transactions powered by direct telecom integrations and Paystack. Instant receipts, transparent pricing with zero surprise deductions, and direct WhatsApp customer support.
                </p>
              </div>
            </div>

            {/* Pillar 3: Growth */}
            <div className="p-5 rounded-2xl bg-[#0f151b] border border-slate-800 flex items-start gap-4 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-white">Growth</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Supporting individuals, creators, and MSMEs in Ghana. From affordable student data for remote study to free website generation for chop bars and artisans.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Who We Serve in Ghana */}
        <div className="space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs font-bold text-[#00c365] uppercase tracking-wider">
              Built for Ghana
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Designed For The People Who Move Ghana Forward
            </h2>
            <p className="text-xs text-slate-400">
              Whether you need 1GB to complete an assignment or a complete website for your salon in Spintex, Mystery Hub is built for you.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#0d1217] border border-slate-800 space-y-2">
              <GraduationCap className="w-6 h-6 text-[#00c365]" />
              <h4 className="font-bold text-sm text-white">Students & Campuses</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cheap, reliable data bundles for Legon, KNUST, UCC, UPSA, and students nationwide.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0d1217] border border-slate-800 space-y-2">
              <Building className="w-6 h-6 text-sky-400" />
              <h4 className="font-bold text-sm text-white">Shops & Small Businesses</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Launch a professional website in minutes with MoMo and WhatsApp direct orders.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0d1217] border border-slate-800 space-y-2">
              <Users className="w-6 h-6 text-amber-400" />
              <h4 className="font-bold text-sm text-white">Churches & Ministries</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Accept online tithes & offerings, publish sermon archives, and engage congregants.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0d1217] border border-slate-800 space-y-2">
              <Sparkles className="w-6 h-6 text-purple-400" />
              <h4 className="font-bold text-sm text-white">Creators & Freelancers</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Showcase your portfolio, sell services, and keep all your SIMs loaded with fast 4G/5G data.
              </p>
            </div>
          </div>
        </div>

        {/* WhatsApp & Contact Box */}
        <div className="p-8 rounded-3xl bg-[#0e161c] border border-slate-800 text-center space-y-4">
          <h3 className="text-xl font-bold text-white">Have questions or want to partner?</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Our team is based in Accra, Ghana. We&apos;d love to hear your feedback or discuss institutional and campus partnerships.
          </p>
          <a
            href="https://wa.me/233550000000?text=Hi%20Mystery%20Hub%20Team%2C%20I'd%20like%20to%20learn%20more"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat With The Founders On WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
};
