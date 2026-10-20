import { SiteFooterContact } from '../SiteContactDetails';
import { useVisualEditMarkers, useTemplateCopy } from '../editor/VisualEditMarkers';
import { websiteActionText, resolveStoreTheme } from '../../../utils/websiteBrand';
import { SafeImage } from '../SafeImage.js';
import React, { useMemo, useState } from 'react';
import { WebsiteTemplate } from '../../../types';
import { ArrowRight, MessageCircle, Phone, MapPin, ShieldCheck, Search, Smartphone } from 'lucide-react';
import { getCloudinarySrcSet } from '../../../utils/cloudinary';
import { resolveDataResellerHeroImage } from '../../../utils/dataResellerArtwork';
import { DATA_BUNDLES } from '../../../data/bundles';
import { formatGhs } from '../../../../shared/money';
import {
  BundleRow, HowBuyingWorks, NetworkPicker, NetworkTabs, RESELLER_STORE_CSS, STORE_NETWORKS, networkSummaries, sortBundles,
  storeNetworkName, storeNetworksIn, type NetworkSummary, type StoreBundle, type StoreNetwork,
} from '../storefront/ResellerCatalogue';

export interface ResellerStoreSummary {
  networks: StoreNetwork[]; fromMinor: number | null; count: number;
  /** Per-network counts and lowest server prices, for the hero's network picker. */
  byNetwork?: NetworkSummary[];
  /** Selects a network in the live catalogue. */
  onPickNetwork?: (network: StoreNetwork) => void;
}
interface TemplateViewProps {
  template: WebsiteTemplate;
  onCtaClick?: () => void;
  managedCheckout?: React.ReactNode;
  managedAvailability?: 'loading' | 'available' | 'empty' | 'error';
  managedSummary?: ResellerStoreSummary;
}

export { resolveDataResellerHeroImage } from '../../../utils/dataResellerArtwork';

/** Up to two letters from the business name, for a store that has not added a logo. */
export function storeInitials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s&]/gu, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return 'D';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

/** The gallery demo's bundles: real Mystery Hub sizes, shown as examples because each store sets its own prices. */
const EXAMPLE_IDS = ['mtn-1gb', 'mtn-2gb', 'mtn-5gb', 'mtn-10gb', 'mtn-20gb', 'mtn-40gb', 'telecel-10gb', 'telecel-20gb', 'telecel-50gb', 'at-1gb', 'at-2gb', 'at-5gb'];
const exampleBundles = (): StoreBundle[] => DATA_BUNDLES.filter(b => EXAMPLE_IDS.includes(b.id) && (STORE_NETWORKS as readonly string[]).includes(b.network))
  .map(b => ({ id: b.id, network: b.network as StoreNetwork, dataAmount: b.dataAmount, priceMinor: Math.round(b.priceGhc * 100) }));

export const DataResellerTemplateView: React.FC<TemplateViewProps> = ({ template, onCtaClick, managedCheckout, managedAvailability, managedSummary }) => {
  const edit = useVisualEditMarkers();
  const copy = useTemplateCopy(template);
  const owner = !!template.siteContent;

  const businessName = template.demoBusinessName || 'Your data store';
  const tagline = template.demoHeroTagline || '';
  const aboutText = template.demoSubtext || '';
  const location = template.location || '';
  const contact = owner ? template.siteContent?.phone || '' : '';
  const whatsapp = owner ? template.siteContent?.whatsapp || template.siteContent?.phone || '' : template.hoursOrContact || '';
  const cleanWhatsappNumber = whatsapp.replace(/\D/g, '').replace(/^0/, '233');
  const logoUrl = template.siteContent?.logoUrl;

  // Every surface, border and text colour follows the owner's own background and accent.
  const p = resolveStoreTheme(template.colorScheme || {
    primary: '#0f172a', secondary: '#2563eb', background: '#0a0f1d', accent: '#2563eb',
  });
  const onAccent = websiteActionText(p.accent);

  const heroImageSrc = resolveDataResellerHeroImage(template.heroImage, owner);
  const heroSrcSet = getCloudinarySrcSet(heroImageSrc, [480, 768, 1024, 1280, 1536], { format: 'auto', quality: 'auto' });

  // Gallery: example bundles. An owner's site without managed checkout (a design-switch preview) shows its empty state.
  const examples = useMemo(() => owner ? [] : exampleBundles(), [owner]);
  const [network, setNetwork] = useState<StoreNetwork>('mtn');
  const [notice, setNotice] = useState('');
  const networks: StoreNetwork[] = managedSummary?.networks.length ? managedSummary.networks : managedCheckout ? [] : storeNetworksIn(examples);
  const fromMinor = managedSummary ? managedSummary.fromMinor : null;
  const picker: NetworkSummary[] = managedSummary?.byNetwork?.length ? managedSummary.byNetwork : !managedCheckout && !owner ? networkSummaries(examples) : [];

  const handleChatWhatsapp = () => {
    if (onCtaClick) { onCtaClick(); return; }
    if (!cleanWhatsappNumber) return;
    const text = `Hello ${businessName}, I would like to ask about your data bundles.`;
    window.open(`https://wa.me/${cleanWhatsappNumber}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const pickNetwork = (n: StoreNetwork) => { (managedSummary?.onPickNetwork || setNetwork)(n); setNotice(''); scrollTo('bundle-catalog'); };
  const primaryLabel = managedCheckout && managedAvailability !== 'available'
    ? managedAvailability === 'loading' ? 'Check Availability' : 'View Availability'
    : template.siteContent?.ctaLabel || 'Buy Data';

  const line = p.hairline || p.border;
  const surface = { backgroundColor: p.surface, borderColor: line, color: p.surfaceText };
  const year = new Date().getFullYear();

  return (
    <div
      className="reseller-storefront min-h-full font-sans antialiased flex flex-col selection:bg-[var(--website-accent)] selection:text-[var(--website-on-accent)]"
      style={{ backgroundColor: p.background, color: p.text, '--website-accent': p.accent, '--website-on-accent': onAccent, '--website-focus': p.focus, '--website-placeholder': p.mutedText, '--store-surface': p.surface, '--store-border': line } as React.CSSProperties}
    >
      <style>{RESELLER_STORE_CSS}</style>

      {/* 1. The store's own identity: its logo or monogram, its name and what it sells. */}
      <header className="store-header" style={{ backgroundColor: `${p.background}eb`, borderColor: line, color: p.text }}>
        <div className="store-wrap store-header-inner">
          <div className="store-brand">
            <span className="store-mark" style={logoUrl ? { backgroundColor: p.surface, border: `1px solid ${line}` } : { backgroundColor: p.accent, color: onAccent }}>
              {logoUrl ? <SafeImage {...edit('content:logoUrl')} src={logoUrl} alt={`${businessName} logo`} className="w-full h-full" style={{ objectFit: 'contain' }} /> : <span {...edit('content:logoUrl')} aria-hidden="true" className="site-display">{storeInitials(businessName)}</span>}
            </span>
            <div className="min-w-0">
              <h1 {...edit('content:businessName')} className="store-brand-name site-display" style={{ color: p.text }}>{businessName}</h1>
              <p className="store-brand-line" style={{ color: p.mutedText }}>
                <span {...copy.edit('brand')}>{copy.text('brand')}</span>{location ? <span> · {location}</span> : null}
              </p>
            </div>
          </div>
          <nav aria-label="Store" className="store-nav">
            <a href="#bundle-catalog">Bundles</a>
            {managedCheckout && <a href="#store-track">Track order</a>}
            <a href="#store-help">Help</a>
          </nav>
          {whatsapp && (
            <button type="button" {...edit('content:whatsapp')} data-website-event="whatsapp_click" onClick={handleChatWhatsapp}
              className="store-chat bg-[#25D366] hover:bg-[#22c35e] text-black">
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              <span>Chat<span className="sr-only"> on WhatsApp</span></span>
            </button>
          )}
        </div>
      </header>

      {/* 2. Hero: the owner's artwork leads, then the promise, the way in and the networks on sale. */}
      <section className="store-wrap store-hero" aria-labelledby="store-hero-title">
        <div {...edit('content:heroImage')} className="store-art" style={{ borderColor: line, backgroundColor: p.surface }}>
          <SafeImage src={heroImageSrc} srcSet={heroSrcSet || undefined} sizes="(max-width: 899px) 100vw, 600px" alt="" loading="eager" fetchPriority="high" width={1536} height={1024} className="w-full h-full" />
        </div>
        <div className="store-hero-copy min-w-0">
          {networks.length > 0 && (
            <p className="store-hero-badge" style={{ borderColor: line, color: p.mutedText }}>
              <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{networks.map(storeNetworkName).join(' · ')} data</span>
            </p>
          )}
          <h2 id="store-hero-title" {...edit('content:tagline')} className="store-hero-title site-display" style={{ color: p.text }}>{tagline}</h2>
          <p {...edit('content:aboutText')} className="store-hero-text" style={{ color: p.mutedText }}>{aboutText}</p>
          <div className="store-hero-actions">
            <button type="button" {...edit('content:ctaLabel')} data-website-primary-cta="true" onClick={() => scrollTo('bundle-catalog')}
              className="store-primary" style={{ backgroundColor: p.accent, color: onAccent }}>
              <span>{primaryLabel}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
            {managedCheckout && (
              <button type="button" onClick={() => scrollTo('store-track')} className="store-secondary" style={{ borderColor: p.border, color: p.text, backgroundColor: 'transparent' }}>
                <Search className="w-4 h-4" aria-hidden="true" />
                <span {...copy.edit('secondary')}>{copy.text('secondary')}</span>
              </button>
            )}
          </div>
          {(fromMinor !== null || (!managedCheckout && !owner)) && (
            <p className="store-hero-facts" style={{ color: p.mutedText }}>
              {fromMinor !== null && <span>Bundles from <strong style={{ color: p.text }}>{formatGhs(fromMinor)}</strong></span>}
              {managedSummary && managedSummary.count > 0 && <span><strong style={{ color: p.text }}>{managedSummary.count}</strong> bundle{managedSummary.count === 1 ? '' : 's'} available</span>}
              {!managedCheckout && !owner && <span>Example store · each owner sets their own bundles and prices</span>}
            </p>
          )}
        </div>
      </section>

      {/* 3. Shop by network: real counts and lowest prices, one tap from the catalogue. */}
      {picker.length > 1 && (
        <section className="store-wrap store-picker-wrap" aria-label="Shop by network">
          <NetworkPicker networks={picker} theme={p} onPick={pickNetwork} example={!managedCheckout && !owner} />
        </section>
      )}

      {/* 4. Catalogue: managed checkout on a live store; labelled examples in the gallery. */}
      <main id="bundle-catalog" className="store-wrap store-section flex-1 scroll-mt-20">
        <div className="store-section-head">
          <div>
            <p className="store-eyebrow" style={{ color: p.accentText }}><span {...copy.edit('catalogueEyebrow')}>{copy.text('catalogueEyebrow')}</span></p>
            <h2 className="site-display" style={{ color: p.text }}><span {...copy.edit('catalogueHeading')}>{copy.text('catalogueHeading')}</span></h2>
          </div>
          {managedCheckout && <p className="store-note store-head-note" style={{ color: p.mutedText }}>Prices include everything you pay. Tap a bundle to review before paying.</p>}
        </div>
        {managedCheckout || (owner ? (
          <div role="status" className="store-card store-empty" style={surface}>
            <h3 className="font-bold text-base">Your bundles appear here</h3>
            <p className="store-note mt-1" style={{ color: p.surfaceMutedText }}>Customers see the bundles you switch on in Bundles &amp; Pricing, at the prices you set.</p>
          </div>
        ) : (
          <>
            <NetworkTabs networks={networks} value={network} onChange={n => { setNetwork(n); setNotice(''); }} bundles={examples} theme={p} />
            {/* The same compact rows a live Signal store shows; the gallery never takes payment. */}
            <div className="store-rows" style={{ marginTop: 14 }}>
              {sortBundles(examples.filter(b => b.network === network)).map(b => (
                <BundleRow key={b.id} bundle={b} theme={p} onChoose={() => { if (onCtaClick) onCtaClick(); else setNotice('This is an example store. Bundles and prices appear here once a store owner sets them.'); }} />
              ))}
            </div>
            <p className="store-note mt-3" role={notice ? 'status' : undefined} style={{ color: p.mutedText }}>
              {notice || 'Example bundles and prices. Each store shows the bundles its owner switches on, at the owner’s prices.'}
            </p>
          </>
        ))}
      </main>

      {/* 5. What happens after payment, in the order it happens. */}
      <section className="store-wrap store-section" aria-labelledby="store-steps-title">
        <div className="store-card store-steps-card" style={surface}>
          <h2 id="store-steps-title" className="store-eyebrow" style={{ color: p.surfaceMutedText }}><span {...copy.edit('stepsHeading')}>{copy.text('stepsHeading')}</span></h2>
          <HowBuyingWorks theme={p} managed={!!managedCheckout || !owner} />
        </div>
      </section>

      {/* 6. Help: the store owner is the customer's first contact. */}
      <section id="store-help" className="store-wrap store-section scroll-mt-20" aria-labelledby="store-help-title">
        <div className="store-card store-help" style={surface}>
          <div>
            <h2 id="store-help-title" className="text-xl font-bold site-display" style={{ color: p.surfaceText }}><span {...copy.edit('helpHeading')}>{copy.text('helpHeading')}</span></h2>
            <p className="store-note mt-2" style={{ color: p.surfaceMutedText }}><span {...copy.edit('helpIntro')}>{copy.text('helpIntro')}</span></p>
            {managedCheckout && whatsapp && <p className="store-note mt-2" style={{ color: p.surfaceMutedText }}>Bundles are bought and paid for on this page. WhatsApp and calls are for questions about an order.</p>}
          </div>
          <div className="store-help-actions">
            {whatsapp && <button type="button" data-website-event="whatsapp_click" onClick={handleChatWhatsapp} className="store-secondary bg-[#25D366] text-black" style={{ borderColor: 'transparent' }}><MessageCircle className="w-4 h-4" aria-hidden="true" />WhatsApp</button>}
            {contact && <a {...edit('content:phone')} href={`tel:${contact.replace(/[^\d+]/g, '')}`} className="store-secondary" style={{ borderColor: p.border, color: p.surfaceText }}><Phone className="w-4 h-4" aria-hidden="true" />Call {contact}</a>}
            {!whatsapp && !contact && <p {...edit('content:whatsapp')} className="store-note" style={{ color: p.surfaceMutedText }}>{owner ? 'Contact details coming soon.' : 'The store’s WhatsApp and phone number appear here.'}</p>}
          </div>
        </div>
      </section>

      {/* 7. Footer: the business's details, its pages, and who runs payments and delivery. */}
      <footer className="store-footer" style={{ backgroundColor: p.surface, borderColor: line, color: p.surfaceText }}>
        <div className="store-wrap store-footer-grid text-sm">
          <div>
            <p className="font-bold text-base site-display">{businessName}</p>
            <p className="store-note mt-1" style={{ color: p.surfaceMutedText }}>{copy.text('brand')}</p>
            {location && <p {...edit('content:location')} className="mt-2 inline-flex items-start gap-1.5" style={{ color: p.surfaceMutedText }}><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />{location}</p>}
          </div>
          <div>
            <h3 style={{ color: p.surfaceMutedText }}>Shop</h3>
            <ul className="store-footer-links">
              <li><a href="#bundle-catalog">Data bundles</a></li>
              {managedCheckout && <li><a href="#store-track">Track an order</a></li>}
              <li><a href="#store-help">Help</a></li>
            </ul>
          </div>
          <div>
            <h3 style={{ color: p.surfaceMutedText }}>Contact</h3>
            <SiteFooterContact template={template} className="text-sm font-semibold" />
          </div>
          <div>
            <h3 style={{ color: p.surfaceMutedText }}>Payments &amp; delivery</h3>
            <p className="store-note inline-flex gap-2" style={{ color: p.surfaceMutedText }}>
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>Payments are processed securely by Paystack. Orders are delivered through Mystery Hub’s managed data service.</span>
            </p>
          </div>
        </div>
        <div className="store-wrap store-footer-base" style={{ color: p.surfaceMutedText, borderColor: line }}>© {year} {businessName}</div>
      </footer>
    </div>
  );
};
