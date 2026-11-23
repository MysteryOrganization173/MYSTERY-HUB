import { getPool } from '../server/db/connection.js';
import { postgresErrorLabel } from '../server/db/postgresTls.js';

async function verify() {
  const expected = process.argv[2];
  if (process.env.DATABASE_SSL!=='verify-full' || process.argv.length!==3 || !/^[a-z0-9_]{1,63}$/.test(expected||'')) {
    throw new Error('Supply the expected database name and set DATABASE_SSL=verify-full.');
  }
  const pool = getPool();
  if (!pool) throw new Error('Configure DATABASE_URL through the secure runtime environment.');
  try {
    const { rows } = await pool.query<{ matches: boolean }>('SELECT current_database()=$1 AS matches',[expected]);
    if (rows[0]?.matches!==true) throw new Error('Database identity check failed.');
    console.log('Verified PostgreSQL TLS certificate, hostname, and expected database.');
  } finally { await pool.end(); }
}

verify().catch(error=>{
  // Never render raw driver errors or options. Both can contain credentials or certificates.
  console.error('Strict PostgreSQL TLS probe failed'+postgresErrorLabel(error)+'. Check the expected database, TLS settings, and provider CA.');
  process.exitCode=1;
});
