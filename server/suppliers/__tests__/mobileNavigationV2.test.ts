import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const nav = readFileSync('src/components/common/MobileNav.tsx', 'utf8');
const css = readFileSync('src/index.css', 'utf8');
const navCss = css.slice(css.indexOf('/* Mobile Navigation V2'));

test('the same five destinations, labels and order', () => {
  assert.deepEqual([...nav.matchAll(/id: '([^']+)', label: '([^']+)'/g)].map(m => `${m[1]}:${m[2]}`), ['home:Home', 'data:Data', 'website:Website', 'earn:Earn', 'orders:Orders']);
  assert.match(nav, /href=\{ROUTE_PATH_MAP\[item\.id\]\}/);
  assert.match(nav, /aria-current=\{isActive \? 'page' : undefined\}/);
  assert.match(nav, /className="mh-bottom-nav-label">\{item\.label\}/, 'labels stay visible');
});

test('every overlay guard is kept', () => {
  const guard = nav.slice(nav.indexOf('  if ('), nav.indexOf('  return ('));
  for (const flag of ['activeEditorSite', 'isMysteryAiOpen', 'isCheckoutOpen', 'isStatusModalOpen', 'isAuthModalOpen', 'selectedTemplatePreview', 'marketplaceInquiryProduct', 'waitlistInfo.isOpen', 'isAccountOpen']) assert.ok(guard.includes(flag), flag);
});

test('no misleading Orders activity dot and no requests from the nav', () => {
  assert.doesNotMatch(nav, /orders\.length|\borders\b,/);
  assert.doesNotMatch(nav, /fetch\(|apiClient|OnServer/);
});

test('modified clicks keep native link behaviour', () => {
  assert.match(nav, /if \(e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey \|\| e\.altKey \|\| e\.button !== 0\) return;/);
});

test('styling: own class names, safe area, comfortable targets, restrained motion', () => {
  assert.match(nav, /pb-\[env\(safe-area-inset-bottom,0px\)\]/);
  assert.match(navCss, /\.mh-bottom-nav-row \{ height: 64px;/);
  assert.match(navCss, /min-height: 48px/);
  assert.match(navCss, /prefers-reduced-motion: reduce/);
  assert.match(navCss, /@supports not/);
  assert.doesNotMatch(navCss, /animation:|infinite/);
  // .mh-tabbar is the shared horizontal tab-row utility used by Orders; the nav must not reuse it.
  assert.doesNotMatch(nav, /mh-tabbar/);
});
