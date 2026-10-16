import React from 'react';
import { LayoutGrid, Laptop, Smartphone, Mic, Camera, Cpu, Printer, Globe, Home, Gamepad2, Box } from 'lucide-react';
import { OptimizedImage } from '../common/OptimizedImage';
import type { CategoryIconKey, CategorySummary } from '../../utils/marketplaceBrowse';

const ICONS: Record<CategoryIconKey, React.ComponentType<{ className?: string }>> = {
  laptop: Laptop, phone: Smartphone, audio: Mic, camera: Camera, software: Cpu, printer: Printer, digital: Globe, home: Home, game: Gamepad2, box: Box,
};
// Calm per-icon tints so photo-less tiles stay recognisable without fake imagery.
const TINTS: Record<CategoryIconKey, string> = {
  laptop: 'text-sky-300 from-sky-500/15', phone: 'text-emerald-300 from-emerald-500/15', audio: 'text-pink-300 from-pink-500/15',
  camera: 'text-violet-300 from-violet-500/15', software: 'text-[#00e575] from-[#00c365]/15', printer: 'text-amber-300 from-amber-500/15',
  digital: 'text-cyan-300 from-cyan-500/15', home: 'text-orange-300 from-orange-500/15', game: 'text-fuchsia-300 from-fuchsia-500/15', box: 'text-slate-300 from-slate-500/15',
};

export const CategoryArt: React.FC<{ iconKey: CategoryIconKey; imageUrl?: string; imageAlt?: string; size?: 'tile' | 'chip' }> = ({ iconKey, imageUrl, size = 'tile' }) => {
  const Icon = ICONS[iconKey];
  const fallback = (
    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br to-transparent ${TINTS[iconKey]}`}>
      <Icon className={size === 'tile' ? 'w-7 h-7 sm:w-8 sm:h-8' : 'w-4 h-4'} />
    </div>
  );
  if (!imageUrl) return fallback;
  return (
    <OptimizedImage src={imageUrl} alt="" aria-hidden="true" objectFit="cover" responsiveWidths={[160, 240, 320]} sizes="(min-width: 1024px) 140px, 25vw" fallbackIcon={fallback} />
  );
};

interface Props {
  tiles: CategorySummary[];
  total: number;
  selected: string;
  onSelect: (slug: string) => void;
}

/**
 * Visual "shop by category" grid. Every tile is a real admin category with a live
 * count; imagery comes from that category's own product photos.
 */
export const MarketplaceCategoryTiles: React.FC<Props> = ({ tiles, total, selected, onSelect }) => {
  if (tiles.length < 2) return null; // one category is not worth a navigation row
  const all = { slug: 'all', label: 'All products', count: total };
  return (
    <nav aria-label="Shop by category" className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">Shop by category</h2>
        {tiles.length > 3 && <span className="text-[11px] text-slate-500 sm:hidden" aria-hidden="true">Swipe for more</span>}
      </div>
      <ul className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 sm:gap-3 sm:overflow-visible sm:pb-0" role="list">
        {[all, ...tiles].map(tile => {
          const active = selected === tile.slug;
          const summary = tile.slug === 'all' ? null : (tile as CategorySummary);
          return (
            <li key={tile.slug} className="w-[22%] min-w-[76px] shrink-0 snap-start sm:w-auto sm:min-w-0">
              <a
                href={tile.slug === 'all' ? '/marketplace' : `/marketplace?category=${encodeURIComponent(tile.slug)}`}
                onClick={e => { e.preventDefault(); onSelect(tile.slug); }}
                aria-current={active ? 'true' : undefined}
                data-mh-category={tile.slug}
                className={`group flex flex-col h-full rounded-2xl border overflow-hidden transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00c365] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b0e] ${
                  active ? 'border-[#00c365] bg-[#0d1d16] shadow-[0_0_0_1px_rgba(0,195,101,0.4)]' : 'border-slate-800 bg-[#0e141a] hover:border-slate-600'
                }`}
              >
                <span className="relative block aspect-square w-full overflow-hidden bg-[#0a0f14]">
                  {summary ? (
                    <CategoryArt iconKey={summary.iconKey} imageUrl={summary.imageUrl} />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#00c365]/20 to-transparent text-[#00e575]">
                      <LayoutGrid className="w-7 h-7 sm:w-8 sm:h-8" />
                    </span>
                  )}
                  {active && <span className="absolute inset-0 ring-2 ring-inset ring-[#00c365]/70 rounded-t-2xl pointer-events-none" />}
                </span>
                <span className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-center flex-1 flex flex-col justify-center">
                  <span className={`block text-[11px] sm:text-xs font-semibold leading-tight line-clamp-2 ${active ? 'text-white' : 'text-slate-200'}`}>{tile.label}</span>
                  <span className="block text-[10px] sm:text-[11px] text-slate-500 mt-0.5 tabular-nums">{tile.count} {tile.count === 1 ? 'item' : 'items'}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
