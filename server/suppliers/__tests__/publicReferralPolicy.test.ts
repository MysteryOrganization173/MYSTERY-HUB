import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { apiRouter } from '../../routes/api.js';
import { ReferralStore } from '../../db/referralStore.js';
import { FinanceStore } from '../../db/financeStore.js';
import { describePublicDataPolicy } from '../../services/publicReferralPolicy.js';
import { publicReferralRule } from '../../services/referralRulePolicy.js';
import { computeEconomicReward } from '../../services/referralEconomics.js';
import { EarnRules } from '../../../src/components/earn/EarnDetails';
import { activeEarnRules } from '../../../src/utils/earnExperience';
import type { ReferralRewardRuleRecord } from '../../types/referral.js';
import type { PublicDataReferralPolicy } from '../../../shared/publicReferralPolicy';

const at = '2026-10-20T12:00:00.000Z';
const config = { service: 'data', enabled: true, mode: 'stage_margin_percent', acquisitionBps: 4500, recurringBps: 2000,
  version: 'private-version', reserveMinor: 25, reserveBps: 100, reserveConfigured: true, marginBps: 0, supplierCostMinor: null } as const;
const rule = (extra: Partial<ReferralRewardRuleRecord> = {}): ReferralRewardRuleRecord => ({ id: 'first', service_type: 'data', purchase_stage: 'acquisition',
  reward_type: 'fixed_minor', reward_minor: 50, reward_percent_bps: null, enabled: true, network: null, product_key: null,
  starts_at: null, ends_at: null, created_at: at, updated_at: at, ...extra });
const rules = [rule(), rule({ id: 'later', purchase_stage: 'recurring', reward_minor: 10 })];
const policy = (value: unknown = config, rows = rules) => describePublicDataPolicy(value, rows, at);
const html = (dataPolicy: PublicDataReferralPolicy | null | undefined = policy(), rows = rules, options = {}) => renderToStaticMarkup(React.createElement(EarnRules,
  { rules: rows.map(publicReferralRule), dataPolicy, error: false, retry: () => {}, ...options }));
let server: Server, base: string;
const readConfig = FinanceStore.readConfig, getRules = ReferralStore.getAllRules;
before(async () => { const app = express(); app.use('/api', apiRouter); server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; });
beforeEach(() => { FinanceStore.readConfig = async id => id === 'economics:data' ? config : undefined; ReferralStore.getAllRules = async () => rules; });
after(async () => { FinanceStore.readConfig = readConfig; ReferralStore.getAllRules = getRules; await new Promise<void>(resolve => server.close(() => resolve())); });

test('active Data disclosure exposes stage basis points and eligible direct stages', () => {
  assert.deepEqual(policy(), { service: 'data', journey: 'direct', status: 'active', basis: 'eligible_margin', acquisitionBps: 4500, recurringBps: 2000, eligibleStages: ['acquisition', 'recurring'] });
});
for (const [label, value, status] of [
  ['missing', undefined, 'unconfigured'], ['disabled', { ...config, enabled: false }, 'disabled'],
  ['legacy fixed', { ...config, mode: 'fixed' }, 'unsupported'], ['non-stage margin', { ...config, mode: 'margin_percent' }, 'unsupported'],
  ['missing acquisition', { ...config, acquisitionBps: undefined }, 'unavailable'], ['invalid recurring', { ...config, recurringBps: 10001 }, 'unavailable'],
  ['string basis points', { ...config, acquisitionBps: '4500' }, 'unavailable'], ['fractional basis points', { ...config, recurringBps: 1.5 }, 'unavailable'],
] as const) test(`${label} policy never publishes an active rate`, () => {
  const result = describePublicDataPolicy(value, rules, at);
  assert.equal(result.status, status); assert.equal(result.acquisitionBps, null); assert.equal(result.recurringBps, null); assert.deepEqual(result.eligibleStages, []);
  assert.doesNotMatch(html(result), /45%|20%|GH₵0\.50|GH₵0\.10/);
});
for (const [label, rows] of [
  ['missing', []], ['disabled', rules.map(r => ({ ...r, enabled: false }))],
  ['scheduled', rules.map(r => ({ ...r, starts_at: '2026-10-21T00:00:00Z' }))],
  ['expired', rules.map(r => ({ ...r, ends_at: '2026-10-19T00:00:00Z' }))],
  ['unrelated service', rules.map(r => ({ ...r, service_type: 'airtime' as const }))],
] as const) test(`${label} rules cannot activate Data percentage disclosure`, () => {
  assert.equal(policy(config, [...rows]).status, 'ineligible');
});
test('network/product rule scopes gate stages without replacing dynamic rates with fixed amounts', () => {
  const specific = rule({ network: 'telecel', product_key: 'selected', reward_minor: 999, purchase_stage: 'recurring' });
  const result = policy(config, [specific]); assert.equal(result.acquisitionBps, 4500); assert.equal(result.recurringBps, 2000);
  assert.deepEqual(result.eligibleStages, ['recurring']); const output = html(result, [specific]);
  assert.match(output, /20%/); assert.doesNotMatch(output, /45%|9\.99/); assert.match(output, /Only eligible products and networks/);
});
test('wildcard and overlapping Data rules produce one coherent Data policy card', () => {
  const rows = [...rules, rule({ id: 'specific', network: 'mtn' }), rule({ id: 'wildcard', service_type: 'all', purchase_stage: 'any', reward_minor: 100 })];
  const output = html(policy(config, rows), rows); assert.equal((output.match(/data-policy="effective-data"/g) || []).length, 1);
  assert.equal((output.match(/45%/g) || []).length, 1); assert.equal((output.match(/20%/g) || []).length, 1);
  assert.doesNotMatch(output, /GH₵0\.50|GH₵0\.10|GH₵1\.00/);
});
test('public HTTP response retains the exact rules contract and contains only allowlisted policy fields', async () => {
  FinanceStore.readConfig = async () => ({ ...config, supplierCostMinor: 98765, secret: 'never-public', reserveMinor: 456 });
  const response = await fetch(base + '/api/referrals/rules'); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json(); assert.equal(body.success, true); assert.deepEqual(body.rules, rules.map(publicReferralRule)); assert.deepEqual(body.dataPolicy, policy());
  assert.doesNotMatch(JSON.stringify(body), /supplierCost|reserve|secret|private-version|ledger|profit|98765/);
});
test('policy database failure retains legacy rules but fails closed on percentages', async () => {
  FinanceStore.readConfig = async () => { throw new Error('private connection detail'); };
  const response = await fetch(base + '/api/referrals/rules'); assert.equal(response.status, 200);
  const body = await response.json(); assert.equal(body.dataPolicy.status, 'unavailable'); assert.deepEqual(body.rules, rules.map(publicReferralRule)); assert.doesNotMatch(JSON.stringify(body), /private connection/);
});
test('rules database failure returns an error without advertising an effective policy', async () => {
  ReferralStore.getAllRules = async () => { throw new Error('isolated unavailable'); };
  const response = await fetch(base + '/api/referrals/rules'); assert.equal(response.status, 500); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'Failed to retrieve referral rules.' });
});
test('rendered percentages derive from basis points and update with backend configuration', () => {
  const output = html(); assert.match(output, /First qualifying Data purchase/); assert.match(output, /Later qualifying Data purchases/); assert.match(output, /45%/); assert.match(output, /20%/);
  assert.match(output, /eligible margin/); assert.match(output, /not the price your friend pays/); assert.match(output, /Reseller storefront orders are excluded/);
  const changed = html(policy({ ...config, acquisitionBps: 3250, recurringBps: 1250 })); assert.match(changed, /32\.5%/); assert.match(changed, /12\.5%/); assert.doesNotMatch(changed, /45%|20%/);
});
test('legacy servers with no effective-policy field never fall back to historical fixed amounts', () => {
  const output = html(null); assert.match(output, /cannot currently be confirmed/); assert.doesNotMatch(output, /45%|20%|GH₵0\.50|GH₵0\.10/);
});
test('expired response rules stop percentage claims even if policy response was active', () => {
  const expired = rules.map(r => ({ ...r, ends_at: '2026-10-19T00:00:00Z' }));
  const visible = activeEarnRules(expired.map(publicReferralRule), Date.parse(at));
  const output = html(policy(), [], { rules: visible }); assert.doesNotMatch(output, /45%|20%/); assert.match(output, /No reward rules are enabled/);
});
test('loading, retry and compact member presentation preserve policy state', () => {
  assert.match(html(policy(), rules, { rules: null }), /Checking current reward rules/);
  const error = html(policy(), rules, { error: true }); assert.match(error, /Retry reward rules/); assert.doesNotMatch(error, /45%|20%/);
  const member = html(policy(), rules, { compact: true }); assert.match(member, /earn-rules-compact/); assert.match(member, /45%/);
});
test('other services do not inherit Data rates; confirmed Marketplace and Instant Bundle rules retain their own amounts', () => {
  const rows = ['airtime', 'afa', 'instant_bundle', 'marketplace', 'website_builder'].map((service_type, i) => rule({ id: `other${i}`, service_type: service_type as ReferralRewardRuleRecord['service_type'], reward_minor: 75 }));
  const output = html(policy(config, []), rows); assert.doesNotMatch(output, /45%|20%/);
  assert.equal((output.match(/GH₵0\.75<\/strong>/g) || []).length, 3);
});
test('public disclosure does not alter the existing monetary calculation or snapshots', () => {
  const order = { amount: 399, supplier_cost_minor: 390, service_type: 'data', commercial_context: { regularMinor: 499, reserveMinor: 5, normalReserveMinor: 6, discountMinor: 100 } } as any;
  const before = ['acquisition', 'recurring'].map(stage => computeEconomicReward(order, rules[0], 50, config, stage));
  policy(); const after = ['acquisition', 'recurring'].map(stage => computeEconomicReward(order, rules[0], 50, config, stage));
  assert.deepEqual(after, before); assert.equal(after[0].amount, 46); assert.equal(after[1].amount, 1);
});
