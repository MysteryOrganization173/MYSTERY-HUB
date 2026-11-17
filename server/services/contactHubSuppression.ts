import type {PoolClient} from 'pg';

export type ContactSmsWithdrawal={phone:string|null;user_id:string|null;purpose:'transactional'|'operational'|'marketing'};

/** Optional existing SMS evidence, read in the caller's snapshot. Never creates storage,
 * grants permission, sends, or treats an unavailable evidence query as an empty result. */
export async function contactWithdrawalSql(c:Pick<PoolClient,'query'>):Promise<string>{
 const installed=(await c.query("SELECT to_regclass('mysteryhub_sms.consents') IS NOT NULL AS consents,to_regclass('mysteryhub_sms.permission_records') IS NOT NULL AS permissions")).rows[0];
 const sources=["SELECT NULL::text AS phone,NULL::text AS user_id,NULL::text AS purpose WHERE FALSE"];
 if(installed.consents){
  sources.push(`SELECT phone,NULL::text AS user_id,purpose FROM (SELECT DISTINCT ON(phone,purpose,user_id) phone,user_id,purpose,granted FROM mysteryhub_sms.consents ORDER BY phone,purpose,user_id,id DESC) latest WHERE NOT granted`);
  // A current account withdrawal also follows its contact number after a phone change.
  sources.push(`SELECT NULL::text,user_id,purpose FROM (SELECT DISTINCT ON(user_id,purpose) user_id,purpose,granted FROM mysteryhub_sms.consents WHERE user_id IS NOT NULL ORDER BY user_id,purpose,id DESC) latest WHERE NOT granted`);
 }
 if(installed.permissions)sources.push(`SELECT phone,NULL::text,purpose FROM (SELECT DISTINCT ON(phone,purpose) phone,purpose,granted FROM mysteryhub_sms.permission_records ORDER BY phone,purpose,id DESC) latest WHERE NOT granted`);
 return sources.join(' UNION ALL ');
}
