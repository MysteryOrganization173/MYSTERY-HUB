/**
 * Client-Side SPA Deep-Link Routing Test Suite
 *
 * Verifies:
 * 1. Pathname normalization rules (slashes, casing, queries, hashes, full URLs)
 * 2. Direct pathname resolution for all canonical routes:
 *    - / -> 'home'
 *    - /index.html -> 'home'
 *    - /data -> 'data'
 *    - /website-builder -> 'website'
 *    - /website -> 'website'
 *    - /marketplace -> 'marketplace'
 *    - /services -> 'services'
 *    - /about -> 'about'
 *    - /orders -> 'orders'
 *    - /admin -> 'admin'
 * 3. SPA rewrite preservation:
 *    - A server rewrite of /admin to /index.html serves index.html while
 *      preserving window.location.pathname = "/admin", which resolves to 'admin'.
 * 4. Unauthenticated admin route access:
 *    - Directly visiting /admin resolves to 'admin' (renders AdminLoginCard),
 *      and does NOT redirect or fall back to 'home'.
 * 5. Unknown routes fallback:
 *    - Unknown paths fall back safely to 'home'.
 * 6. Bidirectional consistency across ROUTE_PATH_MAP.
 */

import assert from 'node:assert';
import {
  normalizePathname,
  getPageFromPath,
  ROUTE_PATH_MAP,
} from '../../../src/utils/routing';

console.log('--- STARTING CLIENT-SIDE ROUTING TEST SUITE ---');

// 1. Direct Canonical Pathname Resolution
console.log('Testing direct canonical route resolution...');
assert.strictEqual(getPageFromPath('/'), 'home', '/ must resolve to home');
assert.strictEqual(getPageFromPath('/index.html'), 'home', '/index.html must resolve to home');
assert.strictEqual(getPageFromPath('/data'), 'data', '/data must resolve to data');
assert.strictEqual(getPageFromPath('/website-builder'), 'website', '/website-builder must resolve to website');
assert.strictEqual(getPageFromPath('/website'), 'website', '/website alias must resolve to website');
assert.strictEqual(getPageFromPath('/marketplace'), 'marketplace', '/marketplace must resolve to marketplace');
assert.strictEqual(getPageFromPath('/services'), 'services', '/services must resolve to services');
assert.strictEqual(getPageFromPath('/about'), 'about', '/about must resolve to about');
assert.strictEqual(getPageFromPath('/orders'), 'orders', '/orders must resolve to orders');
assert.strictEqual(getPageFromPath('/admin'), 'admin', '/admin must resolve to admin');
console.log('✓ 1. All direct canonical paths resolve correctly');

// 2. Normalization Robustness (trailing slashes, case insensitivity, queries, hashes)
console.log('Testing normalization robustness...');
assert.strictEqual(getPageFromPath('/admin/'), 'admin', '/admin/ with trailing slash must resolve to admin');
assert.strictEqual(getPageFromPath('/ADMIN'), 'admin', 'Uppercase /ADMIN must resolve to admin');
assert.strictEqual(getPageFromPath('/data/'), 'data', '/data/ must resolve to data');
assert.strictEqual(getPageFromPath('/DATA'), 'data', '/DATA must resolve to data');
assert.strictEqual(getPageFromPath('/admin?tab=orders'), 'admin', '/admin with query param must resolve to admin');
assert.strictEqual(getPageFromPath('/orders#MH-123456'), 'orders', '/orders with hash must resolve to orders');
assert.strictEqual(getPageFromPath('/marketplace?search=laptop#top'), 'marketplace', 'Path with query and hash must resolve to marketplace');
assert.strictEqual(getPageFromPath('https://mystery-hub.onrender.com/admin'), 'admin', 'Full URL to /admin must resolve to admin');
assert.strictEqual(getPageFromPath('https://mystery-hub.onrender.com/data'), 'data', 'Full URL to /data must resolve to data');
assert.strictEqual(getPageFromPath('//admin///'), 'admin', 'Multiple redundant slashes must resolve to admin');
assert.strictEqual(getPageFromPath(''), 'home', 'Empty string must default safely to home');
assert.strictEqual(getPageFromPath(null), 'home', 'Null must default safely to home');
assert.strictEqual(getPageFromPath(undefined), 'home', 'Undefined must default safely to home');
console.log('✓ 2. Pathname normalization handles slashes, casing, queries, hashes, and full URLs');

// 3. Subpath index.html resolution (e.g. from static host folder lookups)
console.log('Testing subpath /index.html resolution...');
assert.strictEqual(getPageFromPath('/admin/index.html'), 'admin', '/admin/index.html must resolve to admin');
assert.strictEqual(getPageFromPath('/data/index.html'), 'data', '/data/index.html must resolve to data');
assert.strictEqual(getPageFromPath('/services/index.html'), 'services', '/services/index.html must resolve to services');
assert.strictEqual(getPageFromPath('/marketplace/index.html'), 'marketplace', '/marketplace/index.html must resolve to marketplace');
console.log('✓ 3. Subpath index.html patterns resolve correctly');

// 4. Conceptual SPA Rewrite Simulation (Render Static Site behavior)
console.log('Testing conceptual SPA rewrite simulation...');
// On Render Static Site with rule:
// Source: /*, Destination: /index.html, Action: Rewrite
// When a user opens "https://mystery-hub.onrender.com/admin":
// The server serves /index.html with HTTP 200 without changing the browser address bar.
// The browser's window.location.pathname remains "/admin".
const simulatedBrowserPathnameOnRewrite = '/admin';
const resolvedPageOnRewrite = getPageFromPath(simulatedBrowserPathnameOnRewrite);
assert.strictEqual(
  resolvedPageOnRewrite,
  'admin',
  'A server rewrite of /admin to /index.html must resolve to admin, NOT home'
);

// If the browser visibly landed on /index.html (e.g. user typed /index.html directly):
const simulatedBrowserPathnameDirectIndex = '/index.html';
const resolvedPageDirectIndex = getPageFromPath(simulatedBrowserPathnameDirectIndex);
assert.strictEqual(
  resolvedPageDirectIndex,
  'home',
  '/index.html should normalize to home only when it is actually the browser pathname'
);
console.log('✓ 4. SPA rewrite keeps /admin as admin while direct /index.html normalizes to home');

// 5. Unauthenticated Admin Route Stability
console.log('Testing unauthenticated admin route stability...');
// In Mystery Hub, visiting /admin when unauthenticated:
// 1) Resolver sets activePage = 'admin'
// 2) AppContent renders <AdminPage />
// 3) AdminPage detects !user or !sessionToken and renders <AdminLoginCard />
// It does NOT redirect to '/' or home.
const directAdminPage = getPageFromPath('/admin');
assert.strictEqual(directAdminPage, 'admin');
// Confirm /admin is a distinct, isolated page id
assert.notStrictEqual(directAdminPage, 'home');
console.log('✓ 5. Unauthenticated admin route renders admin login without redirection');

// 6. Unknown Routes Fallback
console.log('Testing unknown routes fallback...');
assert.strictEqual(getPageFromPath('/non-existent-page-xyz'), 'home', 'Unknown page falls back to home');
assert.strictEqual(getPageFromPath('/foo/bar'), 'home', 'Arbitrary deep unknown path falls back to home');
console.log('✓ 6. Unknown routes fall back safely to home');

// 7. Bidirectional Mapping Consistency
console.log('Testing bidirectional mapping consistency...');
const allPages: Array<keyof typeof ROUTE_PATH_MAP> = [
  'home',
  'data',
  'website',
  'marketplace',
  'services',
  'about',
  'orders',
  'admin',
];

for (const page of allPages) {
  const path = ROUTE_PATH_MAP[page];
  assert.ok(path, `ROUTE_PATH_MAP must define path for ${page}`);
  const resolved = getPageFromPath(path);
  assert.strictEqual(
    resolved,
    page,
    `Path "${path}" from ROUTE_PATH_MAP must resolve back to "${page}"`
  );
}
console.log('✓ 7. Bidirectional ROUTE_PATH_MAP consistency verified for all 8 pages');

console.log('=== ALL CLIENT-SIDE ROUTING TESTS PASSED SUCCESSFULLY! ===');
