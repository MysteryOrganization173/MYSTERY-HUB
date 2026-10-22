import React, { useId, useRef } from 'react';
import { ChevronDown, LayoutGrid } from 'lucide-react';
import { OTHER_BRAND, marketplaceHref, type BrandSummary, type CategorySummary } from '../../utils/marketplaceBrowse';
import { ProductPhoto } from './MarketplaceMedia';

export { CategoryIcon as CategoryArt } from './MarketplaceMedia';

/** The brand gallery of one department (or of the whole catalogue when there is only one). */
export interface BrandRow {
  category: string; // department slug the brands belong to, or 'all'
  label: string; // department name, for the heading
  brands: BrandSummary[];
  total: number; // products in that department
}

interface Props {
  tiles: CategorySummary[];
  total: number;
  selected: string;
  onSelect: (slug: string) => void;
  /** Shown beneath the departments (or alone when there is one department). */
  brandRow?: BrandRow | null;
  selectedBrand?: string;
  onSelectBrand?: (id: string, category: string) => void;
  /** Lets the page bring the brand gallery into view after a department is chosen. */
  brandRowRef?: React.Ref<HTMLElement>;
  /** The brand gallery is a disclosure: open shows the photo tiles, closed is a one-line summary. Defaults to open. */
  brandsExpanded?: boolean;
  onToggleBrands?: (open: boolean) => void;
}

// Tiles crop small, so a 3:4 phone shot may fill a square tile; anything further off is shown (nearly) whole.
const TILE_TOLERANCE = 0.26;
const plural = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;
const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00c365] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b0e]';
const rowClass = 'flex gap-1.5 sm:gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-1 pb-1 -mb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/**
 * Marketplace discovery: Departments → brands (where brands mean something) → products.
 * Departments are a compact, recognisable row; the selected department expands into its brand
 * gallery right beneath it, so brands are reached before the grid and never replace departments.
 * Every count and photo comes from the published catalogue.
 */
export const MarketplaceCategoryTiles: React.FC<Props> = ({ tiles, total, selected, onSelect, brandRow, selectedBrand = '', onSelectBrand, brandRowRef, brandsExpanded = true, onToggleBrands }) => {
  const brands = brandRow && brandRow.brands.length >= 2 && onSelectBrand
    ? <BrandTiles row={brandRow} selected={selectedBrand} onSelect={onSelectBrand} rowRef={brandRowRef} expanded={brandsExpanded} onToggle={onToggleBrands} />
    : null;
  // One populated department: a lone "Laptops" tile would only repeat "All", so its brands lead.
  if (tiles.length < 2) return brands;
  const all = { slug: 'all', label: 'All products', count: total };
  return (
    <div className="space-y-2.5 sm:space-y-3">
      <nav aria-label="Shop by department" className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[13px] sm:text-base font-bold text-white tracking-tight">Shop by department</h2>
          {tiles.length > 3 && <span className="text-[11px] text-slate-400 lg:hidden" aria-hidden="true">Swipe for more →</span>}
        </div>
        <ul role="list" className={`${rowClass} lg:grid lg:grid-cols-4 xl:grid-cols-5 lg:overflow-visible lg:pb-0 lg:mb-0`}>
          {[all, ...tiles].map(tile => {
            const active = selected === tile.slug;
            const summary = tile.slug === 'all' ? null : (tile as CategorySummary);
            return (
              <li key={tile.slug} className="w-[76px] sm:w-[200px] shrink-0 snap-start lg:w-auto">
                <a
                  href={marketplaceHref({ category: tile.slug })}
                  onClick={e => { e.preventDefault(); onSelect(tile.slug); }}
                  aria-current={active ? 'true' : undefined}
                  aria-label={`${tile.label}, ${plural(tile.count)}`}
                  data-mh-category={tile.slug}
                  className={`group flex flex-col sm:flex-row items-center gap-1 sm:gap-3 rounded-2xl p-0.5 sm:p-2 sm:pr-3 sm:border transition-colors ${active ? 'sm:border-[#00c365] sm:bg-[#0d1d16]' : 'sm:border-slate-800 sm:bg-[#0e141a] sm:hover:border-slate-600'} ${focusRing}`}
                >
                  <span className={`relative block w-16 h-16 sm:w-14 sm:h-14 shrink-0 rounded-2xl sm:rounded-xl overflow-hidden ring-2 transition-[box-shadow,transform] group-active:scale-95 ${active ? 'ring-[#00c365]' : 'ring-transparent sm:ring-0'}`}>
                    {summary ? (
                      <ProductPhoto src={summary.imageUrl} alt="" iconKey={summary.iconKey} coverTolerance={TILE_TOLERANCE} framing={summary.imageFraming} widths={[128, 200]} sizes="64px" iconSize="md" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center bg-[#0d1d16] text-[#00e575]">
                        <LayoutGrid className="w-6 h-6" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 w-full text-center sm:text-left" aria-hidden="true">
                    <span className={`block text-[11px] sm:text-sm leading-tight line-clamp-2 ${active ? 'text-white font-bold' : 'text-slate-200 font-medium'}`}>{tile.slug === 'all' ? 'All' : tile.label}</span>
                    <span className="hidden sm:block text-xs text-slate-400 mt-0.5 tabular-nums">{plural(tile.count)}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      {brands}
    </div>
  );
};

const BrandTiles: React.FC<{ row: BrandRow; selected: string; onSelect: (id: string, category: string) => void; rowRef?: React.Ref<HTMLElement>; expanded: boolean; onToggle?: (open: boolean) => void }> = ({ row, selected, onSelect, rowRef, expanded, onToggle }) => {
  const heading = row.category === 'all' && !row.label ? 'Shop by brand' : `Shop ${row.label} by brand`;
  const listId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const current = selected ? row.brands.find(b => b.id === selected) : undefined;
  // Closed, the bar still says what is chosen (or what is on offer), so a collapsed gallery never hides a filter.
  const preview = current ? [current] : row.brands.filter(b => b.id !== OTHER_BRAND && b.imageUrl).slice(0, 3);
  const names = row.brands.filter(b => b.id !== OTHER_BRAND).map(b => b.label);
  const summary = current
    ? <>Showing <span className="text-white font-semibold">{current.label}</span> · <span className="tabular-nums">{plural(current.count)}</span></>
    : expanded
      ? <><span className="tabular-nums">{row.brands.length}</span> brands<span className="lg:hidden" aria-hidden="true"> · swipe for more →</span></>
      : <>{names.slice(0, 3).join(', ')}{names.length > 3 ? ` +${names.length - 3} more` : ''}</>;
  const choose = (id: string) => {
    onSelect(id, row.category);
    // Choosing a brand folds the gallery away; keep keyboard focus on the bar instead of a tile that is now hidden.
    if (id && onToggle) toggleRef.current?.focus({ preventScroll: true });
  };
  return (
    <nav
      ref={rowRef}
      aria-label={heading}
      data-mh-brand-row={row.category}
      data-mh-brands-open={expanded ? 'true' : 'false'}
      // A quiet panel joined to the department row above, so it reads as "inside" the chosen department.
      className="scroll-mt-20 rounded-2xl border border-[#00c365]/25 bg-[#0b1512]/80"
    >
      {onToggle ? (
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => onToggle(!expanded)}
          data-mh-brands-toggle
          className={`w-full min-h-[52px] flex items-center gap-2.5 sm:gap-3 px-2.5 sm:px-4 py-2 rounded-2xl text-left ${focusRing}`}
        >
          {preview.length > 0 && (
            <span className="flex -space-x-2 shrink-0" aria-hidden="true">
              {preview.map(b => (
                <span key={b.id} className="relative block w-8 h-8 rounded-full overflow-hidden ring-2 ring-[#0b1512] bg-[#0e141a]">
                  <ProductPhoto src={b.imageUrl} alt="" iconKey="laptop" coverTolerance={TILE_TOLERANCE} framing={b.imageFraming} widths={[64]} sizes="32px" iconSize="sm" />
                </span>
              ))}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] sm:text-base font-bold text-white tracking-tight truncate"><span className="sm:hidden">Shop by brand</span><span className="hidden sm:inline">{heading}</span></span>
            <span className="block text-[11px] sm:text-xs text-slate-400 truncate">{summary}</span>
          </span>
          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-[#00c365]">
            <span className="hidden sm:inline">{expanded ? 'Hide brands' : current ? 'Change brand' : 'Show brands'}</span>
            <ChevronDown className={`w-4 h-4 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
          </span>
        </button>
      ) : (
        <div className="flex items-baseline justify-between gap-3 px-2.5 sm:px-4 pt-2.5 sm:pt-4">
          <h2 className="text-[13px] sm:text-base font-bold text-white tracking-tight">{heading}</h2>
          {row.brands.length > 3 && <span className="text-[11px] text-slate-400 lg:hidden" aria-hidden="true">Swipe for more →</span>}
        </div>
      )}
      <div id={listId} hidden={!expanded} className={`px-2.5 sm:px-4 pb-2.5 sm:pb-4 ${onToggle ? '' : 'pt-2'}`}>
      {/* Desktop: one row of fixed-size tiles (scrolls sideways past ~9 brands) instead of a second row. */}
      <ul role="list" className={`${rowClass} lg:grid lg:grid-flow-col lg:auto-cols-[minmax(104px,124px)] lg:gap-3`}>
        {[{ id: '', label: 'All', count: row.total } as BrandSummary, ...row.brands].map(brand => {
          const active = selected === brand.id;
          const isOther = brand.id === OTHER_BRAND;
          return (
            <li key={brand.id || 'all'} className="w-[76px] sm:w-[124px] shrink-0 snap-start lg:w-auto">
              <a
                href={marketplaceHref({ category: row.category, brand: brand.id || undefined })}
                onClick={e => { e.preventDefault(); choose(active && brand.id ? '' : brand.id); }}
                aria-current={active ? 'true' : undefined}
                aria-label={`${brand.id ? brand.label : `All ${row.label || 'brands'}`}, ${plural(brand.count)}`}
                data-mh-brand={brand.id || 'all'}
                className={`group flex flex-col items-center gap-1 sm:gap-0 sm:items-stretch sm:rounded-2xl sm:border sm:overflow-hidden ${active ? 'sm:border-[#00c365] sm:bg-[#0d1d16]' : 'sm:bg-[#0e141a] sm:border-slate-800 sm:hover:border-slate-600'} rounded-2xl p-0.5 sm:p-0 transition-colors ${focusRing}`}
              >
                <span className={`relative block w-16 h-16 sm:w-full sm:h-auto sm:aspect-square rounded-2xl sm:rounded-none overflow-hidden ring-2 transition-[box-shadow,transform] group-active:scale-95 ${active ? 'ring-[#00c365]' : 'ring-transparent sm:ring-0'}`}>
                  {isOther ? (
                    // A catch-all group gets a neutral tile: one item's photo would suggest a brand it is not.
                    <span className="w-full h-full flex flex-col items-center justify-center gap-1 bg-[#0e141a] text-slate-300">
                      <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
                      <span className="text-[11px] sm:text-sm font-extrabold text-white" aria-hidden="true">Other</span>
                    </span>
                  ) : brand.id ? (
                    <>
                      <ProductPhoto src={brand.imageUrl} alt="" iconKey="laptop" coverTolerance={TILE_TOLERANCE} framing={brand.imageFraming} widths={[128, 200, 320]} sizes="(min-width: 1024px) 150px, (min-width: 640px) 128px, 64px" iconSize="md" />
                      {/* The brand name sits on the photo so a row of similar laptops still reads at a glance. */}
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent pt-4 pb-1 px-1 text-center text-[11px] sm:text-sm font-extrabold text-white tracking-tight truncate" aria-hidden="true">{brand.label}</span>
                    </>
                  ) : (
                    <span className="w-full h-full flex items-center justify-center bg-[#0d1d16] text-[#00e575]">
                      <LayoutGrid className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className="w-full text-center sm:px-2 sm:py-2" aria-hidden="true">
                  <span className={`block text-[11px] sm:text-xs leading-tight ${active ? 'text-white font-bold' : 'text-slate-300 font-medium'}`}>{brand.id ? <span className="tabular-nums">{plural(brand.count)}</span> : 'All'}</span>
                  {!brand.id && <span className="hidden sm:block text-[11px] text-slate-400 mt-0.5 tabular-nums">{plural(brand.count)}</span>}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      </div>
    </nav>
  );
};
