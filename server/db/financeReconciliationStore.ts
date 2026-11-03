import {getPool} from './connection.js';
import {FinanceError} from './financeStore.js';
import {RECONCILIATION_GROUPS,RECONCILIATION_REASONS,type ReconciliationGroup,type ReconciliationReport,type ReconciliationRow} from '../../shared/financeReconciliation.js';

export function reconciliationFilters(input:Record<string,unknown>){
 if(Object.keys(input).some(k=>!['filter','reference','offset','limit'].includes(k))||Object.values(input).some(v=>typeof v!=='string'&&typeof v!=='number'))throw new FinanceError('Invalid reconciliation filters.');
 const filter=String(input.filter||'all'),reference=String(input.reference||'').trim(),offset=Number(input.offset??0),limit=Number(input.limit??25);
 if(!['all','attention',...Object.keys(RECONCILIATION_GROUPS)].includes(filter)||reference.length>80||reference&&!/^(?:MH[-_][A-Za-z0-9_-]+|(?:ord|fin)_[A-Za-z0-9_-]+)$/.test(reference)||!Number.isSafeInteger(offset)||offset<0||offset>100000||!Number.isSafeInteger(limit)||limit<1||limit>50)throw new FinanceError('Use a valid exact order reference or finance ID and bounded page.');
 return {filter,reference:reference||null,offset,limit};
}
const validTime=(value:string)=>`(${value} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' AND pg_input_is_valid(${value},'timestamptz'))`;
const snapshotMoney=(path:string)=>`(CASE WHEN jsonb_typeof(${path})='number' THEN CASE WHEN (${path})::text::numeric BETWEEN 0 AND 100000000 AND trunc((${path})::text::numeric)=(${path})::text::numeric THEN (${path})::text::numeric END END)`;
const storeMoney=(key:string)=>snapshotMoney(`o.store_context->'${key}'`);
const directMoney=(key:string)=>snapshotMoney(`o.commercial_context->'${key}'`);
const groupCase=`CASE code ${Object.entries(RECONCILIATION_REASONS).map(([code,d])=>`WHEN '${code}' THEN '${d.group}'`).join(' ')} ELSE 'evidence_unavailable' END`;

/** Pure SELECT, exported for native/EXPLAIN verification. No financial service is called. */
export const FINANCE_RECONCILIATION_SQL=`
WITH operation_evidence AS MATERIALIZED (
 SELECT f.id,f.user_id,f.kind,f.state,f.amount_minor,f.created_at,f.updated_at,
   f.payload->>'orderId' AS order_id,f.payload->>'reference' AS reference,
   f.payload->>'productId' AS product_id,f.payload->>'siteId' AS site_id,f.payload->>'customerId' AS customer_id,
   f.payload->'snapshot' AS snapshot,f.payload->'checkout'->>'reference' AS checkout_reference,
   f.payload->>'currency' AS currency,f.payload->>'source' AS source,f.payload->>'topupId' AS topup_id,
   f.payload->>'reviewId' AS review_id,f.payload->>'rewardId' AS reward_id,
   ${validTime("f.payload->>'verifiedAt'")} AS verified_time,
   ${validTime("f.payload->>'creditedAt'")} AS credited_time,
   ${validTime("f.payload->>'lastVerifiedAt'")} AS negative_verification,
   ${validTime("f.payload->>'resolvedAt'")} AS resolved_time,
   NULLIF(f.payload->>'resolvedBy','') IS NOT NULL AS resolved_actor,
   NULLIF(f.payload->>'availableAt','') IS NOT NULL AS was_available,
   f.payload->>'simulated'='true' AS simulated,
   COALESCE(f.payload->'checkout'->>'isSimulated',f.payload->>'isSimulated')='true' AS simulated_checkout,
   count(l.id)::int AS ledger_count,
   count(l.id) FILTER(WHERE l.bucket='wallet' AND l.delta_minor=-f.amount_minor AND l.user_id=f.user_id)::int AS wallet_debits,
   count(l.id) FILTER(WHERE l.bucket='wallet' AND l.delta_minor=f.amount_minor AND l.user_id=f.user_id)::int AS wallet_credits,
   count(l.id) FILTER(WHERE l.bucket='store' AND l.delta_minor=f.amount_minor AND l.user_id=f.user_id)::int AS store_credits,
   count(l.id) FILTER(WHERE l.bucket='store' AND l.delta_minor=-f.amount_minor AND l.user_id=f.user_id)::int AS store_debits
 FROM finance_operations f LEFT JOIN finance_ledger l ON l.operation_id=f.id
 WHERE f.kind IN ('direct_checkout','store_checkout','purchase','store_sale','refund','topup','review','reversal')
 GROUP BY f.id
), order_evidence AS (
 SELECT o.id,o.public_reference,o.service_type,o.network,o.status,o.marketplace_status,o.payment_status,o.payment_provider,o.amount,o.currency,
   o.created_at,o.updated_at,o.paid_at,o.delivered_at,o.archived_at,o.manual_review,o.failure_reason,
   o.supplier_order_id IS NOT NULL AS supplier_accepted,o.submitted_at IS NOT NULL AS submission_recorded,
   o.store_context IS NOT NULL AS managed_store,
   o.resolution_json->>'stage' AS resolution_stage,o.resolution_json->>'outcome' AS resolution_outcome,
   o.resolution_json->>'updatedAt' AS resolution_at,
   ${validTime("o.resolution_json->>'verifiedAt'")} AS resolution_verified,
   o.resolution_json->>'amountMinor'=o.amount::text AND o.resolution_json->>'paymentReference'=o.payment_reference AS refund_identity,
   o.resolution_json->>'providerStatus' AS refund_status,
   o.resolution_json->>'refundId' ~ '^[1-9][0-9]{0,18}$' AS refund_id,
   (o.resolution_json->'manual'->>'outcome'=o.resolution_json->>'outcome'
    AND NULLIF(o.resolution_json->'manual'->>'actor','') IS NOT NULL
    AND NULLIF(o.resolution_json->'manual'->>'reason','') IS NOT NULL
    AND NULLIF(o.resolution_json->'manual'->>'evidence','') IS NOT NULL
    AND ${validTime("o.resolution_json->'manual'->>'at'")}
    AND (o.resolution_json->>'outcome'<>'external_compensation' OR
      NULLIF(o.resolution_json->'manual'->>'method','') IS NOT NULL AND NULLIF(o.resolution_json->'manual'->>'reference','') IS NOT NULL)) AS manual_complete,
   EXISTS(SELECT 1 FROM order_resolution_events h WHERE h.order_id=o.id AND h.result=o.resolution_json AND h.actor_id=o.resolution_json->>'lastActor') AS resolution_history,
   EXISTS(SELECT 1 FROM order_test_fixtures t WHERE t.order_id=o.id) AS synthetic,
   NULLIF(o.payment_reference,'') IS NOT NULL AS payment_reference_present,
   count(f.id) FILTER(WHERE f.kind='purchase')::int AS purchases,
   count(f.id) FILTER(WHERE f.kind='purchase' AND f.state='completed' AND f.wallet_debits=1 AND f.ledger_count=1)::int AS purchase_debits,
   count(f.id) FILTER(WHERE f.kind='refund' AND f.state='completed' AND f.wallet_credits=1 AND f.ledger_count=1)::int AS refund_credits,
   count(f.id) FILTER(WHERE f.kind='refund')::int AS refunds,
   count(f.id) FILTER(WHERE f.kind='store_checkout')::int AS store_checkouts,
   count(f.id) FILTER(WHERE f.kind='store_sale')::int AS store_sales,
   bool_or(f.kind='store_sale' AND f.state='available') AS earning_available,
   bool_or(f.kind='store_sale' AND f.state='manual_review') AS earning_review,
   bool_or(f.kind='store_sale' AND f.state NOT IN ('pending','available','manual_review','reversed')) AS earning_state_unknown,
   bool_or(f.kind='store_sale' AND f.state='reversed' AND (
    ((f.was_available OR f.ledger_count>0) AND (f.store_credits<>CASE WHEN f.amount_minor>0 THEN 1 ELSE 0 END OR f.ledger_count<>CASE WHEN f.amount_minor>0 THEN 1 ELSE 0 END
     OR (SELECT count(*) FROM operation_evidence r WHERE r.order_id=o.id AND r.kind='reversal' AND r.source='store')<>1
     OR (SELECT count(*) FROM operation_evidence r WHERE r.order_id=o.id AND r.kind='reversal' AND r.source='store' AND r.user_id=f.user_id AND r.state='completed' AND r.amount_minor=f.amount_minor AND r.store_debits=CASE WHEN f.amount_minor>0 THEN 1 ELSE 0 END AND r.ledger_count=CASE WHEN f.amount_minor>0 THEN 1 ELSE 0 END)<>1))
    OR (NOT COALESCE(f.was_available,FALSE) AND f.ledger_count=0) AND EXISTS(SELECT 1 FROM operation_evidence r WHERE r.order_id=o.id AND r.kind='reversal' AND r.source='store')
   )) AS earning_reversal_missing,
   bool_or(f.kind='store_sale' AND f.state='available' AND
    (o.status<>'delivered' OR o.payment_status<>'success' OR COALESCE(o.manual_review,FALSE) OR o.resolution_json IS NOT NULL
     OR f.amount_minor>0 AND (f.store_credits<>1 OR f.ledger_count<>1) OR f.amount_minor=0 AND f.ledger_count<>0)) AS earning_unbacked,
   bool_or(
    (f.kind IN ('direct_checkout','store_checkout','purchase','refund') AND f.amount_minor<>o.amount)
    OR (f.kind IN ('direct_checkout','purchase','refund') AND f.user_id IS DISTINCT FROM o.user_id)
    OR (f.kind='direct_checkout' AND (o.store_context IS NOT NULL OR f.product_id IS DISTINCT FROM o.product_id OR f.checkout_reference IS NOT NULL AND f.checkout_reference<>o.payment_reference))
    OR (f.kind IN ('direct_checkout','store_checkout') AND f.ledger_count<>0)
    OR (f.kind IN ('direct_checkout','store_checkout') AND COALESCE(f.simulated_checkout,FALSE))
    OR (f.kind='purchase' AND (o.payment_provider<>'wallet' OR f.product_id IS DISTINCT FROM o.product_id OR o.payment_status<>'success' OR f.state<>'completed' OR f.wallet_debits<>1 OR f.ledger_count<>1))
    OR (f.kind='refund' AND (o.payment_provider<>'wallet' OR f.state<>'completed' OR f.wallet_credits<>1 OR f.ledger_count<>1))
    OR (f.kind='refund' AND f.wallet_credits>0 AND o.status<>'refunded')
    OR (f.kind='store_checkout' AND (f.user_id IS DISTINCT FROM o.store_context->>'ownerId' OR f.site_id IS DISTINCT FROM o.store_context->>'siteId'
     OR f.product_id IS DISTINCT FROM o.product_id OR f.customer_id IS DISTINCT FROM o.user_id OR f.reference IS DISTINCT FROM o.payment_reference))
    OR (f.kind='store_sale' AND (f.user_id IS DISTINCT FROM o.store_context->>'ownerId' OR f.site_id IS DISTINCT FROM o.store_context->>'siteId'
     OR to_jsonb(f.amount_minor) IS DISTINCT FROM o.store_context->'earningMinor' OR f.snapshot IS DISTINCT FROM o.store_context))
    OR (f.kind='store_sale' AND f.state='pending' AND f.ledger_count<>0)
    OR (f.kind='store_sale' AND f.state IN ('pending','available') AND EXISTS(SELECT 1 FROM operation_evidence r WHERE r.order_id=o.id AND r.kind='reversal' AND r.source='store'))
   ) AS finance_conflict,
   (o.store_context IS NOT NULL AND (o.store_context->>'currency' IS DISTINCT FROM o.currency
    OR o.store_context->'retailMinor' IS DISTINCT FROM to_jsonb(o.amount) OR o.store_context->>'productId' IS DISTINCT FROM o.product_id
    OR NULLIF(o.store_context->>'ownerId','') IS NULL OR NULLIF(o.store_context->>'siteId','') IS NULL
    OR ${storeMoney('wholesaleMinor')} IS NULL OR ${storeMoney('reserveMinor')} IS NULL OR ${storeMoney('earningMinor')} IS NULL
    OR ${storeMoney('wholesaleMinor')}+${storeMoney('reserveMinor')}+${storeMoney('earningMinor')}<>o.amount))
   OR (o.commercial_context IS NOT NULL AND (o.commercial_context->'paidMinor' IS DISTINCT FROM to_jsonb(o.amount)
    OR ${directMoney('regularMinor')} IS NULL OR ${directMoney('discountMinor')} IS NULL
    OR ${directMoney('regularMinor')}-${directMoney('discountMinor')}<>o.amount)) AS snapshot_conflict
 FROM orders o LEFT JOIN operation_evidence f ON f.order_id=o.id AND f.kind IN ('direct_checkout','store_checkout','purchase','store_sale','refund','reversal')
 WHERE ($1::text IS NULL OR o.public_reference=$1 OR o.id=$1 OR EXISTS(
   SELECT 1 FROM operation_evidence linked WHERE linked.id=$1 AND linked.order_id=o.id AND linked.kind NOT IN ('topup','review')))
   AND ($1::text IS NOT NULL OR NOT EXISTS(SELECT 1 FROM order_test_fixtures t WHERE t.order_id=o.id))
 GROUP BY o.id
), order_codes AS (
 SELECT *,CASE
  WHEN synthetic THEN 'test_record'
  WHEN COALESCE(finance_conflict,FALSE) OR snapshot_conflict OR managed_store AND store_checkouts<>1 OR refunds>1 OR store_sales>1 THEN 'finance_conflict'
  WHEN COALESCE(earning_unbacked,FALSE) THEN 'earning_unbacked'
  WHEN COALESCE(earning_review,FALSE) OR COALESCE(earning_reversal_missing,FALSE) THEN 'reversal_open'
  WHEN COALESCE(earning_state_unknown,FALSE) THEN 'unknown'
  WHEN payment_provider IN ('complimentary','admin_external') THEN 'non_payment'
  WHEN payment_provider NOT IN ('paystack','wallet') THEN 'unknown'
  WHEN currency<>'GHS' OR amount<=0 OR amount>100000000 OR NOT payment_reference_present THEN 'payment_incomplete'
  WHEN payment_status<>'success' AND (paid_at IS NOT NULL OR delivered_at IS NOT NULL OR supplier_accepted OR submission_recorded OR status IN ('paid','queued','submitted','processing','delivered','refund_pending','refunded')) THEN 'payment_conflict'
  WHEN payment_status='success' AND (paid_at IS NULL OR NOT isfinite(paid_at)) THEN 'payment_incomplete'
  WHEN payment_provider='wallet' AND payment_status='success' AND (purchases<>1 OR purchase_debits<>1) THEN 'finance_conflict'
  WHEN resolution_stage='resolved' THEN CASE
    WHEN payment_status<>'success' OR COALESCE(manual_review,FALSE) OR NOT resolution_history THEN 'resolution_incomplete'
    WHEN resolution_outcome IN ('manual_fulfillment','external_compensation') AND manual_complete
     AND status IN ('failed','cancelled','expired','refund_pending') AND delivered_at IS NULL THEN resolution_outcome
    WHEN resolution_outcome='paystack_refund' AND payment_provider='paystack' AND status='refunded'
     AND refund_identity AND resolution_verified AND refund_id AND refund_status='processed' THEN 'paystack_refund'
    WHEN resolution_outcome='wallet_refund' AND payment_provider='wallet' AND status='refunded'
     AND refund_identity AND resolution_verified AND refund_credits=1 THEN 'wallet_refund'
    ELSE 'resolution_incomplete' END
  WHEN failure_reason='supplier_submission_uncertain' THEN 'uncertain_submission'
  WHEN COALESCE(manual_review,FALSE) THEN 'review_flag'
  WHEN payment_status='success' AND payment_provider='wallet' AND status='refunded' AND refund_credits=1 THEN 'wallet_refund_unreconciled'
  WHEN payment_status='success' AND resolution_stage='refund_pending' AND resolution_outcome='paystack_refund'
   AND payment_provider='paystack' AND refund_identity AND refund_id AND resolution_history AND refund_status IN ('pending','processing') THEN 'refund_progress'
  WHEN payment_status='success' AND marketplace_status IN ('refund_pending','cancelled','refunded') THEN 'remedy_open'
  WHEN payment_status='success' AND status IN ('failed','cancelled','expired','refund_pending','refunded') THEN 'remedy_open'
  WHEN payment_status='success' AND resolution_stage IS NOT NULL THEN 'resolution_incomplete'
  WHEN payment_status='success' AND status='delivered' AND (delivered_at IS NULL OR NOT isfinite(delivered_at)) THEN 'delivery_incomplete'
  WHEN payment_status='success' AND status='delivered' AND managed_store AND (store_sales<>1 OR NOT COALESCE(earning_available,FALSE)) THEN 'earnings_pending'
  WHEN payment_status='success' AND status='delivered' THEN 'completed'
  WHEN payment_status='success' AND status IN ('paid','queued','submitted','processing') AND network='mtn' AND COALESCE(service_type,'data')='data' AND paid_at<=NOW()-interval '48 hours' THEN 'mtn_review_due'
  WHEN payment_status='success' AND status IN ('paid','queued','submitted','processing') THEN 'progressing'
  WHEN payment_status='success' THEN 'payment_conflict'
  WHEN status IN ('failed','cancelled','expired') AND payment_status IN ('pending','failed','cancelled','expired') THEN 'unpaid_closed'
  WHEN status='pending_payment' AND payment_status IN ('pending','failed','cancelled','expired') THEN 'awaiting'
  ELSE 'unknown' END AS code
 FROM order_evidence
), operation_codes AS (
 SELECT f.*,CASE
  WHEN f.kind='reversal' AND f.topup_id IS NOT NULL THEN 'missing_funding'
  WHEN f.kind NOT IN ('topup','review') THEN 'missing_order'
  WHEN f.kind='review' AND f.state IN ('manual_review','reversal_review') THEN 'reversal_open'
  WHEN f.kind='review' AND f.state='resolved' AND f.resolved_time AND f.resolved_actor AND NULLIF(f.reward_id,'') IS NOT NULL THEN 'resolved_review'
  WHEN f.kind='review' THEN 'unknown'
  WHEN f.state NOT IN ('credited','reversed','reversal_review') AND (COALESCE(f.verified_time,FALSE) OR COALESCE(f.credited_time,FALSE)) THEN 'finance_conflict'
  WHEN f.amount_minor<=0 OR f.currency IS DISTINCT FROM 'GHS' OR NULLIF(f.reference,'') IS NULL OR COALESCE(f.simulated,FALSE) THEN 'finance_conflict'
  WHEN f.state<>'reversed' AND EXISTS(SELECT 1 FROM operation_evidence r WHERE r.kind='reversal' AND r.topup_id=f.id) THEN 'finance_conflict'
  WHEN f.state='reversal_review' THEN 'reversal_open'
  WHEN f.state IN ('credited','reversed') AND (f.wallet_credits<>1 OR f.ledger_count<>1) THEN 'finance_conflict'
  WHEN f.state IN ('credited','reversed') AND NOT COALESCE(f.verified_time AND f.credited_time,FALSE) THEN 'funding_uncertain'
  WHEN f.state='credited' THEN 'funding_credit'
  WHEN f.state='reversed' AND (SELECT count(*) FROM operation_evidence r WHERE r.kind='reversal' AND r.topup_id=f.id)=1
   AND (SELECT count(*) FROM operation_evidence r WHERE r.kind='reversal' AND r.topup_id=f.id AND r.user_id=f.user_id AND r.amount_minor=f.amount_minor AND r.state='completed' AND r.wallet_debits=1 AND r.ledger_count=1)=1 THEN 'funding_reversed'
  WHEN f.state='reversed' THEN 'finance_conflict'
  WHEN f.ledger_count<>0 THEN 'finance_conflict'
  WHEN f.state='failed' AND f.negative_verification THEN 'funding_failed'
  WHEN f.state IN ('initialization_uncertain','failed') THEN 'funding_uncertain'
  WHEN f.state IN ('initializing','pending') THEN 'awaiting'
  ELSE 'unknown' END AS code
 FROM operation_evidence f
 WHERE ($1::text IS NULL OR f.id=$1) AND (f.kind IN ('topup','review') OR
   f.kind IN ('direct_checkout','store_checkout','purchase','store_sale','refund') AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.id=f.order_id)
   OR f.kind='reversal' AND f.source='store' AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.id=f.order_id)
   OR f.kind='reversal' AND f.topup_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM operation_evidence t WHERE t.id=f.topup_id AND t.kind='topup'))
), records AS (
 SELECT 'order:'||id AS key,public_reference AS "orderReference",NULL::text AS "operationId",NULL::text AS "financeUserId",
  COALESCE(service_type,'data') AS service,'order'::text AS "recordType",amount::float8 AS "amountMinor",currency,
  payment_status AS "paymentStatus",status AS "fulfillmentStatus",marketplace_status AS "marketplaceStatus",NULL::text AS "operationState",
  created_at AS "createdAt",updated_at AS "updatedAt",paid_at AS "paidAt",delivered_at AS "deliveredAt",
  CASE WHEN ${validTime('resolution_at')} THEN resolution_at ELSE NULL END AS "resolutionAt",archived_at IS NOT NULL AS archived,code
 FROM order_codes
 UNION ALL
 SELECT 'operation:'||id,NULL,id,user_id,CASE WHEN kind='topup' THEN 'wallet_funding' WHEN kind='review' THEN 'financial_review' ELSE kind END,
  CASE WHEN kind='topup' THEN 'topup' WHEN kind='review' THEN 'review' ELSE 'orphan' END,amount_minor::float8,
  CASE WHEN kind='topup' THEN currency ELSE NULL END,NULL,NULL,NULL,state,created_at,updated_at,NULL,NULL,NULL,FALSE,code FROM operation_codes
), classified AS (SELECT *,${groupCase} AS "group" FROM records), filtered AS (
 SELECT * FROM classified WHERE $2='all' OR "group"=$2 OR $2='attention' AND "group" IN ('needs_review','evidence_unavailable')
)
SELECT NOW() AS "generatedAt",(SELECT count(*)::int FROM classified) AS total,(SELECT count(*)::int FROM filtered) AS "filteredTotal",
 (SELECT COALESCE(jsonb_object_agg(g,n),'{}') FROM (SELECT "group" AS g,count(*)::int AS n FROM classified GROUP BY "group") c) AS counts,
 (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p."createdAt" DESC,p.key),'[]') FROM
  (SELECT * FROM filtered ORDER BY "createdAt" DESC,key LIMIT $3 OFFSET $4) p) AS rows`;

export class FinanceReconciliationStore {
 static async report(input:Record<string,unknown>):Promise<ReconciliationReport>{
  const f=reconciliationFilters(input),pool=getPool();if(!pool)throw new FinanceError('Reconciliation evidence is unavailable. Existing records were not changed.',503);
  const client=await pool.connect();
  try{
   await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   await client.query("SET LOCAL statement_timeout='2500ms'");await client.query("SET LOCAL lock_timeout='500ms'");
   const data=(await client.query(FINANCE_RECONCILIATION_SQL,[f.reference,f.filter,f.limit,f.offset])).rows[0];
   await client.query('COMMIT');
   const counts=Object.fromEntries(Object.keys(RECONCILIATION_GROUPS).map(g=>[g,Number(data.counts[g]||0)])) as Record<ReconciliationGroup,number>;
   const rows=data.rows.map((row:any):ReconciliationRow=>{const d=RECONCILIATION_REASONS[row.code]||RECONCILIATION_REASONS.unknown;return {...row,group:d.group,label:d.label,explanation:d.explanation,requiresInvestigation:['needs_review','evidence_unavailable'].includes(d.group)};});
   return {generatedAt:new Date(data.generatedAt).toISOString(),scope:f.reference?'Exact reference lookup; includes authorized archived/test history.':'All recorded orders (including archived), Wallet funding, reward reviews and missing-order finance links. Registered synthetic orders excluded.',counts,total:Number(data.total),filteredTotal:Number(data.filteredTotal),rows,limit:f.limit,offset:f.offset};
  }catch{await client.query('ROLLBACK').catch(()=>{});throw new FinanceError('Reconciliation evidence is temporarily unavailable. No records were changed. Retry the report; do not repeat a payment.',503);}
  finally{client.release();}
 }
}
