/**
 * 3.4-C native PostgreSQL: purpose-specific consent evidence, the never-revive rule for withdrawn offers, guest news
 * registrations (credential hash only, ownership, expiry, unsubscribe), account takeover of a guest browser, the
 * public paused flag, and announcement payloads. Local harness only (disposable database on 127.0.0.1:55491).
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID, randomBytes, createECDH} from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';
import express from 'express';
import webPush from 'web-push';
import {NOTIFICATION_SCHEMA} from '../../db/notificationSchema.js';
import {getPool} from '../../db/connection.js';
import {NotificationService as service, NOTIFICATIONS as n} from '../../services/notificationService.js';
import {processNotificationBatch} from '../../services/notificationWorker.js';
import {hashSessionToken} from '../../utils/crypto.js';
import {notificationRouter} from '../../routes/notificationApi.js';

const sub = (id: string) => { const ec = createECDH('prime256v1'); return {endpoint: `https://fcm.googleapis.com/fcm/send/SYNTHETIC-${id}`, keys: {p256dh: ec.generateKeys().toString('base64url'), auth: randomBytes(16).toString('base64url')}}; };

test('PostgreSQL notification consent evidence and guest news', {skip: process.env.MYSTERY_NOTIFICATION_PG_TEST !== 'true'}, async t => {
  assert.equal(process.env.DATABASE_URL, undefined); assert.equal(process.env.NODE_ENV, 'test');
  const original = {...process.env}; const keys = webPush.generateVAPIDKeys();
  Object.assign(process.env, {WEB_PUSH_ENABLED: 'true', WEB_PUSH_VAPID_PUBLIC_KEY: keys.publicKey, WEB_PUSH_VAPID_PRIVATE_KEY: keys.privateKey, WEB_PUSH_VAPID_SUBJECT: 'mailto:synthetic@example.test', WEB_PUSH_STORAGE_KEY: randomBytes(32).toString('base64')});
  const control = new pg.Client({host: '127.0.0.1', port: 55491, user: 'backend_gate', database: 'postgres', ssl: false}); await control.connect();
  const name = 'notification_consent_' + randomUUID().replaceAll('-', '') + '_test'; let pool: pg.Pool | null = null;
  const tokens = {buyer1: 'consent-session-one', buyer2: 'consent-session-two', admin: 'consent-admin-session'};
  try {
    await control.query(`CREATE DATABASE ${name}`);
    process.env.DATABASE_URL = `postgresql://backend_gate@127.0.0.1:55491/${name}`; process.env.DATABASE_SSL = 'false'; process.env.MYSTERY_TEST_DATABASE_OPT_IN = 'true'; pool = getPool()!;
    const schema = fs.readFileSync('server/db/schema.sql', 'utf8');
    assert.ok(schema.replace(/\r\n/g, '\n').includes(NOTIFICATION_SCHEMA.trim().replace(/\r\n/g, '\n')), 'schema.sql mirrors the runtime notification schema');
    await pool.query(schema.slice(0, schema.indexOf('CREATE SCHEMA IF NOT EXISTS mysteryhub_notifications;')));
    for (const id of ['buyer1', 'buyer2', 'admin']) {
      await pool.query('INSERT INTO users(id,name,password_hash,role) VALUES($1,$2,\'fixture\',$3)', [id, 'Synthetic ' + id, id === 'admin' ? 'admin' : 'customer']);
      await pool.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+interval '1 day')", ['session-' + id, id, hashSessionToken(tokens[id as keyof typeof tokens])]);
    }
    await pool.query(NOTIFICATION_SCHEMA); await pool.query(NOTIFICATION_SCHEMA);
    const consents = async (where: string, args: unknown[]) => (await pool!.query(`SELECT purpose,granted,source,copy_version FROM ${n}.consents WHERE ${where} ORDER BY created_at,id`, args)).rows;

    await t.test('new tables are private: RLS on, nothing granted to PUBLIC, anon or authenticated', async () => {
      for (const table of ['guest_devices', 'consents']) {
        assert.equal((await pool!.query(`SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass`, [`${n}.${table}`])).rows[0].relrowsecurity, true, table);
        for (const role of ['anon', 'authenticated']) assert.equal((await pool!.query(`SELECT has_table_privilege($1,$2,'SELECT') AS ok`, [role, `${n}.${table}`])).rows[0].ok, false, `${role} ${table}`);
      }
    });

    await t.test('one Allow records each named purpose with its copy version; preferences follow in the same transaction', async () => {
      const result = await service.subscribe('buyer1', tokens.buyer1, {subscription: sub('B1'), consent: {purposes: ['transactional', 'marketing'], copyVersion: 'invite-3.4-1'}});
      assert.deepEqual(result.preferences, {transactional: true, marketing: true});
      assert.deepEqual(await consents('user_id=$1', ['buyer1']), [
        {purpose: 'transactional', granted: true, source: 'notification_invitation', copy_version: 'invite-3.4-1'},
        {purpose: 'marketing', granted: true, source: 'notification_invitation', copy_version: 'invite-3.4-1'},
      ]);
      await assert.rejects(() => service.subscribe('buyer1', tokens.buyer1, {subscription: sub('B1x'), consent: {purposes: ['marketing', 'marketing'], copyVersion: 'v'}}), /consent/i, 'duplicates refused');
      await assert.rejects(() => service.subscribe('buyer1', tokens.buyer1, {subscription: sub('B1y'), consent: {purposes: ['everything'], copyVersion: 'v'}}), /consent/i, 'unknown purposes refused');
      await assert.rejects(() => service.subscribe('buyer1', tokens.buyer1, {subscription: sub('B1z'), consent: {purposes: ['marketing'], copyVersion: 'v', implied: true}}), /Unexpected/i, 'no extra fields');
    });

    await t.test('withdrawal in settings is recorded, and a later invitation never switches offers back on', async () => {
      await service.setPreferences('buyer1', {transactional: true, marketing: false});
      assert.deepEqual((await consents("user_id=$1 AND source='account_settings'", ['buyer1'])), [{purpose: 'marketing', granted: false, source: 'account_settings', copy_version: 'settings-1'}]);
      assert.equal((await service.preferences('buyer1')).marketingOptedOut, true);
      const again = await service.subscribe('buyer1', tokens.buyer1, {subscription: sub('B1b'), consent: {purposes: ['transactional', 'marketing'], copyVersion: 'invite-3.4-1'}});
      assert.equal(again.preferences.marketing, false, 'a withdrawn choice is never revived');
      assert.equal((await consents("user_id=$1 AND purpose='marketing' AND granted", ['buyer1'])).length, 1, 'no new marketing grant was recorded');
      await service.setPreferences('buyer1', {transactional: true, marketing: true});
      assert.equal((await service.preferences('buyer1')).marketingOptedOut, false, 'only the customer’s own explicit switch turns it back on');
      await service.setPreferences('buyer1', {transactional: true, marketing: true});
      assert.equal((await consents("user_id=$1 AND source='account_settings'", ['buyer1'])).length, 2, 'saving the same choice records nothing new');
    });

    await t.test('settings registration without consent changes no preference; a saved "off" from before the ledger counts as an opt-out', async () => {
      await pool!.query(`INSERT INTO ${n}.preferences(user_id,transactional,marketing) VALUES('buyer2',TRUE,FALSE)`);
      assert.equal((await service.preferences('buyer2')).marketingOptedOut, true);
      const plain = await service.subscribe('buyer2', tokens.buyer2, {subscription: sub('B2')});
      assert.deepEqual(plain.preferences, {transactional: true, marketing: false});
      assert.equal((await consents('user_id=$1', ['buyer2'])).length, 0);
    });

    let credential = '';
    const guestSub = sub('GUEST');
    await t.test('guest news: explicit marketing consent, credential hash only, ownership and confirmation', async () => {
      await assert.rejects(() => service.guestSubscribe({subscription: guestSub}), /news first/i, 'no consent, no registration');
      await assert.rejects(() => service.guestSubscribe({subscription: guestSub, consent: {purposes: ['transactional'], copyVersion: 'x'}}), /consent/i, 'guests cannot be registered for order updates');
      const created = await service.guestSubscribe({subscription: guestSub, consent: {purposes: ['marketing'], copyVersion: 'invite-3.4-1-guest'}});
      credential = created.credential;
      const [id, secret] = credential.split('.');
      assert.equal(id, created.deviceId); assert.equal(secret.length, 43);
      const row = (await pool!.query(`SELECT * FROM ${n}.guest_devices WHERE id=$1`, [id])).rows[0];
      assert.notEqual(row.secret_hash, secret); assert.doesNotMatch(JSON.stringify(row), new RegExp(secret)); assert.doesNotMatch(row.encrypted_subscription, /fcm\.googleapis/);
      assert.deepEqual(await consents('guest_device_id=$1', [id]), [{purpose: 'marketing', granted: true, source: 'guest_invitation', copy_version: 'invite-3.4-1-guest'}]);
      assert.equal((await service.guestStatus(credential)).subscribed, true);
      await assert.rejects(() => service.guestStatus(`${id}.${'b'.repeat(43)}`), /not on/i, 'a guessed secret reveals nothing');
      await assert.rejects(() => service.guestStatus('garbage'), /not on/i);
      await assert.rejects(() => service.guestSubscribe({subscription: {...guestSub, keys: sub('X').keys}, consent: {purposes: ['marketing'], copyVersion: 'x'}}), /ownership/i, 'another browser cannot take over the endpoint');
    });

    await t.test('a browser already registered to an account cannot be registered as a guest; signing in takes a guest browser over', async () => {
      const memberSub = sub('M2');
      await service.subscribe('buyer2', tokens.buyer2, {subscription: memberSub});
      await assert.rejects(() => service.guestSubscribe({subscription: memberSub, consent: {purposes: ['marketing'], copyVersion: 'x'}}), /already receives/i);
      const takeover = sub('TAKEOVER');
      const guest = await service.guestSubscribe({subscription: takeover, consent: {purposes: ['marketing'], copyVersion: 'x'}});
      await service.subscribe('buyer2', tokens.buyer2, {subscription: takeover});
      assert.equal((await pool!.query(`SELECT COUNT(*)::int AS c FROM ${n}.guest_devices WHERE id=$1`, [guest.deviceId])).rows[0].c, 0, 'no double registration');
      assert.deepEqual((await consents('guest_device_id=$1', [guest.deviceId])).map(r => [r.granted, r.source]), [[true, 'guest_invitation'], [false, 'replaced_by_account']]);
      assert.equal((await service.preferences('buyer2')).marketing, false, 'guest consent is never transferred to the account');
    });

    await t.test('expiry and unsubscribe: an expired guest registration is gone; unsubscribe deletes and records the withdrawal', async () => {
      const [id] = credential.split('.');
      await pool!.query(`UPDATE ${n}.guest_devices SET expires_at=NOW()-interval '1 minute' WHERE id=$1`, [id]);
      await assert.rejects(() => service.guestStatus(credential), /not on/i);
      await pool!.query(`UPDATE ${n}.guest_devices SET expires_at=NOW()+interval '1 day' WHERE id=$1`, [id]);
      assert.equal((await service.guestStatus(credential)).subscribed, true);
      assert.ok(new Date((await pool!.query(`SELECT expires_at FROM ${n}.guest_devices WHERE id=$1`, [id])).rows[0].expires_at).getTime() > Date.now() + 170 * 86400_000, 'active use keeps it alive');
      await service.guestUnsubscribe(credential);
      assert.equal((await pool!.query(`SELECT COUNT(*)::int AS c FROM ${n}.guest_devices WHERE id=$1`, [id])).rows[0].c, 0);
      assert.deepEqual((await consents('guest_device_id=$1', [id])).at(-1), {purpose: 'marketing', granted: false, source: 'guest_unsubscribe', copy_version: null});
      await service.guestUnsubscribe(credential);
    });

    await t.test('HTTP: guest routes need no account, keep the credential out of URLs, and the public config reports pause', async () => {
      const app = express(); app.use(express.json()); app.use('/notifications', notificationRouter);
      const server = app.listen(0, '127.0.0.1');
      try {
        await new Promise<void>(r => server.once('listening', r)); const base = `http://127.0.0.1:${(server.address() as any).port}`;
        let config = await (await fetch(base + '/notifications/config')).json();
        assert.equal(config.enabled, true); assert.equal(config.paused, true, 'new installations start paused'); assert.equal(config.guests, true);
        await pool!.query(`UPDATE ${n}.settings SET paused=FALSE WHERE id=TRUE`);
        config = await (await fetch(base + '/notifications/config')).json(); assert.equal(config.paused, false);
        const created = await (await fetch(base + '/notifications/guest', {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify({subscription: sub('HTTP'), consent: {purposes: ['marketing'], copyVersion: 'invite-3.4-1-guest'}})})).json();
        assert.equal(created.success, true);
        const status = await fetch(base + '/notifications/guest', {headers: {'x-guest-notifications': created.credential}});
        assert.equal(status.status, 200); assert.equal(status.headers.get('cache-control'), 'no-store');
        assert.equal((await fetch(base + '/notifications/guest')).status, 401, 'no credential, nothing revealed');
        assert.equal((await fetch(base + '/notifications/guest?credential=' + encodeURIComponent(created.credential))).status, 401, 'a credential in the URL is ignored');
        assert.equal((await fetch(base + '/notifications/guest', {method: 'DELETE', headers: {'x-guest-notifications': created.credential}})).status, 200);
        assert.equal((await fetch(base + '/notifications/preferences')).status, 401, 'account routes still require a session');
        await pool!.query(`UPDATE ${n}.settings SET paused=TRUE WHERE id=TRUE`);
      } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
    });

    await t.test('announcements carry their approved text; account updates stay generic', async () => {
      await pool!.query(`UPDATE ${n}.settings SET paused=FALSE WHERE id=TRUE`);
      await service.setPreferences('buyer1', {transactional: true, marketing: true});
      const preview = await service.previewAudience('admin', {templateId: 'maintenance', userId: 'buyer1'});
      await service.campaign('admin', {previewId: preview.previewId, requestId: 'consent-test-' + randomUUID().slice(0, 8), confirmed: true});
      const payloads: any[] = [];
      await processNotificationBatch(async (_s, payload) => { payloads.push(JSON.parse(payload)); }, 25);
      assert.ok(payloads.length > 0);
      for (const payload of payloads) { assert.equal(payload.kind, 'announcement'); assert.equal(payload.title, 'Service update'); assert.match(payload.body, /Mystery Hub/); assert.doesNotMatch(payload.body, /\{\{/); }
      await pool!.query(`UPDATE ${n}.settings SET paused=TRUE WHERE id=TRUE`);
    });
  } finally {
    await pool?.end(); await control.query(`DROP DATABASE ${name} WITH (FORCE)`); await control.end();
    for (const key of ['DATABASE_URL', 'DATABASE_SSL', 'MYSTERY_TEST_DATABASE_OPT_IN', 'WEB_PUSH_ENABLED', 'WEB_PUSH_VAPID_PUBLIC_KEY', 'WEB_PUSH_VAPID_PRIVATE_KEY', 'WEB_PUSH_VAPID_SUBJECT', 'WEB_PUSH_STORAGE_KEY']) { if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key]; }
  }
});
