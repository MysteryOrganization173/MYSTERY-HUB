// Mystery Hub 3.6.3 · the Service Control Center (Release B), carrying the Release A emergency MTN Data pause.
// Synthetic accounts and mocked payment and supplier calls only; no external request can leave this process.
// Guards: the shipped default is the Release A record, MTN standard Data only; a pause is enforced on the server for
// Data (catalogue), Instant Bundles and Airtime, scope by scope; "Operational" never overrides any other restriction;
// Admin changes are validated, version-checked and audited; announcements never pause or reopen a service; the public
// projection carries customer words only; the date is never a switch; one shared snapshot, cached and single-flight.
import assert from 'node:assert/strict';
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { FinanceStore } from '../../db/financeStore.js';
import { AuthStore } from '../../db/authStore.js';
import { OrdersStore } from '../../db/ordersStore.js';
import { AdminAuditStore } from '../../db/adminAuditStore.js';
import { PaystackServerService as P } from '../../services/paystackService.js';
import { FulfilmentService as F } from '../../services/fulfilmentService.js';
import { CommercialService } from '../../services/commercialService.js';
import { ServiceControlService as S } from '../../services/serviceControlService.js';
import { apiRouter } from '../../routes/api.js';
import { adminRouter } from '../../routes/adminApi.js';
import { SHIPPED_CONTROLS, SHIPPED_CONTROLS_VERSION, SERVICE_SCOPES, controlFor, normalizeControls, publicControls, restorationDateLabel, restorationLine, blocksPurchases } from '../../../shared/serviceControls.js';
import { SHIPPED_ANNOUNCEMENTS, announcementProblems, announcementsFor, isLiveAnnouncement, normalizeAnnouncements, publicAnnouncements } from '../../../shared/announcements.js';
import { getServiceStatus, parseServiceStatus, purchasePaused, setServiceStatusForTests } from '../../../src/hooks/useServiceStatus.js';

const source = (path: string) => readFileSync(path, 'utf8');
const code = (path: string) => source(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const SUPPLIER_WORDS = /success\s*biz|brainiac|supplier|reseller|vendor|wholesale|upstream/i;
const PROMISES = /refunded|will be refunded|refund(s)? (has|have) been|guarantee|nationwide|MTN Ghana (has )?confirm/i;

const originalFetch = globalThis.fetch, init = P.initializeTransaction, airtimePreflight = F.preflightCheckAirtime, preflight = F.preflightCheck, clock = S.now;
const client = F.getProvider().client as any, instantCheck = client.checkInstantBundlesService, instantList = client.getInstantBundles;
let server: Server, base: string, paystackCalls = 0;
const request = (path: string, body?: unknown, token: string | null = 'admin-token') => originalFetch(base + '/api/' + path, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const adminView = async () => (await request('admin/service-control')).json();
const saveControl = async (body: Record<string, unknown>, token: string | null = 'admin-token') => {
  const version = body.expectedVersion ?? (await adminView()).controls.version;
  return request('admin/service-control/control', { title: 'Service update', message: 'Purchases are paused for now.', existingOrders: 'Existing orders remain trackable.', expectedRestoration: null, confirmed: true, ...body, expectedVersion: version }, token);
};
const draft = { name: 'Synthetic notice', title: 'Synthetic update', summary: 'A synthetic summary.', details: '', severity: 'info', scope: 'global', placement: 'bar', pages: ['home'], audience: 'everyone', dismissible: true, startsAt: null, endsAt: null, expectedRestoration: null, cta: null };
const announce = async (body: Record<string, unknown>) => {
  const version = body.expectedVersion ?? (await adminView()).announcements.version;
  return request('admin/service-control/announcement', { confirmed: true, ...body, expectedVersion: version });
};
const instantCatalogue = [
  { id: 'mtn-video', name: 'MTN Video 2GB', network: 'mtn', priceMinor: 500, enabled: true, available: true },
  { id: 'tc-video', name: 'Telecel Video 2GB', network: 'telecel', priceMinor: 500, enabled: true, available: true },
];

before(async () => {
  const app = express(); app.use(express.json()); app.use('/api', apiRouter); app.use('/api/admin', adminRouter);
  server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  globalThis.fetch = originalFetch; P.initializeTransaction = init; F.preflightCheckAirtime = airtimePreflight; F.preflightCheck = preflight; S.now = clock;
  client.checkInstantBundlesService = instantCheck; client.getInstantBundles = instantList;
  S.useShippedDefaultsForTests(false);
});
beforeEach(async () => {
  process.env.NODE_ENV = 'test'; delete process.env.DATABASE_URL;
  FinanceStore._reset(); OrdersStore.clearDevStore(); AuthStore._clearDevStore(); AdminAuditStore._clearDevStore();
  S.useShippedDefaultsForTests(false); S.now = clock;
  for (const [id, role] of [['admin', 'admin'], ['buyer', 'customer']] as const) {
    await AuthStore.createUser({ id, name: id, email: `${id}@fixture.test`, phone: null, passwordHash: 'fixture', role });
    await AuthStore.createSession(id, `${id}-token`);
  }
  globalThis.fetch = async () => { throw Error('External network prohibited'); };
  paystackCalls = 0;
  P.initializeTransaction = async (p: any) => { paystackCalls++; return { success: true, reference: p.reference, accessCode: 'fixture', authorizationUrl: 'https://checkout.paystack.com/fixture' }; };
  F.preflightCheckAirtime = async () => ({ allowed: true } as any); F.preflightCheck = async () => ({ allowed: true, supplierCostMinor: 400 } as any);
  client.checkInstantBundlesService = async () => ({ permitted: true, available: true });
  client.getInstantBundles = async () => ({ success: true, data: instantCatalogue });
});

// ───────────────────────── The shipped default: the Release A record, unchanged ─────────────────────────

test('with nothing saved, the shipped default is the Release A pause: MTN standard Data only, and frozen', () => {
  const doc = normalizeControls(undefined);
  assert.deepEqual([doc.version, doc.source, doc.controls.length], [SHIPPED_CONTROLS_VERSION, 'shipped-default', 1]);
  const mtn = controlFor(doc, 'data', 'mtn')!;
  assert.deepEqual([mtn.scope, mtn.state, blocksPurchases(mtn.state)], ['data:mtn', 'maintenance', true]);
  assert.equal(controlFor(doc, 'data', 'MTN')?.state, 'maintenance');
  for (const [service, network] of [['instant_bundle', 'mtn'], ['airtime', 'mtn'], ['data', 'telecel'], ['data', 'airteltigo']]) {
    assert.equal(controlFor(doc, service, network)?.state, 'operational', `${service} ${network} is not paused by the emergency record`);
  }
  assert.equal(Object.isFrozen(SHIPPED_CONTROLS) && Object.isFrozen(SHIPPED_CONTROLS[0]) && Object.isFrozen(SHIPPED_ANNOUNCEMENTS[0]), true);
  assert.equal(SERVICE_SCOPES.length, 9, 'Data, Instant Bundles and Airtime for each of the three networks');
});

test('customer copy is the approved meaning, names no supplier and promises neither a refund nor a date', () => {
  const [mtn] = SHIPPED_CONTROLS, [notice] = SHIPPED_ANNOUNCEMENTS;
  assert.equal(mtn.title, 'MTN Data service update');
  assert.equal(mtn.message, 'MTN Data bundle purchases are temporarily suspended due to ongoing maintenance and system upgrades.');
  assert.equal(mtn.existingOrders, 'Existing orders remain trackable. Affected transactions will be reviewed accordingly.');
  assert.match(notice.details, /We will announce once MTN Data services are restored\.$/);
  const publicWords = JSON.stringify([publicControls(normalizeControls(undefined)), publicAnnouncements(normalizeAnnouncements(undefined))]);
  assert.doesNotMatch(publicWords, SUPPLIER_WORDS, 'no upstream supplier is named');
  assert.doesNotMatch(publicWords, PROMISES);
  assert.equal(restorationDateLabel('2026-12-01'), 'Tuesday, December 1, 2026');
  assert.deepEqual([notice.scope, notice.placement, notice.pages, notice.dismissible, notice.cta, notice.status], ['data:mtn', 'bar', ['home', 'orders', 'help'], true, 'track_order', 'published']);
});

test('the expected date is an expectation, never a switch: the pause holds after it passes', async () => {
  assert.deepEqual(restorationLine('2026-12-01', '2026-11-25'), { label: 'Expected resumption: Tuesday, December 1, 2026.', overdue: false });
  assert.equal(restorationLine('2026-12-01', '2026-12-01')!.overdue, false);
  const late = restorationLine('2026-12-01', '2026-12-02')!;
  assert.equal(late.overdue, true);
  assert.match(late.label, /Restoration is awaiting confirmation; purchases stay paused/);
  assert.match(restorationLine('2026-12-01', '2026-12-02', false)!.label, /^We expected normal service by/);
  S.useShippedDefaultsForTests(true);
  S.now = () => new Date('2027-01-15T12:00:00Z');
  assert.ok(await S.purchaseBlock('data', 'mtn'), 'still paused weeks after the expected date');
  assert.equal((await S.publicStatus()).serverDate, '2027-01-15');
  for (const file of ['shared/serviceControls.ts', 'shared/announcements.ts', 'server/services/serviceControlService.ts']) assert.doesNotMatch(code(file), /setTimeout|setInterval|cron/i, file);
  const service = code('server/services/serviceControlService.ts');
  assert.doesNotMatch(service.slice(service.indexOf('static async purchaseBlock'), service.indexOf('static async publicStatus')), /expectedRestoration|now\(|Date/, 'the pause never depends on the date');
});

// ───────────────────────── Enforcement on the server ─────────────────────────

test('the catalogue leaves a paused network out, restores it exactly when operational, and keeps other networks', async () => {
  const open = await CommercialService.catalog();
  assert.ok(open.products.some((p) => p.network === 'mtn'), 'the regression suite starts with nothing paused');
  S.useShippedDefaultsForTests(true);
  const paused = await CommercialService.catalog();
  assert.equal(paused.products.some((p) => p.network === 'mtn'), false, 'no MTN Data product is offered');
  assert.deepEqual(paused.products.map((p) => p.id), open.products.filter((p) => p.network !== 'mtn').map((p) => p.id), 'every other network is unchanged');
  await assert.rejects(CommercialService.quote('mtn-1gb'), (e: any) => e.status === 404, 'no quote for a paused bundle');
  const other = paused.products.find((p) => p.network !== 'mtn')!;
  assert.ok((await CommercialService.quote(other.id)).totalMinor > 0, 'other networks still quote');
  // The founder saves MTN Data as Operational: the saved record now rules, and MTN Data is offered again.
  assert.equal((await saveControl({ scope: 'data:mtn', state: 'operational' })).status, 200);
  assert.deepEqual((await CommercialService.catalog()).products.map((p) => p.id), open.products.map((p) => p.id));
  // Pausing one network's Data never touches the others.
  assert.equal((await saveControl({ scope: 'data:telecel', state: 'suspended' })).status, 200);
  const telecelOff = await CommercialService.catalog();
  assert.equal(telecelOff.products.some((p) => p.network === 'telecel'), false);
  assert.ok(telecelOff.products.some((p) => p.network === 'mtn') && telecelOff.products.some((p) => p.network === 'airteltigo'));
});

test('Operational never overrides another restriction: a product switched off in Commercial pricing stays off', async () => {
  const id = (await CommercialService.catalog()).products.find((p) => p.network === 'mtn')!.id;
  await FinanceStore.transaction('admin', (tx) => tx.saveConfig('direct-pricing', { version: 'fixture-pricing', products: { [id]: { enabled: false } } }));
  assert.equal((await saveControl({ scope: 'data:mtn', state: 'operational' })).status, 200);
  assert.equal((await CommercialService.catalog()).products.some((p) => p.id === id), false, 'the product switch still applies');
  const view = await adminView();
  const scope = view.scopes.find((s: any) => s.id === 'data:mtn');
  assert.equal(scope.control.state, 'operational');
  assert.equal(scope.products.enabled, scope.products.total - 1, 'the card shows the product restriction that still applies');
  // A delay warns but never blocks.
  assert.equal((await saveControl({ scope: 'data:mtn', state: 'delayed' })).status, 200);
  assert.ok((await CommercialService.catalog()).products.some((p) => p.network === 'mtn'));
  assert.equal(await S.purchaseBlock('data', 'mtn'), null);
});

test('Instant Bundles and Airtime refuse a paused network at payment start, before any payment or order', async () => {
  assert.equal((await saveControl({ scope: 'instant_bundle:mtn', state: 'maintenance', title: 'MTN Instant Bundles update' })).status, 200);
  assert.equal((await saveControl({ scope: 'airtime:mtn', state: 'suspended', title: 'MTN Airtime update' })).status, 200);
  const instant = await request('payments/initialize', { productId: 'instant-mtn-video', serviceType: 'instant_bundle', recipientPhone: '0241234567' }, null);
  assert.equal(instant.status, 503);
  const instantBody = await instant.json();
  assert.equal(instantBody.code, 'SERVICE_TEMPORARILY_UNAVAILABLE');
  assert.match(instantBody.error, /^MTN Instant Bundles update\. New purchases are paused for now\. No payment has been taken\.$/);
  const airtime = await request('payments/initialize', { productId: 'airtime-mtn-10', serviceType: 'airtime', network: 'mtn', recipientPhone: '0241234567', amount: 10 }, null);
  assert.equal(airtime.status, 503);
  assert.match((await airtime.json()).error, /^MTN Airtime update\. New purchases are paused/);
  const wallet = await request('payments/initialize', { productId: 'airtime-mtn-10', serviceType: 'airtime', network: 'mtn', recipientPhone: '0241234567', amount: 10, paymentMethod: 'wallet', requestId: 'fixture-wallet-1' }, 'buyer-token');
  assert.equal(wallet.status, 503, 'a new Wallet purchase is refused the same way');
  assert.equal(paystackCalls, 0, 'no payment was started');
  assert.equal(await OrdersStore.findActiveMtnOrder('+233241234567'), null, 'no order was created');
  // Other networks are not affected by these pauses.
  const telecel = await request('payments/initialize', { productId: 'airtime-telecel-10', serviceType: 'airtime', network: 'telecel', recipientPhone: '0201111111', amount: 10 }, null);
  assert.notEqual((await telecel.json()).code, 'SERVICE_TEMPORARILY_UNAVAILABLE');
  // The public Instant list leaves the paused network out and keeps the rest.
  const list = await (await request('instant-bundles', undefined, null)).json();
  assert.deepEqual(list.products.map((p: any) => p.network), ['telecel']);
  // Reorder refuses the paused scopes without asking a supplier.
  const src = code('server/services/reorderService.ts');
  assert.match(src, /if \(await ServiceControlService\.purchaseBlock\('airtime', network\)\) return no\('unavailable'\);/);
  assert.match(src, /if \(await ServiceControlService\.purchaseBlock\('instant_bundle', product\.network\)\) return no\('unavailable', product\.network\);/);
});

test('payment start, reorder and the assistant refuse Data through the catalogue; recovery is checked first; nothing after payment reads the controls', () => {
  const api = code('server/routes/api.ts');
  const init = api.slice(api.indexOf('const recoverData=()=>recoverDirectCheckout'), api.indexOf('// 3a. MTN Duplicate Active Order Protection'));
  assert.match(init, /const existingCheckout=await recoverData\(\);[\s\S]*const product = \(await CommercialService\.catalog\(\)\)\.products\.find\(/, 'an existing checkout is recovered before the catalogue is consulted');
  assert.match(init, /if\(concurrent\|\|existingCheckout\)throw requireCheckoutRecovery/, 'a customer who already started paying is sent to recovery, never charged again');
  assert.match(code('server/services/reorderService.ts'), /dataCatalogue: \(\) => CommercialService\.catalog\(\)/);
  assert.match(code('server/services/commercialService.ts'), /paused=await ServiceControlService\.blockedNetworks\('data'\);/);
  assert.match(code('server/services/commercialService.ts'), /isActive:p\.isActive&&\(setting\?\.enabled\?\?true\)&&!paused\.has\(p\.network\),/);
  // The Instant guard sits before route resolution; the Airtime guard after network validation.
  const instantStart = api.indexOf("const pausedInstant = await ServiceControlService.purchaseBlock('instant_bundle', network);");
  assert.ok(instantStart > 0 && instantStart < api.indexOf("const supplierRoute = FulfilmentService.resolveRoute({service:'instant_bundle'"));
  assert.ok(api.indexOf("const pausedAirtime = await ServiceControlService.purchaseBlock('airtime', airtimeNet);") > api.indexOf("Please select a valid network (MTN, AirtelTigo, or Telecel)."));
  // A Wallet retry with a known request id is recovered before any new-purchase check.
  assert.ok(api.indexOf('FinanceService.recoverPurchase(req.user.id,old.payload.orderId)') < api.indexOf('const pausedAirtime'));
  for (const file of ['server/services/paystackService.ts', 'server/services/fulfilmentService.ts', 'server/services/financeService.ts']) assert.doesNotMatch(source(file), /ServiceControlService|serviceControls|announcements/, file);
  // In the router, every use sits before payment starts: verification, cancel and the webhooks never read it.
  const uses = [...api.matchAll(/ServiceControlService\./g)].map((m) => m.index!);
  assert.equal(uses.length, 3);
  assert.ok(uses.every((i) => i < api.indexOf("apiRouter.get('/payments/verify/:reference'")));
});

// ───────────────────────── Admin: safe, versioned, audited ─────────────────────────

test('only an administrator can read or change the Service Control Center', async () => {
  for (const token of [null, 'buyer-token']) {
    assert.ok([401, 403].includes((await request('admin/service-control', undefined, token)).status));
    const write = await request('admin/service-control/control', { scope: 'data:mtn', state: 'suspended', title: 'x', message: 'y', expectedVersion: 'test-empty', confirmed: true }, token);
    assert.ok([401, 403].includes(write.status));
    assert.ok([401, 403].includes((await request('admin/service-control/announcement', { action: 'create', announcement: draft, expectedVersion: 'test-empty', confirmed: true }, token)).status));
  }
  assert.equal(await S.purchaseBlock('data', 'mtn'), null, 'nothing was changed');
  const ok = await request('admin/service-control');
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('cache-control'), 'no-store');
});

test('a control change is validated, needs confirmation and the reviewed version, and is audited with its effect', async () => {
  const bad = async (body: Record<string, unknown>) => { const r = await saveControl(body); return [r.status, (await r.json()).error]; };
  assert.deepEqual(await bad({ scope: 'data:mtn', state: 'suspended', confirmed: false }), [400, 'Confirm this change.']);
  assert.deepEqual(await bad({ scope: 'data:vodafone', state: 'suspended' }), [400, 'Choose a service.']);
  assert.deepEqual(await bad({ scope: 'data:mtn', state: 'closed' }), [400, 'Choose an operating state.']);
  assert.equal((await bad({ scope: 'data:mtn', state: 'suspended', message: '<script>alert(1)</script>' }))[0], 400);
  assert.equal((await bad({ scope: 'data:mtn', state: 'suspended', title: 'x'.repeat(81) }))[0], 400);
  assert.deepEqual(await bad({ scope: 'data:mtn', state: 'maintenance', title: '' }), [400, 'Write the customer title and message for this state.']);
  assert.deepEqual(await bad({ scope: 'data:mtn', state: 'maintenance', expectedRestoration: '2026-02-30' }), [400, 'The expected restoration date is not valid.']);
  assert.equal(await S.purchaseBlock('data', 'mtn'), null, 'no rejected request changed anything');

  const before = await adminView();
  const saved = await saveControl({ scope: 'data:mtn', state: 'suspended', expectedRestoration: '2026-12-01', expectedVersion: before.controls.version });
  assert.equal(saved.status, 200);
  const result = await saved.json();
  assert.equal(result.view.scopes.find((s: any) => s.id === 'data:mtn').control.state, 'suspended');
  assert.equal(result.view.controls.source, 'saved');
  assert.ok(await S.purchaseBlock('data', 'mtn'), 'the server enforces it immediately (no stale cache)');
  // A second session that reviewed the old version is refused; the first change stands.
  const stale = await saveControl({ scope: 'data:mtn', state: 'operational', expectedVersion: before.controls.version });
  assert.equal(stale.status, 409);
  assert.match((await stale.json()).error, /Someone else changed the service controls/);
  assert.ok(await S.purchaseBlock('data', 'mtn'));
  const missing = await request('admin/service-control/control', { scope: 'data:mtn', state: 'operational', confirmed: true });
  assert.equal(missing.status, 409, 'a write without the reviewed version is refused');
  // Lift it (a stale date sent with Operational is dropped) and check the audit trail.
  assert.equal((await saveControl({ scope: 'data:mtn', state: 'operational', expectedRestoration: '2026-12-01' })).status, 200);
  assert.equal((await adminView()).scopes.find((s: any) => s.id === 'data:mtn').control.expectedRestoration, null);
  const audit = (await adminView()).audit;
  assert.deepEqual(audit.map((a: any) => a.action), ['service_control_changed', 'service_control_changed']);
  const [lifted, paused] = audit.map((a: any) => JSON.parse(a.metadata_safe_json));
  assert.deepEqual([paused.previous.state, paused.next.state, paused.effect], ['operational', 'suspended', 'new_purchases_refused']);
  assert.deepEqual([lifted.previous.state, lifted.next.state, lifted.next.expectedRestoration, lifted.effect], ['suspended', 'operational', null, 'manual_pause_lifted']);
  assert.equal(audit[0].admin_user_id, 'admin');
});

test('the first save over the shipped default keeps the emergency pause unless that scope is the one changed', async () => {
  S.useShippedDefaultsForTests(true);
  const view = await adminView();
  assert.deepEqual([view.controls.source, view.controls.version], ['shipped-default', SHIPPED_CONTROLS_VERSION]);
  assert.equal(view.scopes.find((s: any) => s.id === 'data:mtn').blocksPurchases, true);
  assert.equal((await saveControl({ scope: 'airtime:telecel', state: 'delayed', title: 'Telecel Airtime', message: 'May be slower.' })).status, 200);
  assert.ok(await S.purchaseBlock('data', 'mtn'), 'MTN Data stays paused after an unrelated first save');
  assert.equal((await adminView()).controls.source, 'saved');
});

// ───────────────────────── Announcements ─────────────────────────

test('announcement lifecycle: draft, publish, material edit, unpublish, archive; never a pause or a reopen', async () => {
  const created = await announce({ action: 'create', announcement: draft });
  assert.equal(created.status, 200);
  const { id } = await created.json();
  assert.equal((await S.publicStatus()).announcements.length, 0, 'a draft is not public');
  assert.equal((await announce({ action: 'publish', id })).status, 200);
  let live = (await S.publicStatus()).announcements;
  assert.deepEqual(live.map((a) => [a.id, a.revision]), [[id, 1]]);
  // A non-material edit (internal name) keeps the revision; a change of words bumps it so it shows again.
  assert.equal((await announce({ action: 'update', id, announcement: { ...draft, name: 'Renamed internally' } })).status, 200);
  assert.equal((await S.publicStatus()).announcements[0].revision, 1);
  assert.equal((await announce({ action: 'update', id, announcement: { ...draft, summary: 'A revised synthetic summary.' } })).status, 200);
  live = (await S.publicStatus()).announcements;
  assert.deepEqual([live[0].revision, live[0].summary], [2, 'A revised synthetic summary.']);
  assert.equal(await S.purchaseBlock('data', 'mtn'), null, 'publishing an announcement pauses nothing');
  assert.equal((await announce({ action: 'unpublish', id })).status, 200);
  assert.equal((await S.publicStatus()).announcements.length, 0);
  assert.equal((await announce({ action: 'archive', id })).status, 200);
  const edit = await announce({ action: 'update', id, announcement: draft });
  assert.equal(edit.status, 400, 'archived announcements cannot be edited');
  assert.equal((await announce({ action: 'publish', id })).status, 400, 'archived stays archived');
  const actions = (await adminView()).audit.map((a: any) => a.action).reverse();
  assert.deepEqual(actions, ['service_announcement_create', 'service_announcement_publish', 'service_announcement_update', 'service_announcement_update', 'service_announcement_unpublish', 'service_announcement_archive']);
});

test('announcements reject HTML, unknown actions and destinations, bad windows, and stale versions', async () => {
  const bad = async (patch: Record<string, unknown>) => (await announce({ action: 'create', announcement: { ...draft, ...patch } })).status;
  assert.equal(await bad({ title: '<b>Bold</b>' }), 400);
  assert.equal(await bad({ details: 'Click <a href="https://example.test">here</a>' }), 400);
  assert.equal(await bad({ cta: 'javascript:alert(1)' }), 400);
  assert.equal(await bad({ cta: 'https://example.test' }), 400);
  assert.equal(await bad({ pages: [] }), 400);
  assert.equal(await bad({ pages: ['admin'] }), 400);
  assert.equal(await bad({ scope: 'data:vodafone' }), 400);
  assert.equal(await bad({ startsAt: '2026-11-26T10:00:00.000Z', endsAt: '2026-11-26T09:00:00.000Z' }), 400);
  assert.equal(await bad({ dismissible: 'yes' }), 400);
  assert.equal((await announce({ action: 'delete-everything' })).status, 400);
  assert.equal((await announce({ action: 'create', announcement: draft, confirmed: false })).status, 400);
  const stale = await announce({ action: 'create', announcement: draft, expectedVersion: 'not-the-current-version' });
  assert.equal(stale.status, 409);
  assert.equal((await adminView()).announcements.items.length, 0, 'nothing was saved');
  assert.deepEqual(announcementProblems({ ...draft, cta: 'help' } as any), []);
});

test('an expired announcement stops showing, and expiry never lifts a pause', async () => {
  assert.equal((await saveControl({ scope: 'data:mtn', state: 'maintenance', title: 'MTN Data service update', message: 'Paused for maintenance.' })).status, 200);
  const created = await (await announce({ action: 'create', announcement: { ...draft, scope: 'data:mtn', endsAt: '2026-11-26T09:00:00.000Z' } })).json();
  assert.equal((await announce({ action: 'publish', id: created.id })).status, 200);
  S.now = () => new Date('2026-11-26T08:00:00Z');
  assert.equal((await S.publicStatus()).announcements.length, 1);
  S.now = () => new Date('2026-11-26T09:00:01Z');
  const after = await S.publicStatus();
  assert.equal(after.announcements.length, 0, 'ended');
  assert.deepEqual(after.controls.map((c) => [c.scope, c.blocksPurchases]), [['data:mtn', true]], 'the pause is untouched');
  assert.ok(await S.purchaseBlock('data', 'mtn'));
  const item = { ...draft, status: 'published', startsAt: '2026-11-26T10:00:00.000Z', endsAt: null } as any;
  assert.equal(isLiveAnnouncement(item, Date.parse('2026-11-26T09:59:59Z')), false, 'not before its start');
  assert.equal(isLiveAnnouncement(item, Date.parse('2026-11-26T10:00:00Z')), true);
});

test('the public projection carries customer words only: no internal names, actors, times or statuses', async () => {
  S.useShippedDefaultsForTests(true);
  const response = await request('service-status', undefined, null);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=30');
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ['announcements', 'controls', 'serverDate', 'version']);
  assert.deepEqual(Object.keys(body.controls[0]).sort(), ['blocksPurchases', 'existingOrders', 'expectedRestoration', 'message', 'network', 'revision', 'scope', 'service', 'state', 'title']);
  assert.deepEqual(Object.keys(body.announcements[0]).sort(), ['audience', 'cta', 'details', 'dismissible', 'expectedRestoration', 'id', 'pages', 'placement', 'revision', 'scope', 'severity', 'summary', 'title']);
  const text = JSON.stringify(body);
  assert.doesNotMatch(text, /actorId|updatedAt|"name"|startsAt|endsAt|"status"|Release A/);
  assert.doesNotMatch(text, SUPPLIER_WORDS);
  // Operational scopes are not listed at all.
  assert.equal(body.controls.length, 1);
  // The browser accepts only well-formed answers and drops anything operational or unknown.
  const parsed = parseServiceStatus({ ...body, controls: [...body.controls, { ...body.controls[0], scope: 'data:telecel', network: 'telecel', state: 'operational' }, { scope: 'x:y' }], announcements: [...body.announcements, { id: 1 }] })!;
  assert.deepEqual([parsed.controls.length, parsed.announcements.length, parsed.confirmed], [1, 1, true]);
  assert.equal(parseServiceStatus({ controls: 'nope' }), null);
});

test('an error never reopens a service: the last good snapshot applies, and with none the catalogue fails closed', async () => {
  S.useShippedDefaultsForTests(true);
  assert.ok(await S.purchaseBlock('data', 'mtn'));
  const read = FinanceStore.readConfig, realNow = Date.now;
  try {
    FinanceStore.readConfig = async () => { throw new Error('database unavailable'); };
    Date.now = () => realNow() + 60_000; // past the 15 s cache
    assert.ok(await S.purchaseBlock('data', 'mtn'), 'the last good snapshot keeps the pause');
    S.invalidate();
    await assert.rejects(S.blockedNetworks('data'), /database unavailable/);
    await assert.rejects(CommercialService.catalog(), 'no catalogue, so no quote or payment start');
    const status = await request('service-status', undefined, null);
    assert.equal(status.status, 503);
    assert.equal(status.headers.get('cache-control'), 'no-store');
  } finally { FinanceStore.readConfig = read; Date.now = realNow; S.invalidate(); }
});

test('one shared snapshot: cached for 15 s, single-flight, refreshed by a save', async () => {
  const read = FinanceStore.readConfig;
  let reads = 0;
  try {
    FinanceStore.readConfig = async (id: string) => { if (id.startsWith('service-')) reads++; return read(id); };
    S.invalidate();
    await Promise.all([S.publicStatus(), S.purchaseBlock('data', 'mtn'), S.blockedNetworks('instant_bundle'), CommercialService.catalog(), S.publicStatus()]);
    assert.equal(reads, 2, 'one read of each key for five concurrent callers');
    await S.publicStatus(); await CommercialService.catalog();
    assert.equal(reads, 2, 'served from the cache');
    assert.equal((await saveControl({ scope: 'data:airteltigo', state: 'suspended' })).status, 200);
    const afterSave = reads;
    assert.ok(await S.purchaseBlock('data', 'airteltigo'), 'a save in this process is visible at once');
    assert.equal(reads, afterSave + 2);
  } finally { FinanceStore.readConfig = read; S.invalidate(); }
  // The browser: one store, one endpoint, refreshed on focus (throttled) and every 5 minutes; never per card.
  const hook = code('src/hooks/useServiceStatus.ts');
  assert.equal((hook.match(/fetch\(/g) || []).length, 1);
  assert.match(hook, /if \(request\) return request;/);
  assert.match(hook, /Date\.now\(\) - lastAttempt < 30_000/);
  assert.match(hook, /setInterval\(\(\) => void refreshServiceStatus\(\), 5 \* 60_000\)/);
  assert.match(code('server/routes/serviceControlApi.ts'), /'Cache-Control', 'public, max-age=30'/);
});

// ───────────────────────── The browser reads the same status everywhere ─────────────────────────

test('outside the test runner the browser starts from the shipped record, and the status cannot be replaced', () => {
  const hook = code('src/hooks/useServiceStatus.ts');
  assert.match(hook, /: \{ version: 'shipped', serverDate: accraDate\(\), controls: publicControls\(normalizeControls\(undefined\)\), announcements: publicAnnouncements\(normalizeAnnouncements\(undefined\)\), confirmed: false \};/);
  assert.match(hook, /if \(!underNodeTest\) throw new Error\('Only tests can replace the service status\.'\);/);
  assert.match(code('server/services/serviceControlService.ts'), /if \(!underNodeTest\) throw new Error\('Only tests can change service control defaults\.'\);/);
  assert.match(code('shared/testRuntime.ts'), /process\.env\?\.NODE_TEST_CONTEXT \|\| process\.env\?\.NODE_ENV === 'test'/);
  // Under tests the store starts empty; a test can opt in.
  assert.equal(getServiceStatus().controls.length, 0);
  setServiceStatusForTests({ version: 't', serverDate: '2026-11-25', controls: publicControls(normalizeControls(undefined)), announcements: [], confirmed: true });
  assert.equal(purchasePaused('data', 'mtn'), true);
  assert.equal(purchasePaused('instant_bundle', 'mtn'), false);
  setServiceStatusForTests({ version: 'test-empty', serverDate: '2026-11-25', controls: [], announcements: [], confirmed: false });
});

test('every customer surface that could start a purchase reads the shared status', () => {
  assert.match(code('src/hooks/useDirectCatalog.ts'), /const offered=\(b:DataBundle\)=>!purchasePaused\('data',b\.network\);/);
  assert.match(code('src/hooks/useDirectCatalog.ts'), /onServiceStatusChange\(\(\)=>\{current=unfiltered\.filter\(offered\);/);
  const checkout = code('src/components/checkout/CheckoutModal.tsx');
  assert.match(checkout, /const pausedControl = serviceControl\(isAirtime \? 'airtime' : isInstantBundle \? 'instant_bundle' : 'data', checkoutBundle\.network, serviceStatus\);/);
  assert.match(checkout, /if \(pausedIncident && !awaitingPayment && !busy && !paymentClosed && !knownReference\.current && !recoveryLocked\.current\) \{/, 'an open payment window or known payment keeps its recovery path');
  assert.match(checkout, /purchasePaused\('data',checkoutBundle\.network\)\)\{setCommercial\(null\);return;\}/, 'no quote is requested for a paused bundle');
  const page = code('src/components/data/DataPage.tsx');
  assert.match(page, /<ServiceMaintenanceState control=\{activeIncident\}/);
  assert.match(page, /mtnNotice\.enabled && !serviceControl\('data', 'mtn', serviceStatus\)/, 'no "MTN delivery" line while MTN Data has a notice');
  assert.match(page, /if \(serviceControl\('airtime', airtimeNet, serviceStatus\)\?\.blocksPurchases\) return;/);
  assert.match(code('src/components/data/InstantBundlesCatalog.tsx'), /if \(serviceControl\('instant_bundle', p\.network, serviceStatus\)\?\.blocksPurchases\) return false;/);
  assert.match(code('src/components/data/InstantBundlesCatalog.tsx'), /<DataNetworkSelector value=\{selectedNetwork\} onChange=\{setSelectedNetwork\} paused=\{instantPaused\} delayed=\{instantDelayed\} \/>/);
  // The default network: first open one; until the customer picks, it moves off a network that becomes paused.
  const hook = code('src/hooks/useServiceStatus.ts');
  assert.match(hook, /const network = !chosen\.byCustomer && purchasePaused\(service, chosen\.network, status\) \? firstOpen\(\) : chosen\.network;/);
  for (const file of ['src/components/home/HomeFeaturedData.tsx', 'src/seasonal/christmas/home/ChristmasHome.tsx']) {
    const home = code(file);
    assert.match(home, /useOpenNetworkChoice<NetworkId>\('data', NETWORK_IDS, serviceStatus\)/, file);
    assert.match(home, /incident\?\.blocksPurchases \? <ServiceInlineNotice control=\{incident\}>/, file);
  }
  const app = code('src/App.tsx');
  assert.match(app, /<Navbar \/>\s*(\{\}\s*)?<AnnouncementBar page=\{activePage\} \/>/);
  assert.match(app, /<AnnouncementModal page=\{activePage\} blocked=\{isCheckoutOpen \|\| isStatusModalOpen \|\| isAuthModalOpen\} \/>/, 'the exceptional modal never covers checkout, a receipt or sign-in');
  const receipt = code('src/components/checkout/OrderStatusModal.tsx');
  assert.match(receipt, /const smartBuyAgain = delivered && Boolean\(sessionToken && user && activeOrder\.publicReference\) && repeatable && !pausedIncident;/);
  assert.match(receipt, /delivered && repeatable && !pausedIncident \? 'buy' : 'done'/);
  assert.match(code('src/context/AppContext.tsx'), /useState<NetworkId \| 'all'>\(\(\) => \(purchasePaused\('data', 'mtn'\) \? 'all' : 'mtn'\)\)/);
  assert.match(code('src/utils/memberHomePresentation.ts'), /if\(purchasePaused\(o\.service_type==='airtime'\?'airtime':o\.service_type==='instant_bundle'\?'instant_bundle':'data',o\.network\)\)return null;/);
  assert.match(code('src/services/mysteryAiOrders.ts'), /const paused=serviceControl\('data',draft\.network\);/);
  assert.doesNotMatch(source('src/components/service/ServiceUpdate.tsx') + source('src/components/admin/sections/AdminServiceControlCenter.tsx'), /dangerouslySetInnerHTML|innerHTML/, 'announcements render as text, never HTML');
});

test('dismissal hides a bar for its current revision only; pauses and contextual notices cannot be dismissed', () => {
  const ui = code('src/components/service/ServiceUpdate.tsx');
  assert.match(ui, /const keyOf = \(a: \{ id: string; revision: number \}\) => `\$\{a\.id\}:\$\{a\.revision\}`;/);
  assert.match(ui, /\.filter\(\(a\) => !\(a\.dismissible && dismissed\.includes\(keyOf\(a\)\)\)\)/);
  assert.doesNotMatch(ui.slice(ui.indexOf('export function ServiceMaintenanceState')), /dismiss/i, 'maintenance states and inline notices cannot be dismissed');
  assert.doesNotMatch(ui, /purchasePaused|blocksPurchases\s*=/, 'nothing here changes whether a purchase is allowed');
  // One bar at a time (highest priority first), the rest one tap away; no stacking.
  assert.match(ui, /const shown = list\[index % list\.length\];/);
  const list = publicAnnouncements({ version: 'v', source: 'saved', items: [
    { ...draft, id: 'a', status: 'published', severity: 'info', revision: 1, updatedAt: '2026-11-25T10:00:00Z', actorId: 'admin' },
    { ...draft, id: 'b', status: 'published', severity: 'critical', revision: 1, updatedAt: '2026-11-25T09:00:00Z', actorId: 'admin' },
    { ...draft, id: 'c', status: 'published', severity: 'info', audience: 'members', revision: 1, updatedAt: '2026-11-25T11:00:00Z', actorId: 'admin' },
  ] as any });
  assert.deepEqual(announcementsFor(list, 'home', false, 'bar').map((a) => a.id), ['b', 'a'], 'critical first; members-only hidden from guests');
  assert.deepEqual(announcementsFor(list, 'home', true, 'bar').map((a) => a.id), ['b', 'c', 'a']);
  assert.deepEqual(announcementsFor(list, 'orders', true, 'bar'), []);
  assert.deepEqual(announcementsFor([...list].reverse(), 'home', true, 'bar').map((a) => a.id), ['b', 'a', 'c'], 'the browser puts the most severe first whatever order arrives');
  const css = source('src/components/service/serviceUpdate.css');
  assert.doesNotMatch(css, /infinite/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('the Admin screen sends the reviewed version, confirms the effect first, and shows success only from the server', () => {
  const admin = code('src/components/admin/sections/AdminServiceControlCenter.tsx');
  assert.match(admin, /commercialRequest\(`admin\/service-control\/\$\{path\}`, token, \{ \.\.\.body, confirmed: true \}\)/);
  assert.match(admin, /expectedVersion: version/);
  assert.match(admin, /disabled=\{!ack \|\| needWords \|\| busy\}/, 'a control change needs the effect acknowledged');
  assert.match(admin, /if \(result\?\.view\) setView\(result\.view\);\s*setNotice\(done\);/, 'the notice follows the server response');
  assert.match(admin, /e\?\.status === 409/);
  assert.match(admin, /useEffect\(\(\) => \{ setView\(null\); setSheet\(null\); setNotice\(''\); void refresh\(\); return \(\) => \{ generation\.current\+\+; \}; \}, \[refresh\]\);/, 'a different session never sees the previous view');
  assert.match(code('src/components/admin/sections/AdminCommercialSection.tsx'), /<AdminServiceControlCenter token=\{token\}\/><AdminSupplierRouting token=\{token\}\/><AdminServiceReadiness token=\{token\}\/>/);
  { const adminApi = code('server/routes/adminApi.ts'); const mount = adminApi.indexOf("adminRouter.use('/service-control',adminServiceControlRouter);"); assert.ok(mount > adminApi.indexOf('adminRouter.use(requireAdmin);') && adminApi.indexOf('adminRouter.use(requireAdmin);') > 0, 'mounted after the administrator check'); }
});
