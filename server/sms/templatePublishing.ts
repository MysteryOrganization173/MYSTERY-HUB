import {SMS_TRANSACTIONAL_COPY,transactionalExample,type TransactionalStage} from '../../shared/smsTransactional.js';
import {smsTransaction} from './store.js';
import {strict} from './policy.js';
import {FinanceError} from '../db/financeStore.js';
import {AdminAuditStore} from '../db/adminAuditStore.js';
import {smsEstimate} from '../../src/utils/manualSms.js';

export function automaticTemplateView(rows:any[]) {
  return Object.entries(SMS_TRANSACTIONAL_COPY).map(([id,variants])=>{
    const row=rows.find(r=>r.id===id),wordingId=row?.body===variants.concise?'concise':'standard';
    return {id,version:row?.version||0,wordingId,published:Object.values(variants).includes(row?.body),variants:Object.keys(variants).map(wording=>({
      id:wording,example:transactionalExample(id as TransactionalStage,wording as any),
      guestExample:transactionalExample(id as TransactionalStage,wording as any,true),
      estimate:smsEstimate(transactionalExample(id as TransactionalStage,wording as any)),
    }))};
  });
}
export async function publishAutomaticTemplate(actor:string,input:any) {
  strict(input,['id','wordingId','expectedVersion','confirmed']);
  const variants=SMS_TRANSACTIONAL_COPY[input.id as TransactionalStage];
  if(!variants||!['standard','concise'].includes(input.wordingId)||input.confirmed!==true||!Number.isSafeInteger(input.expectedVersion))throw new FinanceError('Review an approved wording version before publishing.');
  return smsTransaction(async c=>{
    const old=(await c.query('SELECT * FROM mysteryhub_sms.templates WHERE id=$1 FOR UPDATE',[input.id])).rows[0];
    if(!old||old.version!==input.expectedVersion)throw new FinanceError('Template changed. Reload and compare versions.',409);
    await c.query('INSERT INTO mysteryhub_sms.template_versions(template_id,version,snapshot,actor_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[old.id,old.version,JSON.stringify({body:old.body,title:old.title,purpose:old.purpose,locked:old.locked}),actor]);
    const body=variants[input.wordingId as 'standard'|'concise'],version=old.version+1;
    await c.query('UPDATE mysteryhub_sms.templates SET body=$2,version=$3,locked=true,updated_at=now() WHERE id=$1',[old.id,body,version]);
    await c.query('INSERT INTO mysteryhub_sms.template_versions(template_id,version,snapshot,actor_id) VALUES($1,$2,$3,$4)',[old.id,version,JSON.stringify({body,wordingId:input.wordingId,protocol:'sms-experience-v2'}),actor]);
    await AdminAuditStore.record({adminUserId:actor,action:'sms_automatic_wording_published',entityType:'sms_template',entityId:old.id,metadata:{wording:input.wordingId,version}},c);
    return {published:true,version,sent:false};
  });
}
