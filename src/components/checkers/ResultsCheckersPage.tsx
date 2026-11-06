import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './resultsCheckers.css';
import { AlertCircle, Check, CheckCircle2, Clock3, Copy, GraduationCap, KeyRound, Loader2, Lock, MessageCircle, Minus, Plus, ReceiptText, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';
import { getCheckerConfig, getCheckerReceipt, initializeCheckerPayment } from '../../services/resultsCheckerApi';
import { verifyPaymentOnServer } from '../../services/apiClient';
import { formatGhs } from '../../../shared/money';
import type { CheckerConfig, CheckerConfigProduct, CheckerProductKey, CheckerReceipt } from '../../../shared/resultsCheckers';

const SUPPORT = BUSINESS_CONFIG.contact.supportWhatsAppUrl;
const money = (minor: number) => formatGhs(minor);

function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setState('copied'); } catch { setState('failed'); }
    window.setTimeout(() => setState('idle'), 2200);
  };
  return <button type="button" className="rc-copy" onClick={copy} aria-label={state === 'copied' ? `${label} copied` : state === 'failed' ? `Could not copy ${label}` : `Copy ${label}`}>{state === 'copied' ? <><Check size={16} aria-hidden />Copied</> : state === 'failed' ? 'Select and copy' : <><Copy size={16} aria-hidden />Copy</>}</button>;
}

/** The customer's receipt. Everything comes from the server: PINs appear only after they are safely stored. */
function Receipt({ receipt, onRefresh, refreshing }: { receipt: CheckerReceipt; onRefresh: () => void; refreshing: boolean }) {
  const supportText = encodeURIComponent(`Hello Mystery Hub, I need help with my results checker order ${receipt.orderRef}.`);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [receipt.state]);
  return (
    <section className="rc-receipt" aria-labelledby="rc-receipt-title">
      {receipt.state === 'ready' && <>
        <div className="rc-state rc-state-good"><CheckCircle2 size={24} aria-hidden /><h2 id="rc-receipt-title" ref={heading} tabIndex={-1}>Your {receipt.pins.length === 1 ? 'checker is' : 'checkers are'} ready</h2></div>
        <p className="rc-receipt-note">Keep these details private. Anyone with them can use the checker. You can open this receipt again from your orders.</p>
      </>}
      {receipt.state === 'partial' && <>
        <div className="rc-state rc-state-warn"><AlertCircle size={24} aria-hidden /><h2 id="rc-receipt-title" ref={heading} tabIndex={-1}>{receipt.pins.length} of {receipt.pinsExpected} checkers received</h2></div>
        <p className="rc-receipt-note">Our team is getting the rest for you. Please don't pay again. Here is what we have so far.</p>
      </>}
      {receipt.state === 'processing' && <>
        <div className="rc-state"><Clock3 size={24} aria-hidden /><h2 id="rc-receipt-title" ref={heading} tabIndex={-1}>{receipt.paid ? 'Payment confirmed. Getting your checker.' : 'Confirming your payment'}</h2></div>
        <p className="rc-receipt-note">{receipt.paid ? "This page will show your PIN as soon as we have it. Please don't pay again." : "If you approved a Mobile Money payment, it can take a moment to reach us. Please don't pay again. We'll keep checking."}</p>
      </>}
      {receipt.state === 'review' && <>
        <div className="rc-state rc-state-warn"><AlertCircle size={24} aria-hidden /><h2 id="rc-receipt-title" ref={heading} tabIndex={-1}>{receipt.paid ? 'Our team is checking your order' : 'Payment not confirmed'}</h2></div>
        <p className="rc-receipt-note">{receipt.paid ? "Your payment is recorded, but your checker needs a manual check. Please don't pay again. We'll sort this out with you." : "We have no confirmed payment for this order. If money left your account, please don't pay again. Contact us with the order number below."}</p>
      </>}

      {receipt.pins.length > 0 && (
        <ul className="rc-pins" aria-label="Your checker details">
          {receipt.pins.map((item, i) => (
            <li key={i} className="rc-pin">
              {receipt.pins.length > 1 && <span className="rc-pin-no">Checker {i + 1}</span>}
              {item.serial && <div className="rc-pin-row"><span className="rc-pin-label">Serial number</span><code>{item.serial}</code><CopyButton value={item.serial} label={`serial number ${i + 1}`} /></div>}
              <div className="rc-pin-row"><span className="rc-pin-label">PIN</span><code>{item.pin}</code><CopyButton value={item.pin} label={`PIN ${i + 1}`} /></div>
            </li>
          ))}
        </ul>
      )}

      <dl className="rc-facts">
        <div><dt>Product</dt><dd>{receipt.productName}</dd></div>
        <div><dt>Order</dt><dd className="rc-ref">{receipt.orderRef}</dd></div>
      </dl>
      <div className="rc-receipt-actions">
        {receipt.state !== 'ready' && <button type="button" className="mh-button-secondary" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Checking…' : 'Check again'}</button>}
        <a className="mh-button-secondary" href={`${SUPPORT}?text=${supportText}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} aria-hidden />Get help<span className="sr-only"> (opens WhatsApp)</span></a>
      </div>
    </section>
  );
}

const ICON: Record<CheckerProductKey, string> = { bece: 'BECE', wassce: 'WASSCE' };

/**
 * Results Checkers (/results-checkers). Buy a checker voucher, pay on Paystack, get the PIN on a private receipt.
 * Whether anything can be bought is the server's decision alone: until it says so, the page explains and sells nothing.
 */
export const ResultsCheckersPage: React.FC = () => {
  const { user, sessionToken, openAuth } = useApp();
  const [config, setConfig] = useState<CheckerConfig | null>(null);
  const [configFailed, setConfigFailed] = useState(false);
  const [selected, setSelected] = useState<CheckerProductKey | null>(null);
  const [qty, setQty] = useState(1);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [starting, setStarting] = useState(false);
  const [receipt, setReceipt] = useState<CheckerReceipt | null>(null);
  const [receiptRef, setReceiptRef] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const polls = useRef(0);

  useEffect(() => { let on = true; getCheckerConfig().then(c => { if (on) setConfig(c); }).catch(() => { if (on) setConfigFailed(true); }); return () => { on = false; }; }, []);
  useEffect(() => { if (user) { setEmail(e => e || user.email || ''); setPhone(p => p || user.phone || ''); } }, [user]);

  const loadReceipt = useCallback(async (reference: string) => {
    if (!sessionToken) return;
    setChecking(true); setReceiptError('');
    try { setReceipt(await getCheckerReceipt(reference, sessionToken)); }
    catch (err) { setReceiptError(err instanceof Error ? err.message : 'We could not open this receipt just now. Please try again.'); }
    finally { setChecking(false); }
  }, [sessionToken]);

  // Coming back from Paystack (?reference=) or from Orders (?order=). The server verifies the payment itself.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('reference') || params.get('trxref'), order = params.get('order');
    if (!payment && !order) return;
    if (!user || !sessionToken) { if (!user) openAuth('login', 'Sign in to see your results checker.'); return; }
    let on = true;
    (async () => {
      setChecking(true);
      let reference = order;
      if (payment) {
        try { const verified = await verifyPaymentOnServer(payment); reference = verified.order?.public_reference || payment; }
        catch { if (on) { setReceiptError("We couldn't confirm your payment just now. If you paid, please don't pay again. Open this page again or contact us."); setChecking(false); } return; }
      }
      if (on && reference) { setReceiptRef(reference); window.history.replaceState({ page: 'checkers' }, '', `/results-checkers?order=${encodeURIComponent(reference)}`); await loadReceipt(reference); }
    })();
    return () => { on = false; };
  }, [user, sessionToken, loadReceipt, openAuth]);

  // While a paid order is being fulfilled, check a few times. Afterwards the customer can press Check again.
  useEffect(() => {
    if (!receipt || receipt.state !== 'processing' || !receiptRef || polls.current >= 6) return;
    const timer = window.setTimeout(() => { polls.current++; void loadReceipt(receiptRef); }, 3500);
    return () => window.clearTimeout(timer);
  }, [receipt, receiptRef, loadReceipt]);

  const product: CheckerConfigProduct | undefined = useMemo(() => config?.products.find(p => p.key === selected), [config, selected]);
  const total = product ? product.priceMinor * qty : 0;

  const buy = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!product || starting) return;
    if (!user || !sessionToken) { openAuth('login', 'Sign in to buy a results checker. Your PIN is kept on your account.'); return; }
    const problems: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) problems.customerEmail = 'Enter a valid email for your payment receipt.';
    if (!phone.trim()) problems.phone = 'Enter your phone number, so we can help if anything goes wrong.';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setStarting(true);
    try {
      const payment = await initializeCheckerPayment({ product: product.key, qty, customerEmail: email.trim(), phone: phone.trim() }, sessionToken);
      if (!/^https:\/\/checkout\.paystack\.com\//.test(payment.authorizationUrl) && !payment.isSimulated) throw new Error('Payment could not be opened. Please try again.');
      window.location.assign(payment.authorizationUrl);
    } catch (err) {
      const e = err as Error & { field?: string };
      setErrors(e.field ? { [e.field]: e.message } : { form: e.message || 'Unable to start your purchase. Please try again.' });
      setStarting(false);
    }
  };

  const open = Boolean(config?.available);

  return (
    <div className="rc-page">
      <div className="rc-wrap">
        <header className="rc-hero">
          <span className="rc-mark" aria-hidden="true"><GraduationCap size={26} /></span>
          <h1>WASSCE and BECE results checkers</h1>
          <p>Buy a checker voucher, pay securely, and get your PIN on a private receipt you can open again from your account.</p>
        </header>

        {(checking && !receipt) && <p className="rc-loading" role="status"><Loader2 size={18} className="rc-spin" aria-hidden />Checking your order…</p>}
        {receiptError && <div className="rc-alert" role="alert"><AlertCircle size={18} aria-hidden /><span>{receiptError}</span></div>}
        {receipt && <Receipt receipt={receipt} refreshing={checking} onRefresh={() => { if (receiptRef) void loadReceipt(receiptRef); }} />}

        {!receipt && (<>
          {configFailed && <div className="rc-alert" role="status"><AlertCircle size={18} aria-hidden /><span>We can't show availability just now. Please try again shortly.</span></div>}
          {!config && !configFailed && <p className="rc-loading" role="status"><Loader2 size={18} className="rc-spin" aria-hidden />Checking availability…</p>}
          {config && !open && <div className="rc-closed" role="status"><Clock3 size={20} aria-hidden /><div><strong>{config.message}</strong><span>{/not on sale/.test(config.message) ? "Nothing can be bought here yet. We'll open sales when supply is confirmed." : 'Please try again shortly.'}</span></div></div>}

          {config && (
            <form onSubmit={buy} noValidate>
              <fieldset className="rc-products" disabled={!open}>
                <legend className="sr-only">Choose a checker</legend>
                {config.products.map(p => (
                  <label key={p.key} className="rc-product" data-selected={selected === p.key} data-available={p.available}>
                    <input type="radio" name="rc-product" value={p.key} checked={selected === p.key} disabled={!p.available} onChange={() => { setSelected(p.key); setQty(1); setErrors({}); }} />
                    <span className="rc-product-badge" aria-hidden="true">{ICON[p.key]}</span>
                    <span className="rc-product-text"><strong>{p.name}</strong><span>{p.short}</span></span>
                    <span className="rc-product-side"><b>{money(p.priceMinor)}</b><small>{!open ? 'Not on sale yet' : !p.available ? 'Unavailable' : p.stock === 'low' ? 'Few left' : 'In stock'}</small></span>
                  </label>
                ))}
              </fieldset>

              {product && (
                <div className="rc-checkout">
                  <div className="rc-qty-row">
                    <span id="rc-qty-label">How many?</span>
                    <div className="rc-qty" role="group" aria-labelledby="rc-qty-label">
                      <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="One fewer"><Minus size={18} aria-hidden /></button>
                      <output aria-live="polite">{qty}</output>
                      <button type="button" onClick={() => setQty(q => Math.min(config!.maxQty, q + 1))} disabled={qty >= config!.maxQty} aria-label="One more"><Plus size={18} aria-hidden /></button>
                    </div>
                  </div>
                  {user ? (<>
                    <div className="rc-field">
                      <label htmlFor="rc-email">Email for your payment receipt</label>
                      <input id="rc-email" className="mh-field" type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} aria-invalid={Boolean(errors.customerEmail)} aria-describedby={errors.customerEmail ? 'rc-email-err' : undefined} />
                      {errors.customerEmail && <p id="rc-email-err" className="rc-error">{errors.customerEmail}</p>}
                    </div>
                    <div className="rc-field">
                      <label htmlFor="rc-phone">Your phone number</label>
                      <input id="rc-phone" className="mh-field" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'rc-phone-err' : undefined} />
                      {errors.phone && <p id="rc-phone-err" className="rc-error">{errors.phone}</p>}
                    </div>
                  </>) : <p className="rc-signin-note"><Lock size={16} aria-hidden />Sign in first. Your PIN is kept on your account, so only you can open it.</p>}
                  {errors.form && <div className="rc-alert" role="alert"><AlertCircle size={18} aria-hidden /><span>{errors.form}</span></div>}
                  {errors.qty && <div className="rc-alert" role="alert"><AlertCircle size={18} aria-hidden /><span>{errors.qty}</span></div>}
                  <div className="rc-total"><span>Total</span><strong>{money(total)}</strong></div>
                  <button type="submit" className="mh-button rc-pay" disabled={starting}>{starting ? 'Opening secure payment…' : user ? `Continue to payment · ${money(total)}` : 'Sign in to continue'}</button>
                  <p className="rc-pay-note">You'll pay on Paystack. Your PIN appears after your payment is verified and the voucher is confirmed.</p>
                </div>
              )}
            </form>
          )}
        </>)}

        <section className="rc-info" aria-labelledby="rc-how">
          <h2 id="rc-how">How it works</h2>
          <ol className="rc-steps">
            <li><ReceiptText size={20} aria-hidden /><div><strong>Choose and pay</strong><span>Pick your checker and pay on Paystack.</span></div></li>
            <li><ShieldCheck size={20} aria-hidden /><div><strong>We verify your payment</strong><span>Then we get your voucher from our supplier.</span></div></li>
            <li><KeyRound size={20} aria-hidden /><div><strong>Open your PIN</strong><span>It stays on your receipt, so a refresh won't lose it. Find it again under Orders.</span></div></li>
          </ol>
          <p className="rc-disclaimer">Mystery Hub sells checker vouchers. We don't issue or look up results, and we aren't affiliated with or endorsed by WAEC. Use your voucher on the official results website.</p>
        </section>
      </div>
    </div>
  );
};
