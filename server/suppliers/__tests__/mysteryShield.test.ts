import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateShield, parseOriginalStatus, shieldPolicy, validShieldBudget } from '../../services/shieldPolicy.js';
import { validShieldQuote } from '../../db/shieldStore.js';
import { shieldFixture, shieldTestPolicy } from './shieldFixtures.js';
import type { OrderRecord } from '../../types/orders.js';

const now = Date.parse('2026-11-05T18:00:00Z');
const order = shieldFixture(now);
const policy = shieldTestPolicy(now);
const evidence = { supplierId: order.supplier_order_id!, status: 'pending' as const, observedAt: now };

test('nine complete hours measured from verified payment, not creation', () => {
  assert.equal(evaluateShield(order, policy, now - 60_000, false).state, 'waiting');
  assert.equal(evaluateShield(order, policy, now - 1, false).state, 'waiting');
  assert.equal(evaluateShield(order, policy, now, false, evidence).state, 'eligible');
  assert.equal(evaluateShield(order, policy, now + 1, false, evidence).state, 'eligible');
});

const exclusions: [string, Partial<OrderRecord>, string][] = [
  ['unpaid', { payment_status: 'pending' }, 'excluded'],
  ['refunded', { status: 'refunded' }, 'excluded'],
  ['refund pending', { status: 'refund_pending' }, 'excluded'],
  ['failed', { status: 'failed' }, 'excluded'],
  ['cancelled', { status: 'cancelled' }, 'excluded'],
  ['late delivery', { status: 'delivered' }, 'completed'],
  ['delivery timestamp', { delivered_at: order.paid_at }, 'completed'],
  ['missing paid time', { paid_at: null }, 'unverifiable'],
  ['invalid paid time', { paid_at: 'broken' }, 'unverifiable'],
  ['paid before creation', { paid_at: '2000-01-01T00:00:00Z' }, 'unverifiable'],
  ['invalid beneficiary', { recipient_phone: '123' }, 'unverifiable'],
  ['AirtelTigo', { network: 'airteltigo' }, 'not_covered'],
  ['airtime', { service_type: 'airtime' }, 'not_covered'],
  ['budget product', { product_id: 'mtn-budget-1gb' }, 'not_covered'],
  ['budget offer for Express-labelled product', { supplier_offer_ref: 'budget' }, 'unverifiable'],
  ['unknown order submission', { supplier_order_id: null }, 'unverifiable'],
  ['queued alone', { status: 'queued' }, 'unverifiable'],
  ['manual review', { manual_review: true }, 'review'],
  ['guest order', { user_id: null }, 'not_covered'],
  ['archived order', { archived_at: order.paid_at }, 'excluded'],
  ['complimentary', { payment_provider: 'complimentary' }, 'excluded'],
  ['operator-recorded', { payment_provider: 'admin_external' }, 'excluded'],
];
for (const [name, patch, expected] of exclusions) test(name, () => {
  assert.equal(evaluateShield({ ...order, ...patch }, policy, now, false, evidence).state, expected);
});

test('launch window, test order exclusion and feature defaults', () => {
  assert.equal(evaluateShield(order, { ...policy, startsAt: now - 1 }, now, false, evidence).state, 'not_covered');
  assert.equal(evaluateShield(order, { ...policy, endsAt: now }, now, false, evidence).state, 'unavailable');
  assert.equal(evaluateShield(order, policy, now, true, evidence).state, 'not_covered');
  assert.equal(evaluateShield(order, shieldPolicy({}), now, false, evidence).state, 'unavailable');
  assert.equal(shieldPolicy({ MYSTERY_SHIELD_STARTS_AT: '2026-11-05T18:00:00Z' }).startsAt, now);
  assert.ok(Number.isNaN(shieldPolicy({ MYSTERY_SHIELD_STARTS_AT: '2026-11-31T18:00:00Z' }).startsAt));
});

test('unknown, stale, mismatched or failed supplier evidence cannot qualify', () => {
  assert.equal(evaluateShield(order, policy, now, false).state, 'unverifiable');
  assert.equal(evaluateShield(order, policy, now, false, { ...evidence, observedAt: now - 30_001 }).state, 'unverifiable');
  assert.equal(evaluateShield(order, policy, now, false, { ...evidence, status: 'processed' }).state, 'completed');
  assert.equal(evaluateShield(order, policy, now, false, { ...evidence, status: 'failed' }).state, 'excluded');
  const data = { status: 'pending', publicId: evidence.supplierId, beneficiaryMsisdn: '0240000001', network: 'mtn', sizeLabel: '1GB' };
  for (const invalid of [
    { success: false, status: 'success', data },
    { success: true, status: 'error', data },
    { success: true, data: { ...data, publicId: undefined } },
    { success: true, data: { ...data, status: 'unknown' } },
    { success: true, data: { ...data, publicId: 'wrong' } },
    { success: true, data: { ...data, beneficiaryMsisdn: '0240000002' } },
    { success: true, data: { ...data, network: 'airteltigo' } },
    { success: true, data: { ...data, sizeLabel: '2GB' } },
  ]) assert.equal(parseOriginalStatus(invalid, order, now), null);
  assert.deepEqual(parseOriginalStatus({ success: true, data }, order, now), evidence);
});

test('quotes require exact MTN 400MB, known integer cost, expiry and coherent limits', () => {
  const quote = { packageId: 'synthetic-fixed', network: 'mtn' as const, sizeMB: 400 as const, costMinor: 300, expiresAt: now + 1000 };
  assert.ok(validShieldQuote(quote, policy, now));
  for (const patch of [{ costMinor: 0 }, { costMinor: 401 }, { costMinor: 0.5 }, { expiresAt: now }, { sizeMB: 500 }, { network: 'airteltigo' }]) {
    assert.equal(validShieldQuote({ ...quote, ...patch } as typeof quote, policy, now), false);
  }
  assert.equal(validShieldBudget({ ...policy, dailyMinor: 1 }), false);
});
