/**
 * 3.4-D native PostgreSQL: the Admin Notification Center's server side. Audiences by consent (customers, guest
 * browsers, both; people versus devices), allowlisted destinations, guest fan-out and delivery, duplicate protection,
 * the operator's own test (own devices only, works while paused, opened evidence), readiness facts without secrets,
 * and grouped history with filters. Local harness only (disposable database on 127.0.0.1:55491).
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID, randomBytes, createECDH} from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';
import express from 'express';
import webPush from 'web-push';
import {NOTIFICATION_SCHEMA} from '../../db/notificationSchema.js';
import {getPool, initDatabase} from '../../db/connection.js';
import {NotificationService as service, NOTIFICATIONS as n} from '../../services/notificationService.js';
import {processNotificationBatch} from '../../services/notificationWorker.js';
import {hashSessionToken} from '../../utils/crypto.js';
import {notificationRouter, adminNotificationRouter} from '../../routes/notificationApi.js';

const sub = (id: string) => { const ec = createECDH('prime256v1'); return {endpoint: `https://fcm.googleapis.com/fcm/send/SYNTHETIC-D-${id}`, keys: {p256dh: ec.generateKeys().toString('base64url'), auth: randomBytes(16).toString('base64url')}}; };
const key = () => 'd-' + randomUUID().replaceAll('-', '').slice(0, 20);

test('PostgreSQL Admin Notification Center: audiences, guests, own-device tests, readiness, history', {skip: process.env.MYSTERY_NOTIFICATION_PG_TEST !== 'true'}, async t => {
  assert.equal(process.env.DATABASE_URL, undefined); assert.equal(process.env.NODE_ENV, 'test');
  const original = {...process.env}; const keys = webPush.generateVAPIDKeys(); const storageKey = randomBytes(32).toString('base64');
  Object.assign(process.env, {WEB_PUSH_ENABLED: 'true', WEB_PUSH_VAPID_PUBLIC_KEY: keys.publicKey, WEB_PUSH_VAPID_PRIVATE_KEY: keys.privateKey, WEB_PUSH_VAPID_SUBJECT: 'mailto:synthetic@example.test', WEB_PUSH_STORAGE_KEY: storageKey});
  delete process.env.WEB_PUSH_GUEST_NEWS;
  const control = new pg.Client({host: '127.0.0.1', port: 55491, user: 'backend_gate', database: 'postgres', ssl: false}); await control.connect();
  const name = 'notification_admin_' + randomUUID().replaceAll('-', '') + '_test'; let pool: pg.Pool | null = null;
  const tokens = {buyer1: 'd-session-one', buyer2: 'd-session-two', buyer3: 'd-session-three', admin: 'd-admin-session', admin2: 'd-admin-two'};
  const payloads: {endpoint: string; payload: any}[] = [];
  const capture = async (s: any, payload: string) => { payloads.push({endpoint: s.endpoint, payload: JSON.parse(payload)}); };
  try {
    await control.query(`CREATE DATABASE ${name}`);
    process.env.DATABASE_URL = `postgresql://backend_gate@127.0.0.1:55491/${name}`; process.env.DATABASE_SSL = 'false'; process.env.MYSTERY_TEST_DATABASE_OPT_IN = 'true'; pool = getPool()!;
    const schema = fs.readFileSync('server/db/schema.sql', 'utf8');
    assert.ok(schema.replace(/\r\n/g, '\n').includes(NOTIFICATION_SCHEMA.trim().replace(/\r\n/g, '\n')), 'schema.sql mirrors the runtime notification schema');
    await pool.query(schema.slice(0, schema.indexOf('CREATE SCHEMA IF NOT EXISTS mysteryhub_notifications;')));
    for (const id of Object.keys(tokens)) {
      await pool.query('INSERT INTO users(id,name,password_hash,role) VALUES($1,$2,\'fixture\',$3)', [id, 'Synthetic ' + id, id.startsWith('admin') ? 'admin' : 'customer']);
      await pool.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+interval '1 day')", ['session-' + id, id, hashSessionToken(tokens[id as keyof typeof tokens])]);
    }
    await initDatabase(); // the full migrated schema (orders and their notification trigger), as in production
    await pool.query(NOTIFICATION_SCHEMA); await pool.query(NOTIFICATION_SCHEMA);
    const q = async (sql: string, args: unknown[] = []) => (await pool!.query(sql, args)).rows;
    const setPaused = (paused: boolean) => pool!.query(`UPDATE ${n}.settings SET paused=$1 WHERE id=TRUE`, [paused]);

    await t.test('the additive schema upgrade is idempotent; the test template is internal; an event always has a subject', async () => {
      await pool!.query(NOTIFICATION_SCHEMA);
      const columns = (await q(`SELECT column_name,is_nullable FROM information_schema.columns WHERE table_schema=$1 AND table_name='events'`, [n])).reduce((m: any, r: any) => ({...m, [r.column_name]: r.is_nullable}), {});
      for (const column of ['guest_device_id', 'destination', 'campaign_id', 'operator_test', 'opened_at']) assert.ok(column in columns, column);
      assert.equal(columns.user_id, 'YES');
      const test = (await q(`SELECT * FROM ${n}.templates WHERE id='operator_test'`))[0];
      assert.equal(test.locked, true); assert.equal(test.category, 'transactional');
      assert.ok(!(await service.templates()).some((t: any) => t.id === 'operator_test'), 'not offered as a template');
      await assert.rejects(() => pool!.query(`INSERT INTO ${n}.events(event_key,template_id,label) VALUES('no-subject','maintenance','x')`), /notification_event_subject/);
      await assert.rejects(() => service.saveTemplate('admin', 'operator_test', {title: 'Changed', body: 'Changed body text', category: 'transactional', enabled: true, expectedVersion: 1}), /server-owned/);
    });

    // Fixtures: buyer1 has two phones and chose news; buyer2 has one phone and did not; buyer3 chose news but signed out.
    await service.subscribe('buyer1', tokens.buyer1, {subscription: sub('B1a'), consent: {purposes: ['transactional', 'marketing'], copyVersion: 'invite-3.4-1'}});
    await service.subscribe('buyer1', tokens.buyer1, {subscription: sub('B1b')});
    await service.subscribe('buyer2', tokens.buyer2, {subscription: sub('B2'), consent: {purposes: ['transactional'], copyVersion: 'invite-3.4-orders'}});
    await service.subscribe('buyer3', tokens.buyer3, {subscription: sub('B3'), consent: {purposes: ['transactional', 'marketing'], copyVersion: 'invite-3.4-1'}});
    await pool.query("UPDATE sessions SET expires_at=NOW()-interval '1 minute' WHERE user_id='buyer3'");

    await t.test('members audience counts people and devices from consent; admins and signed-out devices never count', async () => {
      const preview = await service.previewAudience('admin', {templateId: 'maintenance'});
      assert.equal(preview.audience, 'members'); assert.equal(preview.destination, '/');
      assert.equal(preview.eligibleCustomers, 1); assert.equal(preview.eligibleCustomerDevices, 2); assert.equal(preview.eligibleDevices, 2); assert.equal(preview.eligibleGuests, 0);
      await assert.rejects(() => service.previewAudience('admin', {templateId: 'maintenance', destination: '/admin'}), /valid template/);
      await assert.rejects(() => service.previewAudience('admin', {templateId: 'maintenance', destination: 'https://example.test/'}), /valid template/);
      await assert.rejects(() => service.previewAudience('admin', {templateId: 'maintenance', audience: 'all-users'}), /valid template/);
      await assert.rejects(() => service.previewAudience('admin', {templateId: 'maintenance', audience: 'guests'}), /Guest news is off/);
      await assert.rejects(() => service.previewAudience('admin', {templateId: 'maintenance', audience: 'everyone'}), /Guest news is off/);
      await assert.rejects(() => service.previewAudience('admin', {templateId: 'payment_confirmed'}), /enabled marketing template/, 'order templates are never announcements');
    });

    process.env.WEB_PUSH_GUEST_NEWS = 'true';
    const guestA = await service.guestSubscribe({subscription: sub('GA'), consent: {purposes: ['marketing'], copyVersion: 'invite-3.4-guest'}});
    const guestB = await service.guestSubscribe({subscription: sub('GB'), consent: {purposes: ['marketing'], copyVersion: 'invite-3.4-guest'}});

    await t.test('guest and everyone audiences need guest news on; a browser that is also a live account device is excluded', async () => {
      // A planted row for a member's own endpoint (the API refuses this) must never double-deliver to that browser.
      const memberHash = (await q(`SELECT endpoint_hash FROM ${n}.devices WHERE user_id='buyer1' LIMIT 1`))[0].endpoint_hash;
      const planted = randomUUID();
      await pool!.query(`INSERT INTO ${n}.guest_devices(id,endpoint_hash,encrypted_subscription,secret_hash) SELECT $1,$2,encrypted_subscription,'x' FROM ${n}.guest_devices WHERE id=$3`, [planted, memberHash, guestA.deviceId]);
      const guests = await service.previewAudience('admin', {templateId: 'maintenance', audience: 'guests', destination: '/data'});
      assert.equal(guests.eligibleGuests, 2); assert.equal(guests.eligibleCustomers, 0); assert.equal(guests.eligibleDevices, 2); assert.equal(guests.destination, '/data');
      const everyone = await service.previewAudience('admin', {templateId: 'maintenance', audience: 'everyone'});
      assert.equal(everyone.eligibleDevices, 4); assert.equal(everyone.eligibleCustomers, 1); assert.equal(everyone.eligibleGuests, 2);
      await assert.rejects(() => service.previewAudience('admin', {templateId: 'maintenance', audience: 'guests', userId: 'buyer1'}), /valid template/, 'one customer only within members');
      await pool!.query(`DELETE FROM ${n}.guest_devices WHERE id=$1`, [planted]);
    });

    await t.test('campaigns refuse while paused, then fan out per customer and per guest browser with the approved page', async () => {
      const preview = await service.previewAudience('admin', {templateId: 'maintenance', audience: 'everyone', destination: '/services'});
      await assert.rejects(() => service.campaign('admin', {previewId: preview.previewId, requestId: key(), confirmed: true}), /paused/);
      await setPaused(false);
      const requestId = key();
      const result = await service.campaign('admin', {previewId: preview.previewId, requestId, confirmed: true});
      assert.equal(result.eligibleDevices, 4); assert.equal(result.duplicate, false);
      assert.equal((await service.campaign('admin', {previewId: preview.previewId, requestId, confirmed: true})).duplicate, true, 'the same request is the same campaign');
      const events = await q(`SELECT user_id,guest_device_id,destination,expanded_at,label FROM ${n}.events WHERE campaign_id=$1 ORDER BY user_id NULLS LAST,guest_device_id`, [result.campaignId]);
      assert.equal(events.length, 3, 'one event for buyer1 and one per guest browser');
      assert.ok(events.every((e: any) => e.destination === '/services' && e.expanded_at && e.label === 'Service announcement'));
      assert.deepEqual(events.map((e: any) => e.user_id ?? 'guest'), ['buyer1', 'guest', 'guest']);
      const deliveries = await q(`SELECT d.device_id,d.guest_device_id,d.user_id FROM ${n}.deliveries d JOIN ${n}.events e ON e.id=d.event_id WHERE e.campaign_id=$1`, [result.campaignId]);
      assert.equal(deliveries.length, 4); assert.equal(deliveries.filter((d: any) => d.guest_device_id).length, 2);
      const audit = await q(`SELECT metadata_safe_json FROM admin_audit_log WHERE action='notification_campaign_queued' AND entity_id=$1`, [result.campaignId]);
      const metadata = JSON.parse(audit[0].metadata_safe_json);
      assert.equal(metadata.customer_devices, 2); assert.equal(metadata.guest_browsers, 2); assert.equal(metadata.audience, 'everyone'); assert.equal(metadata.destination, '/services');
      // Nobody gets the same announcement twice in 30 minutes, whichever audience, page or preview it comes from.
      for (const [audience, destination] of [['everyone', '/services'], ['members', '/'], ['members', '/data'], ['guests', '/marketplace']] as const) {
        const again = await service.previewAudience('admin', {templateId: 'maintenance', audience, destination});
        assert.equal(again.eligibleDevices, 0, `${audience} ${destination}`); assert.ok(again.alreadyReceived > 0);
      }
      const single = await service.previewAudience('admin', {templateId: 'maintenance', userId: 'buyer1'});
      assert.equal(single.eligibleDevices, 0); assert.equal(single.alreadyReceived, 2);
      // A second confirmation racing the first cannot double-send either: the earlier preview's recipients are left out.
      const early = await service.previewAudience('admin', {templateId: 'new_service', audience: 'members'});
      const late = await service.previewAudience('admin', {templateId: 'new_service', audience: 'members'});
      const sent = await service.campaign('admin', {previewId: early.previewId, requestId: key(), confirmed: true});
      assert.equal(sent.eligibleDevices, 2);
      await assert.rejects(() => service.campaign('admin', {previewId: late.previewId, requestId: key(), confirmed: true}), /already received this announcement/);
      await pool!.query(`UPDATE ${n}.deliveries d SET state='skipped',last_code='cancelled' FROM ${n}.events e WHERE e.id=d.event_id AND e.campaign_id=$1`, [sent.campaignId]);
      // A cancelled send does not count as received: the same announcement may go out again.
      assert.equal((await service.previewAudience('admin', {templateId: 'new_service', audience: 'members'})).eligibleDevices, 2);

      payloads.length = 0;
      await processNotificationBatch(capture, 25);
      assert.equal(payloads.length, 4);
      for (const {payload} of payloads) { assert.equal(payload.kind, 'announcement'); assert.equal(payload.url, '/services'); assert.equal(payload.title, 'Service update'); assert.doesNotMatch(JSON.stringify(payload), /buyer|guest_|endpoint/); }
      const states = await q(`SELECT d.state,COUNT(*)::int AS count FROM ${n}.deliveries d JOIN ${n}.events e ON e.id=d.event_id WHERE e.campaign_id=$1 GROUP BY d.state`, [result.campaignId]);
      assert.deepEqual(states, [{state: 'provider_accepted', count: 4}]);
    });

    await t.test('guest deliveries stop when guest news is turned off; a gone guest subscription is removed with evidence', async () => {
      const preview = await service.previewAudience('admin', {templateId: 'new_service', audience: 'guests', destination: '/marketplace'});
      const result = await service.campaign('admin', {previewId: preview.previewId, requestId: key(), confirmed: true});
      process.env.WEB_PUSH_GUEST_NEWS = 'false';
      payloads.length = 0; await processNotificationBatch(capture, 25);
      assert.equal(payloads.length, 0, 'gate off: nothing goes to guest browsers');
      assert.deepEqual((await q(`SELECT DISTINCT d.state FROM ${n}.deliveries d JOIN ${n}.events e ON e.id=d.event_id WHERE e.campaign_id=$1`, [result.campaignId])).map((r: any) => r.state), ['skipped']);
      process.env.WEB_PUSH_GUEST_NEWS = 'true';
      const preview2 = await service.previewAudience('admin', {templateId: 'special_offer', audience: 'guests'});
      const second = await service.campaign('admin', {previewId: preview2.previewId, requestId: key(), confirmed: true});
      payloads.length = 0;
      await processNotificationBatch(async (s, payload) => { if (s.endpoint.endsWith('GA')) throw Object.assign(new Error('gone'), {statusCode: 410}); payloads.push({endpoint: s.endpoint, payload: JSON.parse(payload)}); }, 25);
      assert.equal(payloads.length, 1); assert.equal(payloads[0].payload.url, '/');
      assert.equal((await q(`SELECT 1 FROM ${n}.guest_devices WHERE id=$1`, [guestA.deviceId])).length, 0, 'the gone browser is removed');
      assert.deepEqual((await q(`SELECT granted,source FROM ${n}.consents WHERE guest_device_id=$1 ORDER BY seq DESC LIMIT 1`, [guestA.deviceId]))[0], {granted: false, source: 'guest_endpoint_expired'});
      const problems = (await service.historyDetail('announcement', second.campaignId)).problems;
      assert.deepEqual(problems, [{code: 'endpoint_expired', count: 1}]);
    });

    await t.test('the operator’s test needs their own signed-in device and reaches nobody else, even while paused', async () => {
      await assert.rejects(() => service.testToSelf('admin', {requestId: key()}), /No phone or browser is registered to your account/);
      await service.subscribe('admin', tokens.admin, {subscription: sub('ADMIN')});
      await service.subscribe('admin2', tokens.admin2, {subscription: sub('ADMIN2')});
      await setPaused(true);
      // A customer order update saved while paused must stay unsent while the operator tests.
      await pool!.query(`INSERT INTO ${n}.events(user_id,event_key,template_id,label) VALUES('buyer1','paused-order-event','order_processing','Supplier accepted')`);
      const requestId = key();
      const result = await service.testToSelf('admin', {requestId});
      assert.equal(result.devices, 1); assert.equal(result.duplicate, false);
      assert.equal((await service.testToSelf('admin', {requestId})).duplicate, true, 'the same request is the same test');
      const event = (await q(`SELECT * FROM ${n}.events WHERE id=$1`, [result.eventId]))[0];
      assert.equal(event.user_id, 'admin'); assert.equal(event.operator_test, true); assert.equal(event.template_id, 'operator_test');
      payloads.length = 0; const outcome = await processNotificationBatch(capture, 25);
      assert.equal(outcome.disabled, true, 'still reported as paused');
      assert.equal(payloads.length, 1); assert.ok(payloads[0].endpoint.endsWith('ADMIN'), 'only the operator’s own device');
      assert.equal(payloads[0].payload.kind, 'account'); assert.equal(payloads[0].payload.body, 'An account update is available. Sign in to view it.', 'the private account path, like an order update');
      assert.equal((await q(`SELECT expanded_at FROM ${n}.events WHERE event_key='paused-order-event'`))[0].expanded_at, null, 'customer updates were not touched');
      const audit = await q(`SELECT admin_user_id FROM admin_audit_log WHERE action='notification_test_queued' AND entity_id=$1`, [result.eventId]);
      assert.deepEqual(audit, [{admin_user_id: 'admin'}]);
      // The phone check: only the owner, only with the token that travelled inside the push.
      const token = payloads[0].payload.open;
      assert.match(token, /^[A-Za-z0-9_-]{43}$/, 'the test push carries its open token');
      await assert.rejects(() => service.setSettings('admin', {paused: false, confirmed: true, reason: 'Resume before verification'}), /verify a phone/, 'resuming needs a phone that opened a test');
      await assert.rejects(() => service.inbox('admin2', 0, result.eventId, token), /not found/);
      const opened = await service.inbox('admin', 0, result.eventId);
      assert.deepEqual({title: opened[0].title, body: opened[0].body}, {title: 'Test notification', body: 'This is a test from Mystery Hub Admin. No action is needed.'});
      await service.inbox('admin', 0, result.eventId, 'x'.repeat(43));
      assert.equal((await q(`SELECT opened_at FROM ${n}.events WHERE id=$1`, [result.eventId]))[0].opened_at, null, 'a link or a wrong token proves nothing');
      await assert.rejects(() => service.setSettings('admin', {paused: false, confirmed: true, reason: 'Resume after a plain link'}), /verify a phone/);
      await service.inbox('admin', 0, result.eventId, token);
      assert.ok((await q(`SELECT opened_at FROM ${n}.events WHERE id=$1`, [result.eventId]))[0].opened_at);
      // One rule for every operator: admin's phone check lets admin2 resume in an emergency.
      assert.deepEqual(await service.setSettings('admin2', {paused: false, confirmed: true, reason: 'Phone verified by an operator test'}), {paused: false});
      assert.deepEqual(await service.setSettings('admin', {paused: true, confirmed: true, reason: 'Back to paused for the remaining checks'}), {paused: true});
      const health = await service.health('admin');
      assert.equal(health.lastTest.id, result.eventId); assert.ok(health.lastTest.openedAt); assert.deepEqual(health.lastTest.states, {provider_accepted: 1});
      assert.equal((await service.health('admin2')).lastTest, null, 'each operator sees their own last test');
      assert.ok(health.phoneCheck.at && health.phoneCheck.yoursAt, 'admin checked their own phone');
      const other = (await service.health('admin2')).phoneCheck;
      assert.ok(other.at && other.yoursAt === null, 'admin2 sees that another operator checked a phone');
      await pool!.query(`DELETE FROM ${n}.events WHERE event_key='paused-order-event'`);
    });

    await t.test('an announcement test shows its own text and page; invalid or excessive tests are refused', async () => {
      const result = await service.testToSelf('admin', {requestId: key(), templateId: 'special_offer', destination: '/earn'});
      payloads.length = 0; await processNotificationBatch(capture, 25);
      assert.equal(payloads.length, 1); assert.equal(payloads[0].payload.kind, 'announcement'); assert.equal(payloads[0].payload.url, '/earn'); assert.equal(payloads[0].payload.title, 'Current offers');
      assert.equal((await service.inbox('admin', 0, result.eventId))[0].opens, '/earn');
      const health = await service.health('admin');
      assert.equal(health.lastTest.templateId, 'operator_test', 'an announcement test is not the phone check (it cannot record a tap)');
      assert.ok(health.phoneCheck?.yoursAt, 'the earlier opened test still counts');
      assert.equal(payloads[0].payload.open, undefined, 'only plain tests carry an open token');
      await assert.rejects(() => service.testToSelf('admin', {requestId: key(), templateId: 'payment_confirmed'}), /announcement template/);
      await assert.rejects(() => service.testToSelf('admin', {requestId: key(), templateId: 'operator_test'}), /valid test/);
      await assert.rejects(() => service.testToSelf('admin', {requestId: key(), destination: '/data'}), /valid test/);
      await assert.rejects(() => service.testToSelf('admin', {requestId: key(), templateId: 'maintenance', destination: '/wallet'}), /valid test/);
      await assert.rejects(() => service.testToSelf('admin', {requestId: 'x'}), /valid test/);
      await assert.rejects(() => service.testToSelf('admin', {requestId: key(), userId: 'buyer1'}), /Unexpected/, 'no way to name another recipient');
      await service.testToSelf('admin', {requestId: key()});
      await assert.rejects(() => service.testToSelf('admin', {requestId: key()}), /Three tests/);
      process.env.WEB_PUSH_ENABLED = 'false';
      await assert.rejects(() => service.testToSelf('admin2', {requestId: key()}), /not configured/);
      process.env.WEB_PUSH_ENABLED = 'true';
    });

    await t.test('only reviewed recipients are sent to; a pause while sending holds the rest; queued announcements can be cancelled', async () => {
      // Let the operator's earlier test go out first (paused: only tests move), so this batch starts with the campaign.
      await setPaused(true); await processNotificationBatch(async () => {}, 25);
      await setPaused(false);
      const preview = await service.previewAudience('admin', {templateId: 'new_service', audience: 'everyone', destination: '/data'});
      assert.equal(preview.eligibleDevices, 3, 'buyer1’s two devices and guest B (cancelled or skipped sends do not count as received)');
      const late = await service.subscribe('buyer1', tokens.buyer1, {subscription: sub('B1c')});
      const result = await service.campaign('admin', {previewId: preview.previewId, requestId: key(), confirmed: true});
      assert.equal(result.eligibleDevices, 3, 'a device added after the review is not sent to'); assert.equal(result.leftOut, 0);
      const targets = await q(`SELECT d.device_id FROM ${n}.deliveries d JOIN ${n}.events e ON e.id=d.event_id WHERE e.campaign_id=$1 AND d.device_id IS NOT NULL`, [result.campaignId]);
      assert.ok(!targets.some((t: any) => t.device_id === late.deviceId));
      await service.revoke('buyer1', late.deviceId);
      // A pause that lands while a batch is running holds the rest of it; nothing is dropped as "not sent".
      payloads.length = 0;
      await processNotificationBatch(async (sub2, payload) => { payloads.push({endpoint: sub2.endpoint, payload: JSON.parse(payload)}); await setPaused(true); }, 25);
      assert.equal(payloads.length, 1, 'one went out before the pause');
      const held = await q(`SELECT d.state FROM ${n}.deliveries d JOIN ${n}.events e ON e.id=d.event_id WHERE e.campaign_id=$1`, [result.campaignId]);
      assert.deepEqual(held.map((r: any) => r.state).sort(), ['provider_accepted', 'queued', 'queued']);
      const health = await service.health('admin');
      assert.equal(health.queuedAnnouncements, 2); assert.equal(health.queuedCampaigns, 1);
      // Cancel: everything still queued is cancelled, including a delivery a sender holds right now (counted as
      // possibly on its way); nothing revives a cancelled delivery afterwards.
      await pool!.query(`UPDATE ${n}.deliveries SET lease=gen_random_uuid(),lease_until=NOW()+interval '1 minute' WHERE id=(SELECT d.id FROM ${n}.deliveries d JOIN ${n}.events e ON e.id=d.event_id WHERE e.campaign_id=$1 AND d.state='queued' ORDER BY d.id LIMIT 1)`, [result.campaignId]);
      await assert.rejects(() => service.cancelQueued('admin', {campaignId: result.campaignId, confirmed: true, reason: 'x'}), /safe reason/);
      await assert.rejects(() => service.cancelQueued('admin', {campaignId: result.campaignId, reason: 'Wrong page in the announcement'}), /safe reason/, 'needs explicit confirmation');
      assert.deepEqual(await service.cancelQueued('admin', {campaignId: result.campaignId, confirmed: true, reason: 'Wrong page in the announcement'}), {success: true, cancelled: 2, inFlight: 1});
      const audit = await q(`SELECT metadata_safe_json FROM admin_audit_log WHERE action='notification_announcements_cancelled' AND entity_id=$1`, [result.campaignId]);
      assert.equal(JSON.parse(audit[0].metadata_safe_json).cancelled, 2);
      const detail = await service.historyDetail('announcement', result.campaignId);
      assert.deepEqual(detail.problems, [{code: 'cancelled', count: 2}]); assert.equal(detail.total, 3); assert.equal(detail.totals.skipped, 2);
      await pool!.query(`UPDATE ${n}.deliveries SET lease=NULL,lease_until=NULL WHERE lease_until>NOW()`);
      await setPaused(false); payloads.length = 0; await processNotificationBatch(capture, 25);
      assert.equal(payloads.length, 0, 'nothing cancelled goes out on resume');
      // A send in flight when the cancel lands: a failure never revives it; an acceptance is recorded as the truth.
      for (const [answer, expected] of [['unavailable', 'skipped'], ['accepted', 'provider_accepted']] as const) {
        const again = await service.previewAudience('admin', {templateId: 'special_offer', userId: 'buyer1'});
        const queued = await service.campaign('admin', {previewId: again.previewId, requestId: key(), confirmed: true});
        await processNotificationBatch(async () => {
          await service.cancelQueued('admin', {campaignId: queued.campaignId, confirmed: true, reason: 'Cancelled while sending'});
          if (answer === 'unavailable') throw Object.assign(new Error('busy'), {statusCode: 503});
        }, 1);
        const rows = await q(`SELECT d.state FROM ${n}.deliveries d JOIN ${n}.events e ON e.id=d.event_id WHERE e.campaign_id=$1 ORDER BY d.updated_at DESC`, [queued.campaignId]);
        assert.ok(rows.some((r: any) => r.state === expected), `${answer}: ${JSON.stringify(rows)}`);
        assert.ok(!rows.some((r: any) => r.state === 'retry'), 'a cancelled delivery is never put back for another try');
        await pool!.query(`UPDATE ${n}.deliveries SET state='skipped',last_code='cancelled' WHERE state IN ('queued','retry')`);
      }
      await setPaused(true);
      // Cancelling everything that is queued is also possible (nothing left here).
      assert.deepEqual(await service.cancelQueued('admin', {confirmed: true, reason: 'Nothing should be waiting now'}), {success: true, cancelled: 0, inFlight: 0});
    });

    await t.test('the 1,000-device limit applies before anyone is left out, and the duplicate window follows the delivery', async () => {
      await pool!.query("INSERT INTO users(id,name,password_hash,role) VALUES('bulk','Synthetic bulk','fixture','customer')");
      await pool!.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES('session-bulk','bulk',$1,NOW()+interval '1 day')", [hashSessionToken('d-bulk-session')]);
      await pool!.query(`INSERT INTO ${n}.preferences(user_id,transactional,marketing) VALUES('bulk',TRUE,TRUE)`);
      await pool!.query(`INSERT INTO ${n}.devices(id,user_id,session_id,endpoint_hash,encrypted_subscription) SELECT gen_random_uuid(),'bulk','session-bulk',md5('bulk'||i),'never-sent' FROM generate_series(1,1001) i`);
      // buyer1 already received "maintenance" and is left out, yet everyone who qualifies still exceeds the limit:
      // refused, never cut short to the first 1,000.
      await assert.rejects(() => service.previewAudience('admin', {templateId: 'maintenance', audience: 'members'}), /safe campaign limit/);
      await pool!.query(`DELETE FROM ${n}.devices WHERE user_id='bulk'`);
      // Queued (or held by a pause) counts as received however long ago it was queued; an acceptance counts for 30 minutes.
      await service.saveTemplate('admin', undefined, {id: 'd_window', title: 'Window check', body: 'Open {{appName}} for the window check.', category: 'marketing', enabled: true});
      const preview = await service.previewAudience('admin', {templateId: 'd_window', userId: 'buyer1'});
      await setPaused(false); const queued = await service.campaign('admin', {previewId: preview.previewId, requestId: key(), confirmed: true}); await setPaused(true);
      await pool!.query(`UPDATE ${n}.events SET created_at=NOW()-interval '31 minutes' WHERE campaign_id=$1`, [queued.campaignId]);
      assert.equal((await service.previewAudience('admin', {templateId: 'd_window', userId: 'buyer1'})).eligibleDevices, 0, 'still on its way: left out');
      await pool!.query(`UPDATE ${n}.deliveries d SET state='provider_accepted',updated_at=NOW()-interval '31 minutes' FROM ${n}.events e WHERE e.id=d.event_id AND e.campaign_id=$1`, [queued.campaignId]);
      assert.equal((await service.previewAudience('admin', {templateId: 'd_window', userId: 'buyer1'})).eligibleDevices, 2, 'received over 30 minutes ago: may receive it again');
      await pool!.query(`UPDATE ${n}.deliveries d SET updated_at=NOW()-interval '5 minutes' FROM ${n}.events e WHERE e.id=d.event_id AND e.campaign_id=$1`, [queued.campaignId]);
      assert.equal((await service.previewAudience('admin', {templateId: 'd_window', userId: 'buyer1'})).eligibleDevices, 0, 'received 5 minutes ago: left out');
    });

    await t.test('readiness facts separate people, devices and guest browsers, and never include keys', async () => {
      await setPaused(true);
      await pool!.query(`INSERT INTO ${n}.events(user_id,event_key,template_id,label) VALUES('buyer2','waiting-order','order_delivered','Delivery confirmed')`);
      const health = await service.health('admin');
      assert.equal(health.configuration.enabled, true); assert.equal(health.configuration.valid, true); assert.equal(health.configuration.switchOn, true); assert.equal(health.configuration.guestNews, true);
      assert.equal(health.paused, true);
      assert.equal(health.liveDevices, 5, 'buyer1 ×2, buyer2, admin, admin2'); assert.equal(health.liveAccounts, 4); assert.equal(health.signedOutDevices, 1, 'buyer3 signed out');
      assert.equal(health.announcementCustomers, 1); assert.equal(health.announcementDevices, 2); assert.equal(health.guestBrowsers, 1);
      assert.equal(health.ownDevices, 1); assert.equal(health.waitingEvents, 1, 'an order update for someone with a phone waits for resume');
      assert.ok(health.deliveries7Days.provider_accepted >= 4); assert.equal(typeof health.commonProblem, 'string');
      const json = JSON.stringify(health);
      for (const secret of [keys.privateKey, keys.publicKey, storageKey]) assert.ok(!json.includes(secret), 'no key material');
      assert.doesNotMatch(json, /fcm\.googleapis|encrypted_subscription|SYNTHETIC/);
      await pool!.query(`DELETE FROM ${n}.events WHERE event_key='waiting-order'`);
    });

    await t.test('history groups announcements, tests and order updates, filters by state, and hides endpoints and people', async () => {
      const announcements = await service.history({kind: 'announcement'});
      assert.equal(announcements.total, (await q(`SELECT COUNT(*)::int AS c FROM ${n}.campaigns`))[0].c);
      const first = announcements.items[announcements.items.length - 1];
      assert.equal(first.audience, 'everyone'); assert.equal(first.destination, '/services'); assert.equal(first.targeted, 4); assert.deepEqual(first.states, {provider_accepted: 4}); assert.equal(first.title, 'Service update');
      const failedOnly = await service.history({kind: 'announcement', state: 'invalid'});
      assert.equal(failedOnly.total, 1); assert.deepEqual(failedOnly.items[0].states, {invalid: 1, provider_accepted: 1});
      const tests = await service.history({kind: 'test', actor: 'admin'});
      assert.equal(tests.total, 3); assert.ok(tests.items.some(i => i.openedAt)); assert.ok(tests.items.every(i => i.audience === 'self' && i.mine === true));
      assert.deepEqual(tests.items.map(i => i.destination).sort(), ['/earn', '/orders', '/orders']);
      assert.equal(tests.items.filter(i => i.announcementTest).length, 1);
      assert.ok((await service.history({kind: 'test', actor: 'admin2'})).items.every(i => i.mine === false), 'another operator’s tests are not "yours"');
      // Order updates are the events that carry an order: one waiting for resume, one too old to ever be sent.
      const order = (id: string) => pool!.query("INSERT INTO orders(id,user_id,public_reference,customer_email,customer_phone,recipient_phone,network,product_id,product_name_snapshot,bundle_size_snapshot,amount,currency,status,payment_reference,payment_status,paid_at) VALUES($1,'buyer2',$1,'fixture@example.test','0241111111','0241111111','telecel','fixture','Synthetic bundle','1GB',500,'GHS','paid',$2,'success',NOW())", [id, 'pay-' + id]);
      await order('d-order-new'); await order('d-order-old');
      await pool!.query(`UPDATE ${n}.events SET created_at=NOW()-interval '2 days' WHERE order_id='d-order-old'`);
      const orders = await service.history({kind: 'order'});
      assert.ok(orders.items.some(i => i.orderId === 'd-order-new' && i.waiting && !i.stale && i.title === 'Payment confirmed'));
      assert.ok(orders.items.some(i => i.orderId === 'd-order-old' && i.stale && !i.waiting));
      await setPaused(false); await processNotificationBatch(async () => {}, 25); await setPaused(true);
      const afterResume = await service.history({kind: 'order'});
      assert.ok(afterResume.items.some(i => i.orderId === 'd-order-old' && i.stale && i.targeted === 0), 'still "older than 24 hours" after resuming, not "no device"');
      assert.ok(orders.items.every(i => i.audience === 'account'));
      assert.ok((await service.history({kind: 'order', state: 'provider_accepted'})).items.every(i => (i.states.provider_accepted ?? 0) > 0), 'the result filter keeps only matching updates');
      await assert.rejects(() => service.history({kind: 'everything'}), /valid history filter/);
      await assert.rejects(() => service.history({kind: 'test', state: 'read'}), /valid history filter/, 'there is no "read" state');
      const detail = await service.historyDetail('announcement', first.id);
      assert.equal(detail.deliveries.length, 4); assert.equal(detail.deliveries.filter((d: any) => d.guest).length, 2);
      assert.deepEqual(detail.totals, {provider_accepted: 4}); assert.equal(detail.total, 4);
      assert.ok(detail.deliveries.every((d: any) => d.history.length === 1 && d.history[0].code === 'accepted'));
      assert.doesNotMatch(JSON.stringify(detail), /fcm\.googleapis|encrypted|endpoint|buyer|user_id/);
      await assert.rejects(() => service.historyDetail('announcement', 'not-a-uuid'), /Invalid notification identifier/);
    });

    await t.test('earlier campaigns are grouped after upgrade; Admin routes stay admin-only over HTTP', async () => {
      // A campaign queued before this release kept its id only in the event key.
      const audienceId = randomUUID(), campaignId = randomUUID();
      await pool!.query(`INSERT INTO ${n}.audiences(id,actor_id,template_id,template_version,device_ids,audience_hash) VALUES($1,'admin','maintenance',1,'{}','legacy')`, [audienceId]);
      await pool!.query(`INSERT INTO ${n}.campaigns(id,actor_id,preview_id,request_id,input_hash,recipient_count) VALUES($1,'admin',$2,$3,'legacy',1)`, [campaignId, audienceId, key()]);
      await pool!.query(`INSERT INTO ${n}.events(user_id,event_key,template_id,label,expanded_at) VALUES('buyer1',$1,'maintenance','Service announcement',NOW())`, [`campaign:${campaignId}:buyer1`]);
      await pool!.query(NOTIFICATION_SCHEMA);
      assert.equal((await q(`SELECT campaign_id FROM ${n}.events WHERE event_key=$1`, [`campaign:${campaignId}:buyer1`]))[0].campaign_id, campaignId);

      const app = express(); app.use(express.json()); app.use('/notifications', notificationRouter); app.use('/admin', adminNotificationRouter);
      const server = app.listen(0, '127.0.0.1');
      try {
        await new Promise<void>(r => server.once('listening', r)); const base = `http://127.0.0.1:${(server.address() as any).port}`;
        const call = (path: string, token?: string, init: RequestInit = {}) => fetch(base + path, {...init, headers: {'content-type': 'application/json', ...(token ? {authorization: 'Bearer ' + token} : {})}});
        for (const [path, method] of [['/admin/history', 'GET'], ['/admin/test', 'POST'], [`/admin/history/announcement/${campaignId}`, 'GET'], ['/admin/announcements/cancel', 'POST']] as const) {
          assert.equal((await call(path, undefined, {method, body: method === 'POST' ? '{}' : undefined})).status, 401, path);
          assert.equal((await call(path, tokens.buyer1, {method, body: method === 'POST' ? '{}' : undefined})).status, 403, path);
        }
        const history = await (await call('/admin/history?kind=test&state=provider_accepted', tokens.admin)).json();
        assert.equal(history.success, true); assert.ok(history.items.length >= 1);
        assert.equal((await call('/admin/history?kind=test&kind=order', tokens.admin)).status, 400, 'one kind at a time');
        const health = await (await call('/admin/health', tokens.admin)).json();
        assert.equal(health.ownDevices, 1); assert.equal(health.worker.scope, 'process_since_start');
        const test = await call('/admin/test', tokens.admin2, {method: 'POST', body: JSON.stringify({requestId: key()})});
        assert.equal(test.status, 200); assert.equal((await test.json()).devices, 1);
        assert.equal((await call('/notifications/inbox/' + randomUUID(), tokens.admin)).status, 404);
      } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
    });
  } finally {
    await pool?.end(); await control.query(`DROP DATABASE ${name} WITH (FORCE)`); await control.end();
    for (const k of ['DATABASE_URL', 'DATABASE_SSL', 'MYSTERY_TEST_DATABASE_OPT_IN', 'WEB_PUSH_ENABLED', 'WEB_PUSH_VAPID_PUBLIC_KEY', 'WEB_PUSH_VAPID_PRIVATE_KEY', 'WEB_PUSH_VAPID_SUBJECT', 'WEB_PUSH_STORAGE_KEY', 'WEB_PUSH_GUEST_NEWS']) { if (original[k] === undefined) delete process.env[k]; else process.env[k] = original[k]; }
  }
});

