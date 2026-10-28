import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DIGITAL_SERVICES } from '../../../src/data/services';
import { SERVICE_PREVIEWS } from '../../../src/data/servicePreviews';
import {
  categorySlug, filterServices, findServiceBySlug, readServicesUrl, serviceActionLabel, serviceAvailability, serviceCategories,
  serviceHref, serviceSlug, serviceStatusLabel, servicesHref,
} from '../../../src/utils/serviceDirectory';
import { getPageFromPath } from '../../../src/utils/routing';

const source = (name: string) => readFileSync(name, 'utf8');
const byId = (id: string) => DIGITAL_SERVICES.find(s => s.id === id)!;
const UPCOMING = ['srv-ecg', 'srv-water', 'srv-tv', 'srv-results', 'srv-bizreg', 'srv-ai', 'srv-esim'];

test('catalogue keeps every service identifier and adds Marketplace', () => {
  for (const id of ['srv-data', 'srv-airtime', 'srv-website', 'srv-afa', 'srv-wallet', 'srv-rewards', 'srv-marketplace', ...UPCOMING]) assert.ok(byId(id), id);
  assert.equal(new Set(DIGITAL_SERVICES.map(s => s.id)).size, DIGITAL_SERVICES.length);
  assert.equal(byId('srv-marketplace').targetPage, 'marketplace');
});

test('coming-soon titles are unchanged, so existing waitlist service keys stay grouped', () => {
  // WaitlistModal derives serviceKey from the title; renaming one would split Admin's lead counts.
  assert.deepEqual(UPCOMING.map(id => byId(id).title), [
    'ECG Prepaid & Postpaid Bills', 'Ghana Water (GWCL) Bills', 'DStv, GOtv & StarTimes Pay', 'WAEC Results Checker PINs',
    'Business Registration & TIN Support', 'AI Business Creator Suite', 'Digital eSIM Activation',
  ]);
});

test('every upcoming service has a structured preview, and only upcoming services do', () => {
  assert.deepEqual(Object.keys(SERVICE_PREVIEWS).sort(), [...UPCOMING].sort());
  for (const id of UPCOMING) {
    const p = SERVICE_PREVIEWS[id];
    assert.ok(p.intro.length > 40 && p.helpsWith.length >= 3 && p.planned.length >= 3 && p.journey.length >= 3, id);
    const text = JSON.stringify(p);
    // No prices, dates or guarantees in planned content.
    assert.doesNotMatch(text, /GH₵|GHS|\bcedis?\b|\d+\s*(minutes|hours|days)|guarantee|instant(ly)?|20\d\d/i, id);
  }
});

test('available services route to their working pages; Airtime opens Airtime mode', () => {
  assert.equal(byId('srv-airtime').dataMode, 'airtime');
  assert.equal(byId('srv-data').dataMode, 'data');
  assert.equal(byId('srv-rewards').targetPage, 'earn');
  const hrefs = Object.fromEntries(DIGITAL_SERVICES.map(s => [s.id, serviceHref(s)]));
  assert.equal(hrefs['srv-data'], '/data'); assert.equal(hrefs['srv-airtime'], '/data');
  assert.equal(hrefs['srv-website'], '/website-builder'); assert.equal(hrefs['srv-marketplace'], '/marketplace');
  assert.equal(hrefs['srv-afa'], '/afa'); assert.equal(hrefs['srv-rewards'], '/earn'); assert.equal(hrefs['srv-wallet'], '/wallet');
  assert.equal(hrefs['srv-ecg'], '/services?service=ecg');
  const page = source('src/components/services/MoreServicesPage.tsx');
  assert.match(page, /if \(service\.dataMode\) openDataPage\(service\.dataMode\)/);
});

test('status is honest: AFA follows its runtime check, planned services never read as available', () => {
  const afa = byId('srv-afa');
  assert.equal(serviceAvailability(afa, 'checking'), 'checking');
  assert.equal(serviceAvailability(afa, 'unavailable'), 'unavailable');
  assert.equal(serviceAvailability(afa, 'available'), 'available');
  assert.equal(serviceStatusLabel(afa, 'unavailable'), 'Paused');
  for (const id of UPCOMING) {
    const s = byId(id);
    assert.equal(serviceAvailability(s, 'available'), 'coming_soon');
    assert.equal(serviceStatusLabel(s, 'coming_soon'), 'Coming soon');
    assert.equal(serviceActionLabel(s, 'coming_soon'), 'Preview');
  }
  assert.equal(serviceStatusLabel(byId('srv-website'), 'available'), 'Free plan');
  assert.match(source('src/components/services/MoreServicesPage.tsx'), /getAfaConfig\(\)/);
});

test('categories are derived from the catalogue (no empty filters) and include TV & Entertainment', () => {
  const cats = serviceCategories(DIGITAL_SERVICES);
  assert.ok(cats.every(c => c.count > 0));
  assert.equal(cats.reduce((n, c) => n + c.count, 0), DIGITAL_SERVICES.length);
  assert.ok(cats.some(c => c.label === 'TV & Entertainment'));
  assert.equal(categorySlug('TV & Entertainment'), 'tv-and-entertainment');
});

test('search is local, word-based and uses keywords', () => {
  const ids = (q: string, category = 'all') => filterServices(DIGITAL_SERVICES, { q, category }).map(s => s.id);
  assert.deepEqual(ids('electricity'), ['srv-ecg']);
  assert.deepEqual(ids('light bill'), ['srv-ecg']);
  assert.deepEqual(ids('dstv'), ['srv-tv']);
  assert.deepEqual(ids('laptop'), ['srv-marketplace']);
  assert.deepEqual(ids('  '), DIGITAL_SERVICES.map(s => s.id));
  assert.deepEqual(ids('zzzz'), []);
  assert.deepEqual(ids('', 'bills-and-utilities'), ['srv-ecg', 'srv-water']);
  assert.ok(!source('src/components/services/MoreServicesPage.tsx').includes('fetch('));
});

test('preview URL state: stable slugs, defensive parsing, safe fallbacks', () => {
  assert.equal(serviceSlug(byId('srv-ecg')), 'ecg');
  assert.equal(findServiceBySlug(DIGITAL_SERVICES, 'ECG')?.id, 'srv-ecg');
  assert.equal(findServiceBySlug(DIGITAL_SERVICES, 'srv-tv')?.id, 'srv-tv');
  assert.equal(findServiceBySlug(DIGITAL_SERVICES, 'nope'), undefined);
  assert.deepEqual(readServicesUrl('?service=tv&q=x&category=bogus', DIGITAL_SERVICES), { service: 'tv', q: 'x', category: 'all' });
  assert.equal(readServicesUrl('?service=' + 'a'.repeat(500), DIGITAL_SERVICES).service.length, 64);
  assert.equal(servicesHref({ service: 'ecg', q: 'ignored' }), '/services?service=ecg');
  assert.equal(servicesHref({ q: 'tv', category: 'education' }), '/services?q=tv&category=education');
  assert.equal(servicesHref({ category: 'all' }), '/services');
  // Query state never changes the page the router resolves (static Render rewrite stays compatible).
  assert.equal(getPageFromPath('/services?service=ecg'), 'services');
});

test('the waitlist opens only from the preview, keeps its API payload and makes no delivery promise', () => {
  const preview = source('src/components/services/ServicePreview.tsx');
  assert.match(preview, /onClick=\{\(\) => onNotify\(service\)\}/);
  assert.match(preview, /Not available yet\./);
  assert.doesNotMatch(preview, /<input|<form|type="submit"/);
  assert.doesNotMatch(source('src/components/services/MoreServicesPage.tsx'), /openWaitlist\(service\.title\)/);
  const modal = source('src/components/common/WaitlistModal.tsx');
  assert.match(modal, /joinWaitlistOnServer\(/);
  assert.match(modal, /serviceKey: serviceKey \|\| 'general_waitlist'/);
  assert.doesNotMatch(modal, /We will notify you via/);
  assert.match(modal, /does not sign you up for other promotions/);
});

test('directory never requests account data to render', () => {
  const page = source('src/components/services/MoreServicesPage.tsx');
  for (const call of ['getAccountOrdersOnServer', 'getFinance', 'getWallet', 'sessionToken']) assert.ok(!page.includes(call), call);
});
