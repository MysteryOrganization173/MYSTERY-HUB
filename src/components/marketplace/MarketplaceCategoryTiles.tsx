import React from 'react';
import { LayoutGrid } from 'lucide-react';
import type { CategorySummary } from '../../utils/marketplaceBrowse';
import { ProductPhoto } from './MarketplaceMedia';

export { CategoryIcon as CategoryArt } from './MarketplaceMedia';

interface Props {
  tiles: CategorySummary[];
  total: number;
  selected: string;
  onSelect: (slug: string) => void;
}

/**
 * Visual "shop by category" row. Every tile is a real admin category with a live
 * count; imagery comes from that category's own product photos.
 * Phones get one compact swipeable row (≈100px tall) so products appear on the
 * first screen; tablets swipe larger tiles; desktops get a calm grid.
 */
export const MarketplaceCategoryTiles: React.FC<Props> = ({ tiles, total, selected, onSelect }) => {
  if (tiles.length < 2) return null; // one category is not worth a navigation row
  const all = { slug: 'all', label: 'All', count: total };
  return (
    <nav aria-label="Shop by category" className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] sm:text-base font-bold text-white tracking-tight">Shop by category</h2>
        {tiles.length > 3 && <span className="text-[11px] text-slate-400 lg:hidden" aria-hidden="true">Swipe for more →</span>}
      </div>
      <ul
        role="list"
        className="flex gap-1.5 sm:gap-3 overflow-x-auto snap-x pb-1 -mb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-8 lg:overflow-visible lg:pb-0 lg:mb-0"
      >
        {[all, ...tiles].map(tile => {
          const active = selected === tile.slug;
          const summary = tile.slug === 'all' ? null : (tile as CategorySummary);
          return (
            <li key={tile.slug} className="w-[72px] sm:w-[128px] shrink-0 snap-start lg:w-auto">
              <a
                href={tile.slug === 'all' ? '/marketplace' : `/marketplace?category=${encodeURIComponent(tile.slug)}`}
                onClick={e => { e.preventDefault(); onSelect(tile.slug); }}
                aria-current={active ? 'true' : undefined}
                aria-label={`${tile.slug === 'all' ? 'All products' : tile.label}, ${tile.count} ${tile.count === 1 ? 'item' : 'items'}`}
                data-mh-category={tile.slug}
                className={`group flex flex-col items-center gap-1 sm:gap-0 sm:items-stretch sm:rounded-2xl sm:border sm:overflow-hidden ${active ? 'sm:border-[#00c365] sm:bg-[#0d1d16]' : 'sm:bg-[#0e141a] sm:border-slate-800 sm:hover:border-slate-600'} rounded-2xl p-0.5 sm:p-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00c365] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b0e]`}
              >
                <span className={`relative block w-16 h-16 sm:w-full sm:h-auto sm:aspect-[4/3] rounded-2xl sm:rounded-none overflow-hidden ring-2 transition-[box-shadow,transform] group-active:scale-95 ${active ? 'ring-[#00c365]' : 'ring-transparent sm:ring-0'}`}>
                  {summary ? (
                    <ProductPhoto src={summary.imageUrl} alt="" iconKey={summary.iconKey} widths={[128, 200, 320]} sizes="(min-width: 1024px) 150px, (min-width: 640px) 20vw, 64px" iconSize="md" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center bg-[#0d1d16] text-[#00e575]">
                      <LayoutGrid className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className="w-full text-center sm:px-2 sm:py-2" aria-hidden="true">
                  <span className={`block text-[11px] sm:text-xs leading-tight line-clamp-2 ${active ? 'text-white font-bold' : 'text-slate-200 font-medium'}`}>{tile.label}</span>
                  <span className="hidden sm:block text-[11px] text-slate-400 mt-0.5 tabular-nums">{tile.count} {tile.count === 1 ? 'item' : 'items'}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
