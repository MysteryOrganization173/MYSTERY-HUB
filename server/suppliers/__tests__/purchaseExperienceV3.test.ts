import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AFA_CONFIG, AFA_PACKAGES} from '../../../src/config/afa';
import {afaHighlights, afaPackagePrices, afaPackageCell} from '../../../src/utils/afaPresentation';
import {InstantBundleCard} from '../../../src/components/data/InstantBundleCard';
import {DataNetworkSelector} from '../../../src/components/data/DataNetworkSelector';
import type {PublicInstantBundle} from '../../../src/services/apiClient';

const source = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const afa = source('src/components/services/AfaRegistrationPage.tsx');
const data = source('src/components/data/DataPage.tsx');
const instant = source('src/components/data/InstantBundlesCatalog.tsx');
const css = source('src/index.css');
const hero = afa.slice(afa.indexOf('<section aria-labelledby="afa-title"'), afa.indexOf('<form ref={formRef}'));

// AFA: benefits first, and every figure comes from the package examples.

test('AFA highlights are derived from the monthly package examples, never from SMS', () => {
  const highlights = afaHighlights(AFA_PACKAGES);
  const monthly = AFA_PACKAGES.filter(p => p.period === 'monthly');
  assert.deepEqual(highlights.map(h => h.key), ['cug', 'onNet', 'offNet', 'data']);
  assert.equal(highlights[0].value, String(Math.max(...monthly.map(p => p.cugMins))));
  assert.equal(highlights[1].value, String(Math.max(...monthly.map(p => p.onNetMins))));
  assert.equal(highlights[3].value, `${Math.max(...monthly.map(p => p.dataMb || 0))}MB`);
  assert.ok(highlights.every(h => !/sms/i.test(h.label + h.short + h.detail)));
  assert.deepEqual(afaPackagePrices(AFA_PACKAGES), {monthly: 10, weekly: 3});
  // A package set without data gives no data highlight rather than an invented one.
  assert.ok(!afaHighlights(AFA_PACKAGES.filter(p => !p.hasData)).some(h => h.key === 'data'));
});

test('the unverified 255 SMS figure is gone; unconfirmed SMS shows Included, not a number', () => {
  assert.ok(AFA_PACKAGES.every(p => p.sms !== 255));
  assert.doesNotMatch(source('src/config/afa.ts'), /sms: 255/);
  const monthly = AFA_PACKAGES.find(p => p.id === 'afa-monthly-nodata')!;
  assert.equal(monthly.sms, null);
  assert.equal(afaPackageCell(monthly, 'sms'), 'Included');
  assert.equal(afaPackageCell(AFA_PACKAGES.find(p => p.id === 'afa-weekly-nodata')!, 'sms'), '10');
  assert.equal(afaPackageCell(monthly, 'dataMb'), null);
  assert.equal(afaPackageCell(AFA_PACKAGES.find(p => p.id === 'afa-monthly-data')!, 'dataMb'), '250MB');
});

test('AFA hero leads with value, the one-time fee, the separate MTN purchase and a start button, before the form', () => {
  assert.match(hero, /Get more from your MTN line/);
  assert.doesNotMatch(hero, /More ways to stay connected/);
  assert.match(hero, /aria-label="AFA package highlights"/);
  assert.match(hero, /One-time registration fee/);
  assert.match(hero, /Packages are not included: you buy them from MTN/);
  assert.match(hero, /AFA packages are not included; you buy them from MTN/);
  assert.match(hero, /Covers registering your MTN line for AFA only/);
  assert.match(hero, /onClick=\{startRegistration\}/);
  assert.ok(afa.indexOf('aria-label="AFA package highlights"') < afa.indexOf('<form ref={formRef}'));
  assert.match(AFA_CONFIG.tagline, /eligible AFA call and data packages/);
  assert.match(AFA_CONFIG.tagline, /buy the packages separately from MTN/);
});

test('AFA makes no unsupported promises and keeps the MTN menu code until the line is Registered', () => {
  const customerCopy = hero + JSON.stringify(AFA_CONFIG) + afa.slice(afa.indexOf('id="afa-packages"'));
  assert.doesNotMatch(customerCopy, /unlimited|lifetime|guarantee|free (minutes|calls|bundles?|data)|activate now|instant activation|every MTN/i);
  assert.equal((afa.match(/\*1848#/g) || []).length, 1);
  assert.match(afa, /confirmedOrder.status === 'delivered' && <p[^>]*>Dial/);
  assert.match(AFA_CONFIG.disclaimer, /subject to MTN/);
});

test('guests sign in before typing; the start button never skips the existing boundary', () => {
  assert.match(afa, /if \(!user\) \{ openAuth\('login', 'Sign in to register your MTN line for AFA.', goToForm\); return; \}/);
  assert.match(afa, /\{user \? 'Start registration' : 'Sign in to start'\}/);
  assert.match(afa, /Sign in first so nothing you type is lost/);
  // The submit handler keeps its own sign-in and password-change checks.
  assert.match(afa, /if \(!user \|\| !sessionToken\) \{ openAuth\('login'/);
  assert.match(afa, /if \(user.mustChangePassword\) \{ openAccount\(\); return; \}/);
});

test('the pay button says where the tap goes and payment code paths are unchanged', () => {
  assert.match(afa, /`Pay \$\{feeText\} from Mystery Wallet`/);
  assert.match(afa, /`Continue to Paystack · \$\{feeText\}`/);
  assert.doesNotMatch(afa, /Activate/);
  assert.match(afa, /walletCheckout\(sessionToken,'afa\/payments\/initialize'/);
  assert.match(afa, /initializeAfaPayment\(payload, formData.consent, formData.customerEmail, sessionToken\)/);
  assert.match(afa, /url.hostname !== 'checkout.paystack.com'/);
});

test('package comparison folds on phones, stays open from lg, and keeps monthly and weekly tabs', () => {
  assert.match(afa, /aria-expanded=\{packagesOpen\} aria-controls="afa-packages-body"/);
  assert.match(afa, /className=\{`\$\{packagesOpen \? 'block' : 'hidden'\} lg:block/);
  assert.match(afa, /\(\['monthly', 'weekly'\] as const\)/);
  assert.match(afa, /afaPackageCell\(pkg, key\)/);
  assert.match(afa, /CUG minutes are for calls within your AFA group/);
});

// Chip rows: no scrollbar track, still scrollable.

test('chip rows use one shared primitive that hides only the scrollbar', () => {
  const rule = css.slice(css.indexOf('.mh-chip-scroll {'), css.indexOf('@keyframes mh-chip-fade'));
  assert.match(rule, /overflow-x: auto/);
  assert.match(rule, /scrollbar-width: none/);
  assert.match(rule, /\.mh-chip-scroll::-webkit-scrollbar \{ display: none; \}/);
  assert.match(rule, /animation-timeline: scroll\(self inline\)/);
  assert.match(css, /\.mh-tabbar::-webkit-scrollbar \{ display: none; \}/);
  // The page's own scrollbar styling is untouched: nothing hides scrollbars globally.
  assert.match(css, /^::-webkit-scrollbar \{\n  width: 6px;/m);
  assert.doesNotMatch(css, /^\s*(html|body|\*)[^{]*\{[^}]*scrollbar-width: none/m);
});

test('no component relies on the undefined no-scrollbar class any more', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.(tsx?|css)$/.test(name) ? [full] : [];
  });
  for (const file of walk('src')) assert.doesNotMatch(source(file), /className=[^\n]*\bno-scrollbar\b|^\s*\.no-scrollbar/m, file);
  assert.match(data, /onFocus=\{revealFocusedChip\} className="mh-chip-scroll items-center gap-2 -mx-4 px-4/);
  assert.match(data, /ref=\{revealPressedChip\} onFocus=\{revealFocusedChip\} role="group" aria-label="Filter by bundle size"/);
  assert.match(instant, /ref=\{revealPressedChip\} onFocus=\{revealFocusedChip\} role="group" aria-label="Filter by bundle type"/);
  assert.match(data, /aria-label="Filter by bundle size" className="mh-chip-scroll/);
  assert.match(instant, /aria-label="Filter by bundle type" className="mh-chip-scroll/);
});

// Data buying.

test('size chips are short on screen but fully named for assistive technology', () => {
  for (const [label, name] of [['All', 'All sizes'], ['1–5GB', '1GB to 5GB'], ['6–20GB', '6GB to 20GB'], ['25GB+', '25GB and more']])
    assert.ok(data.includes(`'${label}', '${name}'`), label);
  assert.match(data, /aria-label=\{name\}\s+aria-pressed=\{sizeFilter === id\}/);
  // Filtering thresholds are unchanged.
  assert.match(data, /sizeFilter === 'small' && mb > 5120/);
  assert.match(data, /sizeFilter === 'large' && mb <= 20480/);
});

test('mode tabs share one active style and only scroll when the list is out of view', () => {
  assert.match(data, /dataProductMode === 'instant' \? 'bg-\[#00c365\] text-\[#03160c\]'/);
  assert.doesNotMatch(data, /bg-amber-400 text-black/);
  assert.match(data, /if \(top < 80 \|\| top > window.innerHeight \* 0.6\) smoothScrollToElement/);
  assert.match(data, /id="instant-bundles-section" ref=\{bundlesSectionRef\} className="scroll-mt-24"/);
  assert.match(data, /aria-label="AFA Registration"/);
});

const product: PublicInstantBundle = {productKey: 'v3', packageId: 'v3', name: 'Video 3GB', network: 'mtn', dataAmount: '3GB', validity: '7 days',
  isFlexi: false, retailPriceGhc: 6, retailPricePesewas: 600, paymentProcessingFeeGhc: 0.15, estimatedTotalGhc: 6.15, availability: 'in_stock', category: 'Video'};

test('restricted Instant packages carry a condition chip; standard data stays plain and labelled', () => {
  const video = renderToStaticMarkup(React.createElement(InstantBundleCard, {product, onBuy() {}}));
  assert.match(video, /For supported video usage/);
  assert.match(video, /\+ GH₵0\.15 fee/);
  assert.match(video, /aria-label="Buy 3GB MTN Ghana Video Bundle for GH₵6\.00 plus GH₵0\.15 checkout fee"/);
  const standard = renderToStaticMarkup(React.createElement(InstantBundleCard, {product: {...product, name: '3GB', category: 'Data'}, onBuy() {}}));
  assert.match(standard, />Standard data</);
  assert.doesNotMatch(standard, /For supported video usage|Midnight-only/);
  assert.match(standard, /min-h-11/);
});

test('Instant type chips show the category icon with the text label', () => {
  assert.match(instant, /INSTANT_CATEGORY_TONE\[catKey\]\.icon/);
  assert.match(instant, /getCategoryFilterLabel\(catKey\)/);
});

test('network dots step aside below 360px so Telecel stays on one line', () => {
  const html = renderToStaticMarkup(React.createElement(DataNetworkSelector, {value: 'all', onChange() {}}));
  assert.equal((html.match(/hidden min-\[360px\]:inline-block/g) || []).length, 4);
});
