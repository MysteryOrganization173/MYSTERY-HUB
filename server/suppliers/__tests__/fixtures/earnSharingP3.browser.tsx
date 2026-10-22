/**
 * Real-component browser regressions. Build with the existing Vite React plugin,
 * alias /context/AppContext imports to earnSharingP3Context.tsx, and open locally.
 * Results appear in #regression-results. No native share, real clipboard, API,
 * account, payment or database is used. Delayed operations are explicitly resolved.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { EarnSharing } from '../../../../src/components/earn/EarnSharing';
import { PostPurchaseInvite } from '../../../../src/components/checkout/PostPurchaseInvite';
import { SharingFixtureContext } from './earnSharingP3Context';
import type { EarnSummary } from '../../../../src/utils/earnExperience';
import type { OrderRecord } from '../../../../src/types';

const host = document.createElement('div'); document.body.append(host);
const output = document.createElement('pre'); output.id = 'regression-results'; document.body.append(output);
const root = createRoot(host);
const deferred = <T,>() => { let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
let clips: Array<ReturnType<typeof deferred<void>> & { text: string }> = [];
let shares: Array<ReturnType<typeof deferred<void>> & { data: ShareData }> = [];
let summaries: Array<ReturnType<typeof deferred<Response>>> = [];
let toasts: string[] = [], mount = 0;
const summary = (code = 'MH-ABC123'): EarnSummary => ({ code, shareUrl: `${location.origin}/?ref=${code}`, isEnabled: true,
  clicksCount: 0, rawClicksCount: 0, uniqueVisitorsCount: 0, referredCustomersCount: 0,
  pendingRewardsMinor: 0, pendingRewardsGhc: 0, approvedRewardsMinor: 0, approvedRewardsGhc: 0, totalRewardsMinor: 0, totalRewardsGhc: 0 });
const pause = () => new Promise<void>(resolve => setTimeout(resolve, 0));
async function settle() { await pause(); await pause(); }
function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const copy = () => host.querySelector<HTMLButtonElement>('button[aria-label$=" referral link"]')!;
const topic = (id: string) => host.querySelector<HTMLInputElement>(`input[value="${id}"]`)!.click();
function reset() { flushSync(() => root.render(null)); clips = []; shares = []; summaries = []; toasts = []; mount++; }
function render(mode: 'studio' | 'invite', options: { token?: string; user?: string; code?: string; enabled?: boolean; service?: OrderRecord['serviceType'] } = {}) {
  const state = { user: { id: options.user || 'synthetic-A', name: 'Synthetic' }, sessionToken: options.token || 'synthetic-session-A',
    showToast: (message: string) => { toasts.push(message); } };
  const order = { id: 'synthetic-only', publicReference: 'synthetic-only', journey: 'direct_checkout', status: 'delivered', serverStatus: 'delivered',
    serviceType: options.service || 'data', createdAt: new Date().toISOString() } as OrderRecord;
  flushSync(() => root.render(<SharingFixtureContext.Provider key={mount} value={state}>{mode === 'studio'
    ? <EarnSharing summary={{ ...summary(options.code), isEnabled: options.enabled !== false }} unavailable={false} loading={false} />
    : <PostPurchaseInvite order={order} onExplore={() => {}} />}</SharingFixtureContext.Provider>));
}
function resolveSummary(index: number, code = 'MH-ABC123', enabled = true) {
  summaries[index].resolve(new Response(JSON.stringify({ success: true, summary: { ...summary(code), isEnabled: enabled } }), { headers: { 'Content-Type': 'application/json' } }));
}
function inviteUrl() { const anchor = [...host.querySelectorAll('a')].find(a => a.textContent?.trim() === 'Share my link');
  if (!anchor) return null; const message = new URL(anchor.href).searchParams.get('text')!; return new URL(message.slice(message.lastIndexOf('http'))); }
Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (text: string) => { const row = { ...deferred<void>(), text }; clips.push(row); return row.promise; } } });
Object.defineProperty(navigator, 'share', { configurable: true, value: (data: ShareData) => { const row = { ...deferred<void>(), data }; shares.push(row); return row.promise; } });
window.fetch = async () => { const row = deferred<Response>(); summaries.push(row); return row.promise; };
// Prevent old synthetic invitation dismissal from influencing this isolated harness.
localStorage.removeItem('mh_earn_invite_v1');
const results: Array<{ name: string; passed: boolean; error?: string }> = [];
async function test(name: string, run: () => Promise<void>) {
  reset(); try { await run(); results.push({ name, passed: true }); } catch (e) { results.push({ name, passed: false, error: String(e) }); }
  output.textContent = JSON.stringify({ complete: false, results }, null, 2);
}

await test('late clipboard success is ignored after topic change', async () => {
  render('studio'); topic('data'); await settle(); copy().click(); await settle(); check(clips.length === 1, 'clipboard did not start');
  topic('afa'); await settle(); clips[0].resolve(); await settle();
  check(!host.textContent?.includes('Copied') && !toasts.length, 'old success appeared on new topic');
});
await test('late clipboard failure cannot expose old topic manual-copy text', async () => {
  render('studio'); copy().click(); await settle(); topic('afa'); await settle(); clips[0].reject(new Error('Synthetic rejection')); await settle();
  check(!host.querySelector('#earn-manual-link') && !toasts.length, 'stale failure/manual text appeared');
});
for (const outcome of ['success', 'failure'] as const) await test(`late native ${outcome} is ignored after topic change`, async () => {
  render('studio'); host.querySelector<HTMLButtonElement>('[aria-label="More sharing options"]')!.click(); await settle();
  topic('data'); await settle(); if (outcome === 'success') shares[0].resolve(); else shares[0].reject(new Error('Synthetic unavailable')); await settle();
  check(!toasts.length && !clips.length, 'stale native response produced a toast or fallback copy');
});
await test('old completion cannot clear a newer topic operation', async () => {
  render('studio'); copy().click(); await settle(); topic('afa'); await settle(); copy().click(); await settle();
  clips[0].resolve(); await settle(); check(copy().disabled && !toasts.length, 'old completion released new operation');
  clips[1].reject(new Error('Synthetic unavailable')); await settle();
  const manual = host.querySelector<HTMLInputElement>('#earn-manual-link')!;
  check(new URL(manual.value).pathname === '/afa' && new URL(manual.value).searchParams.get('ref') === 'MH-ABC123', 'current manual fallback lost destination/attribution');
});
for (const change of ['token', 'user', 'code', 'disabled'] as const) await test(`late feedback is ignored after ${change} change`, async () => {
  render('studio'); copy().click(); await settle(); render('studio', change === 'token' ? { token: 'synthetic-session-B' }
    : change === 'user' ? { user: 'synthetic-B' } : change === 'code' ? { code: 'MH-XYZ789' } : { enabled: false });
  await settle(); clips[0].resolve(); await settle(); check(!toasts.length && !host.textContent?.includes('Copied'), 'stale session feedback');
});
await test('late native share feedback is ignored after session rotation', async () => {
  render('studio'); host.querySelector<HTMLButtonElement>('[aria-label="More sharing options"]')!.click(); await settle();
  render('studio', { token: 'synthetic-session-B' }); await settle(); shares[0].resolve(); await settle();
  check(!toasts.length && !clips.length, 'old session native feedback appeared');
});
await test('current operation still reports success and keeps attributed service link', async () => {
  render('studio'); topic('data'); await settle(); copy().click(); await settle();
  check(new URL(clips[0].text).pathname === '/data' && new URL(clips[0].text).searchParams.get('ref') === 'MH-ABC123', 'wrong copy attribution');
  clips[0].resolve(); await settle(); check(toasts.length === 1 && host.textContent?.includes('Copied'), 'current success suppressed');
  topic('afa'); await settle(); check(!host.textContent?.includes('Copied'), 'completed copy label survived topic change');
});
for (const [service, path] of [['data', '/data'], ['instant_bundle', '/data'], ['afa', '/afa'], ['airtime', '/']] as const) await test(`invitation ${service} uses ${path} with attribution`, async () => {
  render('invite', { service }); await settle(); resolveSummary(0); await settle(); const url = inviteUrl();
  check(url?.origin === location.origin && url?.pathname === path && url?.searchParams.get('ref') === 'MH-ABC123', 'wrong invitation destination/identity');
});
await test('invitation discards delayed response from previous session', async () => {
  render('invite'); await settle(); render('invite', { token: 'synthetic-session-B', user: 'synthetic-B' }); await settle();
  resolveSummary(0); await settle(); check(!inviteUrl(), 'old session link appeared'); resolveSummary(1, 'MH-XYZ789'); await settle();
  check(inviteUrl()?.searchParams.get('ref') === 'MH-XYZ789' && inviteUrl()?.pathname === '/data', 'new session link incorrect');
});
await test('service switch invalidates delayed invitation route and resolves fresh AFA link', async () => {
  render('invite', { service: 'data' }); await settle(); render('invite', { service: 'afa' }); await settle();
  resolveSummary(0); await settle(); check(!inviteUrl(), 'old service response became visible'); resolveSummary(1); await settle();
  check(inviteUrl()?.pathname === '/afa', 'new service destination incorrect');
});
await test('ready invitation hides the old route while the service changes', async () => {
  render('invite'); await settle(); resolveSummary(0); await settle(); check(inviteUrl()?.pathname === '/data', 'Data not ready');
  render('invite', { service: 'afa' }); check(!inviteUrl(), 'ready Data URL leaked into AFA'); await settle(); resolveSummary(1); await settle(); check(inviteUrl()?.pathname === '/afa', 'AFA not ready');
});
for (const code of ['MH-ABC123', 'invalid-code']) await test(`disabled or invalid invitation profile ${code} stays unshared`, async () => {
  render('invite'); await settle(); resolveSummary(0, code, code !== 'MH-ABC123'); await settle(); check(!inviteUrl(), 'invalid profile shared');
});
flushSync(() => root.render(null));
output.textContent = JSON.stringify({ complete: true, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results }, null, 2);
