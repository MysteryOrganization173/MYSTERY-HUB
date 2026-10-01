import React from 'react';
import { useApp } from '../../context/AppContext';
import { DIGITAL_SERVICES } from '../../data/services';
import { Sparkles, ArrowRight } from 'lucide-react';

export const HomeComingSoonSection: React.FC = () => {
  const { setActivePage, openWaitlist } = useApp();

  const futureServices = DIGITAL_SERVICES.filter((s) => s.status === 'coming_soon').slice(0, 4);

  return (
    <section className="py-6 sm:py-10 lg:py-14 bg-[#070b0e] border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00c365]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Expanding Ecosystem</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
              Coming Soon to Mystery Hub
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg">
              We are actively developing direct connections with Ghanaian utility providers and services.
            </p>
          </div>

          <button
            onClick={() => setActivePage('services')}
            className="text-xs font-semibold text-[#00c365] hover:text-[#00e575] flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>View All Future Utilities</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {futureServices.map((svc) => (
            <div
              key={svc.id}
              className="p-4 sm:p-5 rounded-2xl bg-[#0d1217] border border-slate-800/80 flex flex-col justify-between hover:border-slate-700 transition-colors space-y-3"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                    {svc.category}
                  </span>
                  <span className="text-[10px] font-semibold text-[#00c365] bg-[#00c365]/10 px-2 py-0.5 rounded">
                    Coming Soon
                  </span>
                </div>
                <h3 className="font-bold text-sm text-white">{svc.title}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {svc.description}
                </p>
              </div>

              <button
                onClick={() => openWaitlist(svc.title)}
                className="w-full py-1.5 sm:py-2 px-3 rounded-xl bg-slate-900 hover:bg-[#00c365]/10 text-xs font-semibold text-slate-300 hover:text-[#00c365] border border-slate-800 hover:border-[#00c365]/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Notify Me</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
