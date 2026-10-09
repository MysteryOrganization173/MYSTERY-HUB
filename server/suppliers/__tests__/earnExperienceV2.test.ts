import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { personalReferralLink, copyReferralLink, shareReferralLink, activeEarnRules, earnCount, rewardStatuses, type EarnSummary } from '../../../src/utils/earnExperience';
import { EarnMetrics, EarnRewardActivity, EarnRules } from '../../../src/components/earn/EarnDetails';
import { describeReferralReward } from '../../../src/utils/referralRewardCopy';
import { createEarnDashboardRefresh } from '../../../src/utils/earnDashboardRefresh';
import { getPageFromPath } from '../../../src/utils/routing';
const source = (file: string) => readFileSync(file, 'utf8');
const summary: EarnSummary = { code: 'MH-ABC123', shareUrl: 'https://mysterybundlehub.com/?ref=MH-ABC123', isEnabled: true, clicksCount: 9, rawClicksCount: 9, uniqueVisitorsCount: 4, referredCustomersCount: 2, pendingRewardsMinor: 150, pendingRewardsGhc: 1.5, approvedRewardsMinor: 700, approvedRewardsGhc: 7, totalRewardsMinor: 700, totalRewardsGhc: 7 };
const rule = { id: 'internal-rule-id', service_type: 'data', network: null, product_key: null, reward_type: 'fixed_minor' as const, reward_minor: 50, reward_percent_bps: null, enabled: true, purchase_stage: 'acquisition' as const };
test('no summary, disabled identity or invalid code can yield a share link', () => {
  assert.equal(personalReferralLink(null), null);
  assert.equal(personalReferralLink({ ...summary, isEnabled: false }), null);
  for (const code of ['', ' ', 'fictional', 'MH-<script>']) assert.equal(personalReferralLink({ ...summary, code, shareUrl: '' }), null);
  assert.equal(personalReferralLink({ ...summary, code: '', shareUrl: 'https://mysterybundlehub.com' }), null);
});
test('authorized identity produces canonical attributed personal and service URLs only', () => {
  for (const path of ['/', '/data', '/marketplace', '/website-builder', '/earn']) {
    const link = personalReferralLink(summary, path, 'https://mysterybundlehub.com')!;
    assert.equal(new URL(link).searchParams.get('ref'), summary.code);
    assert.equal(new URL(link).pathname, path);
    assert.ok(getPageFromPath(path));
  }
  assert.equal(personalReferralLink(summary, '/nonexistent'), null);
  assert.equal(personalReferralLink(summary, 'https://another.example'), null);
});
test('authoritative tracked URL can supply an absent code but never changes destination host', () => {
  assert.equal(personalReferralLink({ ...summary, code: '', shareUrl: 'https://another.example/?ref=MH-ABC123' }, '/', 'https://mysterybundlehub.com'), summary.shareUrl);
});
test('copy requires a valid link and reports clipboard rejection/missing support accurately', async () => {
  let calls = 0;
  const clipboard = { writeText: async () => { calls++; } };
  assert.equal(await copyReferralLink(null, clipboard), false); assert.equal(calls, 0);
  assert.equal(await copyReferralLink(summary.shareUrl), false);
  assert.equal(await copyReferralLink(summary.shareUrl, { writeText: async () => { throw new Error('Denied'); } }), false);
  assert.equal(await copyReferralLink(summary.shareUrl, clipboard), true); assert.equal(calls, 1);
});
test('native share preserves attribution; cancellation is not success or a copy request', async () => {
  assert.equal(await shareReferralLink(summary.shareUrl, async data => { assert.equal(data.url, summary.shareUrl); }), 'shared');
  assert.equal(await shareReferralLink(summary.shareUrl, async () => { throw Object.assign(new Error('Cancel'), { name: 'AbortError' }); }), 'cancelled');
  assert.equal(await shareReferralLink(summary.shareUrl, async () => { throw new Error('Denied'); }), 'fallback');
  assert.equal(await shareReferralLink(summary.shareUrl), 'fallback');
});
test('rules respect disabled, future, expired and invalid dates', () => {
  const now = Date.parse('2026-10-08T12:00:00Z');
  assert.equal(activeEarnRules([rule, { ...rule, enabled: false }, { ...rule, starts_at: '2026-11-01T00:00:00Z' }, { ...rule, ends_at: '2026-10-01T00:00:00Z' }, { ...rule, starts_at: 'invalid' }], now).length, 1);
});
test('active rule amounts are configured, including exact percentage basis points', () => {
  assert.match(describeReferralReward(rule), /GH₵0.50.*first qualifying Data/);
  assert.match(describeReferralReward({ ...rule, reward_type: 'percent_bps', reward_minor: null, reward_percent_bps: 125, purchase_stage: 'recurring' }), /1.25%.*future qualifying/);
});
test('rule presentation has honest absent/error states and discloses product limitations, not IDs', () => {
  const empty = renderToStaticMarkup(React.createElement(EarnRules, { rules: [], error: false, retry: () => {} }));
  assert.match(empty, /No reward rules.*enabled/); assert.ok(!empty.includes('GH₵0.50'));
  const error = renderToStaticMarkup(React.createElement(EarnRules, { rules: [rule], error: true, retry: () => {} }));
  assert.match(error, /Eligibility cannot be confirmed/); assert.ok(!error.includes('GH₵0.50'));
  const current = renderToStaticMarkup(React.createElement(EarnRules, { rules: [{ ...rule, product_key: 'internal-product-id' }], error: false, retry: () => {} }));
  assert.match(current, /Selected products only/); assert.match(current, /separate margin-based policy/);
  assert.ok(!current.includes(rule.id)); assert.ok(!current.includes('internal-product-id'));
});
test('metric rendering distinguishes loading, true zero and unavailable network counts', () => {
  assert.equal(earnCount(0), '0'); assert.equal(earnCount(undefined), 'Unavailable');
  const loading = renderToStaticMarkup(React.createElement(EarnMetrics, { summary: null, loading: true, stale: false }));
  assert.match(loading, /Loading/); assert.ok(!loading.includes('GH₵0.00'));
  const html = renderToStaticMarkup(React.createElement(EarnMetrics, { summary, loading: false, stale: true }));
  assert.match(html, /Distinct browsers/); assert.match(html, /stored visitor keys/); assert.match(html, /Registered accounts/); assert.match(html, /Unavailable/); assert.match(html, /Last available/);
  assert.match(html, /GH₵1.50/); assert.match(html, /GH₵7.00/); assert.match(html, /not your available balance/);
});
test('all four ledger states are distinct, use minor units and never imply a completed payout', () => {
  const rows = (['pending', 'approved', 'rejected', 'reversed'] as const).map((status, i) => ({ id: String(i), service_type: 'airtime' as const, amount_minor: 125, amount_ghc: 999, currency: 'GHS' as const, status, reason: '', created_at: '2026-10-08T00:00:00Z', approved_at: null, reversed_at: null }));
  const html = renderToStaticMarkup(React.createElement(EarnRewardActivity, { ledger: rows, loading: false, stale: false }));
  for (const status of Object.values(rewardStatuses)) assert.ok(html.includes(status.label));
  assert.match(html, /tabindex="0"/); assert.match(html, /Latest reward records/); assert.match(html, /GH₵1.25/); assert.ok(!html.includes('999')); assert.match(html, /not completed withdrawals/);
  assert.ok(!rewardStatuses.rejected.className.includes('emerald')); assert.ok(!rewardStatuses.reversed.className.includes('emerald'));
});
test('empty activity is separate from an initial failure', () => {
  const html = (ledger: null | []) => renderToStaticMarkup(React.createElement(EarnRewardActivity, { ledger, loading: false, stale: false }));
  assert.match(html([]), /No rewards recorded yet/); assert.match(html(null), /unavailable/);
});
test('partial refresh preserves independent data and marks exactly which dataset is stale', async () => {
  const surface = new EventTarget() as any; const doc = new EventTarget() as any; doc.hidden = false;
  let failure = false; let latest: any; let calls = 0; let value = 0;
  const controller = createEarnDashboardRefresh({ loadSummary: async () => { if (failure) throw Error('offline'); return { success: true, summary: 9 }; }, loadLedger: async () => ({ success: true, ledger: ++calls }), onSummary: v => { value = v; }, onLedger: () => {}, onState: state => { latest = state; }, window: surface, document: doc });
  await controller.refresh(); failure = true; await controller.refresh(); assert.equal(value, 9); assert.equal(calls, 2); assert.equal(latest.summaryError, true); assert.equal(latest.ledgerError, false); controller.dispose();
});
test('disposed previous-account responses cannot update referral data or refresh state', async () => {
  const surface = new EventTarget() as any; const doc = new EventTarget() as any;
  let resolve!: (result: any) => void; let updates = 0;
  const controller = createEarnDashboardRefresh({ loadSummary: () => new Promise<any>(done => { resolve = done; }), loadLedger: async () => ({ success: true, ledger: [] }), onSummary: () => { updates++; }, onLedger: () => { updates++; }, onState: () => {}, window: surface, document: doc });
  const request = controller.refresh(); controller.dispose(); resolve({ success: true, summary }); await request; assert.equal(updates, 0);
  assert.match(source('src/components/earn/MysteryEarnPage.tsx'), /key=\{`\$\{user.id\}:\$\{sessionToken\}`\}/);
});
test('sharing has accessible disabled controls, selectable fallback, and cancels late-session feedback', () => {
  const page = source('src/components/earn/EarnSharing.tsx');
  assert.match(page, /disabled=\{!url \|\| busy\}/); assert.match(page, /readOnly value=\{manual\}/); assert.match(page, /request !== generation.current/);
  assert.match(page, /aria-label=\{`Share \$\{label\} on WhatsApp`\}/); assert.match(page, /noopener noreferrer/); assert.ok(!page.includes('execCommand'));
});
test('finance retains authoritative balance, confirmation, idempotency and existing claim contracts', () => {
  const panel = source('src/components/finance/FinancialPanel.tsx');
  for (const text of ['data.earn.availableMinor', 'data.settings.withdrawalMinimumMinor', 'data.settings.withdrawalFeeBps', 'pending.current', 'crypto.randomUUID()', 'confirmed', 'This transfer is irreversible', 'cannot be withdrawn back to Mobile Money', '/achievements/${encodeURIComponent(row.id)}/claim', 'row.claimed', 'row.progress<row.threshold']) assert.ok(panel.includes(text), text);
  const page = source('src/components/earn/MysteryEarnPage.tsx'); assert.match(page, /<FinancialPanel mode="earn"/); assert.ok(!page.includes('approvedRewardsMinor +'));
});
