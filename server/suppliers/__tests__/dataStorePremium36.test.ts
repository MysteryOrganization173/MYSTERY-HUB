import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataBundleTile, splitDataAmount } from '../../../src/components/data/DataBundleTile';
import { DataNetworkSelector } from '../../../src/components/data/DataNetworkSelector';
import { DATA_BUNDLES } from '../../../src/data/bundles';
import { dataStoreLook, dataStoreSeasonAttributes } from '../../../src/seasonal/dataStoreSeason';
import { DATA_LINE } from '../../../src/seasonal/christmas/copy';
import { previewSeasonStatus, serverSeasonStatus } from '../../../shared/seasonal';
import * as failure from '../../../shared/checkoutFailure';
import * as attempts from '../../../src/utils/directCheckoutAttempt';
import * as recovery from '../../../src/utils/checkoutRecovery';
import * as presentation from '../../../src/utils/dataPurchasePresentation';
import * as quotePresentation from '../../../src/utils/directQuotePresentation';
import * as money from '../../../shared/money';
import * as bundles from '../../../src/data/bundles';
import * as receiptEmail from '../../../src/utils/receiptEmail';
import { BUSINESS_CONFIG } from '../../../src/config/business';
import * as serviceStatusModule from '../../../src/hooks/useServiceStatus';
import * as serviceControlsModule from '../../../shared/serviceControls';

/**
 * Mystery Hub 3.6 · the premium Data store. One purchasing page with an ordinary (permanent) appearance and a
 * seasonal one, for guests and signed-in customers alike. These tests guard the boundaries that make that safe.
 */

const read = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const page = read('src/components/data/DataPage.tsx');
const tileSource = read('src/components/data/DataBundleTile.tsx');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const mtn1 = DATA_BUNDLES.find(b => b.id === 'mtn-1gb')!;
const mtn5 = DATA_BUNDLES.find(b => b.id === 'mtn-5gb')!;
const welcomeOf = (bundle: any) => renderToStaticMarkup(React.createElement(DataBundleTile, { bundle, directWelcomeOffer: { enabled: true, state: 'eligible', discountMinor: 100 } as any, onBuy() {} }));

/** Every selector of a stylesheet (comments, keyframes and @media wrappers removed; commas inside :is() kept). */
function selectorsOf(css: string): string[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').replace(/@media[^{]+\{/g, '');
  const rules = clean.match(/[^{}]+\{[^{}]*\}/g) || [];
  const out: string[] = [];
  for (const rule of rules) {
    let depth = 0, current = '';
    for (const ch of rule.slice(0, rule.indexOf('{'))) {
      if (ch === '(') depth++; if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(current.trim()); current = ''; } else current += ch;
    }
    out.push(current.trim());
  }
  return out.filter(Boolean);
}

test('the catalogue tile shows the same server prices and accessible names as the shared row', () => {
  const plain = renderToStaticMarkup(React.createElement(DataBundleTile, { bundle: mtn5, onBuy() {} }));
  assert.match(plain, /role="button"/);
  assert.match(plain, /tabindex="0"/);
  assert.match(plain, new RegExp(`aria-label="Buy 5GB MTN Ghana data for GH₵${mtn5.priceGhc.toFixed(2)}"`));
  assert.match(plain, /data-net="mtn"/);
  assert.doesNotMatch(plain, /<del>|You save/);
  // A server campaign price: label, crossed-out standard price and saving, never colour alone.
  const december = { ...mtn1, priceGhc: 4.99, standardPriceGhc: 5.49, priceCampaign: { label: 'December Special', stacksWithWelcome: false } };
  const campaign = renderToStaticMarkup(React.createElement(DataBundleTile, { bundle: december, onBuy() {} }));
  assert.match(campaign, /aria-label="Buy 1GB MTN Ghana data\. December Special GH₵4\.99; regular price GH₵5\.49\. You save GH₵0\.50\."/);
  assert.match(text(campaign), /1 GB December Special GH₵5\.49 GH₵4\.99 You save GH₵0\.50/);
  assert.match(text(welcomeOf(mtn1)), /1 GB Welcome Price GH₵5\.49 GH₵4\.49 You save GH₵1\.00/);
  // A confirmed Welcome Offer: the one-time price, the regular price and the saving.
  const eligible = { enabled: true, state: 'eligible', discountMinor: 100 } as any;
  const welcome = renderToStaticMarkup(React.createElement(DataBundleTile, { bundle: mtn1, directWelcomeOffer: eligible, onBuy() {} }));
  assert.match(welcome, /aria-label="Buy 1GB MTN Ghana data\. Welcome Price GH₵4\.49/);
  assert.match(welcome, /<del>GH₵5\.49<\/del>/);
  assert.match(welcome, /You save GH₵1\.00/);
  // The per-GB comparison never uses the one-time Welcome Price.
  assert.doesNotMatch(welcome, /per GB/);
  // A guest's offer state never prices a tile.
  const guest = renderToStaticMarkup(React.createElement(DataBundleTile, { bundle: mtn1, directWelcomeOffer: { enabled: true, state: 'guest', discountMinor: 100 } as any, onBuy() {} }));
  assert.doesNotMatch(guest, /Welcome Price|<del>/);
});

test('the tile states only real facts: routing labels hidden, per-GB worked out from the tile price', () => {
  for (const bundle of DATA_BUNDLES) {
    const html = renderToStaticMarkup(React.createElement(DataBundleTile, { bundle, onBuy() {} }));
    assert.doesNotMatch(html, /Direct Credit|Direct SIM/, bundle.id);
    const gb = bundle.dataBytesValue / 1024;
    assert.ok(html.includes(`GH₵${(bundle.priceGhc / gb).toFixed(2)} per GB`), bundle.id);
  }
  assert.deepEqual(splitDataAmount('10GB'), ['10', 'GB']);
  assert.deepEqual(splitDataAmount('1.5 GB'), ['1.5', 'GB']);
  assert.deepEqual(splitDataAmount('Unlimited'), ['Unlimited', '']);
  assert.match(tileSource, /dataValidityLabel\(bundle\.validity\)/);
  assert.match(tileSource, /useTapFeedback\(\)/);
  // Prices come from the same helpers as the shared row; the tile never computes a discount of its own.
  assert.match(tileSource, /welcomePriceForBundle\(bundle, directWelcomeOffer\)/);
  assert.match(tileSource, /welcomePrice \? null : campaignPriceForBundle\(bundle\)/);
  assert.doesNotMatch(tileSource, /discountMinor\s*[-+*]/);
});

test('the Data page uses its own tile; the homepage row and reseller card are left as they were', () => {
  assert.match(page, /import \{ DataBundleTile, TILE_NETWORK_COLOR \} from '\.\/DataBundleTile'/);
  assert.doesNotMatch(page, /CompactBundleRow|BundleCard/);
  assert.match(read('src/components/home/HomeFeaturedData.tsx'), /<CompactBundleRow/);
  assert.doesNotMatch(read('src/components/data/CompactBundleRow.tsx'), /mh-ds/);
  assert.doesNotMatch(read('src/components/data/BundleCard.tsx'), /mh-ds/);
  // The page's stylesheet ships with the page's own lazy chunk and touches nothing outside it.
  assert.match(page, /^import '\.\/dataStore\.css';$/m);
  assert.match(read('src/App.tsx'), /const DataPage = lazyPage\(\(\) => import\('\.\/components\/data\/DataPage'\)/);
  for (const selector of selectorsOf(read('src/components/data/dataStore.css'))) assert.match(selector, /^\.mh-ds( |$)/, selector);
  for (const file of ['src/components/data/DataBundleTile.tsx', 'src/components/data/DataNetworkSelector.tsx', 'src/components/data/InstantBundleCard.tsx'])
    assert.doesNotMatch(read(file), /import ['"][^'"]+\.css['"]/, `${file} renders without a stylesheet import (server tests and other pages)`);
});

test('every bundle stays reachable: grouping and filters only arrange the confirmed catalogue', () => {
  assert.match(page, /onBuy=\{\(b\) => openCheckout\(b\)\}/);
  assert.match(page, /NETWORK_ORDER\.map\(network => \(\{ network, bundles: filteredBundles\.filter\(bundle => bundle\.network === network\) \}\)\)/);
  assert.match(page, /: \[\{ network: activeNetwork, bundles: filteredBundles \}\]/);
  const networks = new Set(DATA_BUNDLES.map(b => b.network));
  for (const network of networks) assert.ok(['mtn', 'airteltigo', 'telecel'].includes(network), `${network} is in NETWORK_ORDER`);
  // Network counts come from the catalogue already on the page.
  assert.match(page, /counts: Partial<Record<NetworkId \| 'all', number>> = \{ all: DATA_BUNDLES\.length \}/);
  const html = renderToStaticMarkup(React.createElement(DataNetworkSelector, { value: 'airteltigo', onChange() {}, counts: { all: 26, mtn: 13, airteltigo: 5, telecel: 8 } }));
  assert.match(html, /--net-i:2/);
  assert.match(html, /--net-color:#004b93/);
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  assert.match(html, />13</);
  assert.equal((html.match(/class="mh-ds-nets-thumb"/g) || []).length, 1);
});

test('motion: transform and opacity only, entrances once, nothing moves under reduced motion', () => {
  for (const file of ['src/components/data/dataStore.css', 'src/seasonal/christmas/data/dataStore.css']) {
    const css = read(file);
    for (const [, body] of css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?\})\s*\}/g)) {
      for (const [, prop] of body.matchAll(/([a-z-]+):/g)) assert.ok(['opacity', 'transform'].includes(prop), `${file}: keyframes animate ${prop}`);
    }
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*animation: none !important;/, file);
  }
  const ordinary = read('src/components/data/dataStore.css');
  // Tiles rise in with a backwards fill, so a finished entrance never blocks hover or press transforms.
  assert.match(ordinary, /animation: mh-ds-rise \.5s var\(--ds-ease\) backwards;/);
  assert.match(ordinary, /\.mh-ds \.mh-ds-catalog\.is-settled \.mh-ds-tile \{ animation: none; \}/);
  // The catalogue only re-enters when the view (network or size) changes, never on a search keystroke or a refresh.
  assert.match(page, /const catalogView = `\$\{activeNetwork\}\|\$\{sizeFilter\}`;/);
  assert.match(page, /<div key=\{catalogView\}/);
  assert.match(read('src/components/data/DataStoreHero.tsx'), /let heroShown = false;/);
  // Ambient motion is finite and pauses off-screen; only a loading skeleton may loop (and only while loading).
  for (const file of ['src/components/data/dataStore.css', 'src/seasonal/christmas/data/dataStore.css'])
    for (const line of read(file).split('\n').filter(l => /animation:[^;]*infinite/.test(l))) assert.match(line, /\.animate-pulse \{ animation: mh-ds-skeleton/, `${file}: ${line}`);
  assert.match(ordinary, /\.mh-ds \.mh-ds-hero\[data-ds-idle\] \* \{ animation-play-state: paused !important; \}/);
  assert.match(read('src/components/data/DataStoreHero.tsx'), /new IntersectionObserver\(\(\[entry\]\) => \{ if \(entry\.isIntersecting\) el\.removeAttribute\('data-ds-idle'\); else el\.setAttribute\('data-ds-idle', ''\); \}\)/);
  // A long price is never clipped: Buy wraps under it instead.
  assert.match(ordinary, /\.mh-ds \.mh-ds-tile-price \{[^}]*min-width: max-content;/);
  // Prices are never animated.
  assert.doesNotMatch(ordinary, /mh-ds-tile-price[^{]*\{[^}]*animation/);
});

test('one season for both audiences: the Data page follows the shared shell rule, scoped to the page', () => {
  const seasonal = read('src/seasonal/Seasonal.tsx');
  assert.match(seasonal, /const loadDataStore = retryOnce\(\(\) => import\('\.\/christmas\/data\/ChristmasDataStore'\)\);/);
  assert.match(seasonal, /const ChristmasDataStore = lazy\(loadDataStore\);/);
  assert.match(seasonal, /export function SeasonalDataStore[\s\S]*?if \(!season\.shellActive \|\| season\.status\.pack !== 'christmas-2026'\) return <>\{fallback\}<\/>;/);
  assert.match(seasonal, /<SeasonalBoundary fallback=\{fallback\}>/);
  assert.match(seasonal, /if \(season\.shellActive && page === 'data'\) void loadDataStore\(\)/);
  assert.match(page, /\{\.\.\.dataStoreSeasonAttributes\(season\)\}/);
  assert.doesNotMatch(page, /<Seasonal slot="page" page="data"/, 'the guest-only page accent is replaced by the shared Data look');
  // The seasonal chunk is never imported eagerly by ordinary code.
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  for (const file of walk('src').filter(f => /\.(tsx?|css)$/.test(f) && !f.includes(`seasonal${path.sep}christmas`)))
    assert.doesNotMatch(read(file), /^import (?!type )[^;]*from ['"][^'"]*christmas\/data\//m, file);
  // Every seasonal Data rule is scoped to the page root's season attribute, so off means exactly ordinary.
  const selectors = selectorsOf(read('src/seasonal/christmas/data/dataStore.css'));
  assert.ok(selectors.length > 60);
  for (const selector of selectors) assert.match(selector, /^\.mh-ds\[data-ds-season="christmas"\]/, selector);
  // The member checkout sheet gains the guest pack's bow through the shared shell, scoped to members.
  // 3.6.4: never on a serious sheet (paused, refused, closed or recovering checkout; a receipt needing help).
  assert.match(read('src/seasonal/christmas/shell/shell.css'), /\.mh-app\[data-season-shell="christmas"\]\[data-season-audience="member"\] \.mh-sheet:not\(\[data-rc-mood="serious"\], \[data-sheet-mood="serious"\]\)::after/);
});

test('the Data look follows the approved calendar and is off outside it', () => {
  const on = (date: string) => ({ shellActive: true, status: previewSeasonStatus('christmas-2026', date) });
  assert.deepEqual(dataStoreSeasonAttributes(on('2026-12-10')), { 'data-ds-season': 'christmas', 'data-ds-look': 'christmas', 'data-ds-phase': 'christmas-season' });
  assert.equal(dataStoreSeasonAttributes(on('2026-12-25'))['data-ds-look'], 'christmas-day');
  assert.equal(dataStoreSeasonAttributes(on('2026-12-26'))['data-ds-look'], 'christmas');
  for (const date of ['2026-12-27', '2026-12-31', '2027-01-01', '2027-01-05']) assert.equal(dataStoreSeasonAttributes(on(date))['data-ds-look'], 'new-year', date);
  // Off: no season applies (the server default), or it is 6 January, or no pack at all.
  assert.deepEqual(dataStoreSeasonAttributes({ shellActive: false, status: serverSeasonStatus(undefined) }), {});
  assert.deepEqual(dataStoreSeasonAttributes({ shellActive: false, status: serverSeasonStatus('christmas-2026', new Date('2027-01-06T00:00:00Z')) }), {});
  assert.equal(serverSeasonStatus('christmas-2026', new Date('2027-01-06T00:00:00Z')).active, false);
  assert.equal(dataStoreLook(previewSeasonStatus('christmas-2026', '2026-11-08')), 'christmas');
});

test('seasonal Data words are greetings only', () => {
  const words = JSON.stringify(DATA_LINE) + read('src/seasonal/christmas/data/ChristmasDataStore.tsx');
  assert.doesNotMatch(words, /discount|% off|\bfree\b|bonus|giveaway|prize|\bwin\b|guarantee|instant delivery|delivered in|faster|unlimited|\b\d+\+? (customers|users)/i);
  for (const line of Object.values(DATA_LINE)) assert.ok(line.length < 60, line);
});

test('guests and members: the journey line describes checkout, never chooses a recipient', () => {
  const hero = read('src/components/data/DataStoreHero.tsx');
  assert.match(hero, /No account needed\./);
  assert.match(hero, /user\.phone && isCompleteGhanaPhone\(user\.phone\) \? formatGhanaPhone\(user\.phone\) : ''/);
  assert.match(hero, /Change it there to send to someone else\./);
  assert.match(hero, /which you can change\./);
  assert.match(hero, /Enter the number you are buying for at checkout\./);
  // Airtime takes its number on the page, so in Airtime mode the line never names a checkout number.
  assert.match(hero, /mode === 'airtime' \? 'Airtime goes to the number you enter below\.'/);
  // 3.7 closeout: the hero also carries the Welcome Offer line (mysteryCloseout37.test.ts).
  assert.match(page, /<DataStoreHero mode=\{dataProductMode\} offer=\{/);
  assert.doesNotMatch(page, /Any Ghana number/);
  // Nothing is shown while the account is still being checked, and nothing is stored.
  assert.match(hero, /if \(isAuthChecking\) return/);
  assert.doesNotMatch(hero, /localStorage|sessionStorage/);
  // Airtime: the account's number is offered, never filled by itself, and cleared when the account changes.
  assert.match(page, /if \(previousAccount\.current && previousAccount\.current !== accountId\) \{ setAirtimePhone\(''\); setAirtimeErrors\(\{\}\); \}/);
  assert.match(page, /onClick=\{\(\) => \{ setAirtimePhone\(accountPhone\);[^\n]*document\.getElementById\('airtime-phone'\)\?\.focus\(\); \}\}/);
  assert.match(page, /useState\(''\);\n/);
});

// Checkout: the same lightweight harness as directCheckoutRecoveryUi, to read what the recipient field shows.
const compiled = transformSync(read('src/components/checkout/CheckoutModal.tsx'), { loader: 'tsx', format: 'cjs' }).code;
function checkout(user: any, initialPhone?: string) {
  const cells: any[] = [], effects: Array<() => void> = [], values = new Map<string, string>(); let cursor = 0;
  const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
  const context: any = { isCheckoutOpen: true, checkoutBundle: { id: 'mtn-1gb', network: 'mtn', serviceType: 'data', dataAmount: '1GB', priceGhc: 5.49, validity: 'Direct Credit' }, checkoutInitialPhone: initialPhone, user, sessionToken: user ? 'token-' + user.id : null, closeCheckout: () => {}, openOrderStatus: () => {}, createOrder: () => ({}), openDataPage: () => {} };
  const react: any = { createElement: (type: any, props: any, ...children: any[]) => ({ type, props: { ...props, children } }), useState: (initial: any) => { const i = cursor++; if (!(i in cells)) cells[i] = typeof initial === 'function' ? initial() : initial; return [cells[i], (v: any) => cells[i] = typeof v === 'function' ? v(cells[i]) : v]; }, useRef: (initial: any) => { const i = cursor++; return cells[i] ?? (cells[i] = { current: initial }); }, useEffect: (fn: any, deps: any[] = []) => { const i = cursor++, old = cells[i]; if (!old || deps.some((d, j) => !Object.is(d, old.deps[j]))) effects.push(() => { old?.cleanup?.(); cells[i] = { deps, cleanup: fn() }; }); } };
  const modules: any = { react, '../../hooks/useServiceStatus': { ...serviceStatusModule, useServiceStatus: () => serviceStatusModule.getServiceStatus(), refreshServiceStatus: async () => {} }, '../../../shared/serviceControls': serviceControlsModule, '../../../shared/checkoutFailure': failure, '../../utils/directCheckoutAttempt': attempts, '../../utils/checkoutRecovery': { ...recovery, savePendingCheckout: () => {}, clearPendingCheckout: () => {} }, '../../utils/dataPurchasePresentation': presentation, '../../utils/directQuotePresentation': quotePresentation, '../../../shared/money': money, '../../context/AppContext': { useApp: () => context }, '../../hooks/usePaystack': { usePaystack: () => ({ initializeServerPayment: async () => {}, isInitializing: false, loadingPhase: 'idle' }) }, '../../hooks/useDialogFocus': { useDialogFocus: () => ({ current: null }) }, '../../hooks/useVisualViewport': { useVisualViewport: () => ({ height: 850, top: 0 }) }, '../../services/commercialApi': { commercialRequest: async () => ({ regularMinor: 549, totalMinor: 549, discountMinor: 0, pricingRevision: 'f', promotionRevision: 'f', offer: { state: 'disabled' } }) }, '../../services/apiClient': { lookupOrderOnServer: async () => ({ success: false }), cancelPaymentOnServer: async () => {}, getInstantFlexiQuote: async () => ({}), getInstantBundlesOnServer: async () => ({ success: true, available: false, products: [] }), saveReceiptEmailOnServer: async () => ({}) }, '../../utils/receiptEmail': receiptEmail, '../../data/bundles': bundles, '../../config/business': { BUSINESS_CONFIG }, '../../utils/scroll': { smoothScrollToElement: () => {} }, '../../utils/instantBundleUtils': { getInstantBundlePresentation: () => null } };
  const module = { exports: {} as any };
  runInNewContext(compiled, { module, exports: module.exports, require: (name: string) => modules[name] ?? new Proxy({}, { get: (_t, key) => key === '__esModule' ? true : () => null }), crypto: { randomUUID }, sessionStorage: storage, setTimeout: () => 0, clearTimeout: () => {} });
  const render = () => { cursor = 0; const tree = module.exports.CheckoutModal(); while (effects.length) effects.shift()!(); return tree; };
  const nodes = (t: any): any[] => !t || typeof t !== 'object' ? [] : Array.isArray(t) ? t.flatMap(nodes) : [t, ...nodes(t.props?.children)];
  const flat = (t: any): string => !t ? '' : typeof t === 'string' || typeof t === 'number' ? String(t) : Array.isArray(t) ? t.map(flat).join('') : typeof t === 'object' ? flat(t.props?.children) : '';
  render();
  // Effects run after a render and their state lands on the next one, as in React: settle before reading.
  const settled = () => { render(); return render(); };
  return { render, context, phone: () => nodes(settled()).find(n => n.type === 'input' && n.props.id === 'checkout-phone'), changeButton: () => nodes(settled()).find(n => n.type === 'button' && flat(n) === 'Change number' && !n.props['aria-label']), label: () => flat(nodes(settled()).find(n => n.type === 'label' && n.props.htmlFor === 'checkout-phone')), help: () => flat(nodes(settled()).find(n => n.props?.id === 'checkout-phone-help')) };
}

test('member checkout starts with the account number, says so, and keeps it an ordinary editable field', () => {
  const ama = checkout({ id: 'ama', email: 'ama@example.test', phone: '+233241234567' });
  assert.equal(ama.phone().props.value, '024 123 4567');
  assert.equal(ama.phone().props.disabled, false);
  assert.match(ama.label(), /Send data to\s*· your account number/);
  assert.ok(ama.changeButton(), 'a Change number action is offered');
  assert.match(ama.help(), /This is the number on your account\. To send to someone else, change it before paying\./);
  // Typing another number removes the "your account number" claim at once.
  ama.phone().props.onChange({ target: { value: '0541112222' } });
  assert.equal(ama.phone().props.value, '054 111 2222');
  assert.doesNotMatch(ama.label(), /your account number/);
  assert.equal(ama.changeButton(), undefined);
  assert.match(ama.help(), /Check this number before paying/);
});

test('an explicitly chosen recipient, a member without a phone and a guest each get the right field', () => {
  const chosen = checkout({ id: 'ama', email: 'ama@example.test', phone: '+233241234567' }, '0550001111');
  assert.equal(chosen.phone().props.value, '055 000 1111');
  assert.match(chosen.label(), /the number you chose/);
  // Airtime's "Use my number" hands checkout the account's own number explicitly: it is still called the account number.
  const own = checkout({ id: 'ama', email: 'ama@example.test', phone: '+233241234567' }, '024 123 4567');
  assert.match(own.label(), /your account number/);
  const kofi = checkout({ id: 'kofi', email: null, phone: null });
  assert.equal(kofi.phone().props.value, '');
  assert.doesNotMatch(kofi.label(), /·/);
  assert.equal(kofi.changeButton(), undefined);
  const guest = checkout(null);
  assert.equal(guest.phone().props.value, '');
  assert.equal(guest.changeButton(), undefined);
  assert.match(guest.help(), /Check this number before paying/);
});

test('switching accounts never carries one customer\'s recipient into the next checkout', () => {
  const h = checkout({ id: 'ama', email: 'ama@example.test', phone: '+233241234567' });
  assert.equal(h.phone().props.value, '024 123 4567');
  h.context.user = { id: 'efua', email: 'efua@example.test', phone: '+233201112222' }; h.context.sessionToken = 'token-efua';
  assert.equal(h.phone().props.value, '020 111 2222');
  assert.match(h.label(), /your account number/);
  h.context.user = { id: 'kofi', email: null, phone: null }; h.context.sessionToken = 'token-kofi';
  assert.equal(h.phone().props.value, '');
  assert.doesNotMatch(h.label(), /account number/);
  h.context.user = null; h.context.sessionToken = null;
  assert.equal(h.phone().props.value, '');
});
