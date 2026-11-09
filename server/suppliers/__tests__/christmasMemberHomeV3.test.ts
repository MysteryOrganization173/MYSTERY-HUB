import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemberHomeView, type MemberHomeViewProps } from '../../../src/components/home/MemberHomeView';
import { ChristmasMemberView } from '../../../src/seasonal/christmas/member/ChristmasMemberView';
import { memberOrderLabel, memberOrderNext, memberOrderSelection } from '../../../src/utils/memberHomePresentation';
import { previewSeasonStatus, type SeasonStatus } from '../../../shared/seasonal';
import type { AuthenticatedCustomerOrderDetails } from '../../types/orders';

/* V3 Stage 2: the signed-in Christmas homepage. It must present exactly the account truth the ordinary member homepage
   presents (same orders, states, labels, next steps and actions), only dressed for the season. */

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
const FACTS = ['Needs attention', 'Order to follow', 'Latest order', 'Start here', 'Your first order starts here.', 'Buy again', 'Track Order', 'WhatsApp support', 'Loading your orders…', 'Your orders are unavailable right now.', 'Try again', 'Open My Orders', 'Loading recent activity…', 'View all orders', 'Ask Mystery AI', 'Or top up airtime', 'Wallet slot', 'Your account activity will appear after your first purchase.', 'You’re all caught up. Other recent orders will appear here.'];

test('the seasonal member homepage tells the same order truth as the ordinary one, in every state', () => {
  for (const [name, props] of Object.entries(SCENARIOS)) {
    const o = text(ordinary(props)), s = text(seasonal(props));
    for (const fact of FACTS) assert.equal(s.includes(fact), o.includes(fact), `${name}: “${fact}”`);
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
});

test('a problem is never dressed in celebration; the season line steps aside and nothing celebrates an order', () => {
  for (const props of [SCENARIOS.failed, SCENARIOS['manual review']]) {
    const html = seasonal(props);
    assert.match(html, /xm-order is-attention/);
    assert.doesNotMatch(html, /xm-welcome-season/, 'no seasonal line after “needs attention”');
    const card = html.slice(html.indexOf('xm-order is-attention'), html.indexOf('</section>', html.indexOf('xm-order is-attention')));
    assert.doesNotMatch(card, /xm-gift|xh-|xk-|confetti|spark/i, 'no festive material on the problem card');
  }
  assert.match(seasonal(SCENARIOS.delivered), /Your digital world, wrapped for the season\./);
  for (const props of Object.values(SCENARIOS)) assert.doesNotMatch(seasonal(props), /confetti|firework|xh-fw|celebrat/i);
  assert.doesNotMatch(read('src/seasonal/christmas/member/member.css'), /confetti|firework/i);
});

test('website none / draft / published, Earn and the teaser speak truthfully', () => {
  assert.match(text(seasonal()), /Website Builder Free plan Create or manage your free website/);
  assert.match(text(seasonal({ website: { state: 'none' } })), /Create a free website Free plan Show your business or sell data online/);
  const draft = seasonal({ website: { state: 'draft', name: 'Ama Data Hub', slug: 'ama-data-hub' } });
  assert.match(text(draft), /Finish your website Draft Ama Data Hub · not published yet/);
  assert.match(draft, /aria-label="Continue your website, Ama Data Hub"/);
  const live = seasonal({ website: { state: 'published', name: 'Ama Data Hub', slug: 'ama-data-hub' } });
  assert.match(text(live), /Your website is live Live Ama Data Hub/);
  assert.match(live, /xm-tile-website is-published/);
  // Earn promises no money; the Greetings preview has no button that pretends to create anything.
  const html = seasonal(SCENARIOS.delivered);
  assert.match(text(html), /Share your link\. Earn when friends’ purchases qualify\./);
  assert.doesNotMatch(text(html), /guaranteed|per referral|free money|win GH₵/i);
  const teaser = html.slice(html.indexOf('class="xm-greet"'), html.indexOf('</section>', html.indexOf('class="xm-greet"')));
  assert.match(text(teaser), /Coming soon Mystery Greetings/);
  assert.match(text(teaser), /Not open yet\./);
  assert.doesNotMatch(teaser, /<button|<a /, 'the teaser is a preview, not an action');
});

test('greetings follow the calendar: Christmas through Boxing Day, then New Year, with the customer’s own name', () => {
  const at = (date: string) => text(seasonal(SCENARIOS.delivered, previewSeasonStatus('christmas-2026', date)));
  assert.match(at('2026-12-10'), /15 days until Christmas/);
  assert.match(at('2026-12-24'), /Tomorrow is Christmas Day/);
  assert.match(at('2026-12-25'), /Today is Christmas Day.*Wishing you a wonderful Christmas, Ama\./);
  assert.match(at('2026-12-26'), /Today is Boxing Day/);
  assert.match(at('2026-12-31'), /ready for the new year\..*Tonight we welcome 2027.*Wishing you a happy New Year, Ama\./);
  assert.match(at('2027-01-01'), /2027 Happy New Year/);
  assert.match(at('2027-01-03'), /Wishing you a happy New Year, Ama\./);
  assert.match(seasonal(SCENARIOS.delivered, previewSeasonStatus('christmas-2026', '2027-01-01')), /data-phase="new-years-day"/);
  // The logo hat is Christmas-only; from 27 December the logo goes back to plain.
  assert.match(read('src/seasonal/christmas/shell/ChristmasShell.tsx'), /case 'logo-hat': return isChristmasPhase\(status\.phase\) \? <LogoHat \/> : null;/);
});

test('the seasonal member homepage reads no account data of its own and can start no payment', () => {
  const view = read('src/seasonal/christmas/member/ChristmasMemberView.tsx');
  const home = read('src/seasonal/christmas/member/ChristmasMemberHome.tsx');
  for (const source of [view, home]) {
    assert.doesNotMatch(source, /fetch\(|apiClient|financeApi|financeRequest|commercialApi|getAccountOrders|getMyWebsites|paystack|checkout|walletCheckout|localStorage|sessionStorage/i);
  }
  // The same presentation helpers as the ordinary view (one source of truth for tones, steps, labels and Buy again).
  assert.match(view, /import \{ memberOrderLabel, memberOrderNext, memberOrderSelection, memberOrderSteps, memberOrderTone, memberReorder \} from '\.\.\/\.\.\/\.\.\/utils\/memberHomePresentation';/);
  assert.match(view, /import \{ NETWORKS, orderTitle, websiteCard, type MemberHomeViewProps \} from '\.\.\/\.\.\/\.\.\/components\/home\/MemberHomeView';/);
  // The only extra read is the existing welcome-offer quote, and only for a customer without orders.
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
  // Preloaded while a returning customer's session is checked, and when a guest opens Sign in / Create account.
  assert.match(seasonalTsx, /if \(season\.heldForSignedIn && page === 'home'\) void loadMemberHome\(\)/);
  assert.match(seasonalTsx, /if \(season\.active && isAuthModalOpen\) void loadMemberHome\(\)/);
  // While the session is checked with a season on, the season's placeholder holds the page (no ordinary skeleton).
  const homePage = read('src/components/home/HomePage.tsx');
  assert.match(homePage, /if \(season\.shellActive\) return <div className="mh-season-home-wait is-member" aria-busy="true">/);
  const provider = read('src/seasonal/SeasonProvider.tsx');
  assert.match(provider, /memberActive: status\.active && signedIn/);
  assert.match(provider, /const signedIn = Boolean\(user\) && !isAuthChecking;/);
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
  assert.ok(selectors.length > 120);
  for (const selector of selectors.filter(Boolean)) assert.match(selector, /^\.xm-[a-z]/, selector);
  for (const [, name, body] of clean.matchAll(/@keyframes ([\w-]+) \{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)) {
    assert.match(name, /^(xm-|xh-press-xm-)/, name);
    for (const [, prop] of body.matchAll(/([a-z-]+)\s*:/g)) assert.ok(['transform', 'opacity'].includes(prop), `${name} animates ${prop}`);
  }
  for (const [, value] of clean.matchAll(/transition:\s*([^;]+);/g)) assert.match(value, /^(transform [^,]+|none !important)$/, value);
  // Endless loops: the live-status dot and the loading shimmer (status, not decoration), and desktop-only idle light.
  const loops = clean.split('\n').filter(line => /infinite/.test(line));
  for (const line of loops) assert.match(line, /^\s*(\.xm-live-dot::after|\.xm-skeleton::after|\.xm-welcome\[data-xh-done\] \.xm-gift)/, line);
  const idle = clean.slice(clean.indexOf('@media (min-width: 900px) and (hover: hover) and (prefers-reduced-motion: no-preference) {'));
  assert.ok(idle.includes('xm-twinkle 4.5s'), 'the idle twinkle lives only in the capable-desktop block');
  assert.match(clean, /@media \(prefers-reduced-motion: reduce\) \{\s*\.xm-home \*, \.xm-home \*::before, \.xm-home \*::after \{ animation: none !important; transition: none !important; \}/);
  // Entrances once per visit through the kit, and the shell joins the sign-off to the footer for members too.
  assert.match(read('src/seasonal/christmas/member/ChristmasMemberHome.tsx'), /useReveal\(root, 'member'\);/);
  assert.match(read('src/seasonal/christmas/shell/shell.css'), /\.mh-app\[data-season-shell="christmas"\]:has\(\.xm-home\) > main \{ padding-bottom: 0; background: #050d0a; \}/);
});
