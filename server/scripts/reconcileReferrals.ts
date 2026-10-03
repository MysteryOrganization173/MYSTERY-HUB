import 'dotenv/config';
import { getPool } from '../db/connection.js';
import { reconcileReferralHistory } from '../services/referralRecoveryRunner.js';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--apply')) {
  console.error('Usage: npx tsx server/scripts/reconcileReferrals.ts [--apply]');
  process.exitCode = 1;
} else if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required; historical recovery never uses a development memory fallback.');
  process.exitCode = 1;
} else {
  const pool = getPool();
  try {
    if (!pool) throw new Error('Database unavailable');
    console.log(JSON.stringify(await reconcileReferralHistory(pool, args.includes('--apply')), null, 2));
  } catch {
    console.error('Referral reconciliation aborted. No partial repairs were committed. Investigate database availability or conflicting evidence before retrying.');
    process.exitCode = 1;
  } finally { await pool?.end(); }
}
