import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

// A minimal DOM: enough for the overlay stack's root-class lock and its inert bookkeeping.
class FakeClassList { set = new Set<string>(); add(...c: string[]) { c.forEach(x => this.set.add(x)); } remove(...c: string[]) { c.forEach(x => this.set.delete(x)); } toggle(c: string, on: boolean) { on ? this.set.add(c) : this.set.delete(c); } contains(c: string) { return this.set.has(c); } }
class FakeElement {
  children: FakeElement[] = []; parentElement: FakeElement | null = null; attrs = new Map<string, string>(); fixed = false; isConnected = true;
  constructor(public name: string) {}
  append(...kids: FakeElement[]) { for (const kid of kids) { kid.parentElement = this; this.children.push(kid); } return this; }
  setAttribute(k: string, v: string) { this.attrs.set(k, v); } removeAttribute(k: string) { this.attrs.delete(k); } hasAttribute(k: string) { return this.attrs.has(k); }
  contains(other: FakeElement | null): boolean { for (let n = other; n; n = n.parentElement) if (n === this) return true; return false; }
  querySelector() { return null; }
}
const html = { classList: new FakeClassList(), scrollHeight: 3000, clientHeight: 800 };
const body = new FakeElement('body'), root = new FakeElement('root');
const g = globalThis as any;
g.HTMLElement = FakeElement;
g.getComputedStyle = (el: FakeElement) => ({ position: el.fixed ? 'fixed' : 'static' });
g.document = { documentElement: html, body, getElementById: (id: string) => id === 'root' ? root : null };

const header = new FakeElement('header'), main = new FakeElement('main'), footer = new FakeElement('footer'), toasts = new FakeElement('toasts');
const previewLayer = new FakeElement('preview-layer'), previewBackdrop = new FakeElement('preview-backdrop'), preview = new FakeElement('preview');
const sheetLayer = new FakeElement('sheet-layer'), sheet = new FakeElement('sheet');
const app = new FakeElement('app').append(header, main, footer, previewLayer, sheetLayer, toasts);
root.append(app); body.append(root);
previewLayer.fixed = true; previewLayer.append(previewBackdrop, preview);
sheetLayer.fixed = true; sheetLayer.append(sheet);
toasts.setAttribute('data-overlay-exempt', '');

test('V5.2 overlay stack: root lock, inert background, nesting and idempotent release', async () => {
  const { acquireOverlay, openOverlayCount } = await import('../../../src/utils/overlayStack');
  const inert = (el: FakeElement) => el.hasAttribute('inert');
  const releasePreview = acquireOverlay(preview as any);
  assert.ok(html.classList.contains('mh-scroll-locked'), 'the page scroller (html) is locked, not only body');
  assert.ok(html.classList.contains('mh-scroll-gutter'), 'a long page keeps its scrollbar space');
  assert.ok(inert(header) && inert(main) && inert(footer), 'the background is inert');
  assert.ok(!inert(previewLayer) && !inert(previewBackdrop), 'the overlay and its own backdrop stay usable');
  assert.ok(!inert(toasts), 'status messages stay announced');
  assert.ok(!inert(app) && !inert(root), 'the overlay is never inside an inert ancestor');

  const releaseSheet = acquireOverlay(sheet as any);
  assert.ok(inert(previewLayer) && !inert(sheetLayer), 'the top overlay wins; the one beneath waits');
  releaseSheet(); releaseSheet();
  assert.equal(openOverlayCount(), 1, 'a double cleanup releases only once');
  assert.ok(html.classList.contains('mh-scroll-locked'), 'closing the top overlay keeps the page locked for the lower one');
  assert.ok(!inert(previewLayer) && inert(main), 'the lower overlay is active again');

  const releaseMenu = acquireOverlay(null, { modal: false });
  releasePreview();
  assert.ok(html.classList.contains('mh-scroll-locked') && !inert(main), 'a non-modal lock holds the page still without inerting anything');
  releaseMenu();
  assert.equal(openOverlayCount(), 0);
  assert.ok(!html.classList.contains('mh-scroll-locked') && !html.classList.contains('mh-scroll-gutter'), 'the last release unlocks');
  assert.ok(![header, main, footer, previewLayer, sheetLayer].some(inert), 'every inert mark is removed');
  assert.equal(body.hasAttribute('inert'), false);
});

const source = (path: string) => readFileSync(path, 'utf8');

test('V5.2 overlays share one lock; CSS locks the root and native modal dialogs; previews do not chain scroll', () => {
  const css = source('src/index.css');
  assert.match(css, /html\.mh-scroll-locked, html:has\(dialog:modal\) \{ overflow: hidden !important; overscroll-behavior: none; \}/);
  assert.match(css, /html\.mh-isolated-preview, html\.mh-isolated-preview body \{ overscroll-behavior-y: contain; \}/);
  for (const file of ['src/hooks/useDialogFocus.ts', 'src/components/auth/SecurityDialog.tsx', 'src/components/marketplace/useMarketplaceDialog.ts', 'src/components/admin/ui/AdminUi.tsx']) {
    const s = source(file);
    assert.match(s, /acquireOverlay\(/, `${file} uses the shared overlay stack`);
    assert.doesNotMatch(s, /document\.body\.style\.overflow\s*=/, `${file} no longer writes its own body lock`);
  }
  assert.match(source('src/components/website/IsolatedTemplatePreview.tsx'), /classList\.add\('mh-isolated-preview'\)/);
  const nav = source('src/components/common/Navbar.tsx');
  assert.match(nav, /useOverlayLock\(mobileMenuOpen, headerRef\)/, 'the phone menu locks the page');
  assert.match(nav, /matchMedia\('\(min-width: 1280px\)'\)/, 'growing to desktop closes the menu and its lock');
  assert.match(nav, /addEventListener\('popstate', close\)/, 'Back closes the menu');
  assert.match(source('src/hooks/useDialogFocus.ts'), /owner && owner !== surface && surface\.contains\(owner\)/, 'a nested sheet keeps its own Escape and Tab');
  assert.doesNotMatch(source('src/utils/overlayStack.ts'), /preventDefault|touchmove/, 'no blanket touch blocking');
});

test('V5.2 Signal is bundle-first and keeps the payment contract', () => {
  const s = source('src/components/website/ManagedDataStorefront.tsx');
  assert.doesNotMatch(s, /SignalSteps|Step 1 · Who is it for/, 'the number-first card and its progress steps are gone');
  assert.match(s, /const pick=\(b:StoreBundle\)=>choose\(toBundle\(b\)\)/, 'tapping a bundle opens checkout for exactly that server bundle');
  assert.match(s, /networkConfirmed=!!selected&&validNumber&&confirmedFor===confirmKey/, 'confirmation is bound to this number and this bundle network');
  assert.match(s, /usually belongs to/, 'a ported-number warning explains the mismatch');
  assert.doesNotMatch(s, /setNetwork\(guess\)|setNetwork\(detected/, 'the selected network is never changed silently from the number');
  assert.match(s, /`Pay \$\{formatGhs\(Math\.round\(selected\.priceGhc\*100\)\)\}`/, 'Pay shows the server retail total');
  assert.match(s, /expectedMinor:Math\.round\(selected\.priceGhc\*100\)/, 'the server still re-checks the amount');
  assert.match(s, /dialog\.current\?\.close\(\);\n\s*const remember/, 'the sheet closes before Paystack opens');
  assert.doesNotMatch(s, /receipt will be emailed|we will email|email you/i, 'no unverified email promise');
});

test('V5.2 orders show the server reference with copy and tracking, stored without personal details', () => {
  const s = source('src/components/website/ManagedDataStorefront.tsx');
  for (const text of ['Order reference', 'Copy reference', 'Track this order', 'Copy tracking details']) assert.ok(s.includes(text), text);
  assert.match(s, /sessionStorage\.setItem\(lastOrderKey,ref\)/, 'only the reference is kept for a reload');
  assert.match(s, /mh_store_last_order:\$\{siteId\}/, 'kept per store, never shared between reseller sites');
  assert.match(s, /\/\^MH-\[a-zA-Z0-9-\]\{1,60\}\$\/\.test\(ref\)/, 'malformed references are refused before a lookup');
  assert.doesNotMatch(s, /#store-track\?|[?&](ref|order|phone)=/, 'tracking details carry no reference or phone in the URL');
  assert.match(s, /lastStatus\.current/, 'settled orders stop polling');
});

test('V5.2 gallery: one tile per industry in the strip; compact phone cards', () => {
  const page = source('src/components/website/WebsiteBuilderPage.tsx');
  assert.match(page, /all\.findIndex\(other => other\.categoryLabel === t\.categoryLabel\) === i/);
  const css = source('src/index.css');
  assert.match(css, /@media \(max-width:639px\)\{\n  \.template-card\{display:grid;grid-template-columns:36% minmax\(0,1fr\)/);
  assert.doesNotMatch(css, /@media \(max-width:767px\)\{\.template-card-media\.is-phone-live\{aspect-ratio:4\/5\}\}/, 'phones no longer get the tall 4:5 card');
});
