import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { leadAlertLabel, leadDestination, type LeadSummary } from '../../../shared/leadOperations.js';
import { updateFreshLeads } from '../../../src/components/admin/leadAlerts.js';
import { AdminOperationsAlerts, type AlertState } from '../../../src/components/admin/sections/AdminOperationsAlerts.js';
import { AdminReadError, getPaidOrderAlerts } from '../../../src/services/leadOperations.js';
import { signalsFromOverview } from '../../../src/components/admin/adminSignals.js';
import type { AdminOverviewMetrics } from '../../../src/services/apiClient.js';

const empty = { new: 0, due: 0, overdue: 0, recent: [], latestNew: [] };
const before: LeadSummary = { checkedAt: '2026-11-06T10:00:00.000Z', today: '2026-11-06', ultra: empty, marketplace: empty };
const brief = {
  id: 'inq_synthetic', reference: 'inq_synthetic', status: 'new', kind: 'creative' as const,
  createdAt: '2026-11-06T10:00:00.001+00:00', updatedAt: '2026-11-06T10:00:00.001+00:00',
};
const after: LeadSummary = {
  ...before, checkedAt: '2026-11-06T10:01:00.000Z',
  marketplace: { ...empty, new: 1, overdue: 1, latestNew: [brief] },
};

test('new leads use real timestamp ordering and session dismissal does not repeat an unchanged banner', () => {
  assert.deepEqual(updateFreshLeads(null, after, []), []);
  const first = updateFreshLeads(before, after, []);
  assert.equal(first.length, 1);
  assert.equal(updateFreshLeads(after, after, first).length, 1);
  assert.deepEqual(updateFreshLeads(after, after, []), []);
  assert.deepEqual(updateFreshLeads(after, { ...after, marketplace: empty }, first), []);
});

test('Creative, Marketplace and Ultra retain distinct labels and exact authorised destinations', () => {
  assert.equal(leadAlertLabel('marketplace', brief), 'Creative Studio brief');
  assert.equal(leadAlertLabel('marketplace', {}), 'Marketplace enquiry');
  assert.equal(leadAlertLabel('ultra', {}), 'Ultra website enquiry');
  assert.deepEqual(leadDestination('marketplace', brief.reference), { tab: 'marketplace', param: 'inquiries/inq_synthetic' });
  assert.deepEqual(leadDestination('ultra', 'MH-ULTRA-SYNTHETI'), { tab: 'websites', param: 'enquiries/MH-ULTRA-SYNTHETI' });
});

const state: AlertState = {
  token: 'synthetic-admin', data: after, fresh: [], error: '', loading: false, refreshing: false,
  orderError: '', denied: false, dismiss() {}, refresh() {},
  orders: {
    checkedAt: after.checkedAt, total: 2, orders: [
      { reference: 'MH-REVIEW', reason: 'flagged', updatedAt: after.checkedAt },
      { reference: 'MH-UNCERTAIN', reason: 'supplier_uncertain', updatedAt: after.checkedAt },
    ],
  },
};
function render(alerts: AlertState) {
  return renderToStaticMarkup(React.createElement(AdminOperationsAlerts, { alerts, navigate() {} }));
}

test('critical paid incidents appear before routine flags and supplier uncertainty warns against resubmission', () => {
  const markup = render(state);
  assert.ok(markup.indexOf('MH-UNCERTAIN') < markup.indexOf('MH-REVIEW'));
  assert.match(markup, /Do not resubmit/);
  assert.match(markup, /Creative Studio brief/);
});

test('partial failure labels last known data and missing data is not displayed as zero', () => {
  const markup = render({ ...state, data: null, error: 'Enquiry check failed.', orderError: 'Paid-order check failed.' });
  assert.match(markup, /Showing the last successful check/);
  assert.match(markup, /Use Refresh alerts to retry/);
  assert.doesNotMatch(markup, /0 new|No paid orders/);
});

test('staff authorization loss suppresses any previously loaded alert records', () => {
  const markup = render({ ...state, denied: true });
  assert.match(markup, /Sign in again/);
  assert.doesNotMatch(markup, /MH-UNCERTAIN|inq_synthetic/);
});

test('supplier connection failure and a verified low balance are distinct from a missing balance', () => {
  const signal = (supplier: AdminOverviewMetrics['supplier']) =>
    signalsFromOverview({ supplier, allTime: { manualReviewPendingCount: 0, pendingWaitlist: 0 } } as AdminOverviewMetrics).supplierAlert;
  assert.equal(signal({ status: 'connected', balanceGhc: 0, isLowBalance: true, fulfilmentEnabled: true }), true);
  assert.equal(signal({ status: 'connected', balanceGhc: null, isLowBalance: true, fulfilmentEnabled: true }), false);
  assert.equal(signal({ status: 'error', balanceGhc: null, isLowBalance: false, fulfilmentEnabled: true }), true);
  assert.equal(signal({ status: 'unconfigured', balanceGhc: null, isLowBalance: false, fulfilmentEnabled: false }), false);
});

test('alert client uses bearer and no-store, preserving HTTP auth status even for non-JSON failures', async t => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (url: URL, options: RequestInit) => {
    assert.match(String(url), /\/api\/admin\/alerts\/paid-orders$/);
    assert.equal(new Headers(options.headers).get('Authorization'), 'Bearer synthetic-admin');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.signal, controller.signal);
    return new Response('Expired', { status: 401 });
  });
  await assert.rejects(getPaidOrderAlerts('synthetic-admin', controller.signal), error =>
    error instanceof AdminReadError && error.status === 401,
  );
});
