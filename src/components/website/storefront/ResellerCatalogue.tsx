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
export type StoreTheme = {background: string; surface: string; text: string; mutedText: string; surfaceText: string; surfaceMutedText: string; accent: string; surfaceAccentText: string; border: string; focus: string};

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

export function NetworkTabs({networks, value, onChange, bundles, theme}: {networks: StoreNetwork[]; value: StoreNetwork; onChange: (network: StoreNetwork) => void; bundles: StoreBundle[]; theme: StoreTheme}) {
  return <nav aria-label="Store networks" className="store-network-tabs" style={{backgroundColor: theme.surface, borderColor: theme.border}}>
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
    style={{backgroundColor: theme.surface, borderColor: theme.border, color: theme.surfaceText, '--store-network': storeNetworkColor(bundle.network)} as React.CSSProperties}>
    <span className="store-bundle-size site-display">{bundle.dataAmount}</span>
    <span className="store-bundle-meta" style={{color: theme.surfaceMutedText}}>{storeNetworkName(bundle.network)}{bundle.validity ? ` · ${bundle.validity}` : ''}</span>
    <span className="store-bundle-foot">
      <strong className="store-bundle-price" style={{color: theme.surfaceAccentText}}>{price}</strong>
      {perGb && <small style={{color: theme.surfaceMutedText}}>{perGb}</small>}
    </span>
    <span aria-hidden="true" className="store-bundle-cta" style={{backgroundColor: theme.accent, color: websiteActionText(theme.accent)}}>{example ? 'Example' : 'Buy'}</span>
  </button>;
}

/** How buying works, in the order it happens. No delivery times or guarantees are promised here. */
export function HowBuyingWorks({theme, managed}: {theme: StoreTheme; managed: boolean}) {
  const steps = [
    ['Choose a bundle', 'Pick the network and the bundle size you need.'],
    ['Pay securely', managed ? 'Enter the number to receive the data, then pay in the secure Paystack window.' : 'Enter the number to receive the data, then pay securely.'],
    ['Track your order', 'Keep your order reference. You can check its status on this page at any time.'],
  ];
  return <ol className="store-steps" aria-label="How buying works">
    {steps.map(([title, text], index) => <li key={title} style={{borderColor: theme.border}}>
      <span aria-hidden="true" className="store-step-number site-display" style={{color: theme.accent === theme.surfaceAccentText ? theme.accent : theme.surfaceAccentText, borderColor: theme.border}}>{index + 1}</span>
      <span><strong>{title}</strong><small style={{color: theme.mutedText}}>{text}</small></span>
    </li>)}
  </ol>;
}

/** Styles for the storefront, scoped to `.reseller-storefront`. Inline so every render path has them. */
export const RESELLER_STORE_CSS = `
.reseller-storefront{--store-radius:18px}
.reseller-storefront button,.reseller-storefront a{min-height:44px}
.reseller-storefront :is(button,a,input):focus-visible{outline:2px solid var(--website-focus);outline-offset:3px}
.reseller-storefront input::placeholder{color:var(--website-placeholder);opacity:1}
.store-wrap{width:100%;max-width:72rem;margin:0 auto;padding-left:16px;padding-right:16px}
@media (min-width:640px){.store-wrap{padding-left:32px;padding-right:32px}}
.store-header{position:sticky;top:0;z-index:30;border-bottom:1px solid;backdrop-filter:blur(10px)}
.store-header-inner{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:64px}
.store-brand{display:flex;align-items:center;gap:10px;min-width:0}
.store-mark{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-weight:700;font-size:15px;letter-spacing:.02em;flex-shrink:0;overflow:hidden}
.store-mark img{width:100%;height:100%;object-fit:contain}
.store-brand-name{font-weight:700;font-size:16px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0}
.store-brand-line{font-size:12px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.store-chat{display:inline-flex;align-items:center;gap:8px;padding:0 14px;border-radius:999px;font-weight:700;font-size:13px;flex-shrink:0}
.store-hero{display:grid;gap:22px;padding-top:28px;padding-bottom:12px}
@media (min-width:900px){.store-hero{grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);align-items:center;gap:48px;padding-top:56px;padding-bottom:40px}}
.store-hero-badge{display:inline-flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;font-weight:700;padding:6px 12px;border-radius:999px;border:1px solid}
.store-hero-badge i{width:8px;height:8px;border-radius:50%;display:inline-block}
.store-hero-title{font-size:clamp(2rem,7vw,3.6rem);line-height:1.04;font-weight:700;margin:16px 0 0;overflow-wrap:anywhere}
.store-hero-text{font-size:15px;line-height:1.6;margin-top:14px;max-width:34rem}
.store-hero-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.store-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 22px;min-height:50px!important;border-radius:14px;font-weight:700;font-size:15px;border:1px solid transparent;transition:transform .15s ease,box-shadow .15s ease}
.store-primary:hover{box-shadow:0 10px 28px -12px var(--website-accent)}
.store-primary:active{transform:scale(.98)}
.store-secondary{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 18px;min-height:50px!important;border-radius:14px;font-weight:600;font-size:15px;border:1px solid}
.store-hero-facts{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:20px;font-size:13px}
.store-hero-facts strong{font-weight:700}
.store-art{position:relative;border-radius:24px;overflow:hidden;border:1px solid;aspect-ratio:16/11}
.store-art img{width:100%;height:100%;object-fit:cover}
@media (max-width:899px){.store-art{aspect-ratio:16/9}}
@media (max-width:639px){.store-art{aspect-ratio:2/1;border-radius:18px}}
.store-section{padding-top:36px;padding-bottom:12px}
.store-section-head{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:10px 16px;margin-bottom:16px}
.store-section-head h2,.store-section-head h3{font-size:clamp(1.4rem,4.6vw,2rem);font-weight:700;line-height:1.15;margin:0}
.store-eyebrow{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:0 0 6px}
.store-steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
@media (min-width:720px){.store-steps{gap:14px}}
.store-steps li{display:flex;flex-direction:column;gap:8px;align-items:flex-start;padding:12px 0 0;border-top:1px solid}
@media (min-width:720px){.store-steps li{flex-direction:row;gap:12px;padding:16px 0 0}}
.store-steps strong{display:block;font-size:14px;line-height:1.25}
.store-steps small{display:none;font-size:13px;line-height:1.5;margin-top:3px}
@media (min-width:720px){.store-steps strong{font-size:15px}.store-steps small{display:block}}
.store-step-number{width:28px;height:28px;border-radius:50%;border:1px solid;display:grid;place-items:center;font-weight:700;font-size:13px;flex-shrink:0}
.store-network-tabs{display:flex;gap:4px;padding:4px;border:1px solid;border-radius:16px;overflow-x:auto;scrollbar-width:none}
.store-network-tabs::-webkit-scrollbar{display:none}
.store-network-tabs button{flex:1 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 14px;border-radius:12px;font-weight:700;font-size:14px;border:1px solid;transition:background-color .2s ease,color .2s ease}
@media (min-width:640px){.store-network-tabs{width:fit-content;max-width:100%}.store-network-tabs button{flex:0 0 auto;padding:0 18px}}
.store-network-dot{width:9px;height:9px;border-radius:50%}
.store-network-count{font-size:12px;font-weight:600;opacity:.85}
.store-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}
@media (min-width:640px){.store-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}}
@media (min-width:1024px){.store-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
.store-bundle{position:relative;display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:2px;padding:16px 14px 14px;border:1px solid;border-radius:var(--store-radius);overflow:hidden;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease;cursor:pointer}
.store-bundle::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--store-network)}
.store-bundle:hover{transform:translateY(-2px);border-color:var(--website-accent);box-shadow:0 14px 30px -18px rgba(0,0,0,.6)}
.store-bundle:active{transform:scale(.985)}
.store-bundle-size{font-size:clamp(1.65rem,7vw,2.1rem);font-weight:700;line-height:1;letter-spacing:-.02em}
.store-bundle-meta{font-size:12px;line-height:1.35;margin-top:6px}
.store-bundle-foot{display:flex;flex-direction:column;margin-top:14px}
.store-bundle-price{font-size:17px;font-weight:800;line-height:1.1}
.store-bundle-foot small{font-size:11px;margin-top:3px}
.store-bundle-cta{position:absolute;right:12px;bottom:14px;font-size:12px;font-weight:700;padding:6px 11px;border-radius:999px}
.store-note{font-size:13px;line-height:1.55}
.store-card{border:1px solid;border-radius:20px;padding:18px}
@media (min-width:640px){.store-card{padding:22px}}
.store-field{width:100%;min-height:48px;padding:12px 14px;border-radius:12px;border:1px solid;min-width:0}
.store-help{display:grid;gap:14px}
@media (min-width:900px){.store-help{grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr)}}
.store-sheet{position:fixed;inset:auto 0 0 0;margin:0 auto;width:100%;max-width:32rem;max-height:92dvh;overflow:auto;border:1px solid;border-radius:24px 24px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom))}
@media (min-width:640px){.store-sheet{inset:0;margin:auto;border-radius:24px;max-height:90dvh;padding:24px}}
.store-sheet::backdrop{background:rgba(2,6,12,.72)}
.store-sheet[open]{animation:store-rise .22s ease-out}
@keyframes store-rise{from{transform:translateY(16px);opacity:.4}to{transform:none;opacity:1}}
.store-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid;border-radius:16px;padding:14px;margin-top:14px;position:relative;overflow:hidden}
.store-summary::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--store-network)}
.store-footer{margin-top:40px;border-top:1px solid;padding:28px 0}
.store-footer-grid{display:grid;gap:18px}
@media (min-width:720px){.store-footer-grid{grid-template-columns:1.2fr 1fr 1fr}}
.store-footer h3{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px}
@media (prefers-reduced-motion:reduce){.reseller-storefront *{transition:none!important;animation:none!important}}
`;
