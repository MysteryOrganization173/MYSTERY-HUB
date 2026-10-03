import 'dotenv/config';
import { getPool } from '../db/connection.js';
import { ReferralStore } from '../db/referralStore.js';
import { STANDARD_DATA_REFERRAL_POLICY } from '../config/dataReferralRewardPolicy.js';
import { validateReferralRule } from '../services/referralRulePolicy.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply')) throw new Error('Only --apply is supported. Default is dry run.');
  const activation = new Date().toISOString();
  const rules = STANDARD_DATA_REFERRAL_POLICY.map(rule => validateReferralRule({ ...rule, starts_at: activation }));
  if (!args.includes('--apply')) {
    console.log(JSON.stringify({ mode: 'dry-run', rules, note: 'Explicit --apply and DATABASE_URL required. Existing policy IDs are preserved. Review existing network/product overrides before activation.' }, null, 2));
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for --apply.');
  const pool = getPool()!;
  try {
    const existing = await ReferralStore.getAllRules();
    for (const rule of rules) {
      if (existing.some(stored => stored.id === rule.id)) { console.log(`Preserved existing rule ${rule.id}`); continue; }
      await ReferralStore.createOrUpdateRule(rule);
      console.log(`Configured ${rule.id} from ${activation}`);
    }
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error.message, 'Inspect configured rules before retrying a partial apply.'); process.exitCode = 1; });
