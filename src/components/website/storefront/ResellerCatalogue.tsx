import React from 'react';
import {GHANA_NETWORKS} from '../../../data/bundles';
import {websiteActionText} from '../../../utils/websiteBrand';
import {formatGhs} from '../../../../shared/money';

/**
 * Presentation shared by a reseller's live catalogue and the gallery demo. It never decides what is
 * for sale or at what price: the managed storefront passes only the server's eligible products and
 * their server-set retail prices; the gallery passes clearly labelled example bundles.
 */
export type StoreNetwork = 'mtn' | 'telecel' | 'airteltigo';
export interface StoreBundle {id: string; network: StoreNetwork; dataAmount: string; validity?: string; priceMinor: number}
export type StoreTheme = {background: string; surface: string; text: string; mutedText: string; surfaceText: string; surfaceMutedText: string; accent: string; surfaceAccentText: string; border: string; focus: string; hairline?: string};

export const STORE_NETWORKS: readonly StoreNetwork[] = ['mtn', 'telecel', 'airteltigo'];
export const storeNetworkName = (network: StoreNetwork) => network === 'mtn' ? 'MTN' : network === 'telecel' ? 'Telecel' : 'AirtelTigo';
/** Network marks keep the operators' own colours whatever accent the owner chooses. */
export const storeNetworkColor = (network: StoreNetwork) => GHANA_NETWORKS[network].brandColor;

/** "1.5GB" → 1.5, "500MB" → 0.49; unknown sizes sort last and show no per-GB figure. */
export function bundleSizeGb(dataAmount: string): number | null {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(GB|MB|TB)\s*$/i.exec(dataAmount || '');
  if (!match) return null;
  const value = Number(match[1]), unit = match[2].toUpperCase();
  return unit === 'MB' ? value / 1024 : unit === 'TB' ? value * 1024 : value;
}
export function sortBundles(bundles: StoreBundle[]): StoreBundle[] {
  return [...bundles].sort((a, b) => (bundleSizeGb(a.dataAmount) ?? Infinity) - (bundleSizeGb(b.dataAmount) ?? Infinity) || a.priceMinor - b.priceMinor);
}
/** Computed from the shown price only, to help compare packages. Hidden below 1GB, where it misleads. */
export function pricePerGb(bundle: StoreBundle): string | null {
  const size = bundleSizeGb(bundle.dataAmount);
  if (!size || size < 1 || bundle.priceMinor <= 0) return null;
  return `${formatGhs(Math.round(bundle.priceMinor / size))}/GB`;
}
export function storeNetworksIn(bundles: StoreBundle[]): StoreNetwork[] {
  return STORE_NETWORKS.filter(network => bundles.some(bundle => bundle.network === network));
}
export function lowestPrice(bundles: StoreBundle[]): number | null {
  return bundles.length ? Math.min(...bundles.map(bundle => bundle.priceMinor)) : null;
}
export interface NetworkSummary {network: StoreNetwork; count: number; fromMinor: number | null}
/** Counts and lowest prices per network, computed only from the bundles actually shown. */
export function networkSummaries(bundles: StoreBundle[]): NetworkSummary[] {
  return storeNetworksIn(bundles).map(network => {
    const own = bundles.filter(bundle => bundle.network === network);
    return {network, count: own.length, fromMinor: lowestPrice(own)};
  });
}

/** Hero shortcut: one card per network on sale, with its real bundle count and lowest price. */
export function NetworkPicker({networks, theme, onPick, example = false}: {networks: NetworkSummary[]; theme: StoreTheme; onPick: (network: StoreNetwork) => void; example?: boolean}) {
  return <div className="store-picker">
    <p className="store-eyebrow" style={{color: theme.mutedText}}>{example ? 'Shop by network (example prices)' : 'Shop by network'}</p>
    <div className="store-picker-grid">
      {networks.map(({network, count, fromMinor}) => <button key={network} type="button" onClick={() => onPick(network)} className="store-picker-card"
        style={{backgroundColor: theme.surface, borderColor: theme.hairline || theme.border, color: theme.surfaceText, '--store-network': storeNetworkColor(network)} as React.CSSProperties}
        aria-label={`${storeNetworkName(network)}: ${count} bundle${count === 1 ? '' : 's'}${fromMinor !== null ? `, from ${formatGhs(fromMinor)}` : ''}`}>
        <span className="store-picker-mark" aria-hidden="true" style={{backgroundColor: storeNetworkColor(network), color: websiteActionText(storeNetworkColor(network))}}>{storeNetworkName(network).slice(0, 1)}</span>
        <span className="min-w-0">
          <strong>{storeNetworkName(network)}</strong>
          <small style={{color: theme.surfaceMutedText}}>{count} bundle{count === 1 ? '' : 's'}{fromMinor !== null ? <> · from <b style={{color: theme.surfaceText}}>{formatGhs(fromMinor)}</b></> : null}</small>
        </span>
      </button>)}
    </div>
  </div>;
}

export function NetworkTabs({networks, value, onChange, bundles, theme}: {networks: StoreNetwork[]; value: StoreNetwork; onChange: (network: StoreNetwork) => void; bundles: StoreBundle[]; theme: StoreTheme}) {
  return <nav aria-label="Store networks" className="store-network-tabs" style={{backgroundColor: theme.surface, borderColor: theme.hairline || theme.border}}>
    {networks.map(network => {
      const active = network === value, brand = storeNetworkColor(network), count = bundles.filter(bundle => bundle.network === network).length;
      return <button key={network} type="button" aria-pressed={active} onClick={() => onChange(network)}
        style={active ? {backgroundColor: brand, color: websiteActionText(brand), borderColor: brand} : {color: theme.surfaceText, borderColor: 'transparent'}}>
        <span aria-hidden="true" className="store-network-dot" style={{backgroundColor: active ? websiteActionText(brand) : brand}}/>
        <span>{storeNetworkName(network)}</span>
        <span className="store-network-count" style={active ? undefined : {color: theme.surfaceMutedText}}>{count}</span>
      </button>;
    })}
  </nav>;
}

export function BundleTile({bundle, theme, onChoose, example = false}: {bundle: StoreBundle; theme: StoreTheme; onChoose: (bundle: StoreBundle) => void; example?: boolean}) {
  const perGb = pricePerGb(bundle), price = formatGhs(bundle.priceMinor);
  return <button type="button" className="store-bundle" onClick={() => onChoose(bundle)}
    aria-label={`${example ? 'Example: ' : 'Buy '}${storeNetworkName(bundle.network)} ${bundle.dataAmount}${bundle.validity ? `, ${bundle.validity}` : ''}, ${price}`}
    style={{backgroundColor: theme.surface, borderColor: theme.hairline || theme.border, color: theme.surfaceText, '--store-network': storeNetworkColor(bundle.network)} as React.CSSProperties}>
    <span className="store-bundle-top">
      <span className="store-bundle-network" style={{color: theme.surfaceMutedText}}><i aria-hidden="true"/>{storeNetworkName(bundle.network)}</span>
      {bundle.validity && <span className="store-bundle-validity" style={{color: theme.surfaceMutedText, borderColor: theme.hairline || theme.border}}>{bundle.validity}</span>}
    </span>
    <span className="store-bundle-size site-display">{bundle.dataAmount}</span>
    <span className="store-bundle-foot" style={{borderColor: theme.hairline || theme.border}}>
      <span className="min-w-0">
        <strong className="store-bundle-price" style={{color: theme.surfaceText}}>{price}</strong>
        {perGb && <small style={{color: theme.surfaceMutedText}}>{perGb}</small>}
      </span>
      <span aria-hidden="true" className="store-bundle-cta" style={{backgroundColor: theme.accent, color: websiteActionText(theme.accent)}}>{example ? 'Example' : 'Buy'}</span>
    </span>
  </button>;
}

/* ------------------------------------ Signal (V5) ------------------------------------ */
export type BundleFilter = 'featured' | 'all' | 'under20' | 'mid' | 'big';
/**
 * Size and price filters computed only from the bundles on sale. "Featured" exists only when the owner
 * pinned bundles: Signal never invents popularity or best-sellers.
 */
export function bundleFilters(bundles: StoreBundle[], pinned: readonly string[] = []): Array<{ id: BundleFilter; label: string; count: number }> {
  const count = (filter: BundleFilter) => filterBundles(bundles, filter, pinned).length;
  const options: Array<{ id: BundleFilter; label: string }> = [
    { id: 'featured', label: 'Featured' }, { id: 'all', label: 'All' }, { id: 'under20', label: 'Under GH₵20' }, { id: 'mid', label: '1–9GB' }, { id: 'big', label: '10GB+' },
  ];
  return options.map(o => ({ ...o, count: count(o.id) })).filter(o => o.id === 'all' || (o.count > 0 && o.count < bundles.length));
}
export function filterBundles(bundles: StoreBundle[], filter: BundleFilter, pinned: readonly string[] = []): StoreBundle[] {
  if (filter === 'featured') return pinned.map(id => bundles.find(b => b.id === id)).filter((b): b is StoreBundle => !!b);
  if (filter === 'under20') return bundles.filter(b => b.priceMinor < 2000);
  if (filter === 'mid') return bundles.filter(b => { const gb = bundleSizeGb(b.dataAmount); return gb !== null && gb >= 1 && gb < 10; });
  if (filter === 'big') return bundles.filter(b => (bundleSizeGb(b.dataAmount) ?? 0) >= 10);
  return [...filterBundles(bundles,'featured',pinned),...bundles.filter(b=>!pinned.includes(b.id))];
}

/** A compact bundle row: size, validity and per-GB on the left, the total price on the right. */
export function BundleRow({ bundle, theme, onChoose, selected = false, featured = false }: { bundle: StoreBundle; theme: StoreTheme; onChoose: (bundle: StoreBundle) => void; selected?: boolean; featured?: boolean }) {
  const perGb = pricePerGb(bundle), price = formatGhs(bundle.priceMinor);
  return <button type="button" className="store-row" aria-pressed={selected} onClick={() => onChoose(bundle)}
    aria-label={`${storeNetworkName(bundle.network)} ${bundle.dataAmount}${bundle.validity ? `, ${bundle.validity}` : ''}, ${price}${featured ? ', featured by the store' : ''}`}
    style={{ backgroundColor: theme.surface, borderColor: selected ? theme.accent : theme.hairline || theme.border, color: theme.surfaceText, '--store-network': storeNetworkColor(bundle.network) } as React.CSSProperties}>
    <span className="store-row-size site-display">{bundle.dataAmount}</span>
    <span className="store-row-meta" style={{ color: theme.surfaceMutedText }}>
      <span>{bundle.validity || storeNetworkName(bundle.network)}{featured ? <b className="store-row-flag" style={{ borderColor: theme.hairline || theme.border, color: theme.surfaceText }}>Featured</b> : null}</span>
      {perGb && <small>{perGb}</small>}
    </span>
    <strong className="store-row-price">{price}</strong>
  </button>;
}

/** Number-first progress: shown as plain text steps, never as a fake loading state. */
export function SignalSteps({ step, theme }: { step: 1 | 2 | 3 | 4; theme: StoreTheme }) {
  const steps = ['Number', 'Bundle', 'Review & pay', 'Track'];
  return <ol className="store-progress" aria-label="Buying steps">
    {steps.map((label, i) => <li key={label} aria-current={step === i + 1 ? 'step' : undefined} style={{ color: step >= i + 1 ? theme.text : theme.mutedText }}>
      <span aria-hidden="true" style={step >= i + 1 ? { backgroundColor: theme.accent, color: websiteActionText(theme.accent) } : { borderColor: theme.hairline || theme.border }}>{i + 1}</span>{label}
    </li>)}
  </ol>;
}

/** How buying works, in the order it happens. No delivery times or guarantees are promised here. */
export function HowBuyingWorks({theme, managed}: {theme: StoreTheme; managed: boolean}) {
  const steps = [
    ['Enter the number', 'Type the number that should receive the data and confirm its network.'],
    ['Choose and pay', managed ? 'Pick a bundle, review it, then pay in the secure Paystack window.' : 'Pick a bundle, review it, then pay securely.'],
    ['Track your order', managed ? 'Keep your order reference. You can check its status on this page at any time.' : 'Keep your order reference so the store can check your order.'],
  ];
  return <ol className="store-steps" aria-label="How buying works">
    {steps.map(([title, text], index) => <li key={title}>
      <span aria-hidden="true" className="store-step-number site-display" style={{backgroundColor: theme.accent, color: websiteActionText(theme.accent)}}>{index + 1}</span>
      <span><strong>{title}</strong><small style={{color: theme.surfaceMutedText}}>{text}</small></span>
    </li>)}
  </ol>;
}

/** Styles for the storefront, scoped to `.reseller-storefront`. Inline so every render path has them. */
export const RESELLER_STORE_CSS = `
.reseller-storefront{--store-radius:18px}
.reseller-storefront button,.reseller-storefront a{min-height:44px}
.reseller-storefront :is(button,a,input):focus-visible{outline:2px solid var(--website-focus);outline-offset:3px}
.reseller-storefront input::placeholder{color:var(--website-placeholder);opacity:1}
.store-wrap{width:100%;max-width:74rem;margin:0 auto;padding-left:16px;padding-right:16px}
@media (min-width:640px){.store-wrap{padding-left:32px;padding-right:32px}}
.store-header{position:sticky;top:0;z-index:30;border-bottom:1px solid;backdrop-filter:saturate(1.4) blur(12px)}
.store-header-inner{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:68px}
.store-brand{display:flex;align-items:center;gap:12px;min-width:0}
.store-mark{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-weight:700;font-size:16px;letter-spacing:.02em;flex-shrink:0;overflow:hidden}
.store-mark img{width:100%;height:100%;object-fit:contain}
.store-brand-name{font-weight:700;font-size:17px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0;letter-spacing:-.01em}
.store-brand-line{font-size:12px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}
.store-nav{display:none;align-items:center;gap:4px;font-size:14px;font-weight:600}
.store-nav a{display:inline-flex;align-items:center;padding:0 12px;border-radius:999px;opacity:.82;transition:opacity .15s ease,background-color .15s ease}
.store-nav a:hover{opacity:1;background:var(--store-surface)}
@media (min-width:860px){.store-nav{display:flex}}
.store-chat{display:inline-flex;align-items:center;gap:8px;padding:0 16px;border-radius:999px;font-weight:700;font-size:14px;flex-shrink:0;transition:transform .15s ease}
.store-chat:active{transform:scale(.97)}
.store-hero{display:grid;gap:20px;padding-top:16px;padding-bottom:8px}
@media (min-width:900px){.store-hero{grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);align-items:center;gap:56px;padding-top:56px;padding-bottom:28px}.store-hero .store-art{order:2}}
.store-hero-copy{display:flex;flex-direction:column;align-items:flex-start}
.store-hero-badge{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;padding:6px 12px;border-radius:999px;border:1px solid;margin:0 0 14px;letter-spacing:.01em}
.store-hero-title{font-size:clamp(2rem,6.6vw,3.7rem);line-height:1.02;font-weight:700;margin:0;overflow-wrap:anywhere;letter-spacing:-.025em}
.store-hero-text{font-size:15.5px;line-height:1.6;margin-top:14px;max-width:36rem}
.store-hero-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px;width:100%}
.store-hero-actions>*{flex:1 1 auto}
@media (min-width:480px){.store-hero-actions>*{flex:0 0 auto}}
.store-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 24px;min-height:52px!important;border-radius:14px;font-weight:700;font-size:15.5px;border:1px solid transparent;transition:transform .15s ease,box-shadow .2s ease,filter .15s ease}
.store-primary:hover{box-shadow:0 12px 30px -14px var(--website-accent);filter:brightness(1.06)}
.store-primary:active{transform:scale(.98)}
.store-secondary{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 18px;min-height:52px!important;border-radius:14px;font-weight:600;font-size:15px;border:1px solid;transition:transform .15s ease,background-color .15s ease}
.store-secondary:active{transform:scale(.98)}
.store-hero-facts{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:18px;font-size:13.5px}
.store-hero-facts strong{font-weight:700}
.store-art{position:relative;border-radius:22px;overflow:hidden;border:1px solid;aspect-ratio:3/2;box-shadow:0 30px 60px -40px rgba(0,0,0,.7)}
.store-art img{width:100%;height:100%;object-fit:cover;object-position:center}
@media (max-width:899px){.store-art{aspect-ratio:16/9;border-radius:18px}}
.store-picker-wrap{padding-top:12px}
.store-picker-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
/* On phones the network tabs directly below do the same job, so the picker would only add length. */
.store-picker{display:none}
@media (min-width:640px){.store-picker{display:block}}
.store-picker-card{position:relative;display:flex;align-items:center;gap:12px;text-align:left;padding:12px 14px;border:1px solid;border-radius:16px;overflow:hidden;transition:transform .15s ease,border-color .15s ease}
.store-picker-card::after{content:"";position:absolute;inset:auto 0 0 0;height:3px;background:var(--store-network)}
.store-picker-card:hover{transform:translateY(-1px);border-color:var(--store-network)}
.store-picker-card:active{transform:scale(.985)}
.store-picker-card strong{display:block;font-size:15px;line-height:1.2}
.store-picker-card small{display:block;font-size:12.5px;margin-top:2px}
.store-picker-card b{font-weight:700}
.store-picker-mark{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;font-weight:800;font-size:15px;flex-shrink:0}
.store-section{padding-top:40px;padding-bottom:4px}
.store-section-head{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:8px 24px;margin-bottom:16px}
.store-section-head h2,.store-section-head h3{font-size:clamp(1.5rem,4.6vw,2.2rem);font-weight:700;line-height:1.1;margin:0;letter-spacing:-.02em}
.store-head-note{max-width:22rem}
.store-eyebrow{font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;margin:0 0 8px}
.store-steps-card{display:grid;gap:4px}
.store-steps{list-style:none;margin:0;padding:0;display:grid;gap:14px}
@media (min-width:720px){.store-steps{grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}}
.store-steps li{display:flex;gap:12px;align-items:flex-start}
.store-steps strong{display:block;font-size:15px;line-height:1.25}
.store-steps small{display:block;font-size:13.5px;line-height:1.5;margin-top:3px}
.store-step-number{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:13px;flex-shrink:0}
.store-network-tabs{display:flex;gap:4px;padding:4px;border:1px solid;border-radius:16px;overflow-x:auto;scrollbar-width:none}
.store-network-tabs::-webkit-scrollbar{display:none}
.store-network-tabs button{flex:1 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 14px;border-radius:12px;font-weight:700;font-size:14px;border:1px solid;transition:background-color .2s ease,color .2s ease}
@media (min-width:640px){.store-network-tabs{width:fit-content;max-width:100%}.store-network-tabs button{flex:0 0 auto;padding:0 18px}}
.store-network-dot{width:9px;height:9px;border-radius:50%}
.store-network-count{font-size:12px;font-weight:600;opacity:.85}
.store-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}
@media (min-width:640px){.store-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}}
@media (min-width:1024px){.store-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
.store-bundle{position:relative;display:flex;flex-direction:column;align-items:stretch;text-align:left;padding:14px 14px 12px;border:1px solid;border-radius:var(--store-radius);overflow:hidden;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease;cursor:pointer}
.store-bundle::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--store-network)}
.store-bundle:hover{transform:translateY(-2px);border-color:var(--website-accent);box-shadow:0 16px 32px -22px rgba(0,0,0,.65)}
.store-bundle:active{transform:scale(.985)}
.store-bundle-top{display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0}
.store-bundle-network{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;white-space:nowrap}
.store-bundle-network i{width:8px;height:8px;border-radius:50%;background:var(--store-network)}
.store-bundle-validity{font-size:11px;font-weight:600;padding:2px 8px;border:1px solid;border-radius:999px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.store-bundle-size{font-size:clamp(1.75rem,7.4vw,2.35rem);font-weight:700;line-height:1;letter-spacing:-.03em;margin:14px 0 16px}
.store-bundle-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;border-top:1px solid;padding-top:10px;margin-top:auto}
.store-bundle-price{display:block;font-size:17px;font-weight:800;line-height:1.1}
.store-bundle-foot small{display:block;font-size:11px;margin-top:3px}
.store-bundle-cta{font-size:12.5px;font-weight:700;padding:7px 12px;border-radius:999px;flex-shrink:0}
@media (max-width:379px){.store-bundle{padding:12px 11px 11px}.store-bundle-validity{display:none}.store-bundle-cta{padding:6px 10px}}
.store-note{font-size:13.5px;line-height:1.55}
.store-card{border:1px solid;border-radius:20px;padding:18px}
@media (min-width:640px){.store-card{padding:24px}}
.store-field{width:100%;min-height:50px;padding:12px 14px;border-radius:12px;border:1px solid;min-width:0}
.store-help{display:grid;gap:16px}
@media (min-width:900px){.store-help{grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);align-items:center}}
.store-help-actions{display:flex;flex-wrap:wrap;gap:8px}
@media (min-width:900px){.store-help-actions{justify-content:flex-end}}
.store-sheet{position:fixed;inset:auto 0 0 0;margin:0 auto;width:100%;max-width:32rem;max-height:92dvh;overflow:auto;border:1px solid;border-radius:24px 24px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom))}
@media (min-width:640px){.store-sheet{inset:0;margin:auto;border-radius:24px;max-height:90dvh;padding:24px}}
.store-sheet::backdrop{background:rgba(2,6,12,.72)}
.store-sheet[open]{animation:store-rise .22s ease-out}
@keyframes store-rise{from{transform:translateY(16px);opacity:.4}to{transform:none;opacity:1}}
.store-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid;border-radius:16px;padding:14px;margin-top:14px;position:relative;overflow:hidden}
.store-summary::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--store-network)}
.store-footer{margin-top:48px;border-top:1px solid;padding:32px 0 0}
.store-footer-grid{display:grid;gap:22px}
@media (min-width:720px){.store-footer-grid{grid-template-columns:1.3fr .7fr 1fr 1.2fr}}
.store-footer h3{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px}
.store-footer-links{list-style:none;margin:0;padding:0;display:grid;gap:0}
.store-footer-links a{display:inline-flex;align-items:center;font-weight:600}
.store-footer-links a:hover{text-decoration:underline;text-underline-offset:3px}
.store-footer-base{border-top:1px solid;margin-top:24px;padding-top:14px;padding-bottom:16px;font-size:12px}
.store-progress{list-style:none;margin:0;padding:0;display:flex;gap:6px 14px;flex-wrap:wrap;font-size:12.5px;font-weight:600}
.store-progress li{display:inline-flex;align-items:center;gap:6px}
.store-progress span{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:800;border:1px solid transparent}
.store-buy{display:grid;gap:14px}
.store-buy h3{font-size:17px;font-weight:700;margin:0;letter-spacing:-.01em}
.store-step-label{font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin:0 0 4px}
.store-number{font-size:20px!important;font-weight:700;letter-spacing:.04em}
.store-confirm{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.store-confirm button{position:relative;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:6px 4px;border-radius:12px;border:1.5px solid;font-weight:700;font-size:14px;line-height:1.1}
.store-confirm button small{font-size:10.5px;font-weight:700;letter-spacing:.02em}
.store-confirm i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:1px}
.store-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
.store-chips::-webkit-scrollbar{display:none}
.store-chips button{flex:0 0 auto;padding:0 12px;min-height:38px!important;border-radius:999px;border:1px solid;font-size:13px;font-weight:600;white-space:nowrap}
.store-rows{display:grid;gap:8px}
@media (min-width:720px){.store-rows{grid-template-columns:repeat(2,minmax(0,1fr))}}
.store-row{position:relative;display:grid;grid-template-columns:72px minmax(0,1fr) auto;align-items:center;gap:10px;text-align:left;padding:10px 14px 10px 16px;border:1.5px solid;border-radius:14px;overflow:hidden;transition:border-color .15s ease,transform .15s ease}
.store-row::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--store-network)}
.store-row[aria-pressed="true"]{box-shadow:0 0 0 3px color-mix(in srgb,var(--website-accent) 22%,transparent)}
.store-row:active{transform:scale(.99)}
.store-row-size{font-size:22px;font-weight:800;letter-spacing:-.03em;line-height:1}
.store-row-meta{display:grid;gap:2px;font-size:13px;min-width:0}
.store-row-meta small{font-size:11.5px}
.store-row-flag{display:inline-block;margin-left:6px;font-size:10px;font-weight:700;border:1px solid;border-radius:999px;padding:1px 6px;vertical-align:1px}
.store-row-price{font-size:16px;font-weight:800;text-align:right;white-space:nowrap}
.store-bar{position:sticky;bottom:10px;z-index:20;display:flex;align-items:center;gap:12px;border-radius:18px;padding:10px 10px 10px 16px;border:1px solid;box-shadow:0 18px 40px -18px rgba(0,0,0,.7)}
.store-bar>div{min-width:0;flex:1;font-size:12.5px;line-height:1.35}
.store-bar strong{display:block;font-size:15px}
.store-bar .store-primary{min-height:46px!important;padding:0 18px;flex-shrink:0}
.store-recipient{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid;border-radius:14px;padding:10px 12px;margin-top:12px;font-size:14px}
@media (prefers-reduced-motion:reduce){.reseller-storefront *{transition:none!important;animation:none!important}}
`;
