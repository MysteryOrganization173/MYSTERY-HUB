import React from 'react';
import { useApp } from '../../context/AppContext';
import { DIGITAL_SERVICES, SAMPLE_SERVICE_ARTWORK } from '../../data/services';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../utils/cloudinary';
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
          {futureServices.map((svc) => {
            const artwork = SAMPLE_SERVICE_ARTWORK[svc.id];

            return (
              <div
                key={svc.id}
                className="p-4 sm:p-5 rounded-2xl bg-[#0d1217] border border-slate-800/80 flex flex-col justify-between hover:border-slate-700 transition-colors space-y-3 relative overflow-hidden group shadow-sm hover:shadow-xl"
              >
                {/* Absolute Background Artwork Layer (Sample Services Only: ECG, Water, TV) */}
                {artwork && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none select-none rounded-2xl" aria-hidden="true">
                    {/* Artwork on the right: wider on mobile (w-3/4) and right 55-60% on tablet/desktop */}
                    <div className="absolute right-0 bottom-0 top-0 w-3/4 sm:w-3/5 lg:w-3/5 flex items-end justify-end overflow-hidden">
                      <img
                        src={getCloudinaryUrl(artwork.url, { format: 'auto', quality: 'auto', width: 640 })}
                        srcSet={getCloudinarySrcSet(artwork.url, [360, 480, 640]) || undefined}
                        sizes="(max-width: 640px) 75vw, (max-width: 1024px) 50vw, 320px"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className={`w-full h-full object-cover ${artwork.objectPosition} ${artwork.opacity} transition-transform duration-500 group-hover:scale-105`}
                      />
                    </div>

                    {/* Continuous Text Protection Horizontal Gradient:
                        LEFT: dark card background (#0d1217 95-100%)
                        CENTER: medium fade (#0d1217/85)
                        RIGHT: light overlay (#0d1217/15)
                    */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0d1217] from-30% via-[#0d1217]/85 via-65% to-[#0d1217]/15 pointer-events-none" />

                    {/* Mobile Combined Vertical Gradient: slightly darker bottom zone behind Notify Me */}
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0d1217] via-[#0d1217]/70 to-transparent pointer-events-none" />
                  </div>
                )}

                <div className="relative z-10 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-slate-400 bg-slate-900/90 border border-slate-800 px-2 py-0.5 rounded">
                        {svc.category}
                      </span>
                      <span className="text-[10px] font-semibold text-[#00c365] bg-[#00c365]/10 px-2 py-0.5 rounded border border-[#00c365]/20">
                        Coming Soon
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-white">{svc.title}</h3>
                    <p className="text-xs text-slate-300/90 mt-1 leading-relaxed">
                      {svc.description}
                    </p>
                  </div>

                  <button
                    onClick={() => openWaitlist(svc.title)}
                    className="w-full py-1.5 sm:py-2 px-3 rounded-xl bg-slate-900/90 hover:bg-[#00c365]/10 text-xs font-semibold text-slate-200 hover:text-[#00c365] border border-slate-800 hover:border-[#00c365]/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Notify Me</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

