/*
 * Mystery Gifts 3.7.2 review fixture. LOCAL ONLY, SYNTHETIC DATA ONLY.
 *
 * Renders the dormant gift components inside the real Mystery Greetings page styles so they can be reviewed in a real
 * browser (scripts/reviewMysteryGifts.cjs). Served by the Vite dev server at /scripts/review/giftsReview.html; the
 * production build never includes it. Nothing here calls a server: the "catalogue" and "quote" below are fixed,
 * synthetic answers, and "Continue to payment" only shows a fixture notice. A banner on every screen says so.
 *
 *   ?view=recipient&status=pending|delivered|review|undeliverable|status_unavailable&sender=Kojo&occasion=new-year-2027&variant=gift-starlight-v1
 *   ?view=choice   ?view=picker   ?view=review&quote=ready|changed|checking|failed   ?view=empty   ?view=failed
 */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import '../../src/greetings/greetings.css';
import '../../src/greetings/gifts/gifts.css';
import { GreetingStage } from '../../src/greetings/GreetingStage';
import { GreetingsSky, GreetingsTopBar, useGreetingsFonts } from '../../src/greetings/chrome';
import type { Occasion, Variant } from '../../src/greetings/model';
import { GiftReveal } from '../../src/greetings/gifts/GiftReveal';
import { GiftChoice, GiftPicker, giftProductsFromCatalogue, type GiftMode, type GiftQuote, type GiftSelection } from '../../src/greetings/gifts/GiftSender';
import { GIFT_STATUSES, type GiftStatus } from '../../shared/mysteryGifts';

const q = new URLSearchParams(location.search);
const view = q.get('view') || 'recipient';
const occasion = (q.get('occasion') === 'new-year-2027' ? 'new-year-2027' : 'christmas-2026') as Occasion;
const variant = (q.get('variant') === 'gift-starlight-v1' ? 'gift-starlight-v1' : 'gift-classic-v1') as Variant;
const status = (GIFT_STATUSES as readonly string[]).includes(q.get('status') || '') ? q.get('status') as GiftStatus : 'pending';
const sender = q.get('sender') || null;

/** A synthetic catalogue in the /api/commercial/products shape. Not real prices. */
const CATALOGUE = { products: [
  { id: 'fixture-mtn-1', network: 'mtn', dataAmount: '1GB', amountPesewas: 600, isActive: true },
  { id: 'fixture-mtn-2', network: 'mtn', dataAmount: '2GB', amountPesewas: 1150, isActive: true },
  { id: 'fixture-mtn-5', network: 'mtn', dataAmount: '5GB', amountPesewas: 2700, isActive: true },
  { id: 'fixture-mtn-10', network: 'mtn', dataAmount: '10GB', amountPesewas: 5200, isActive: true },
  { id: 'fixture-tel-2', network: 'telecel', dataAmount: '2GB', amountPesewas: 1100, isActive: true },
  { id: 'fixture-tel-5', network: 'telecel', dataAmount: '5GB', amountPesewas: 2600, isActive: true },
  { id: 'fixture-at-3', network: 'airteltigo', dataAmount: '3GB', amountPesewas: 1500, isActive: true },
  { id: 'fixture-at-8', network: 'airteltigo', dataAmount: '8GB', amountPesewas: 3600, isActive: true },
] };
const PRODUCTS = giftProductsFromCatalogue(CATALOGUE);

function Banner() {
  return <p role="note" style={{ margin: '10px 0 16px', padding: '6px 12px', borderRadius: 999, textAlign: 'center', font: '600 .74rem/1.3 system-ui', color: '#1a1300', background: '#ffd75e' }}>
    Review fixture · synthetic data · not a live screen
  </p>;
}

function Page({ children, occ = occasion, vari = variant }: { children: React.ReactNode; occ?: Occasion; vari?: Variant }) {
  useGreetingsFonts();
  return (
    <main className="mg-page" data-occasion={occ} data-variant={vari} data-ready="true">
      <GreetingsSky />
      <div className="mg-shell">
        <GreetingsTopBar />
        <Banner />
        {children}
      </div>
    </main>
  );
}

function Recipient() {
  const [attempt, setAttempt] = useState(0);
  const shown: GiftStatus = status === 'status_unavailable' && attempt > 0 ? 'pending' : status;
  return (
    <Page>
      <GreetingStage
        greeting={{ occasion, variant, recipientName: 'Ama', senderName: sender, message: occasion === 'new-year-2027' ? 'Wishing you a peaceful beginning and a year filled with possibility.' : 'May your Christmas be filled with warmth, peace and little moments of joy.' }}
        after={() => (
          <>
            <GiftReveal key={shown} gift={{ schemaVersion: 1, kind: 'data', network: q.get('network') === 'telecel' ? 'telecel' : q.get('network') === 'airteltigo' ? 'airteltigo' : 'mtn', allowance: q.get('allowance') || '5GB', status: shown }}
              senderName={sender} initiallyOpen={attempt > 0} onRetry={() => setAttempt(a => a + 1)} />
            <div className="mg-actions" data-single>
              <button type="button" className="mg-btn mg-btn-quiet">Replay the surprise</button>
            </div>
          </>
        )}
      />
    </Page>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="mg-note" role="status" data-fixture-notice>{children}</p>;
}

function Choice() {
  const [mode, setMode] = useState<GiftMode>('free');
  return (
    <Page>
      <section className="mg-step" aria-labelledby="mg-step-title">
        <h1 id="mg-step-title" className="mg-step-title">Here’s how it will look</h1>
        <p className="mg-step-lede">This is exactly what Ama will see when they open your link.</p>
        <GreetingStage preview headingLevel={2} greeting={{ occasion, variant, recipientName: 'Ama', senderName: 'Kojo', message: 'May your Christmas be filled with warmth, peace and little moments of joy.' }} />
        <GiftChoice value={mode} onChange={setMode} available />
        <Notice>Fixture: the creator would continue with “{mode === 'free' ? 'Create my greeting' : 'Create my greeting, then choose the gift'}”.</Notice>
      </section>
    </Page>
  );
}

function Picker({ stage = 'choose', quoteMode = 'ready' }: { stage?: 'choose' | 'review'; quoteMode?: string }) {
  const [quote, setQuote] = useState<GiftQuote | null>(stage === 'review' ? quoteFor(quoteMode, 2700) : null);
  const [notice, setNotice] = useState('');
  const review = (s: GiftSelection) => {
    setQuote({ state: 'checking' });
    const p = PRODUCTS.find(x => x.id === s.productId)!;
    setTimeout(() => setQuote(quoteFor(quoteMode, p.priceMinor)), 500);
  };
  return (
    <Page>
      <GiftPicker products={PRODUCTS} quote={quote} senderHidden={q.get('hidden') === '1'} onReview={review}
        onContinue={s => setNotice(`Fixture: ${s.productId} for ${s.recipient} would go to the existing Mystery Hub Data checkout. Nothing is connected here.`)}
        onSkip={() => setNotice('Fixture: back to the free greeting.')}
        initial={stage === 'review' ? { network: 'mtn', productId: 'fixture-mtn-5', number: '024 555 0187', confirm: '024 555 0187', stage: 'review' } : undefined} />
      {notice && <Notice>{notice}</Notice>}
    </Page>
  );
}
function quoteFor(mode: string, priceMinor: number): GiftQuote {
  return mode === 'checking' ? { state: 'checking' } : mode === 'failed' ? { state: 'failed' } : { state: 'ready', totalMinor: mode === 'changed' ? priceMinor + 100 : priceMinor };
}

function Empty({ failed }: { failed: boolean }) {
  const [notice, setNotice] = useState('');
  return <Page><GiftPicker products={failed ? 'failed' : []} quote={null} onReview={() => {}} onContinue={() => {}} onSkip={() => setNotice('Fixture: back to the free greeting.')} onRetryCatalogue={() => setNotice('Fixture: the catalogue would be asked again.')} />{notice && <Notice>{notice}</Notice>}</Page>;
}

const screens: Record<string, () => React.ReactElement> = {
  recipient: () => <Recipient />,
  choice: () => <Choice />,
  picker: () => <Picker />,
  review: () => <Picker stage="review" quoteMode={q.get('quote') || 'ready'} />,
  empty: () => <Empty failed={false} />,
  failed: () => <Empty failed />,
};
createRoot(document.getElementById('root')!).render((screens[view] || screens.recipient)());
