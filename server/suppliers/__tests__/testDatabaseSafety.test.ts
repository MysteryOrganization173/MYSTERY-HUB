import assert from 'node:assert/strict';
import { test } from 'node:test';
import dotenv from 'dotenv';
import pg from 'pg';
import { assertSafeTestDatabase, isTestRuntime, loadApplicationEnvironment } from '../../utils/environment.js';
import { getPool } from '../../db/connection.js';

const external = 'postgresql://user:secret@production.example.com/mystery';
test('tests without DATABASE_URL use isolated memory', () => {
  assert.doesNotThrow(() => assertSafeTestDatabase({ NODE_ENV: 'test' }));
});
test('external database is denied before any query, even with explicit opt-in', () => {
  for (const optIn of [undefined, 'true']) assert.throws(() => assertSafeTestDatabase({ NODE_ENV: 'test', DATABASE_URL: external, MYSTERY_TEST_DATABASE_OPT_IN: optIn }), /access denied/);
});
test('test worker cannot bypass protection by setting production mode', () => {
  assert.equal(isTestRuntime({ NODE_ENV: 'production', NODE_TEST_CONTEXT: 'child-v8' }), true);
  assert.throws(() => assertSafeTestDatabase({ NODE_ENV: 'production', NODE_TEST_CONTEXT: 'child-v8', DATABASE_URL: external }), /access denied/);
});
test('loopback database requires explicit opt-in and a test-only database name', () => {
  const DATABASE_URL = 'postgresql://127.0.0.1/mystery_test';
  assert.throws(() => assertSafeTestDatabase({ NODE_ENV: 'test', DATABASE_URL }), /access denied/);
  assert.doesNotThrow(() => assertSafeTestDatabase({ NODE_ENV: 'test', DATABASE_URL, MYSTERY_TEST_DATABASE_OPT_IN: 'true' }));
  assert.throws(() => assertSafeTestDatabase({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost/mystery', MYSTERY_TEST_DATABASE_OPT_IN: 'true' }), /access denied/);
});
test('connection-string host/database redirects and malformed URLs are rejected', () => {
  for (const DATABASE_URL of ['not a URL', 'https://localhost/mystery_test', 'postgresql://localhost/mystery_test?host=production.example.com', 'postgresql://localhost/mystery_test?dbname=mystery']) {
    assert.throws(() => assertSafeTestDatabase({ NODE_ENV: 'test', DATABASE_URL, MYSTERY_TEST_DATABASE_OPT_IN: 'true' }), /access denied/);
  }
});
test('existing reserved mock destination remains usable without networking', () => {
  assert.doesNotThrow(() => assertSafeTestDatabase({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://fixture.invalid/never-contacted' }));
  assert.throws(() => assertSafeTestDatabase({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://fixture.invalid/production' }), /access denied/);
});
test('normal production database handling is unchanged outside test workers', () => {
  assert.doesNotThrow(() => assertSafeTestDatabase({ NODE_ENV: 'production', DATABASE_URL: external }));
});
test('test environment loading never calls dotenv or replaces explicit test settings', () => {
  const old = dotenv.config, previous = { ...process.env }; let calls = 0;
  try {
    dotenv.config = (() => { calls++; return {}; }) as typeof dotenv.config;
    process.env.NODE_ENV = 'test'; delete process.env.DATABASE_URL;
    loadApplicationEnvironment();
    process.env.NODE_ENV = 'production'; process.env.NODE_TEST_CONTEXT = 'child-v8';
    loadApplicationEnvironment();
    assert.equal(calls, 0); assert.equal(process.env.DATABASE_URL, undefined);
    delete process.env.NODE_TEST_CONTEXT;
    loadApplicationEnvironment(); assert.equal(calls, 1);
  } finally { dotenv.config = old; process.env = previous; }
});
test('getPool rejects an inherited external URL before a pg connection or mutation', () => {
  const previous = { ...process.env }, oldConnect = pg.Pool.prototype.connect, oldQuery = pg.Pool.prototype.query;
  let calls = 0;
  try {
    pg.Pool.prototype.connect = (() => { calls++; throw new Error('Must not connect'); }) as any;
    pg.Pool.prototype.query = (() => { calls++; throw new Error('Must not mutate'); }) as any;
    process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = external;
    assert.throws(() => getPool(), /access denied/); assert.equal(calls, 0);
  } finally { process.env = previous; pg.Pool.prototype.connect = oldConnect; pg.Pool.prototype.query = oldQuery; }
});
