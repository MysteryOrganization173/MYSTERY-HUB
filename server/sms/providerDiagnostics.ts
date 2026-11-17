import {smsInstalled} from './store.js';
import {getPool} from '../db/connection.js';
import {ArkeselClient,arkeselConfig,senderFingerprint,senderBlocked} from './arkesel.js';
import {smsTransaction} from './store.js';

/** A read-only provider request, never a send, sender registration or secret rotation. */
export async function observeSmsSender(api=new ArkeselClient()) {
  const config=arkeselConfig();if(!config.enabled||!config.senderValid||!config.key||!await smsInstalled())return;
  const fingerprint=senderFingerprint(config);
  const status=await api.senderStatus();
  if(fingerprint!==senderFingerprint()||status.sender!==arkeselConfig().sender)return;
  await smsTransaction(async c=>{
    const s=(await c.query('SELECT *,current_user AS database_actor,clock_timestamp() AS observed_at FROM mysteryhub_sms.settings WHERE id FOR UPDATE')).rows[0];
    // Unknown observations never clear a confirmed negative sender verdict.
    const previous=s.balance?._providerSender;
    const verdict=status.status==='unverified'&&senderBlocked(previous,config)?{...previous,lastObservation:status}:status;
    const pause=senderBlocked(verdict,config)&&(!s.paused||s.auto_enabled);
    const balance={...s.balance,_providerSender:{...verdict,databaseObservedAt:s.observed_at}};
    if(pause)balance._providerIncidentAudit=[...(balance._providerIncidentAudit||[]),{
      operation:'provider_sender_incident_pause',databaseActor:s.database_actor,at:s.observed_at,
      reason:verdict.status,documentsRequired:verdict.documentsRequired,previousRevision:s.revision,
      previousAutoEnabled:s.auto_enabled,previousCutoff:s.cutoff,previousTypes:s.auto_types,
    }];
    await c.query(`UPDATE mysteryhub_sms.settings SET balance=$1,
      paused=CASE WHEN $2 THEN true ELSE paused END,auto_enabled=CASE WHEN $2 THEN false ELSE auto_enabled END,
      revision=revision+CASE WHEN $2 THEN 1 ELSE 0 END,updated_at=CASE WHEN $2 THEN now() ELSE updated_at END
      WHERE id AND revision=$3`,[JSON.stringify(balance),pause,s.revision]);
    if(pause)await c.query("UPDATE mysteryhub_sms.messages SET state='cancelled',error_code='PROVIDER_SENDER_BLOCKED',updated_at=now() WHERE state='queued' AND network_started_at IS NULL");
    // Approval later updates evidence only. An operator must explicitly resume;
    // re-enabling automatic policy establishes a new cutoff and cannot backfill.
  });
}
