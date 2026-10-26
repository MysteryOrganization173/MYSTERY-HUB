/** F1 Admin order record keeping (archive / restore / restricted test deletion) and historical status on member Home. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {pendingOrderRecordClient, RECORD_KEEPING_UNAVAILABLE, type OrderRecordState} from '../../../src/services/orderRecordKeeping.js';
import {recordActionsFor, freshnessCheck, auditActionLabel} from '../../../src/utils/orderRecordActions.js';
import {AdminOrderRecordKeeping} from '../../../src/components/admin/sections/AdminOrderRecordKeeping.js';
import {createFixtureOrderRecordClient} from '../../../src/fixtures/orderRecordFixtures.js';
import {historicalOrderClass} from '../../../src/services/orderHistoryClassification.js';
import {memberOrderSelection, memberOrderTone, memberOrderLabel, memberOrderNext, isQuietHistorical} from '../../../src/utils/memberHomePresentation.js';
import type {SafePublicOrderDetails} from '../../types/orders';

const source = (file: string) => readFileSync(file, 'utf8');
const base: OrderRecordState = {reference: 'MH-1', version: 'v3', archived: false, archivedAt: null, archivedBy: null, archiveReason: null, canArchive: true, archiveBlockedReason: null, canRestore: false, restoreBlockedReason: null, canDeleteTest: false, deleteBlockedReason: 'Has a Paystack payment.', paidCustomerPurchase: true};

test('without a verified Codex contract the Admin calls nothing and says the controls are waiting', async () => {
  assert.equal(pendingOrderRecordClient.available, false);
  await assert.rejects(pendingOrderRecordClient.archive('t', 'MH-1', {expectedVersion: 'v1', reason: 'x'}), {message: RECORD_KEEPING_UNAVAILABLE});
  const html = renderToStaticMarkup(React.createElement(AdminOrderRecordKeeping, {token: 't', reference: 'MH-1', client: pendingOrderRecordClient, onArchivedChange() {}, onDeleted() {}}));
  assert.match(html, /Waiting for the server/);
  assert.doesNotMatch(html, /Archive order|Delete test record/);
  const orders = source('src/components/admin/sections/AdminOrdersSection.tsx');
  assert.match(orders, /recordClient = httpOrderRecordClient/, 'production uses the reviewed HTTP adapter');
});

test('the production classifier consumes only the authoritative server field, never a reference or date guess', () => {
  assert.equal(historicalOrderClass(prelaunch),null);
  assert.equal(historicalOrderClass({...prelaunch,classification:'unpaid_attempt'}),'historical_unpaid');
  assert.equal(historicalOrderClass({...prelaunch,classification:'order'}),null);
});

test('buttons and reasons come from the server answer; a paid customer purchase is never deletable', () => {
  const paid = recordActionsFor({...base, canDeleteTest: true});
  assert.equal(paid.delete, false, 'even if a response wrongly allowed it');
  assert.match(paid.deleteNote!, /paid customer purchase/i);
  const blocked = recordActionsFor({...base, canArchive: false, archiveBlockedReason: 'Delivery still in progress.'});
  assert.equal(blocked.archive, false);
  assert.equal(blocked.archiveNote, 'Delivery still in progress.');
  const test = recordActionsFor({...base, paidCustomerPurchase: false, canDeleteTest: true, deleteBlockedReason: null});
  assert.equal(test.delete, true);
  const archived = recordActionsFor({...base, archived: true, canArchive: false, canRestore: true});
  assert.deepEqual([archived.archive, archived.restore], [false, true]);
});

test('every action re-reads the record and stops if the version or eligibility moved', () => {
  assert.deepEqual(freshnessCheck('archive', base, base), {proceed: true});
  assert.equal(freshnessCheck('archive', base, {...base, version: 'v4'}).proceed, false);
  assert.equal(freshnessCheck('archive', base, {...base, canArchive: false}).proceed, false);
  assert.equal(freshnessCheck('delete', {...base, paidCustomerPurchase: false, canDeleteTest: true}, {...base, paidCustomerPurchase: false, canDeleteTest: false}).proceed, false);
  const ui = source('src/components/admin/sections/AdminOrderRecordKeeping.tsx');
  const run = ui.slice(ui.indexOf('const run = async'), ui.indexOf('return (\n    <AdminPanel title="Archive and test records" description'));
  assert.ok(run.indexOf('client.getState(token, reference)') < run.indexOf('client.archive('), 'fresh read before acting');
  assert.match(run, /expectedVersion: fresh\.version/);
  assert.ok(run.indexOf('if (!result.ok)') < run.indexOf('setState(result.state)'), 'state changes only after the server confirms');
  assert.match(ui, /typedWord=\{reference\}/, 'deletion requires the exact reference typed back');
  assert.match(ui, /acknowledgement="I understand this permanently deletes/);
  assert.match(ui, /tone="danger"/);
});

test('fixture backend: archive, restore, conflict and deletion only for server-classified test records', async () => {
  const client = createFixtureOrderRecordClient([
    {reference: 'MH-PAID', product: 'MTN 5GB', amountMinor: 2350, customer: '024 000 0000', status: 'failed', paid: true, test: false},
    {reference: 'MH-TEST', product: 'MTN 1GB', amountMinor: 600, customer: 'dev', status: 'pending_payment', paid: false, test: true},
  ]);
  const paid = await client.getState('t', 'MH-PAID');
  assert.equal(recordActionsFor(paid).delete, false);
  const archived = await client.archive('t', 'MH-PAID', {expectedVersion: paid.version, reason: 'Resolved outside'});
  assert.ok(archived.ok && archived.state.archived);
  assert.equal((await client.listArchived('t', {page: 1, limit: 20})).total, 1);
  assert.equal((await client.listArchived('t', {q: 'mh-paid', page: 1, limit: 20})).items[0].reference, 'MH-PAID');
  const stale = await client.restore('t', 'MH-PAID', {expectedVersion: paid.version, reason: 'Oops'});
  assert.deepEqual(stale.ok ? null : stale.code, 'version_conflict');
  const t = await client.getState('t', 'MH-TEST');
  client.touch('MH-TEST');
  assert.equal(freshnessCheck('delete', t, await client.getState('t', 'MH-TEST')).proceed, false, 'another admin acted first');
  const fresh = await client.getState('t', 'MH-TEST');
  assert.deepEqual(await client.deleteTest('t', 'MH-TEST', {expectedVersion: fresh.version, confirmReference: 'MH-TEST', reason: 'Developer test'}), {ok: true});
  assert.equal(auditActionLabel('test_deleted'), 'Test record deleted');
  assert.equal(auditActionLabel('custom_step'), 'Custom step');
});

test('fixtures stay isolated: no application file imports them', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => { const p = path.join(dir, name); return statSync(p).isDirectory() ? walk(p) : [p]; });
  for (const file of walk('src').filter(f => /\.(ts|tsx)$/.test(f) && !f.startsWith(path.join('src', 'fixtures')))) {
    assert.doesNotMatch(source(file), /fixtures\//, file);
  }
});

const order = (reference: string, status: string, created: string, extra: Partial<SafePublicOrderDetails> = {}): SafePublicOrderDetails => ({public_reference: reference, network: 'mtn', product_name_snapshot: 'MTN 5GB', bundle_size_snapshot: '5GB', recipient_phone: '024****000', amount: 2350, amount_ghc: 23.5, currency: 'GHS', status, created_at: created, paid_at: null, delivered_at: null, service_type: 'data', ...extra} as SafePublicOrderDetails);
const prelaunch = order('MH-20261001-858321', 'failed', '2026-10-01T09:00:00Z');
const classify = (o: SafePublicOrderDetails) => o.public_reference === 'MH-20261001-858321' || o.public_reference === 'MH-PAID-OLD' ? 'historical_unpaid' as const : null;

test('today Home is unchanged: no classification exists, so the old order still shows as it does now', () => {
  assert.equal(historicalOrderClass(prelaunch), null);
  assert.equal(memberOrderTone(prelaunch), 'attention');
  assert.equal(memberOrderSelection([order('MH-NEW', 'delivered', '2026-10-24T09:00:00Z'), prelaunch]).latest!.public_reference, 'MH-20261001-858321');
});

test('once the server classifies MH-20261001-858321 as unpaid history, it stops dominating Home', () => {
  const delivered = order('MH-NEW', 'delivered', '2026-10-24T09:00:00Z');
  const selection = memberOrderSelection([prelaunch, delivered], classify);
  assert.equal(selection.latest!.public_reference, 'MH-NEW');
  assert.equal(memberOrderTone(prelaunch, classify), 'closed');
  assert.equal(memberOrderLabel(prelaunch, classify), 'Not paid');
  assert.match(memberOrderNext(prelaunch, classify), /No payment was received/);
  // Alone, it is shown calmly rather than hidden.
  assert.equal(memberOrderSelection([prelaunch], classify).latest!.public_reference, 'MH-20261001-858321');
});

test('a genuinely paid failed order is never quietened, even if classified as history', () => {
  for (const extra of [{paid_at: '2026-10-01T09:01:00Z'}, {customer_resolution: 'review' as const}, {payment_basis: 'operator_recorded' as const}]) {
    const paidFailed = order('MH-PAID-OLD', 'failed', '2026-10-01T09:00:00Z', extra);
    assert.equal(isQuietHistorical(paidFailed, classify), false, JSON.stringify(extra));
    assert.equal(memberOrderTone(paidFailed, classify), 'attention');
  }
});
