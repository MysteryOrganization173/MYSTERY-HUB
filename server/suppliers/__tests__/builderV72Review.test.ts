import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BusinessAnalytics, dailyViewSeries, groupActivity} from '../../../src/components/website/BusinessAnalytics.js';

test('all-time view chart retains recent server records beyond 400 calendar days', () => {
  const trend = [{day:'2024-01-01',views:2},{day:'2026-11-03',views:7}];
  const series = dailyViewSeries(trend);
  assert.equal(series.reduce((n, d) => n + d.views, 0), 9);
  assert.deepEqual(series.at(-1), trend[1]);
  assert.deepEqual(trend, [{day:'2024-01-01',views:2},{day:'2026-11-03',views:7}]);
});

test('empty activity history does not claim an absence of the visits counted by the server', () => {
  const html=renderToStaticMarkup(React.createElement(BusinessAnalytics,{analytics:{views:3,uniqueVisitors:3,whatsappClicks:1,primaryCtaClicks:0,callClicks:0,emailClicks:0,activity:[],trend:[]},earnings:null,activity:[],reseller:false,published:true}));
  assert.ok(html.includes('Site visits and contact actions are shown in the totals above.'));
  assert.ok(!html.includes('No customer activity yet.'));
});

test('activity repeats collapse within a day, preserving identical events on previous days', () => {
  const entries = [
    {label:'Store checkout · Awaiting payment',at:'2026-11-03T01:05:00Z'},
    {label:'Store checkout · Awaiting payment',at:'2026-11-03T00:05:00Z'},
    {label:'Store checkout · Awaiting payment',at:'2026-11-02T23:55:00Z'},
  ];
  const groups = groupActivity(entries, new Date('2026-11-03T12:00:00Z'));
  assert.equal(groups.length, 2);
  assert.equal(groups[0].heading, 'Today');
  assert.equal(groups[0].rows[0].count, 2);
  assert.equal(groups[1].heading, 'Yesterday');
  assert.equal(groups[1].rows[0].count, 1);
  assert.equal(groups.reduce((n, g) => n + g.rows.reduce((s, r) => s + r.count, 0), 0), entries.length);
});

test('activity calendar labels use Ghana dates independently of the device timezone', () => {
  const original = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    const groups = groupActivity([
      {label:'Store sale',at:'2026-11-03T00:10:00Z'},
      {label:'Store checkout',at:'2026-11-02T23:50:00Z'},
    ], new Date('2026-11-03T01:00:00Z'));
    assert.deepEqual(groups.map(g => g.heading), ['Today','Yesterday']);
  } finally {
    if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
  }
});
