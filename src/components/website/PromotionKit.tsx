import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, Link2, Share2 } from 'lucide-react';
import type { WebsiteSiteRecord } from '../../types';
import { websiteBusinessRequest } from '../../services/websiteBusinessApi';
import {
  PROMO_DESIGNS, PROMO_FORMATS, PROMO_TREATMENTS, cleanPromoHeadline, promoBundlesFromStorefront, promoCaption, promoDescription, promoDesign,
  promoDesignAvailable, promoFileName, promoNetworkName, promoNetworksIn, promoPalette, promoPrice, promoSortBundles, PROMO_HEADLINE_MAX,
  type PromoBundle, type PromoChoice, type PromoDesignId, type PromoFacts, type PromoFormat, type PromoNetwork, type PromoTreatment,
} from '../../utils/promotionKit';
import { drawPromo, loadPromoFonts, loadPromoLogo, promoPng } from '../../utils/promotionCanvas';

/**
 * Promotion Kit V1 inside My Business (Data Stores). The owner picks a ready-made design, a format, a colour
 * treatment and a message; the advert is drawn from their saved name, logo, colours and link and from the bundles
 * the public storefront sells right now. Downloads are single PNG files at 1080 × 1920 or 1080 × 1080.
 */
type CatalogueState = 'loading' | 'ready' | 'error';

function useCanvas(draw: (ctx: CanvasRenderingContext2D) => void, width: number, height: number, scale: number, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * scale * dpr); canvas.height = Math.round(height * scale * dpr);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    draw(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

function Thumb({ choice, facts, logo, ready, disabled, selected, onPick, label, use }: { choice: PromoChoice; facts: PromoFacts; logo: HTMLImageElement | null; ready: boolean; disabled: boolean; selected: boolean; onPick: () => void; label: string; use: string }) {
  const { width, height } = PROMO_FORMATS[choice.format];
  const scale = 150 / width;
  const ref = useCanvas(ctx => { if (ready) drawPromo(ctx, choice, facts, logo); }, width, height, scale, [ready, logo, choice.design, choice.format, choice.treatment, choice.headline, choice.network, choice.bundleId, facts]);
  return <button type="button" role="radio" aria-checked={selected} disabled={disabled} onClick={onPick} className="pk-design">
    <canvas ref={ref} aria-hidden="true" style={{ aspectRatio: `${width} / ${height}` }} />
    <strong>{label}</strong>
    <small>{disabled ? 'Needs bundles on sale' : use}</small>
  </button>;
}

export function PromotionKit({ site, name, url, published, onPublish }: { site: WebsiteSiteRecord; name: string; url: string; published: boolean; onPublish: () => void }) {
  const [catalogue, setCatalogue] = useState<CatalogueState>('loading');
  const [bundles, setBundles] = useState<PromoBundle[]>([]);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);
  const [design, setDesign] = useState<PromoDesignId>('launch');
  const [format, setFormat] = useState<PromoFormat>('story');
  const [treatment, setTreatment] = useState<PromoTreatment>('brand');
  const [message, setMessage] = useState(0);
  const [custom, setCustom] = useState('');
  const [network, setNetwork] = useState<PromoNetwork | undefined>();
  const [bundleId, setBundleId] = useState<string | undefined>();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  // Only what customers can buy now, at the server's prices: the public storefront, never the owner's draft prices.
  useEffect(() => {
    if (!published) { setCatalogue('ready'); setBundles([]); return; }
    let live = true; setCatalogue('loading');
    websiteBusinessRequest(`websites/${encodeURIComponent(site.id)}/storefront`)
      .then(data => { if (live) { setBundles(promoBundlesFromStorefront(data)); setCatalogue('ready'); } })
      .catch(() => { if (live) { setBundles([]); setCatalogue('error'); } });
    return () => { live = false; };
  }, [site.id, published]);
  const logoUrl = site.content_json?.logoUrl;
  useEffect(() => {
    let live = true; setReady(false);
    void Promise.all([loadPromoFonts(), loadPromoLogo(logoUrl)]).then(([, img]) => { if (live) { setLogo(img); setReady(true); } });
    return () => { live = false; };
  }, [logoUrl]);

  const settings = site.settings_json || ({} as WebsiteSiteRecord['settings_json']);
  const facts: PromoFacts = useMemo(() => ({
    name, url, logoUrl, tagline: site.content_json?.tagline,
    colors: { background: settings.backgroundColor || '#0b0f19', primary: settings.primaryColor || '#0f172a', accent: settings.accentColor || '#3b82f6' },
    bundles, pinned: site.content_json?.pinnedBundles || [],
  }), [name, url, logoUrl, site.content_json?.tagline, site.content_json?.pinnedBundles, settings.backgroundColor, settings.primaryColor, settings.accentColor, bundles]);

  const current = promoDesign(design);
  const available = promoDesignAvailable(current, facts);
  const effective = available ? current : PROMO_DESIGNS[0];
  const messages = effective.messages(facts);
  const headline = message < 0 ? (cleanPromoHeadline(custom) || messages[0]) : messages[Math.min(message, messages.length - 1)];
  const networks = promoNetworksIn(bundles);
  const sorted = promoSortBundles(bundles, facts.pinned);
  const choice: PromoChoice = { design: effective.id, format, treatment, headline, network: network && networks.includes(network) ? network : networks[0], bundleId: bundleId && bundles.some(b => b.id === bundleId) ? bundleId : sorted[0]?.id };
  const caption = promoCaption(choice, facts);
  const { width, height } = PROMO_FORMATS[format];
  const preview = useCanvas(ctx => { if (ready) drawPromo(ctx, choice, facts, logo); }, width, height, 1, [ready, logo, choice.design, format, treatment, headline, choice.network, choice.bundleId, facts]);

  const pick = (id: PromoDesignId) => { setDesign(id); setMessage(0); setCustom(''); setStatus(''); };
  const file = async () => new File([await promoPng(choice, facts, logo)], promoFileName(site.slug, choice), { type: 'image/png' });
  const download = async () => {
    setBusy(true); setStatus('');
    try {
      const png = await file(), href = URL.createObjectURL(png), a = document.createElement('a');
      a.href = href; a.download = png.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 4000);
      setStatus(`Saved ${png.name}. Post it on your Status, then paste the caption.`);
    } catch { setStatus('The picture could not be created in this browser. Try again, or use another browser.'); }
    finally { setBusy(false); }
  };
  const canShareFiles = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && typeof File !== 'undefined' && (() => { try { return navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }); } catch { return false; } })();
  const share = async () => {
    setBusy(true); setStatus('');
    try { const png = await file(); await navigator.share({ files: [png], text: caption }); }
    catch (error) { if ((error as Error)?.name !== 'AbortError') setStatus('Sharing didn’t open. Download the picture instead, then post it from your gallery.'); }
    finally { setBusy(false); }
  };
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); setStatus(`${what} copied.`); }
    catch { setStatus(`Copying is blocked in this browser. Press and hold the ${what.toLowerCase()} to copy it.`); }
  };

  if (!published) return <section className="pk pk-gate" aria-labelledby="pk-title" data-promotion-kit="unpublished">
    <h2 id="pk-title">Publish your store first</h2>
    <p>Every advert carries your store link, so it has to work when people open it. Publish your website, then come back for ready-made adverts with your name, colours and prices.</p>
    <button type="button" className="bw-button" data-primary onClick={onPublish}>Publish your website</button>
  </section>;

  const pal = promoPalette(facts.colors, treatment);
  return <section className="pk" aria-labelledby="pk-title" data-promotion-kit>
    <div className="pk-intro">
      <h2 id="pk-title">Ready-made adverts</h2>
      <p>Each one uses your business name, logo, colours and link{bundles.length ? ', and the bundles and prices customers can buy on your store right now' : ''}. Download a picture, post it, then paste the caption.</p>
      {catalogue === 'loading' && <p role="status" className="pk-note">Checking the bundles and prices on your store…</p>}
      {catalogue === 'error' && <p role="status" className="pk-note">We couldn’t check your bundles just now, so adverts with prices are hidden. Brand adverts still work.</p>}
      {catalogue === 'ready' && !bundles.length && <p className="pk-note">No bundles are on sale yet, so adverts with prices are hidden. Set them up in Products &amp; pricing.</p>}
    </div>

    <div className="pk-layout">
      <div className="pk-pick">
        <fieldset className="pk-group"><legend>Design</legend>
          <div className="pk-designs" role="radiogroup" aria-label="Advert design">
            {PROMO_DESIGNS.map(d => {
              const ok = promoDesignAvailable(d, facts);
              return <Thumb key={d.id} label={d.label} use={d.use} disabled={!ok || catalogue === 'loading' && d.needsBundles} selected={effective.id === d.id} onPick={() => pick(d.id)} ready={ready} logo={logo} facts={facts}
                choice={{ ...choice, design: d.id, headline: d.messages(facts)[0] }} />;
            })}
          </div>
        </fieldset>
      </div>

      <div className="pk-result">
        <div className="pk-frame" data-format={format} style={{ background: pal.bg }}>
          <canvas ref={preview} role="img" aria-label={promoDescription(choice, facts)} data-promo-preview style={{ aspectRatio: `${width} / ${height}` }} />
          {!ready && <span className="pk-loading" aria-hidden="true" />}
        </div>
        <div className="pk-actions">
          <button type="button" className="bw-button" data-primary disabled={!ready || busy} onClick={() => void download()}><Download size={16} aria-hidden="true" />{busy ? 'Preparing…' : 'Download picture'}</button>
          {canShareFiles && <button type="button" className="bw-button" disabled={!ready || busy} onClick={() => void share()}><Share2 size={16} aria-hidden="true" />Share picture</button>}
          <button type="button" className="bw-button" onClick={() => void copy(caption, 'Caption')}><Copy size={16} aria-hidden="true" />Copy caption</button>
          <button type="button" className="bw-button" onClick={() => void copy(url, 'Link')}><Link2 size={16} aria-hidden="true" />Copy link</button>
        </div>
        <p role="status" className="pk-status">{status && <>{/^(Saved|Caption copied|Link copied)/.test(status) && <Check size={14} aria-hidden="true" />}{status}</>}</p>
        <div className="pk-caption"><span>Caption</span><p>{caption}</p></div>
        <p className="pk-note">Prices change? Make a new advert: the picture keeps the prices it was made with, and your store always shows the current price.</p>
      </div>

      <div className="pk-controls">
        <fieldset className="pk-group"><legend>Size</legend>
          <div className="pk-segment" role="radiogroup" aria-label="Size">
            {(Object.keys(PROMO_FORMATS) as PromoFormat[]).map(f => <button key={f} type="button" role="radio" aria-checked={format === f} onClick={() => setFormat(f)}><strong>{PROMO_FORMATS[f].label}</strong><small>{PROMO_FORMATS[f].hint}</small></button>)}
          </div>
        </fieldset>

        <fieldset className="pk-group"><legend>Colours</legend>
          <div className="pk-segment" role="radiogroup" aria-label="Colours">
            {PROMO_TREATMENTS.map(t => { const p = promoPalette(facts.colors, t.id); return <button key={t.id} type="button" role="radio" aria-checked={treatment === t.id} onClick={() => setTreatment(t.id)}>
              <span className="pk-swatch" aria-hidden="true"><i style={{ background: p.bg }} /><i style={{ background: p.accent }} /><i style={{ background: p.ink }} /></span><strong>{t.label}</strong>
            </button>; })}
          </div>
        </fieldset>

        {effective.id === 'bundles' && networks.length > 1 && <label className="pk-group pk-field"><span>Network</span>
          <select value={choice.network} onChange={e => setNetwork(e.target.value as PromoNetwork)}>{networks.map(n => <option key={n} value={n}>{promoNetworkName(n)}</option>)}</select></label>}
        {effective.id === 'featured' && <label className="pk-group pk-field"><span>Bundle</span>
          <select value={choice.bundleId} onChange={e => setBundleId(e.target.value)}>{sorted.map(b => <option key={b.id} value={b.id}>{promoNetworkName(b.network)} {b.dataAmount} · {promoPrice(b.priceMinor)}</option>)}</select>
          <small>Only bundles on sale now, at your store’s price.</small></label>}

        <fieldset className="pk-group"><legend>Message</legend>
          <div className="pk-messages" role="radiogroup" aria-label="Message">
            {messages.map((m, i) => <button key={m} type="button" role="radio" aria-checked={message === i} onClick={() => setMessage(i)}>{m}</button>)}
            <button type="button" role="radio" aria-checked={message < 0} onClick={() => setMessage(-1)}>Write your own</button>
          </div>
          {message < 0 && <label className="pk-field"><span className="sr-only">Your headline</span>
            <input value={custom} maxLength={PROMO_HEADLINE_MAX} onChange={e => setCustom(e.target.value)} placeholder="e.g. Data for the whole family" autoFocus />
            <small>{custom.length}/{PROMO_HEADLINE_MAX}. Only say what is true: no discounts or deadlines you don’t offer.</small></label>}
        </fieldset>
      </div>

    </div>
  </section>;
}
