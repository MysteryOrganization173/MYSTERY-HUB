import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { seasonalRouter } from '../../routes/seasonalApi.js';
import {
  CHRISTMAS_2026, accraDate, isLivePhase, parsePreviewDate, parseSeasonSetting, previewSeasonStatus, seasonPhase, serverSeasonStatus,
} from '../../../shared/seasonal.js';
import { GREETING, HERO_LINE, PAGE_LINE, SHARE_TEXT, seasonCountdown } from '../../../src/seasonal/christmas/copy.js';

const read = (file: string) => readFileSync(file, 'utf8');
const at = (iso: string) => new Date(iso);

let server: Server, base: string;
before(async () => {
  const app = express(); app.use('/api/seasonal', seasonalRouter);
  server = await new Promise<Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => { delete process.env.SEASONAL_EXPERIENCE; await new Promise<void>(resolve => server.close(() => resolve())); });

test('the approved calendar, by Accra day, with Christmas Day and Boxing Day kept distinct', () => {
  const cases: [string, string][] = [
    ['2026-11-30', 'before'], ['2026-12-01', 'christmas-season'], ['2026-12-24', 'christmas-season'], ['2026-12-25', 'christmas-day'],
    ['2026-12-26', 'boxing-day'], ['2026-12-27', 'year-end'], ['2026-12-30', 'year-end'], ['2026-12-31', 'new-years-eve'],
    ['2027-01-01', 'new-years-day'], ['2027-01-02', 'new-year'], ['2027-01-05', 'new-year'], ['2027-01-06', 'after'],
  ];
  for (const [date, phase] of cases) assert.equal(seasonPhase(date, CHRISTMAS_2026), phase, date);
  // Ghana keeps UTC all year: 23:59 UTC on 24 December is still Christmas Eve in Accra, 00:00 is Christmas Day.
  assert.equal(accraDate(at('2026-12-24T23:59:59Z')), '2026-12-24');
  assert.equal(accraDate(at('2026-12-25T00:00:00Z')), '2026-12-25');
  assert.equal(accraDate(at('2027-01-05T23:59:59Z')), '2027-01-05');
  assert.ok(!isLivePhase('before') && !isLivePhase('after') && isLivePhase('christmas-day'));
});

test('the server is off by default and only an exact known pack inside its dates turns it on', () => {
  for (const setting of [undefined, '', 'on', 'true', 'christmas', 'christmas-2027', ' CHRISTMAS-2026x', 1]) {
    const status = serverSeasonStatus(setting, at('2026-12-25T10:00:00Z'));
    assert.equal(status.active, false, String(setting));
    assert.equal(status.pack, null);
    assert.equal(status.source, 'off');
  }
  assert.equal(parseSeasonSetting(' Christmas-2026 '), 'christmas-2026', 'case and spaces are forgiven, nothing else is');
  const on = serverSeasonStatus('christmas-2026', at('2026-12-10T08:00:00Z'));
  assert.deepEqual({ active: on.active, pack: on.pack, phase: on.phase, daysToChristmas: on.daysToChristmas, source: on.source }, { active: true, pack: 'christmas-2026', phase: 'christmas-season', daysToChristmas: 15, source: 'server' });
  // Outside the window the setting does nothing: the normal appearance returns on 6 January without anyone acting.
  assert.equal(serverSeasonStatus('christmas-2026', at('2026-11-08T12:00:00Z')).active, false);
  assert.equal(serverSeasonStatus('christmas-2026', at('2027-01-06T00:00:00Z')).active, false);
  assert.equal(serverSeasonStatus('christmas-2026', at('2027-01-05T23:59:00Z')).active, true);
});

test('a founder preview is its own status and only accepts reviewable dates', () => {
  const early = previewSeasonStatus('christmas-2026', '2026-11-08');
  assert.equal(early.source, 'preview');
  assert.equal(early.phase, 'christmas-season', 'a preview before 1 December shows the Christmas season');
  assert.equal(early.daysToChristmas, 47, 'with the real countdown');
  assert.equal(previewSeasonStatus('christmas-2026', '2026-12-26').phase, 'boxing-day');
  assert.equal(previewSeasonStatus('christmas-2026', '2027-01-08').phase, 'new-year');
  for (const bad of ['2026-02-30', '2026-10-31', '2027-01-11', 'tomorrow', '', null, '2026-12-25T00:00']) assert.equal(parsePreviewDate(bad), null, String(bad));
  assert.equal(parsePreviewDate('2026-12-25'), '2026-12-25');
});

test('the status route is public, read-only, cacheable and off without the setting', async () => {
  delete process.env.SEASONAL_EXPERIENCE;
  const res = await fetch(`${base}/api/seasonal/status`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=300');
  const body = await res.json();
  assert.deepEqual(Object.keys(body).sort(), ['active', 'date', 'daysToChristmas', 'daysToNewYear', 'pack', 'phase', 'source']);
  assert.equal(body.active, false);
  assert.equal(body.pack, null);
  // Nothing a visitor sends can switch it on: no write route exists and query strings are ignored.
  assert.equal((await fetch(`${base}/api/seasonal/status?season-preview=christmas-2026`).then(r => r.json())).active, body.active);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal((await fetch(`${base}/api/seasonal/status`, { method })).status, 404, method);
  // With the setting, the answer follows today's Accra calendar (before 1 December it is still off).
  process.env.SEASONAL_EXPERIENCE = 'christmas-2026';
  const configured = await (await fetch(`${base}/api/seasonal/status`)).json();
  assert.equal(configured.active, serverSeasonStatus('christmas-2026').active);
  delete process.env.SEASONAL_EXPERIENCE;
});

test('the season reaches only the signed-out customer shell, never Admin, the editor, My Business or published sites', () => {
  const app = read('src/App.tsx');
  const shell = app.slice(app.indexOf('return (\n    <div className="mh-app'));
  const earlier = app.slice(0, app.indexOf('return (\n    <div className="mh-app'));
  assert.match(shell, /<div className="mh-app[^>]*\{\.\.\.seasonShellAttributes\(season, activePage\)\}/);
  assert.doesNotMatch(earlier.slice(earlier.indexOf("activePage === 'editor'")), /seasonShellAttributes|SeasonalShellLayer|<Seasonal/, 'editor, Admin and My Business return without the season');
  const provider = read('src/seasonal/SeasonProvider.tsx');
  assert.match(provider, /const signedOut = !user && !isAuthChecking;/);
  assert.match(provider, /active: status\.active && signedOut/);
  assert.match(provider, /if \(!season\.active \|\| !season\.status\.pack\) return \{\};/);
  // Published sites, template previews, the editor and Admin never use a seasonal slot.
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  for (const file of [...walk('src/components/admin'), ...walk('src/components/website/templates').filter(f => f.endsWith('.tsx')), 'src/components/website/PublicPublishedSite.tsx', 'src/components/website/IsolatedTemplatePreview.tsx', 'src/components/website/WebsiteEditorPage.tsx']) {
    if (file.endsWith('AdminSeasonalPanel.tsx')) continue;
    assert.doesNotMatch(read(file), /seasonal\/Seasonal|<Seasonal /, file);
  }
});

test('every Christmas style is scoped to the seasonal shell, so switching off restores the normal appearance', () => {
  const css = read('src/seasonal/christmas/christmas.css').replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove keyframes, then check the selector of every remaining rule.
  const rules = css.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').replace(/@media[^{]+\{/g, '').match(/[^{}]+\{[^{}]*\}/g) || [];
  assert.ok(rules.length > 80);
  for (const rule of rules) {
    // Split on top-level commas only (commas inside :is(...) belong to one selector).
    const selectors: string[] = []; let depth = 0, current = '';
    for (const ch of rule.slice(0, rule.indexOf('{'))) {
      if (ch === '(') depth++; if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { selectors.push(current.trim()); current = ''; } else current += ch;
    }
    selectors.push(current.trim());
    for (const selector of selectors.filter(Boolean)) {
      assert.match(selector, /^\.mh-app\[data-season="christmas"\]/, selector);
      // Bare element selectors could reach Website Builder template previews rendered inside the shell.
      assert.doesNotMatch(selector, /\] (header|footer|main|section|nav|button|a|img|h[1-6])\b/, selector);
    }
  }
  // The pack (artwork + stylesheet) is only ever loaded lazily, so normal visitors never download it.
  const imports = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? imports(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  for (const file of imports('src').filter(f => /\.(tsx?|css)$/.test(f) && !f.includes(`seasonal${path.sep}christmas`))) {
    // Type-only imports are erased by the compiler and load nothing.
    assert.doesNotMatch(read(file), /^import (?!type )[^;]*from ['"][^'"]*christmas\/(ChristmasPack|art|christmas\.css|home\/[^'"]*)['"]|^import ['"][^'"]*(christmas|christmasHome)\.css['"]/m, file);
  }
  assert.match(read('src/seasonal/Seasonal.tsx'), /lazy\(loadChristmas\)/);
  assert.match(read('src/seasonal/Seasonal.tsx'), /import type \{ ChristmasSlot \} from '\.\/christmas\/ChristmasPack'/);
  // Reduced motion stops every animation the pack adds.
  assert.match(read('src/seasonal/christmas/christmas.css'), /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important/);
});

test('seasonal words are greetings only: no offers, discounts, delivery promises or invented numbers', () => {
  const words = JSON.stringify({ GREETING, HERO_LINE, PAGE_LINE, SHARE_TEXT }) + read('src/seasonal/christmas/ChristmasPack.tsx');
  assert.doesNotMatch(words, /discount|% off|\bfree data\b|bonus|giveaway|prize|win\b|guarantee|instant delivery|delivered in|customers served|\b\d+\+? (customers|users)/i);
  assert.equal(seasonCountdown(previewSeasonStatus('christmas-2026', '2026-12-10')).big, '15 days');
  assert.equal(seasonCountdown(previewSeasonStatus('christmas-2026', '2026-12-24')).big, 'Tomorrow');
  assert.equal(seasonCountdown(previewSeasonStatus('christmas-2026', '2026-12-25')).small, 'is Christmas Day');
  assert.equal(seasonCountdown(previewSeasonStatus('christmas-2026', '2026-12-26')).small, 'is Boxing Day');
  assert.equal(seasonCountdown(previewSeasonStatus('christmas-2026', '2026-12-29')).big, '3 days');
  assert.notEqual(GREETING['christmas-day'], GREETING['boxing-day']);
});

test('checkout stays untouched: decoration only, and celebration only for an order the server reports delivered', () => {
  const checkout = read('src/components/checkout/CheckoutModal.tsx');
  const status = read('src/components/checkout/OrderStatusModal.tsx');
  assert.doesNotMatch(checkout, /seasonal|Seasonal/, 'the payment component is not modified at all; its ribbon is drawn in CSS');
  assert.match(status, /\{activeOrder\.serverStatus === 'delivered' && <Seasonal slot="celebrate" \/>\}/);
  assert.equal((status.match(/<Seasonal /g) || []).length, 1, 'no celebration for paid, queued, processing or pending payments');
  const css = read('src/seasonal/christmas/christmas.css');
  assert.match(css, /\.mh-app\[data-season="christmas"\] \.mh-sheet::after \{[^}]*pointer-events: none/);
  const pack = read('src/seasonal/christmas/ChristmasPack.tsx');
  assert.doesNotMatch(pack, /initializePayment|paystack|setActivePage\(|openCheckout|fetch\(/i, 'the pack performs no commerce or network action');
});

/* ───────── The Christmas homepage (signed-out visitors, season on) ───────── */

const HOME_DIR = 'src/seasonal/christmas/home';
/** What the homepage files say and do, without their code comments. */
const homeSource = () => ['ChristmasHome.tsx', 'heroArt.tsx', 'homeArt.tsx'].map(f => read(`${HOME_DIR}/${f}`)).join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** Every selector of every rule in a stylesheet, with keyframes and @media wrappers removed. */
function selectorsOf(cssText: string): string[] {
  const css = cssText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').replace(/@media[^{]+\{/g, '');
  const out: string[] = [];
  for (const rule of css.match(/[^{}]+\{[^{}]*\}/g) || []) {
    let depth = 0, current = '';
    for (const ch of rule.slice(0, rule.indexOf('{'))) {
      if (ch === '(') depth++; if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(current.trim()); current = ''; } else current += ch;
    }
    out.push(current.trim());
  }
  return out.filter(Boolean);
}

test('the Christmas homepage replaces only the signed-out homepage, only while the season is on, and falls back to the ordinary one', () => {
  const home = read('src/components/home/HomePage.tsx');
  // Members keep their own homepage; guests get the Christmas homepage only while the season is active.
  const member = home.search(/if \(user\) \{\s*return \(\s*<MemberHome \/>\s*\);\s*\}/);
  const seasonal = home.indexOf('if (season.active) return <SeasonalHome fallback={<NormalGuestHome />} />;');
  assert.ok(member > 0 && seasonal > member, 'the member check comes first');
  assert.match(home.slice(seasonal), /return <NormalGuestHome \/>;/);
  // The ordinary guest homepage keeps every original section, in order.
  const normal = home.slice(home.indexOf('export function NormalGuestHome'));
  const order = ['<Hero', '<QuickServicesBar', '<HomeFeaturedData', 'InstallAppPromo', '<HomeWebsiteSection', '<HomeMarketplaceSection', '<CreativeStudioEntry', '<HomeComingSoonSection', '<WhyMysteryHub', '<HomeFaqPreview'];
  let at = -1;
  for (const part of order) { const i = normal.indexOf(part); assert.ok(i > at, `${part} is present and in order`); at = i; }
  // The ordinary hero and phone tab bar carry no seasonal code at all (the v1 ornaments and the Home-icon hat are gone).
  for (const file of ['src/components/home/Hero.tsx', 'src/components/common/MobileNav.tsx']) assert.doesNotMatch(read(file), /seasonal|Seasonal|xmas|christmas/i, file);
  assert.doesNotMatch(read('src/seasonal/christmas/ChristmasPack.tsx'), /nav-home|NavHomeHat|HeroScene|ShareBand/);
  assert.doesNotMatch(read('src/seasonal/christmas/art.tsx'), /export const Hat\b/);
  // Lazy, retried once, and any failure shows the ordinary homepage instead.
  const seasonalTsx = read('src/seasonal/Seasonal.tsx');
  assert.match(seasonalTsx, /const loadChristmasHome = retryOnce\(\(\) => import\('\.\/christmas\/home\/ChristmasHome'\)\);/);
  assert.match(seasonalTsx, /if \(!season\.active \|\| season\.status\.pack !== 'christmas-2026'\) return <>\{fallback\}<\/>;/);
  assert.match(seasonalTsx, /<SeasonalBoundary fallback=\{fallback\}><Suspense fallback=\{<div className="mh-season-home-wait" aria-busy="true" \/>\}><ChristmasHome status=\{season\.status\} \/><\/Suspense><\/SeasonalBoundary>/);
  assert.match(seasonalTsx, /static getDerivedStateFromError\(\) \{ return \{ failed: true \}; \}/);
});

test('every Christmas homepage style lives in its own xh- namespace, with transform/opacity motion and a reduced-motion stop', () => {
  const css = read(`${HOME_DIR}/christmasHome.css`);
  const selectors = selectorsOf(css);
  assert.ok(selectors.length > 150);
  for (const selector of selectors) assert.match(selector, /^\.xh-[a-z]/, `${selector} starts inside the homepage's own classes`);
  // The xh- class names are used nowhere else, so these rules can never reach another page. The one exception is the
  // pack's shell rule that joins the footer to this page, which only tests whether the page is present.
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  for (const file of walk('src').filter(f => /\.(tsx?|css)$/.test(f) && !f.startsWith(HOME_DIR.split('/').join(path.sep)))) {
    assert.doesNotMatch(read(file).replace(/\.mh-app\[data-season="christmas"\]:has\(\.xh-home\) > (footer|main) \{/g, ''), /["'`\s.]xh-[a-z]/, file);
  }
  // Motion uses transform and opacity only.
  for (const [, name, body] of css.matchAll(/@keyframes ([\w-]+) \{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)) {
    const props = new Set(Array.from(body.matchAll(/([a-z-]+)\s*:/g), m => m[1]));
    for (const prop of props) assert.ok(['transform', 'opacity', 'rotate', 'animation-timing-function'].includes(prop), `${name} animates ${prop}`);
  }
  for (const [, value] of css.matchAll(/transition:\s*([^;]+);/g)) assert.match(value, /^(transform [^,]+|none !important)$/, value);
  // Endless loops only on large hover screens that welcome motion, and only while the hero is on screen.
  const loops = css.split('\n').filter(line => /infinite/.test(line));
  assert.ok(loops.length > 0);
  const idle = css.slice(css.indexOf('@media (min-width: 900px) and (hover: hover) and (prefers-reduced-motion: no-preference) {'));
  for (const line of loops) { assert.ok(idle.includes(line), line); assert.match(line, /^\s*\.xh-hero\[data-xh-visible\]/, line); }
  // Reduced motion: every animation and transition stops, and no section waits for a reveal.
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.xh-home \*, \.xh-home \*::before, \.xh-home \*::after \{ animation: none !important; transition: none !important; \}/);
  assert.match(read(`${HOME_DIR}/ChristmasHome.tsx`), /if \(!el \|\| reduced\(\) \|\| typeof IntersectionObserver === 'undefined'\) return;/);
  // The homepage-only shell changes: the shared light strand and footer greeting step aside, the hat is replaced.
  const pack = read('src/seasonal/christmas/christmas.css');
  assert.match(pack, /\.mh-app\[data-season="christmas"\]\[data-season-page="home"\] \.xmas-header-lights, \.mh-app\[data-season="christmas"\]\[data-season-page="home"\] \.xmas-footer \{ display: none; \}/);
  assert.match(pack, /\.mh-bottom-nav-item\[aria-current='page'\] \.mh-bottom-nav-indicator::after/);
});

test('the Christmas homepage keeps the real catalogue, prices, checkout, templates and Marketplace, and promises nothing new', () => {
  const page = read(`${HOME_DIR}/ChristmasHome.tsx`);
  // Real data and the existing actions, never copies of them.
  for (const used of ['useDirectCatalog()', 'useWelcomeOffer(bundles)', '<CompactBundleRow key={b.id} bundle={b} directWelcomeOffer={welcomeOffer} onBuy={bundle => openCheckout(bundle)} />', 'GHANA_NETWORKS[id].brandColor', '<InstallAppPromo />', '<TemplateCardPreview template={template} onPreview={() => openTemplatePreview(template)} />', 'getPublicMarketplaceProducts({ featured: true })', "DIGITAL_SERVICES.filter(s => s.status === 'coming_soon')", '<FaqAccordion questions={HOME_FAQS} />', 'creativeWorkById']) {
    assert.ok(page.includes(used), used);
  }
  // The hero keeps the brand line and both actions.
  assert.match(page, /Everything digital\.<br \/><span>One trusted place\.<\/span>/);
  assert.match(page, /onClick=\{go\('website'\)\}[^>]*>Create a Free Website/);
  assert.match(page, /onClick=\{go\('data'\)\}[^>]*>Buy Data/);
  // Words: greetings only, Ghana nationally, no offers, promises or invented numbers.
  const words = homeSource();
  assert.doesNotMatch(words, /discount|% off|\bfree data\b|bonus|giveaway|prize|\bwin\b|guarantee|instant delivery|delivered in|customers served|trusted by \d|\b\d+\+? (customers|users|orders)|award|uptime|testimonial/i);
  assert.doesNotMatch(words, /Accra(?! day)/, 'the page addresses Ghana, not one city');
  assert.match(words, /With love from Mystery Hub, Ghana\./);
  // Mystery Greetings is a preview only: no creator button unless a real route is passed, no fake links or API.
  assert.match(page, /\{createHref && <a className="mh-button xh-btn-primary" href=\{createHref\}>Create a greeting/);
  assert.match(page, /<Greetings christmas=\{christmas\} \/>/, 'no creator route is passed yet');
  assert.match(page, /Share the Mystery Hub website on WhatsApp/);
  assert.match(page, /Not open yet\. We’ll show it here when it is ready\./);
  assert.doesNotMatch(words, /\/api\/experiences|\/g\/|greetings\/|shareId|fetch\(/, 'no greeting API or link is invented');
  // The countdown is the calendar's day count, not a ticking clock; no backend clock or socket.
  assert.match(page, /const \{ big, small \} = seasonCountdown\(status\);/);
  assert.doesNotMatch(words, /setInterval|WebSocket|EventSource|requestAnimationFrame/);
  // No commerce of its own: checkout opens the existing modal; nothing pays, orders or installs by itself.
  assert.doesNotMatch(words, /initializePayment|usePaystack|PaystackPop|\.prompt\(\)|beforeinstallprompt|placeOrder|createOrder/);
  // Install appears only where the existing promo can actually install.
  const css = read(`${HOME_DIR}/christmasHome.css`);
  assert.match(css, /\.xh-install \{ display: none;/);
  assert.match(css, /\.xh-install:has\(\.mh-install-promo\) \{ display: block; \}/);
  // Planned services stay clearly unavailable; Creative Studio shows no prices and labels its sample work.
  assert.match(page, /Coming soon · Not available yet/);
  assert.match(page, /Studio Concepts: sample designs for fictional brands\./);
  assert.doesNotMatch(page.slice(page.indexOf('function Creative'), page.indexOf('function ComingSoon')), /GH₵|price|\d+\s?cedis/i);
});
