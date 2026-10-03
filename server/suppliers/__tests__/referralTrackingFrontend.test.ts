import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
import { initReferralCapture, observeReferralNavigation } from '../../../src/utils/referralCapture.js';
import { createEarnDashboardRefresh } from '../../../src/utils/earnDashboardRefresh.js';

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalLocal = globalThis.localStorage;
const originalSession = globalThis.sessionStorage;
let sequence = 0;
let code = '';
let calls: any[] = [];
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function storage(): Storage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); }, clear: () => values.clear(), key: () => null,
    get length() { return values.size; } };
}
beforeEach(() => {
  calls = []; code = `MH-FRONTEND${++sequence}`;
  const surface = new EventTarget() as any;
  surface.location = { pathname: '/', search: `?ref=${code}` };
  surface.history = {
    pushState: (_state: unknown, _title: string, path: string) => { const url = new URL(path, 'https://example.test'); surface.location.pathname = url.pathname; surface.location.search = url.search; },
    replaceState: (_state: unknown, _title: string, path: string) => { const url = new URL(path, 'https://example.test'); surface.location.pathname = url.pathname; surface.location.search = url.search; },
  };
  globalThis.window = surface; globalThis.localStorage = storage(); globalThis.sessionStorage = storage();
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options!.body as string));
    return { ok: true, json: async () => ({ success: true, valid: true, clickRecorded: true, attributionRecorded: true, code }) } as Response;
  };
});
afterEach(() => { globalThis.fetch = originalFetch; globalThis.window = originalWindow;
  globalThis.localStorage = originalLocal; globalThis.sessionStorage = originalSession; });

test('failed click persistence does not poison browser dedup; retry retains capture ID', async () => {
  let failed = true;
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options!.body as string));
    return { ok: true, json: async () => ({ success: true, valid: true, clickRecorded: !failed, attributionRecorded: true }) } as Response;
  };
  await initReferralCapture(); assert.equal(sessionStorage.getItem('mh_last_captured_ref'), null);
  failed = false; await initReferralCapture(); assert.equal(sessionStorage.getItem('mh_last_captured_ref'), code);
  await initReferralCapture(); assert.equal(calls.length, 2); assert.equal(calls[0].captureId, calls[1].captureId);
});
test('simultaneous capture and normal same-session navigation make one request', async () => {
  await Promise.all([initReferralCapture(), initReferralCapture(), initReferralCapture()]);
  await initReferralCapture(); assert.equal(calls.length, 1);
});
test('old false-success markers without a persisted retry ID cannot suppress a current capture', async () => {
  sessionStorage.setItem('mh_last_captured_ref', code);
  await initReferralCapture(); assert.equal(calls.length, 1);
});
test('successful analytics with failed attribution allows safe attribution retry using the same click ID', async () => {
  let bound = false;
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options!.body as string));
    return { ok: true, json: async () => ({ success: true, valid: true, clickRecorded: true, attributionRecorded: bound }) } as Response;
  };
  await initReferralCapture(); bound = true; await initReferralCapture(); await initReferralCapture();
  assert.equal(calls.length, 2); assert.equal(calls[0].captureId, calls[1].captureId);
});
test('authentication can bind attribution without requesting a new click ID', async () => {
  await initReferralCapture(); await initReferralCapture('fixture-session'); await initReferralCapture('fixture-session');
  assert.equal(calls.length, 2); assert.equal(calls[0].captureId, calls[1].captureId);
});
test('pushState and popstate capture new codes including same-page query changes; cleanup restores history', async () => {
  const original = window.history.pushState;
  const dispose = observeReferralNavigation(() => { void initReferralCapture(); });
  await tick();
  window.history.pushState({}, '', `/?ref=${code}B`); await tick();
  window.history.pushState({}, '', '/data'); await tick();
  assert.equal(calls.length, 2);
  window.location.search = `?ref=${code}C`; window.dispatchEvent(new Event('popstate')); await tick();
  assert.equal(calls.length, 3);
  dispose(); assert.equal(window.history.pushState, original);
  window.dispatchEvent(new Event('popstate')); await tick(); assert.equal(calls.length, 3);
});
test('storage failures do not prevent capture and transient visitor identity stays stable', async () => {
  const broken = { getItem: () => { throw new Error('storage disabled'); }, setItem: () => { throw new Error('storage disabled'); } } as any;
  globalThis.localStorage = broken; globalThis.sessionStorage = broken;
  await initReferralCapture(); await initReferralCapture();
  assert.equal(calls.length, 1); assert.ok(calls[0].visitorKey.startsWith('vk_transient_'));
});

test('manual and focus refresh update metrics; failure keeps last good summary and ledger', async () => {
  const surface = new EventTarget() as any; const document = new EventTarget() as any; document.hidden = false;
  let fail = false; let count = 1; let summary = 0; let ledger: number[] = []; let error: string | null = null;
  const controller = createEarnDashboardRefresh({
    loadSummary: async () => { if (fail) throw new Error('offline'); return { success: true, summary: count }; },
    loadLedger: async () => { if (fail) throw new Error('offline'); return { success: true, ledger: [count] }; },
    onSummary: value => { summary = value; }, onLedger: value => { ledger = value; },
    onState: value => { error = value.error; }, window: surface, document,
  });
  await controller.refresh(); assert.equal(summary, 1);
  count = 2; surface.dispatchEvent(new Event('focus')); await tick(); assert.equal(summary, 2);
  fail = true; await controller.refresh(); assert.equal(summary, 2); assert.deepEqual(ledger, [2]); assert.ok(error);
  fail = false; count = 3; document.dispatchEvent(new Event('visibilitychange')); await tick(); assert.equal(summary, 3); assert.equal(error, null);
  document.hidden = true; count = 4; surface.dispatchEvent(new Event('focus')); await tick(); assert.equal(summary, 3);
  controller.dispose(); document.hidden = false; surface.dispatchEvent(new Event('focus')); await tick(); assert.equal(summary, 3);
});
test('overlapping refresh triggers share a request and disposed responses cannot update state', async () => {
  const surface = new EventTarget() as any; const document = new EventTarget() as any; document.hidden = false;
  let release!: (value: { success: boolean; summary: number }) => void; let loads = 0; let updates = 0;
  const controller = createEarnDashboardRefresh<number, number[]>({ loadSummary: () => { loads++; return new Promise(resolve => { release = resolve; }); },
    loadLedger: async () => ({ success: true, ledger: [] }), onSummary: () => { updates++; }, onLedger: () => { updates++; },
    onState: () => {}, window: surface, document });
  const pending = controller.refresh(); surface.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(loads, 1); controller.dispose(); release({ success: true, summary: 10 }); await pending; assert.equal(updates, 0);
});
