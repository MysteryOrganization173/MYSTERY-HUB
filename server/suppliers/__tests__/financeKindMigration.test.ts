import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import pg from 'pg';
import { FINANCE_SCHEMA } from '../../db/financeSchema.js';
import { WEBSITE_BUSINESS_SCHEMA } from '../../db/websiteBusinessSchema.js';
import { COMMERCIAL_SCHEMA } from '../../db/commercialSchema.js';
import { getPool, initDatabase } from '../../db/connection.js';

const kinds = ['topup', 'withdrawal', 'transfer', 'purchase', 'achievement', 'adjustment',
  'reversal', 'refund', 'review', 'store_checkout', 'store_sale', 'direct_checkout', 'welcome'];
const mirror = readFileSync('server/db/schema.sql', 'utf8').replaceAll('\r\n', '\n');
const constraint = (sql: string) => {
  const match = sql.match(/ADD CONSTRAINT finance_operations_kind_check CHECK\(kind IN \(([^)]+)\)\)/);
  assert.ok(match, 'operation-kind CHECK must remain enforced');
  return [...match[1].matchAll(/'([^']+)'/g)].map(row => row[1]);
};

test('website-business CHECK accepts exactly the established 13 commercial kinds', () => {
  assert.deepEqual(constraint(WEBSITE_BUSINESS_SCHEMA), kinds);
  assert.deepEqual(constraint(COMMERCIAL_SCHEMA), kinds);
});

test('SQL mirror contains the complete unchanged-order schema definitions', () => {
  for (const schema of [FINANCE_SCHEMA, WEBSITE_BUSINESS_SCHEMA, COMMERCIAL_SCHEMA]) {
    assert.ok(mirror.includes(schema.replaceAll('\r\n', '\n')));
  }
  const checks = [...mirror.matchAll(/ADD CONSTRAINT finance_operations_kind_check CHECK\(kind IN \(([^)]+)\)\)/g)];
  assert.equal(checks.length, 2);
  for (const check of checks) assert.deepEqual(constraint(check[0]), kinds);
});

test('startup retains finance then website-business then commercial migration order', () => {
  const source = readFileSync('server/db/connection.ts', 'utf8');
  const positions = [FINANCE_SCHEMA, WEBSITE_BUSINESS_SCHEMA, COMMERCIAL_SCHEMA].map((_, i) =>
    source.indexOf(`await client.query(${['FINANCE_SCHEMA', 'WEBSITE_BUSINESS_SCHEMA', 'COMMERCIAL_SCHEMA'][i]})`));
  assert.ok(positions[0] >= 0 && positions[0] < positions[1] && positions[1] < positions[2]);
  assert.ok(!WEBSITE_BUSINESS_SCHEMA.includes('NOT VALID'));
});

// Opt in only with a disposable local PostgreSQL database, never DATABASE_URL:
// FINANCE_MIGRATION_TEST_DATABASE_URL=postgresql://...@127.0.0.1:5432/mystery_finance_migration_test
// FINANCE_MIGRATION_TEST_OPT_IN=disposable-local-postgres
// npm test -- server/suppliers/__tests__/financeKindMigration.test.ts
// Each real run uses a fresh transaction-scoped schema and ROLLBACK, no deletes.
const databaseUrl = process.env.FINANCE_MIGRATION_TEST_DATABASE_URL;
test('real PostgreSQL: empty and repeated initialization preserve all financial records', {
  skip: !databaseUrl ? 'Disposable PostgreSQL not configured; real migration was NOT tested' : false,
}, async t => {
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.FINANCE_MIGRATION_TEST_OPT_IN, 'disposable-local-postgres');
  const url = new URL(databaseUrl!);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'external hosts forbidden');
  assert.equal(url.pathname, '/mystery_finance_migration_test');
  assert.equal(url.search, '', 'connection overrides forbidden');
  const client = new pg.Client({ connectionString: databaseUrl, ssl: false, connectionTimeoutMillis: 3000 });
  const previousConnect = pg.Pool.prototype.connect;
  const savedEnv = { ...process.env };
  await client.connect();
  try {
    await client.query('BEGIN');
    const schema = `finance_migration_${randomUUID().replaceAll('-', '')}`;
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}"`);
    // Bridge the real startup initializer onto this real PostgreSQL connection.
    // All SQL is executed by PostgreSQL, not simulated or parsed by a mock.
    process.env.DATABASE_URL = databaseUrl;
    process.env.MYSTERY_TEST_DATABASE_OPT_IN = 'true';
    process.env.DATABASE_SSL = 'false';
    pg.Pool.prototype.connect = (async () => ({
      query: client.query.bind(client), release() {},
    })) as typeof previousConnect;
    await t.test('empty database initializes using actual application startup', async () => {
      await initDatabase();
      assert.equal((await client.query('SELECT count(*) FROM finance_operations')).rows[0].count, '0');
    });
    await client.query("INSERT INTO users(id,name,password_hash) VALUES ('fixture-user','Synthetic fixture','not-a-real-hash')");
    await client.query("INSERT INTO finance_accounts(user_id,wallet_minor) VALUES ('fixture-user',4200)");
    await t.test('all 13 legitimate kinds are accepted', async () => {
      for (const kind of kinds) await client.query(
        `INSERT INTO finance_operations(id,user_id,kind,idempotency_key,state,amount_minor,payload)
         VALUES ($1,'fixture-user',$2,$1,'completed',100,$3)`,
        [`fixture-${kind}`, kind, JSON.stringify({ orderId: `order-${kind}`, reference: `ref-${kind}` })]);
    });
    await client.query(`INSERT INTO finance_ledger(id,user_id,operation_id,bucket,delta_minor,balance_after_minor,description)
      VALUES ('fixture-ledger','fixture-user','fixture-topup','wallet',100,4200,'Synthetic historical ledger')`);
    await client.query(`INSERT INTO orders(id,public_reference,customer_email,customer_phone,recipient_phone,network,
      product_id,product_name_snapshot,bundle_size_snapshot,amount,payment_reference,user_id,store_context,commercial_context)
      VALUES ('fixture-order','FIXTURE-ONLY','fixture@example.invalid','0241111111','0241111111','telecel',
      'fixture-product','Synthetic bundle','1GB',100,'fixture-payment','fixture-user','{"siteId":"fixture-site"}','{"paidMinor":100}')`);
    const snapshot = async () => {
      const records: Record<string, unknown> = {};
      for (const table of ['finance_accounts', 'finance_ledger', 'finance_operations', 'orders']) {
        records[table] = (await client.query(`SELECT * FROM ${table} ORDER BY 1`)).rows;
      }
      return records;
    };
    const before = await snapshot();
    await t.test('old 11-kind migration reproduces SQLSTATE 23514 on historical operations', async () => {
      await client.query('SAVEPOINT old_migration');
      const obsolete = WEBSITE_BUSINESS_SCHEMA.replace(
        ",'direct_checkout','welcome'", '');
      await assert.rejects(client.query(obsolete), (error: any) =>
        error.code === '23514' && error.constraint === 'finance_operations_kind_check');
      await client.query('ROLLBACK TO SAVEPOINT old_migration');
    });
    await t.test('three actual repeat startups keep historical kinds and all records unchanged', async () => {
      for (let i = 0; i < 3; i++) {
        await initDatabase();
        assert.deepEqual(await snapshot(), before);
      }
    });
    await t.test('SQL mirror also repeats without changing financial/order records', async () => {
      for (let i = 0; i < 2; i++) {
        await client.query(mirror);
        assert.deepEqual(await snapshot(), before);
      }
    });
    await t.test('unsupported kinds remain rejected with the named CHECK', async () => {
      await client.query('SAVEPOINT unsupported_kind');
      await assert.rejects(client.query(`INSERT INTO finance_operations
        (id,user_id,kind,idempotency_key,state,amount_minor)
        VALUES ('unsupported','fixture-user','unsupported_kind','unsupported','completed',100)`),
      (error: any) => error.code === '23514' && error.constraint === 'finance_operations_kind_check');
      await client.query('ROLLBACK TO SAVEPOINT unsupported_kind');
      assert.deepEqual(await snapshot(), before);
    });
  } finally {
    pg.Pool.prototype.connect = previousConnect;
    await client.query('ROLLBACK');
    await client.end();
    await getPool()?.end();
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
  }
});
