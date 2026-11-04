import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path: string) => readFileSync(path, 'utf8');
const modal = source('src/components/website/TemplatePreviewModal.tsx');
const css = source('src/components/website/websiteBuilder.css');

test('V7.4 A: on a phone the website renders at the real screen width, unscaled and unframed', () => {
  assert.match(modal, /const phone = isMobileScreen;/);
  assert.match(modal, /const targetWidth = phone \? Math\.max\(280, Math\.round\(availableWidth\)\)/);
  assert.match(modal, /const scale = phone \? 1 :/);
  // No simulated browser bar and no device frame on a phone; desktop and tablet keep both.
  assert.match(modal, /\{!phone && <div\s+className="border-b px-3/);
  assert.match(modal, /\$\{phone \? '' : 'rounded-2xl border border-slate-800 shadow-2xl'\}/);
  assert.match(modal, /className="flex-1 min-h-0 bg-\[#05080c\] p-0 sm:p-4/);
});

test('V7.4 A: the explanation is one tap away on a phone, and always shown on larger screens', () => {
  assert.match(modal, /<p className="hidden sm:block px-4 py-1\.5 text-xs text-slate-300 bg-slate-900">\{previewNote\}<\/p>/);
  assert.match(modal, /aria-expanded=\{noteOpen\} aria-controls="tpv-note"/);
  assert.match(modal, /\{noteOpen && <p id="tpv-note" className="sm:hidden/);
  // Every starter preview still says its content is an example.
  assert.match(modal, /dataDemo \? 'Example bundles and prices' : starterTemplate \? 'Example content'/);
  assert.match(modal, /Bundles and prices here are examples/);
});

test('V7.4 A: one Use action on a phone, a visible Back, focus on the title instead of a ringed button', () => {
  assert.match(modal, /aria-label="Back to designs"/);
  assert.match(modal, /\{!namedPreview && <button/);
  assert.match(modal, /<h2 data-autofocus tabIndex=\{-1\}/);
  // The plans strip is a desktop extra; on a phone it would take space from the website.
  assert.match(modal, /className="hidden sm:flex px-3 sm:px-5 py-2 bg-\[#06090d\]/);
});

test('V7.4 A: phone controls keep 44px touch targets and respect the safe areas', () => {
  assert.match(css, /\.tpv-icon\{min-height:44px;min-width:44px\}/);
  assert.match(css, /\.tpv-bar\{padding-top:max\(6px,env\(safe-area-inset-top\)\)\}/);
  assert.match(css, /\.website-preview-namebar\{padding:8px 10px max\(8px,env\(safe-area-inset-bottom\)\);gap:6px\}/);
  assert.match(css, /\.website-preview-namebar input,\.website-preview-namebar button\{min-height:44px/);
});

test('V7.4 A: preview isolation is unchanged (sandboxed frame, starter content by message, no payments)', () => {
  assert.match(modal, /sandbox="allow-scripts allow-same-origin"/);
  assert.match(modal, /if \(t\.siteContent\) return; \/\/ Private drafts never receive a shareable content URL\./);
  assert.match(modal, /'Preview only\. Open your published website to contact the business\.'/);
});

test('V7.4 A: dialogs focus the first visible autofocus target, so a phone-only title never strands desktop focus', () => {
  const hook = source('src/hooks/useDialogFocus.ts');
  assert.match(hook, /\[\.\.\.surface\.querySelectorAll<HTMLElement>\('\[data-autofocus\]'\)\]\.find\(node => node\.getClientRects\(\)\.length\)/);
  assert.match(modal, /<h3 data-autofocus tabIndex=\{-1\}/);
});
