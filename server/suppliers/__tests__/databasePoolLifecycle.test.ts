import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { after, test } from 'node:test';
import pg from 'pg';

// Exercise node-postgres's real pool/queue with a socket-free synthetic provider.
// No application environment is loaded and no external database can be contacted.
const NativePool = pg.Pool;
let sessions = 0, peak = 0, failConnect = false, failQuery = false;
let queryDelay = 5;
const statements: string[] = [];
class FixtureClient extends EventEmitter {
  _queryable = true;
  _ending = false;
  connected = false;
  connect(callback: (error?: Error) => void) {
    setImmediate(() => {
      if (failConnect || sessions >= 15) return callback(new Error('EMAXCONNSESSION: synthetic provider limit 15'));
      this.connected = true;
      sessions++; peak = Math.max(peak, sessions);
      callback();
    });
  }
  query(sql: string, values?: unknown[] | ((error: Error | null, result?: unknown) => void), callback?: (error: Error | null, result?: unknown) => void): any {
    const done = typeof values === 'function' ? values : callback;
    const work = new Promise((resolve, reject) => {
      setTimeout(() => {
        statements.push(sql);
        if (failQuery && sql !== 'ROLLBACK') reject(new Error('Synthetic query rejection'));
        else resolve({ rows: sql.startsWith('SELECT * FROM finance_accounts') ? [{ wallet_minor: 0, restricted: false }] : [], rowCount: 0 });
      }, queryDelay);
    });
    if (done) { work.then(result => done(null, result), error => done(error)); return; }
    return work;
  }
  end(callback?: () => void) {
    this._ending = true;
    if (this.connected) { sessions--; this.connected = false; }
    setImmediate(() => { this.emit('end'); callback?.(); });
    return Promise.resolve();
  }
  ref() {}
  unref() {}
}

pg.Pool = class extends NativePool {
  constructor(options?: pg.PoolConfig) { super({ ...options, Client: FixtureClient } as unknown as pg.PoolConfig); }
} as typeof pg.Pool;
process.env.DATABASE_URL = 'postgresql://fixture.invalid/never-contacted';
const { getPool, initDatabase } = await import('../../db/connection.js');
const { AuthStore } = await import('../../db/authStore.js');
const { FinanceStore } = await import('../../db/financeStore.js');
const { requireAdmin, optionalAuth } = await import('../../middleware/authMiddleware.js');
const pool = getPool()!;
pg.Pool = NativePool;
after(async () => { await pool.end(); delete process.env.DATABASE_URL; });
const settle = () => new Promise(resolve => setImmediate(resolve));

test('the previous 20-client setting reproduces five provider rejections with no leaked client', async () => {
  const previous = new NativePool({ max: 20, Client: FixtureClient } as unknown as pg.PoolConfig);
  try {
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => previous.query('SELECT 1')));
    assert.equal(results.filter(result => result.status === 'rejected').length, 5);
    assert.equal(previous.totalCount, 15);
    assert.equal(previous.idleCount, 15);
  } finally { await previous.end(); }
  assert.equal(sessions, 0);
});

test('one shared pool reserves session capacity for a second rollout process and operational access', () => {
  assert.equal(getPool(), pool);
  assert.equal(pool.options.max, 5);
  assert.ok(pool.options.max! * 2 < 15);
  assert.equal(pool.options.idleTimeoutMillis, 30_000);
  assert.equal(pool.options.connectionTimeoutMillis, 10_000);
});

test('twenty concurrent queries queue locally without exceeding the provider session limit', async () => {
  peak = sessions;
  const results = await Promise.allSettled(Array.from({ length: 20 }, () => pool.query('SELECT 1')));
  assert.equal(results.filter(result => result.status === 'rejected').length, 0);
  assert.ok(peak <= 5, `opened ${peak} sessions`);
  await settle();
  assert.equal(pool.waitingCount, 0);
  assert.equal(pool.idleCount, pool.totalCount);
});

test('two application processes fit within the 15-session provider budget', async () => {
  const second = new NativePool({ ...pool.options, Client: FixtureClient } as unknown as pg.PoolConfig);
  try {
    peak = sessions;
    await Promise.all(Array.from({ length: 40 }, (_, index) => (index % 2 ? second : pool).query('SELECT 1')));
    assert.ok(peak <= 10, `opened ${peak} sessions`);
  } finally { await second.end(); }
});

test('query rejection releases the pool client and a subsequent query recovers', async () => {
  failQuery = true;
  try { await assert.rejects(pool.query('SELECT 1'), /Synthetic query rejection/); }
  finally { failQuery = false; }
  await pool.query('SELECT 1'); await settle();
  assert.equal(pool.waitingCount, 0);
  assert.equal(pool.idleCount, pool.totalCount);
});

test('failed transaction rolls back and releases without replaying its action', async () => {
  statements.length = 0;
  let actions = 0;
  await assert.rejects(FinanceStore.transaction('synthetic', async () => {
    actions++; throw new Error('Synthetic financial action failure');
  }), /Synthetic financial action failure/);
  assert.equal(actions, 1);
  assert.ok(statements.includes('ROLLBACK'));
  assert.ok(!statements.includes('COMMIT'));
  assert.equal(pool.idleCount, pool.totalCount);
});

test('account transaction and failed startup schema initialization release their clients', async () => {
  await assert.rejects(AuthStore.withLockedUser('synthetic', async () => { throw new Error('Synthetic account failure'); }), /Synthetic account failure/);
  failQuery = true;
  const log = console.error; console.error = () => {};
  try { await assert.rejects(initDatabase(), /Synthetic query rejection/); }
  finally { failQuery = false; console.error = log; }
  assert.equal(pool.idleCount, pool.totalCount);
  await pool.query('SELECT 1');
});

test('an exhausted local pool times out its waiter without opening an excess connection and recovers', async () => {
  const acquisitions = await Promise.allSettled(Array.from({ length: pool.options.max! }, () => pool.connect()));
  const clients = acquisitions.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  const timeout = pool.options.connectionTimeoutMillis;
  pool.options.connectionTimeoutMillis = 25;
  try {
    assert.equal(clients.length, pool.options.max);
    await assert.rejects(pool.connect(), /timeout exceeded/);
    assert.equal(pool.waitingCount, 0);
    assert.equal(pool.totalCount, 5);
  } finally { pool.options.connectionTimeoutMillis = timeout; clients.forEach(client => client.release()); }
  await pool.query('SELECT 1');
  assert.equal(pool.idleCount, pool.totalCount);
});

test('provider unavailability rejects acquisition without retaining a client or retrying financial work', async () => {
  const isolated = new NativePool({ max: 5, connectionTimeoutMillis: 50, Client: FixtureClient } as unknown as pg.PoolConfig);
  failConnect = true;
  try {
    await assert.rejects(isolated.connect(), /EMAXCONNSESSION/);
    assert.equal(isolated.totalCount, 0);
    assert.equal(isolated.waitingCount, 0);
  } finally { failConnect = false; await isolated.end(); }
});

test('new-connection timeout removes the failed dial and allows a subsequent acquisition', async () => {
  let hang = true;
  class DelayedClient extends FixtureClient {
    pending?: (error?: Error) => void;
    connect(callback: (error?: Error) => void) { if (hang) this.pending = callback; else super.connect(callback); }
    isConnected() { return this.connected; }
    end(callback?: () => void) { this.pending?.(new Error('Synthetic dial closed')); this.pending = undefined; return super.end(callback); }
  }
  const isolated = new NativePool({ max: 1, connectionTimeoutMillis: 25, Client: DelayedClient } as unknown as pg.PoolConfig);
  try {
    await assert.rejects(isolated.connect(), /connection timeout/);
    assert.equal(isolated.totalCount, 0);
    hang = false;
    await isolated.query('SELECT 1');
    assert.equal(isolated.idleCount, 1);
  } finally { await isolated.end(); }
});

function response() {
  return { statusCode: 200, body: null as any, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } };
}
test('concurrent admin authentication uses the shared bounded pool and never grants invalid sessions', async () => {
  const responses = await Promise.all(Array.from({ length: 20 }, async () => {
    const res = response();
    await requireAdmin({ headers: { authorization: 'Bearer synthetic-invalid' } } as any, res as any, () => assert.fail('Invalid session authorized'));
    return res.statusCode;
  }));
  assert.deepEqual(new Set(responses), new Set([401]));
  assert.equal(pool.waitingCount, 0);
  assert.equal(pool.idleCount, pool.totalCount);
});

test('database errors fail closed for admin and supplied guest credentials; credentials are not returned', async () => {
  failQuery = true;
  const log = console.error; console.error = () => {};
  try {
    for (const [middleware, status] of [[requireAdmin, 500], [optionalAuth, 503]] as const) {
      const res = response();
      await middleware({ headers: { authorization: 'Bearer synthetic-invalid' } } as any, res as any, () => assert.fail('Database error granted access'));
      assert.equal(res.statusCode, status);
      assert.ok(!JSON.stringify(res.body).includes('synthetic-invalid'));
    }
  } finally { failQuery = false; console.error = log; }
  await pool.query('SELECT 1');
});

test('abandoned HTTP response does not leak the authentication query connection', async () => {
  queryDelay = 30;
  const res = response(); let closed = false;
  res.json = () => { assert.ok(closed); return res; };
  const pending = requireAdmin({ headers: { authorization: 'Bearer synthetic-invalid' } } as any, res as any, () => assert.fail('Invalid session authorized'));
  // The existing middleware lets an in-flight DB query finish after a caller disconnects.
  closed = true;
  try { await pending; } finally { queryDelay = 5; }
  assert.equal(pool.waitingCount, 0);
  assert.equal(pool.idleCount, pool.totalCount);
});
