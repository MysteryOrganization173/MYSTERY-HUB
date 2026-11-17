import {randomUUID} from 'node:crypto';
import {getPool} from '../db/connection.js';
import {arkeselConfig,signingFingerprint} from './arkesel.js';
import {smsInstalled} from './store.js';
const bootId=randomUUID();
/** Whitelisted private runtime observation; never a credential/environment dump. */
export function withSmsRuntime(c=arkeselConfig()) {
  return {protocol:'sms-experience-v2',bootId,instance:process.env.RENDER_INSTANCE_ID||null,commit:process.env.RENDER_GIT_COMMIT||null,
    observedAt:new Date().toISOString(),enabled:c.enabled,auto:c.auto,worker:c.worker,
    sandbox:c.sandbox,testOnly:c.testOnly,liveApproved:process.env.ARKESEL_LIVE_APPROVED==='true',
    sender:c.sender,approved:c.approved,sendAllowed:c.sendAllowed,signingConfigured:!!c.secret,
    dailyCredits:c.daily,autoDailyCredits:c.autoDaily,lowCredits:c.lowCredits};
}
export async function recordSmsRuntime() {
  try{if(await smsInstalled())await getPool()!.query(`UPDATE mysteryhub_sms.settings SET balance=COALESCE(balance,'{}'::jsonb)||jsonb_build_object('_runtime',$1::jsonb||jsonb_build_object('databaseObservedAt',now(),'providerSigningVerified',signing_fingerprint=$2,'signingVerifiedAt',signing_verified_at)) WHERE id`,[JSON.stringify(withSmsRuntime()),signingFingerprint()]);}catch{/* Observation cannot prevent startup. */}
}
