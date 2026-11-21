import type { Express } from 'express';
import { getPool } from '../db/connection.js';

type Config = { maintenance: boolean; expectedName: string | undefined };

export function databaseMode(env: NodeJS.ProcessEnv): Config {
  const mode = env.DATABASE_MAINTENANCE;
  const expectedName = env.DATABASE_EXPECTED_NAME;
  if (mode !== undefined && mode !== 'true' && mode !== 'false') throw new Error('Invalid database maintenance configuration.');
  if ((mode==='true' || expectedName!==undefined) && !/^[a-z0-9_]{1,63}$/.test(expectedName||'')) {
    throw new Error('A verified database name is required for the database switch.');
  }
  if (env.NODE_ENV==='production') {
    let uri: URL | undefined;
    try { uri = new URL(env.DATABASE_URL||''); } catch { /* Existing startup handles invalid URLs outside the switch. */ }
    const standby = uri?.hostname.toLowerCase().endsWith('.neon.tech') || /^\/mysteryhub_(staging$|standby_|return_)/.test(uri?.pathname||'');
    if (standby && !expectedName) throw new Error('A verified database name is required for the database switch.');
    if (expectedName && (!uri || !['postgres:','postgresql:'].includes(uri.protocol) || uri.pathname!=='/'+expectedName ||
      uri.searchParams.getAll('sslmode').length!==1 || uri.searchParams.get('sslmode')!=='verify-full' ||
      [...uri.searchParams.keys()].some(key=>!['sslmode','channel_binding','sslrootcert'].includes(key)) ||
      env.DATABASE_SSL==='false')) {
      throw new Error('The verified database switch requires a matching database and verify-full TLS.');
    }
  }
  return { maintenance: mode==='true', expectedName };
}

async function restoredDatabase(expectedName: string): Promise<boolean> {
  const db = getPool();
  if (!db) return false;
  try {
    const query = {
      text: `SELECT current_database()=$1 AND NOT pg_is_in_recovery()
        AND NOT current_setting('transaction_read_only')::boolean
        AND EXISTS(SELECT FROM public.users WHERE role='admin' AND status='active')
        AND EXISTS(SELECT FROM public.orders WHERE payment_status='success' AND paid_at IS NOT NULL)
        AND (
          SELECT count(*)=8
          FROM (VALUES ('public.users'),('public.orders'),('public.sessions'),('public.finance_accounts'),
            ('public.finance_ledger'),('public.finance_operations'),('mysteryhub_sms.messages'),
            ('mysteryhub_notifications.deliveries')) AS expected(name)
          JOIN pg_class c ON c.oid=to_regclass(expected.name)
          WHERE c.relrowsecurity AND NOT c.relforcerowsecurity AND pg_has_role(current_user,c.relowner,'USAGE')
        ) AS ready`,
      values: [expectedName],
      query_timeout: 2500,
    };
    const {rows} = await db.query<{ready: boolean}>(query);
    return rows[0]?.ready===true;
  } catch { return false; }
}

export async function requireRestoredDatabase(expectedName: string | undefined) {
  if (expectedName && !await restoredDatabase(expectedName)) throw new Error('Restored database readiness checks failed. The server has not started.');
}

/** Register before application routes so maintenance cannot acknowledge callbacks or start writes. */
export function mountDatabaseMode(app: Express, mode: Config, probe = restoredDatabase) {
  if (mode.expectedName) {
    const expectedName = mode.expectedName;
    let snapshot = { ready:false, expires:0 };
    let inFlight: Promise<boolean> | undefined;
    app.get('/ready', async (_request, response) => {
      if (snapshot.expires<=Date.now()) {
        inFlight ??= Promise.resolve().then(()=>probe(expectedName)).catch(()=>false).then(ready=>{
          snapshot={ready,expires:Date.now()+2000};
          inFlight=undefined;
          return ready;
        });
        await inFlight;
      }
      response.set('Cache-Control','no-store').status(snapshot.ready?200:503).json({
        status:snapshot.ready?'ready':'unavailable', maintenance:mode.maintenance,
      });
    });
  }
  if (mode.maintenance) app.use((_request,response)=>{
    response.set({'Cache-Control':'no-store','Retry-After':'60'}).status(503).json({error:'Mystery Hub is temporarily in maintenance.'});
  });
}
