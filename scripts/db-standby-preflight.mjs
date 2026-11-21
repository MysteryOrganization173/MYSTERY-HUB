#!/usr/bin/env node
/**
 * Read-only provider comparison for a controlled Mystery Hub database cutover.
 * Usage:
 *   MYSTERY_SOURCE_DATABASE_URL=... MYSTERY_STANDBY_DATABASE_URL=... \
 *     node scripts/db-standby-preflight.mjs
 * No credentials, customer values, or individual rows are printed.
 * The databases MUST have writes frozen for a meaningful final parity check.
 */
import pg from 'pg';

const REQUIRED_PUBLIC = [
  'users', 'sessions', 'orders', 'finance_accounts', 'finance_operations',
  'finance_ledger', 'supplier_webhook_events',
];

const sourceUrl = process.env.MYSTERY_SOURCE_DATABASE_URL;
const standbyUrl = process.env.MYSTERY_STANDBY_DATABASE_URL;

function connectionIdentity(raw) {
  const parsed = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('Both database URLs must use PostgreSQL.');
  }
  return [parsed.hostname.toLowerCase(), parsed.port || '5432', parsed.pathname];
}

function quoted(name) {
  return '"' + name.replaceAll('"', '""') + '"';
}

const INVENTORY_SQL = `
  SELECT n.nspname AS schema_name, c.relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE (n.nspname = 'public' OR n.nspname LIKE 'mysteryhub\\_%' ESCAPE '\\')
    AND c.relkind IN ('r','p')
  ORDER BY n.nspname, c.relname
`;

const SHAPES_SQL = `
  SELECT
    (SELECT COUNT(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' OR n.nspname LIKE 'mysteryhub\\_%' ESCAPE '\\') AS functions,
    (SELECT COUNT(*)::int FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE NOT t.tgisinternal
        AND (n.nspname='public' OR n.nspname LIKE 'mysteryhub\\_%' ESCAPE '\\')) AS triggers,
    (SELECT COUNT(*)::int FROM pg_policies
      WHERE schemaname='public' OR schemaname LIKE 'mysteryhub\\_%' ESCAPE '\\') AS policies
`;

async function inspect(url) {
  const client = new pg.Client({connectionString:url, connectionTimeoutMillis:10000});
  await client.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const summary = (await client.query("SELECT current_database() AS database, current_setting('server_version') AS version")).rows[0];
    const inventory = (await client.query(INVENTORY_SQL)).rows;
    const shapes = (await client.query(SHAPES_SQL)).rows[0];
    const tables = {};
    for (const item of inventory) {
      const key = item.schema_name + '.' + item.table_name;
      const qualified = quoted(item.schema_name) + '.' + quoted(item.table_name);
      const result = await client.query('SELECT COUNT(*)::text AS count FROM ' + qualified);
      tables[key] = result.rows[0].count;
    }
    await client.query('COMMIT');
    return {database:summary.database, version:summary.version,
      functions:shapes.functions, triggers:shapes.triggers, policies:shapes.policies,
      tables};
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  if (!sourceUrl || !standbyUrl) {
    throw new Error('Set MYSTERY_SOURCE_DATABASE_URL and MYSTERY_STANDBY_DATABASE_URL. Production DATABASE_URL is never modified by this tool.');
  }
  if (connectionIdentity(sourceUrl).join('|') === connectionIdentity(standbyUrl).join('|')) {
    throw new Error('Source and standby resolve to the same database endpoint. Refusing comparison.');
  }
  const source = await inspect(sourceUrl);
  const standby = await inspect(standbyUrl);
  const missing = Object.keys(source.tables).filter(key => !(key in standby.tables));
  const extra = Object.keys(standby.tables).filter(key => !(key in source.tables));
  const differing = Object.keys(source.tables).filter(key =>
    key in standby.tables && source.tables[key] !== standby.tables[key]
  ).map(key => ({table:key, source_rows:source.tables[key], standby_rows:standby.tables[key]}));
  const mandatoryMissing = REQUIRED_PUBLIC.filter(name => !('public.' + name in standby.tables));
  const structuralDifference = ['functions','triggers','policies'].filter(key => source[key] !== standby[key]);
  const readyForDeeperVerification = missing.length===0 && extra.length===0 &&
    differing.length===0 && mandatoryMissing.length===0 && structuralDifference.length===0;

  process.stdout.write(JSON.stringify({
    verdict: readyForDeeperVerification ? 'COUNTS_AND_OBJECT_TOTALS_MATCH_NOT_YET_CUTOVER_APPROVED' : 'NOT_READY',
    reminder: 'Matching counts never prove row content, constraint, trigger, or payment parity. Freeze writes and verify actual payment/order flows before any cutover.',
    source: {database:source.database, version:source.version, tables:Object.keys(source.tables).length,
      functions:source.functions, triggers:source.triggers, policies:source.policies},
    standby: {database:standby.database, version:standby.version, tables:Object.keys(standby.tables).length,
      functions:standby.functions, triggers:standby.triggers, policies:standby.policies},
    missing_tables:missing, extra_tables:extra, row_count_mismatches:differing,
    mandatory_missing:mandatoryMissing, object_count_mismatches:structuralDifference,
  },null,2)+'\n');
  if (!readyForDeeperVerification) process.exitCode=2;
}

main().catch(error => {
  console.error('Read-only standby preflight failed (' + (typeof error.code === 'string' ? error.code : 'connection or schema error') + '). No database URL is shown.');
  process.exitCode=1;
});
