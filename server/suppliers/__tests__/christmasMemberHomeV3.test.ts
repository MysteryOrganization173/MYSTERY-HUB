import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemberHomeView, type MemberHomeViewProps } from '../../../src/components/home/MemberHomeView';
import { ChristmasMemberView, MEMBER_LINE, memberSignoff, orderWhen } from '../../../src/seasonal/christmas/member/ChristmasMemberView';
import { GREETINGS_ENTRY } from '../../../src/seasonal/christmas/kit/greetings';
import { memberOrderLabel, memberOrderNext, memberOrderSelection } from '../../../src/utils/memberHomePresentation';
import { previewSeasonStatus, type SeasonStatus } from '../../../shared/seasonal';
import type { AuthenticatedCustomerOrderDetails } from '../../types/orders';

/* The signed-in Christmas homepage (V3, refined in V4). It must present exactly the account truth the ordinary member
   homepage presents (same orders, states, labels, next steps and actions), only dressed for the season. */

const read = (file: string) => readFileSync(file, 'utf8');
const noop = () => {};
const order = (status: string, extra: Partial<AuthenticatedCustomerOrderDetails> = {}): AuthenticatedCustomerOrderDetails => ({ public_reference: 'MH-V3S2', network: 'mtn', product_name_snapshot: 'MTN 5GB', bundle_size_snapshot: '5GB', recipient_phone: '0240000000', amount: 2350, amount_ghc: 23.5, currency: 'GHS', status, created_at: '2026-12-09T10:00:00Z', paid_at: null, delivered_at: null, service_type: 'data', ...extra } as AuthenticatedCustomerOrderDetails);
const base: MemberHomeViewProps = { name: 'Ama', greeting: 'Good evening', orders: [], loading: false, error: false, assistant: noop, wallet: React.createElement('p', null, 'Wallet slot'), retry: noop, track: noop, actions: { data: noop, airtime: noop, website: noop, earn: noop, orders: noop, marketplace: noop, afa: noop, services: noop } };
const christmas = previewSeasonStatus('christmas-2026', '2026-12-10');
const ordinary = (extra: Partial<MemberHomeViewProps> = {}) => renderToStaticMarkup(React.createElement(MemberHomeView, { ...base, ...extra }));
const seasonal = (extra: Partial<MemberHomeViewProps> = {}, status: SeasonStatus = christmas, welcome?: React.ReactNode) => renderToStaticMarkup(React.createElement(ChristmasMemberView, { ...base, ...extra, status, welcome }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, '’').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

const SCENARIOS: Record<string, Partial<MemberHomeViewProps>> = {
  'new account': {},
  loading: { loading: true },
  'orders unavailable': { error: true },
  processing: { orders: [order('processing', { paid_at: '2026-12-09T10:01:00Z' })] },
  queued: { orders: [order('queued', { paid_at: '2026-12-09T10:01:00Z' })] },
  'awaiting payment': { orders: [order('pending_payment')] },
  failed: { orders: [order('failed')] },
  'manual review': { orders: [order('paid', { manual_review: true, paid_at: '2026-12-09T10:01:00Z' })] },
  delivered: { orders: [order('delivered', { paid_at: '2026-12-09T10:01:00Z', delivered_at: '2026-12-09T10:04:00Z' })] },
  'delivered airtime': { orders: [order('delivered', { service_type: 'airtime', product_name_snapshot: 'Airtime GH₵10', bundle_size_snapshot: undefined, amount: 1000, amount_ghc: 10 })] },
  refunded: { orders: [order('refunded')] },
  'active behind a newer delivered order': { orders: [order('processing', { public_reference: 'MH-OLD', created_at: '2026-12-08T09:00:00Z' }), order('delivered', { public_reference: 'MH-NEW' })] },
};
// Facts a customer reads on the ordinary member homepage; the seasonal one must say each of them exactly when it does.
const FACTS = ['Needs attention', 'Order to follow', 'Latest order', 'Start here', 'Your first order starts here.', 'Buy again', 'Track Order', 'WhatsApp support', 'Loading your orders…', 'Your orders are unavailable right now.', 'Try again', 'Open My Orders', 'Loading recent activity…', 'View all orders', 'Ask Mystery AI', 'Or top up airtime', 'Wallet slot', 'You’re all caught up. Other recent orders will appear here.'];

test('the seasonal member homepage tells the same order truth as the ordinary one, in every state', () => {
  for (const [name, props] of Object.entries(SCENARIOS)) {
    const o = text(ordinary(props)), s = text(seasonal(props));
    // V4: a brand-new account has no receipt of past orders to show (the first-purchase invitation sits there instead).
    const facts = name === 'new account' ? FACTS.filter(f => f !== 'View all orders') : FACTS;
    for (const fact of facts) assert.equal(s.includes(fact), o.includes(fact), `${name}: “${fact}”`);
    // The same status label, next step, subline, reference, amount and order of urgency.
    const { latest } = memberOrderSelection(props.orders || []);
    if (latest && !props.loading && !props.error) {
      assert.ok(s.includes(memberOrderLabel(latest)), `${name}: label`);
      for (const piece of [latest.public_reference, 'GH₵' + (latest.amount / 100).toFixed(2)]) assert.ok(s.includes(piece), `${name}: ${piece}`);
      if (!/Latest order/.test(o)) assert.ok(s.includes(memberOrderNext(latest).replace(/'/g, '’')) || s.includes(memberOrderNext(latest)), `${name}: next step`);
    }
    for (const sub of ['One of your orders needs attention.', 'You have an order in progress.', 'Your latest order is in progress.', 'Welcome to Mystery Hub. Let’s get you connected.', 'What would you like to do today?']) assert.equal(s.includes(sub), o.includes(sub), `${name}: subline ${sub}`);
    assert.equal(/is-urgent/.test(seasonal(props)), /is-urgent/.test(ordinary(props)), `${name}: urgency`);
    // Progress: the same steps lit, never Delivered ahead of the server.
    const lit = (html: string) => (html.match(/: complete</g) || []).length;
    assert.equal(lit(seasonal(props)), lit(ordinary(props)), `${name}: steps`);
  }
  // The new account's receipt is replaced, not lost: My Orders stays one tap away in the navigation, and nothing says
  // "recent activity" when there is none.
  assert.doesNotMatch(text(seasonal()), /Recent activity|Your account activity will appear/);
});

test('a problem is never dressed in celebration; the season line steps aside and nothing celebrates an order', () => {
  for (const props of [SCENARIOS.failed, SCENARIOS['manual review']]) {
    const html = seasonal(props);
    assert.match(html, /xm-order is-attention/);
    assert.doesNotMatch(html, /xm-welcome-season/, 'no seasonal line after “needs attention”');
    const card = html.slice(html.indexOf('xm-order is-attention'), html.indexOf('</section>', html.indexOf('xm-order is-attention')));
    assert.doesNotMatch(card, /xm-gift|xh-|xk-|confetti|spark/i, 'no festive material on the problem card');
    assert.match(card, /WhatsApp support/);
  }
  assert.match(seasonal(SCENARIOS.delivered), /Your digital world, wrapped for the season\./);
  for (const props of Object.values(SCENARIOS)) assert.doesNotMatch(seasonal(props), /confetti|firework|xh-fw|celebrat/i);
  assert.doesNotMatch(read('src/seasonal/christmas/member/member.css'), /confetti|firework/i);
});

test('website none / draft / published name the next step; Earn and the Greetings preview speak truthfully', () => {
  assert.match(text(seasonal()), /Website Builder Free plan Create or manage your free website Open Website Builder/);
  assert.match(text(seasonal({ website: { state: 'none' } })), /Create a free website Free plan Show your business or sell data online Start building/);
  const draft = seasonal({ website: { state: 'draft', name: 'Ama Data Hub', slug: 'ama-data-hub' } });
  assert.match(text(draft), /Finish your website Draft Ama Data Hub · not published yet Continue editing/);
  assert.match(draft, /aria-label="Continue your website, Ama Data Hub"/);
  assert.match(draft, /data-state="draft"/);
  const live = seasonal({ website: { state: 'published', name: 'Ama Data Hub', slug: 'ama-data-hub' } });
  assert.match(text(live), /Your website is live Live Ama Data Hub \/sites\/ama-data-hub Manage website/);
  assert.match(live, /xm-tile-website is-published/);
  // Only a published site shows an address; a draft never pretends to be public.
  assert.doesNotMatch(draft, /\/sites\//);
  // Earn promises no money; the Greetings preview has no control that pretends to create anything.
  const html = seasonal(SCENARIOS.delivered);
  assert.match(text(html), /Share your link\. Earn when friends’ purchases qualify\./);
  assert.doesNotMatch(text(html), /guaranteed|per referral|free money|win GH₵/i);
  const teaser = html.slice(html.indexOf('class="xk-greet"'), html.indexOf('</section>', html.indexOf('class="xk-greet"')));
  assert.match(text(teaser), /Coming soon Mystery Greetings/);
  assert.match(text(teaser), /Choose a design.*Write your message.*Share the link/);
  assert.match(text(teaser), /Not open yet\./);
  assert.doesNotMatch(teaser, /<button|<a /, 'the preview is not an action while the feature is closed');
});

test('Mystery Greetings: one honest entry for guests and members, no endpoint that main does not have', () => {
  assert.deepEqual(GREETINGS_ENTRY, { state: 'coming-soon' });
  const kit = read('src/seasonal/christmas/kit/GreetingsPreview.tsx');
  // The entry takes no account data, so the same component serves a guest page and a member page.
  assert.doesNotMatch(kit, /useApp|sessionToken|user\b|fetch\(|apiClient/);
  assert.match(kit, /entry\.state === 'open'\s*\? <a className="xk-greet-cta" href=\{entry\.createHref\}>/);
  // PR #104's API is not on main: nothing in the app calls it yet.
  const files: string[] = [];
  const walk = (dir: string) => { for (const name of readdirSync(dir)) { const p = path.join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(name)) files.push(p); } };
  walk('src');
  const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const file of files) assert.doesNotMatch(code(read(file)), /\/api\/experiences/, file);
});

test('greetings follow the calendar: each day of the season has its own line, gift and sign-off, by name', () => {
  const at = (date: string) => text(seasonal(SCENARIOS.delivered, previewSeasonStatus('christmas-2026', date)));
  const html = (date: string) => seasonal(SCENARIOS.delivered, previewSeasonStatus('christmas-2026', date));
  assert.match(at('2026-12-10'), /Your digital world, wrapped for the season\..*15 days until Christmas.*Wishing you a wonderful Christmas, Ama\./);
  assert.match(at('2026-12-24'), /Tomorrow is Christmas Day/);
  assert.match(at('2026-12-25'), /Merry Christmas! Today is for the people you love\..*Today is Christmas Day.*Merry Christmas, Ama\./);
  assert.match(at('2026-12-26'), /Happy Boxing Day\. Rest, visit and keep in touch\..*Today is Boxing Day.*Happy Boxing Day, Ama\./);
  assert.match(at('2026-12-31'), /Tonight we welcome 2027 together\..*Tonight we welcome 2027.*See you in 2027, Ama\./);
  assert.match(at('2027-01-01'), /Happy New Year! A bright start to 2027\..*2027 Happy New Year.*Happy New Year, Ama!/);
  assert.match(at('2027-01-03'), /ready for the new year\..*Wishing you a happy New Year, Ama\./);
  // The gift: open with light inside on Christmas Day, midnight and silver from 27 December; a tag with their name.
  assert.match(html('2026-12-25'), /data-look="christmas-day"/);
  assert.match(html('2026-12-10'), /data-look="christmas"/);
  assert.match(html('2027-01-01'), /data-look="new-year"/);
  assert.match(text(html('2026-12-10')), /For Ama/);
  for (const phase of Object.keys(MEMBER_LINE)) assert.ok(MEMBER_LINE[phase as keyof typeof MEMBER_LINE].length > 10);
  assert.equal(memberSignoff('boxing-day', 'Kofi'), 'Happy Boxing Day, Kofi.');
  // The logo hat is Christmas-only; from 27 December the logo goes back to plain.
  assert.match(read('src/seasonal/christmas/shell/ChristmasShell.tsx'), /case 'logo-hat': return isChristmasPhase\(status\.phase\) \? <LogoHat \/> : null;/);
});

test('orders read clearly: the real network, number, reference and time, in the customer’s own clock', () => {
  const now = new Date(2026, 11, 10, 18, 0);
  assert.match(orderWhen(new Date(2026, 11, 10, 10, 42).toISOString(), now), /^Today, 10:42$/);
  assert.match(orderWhen(new Date(2026, 11, 9, 18, 5).toISOString(), now), /^Yesterday, 18:05$/);
  assert.equal(orderWhen(new Date(2026, 11, 3, 9, 0).toISOString(), now), '3 Dec');
  assert.equal(orderWhen(null, now), '');
  assert.equal(orderWhen('not a date', now), '');
  const html = seasonal(SCENARIOS.processing);
  assert.match(html, /<time dateTime="2026-12-09T10:00:00Z">/);
  assert.match(text(html), /MTN · 0240000000 · MH-V3S2/);
  const receipt = seasonal({ orders: [order('delivered', { public_reference: 'MH-A' }), order('delivered', { public_reference: 'MH-B', created_at: '2026-12-01T10:00:00Z', network: 'telecel' })] });
  assert.match(text(receipt), /Recent activity View all orders .*MH-B/);
});

test('the seasonal member homepage reads no account data of its own and can start no payment', () => {
  const view = read('src/seasonal/christmas/member/ChristmasMemberView.tsx');
  const home = read('src/seasonal/christmas/member/ChristmasMemberHome.tsx');
  const market = read('src/seasonal/christmas/member/useMarketPreview.ts');
  for (const source of [view, home]) {
    assert.doesNotMatch(source, /fetch\(|apiClient|financeApi|financeRequest|commercialApi|getAccountOrders|getMyWebsites|paystack|checkout|walletCheckout|localStorage|sessionStorage/i);
  }
  // The one new read is public: featured products from the Marketplace catalogue, with no account in the request.
  assert.match(market, /import \{ getPublicMarketplaceProducts \} from '\.\.\/\.\.\/\.\.\/services\/apiClient';/);
  assert.doesNotMatch(market, /sessionToken|useApp|Authorization|getAccountOrders|getMyWebsites|financeRequest|checkout/);
  assert.match(market, /getPublicMarketplaceProducts\(\{ featured: true \}\)/);
  // The same presentation helpers as the ordinary view (one source of truth for tones, steps, labels and Buy again).
  assert.match(view, /import \{ memberOrderLabel, memberOrderNext, memberOrderSelection, memberOrderSteps, memberOrderTone, memberReorder \} from '\.\.\/\.\.\/\.\.\/utils\/memberHomePresentation';/);
  assert.match(view, /import \{ NETWORKS, orderTitle, websiteCard, type MemberHomeViewProps \} from '\.\.\/\.\.\/\.\.\/components\/home\/MemberHomeView';/);
  // The welcome-offer quote is read only for a customer without orders.
  assert.match(home, /const firstPurchase = !view\.loading && !view\.error && view\.orders\.length === 0;/);
  assert.match(home, /welcome=\{firstPurchase \? <MemberWelcomeOffer \/> : undefined\}/);
  assert.match(home, /<WelcomeCard offer=\{offer\} bundles=\{bundles\} catalogConfirmed=\{directCatalogConfirmed\(\)\} headingId="xm-welcome-offer" \/>/);
});

test('signed-in wiring: one data owner, lazy seasonal view, ordinary view as fallback, no flicker while signing in', () => {
  const member = read('src/components/home/MemberHome.tsx');
  assert.match(member, /return <SeasonalMemberHome view=\{view\} fallback=\{<MemberHomeView \{\.\.\.view\}\/>\}\/>;/);
  assert.match(member, /<MemberDashboard key=\{sessionToken\}\/>/, 'a different account gets a fresh dashboard');
  const seasonalTsx = read('src/seasonal/Seasonal.tsx');
  assert.match(seasonalTsx, /const loadMemberHome = retryOnce\(\(\) => import\('\.\/christmas\/member\/ChristmasMemberHome'\)\);/);
  assert.match(seasonalTsx, /if \(!season\.memberActive \|\| season\.status\.pack !== 'christmas-2026'\) return <>\{fallback\}<\/>;/);
  assert.match(seasonalTsx, /<SeasonalBoundary fallback=\{fallback\}><Suspense fallback=\{<div className="mh-season-home-wait is-member" aria-busy="true" \/>\}><ChristmasMemberHome view=\{view\} status=\{season\.status\} \/><\/Suspense><\/SeasonalBoundary>/);
  assert.match(seasonalTsx, /if \(season\.heldForSignedIn && page === 'home'\) void loadMemberHome\(\)/);
  assert.match(seasonalTsx, /if \(season\.active && isAuthModalOpen\) void loadMemberHome\(\)/);
  const homePage = read('src/components/home/HomePage.tsx');
  assert.match(homePage, /if \(season\.shellActive\) return <div className="mh-season-home-wait is-member" aria-busy="true">/);
  const provider = read('src/seasonal/SeasonProvider.tsx');
  assert.match(provider, /memberActive: status\.active && signedIn/);
  assert.match(provider, /const signedIn = Boolean\(user\) && !isAuthChecking;/);
});

test('phones: while an order leads, the two purchases stay on the first screen; nothing replays or restarts', () => {
  const css = read('src/seasonal/christmas/member/member.css');
  const phone = css.slice(css.indexOf('@media (max-width: 767px) {'));
  assert.match(phone, /\.xm-dash\.is-urgent \.xm-buy-tile \{ flex-direction: row;/);
  assert.match(css, /\.xm-dash\.is-urgent \.xm-spot \{ order: 1; \}/);
  const view = read('src/seasonal/christmas/member/ChristmasMemberView.tsx');
  // A tap on the gift while it is still playing is ignored rather than restarting it.
  assert.match(view, /const giftPress = \(e: React\.PointerEvent<HTMLElement>\) => \{ if \(!e\.currentTarget\.hasAttribute\('data-press'\)\) press\(e\); \};/);
  // Product pictures fade in only the first time they arrive in a visit.
  assert.match(read('src/seasonal/christmas/member/useMarketPreview.ts'), /let cache: MarketplaceProduct\[\] \| null = null;/);
  assert.match(css, /\.xm-photos\.is-fresh \.xm-photo \{ animation:/);
});

test('member styles stay in their own xm- namespace with transform/opacity motion and a full reduced-motion stop', () => {
  const css = read('src/seasonal/christmas/member/member.css');
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = clean.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').replace(/@media[^{]+\{/g, '').match(/[^{}]+\{[^{}]*\}/g) || [];
  const selectors: string[] = [];
  for (const rule of rules) {
    let depth = 0, current = '';
    for (const ch of rule.slice(0, rule.indexOf('{'))) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { selectors.push(current.trim()); current = ''; } else current += ch; }
    selectors.push(current.trim());
  }
  assert.ok(selectors.length > 150);
  for (const selector of selectors.filter(Boolean)) assert.match(selector, /^\.xm-[a-z]/, selector);
  for (const [, name, body] of clean.matchAll(/@keyframes ([\w-]+) \{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)) {
    assert.match(name, /^(xm-|xh-press-xm-)/, name);
    for (const [, prop] of body.matchAll(/([a-z-]+)\s*:/g)) assert.ok(['transform', 'opacity'].includes(prop), `${name} animates ${prop}`);
  }
  for (const [, value] of clean.matchAll(/transition:\s*([^;]+);/g)) assert.match(value, /^(transform [^,]+|none !important)$/, value);
  // Endless loops: the live-status dot and the loading shimmer (status, not decoration), and desktop-only idle light.
  const loops = clean.split('\n').filter(line => /infinite/.test(line));
  for (const line of loops) assert.match(line, /^\s*(\.xm-live-dot::after|\.xm-skeleton::after|\.xm-welcome\[data-xh-done\] (\.xm-gift|\.xm-bulb))/, line);
  const idle = clean.slice(clean.indexOf('@media (min-width: 900px) and (hover: hover) and (prefers-reduced-motion: no-preference) {'));
  assert.ok(idle.includes('xm-twinkle 4.5s') && idle.includes('xm-glow 5s'), 'idle light lives only in the capable-desktop block');
  assert.match(clean, /@media \(prefers-reduced-motion: reduce\) \{\s*\.xm-home \*, \.xm-home \*::before, \.xm-home \*::after \{ animation: none !important; transition: none !important; \}/);
  assert.match(read('src/seasonal/christmas/member/ChristmasMemberHome.tsx'), /useReveal\(root, 'member'\);/);
  assert.match(read('src/seasonal/christmas/shell/shell.css'), /\.mh-app\[data-season-shell="christmas"\]:has\(\.xm-home\) > main \{ padding-bottom: 0; background: #050d0a; \}/);
  // The kit's Greetings styles keep transform-only transitions and stop with reduced motion.
  const kit = read('src/seasonal/christmas/kit/kit.css');
  for (const [, value] of kit.matchAll(/transition:\s*([^;]+);/g)) assert.match(value, /^(transform [\d.]+m?s( (ease|linear|cubic-bezier\([^)]*\)))?|none)$/, value);
  assert.match(kit, /@media \(prefers-reduced-motion: reduce\) \{ \.xk-env-letter \{ transition: none; \} \}/);
});
