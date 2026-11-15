import {createHash} from 'node:crypto';
import {ContactHubStore,contactTransaction} from '../db/contactHubStore.js';
import {AdminAuditStore} from '../db/adminAuditStore.js';
import {FinanceError} from '../db/financeStore.js';
import {safeCsvCell} from '../utils/csv.js';
import {canonicalGhanaPhone} from '../utils/phone.js';
import {CONTACT_EXPORT_LIMIT,contactFilters,purposeEligible} from './contactHubPolicy.js';
import type {ContactFilters,ContactRow,ContactPurpose,ContactExportPreview,ContactDetail} from '../../shared/contactHub.js';

function contactRevision(f:ContactFilters,p:ContactPurpose,rows:ContactRow[],issued:number){return issued+':'+createHash('sha256').update(JSON.stringify([f,p,rows,issued])).digest('hex');}
const PURPOSES=['administrative','guest_reference','support_notice','marketing'];
function purpose(value:unknown,f:ContactFilters):ContactPurpose {
 if(typeof value!=='string'||!PURPOSES.includes(value)||f.source==='registered'&&value==='guest_reference')throw new FinanceError('Choose an export purpose appropriate to this contact source.');
 return value as ContactPurpose;
}
function exact(value:unknown,keys:string[]):asserts value is Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw new FinanceError('Unexpected contact request fields.');}
function selected(rows:ContactRow[],p:ContactPurpose){return rows.filter(r=>purposeEligible(r,p));}
export function contactExportPreview(rows:ContactRow[],total:number,p:ContactPurpose,f:ContactFilters,issued=Date.now()):ContactExportPreview {
 if(total>CONTACT_EXPORT_LIMIT)throw new FinanceError(`This audience has more than ${CONTACT_EXPORT_LIMIT} records. Narrow the filters; no partial export was produced.`,413);
 if(rows.length!==total)throw new FinanceError('The full audience could not be read. No partial export was produced.',503);
 const eligible=selected(rows,p),numbers=eligible.flatMap(r=>r.phone?[r.phone]:[]),withPhone=rows.filter(r=>r.rawPhone?.trim()).length;
 return {expiresAt:new Date(issued+900000).toISOString(),revision:contactRevision(f,p,rows,issued),total,withPhone,uniqueNumbers:new Set(numbers).size,duplicatesRemoved:numbers.length-new Set(numbers).size,invalid:rows.filter(r=>r.rawPhone?.trim()&&!r.phone).length,missing:total-withPhone,excluded:rows.length-eligible.length,purpose:p,maxRecords:CONTACT_EXPORT_LIMIT,warning:p==='marketing'?'No verified SMS marketing consent exists in this release. No marketing recipients qualify.':p==='support_notice'?'Review-only service notice for established active account buyers. SMS consent remains unknown; matching SMS unsubscribes and disabled transactional preferences are withheld. Preparation is not sending.':p==='guest_reference'?'Recipient activity only: actual purchasers and their contact permissions may differ. This is not a marketing audience.':'Internal administrative analysis only. Direct contacts are provided or observed, not verified ownership or marketing consent. Account contacts are provided, not verified ownership or marketing consent.'};
}
export function contactExport(rows:ContactRow[],p:ContactPurpose,format:'csv'|'txt'|'newline'|'comma'):string {
 const eligible=selected(rows,p),numbers=[...new Set(eligible.flatMap(r=>r.phone?[r.phone]:[]))].sort();
 if(format!=='csv')return numbers.join(format==='comma'?',':'\n');
 const headers=['Classification','Account ID','Name','Normalized phone','Email','Account status','Contact source','First completed delivery','Last completed delivery','Completed purchases / guest deliveries','Completed account spending GHS','Recognition','SMS permission','Caveat'];
 return '\uFEFF'+[headers,...eligible.map(r=>[r.segment,r.source==='registered'?r.id:'',r.name||'',r.phone||'',r.email||'',r.status,r.provenance.join('; '),r.firstAt||'',r.lastAt||'',r.purchases,r.source==='registered'?(r.spendingMinor/100).toFixed(2):'',r.vip.join('; '),r.smsPermission,r.source!=='registered'?'Direct contact provenance only; no merged purchaser identity or marketing permission':r.smsPermission==='sms_unsubscribed'?'Service-scoped SMS unsubscribe found; excluded from service notice audience':'Provided account contact; ownership and marketing consent unverified'])].map(row=>row.map(safeCsvCell).join(',')).join('\r\n');
}
export class ContactHubService {
 static async list(input:Record<string,unknown>){const f=contactFilters(input);return contactTransaction(false,c=>ContactHubStore.query(f,new Date(),c));}
 static async profile(input:unknown):Promise<ContactDetail>{
  exact(input,['source','id','page']);const source=input.source;if(!['registered','guest','recipient','directory','payer'].includes(String(source))||typeof input.id!=='string'||input.id.length>128||source==='registered'&&!/^[\w-]+$/.test(input.id)||['guest','recipient','directory'].includes(String(source))&&canonicalGhanaPhone(input.id)!==input.id||source==='payer'&&!/^(guest|user):[\w-]+\|\+233[235]\d{8}$/.test(input.id))throw new FinanceError('Invalid contact identifier.');
  const page=Number(input.page||1);if(!Number.isSafeInteger(page)||page<1||page>100000)throw new FinanceError('Invalid history page.');
  return contactTransaction(false,async c=>{const now=new Date(),f=contactFilters({source:source==='directory'?'all':source}),list=await ContactHubStore.query(f,now,c,false,input.id as string);const row=list.rows[0];if(!row)throw new FinanceError('Contact not found.',404);const history=await ContactHubStore.history(row.source,row.id,page,now,c);
   return {contact:row,orders:history.rows,historyPage:page,historyTotal:history.total,relationships:row.source==='directory'?await ContactHubStore.relationships(row.phone!,now,c):undefined,warning:row.source!=='registered'?'This number has direct-platform provenance only. Recipient activity does not always identify the purchaser. Buyer and recipient identities remain separate.':'Linked history uses account ownership only. Guest recipient matches are never assigned to this account.'};});
 }
 static async preview(input:unknown){exact(input,['filters','purpose']);exact(input.filters,Object.keys(contactFilters({})));const f=contactFilters(input.filters),p=purpose(input.purpose,f);return contactTransaction(false,async c=>{const result=await ContactHubStore.query(f,new Date(),c,true);return {...contactExportPreview(result.rows,result.total,p,f),resellerOrdersExcluded:result.quality?.resellerOrdersExcluded||0};});}
 static async export(actor:string,input:unknown){
  exact(input,['filters','purpose','format','confirmed','expectedRevision']);exact(input.filters,Object.keys(contactFilters({})));const f=contactFilters(input.filters),p=purpose(input.purpose,f);
  if(input.confirmed!==true||!['csv','txt','newline','comma'].includes(String(input.format))||typeof input.expectedRevision!=='string'||!/^\d{13}:[a-f0-9]{64}$/.test(input.expectedRevision))throw new FinanceError('Preview and explicitly confirm the current export.');
  const issued=Number(input.expectedRevision.split(':')[0]);if(issued>Date.now()||Date.now()-issued>900000)throw new FinanceError('Export preview expired. Preview again.',409);
  return contactTransaction(true,async c=>{const result=await ContactHubStore.query(f,new Date(),c,true),preview=contactExportPreview(result.rows,result.total,p,f,issued);if(preview.revision!==input.expectedRevision)throw new FinanceError('Audience changed. Preview again before exporting.',409);
   // No download is returned until the durable audit commits. Search terms and contact data are omitted.
   await AdminAuditStore.record({adminUserId:actor,action:'contact_export_prepared',entityType:'contact_audience',entityId:f.source,metadata:{purpose:p,format:input.format,source:f.source,segment:f.segment,status:f.status,phone:f.phone,permission:f.permission,vip:f.vip,network:f.network,service:f.service,searchApplied:!!f.q,sort:f.sort,intervals:{recentDays:f.recentDays,inactiveDays:f.inactiveDays},ranges:{minPurchases:f.minPurchases,maxPurchases:f.maxPurchases,minSpending:f.minSpending,maxSpending:f.maxSpending,minDays:f.minDays,maxDays:f.maxDays,firstFrom:f.firstFrom,firstTo:f.firstTo,lastFrom:f.lastFrom,lastTo:f.lastTo},matched:preview.total,records:selected(result.rows,p).length,uniqueNumbers:preview.uniqueNumbers,filtersApplied:Object.entries(f).filter(([k,v])=>!['q','page','limit'].includes(k)&&v!==null&&v!==''&&v!=='all').map(([k])=>k)}},c);
   return {content:contactExport(result.rows,p,input.format as any),format:input.format as string,source:f.source};});
 }
}
