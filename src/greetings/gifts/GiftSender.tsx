import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Gift, Mail } from 'lucide-react';
import { GIFT_ALLOWANCE, GIFT_NETWORKS, type GiftNetwork } from '../../../shared/mysteryGifts';
import { formatGhanaPhone, ghanaPhoneDigits, isCompleteGhanaPhone } from '../../utils/checkoutRecovery';
import { GIFT_NETWORK_COPY } from './GiftReveal';

/*
 * Mystery Gifts V1 (3.7.2), sender side. DORMANT DESIGN FOUNDATION: nothing in production renders this yet, and it
 * never calls a server, opens a payment or saves anything by itself.
 *
 * - GiftChoice is the optional "Make your surprise extra special" choice. It renders nothing unless the caller says
 *   gifting is genuinely available, and the free greeting is always the default.
 * - GiftPicker lets the creator choose a standard Data bundle from the server's own catalogue, enter the recipient's
 *   number twice and review the server-confirmed price. Every price shown comes from its props (the catalogue and a
 *   server quote), never from this file. "Continue to payment" only reports the selection to the caller, which in a
 *   future release hands it to the existing Mystery Hub Data checkout once the 3.5 contract exists.
 */

export type GiftMode = 'free' | 'gift';

export function GiftChoice({ value, onChange, available }: { value: GiftMode; onChange: (mode: GiftMode) => void; available: boolean }) {
  // Offered only when a real, successful gift purchase is possible right now; otherwise the creator looks as it does today.
  if (!available) return null;
  return (
    <fieldset className="mg-field mgg-choice">
      <legend className="mg-label">Make your surprise extra special</legend>
      <div className="mgg-options">
        <label className="mgg-option">
          <input type="radio" name="mgg-mode" value="free" checked={value === 'free'} onChange={() => onChange('free')} />
          <span className="mgg-option-icon" aria-hidden="true"><Mail /></span>
          <span className="mgg-option-text">
            <span className="mgg-option-title">Send a free greeting</span>
            <span className="mgg-option-detail">Your message, wrapped as a gift. Always free.</span>
          </span>
        </label>
        <label className="mgg-option">
          <input type="radio" name="mgg-mode" value="gift" checked={value === 'gift'} onChange={() => onChange('gift')} />
          <span className="mgg-option-icon" aria-hidden="true"><Gift /></span>
          <span className="mgg-option-text">
            <span className="mgg-option-title">Attach a data gift</span>
            <span className="mgg-option-detail">Add a real data bundle for their number. You pay only the bundle’s normal price.</span>
          </span>
        </label>
      </div>
    </fieldset>
  );
}

/** A standard Data bundle as the server catalogue (/api/commercial/products) describes it. */
export interface GiftProduct { id: string; network: GiftNetwork; allowance: string; priceMinor: number; validity: string }

/**
 * The giftable bundles from a /api/commercial/products answer. The server already leaves out switched-off products and
 * networks paused in the Service Control Center; anything malformed is dropped here too. Sorted by network, then size.
 */
export function giftProductsFromCatalogue(body: unknown): GiftProduct[] {
  const list = (body as { products?: unknown } | null)?.products;
  if (!Array.isArray(list)) return [];
  const products: GiftProduct[] = [];
  for (const p of list as Record<string, unknown>[]) {
    if (!p || typeof p !== 'object' || p.isActive === false || p.serviceType !== undefined && p.serviceType !== 'data') continue;
    const network = GIFT_NETWORKS.find(n => n === p.network);
    if (!network || typeof p.id !== 'string' || !p.id || typeof p.dataAmount !== 'string' || !GIFT_ALLOWANCE.test(p.dataAmount)) continue;
    if (!Number.isSafeInteger(p.amountPesewas) || (p.amountPesewas as number) <= 0) continue;
    products.push({ id: p.id, network, allowance: p.dataAmount, priceMinor: p.amountPesewas as number, validity: typeof p.validity === 'string' ? p.validity : '' });
  }
  const mb = (a: string) => parseFloat(a) * (a.endsWith('GB') ? 1024 : 1);
  return products.sort((a, b) => GIFT_NETWORKS.indexOf(a.network) - GIFT_NETWORKS.indexOf(b.network) || mb(a.allowance) - mb(b.allowance));
}

export const cedis = (minor: number) => `GH₵${(minor / 100).toFixed(2)}`;

export interface GiftSelection { productId: string; recipient: string }
/** The server's price for the reviewed selection: asked for when the creator reviews, never assumed. */
export type GiftQuote = { state: 'checking' } | { state: 'ready'; totalMinor: number } | { state: 'failed' };
type Problems = Partial<Record<'product' | 'number' | 'confirm', string>>;

export function giftProblems(productId: string | null, number: string, confirm: string): Problems {
  const problems: Problems = {};
  if (!productId) problems.product = 'Choose a bundle.';
  if (!isCompleteGhanaPhone(number)) problems.number = 'Enter a 10-digit Ghana number, like 024 123 4567.';
  else if (ghanaPhoneDigits(confirm) !== ghanaPhoneDigits(number)) problems.confirm = 'The two numbers don’t match. Check them once more.';
  return problems;
}

export function GiftPicker({ products, quote, senderHidden = false, onReview, onContinue, onSkip, onRetryCatalogue, initial }: {
  products: GiftProduct[] | 'loading' | 'failed';
  quote: GiftQuote | null;
  senderHidden?: boolean;
  onReview: (selection: GiftSelection) => void;
  onContinue: (selection: GiftSelection) => void;
  onSkip: () => void;
  onRetryCatalogue?: () => void;
  /** Review screens and previews only. */
  initial?: { network?: GiftNetwork; productId?: string; number?: string; confirm?: string; stage?: 'choose' | 'review' };
}) {
  const list = Array.isArray(products) ? products : [];
  const networks = useMemo(() => GIFT_NETWORKS.filter(n => list.some(p => p.network === n)), [list]);
  const [network, setNetwork] = useState<GiftNetwork | null>(initial?.network ?? null);
  const shownNetwork = network && networks.includes(network) ? network : networks[0] ?? null;
  const [productId, setProductId] = useState<string | null>(initial?.productId ?? null);
  const [number, setNumber] = useState(initial?.number ?? '');
  const [confirm, setConfirm] = useState(initial?.confirm ?? '');
  const [problems, setProblems] = useState<Problems>({});
  const [stage, setStage] = useState<'choose' | 'review'>(initial?.stage ?? 'choose');
  const heading = useRef<HTMLHeadingElement>(null), moved = useRef(false);
  useLayoutEffect(() => { if (moved.current) { heading.current?.focus({ preventScroll: true }); moved.current = false; } }, [stage]);
  const product = list.find(p => p.id === productId && p.network === shownNetwork) ?? null;
  const selection = (): GiftSelection | null => product ? { productId: product.id, recipient: ghanaPhoneDigits(number) } : null;

  if (products === 'loading') return <section className="mgg-picker"><div className="mg-state mg-loading" role="status"><span className="mg-loading-gift" aria-hidden="true"><span /><span /></span><p>Finding today’s data bundles…</p></div></section>;
  if (products === 'failed' || !list.length) {
    return (
      <section className="mgg-picker mgg-empty" aria-labelledby="mgg-empty-title">
        <h1 id="mgg-empty-title" className="mgg-title">{products === 'failed' ? 'We couldn’t load data bundles just now' : 'Data gifts aren’t available right now'}</h1>
        <p className="mgg-lede">Your free greeting is still ready to send.</p>
        <div className="mg-actions">
          {products === 'failed' && onRetryCatalogue && <button type="button" className="mg-btn mg-btn-ghost" onClick={onRetryCatalogue}>Try again</button>}
          <button type="button" className="mg-btn mg-btn-primary" onClick={onSkip}>Send without a gift</button>
        </div>
      </section>
    );
  }

  const review = () => {
    const found = giftProblems(product?.id ?? null, number, confirm);
    setProblems(found);
    const first = (['product', 'number', 'confirm'] as const).find(k => found[k]);
    if (first) { requestAnimationFrame(() => document.getElementById(`mgg-field-${first}`)?.focus()); return; }
    const chosen = selection()!;
    moved.current = true; setStage('review'); onReview(chosen);
  };

  if (stage === 'review' && product) {
    const net = GIFT_NETWORK_COPY[product.network];
    const changed = quote?.state === 'ready' && quote.totalMinor !== product.priceMinor;
    return (
      <section className="mgg-picker" aria-labelledby="mgg-review-title">
        <h1 id="mgg-review-title" ref={heading} tabIndex={-1} className="mgg-title">Review your gift</h1>
        <div className="mgg-summary" style={{ '--mgg-net': net.color, '--mgg-net-ink': net.ink } as CSSProperties}>
          <span className="mgg-net"><span className="mgg-net-dot" aria-hidden="true" />{net.name}</span>
          <p className="mgg-summary-size">{product.allowance} <span>data</span></p>
          <p className="mgg-summary-to">For <strong>{formatGhanaPhone(number)}</strong></p>
        </div>
        <div className="mgg-price" role="status" aria-live="polite">
          {quote?.state === 'ready' ? (
            <>
              <p className="mgg-price-line"><span>Total</span> <strong>{cedis(quote.totalMinor)}</strong></p>
              {changed && <p className="mgg-price-note">The price has changed since you chose this bundle. This is the current price.</p>}
              <p className="mgg-price-note">The greeting stays free. You pay only for the bundle, at its current Mystery Hub price.</p>
            </>
          ) : quote?.state === 'failed' ? (
            <p className="mgg-price-note">We couldn’t confirm today’s price just now. <button type="button" className="mg-link" onClick={() => { const s = selection(); if (s) onReview(s); }}>Try again</button></p>
          ) : <p className="mgg-price-note">Checking today’s price…</p>}
        </div>
        <ul className="mgg-notes">
          <li>The bundle goes straight to this number. Their network may text them when it arrives, possibly before they open your greeting.</li>
          <li>Payment uses Mystery Hub’s usual secure checkout, with the usual receipt and order tracking.</li>
          <li>Your greeting link never shows the price or their number.</li>
          {senderHidden && <li>Your name stays hidden from them. Your receipt details stay with Mystery Hub and the payment provider, as for any order.</li>}
        </ul>
        <div className="mg-actions mgg-actions">
          <button type="button" className="mg-btn mg-btn-primary" disabled={quote?.state !== 'ready'} onClick={() => { const s = selection(); if (s) onContinue(s); }}>
            Continue to payment<ArrowRight className="mg-icon" aria-hidden="true" />
          </button>
          <button type="button" className="mg-btn mg-btn-ghost" onClick={() => { moved.current = true; setStage('choose'); }}><ArrowLeft className="mg-icon" aria-hidden="true" />Change gift</button>
          <button type="button" className="mg-btn mg-btn-quiet" onClick={onSkip}>Send without a gift</button>
        </div>
      </section>
    );
  }

  const shown = list.filter(p => p.network === shownNetwork);
  const describe = (key: keyof Problems) => problems[key] ? { 'aria-invalid': true, 'aria-describedby': `mgg-error-${key}` } : {};
  return (
    <section className="mgg-picker" aria-labelledby="mgg-choose-title">
      <h1 id="mgg-choose-title" ref={heading} tabIndex={-1} className="mgg-title">Choose a data gift</h1>
      <p className="mgg-lede">Pick a bundle for the person you’re surprising. It goes straight to their number.</p>
      {networks.length > 1 && (
        <fieldset className="mg-field">
          <legend className="mg-label">Their network</legend>
          <div className="mgg-nets">
            {networks.map(n => (
              <label key={n} className="mgg-net-option" style={{ '--mgg-net': GIFT_NETWORK_COPY[n].color, '--mgg-net-ink': GIFT_NETWORK_COPY[n].ink } as CSSProperties}>
                <input type="radio" name="mgg-network" value={n} checked={shownNetwork === n} onChange={() => { setNetwork(n); setProductId(null); }} />
                <span><span className="mgg-net-dot" aria-hidden="true" />{GIFT_NETWORK_COPY[n].name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset className="mg-field mgg-field-product" id="mgg-field-product" tabIndex={-1} aria-describedby={problems.product ? 'mgg-error-product' : undefined}>
        <legend className="mg-label">{networks.length > 1 ? 'Bundle' : `${GIFT_NETWORK_COPY[shownNetwork!].name} bundle`}</legend>
        <div className="mgg-bundles">
          {shown.map(p => (
            <label key={p.id} className="mgg-bundle">
              <input type="radio" name="mgg-bundle" value={p.id} checked={productId === p.id} onChange={() => { setProductId(p.id); setProblems(x => ({ ...x, product: undefined })); }} />
              <span className="mgg-bundle-size">{p.allowance}</span>
              <span className="mgg-bundle-price">{cedis(p.priceMinor)}</span>
              {p.validity && <span className="mgg-bundle-validity">{p.validity}</span>}
            </label>
          ))}
        </div>
        {problems.product && <p className="mg-error" id="mgg-error-product">{problems.product}</p>}
      </fieldset>
      <div className="mg-field">
        <label className="mg-label" htmlFor="mgg-field-number">Their mobile number</label>
        <input id="mgg-field-number" className="mg-input" type="tel" inputMode="numeric" autoComplete="off" placeholder="024 123 4567" value={number}
          onChange={e => { setNumber(formatGhanaPhone(e.target.value)); setProblems(x => ({ ...x, number: undefined, confirm: undefined })); }} {...describe('number')} />
        {problems.number && <p className="mg-error" id="mgg-error-number">{problems.number}</p>}
      </div>
      <div className="mg-field">
        <label className="mg-label" htmlFor="mgg-field-confirm">Type their number again</label>
        <input id="mgg-field-confirm" className="mg-input" type="tel" inputMode="numeric" autoComplete="off" value={confirm}
          onChange={e => { setConfirm(formatGhanaPhone(e.target.value)); setProblems(x => ({ ...x, confirm: undefined })); }} {...describe('confirm')} />
        {problems.confirm && <p className="mg-error" id="mgg-error-confirm">{problems.confirm}</p>}
        <p className="mg-help">A gift can’t be moved to another number once it’s sent, so it’s worth checking twice.</p>
      </div>
      <div className="mg-actions mgg-actions">
        <button type="button" className="mg-btn mg-btn-primary" onClick={review}>Review gift<ArrowRight className="mg-icon" aria-hidden="true" /></button>
        <button type="button" className="mg-btn mg-btn-quiet" onClick={onSkip}>Send without a gift</button>
      </div>
    </section>
  );
}
