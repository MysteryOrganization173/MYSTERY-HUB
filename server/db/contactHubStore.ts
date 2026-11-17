import type {PoolClient} from 'pg';
import {getPool} from './connection.js';
import {AuthStore} from './authStore.js';
import {OrdersStore} from './ordersStore.js';
import {WaitlistStore} from './waitlistStore.js';
import {FinanceError} from './financeStore.js';
import {contactWithdrawalSql} from '../services/contactHubSuppression.js';
import {canonicalGhanaPhone} from '../utils/phone.js';
import {CONTACT_BASIS,CONTACT_EXPORT_LIMIT,deriveContacts,matchesContact,sortContacts,contactSale,directContactOrder} from '../services/contactHubPolicy.js';
import type {ContactFilters,ContactRow,ContactList} from '../../shared/contactHub.js';

export const DIRECT_CONTACT_SQL=`o.store_context IS NULL AND left(o.payment_reference,9)<>'MH_STORE_' AND NOT EXISTS(SELECT 1 FROM finance_operations sf WHERE sf.kind IN ('store_checkout','store_sale') AND sf.payload->>'orderId'=o.id)`;
/** Read-only evidence predicate. Keep in parity with contactSale; no lifecycle updates. */
export const CONTACT_SALE_SQL=`${DIRECT_CONTACT_SQL} AND o.payment_status='success' AND o.payment_provider IN ('paystack','wallet') AND o.currency='GHS'
 AND o.amount>0 AND o.amount<=9007199254740991 AND o.status='delivered'
 AND o.paid_at IS NOT NULL AND isfinite(o.paid_at) AND o.paid_at<=$1::timestamptz
 AND o.delivered_at IS NOT NULL AND isfinite(o.delivered_at) AND o.delivered_at<=$1::timestamptz
 AND COALESCE(o.manual_review,FALSE)=FALSE AND (o.resolution_json IS NULL OR o.resolution_json='null'::jsonb OR o.resolution_json->>'stage'='resolved')
 AND COALESCE(o.resolution_json->>'outcome','') NOT IN ('paystack_refund','wallet_refund','external_compensation')
 AND COALESCE(o.marketplace_status,'') NOT IN ('refund_pending','refunded','cancelled')
 AND NOT EXISTS(SELECT 1 FROM order_test_fixtures t WHERE t.order_id=o.id)
 AND NOT EXISTS(SELECT 1 FROM finance_operations x WHERE x.kind='refund' AND x.state='completed' AND x.payload->>'orderId'=o.id)`;
const contactCte=(withdrawals:string)=>`WITH sms_withdrawals AS MATERIALIZED (${withdrawals}), scope AS MATERIALIZED (SELECT o.*,(${DIRECT_CONTACT_SQL}) AS direct FROM orders o WHERE NOT EXISTS(SELECT 1 FROM order_test_fixtures t WHERE t.order_id=o.id)),
 eligible AS MATERIALIZED (SELECT o.* FROM scope o WHERE ${CONTACT_SALE_SQL}),
 stream AS (
 SELECT 'registered'::text AS source,user_id AS id,amount,delivered_at,network,COALESCE(service_type,'data') AS service,'registered_account'::text AS provenance FROM eligible WHERE user_id IS NOT NULL
 UNION ALL SELECT 'guest',mystery_canonical_phone(recipient_phone),0,delivered_at,network,COALESCE(service_type,'data'),'guest_recipient' FROM eligible WHERE user_id IS NULL
 UNION ALL SELECT 'recipient',mystery_canonical_phone(recipient_phone),0,delivered_at,network,COALESCE(service_type,'data'),CASE WHEN user_id IS NULL THEN 'guest_recipient' ELSE 'registered_order_recipient' END FROM eligible
 UNION ALL SELECT 'payer',e.buyer_key||'|'||mystery_canonical_phone(e.payer_phone),o.amount,o.delivered_at,o.network,COALESCE(o.service_type,'data'),'verified_guest_payer' FROM eligible o JOIN admin_guest_buyer_evidence e ON e.order_id=o.id WHERE o.user_id IS NULL AND mystery_canonical_phone(e.payer_phone) IS NOT NULL
 ), metrics AS (SELECT source,id,COUNT(*)::int AS n,SUM(amount)::numeric AS spending,MIN(delivered_at) AS first_at,MAX(delivered_at) AS last_at,ARRAY_AGG(DISTINCT network ORDER BY network) AS networks,ARRAY_AGG(DISTINCT service ORDER BY service) AS services,ARRAY_AGG(DISTINCT provenance ORDER BY provenance) AS provenance FROM stream WHERE id IS NOT NULL GROUP BY source,id),
 identities AS (
 SELECT u.id,'registered'::text AS source,u.name,u.email,u.phone AS "rawPhone",mystery_canonical_phone(u.phone) AS phone,u.status,u.created_at AS "registeredAt",COALESCE(p.transactional,FALSE)=FALSE AND p.user_id IS NOT NULL AS "supportRestricted",ARRAY['registered_account']::text[] AS provenance,ARRAY[u.id]::text[] AS "accountIds"
 FROM users u LEFT JOIN mysteryhub_notifications.preferences p ON p.user_id=u.id WHERE u.role='customer' AND (NOT EXISTS(SELECT 1 FROM scope o WHERE o.user_id=u.id AND NOT o.direct) OR EXISTS(SELECT 1 FROM scope o WHERE o.user_id=u.id AND o.direct))
 UNION ALL SELECT m.id,m.source,NULL,NULL,m.id,m.id,'not_applicable',NULL,FALSE,
 m.provenance,ARRAY[]::text[] FROM metrics m WHERE m.source IN ('guest','recipient')
 UNION ALL (SELECT DISTINCT ON(e.buyer_key,mystery_canonical_phone(e.payer_phone)) e.buyer_key||'|'||mystery_canonical_phone(e.payer_phone),'payer',e.payer_name,NULL,mystery_canonical_phone(e.payer_phone),mystery_canonical_phone(e.payer_phone),'not_applicable',NULL,FALSE,ARRAY['verified_guest_payer'],ARRAY[]::text[] FROM eligible o JOIN admin_guest_buyer_evidence e ON e.order_id=o.id WHERE o.user_id IS NULL AND mystery_canonical_phone(e.payer_phone) IS NOT NULL ORDER BY e.buyer_key,mystery_canonical_phone(e.payer_phone),e.created_at,e.order_id)
 ), number_sources AS (SELECT phone,ARRAY_AGG(DISTINCT label ORDER BY label) AS provenance FROM identities i CROSS JOIN unnest(i.provenance) label WHERE phone IS NOT NULL AND source<>'guest' GROUP BY phone),
 all_identities AS (SELECT i.*,NULL::text[] AS "searchAliases" FROM identities i UNION ALL SELECT n.phone,'directory',NULL,NULL,n.phone,n.phone,'not_applicable',NULL,FALSE,n.provenance,ARRAY(SELECT i.id FROM identities i WHERE i.source='registered' AND i.phone=n.phone ORDER BY i.id),ARRAY(SELECT v FROM identities x CROSS JOIN LATERAL unnest(ARRAY[x.name,x.email,x."rawPhone"]) v WHERE x.phone=n.phone AND v IS NOT NULL ORDER BY v) FROM number_sources n),
 base AS (SELECT i.*,ARRAY(SELECT DISTINCT w.purpose FROM sms_withdrawals w WHERE w.phone=i.phone OR w.user_id IS NOT NULL AND (i.source='registered' AND i.id=w.user_id OR EXISTS(SELECT 1 FROM identities owner WHERE owner.source='registered' AND owner.id=w.user_id AND owner.phone=i.phone)) ORDER BY w.purpose) AS "smsRestrictions",COALESCE(m.n,0) AS purchases,COALESCE(m.spending,0) AS "spendingMinor",m.first_at AS "firstAt",m.last_at AS "lastAt",COALESCE(m.networks,ARRAY[]::text[]) AS networks,COALESCE(m.services,ARRAY[]::text[]) AS services,
 CASE WHEN EXISTS(SELECT 1 FROM waitlist w WHERE w.channel='sms' AND w.status='unsubscribed' AND (i.source='registered' AND w.user_id=i.id OR i.source='directory' AND EXISTS(SELECT 1 FROM identities owner WHERE owner.source='registered' AND owner.phone=i.phone AND owner.id=w.user_id) OR i.phone IS NOT NULL AND mystery_canonical_phone(COALESCE(NULLIF(w.contact_normalized,''),w.contact))=i.phone)) THEN 'sms_unsubscribed' ELSE 'unknown' END AS "smsPermission"
 FROM all_identities i LEFT JOIN metrics m ON m.source=CASE WHEN i.source='directory' THEN 'recipient' ELSE i.source END AND m.id=i.id),
 phone_counts AS (SELECT phone,COUNT(*)::int AS n FROM identities WHERE source<>'guest' GROUP BY phone),
 threshold AS (SELECT percentile_disc(0.9) WITHIN GROUP(ORDER BY "spendingMinor") AS value FROM base WHERE source='registered' AND purchases>0),
 enriched AS (SELECT b.*,CASE WHEN "lastAt" IS NULL THEN NULL ELSE FLOOR(EXTRACT(EPOCH FROM ($1::timestamptz-"lastAt"))/86400)::int END AS "daysInactive",
 CASE WHEN purchases>0 THEN ROUND("spendingMinor"/purchases) ELSE NULL END AS "averageMinor",
 source='registered' AND status='active' AND phone IS NOT NULL AND purchases>0 AND "smsPermission"='unknown' AND NOT "supportRestricted" AND NOT ("smsRestrictions" && ARRAY['transactional','operational']::text[]) AND NOT EXISTS(SELECT 1 FROM base other WHERE other.phone=b.phone AND (other."supportRestricted" OR other."smsPermission"='sms_unsubscribed')) AS "supportReviewEligible",
 CASE WHEN source<>'registered' THEN ARRAY[]::text[] ELSE ARRAY_REMOVE(ARRAY[CASE WHEN purchases>=2 THEN 'repeat' END,CASE WHEN purchases>=5 THEN 'frequent' END,CASE WHEN purchases>0 AND "spendingMinor">=(SELECT value FROM threshold) THEN 'high_value' END,CASE WHEN purchases>=2 AND "lastAt"<=$1::timestamptz-interval '30 days' THEN 'formerly_active' END],NULL) END AS vip,
 CASE WHEN phone IS NULL THEN 0 ELSE (SELECT n FROM phone_counts x WHERE x.phone=b.phone) END AS "sharedPhoneRecords",
 CASE WHEN source<>'registered' THEN CASE WHEN source='payer' THEN 'Verified direct guest payer' ELSE 'Direct recipient activity' END WHEN purchases=0 THEN 'No completed purchases' WHEN purchases=1 THEN 'One-time buyer' ELSE 'Repeat buyer' END AS segment FROM base b)`;
const sortSql=(sort:ContactFilters['sort'])=>({last:'"lastAt" DESC',inactive:'"lastAt" ASC',first:'"firstAt" ASC',spending:'"spendingMinor" DESC',spending_low:'"spendingMinor" ASC',purchases:'purchases DESC',purchases_low:'purchases ASC',newest:'"registeredAt" DESC',oldest:'"registeredAt" ASC',name:'name COLLATE "C" ASC' }[sort])+' NULLS LAST,id COLLATE "C" ASC';
function conditions(f:ContactFilters,values:unknown[],id?:string){
 const p=(v:unknown)=>{values.push(v);return '$'+values.length;};const where=[`source=${p(f.source==='all'?'directory':f.source)}`];
 if(id!==undefined)where.push(`id=${p(id)}`);
 if(f.q){const q=p(f.q.toLowerCase()),phone=p(canonicalGhanaPhone(f.q));where.push(`(strpos(lower(COALESCE(name,'')||chr(10)||COALESCE(email,'')||chr(10)||COALESCE("rawPhone",'')||chr(10)||COALESCE(phone,'')||chr(10)||COALESCE(array_to_string("searchAliases",chr(10)),'')),${q})>0 OR phone=${phone})`);}
 if(f.status!=='all')where.push(`status=${p(f.status)}`);
 if(f.network!=='all')where.push(`${p(f.network)}=ANY(networks)`);
 if(f.service!=='all')where.push(`${p(f.service)}=ANY(services)`);
 if(f.vip!=='all')where.push(`${p(f.vip)}=ANY(vip)`);
 if(f.phone==='valid')where.push('phone IS NOT NULL');
 if(f.phone==='missing')where.push(`COALESCE(trim("rawPhone"),'')=''`);
 if(f.phone==='invalid')where.push(`phone IS NULL AND COALESCE(trim("rawPhone"),'')<>''`);
 if(f.permission==='unknown')where.push(`"smsPermission"='unknown' AND cardinality("smsRestrictions")=0`);
 if(f.permission==='suppressed')where.push(`("smsPermission"='sms_unsubscribed' OR cardinality("smsRestrictions")>0)`);
 if(f.permission==='service_notice_review')where.push('"supportReviewEligible"');
 const simple:Record<string,string>={no_purchases:'purchases=0',one_time:'purchases=1',repeat:'purchases>=2',frequent:'purchases>=5',high_value:`'high_value'=ANY(vip)`,formerly_active:`'formerly_active'=ANY(vip)`};
 if(simple[f.segment])where.push(simple[f.segment]);
 if(f.segment==='recent')where.push(`"daysInactive"<${p(f.recentDays)}`);
 if(f.segment==='inactive')where.push(`"daysInactive">=${p(f.inactiveDays)}`);
 if(f.segment==='at_risk')where.push(`"daysInactive">=${p(f.recentDays)} AND "daysInactive"<${p(f.inactiveDays)}`);
 for(const [field,min,max] of [['purchases',f.minPurchases,f.maxPurchases],['"spendingMinor"',f.minSpending,f.maxSpending],['"daysInactive"',f.minDays,f.maxDays]] as const){if(min!==null)where.push(`${field}>=${p(min)}`);if(max!==null)where.push(`${field}<=${p(max)}`);}
 for(const [field,from,to] of [['"firstAt"',f.firstFrom,f.firstTo],['"lastAt"',f.lastFrom,f.lastTo]]){if(from)where.push(`${field}>=${p(from)}::date`);if(to)where.push(`${field}<${p(to)}::date+interval '1 day'`);}
 return where.join(' AND ');
}
const safeRow=(raw:any):ContactRow=>{const {actor,...row}=raw;if(row.searchAliases===null)delete row.searchAliases;for(const key of ['firstAt','lastAt','registeredAt'])if(row[key])row[key]=new Date(row[key]).toISOString();for(const key of ['purchases','spendingMinor','averageMinor','daysInactive','sharedPhoneRecords'])if(row[key]!==null){row[key]=Number(row[key]);if(!Number.isSafeInteger(row[key]))throw new FinanceError('Contact metrics exceed supported limits.',503);}return row;};
export async function contactTransaction<T>(write:boolean,work:(client?:PoolClient)=>Promise<T>):Promise<T>{
 const pool=getPool();if(!pool){if(process.env.NODE_ENV==='production')throw new FinanceError('Contact database unavailable.',503);return work();}
 const c=await pool.connect();try{await c.query(`BEGIN ISOLATION LEVEL REPEATABLE READ ${write?'READ WRITE':'READ ONLY'}`);await c.query("SET LOCAL TIME ZONE 'UTC'");await c.query("SET LOCAL statement_timeout='5s'");await c.query("SET LOCAL lock_timeout='1s'");const result=await work(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
async function devStoreOrderIds(){
 const {FinanceStore}=await import('./financeStore.js');const operations=await Promise.all(['store_checkout','store_sale'].map(kind=>FinanceStore.adminOperations(kind,10001)));
 if(operations.some(rows=>rows.length>10000))throw new FinanceError('Development source evidence exceeds safe limits.',503);
 return new Set(operations.flat().map(o=>String(o.payload.orderId)));
}
export class ContactHubStore {
 static async query(f:ContactFilters,now:Date,client?:PoolClient,exportAll=false,id?:string):Promise<ContactList>{
  if(client){const values:unknown[]=[now.toISOString()],where=conditions(f,values,id);values.push(exportAll?CONTACT_EXPORT_LIMIT+1:f.limit,exportAll||id?0:(f.page-1)*f.limit);const limit='$'+(values.length-1),offset='$'+values.length,order=sortSql(f.sort);
   const CTE=contactCte(await contactWithdrawalSql(client));
   const q=`${CTE}, filtered AS (SELECT * FROM enriched WHERE ${where}), paged AS(SELECT * FROM filtered ORDER BY ${order} LIMIT ${limit} OFFSET ${offset})
    SELECT COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY ${order}) FROM paged p),'[]'::jsonb) AS rows,(SELECT COUNT(*)::int FROM filtered) AS total,
    (SELECT jsonb_build_object('registered',COUNT(*),'buyers',COUNT(*) FILTER(WHERE purchases>0),'oneTime',COUNT(*) FILTER(WHERE purchases=1),'repeat',COUNT(*) FILTER(WHERE purchases>=2),'inactive',COUNT(*) FILTER(WHERE "daysInactive">=${Number(f.inactiveDays)}),'usablePhones',COUNT(*) FILTER(WHERE phone IS NOT NULL)) FROM enriched WHERE source='registered') AS summary,(SELECT jsonb_build_object('guestInvalidDeliveries',(SELECT COUNT(*) FROM eligible WHERE mystery_canonical_phone(recipient_phone) IS NULL),'resellerOrdersExcluded',(SELECT COUNT(*) FROM scope WHERE NOT direct))) AS quality`;
   const r=(await client.query(q,values)).rows[0];return {rows:r.rows.map(safeRow),total:r.total,page:f.page,totalPages:Math.max(1,Math.ceil(r.total/f.limit)),summary:r.summary,quality:r.quality,observedAt:now.toISOString(),basis:CONTACT_BASIS};
  }
  const waitlists=[];for(let page=1;page<=100;page++){const result=await WaitlistStore.searchWaitlistAdmin({page,limit:200,channel:'sms',status:'unsubscribed'});waitlists.push(...result.entries);if(page>=result.totalPages)break;if(page===100)throw new FinanceError('Suppression evidence exceeds development limits.',503);}
  const refunds=await (await import('./financeStore.js')).FinanceStore.adminOperations('refund',10001);if(refunds.length>10000)throw new FinanceError('Development refund evidence exceeds safe limits.',503);
  const refunded=new Set(refunds.filter(o=>o.state==='completed').map(o=>o.payload.orderId));
  const storeOrderIds=await devStoreOrderIds();const guestPayers=(await import('../services/customerChampions.js')).CustomerChampions.contactEvidence();
  const all=deriveContacts(AuthStore.adminDevUsers(),OrdersStore.adminDevOrders(),waitlists,now,{storeOrderIds,guestPayers,metricExcludedIds:refunded}),registered=all.filter(r=>r.source==='registered'),filtered=sortContacts(all.filter(r=>matchesContact(r,f)&&(id===undefined||r.id===id)),f.sort);
  return {rows:exportAll?filtered.slice(0,CONTACT_EXPORT_LIMIT+1):filtered.slice(id?0:(f.page-1)*f.limit,id?1:f.page*f.limit),total:filtered.length,page:f.page,totalPages:Math.max(1,Math.ceil(filtered.length/f.limit)),summary:{registered:registered.length,buyers:registered.filter(r=>r.purchases).length,oneTime:registered.filter(r=>r.purchases===1).length,repeat:registered.filter(r=>r.purchases>=2).length,inactive:registered.filter(r=>r.daysInactive!==null&&r.daysInactive>=f.inactiveDays).length,usablePhones:registered.filter(r=>r.phone).length},quality:{guestInvalidDeliveries:OrdersStore.adminDevOrders().filter(o=>directContactOrder(o,storeOrderIds)&&contactSale(o,+now)&&!refunded.has(o.id)&&!canonicalGhanaPhone(o.recipient_phone)).length,resellerOrdersExcluded:OrdersStore.adminDevOrders().filter(o=>!directContactOrder(o,storeOrderIds)).length},observedAt:now.toISOString(),basis:CONTACT_BASIS};
 }
 static async relationships(phone:string,now:Date,client?:PoolClient){
  if(client){const CTE=contactCte(await contactWithdrawalSql(client));const r=await client.query(`${CTE} SELECT id,source,COALESCE(name,source) AS label FROM enriched WHERE source IN ('registered','payer','recipient','guest') AND phone=$2 ORDER BY source,id LIMIT 100`,[now.toISOString(),phone]);return r.rows;}
  const rows:ContactRow[]=[];for(const source of ['registered','recipient','guest','payer'] as const){const result=await this.query({...(await import('../../shared/contactHub.js')).DEFAULT_CONTACT_FILTERS,source,q:phone,limit:100},now);rows.push(...result.rows.filter(r=>r.phone===phone));}return rows.sort((a,b)=>a.source.localeCompare(b.source)||a.id.localeCompare(b.id)).slice(0,100).map(r=>({id:r.id,source:r.source,label:r.name||r.source}));
 }
 static async history(source:ContactRow['source'],id:string,page:number,now:Date,client?:PoolClient){
  if(client){const predicate=source==='registered'?'o.user_id=$2':source==='payer'?"o.user_id IS NULL AND EXISTS(SELECT 1 FROM admin_guest_buyer_evidence e WHERE e.order_id=o.id AND e.buyer_key||'|'||mystery_canonical_phone(e.payer_phone)=$2)":(source==='guest'?'o.user_id IS NULL AND ':'')+'mystery_canonical_phone(o.recipient_phone)=$2';const result=await client.query(`WITH history AS(SELECT o.public_reference AS reference,COALESCE(o.service_type,'data') AS service,o.network,o.amount AS "amountMinor",o.delivered_at AS "deliveredAt",o.archived_at IS NOT NULL AS archived FROM orders o WHERE ${CONTACT_SALE_SQL} AND ${predicate}) SELECT (SELECT COUNT(*)::int FROM history) AS total,COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM(SELECT * FROM history ORDER BY "deliveredAt" DESC,reference LIMIT 20 OFFSET $3)p),'[]'::jsonb) AS rows`,[now.toISOString(),id,(page-1)*20]);return result.rows[0];}
  const refunds=await (await import('./financeStore.js')).FinanceStore.adminOperations('refund',10001);if(refunds.length>10000)throw new FinanceError('Development refund evidence exceeds safe limits.',503);const refunded=new Set(refunds.filter(o=>o.state==='completed').map(o=>o.payload.orderId));
  const storeOrderIds=await devStoreOrderIds();const evidence=(await import('../services/customerChampions.js')).CustomerChampions.contactEvidence();
  const rows=OrdersStore.adminDevOrders().filter(o=>directContactOrder(o,storeOrderIds)&&!refunded.has(o.id)&&contactSale(o,+now)&&(source==='registered'?o.user_id===id:source==='payer'?!o.user_id&&evidence.some(e=>e.order_id===o.id&&e.buyer_key+'|'+canonicalGhanaPhone(e.payer_phone)===id):(source!=='guest'||!o.user_id)&&canonicalGhanaPhone(o.recipient_phone)===id)).sort((a,b)=>String(b.delivered_at).localeCompare(String(a.delivered_at))||a.public_reference.localeCompare(b.public_reference));return {total:rows.length,rows:rows.slice((page-1)*20,page*20).map(o=>({reference:o.public_reference,service:o.service_type||'data',network:o.network,amountMinor:o.amount,deliveredAt:o.delivered_at!,archived:!!o.archived_at}))};
 }
}
