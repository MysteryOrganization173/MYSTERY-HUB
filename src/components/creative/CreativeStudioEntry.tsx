import React from 'react';
import { ArrowRight, Palette } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getCloudinaryUrl } from '../../utils/cloudinary';
import { creativeWorkById } from '../../data/creativeStudioWork';

const isPlainClick = (e: React.MouseEvent) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);
const THUMBS = ['ht-flyer', 'lz-social', 'ih-social-a'].map(creativeWorkById);

/**
 * The way into Mystery Creative Studio from the Marketplace and the homepage. Small and self-contained: it does not
 * load the Creative Studio page or its styles until the customer opens it.
 */
export const CreativeStudioEntry: React.FC<{ variant: 'marketplace' | 'home' }> = ({ variant }) => {
  const { setActivePage } = useApp();
  const open = (e: React.MouseEvent) => { if (!isPlainClick(e)) return; e.preventDefault(); setActivePage('creative'); };
  const home = variant === 'home';
  return (
    <a href="/creative-studio" onClick={open} data-creative-entry={variant}
      className={`group relative flex items-center gap-3 sm:gap-5 overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0d1317] text-left no-underline transition-colors hover:border-[#ff8a4c]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cedb3] ${home ? 'p-4 sm:p-6' : 'p-3 sm:p-4'}`}>
      <span aria-hidden="true" className={`relative flex-none ${home ? 'h-[72px] w-[84px] sm:h-[96px] sm:w-[120px]' : 'h-[52px] w-[60px] sm:h-[60px] sm:w-[76px]'}`}>
        {THUMBS.map((work, i) => (
          <img key={work.id} src={getCloudinaryUrl(work.src, { width: 160, height: 160, crop: 'fill' })} alt="" width={80} height={80} loading="lazy" decoding="async"
            className={`absolute aspect-square rounded-lg object-cover shadow-lg ring-1 ring-white/10 ${home ? 'w-[52px] sm:w-[68px]' : 'w-[38px] sm:w-[46px]'} ${i === 0 ? 'left-0 top-0 -rotate-6' : i === 1 ? 'right-0 top-1 rotate-6' : 'left-1/2 bottom-0 -translate-x-1/2 rotate-1'}`} />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#ff8a4c]"><Palette className="h-3.5 w-3.5" aria-hidden />Mystery Creative Studio</span>
        <strong className={`mt-1 block font-['Outfit'] font-bold leading-tight text-white ${home ? 'text-lg sm:text-2xl' : 'text-[15px] sm:text-lg'}`}>Need a flyer, logo or social media design?</strong>
        <span className={`mt-1 block text-slate-300 ${home ? 'text-sm sm:text-base' : 'text-[13px] sm:text-sm'}`}>{home ? 'Send a short brief and the Mystery Hub team quotes for your design. Nothing is charged until you agree.' : 'Our team designs it for you. Send a brief and get a quote.'}</span>
      </span>
      <span className={`flex-none items-center gap-1.5 font-semibold text-[#00c365] ${home ? 'hidden sm:inline-flex' : 'hidden md:inline-flex'} text-sm`}>Request a design<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
      <ArrowRight className={`h-5 w-5 flex-none text-[#00c365] ${home ? 'sm:hidden' : 'md:hidden'}`} aria-hidden />
    </a>
  );
};
