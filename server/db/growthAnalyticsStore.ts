import {randomUUID} from 'node:crypto';
import {getPool} from './connection.js';
import {GrowthError,validateGrowth} from '../services/growthValidation.js';
import {growthPeriod,type GrowthReport} from '../../shared/growthAnalytics.js';
const cache=new Map<number,{until:number;value:GrowthReport}>(),inflight=new Map<number,Promise<GrowthReport>>();
const day="to_char(created_at AT TIME ZONE 'Africa/Accra','YYYY-MM-DD')";
const paid="payment_status='success' AND paid_at IS NOT NULL AND currency='GHS' AND payment_provider IN ('paystack','wallet') AND NOT EXISTS(SELECT 1 FROM order_test_fixtures f WHERE f.order_id=o.id)";
const refundEvidence="resolution_json->>'stage'='resolved' AND resolution_json->>'outcome' IN ('paystack_refund','wallet_refund') AND resolution_json->>'amountMinor'=amount::text AND resolution_json->>'paymentReference'=payment_reference AND pg_input_is_valid(resolution_json->>'verifiedAt','timestamptz')";
export const GROWTH_SQL={
 traffic:`WITH e AS (SELECT * FROM analytics_events WHERE event_name='growth_page_view' AND created_at >= $1 AND created_at < $2), sessions AS (SELECT visitor_id,session_id,min(created_at) first_at FROM e GROUP BY 1,2)
 SELECT (SELECT count(*)::int FROM e) views,(SELECT count(*)::int FROM sessions) sessions,(SELECT count(DISTINCT visitor_id)::int FROM e) visitors,
 (SELECT count(DISTINCT s.visitor_id)::int FROM sessions s WHERE EXISTS(SELECT 1 FROM analytics_events old WHERE old.event_name='growth_page_view' AND old.visitor_id=s.visitor_id AND old.session_id<>s.session_id AND old.created_at<s.first_at)) "returningVisitors",
 (SELECT count(DISTINCT user_id)::int FROM analytics_events WHERE event_name='growth_identity' AND created_at >= $1 AND created_at < $2) "authenticatedUsers",
 (SELECT min(created_at) FROM analytics_events WHERE event_name='growth_page_view') "firstObserved",
 (SELECT coalesce(jsonb_agg(x ORDER BY x."day"),'[]') FROM (SELECT ${day} AS "day",count(*)::int views,count(DISTINCT (visitor_id,session_id))::int sessions FROM e GROUP BY 1) x) trend,
 (SELECT coalesce(jsonb_agg(x ORDER BY x.views DESC),'[]') FROM (SELECT metadata_json->>'page' page,count(*)::int views,count(DISTINCT visitor_id)::int visitors FROM e GROUP BY 1) x) pages,
 (SELECT coalesce(jsonb_agg(x ORDER BY x.count DESC),'[]') FROM (SELECT event_name event,metadata_json->>'page' page,count(*)::int count FROM analytics_events WHERE event_name IN ('growth_checkout_opened','growth_marketplace_product','growth_marketplace_inquiry') AND created_at >= $1 AND created_at < $2 GROUP BY 1,2) x) engagement`,
 adoption:`WITH e AS (SELECT * FROM analytics_events WHERE event_name LIKE 'growth_%' AND created_at >= $1 AND created_at < $2)
 SELECT count(*) FILTER(WHERE event_name='growth_page_view' AND metadata_json->>'page'='app')::int "appVisits",
 count(*) FILTER(WHERE event_name='growth_install_action')::int actions,count(*) FILTER(WHERE event_name='growth_install_prompt')::int prompts,
 count(*) FILTER(WHERE event_name='growth_install_accepted')::int accepted,count(*) FILTER(WHERE event_name='growth_install_dismissed')::int dismissed,count(*) FILTER(WHERE event_name='growth_installed')::int installed,
 count(DISTINCT (visitor_id,session_id)) FILTER(WHERE event_name='growth_standalone_launch')::int "standaloneSessions",
 count(DISTINCT visitor_id) FILTER(WHERE event_name='growth_standalone_launch' AND EXISTS(SELECT 1 FROM analytics_events old WHERE old.event_name='growth_standalone_launch' AND old.visitor_id=e.visitor_id AND old.session_id<>e.session_id AND old.created_at<e.created_at))::int "returningAppBrowsers",
 count(DISTINCT (visitor_id,session_id)) FILTER(WHERE event_name='growth_page_view' AND metadata_json->>'promptSupport'='yes')::int "promptCapableSessions" FROM e`,
 campaigns:`WITH e AS (SELECT * FROM analytics_events WHERE event_name IN ('growth_page_view','growth_identity') AND created_at >= $1 AND created_at < $2),
 touch AS (SELECT DISTINCT ON(user_id) user_id,created_at,coalesce(metadata_json->>'source','direct') source,coalesce(metadata_json->>'medium','none') medium,coalesce(metadata_json->>'campaign','none') campaign FROM e WHERE user_id IS NOT NULL ORDER BY user_id,created_at,id),
 converted AS (SELECT t.*,u.created_at >= $1 AND u.created_at < $2 AND u.created_at BETWEEN t.created_at-interval '10 minutes' AND t.created_at AS registered,
 (SELECT count(*)::int FROM orders o WHERE o.user_id=t.user_id AND ${paid} AND o.paid_at>=t.created_at AND o.paid_at<$2) paid_orders,
 (SELECT coalesce(sum(amount),0) FROM orders o WHERE o.user_id=t.user_id AND ${paid} AND o.paid_at>=t.created_at AND o.paid_at<$2) sales FROM touch t JOIN users u ON u.id=t.user_id WHERE u.role='customer'),
 groups AS (SELECT coalesce(metadata_json->>'source','direct') source,coalesce(metadata_json->>'medium','none') medium,coalesce(metadata_json->>'campaign','none') campaign,count(DISTINCT (visitor_id,session_id))::int sessions,count(DISTINCT visitor_id)::int visitors FROM e WHERE event_name='growth_page_view' GROUP BY 1,2,3),
 outcomes AS (SELECT source,medium,campaign,count(*)::int linked,count(*) FILTER(WHERE registered)::int registrations,count(*) FILTER(WHERE paid_orders>0)::int buyers,coalesce(sum(paid_orders),0) paid_orders,coalesce(sum(sales),0) sales FROM converted GROUP BY 1,2,3)
 SELECT g.*,coalesce(o.linked,0)::int "linkedAccounts",coalesce(o.registrations,0)::int registrations,coalesce(o.buyers,0)::int buyers,coalesce(o.paid_orders,0)::float8 "paidOrders",coalesce(o.sales,0)::float8 "salesMinor",CASE WHEN o.linked>0 THEN round(o.buyers*100.0/o.linked,1)::float8 ELSE NULL END conversion FROM groups g LEFT JOIN outcomes o USING(source,medium,campaign) ORDER BY sessions DESC,g.source,g.campaign LIMIT 20`,
 business:`WITH clean AS (SELECT o.*,(${paid}) verified FROM orders o WHERE NOT EXISTS(SELECT 1 FROM order_test_fixtures f WHERE f.order_id=o.id)),
 sales AS (SELECT * FROM clean WHERE verified AND paid_at >= $1 AND paid_at < $2),
 made AS (SELECT * FROM clean WHERE created_at >= $1 AND created_at < $2),
 refunds AS (SELECT * FROM clean WHERE verified AND ${refundEvidence} AND CASE WHEN pg_input_is_valid(resolution_json->>'verifiedAt','timestamptz') THEN (resolution_json->>'verifiedAt')::timestamptz END >= $1 AND CASE WHEN pg_input_is_valid(resolution_json->>'verifiedAt','timestamptz') THEN (resolution_json->>'verifiedAt')::timestamptz END < $2)
 SELECT (SELECT count(*)::int FROM users WHERE role='customer' AND created_at >= $1 AND created_at < $2) registrations,
 (SELECT count(*)::int FROM made) "ordersCreated",(SELECT count(*)::int FROM made WHERE payment_status='pending') "pendingOrders",(SELECT count(*)::int FROM made WHERE verified AND status IN ('paid','queued','submitted','processing')) "awaitingFulfilment",(SELECT count(*)::int FROM made WHERE status='failed' OR payment_status='failed') "failedOrders",
 (SELECT count(*)::int FROM sales) "paidOrders",(SELECT count(DISTINCT user_id)::int FROM sales) "paidBuyers",(SELECT coalesce(sum(amount),0)::float8 FROM sales) "grossPaidMinor",
 (SELECT count(*)::int FROM clean WHERE verified AND status='delivered' AND delivered_at >= $1 AND delivered_at < $2) "deliveredOrders",
 (SELECT coalesce(sum(amount),0)::float8 FROM clean WHERE verified AND status='delivered' AND delivered_at >= $1 AND delivered_at < $2) "deliveredSalesMinor",
 (SELECT count(*)::int FROM refunds) "verifiedRefunds",(SELECT coalesce(sum(amount),0)::float8 FROM refunds) "verifiedRefundMinor",
 (SELECT count(*)::int FROM made WHERE status='refund_pending' OR resolution_json->>'stage'='refund_pending') "refundPending",
 (SELECT count(*)::int FROM made WHERE status='refunded' AND NOT coalesce(${refundEvidence},false)) "unverifiedRefundFlags",
 (SELECT CASE WHEN count(*)>0 AND count(supplier_cost_minor)=count(*) THEN sum(supplier_cost_minor)::float8 ELSE NULL END FROM sales) "recordedSupplierCostMinor",
 (SELECT count(supplier_cost_minor)::int FROM sales) "costCoverage",(SELECT count(*)::int FROM made WHERE payment_provider='admin_external') "operatorRecorded",(SELECT count(*)::int FROM made WHERE payment_provider='complimentary') complimentary,
 (SELECT coalesce(jsonb_agg(x ORDER BY x."paidOrders" DESC),'[]') FROM (SELECT coalesce(service_type,'data') service,count(*)::int "paidOrders",sum(amount)::float8 "salesMinor" FROM sales GROUP BY 1) x) services`,
 builder:`SELECT (SELECT count(*)::int FROM analytics_events WHERE event_name='website_build_started' AND created_at >= $1 AND created_at < $2) starts,
 (SELECT count(*)::int FROM analytics_events WHERE event_name='website_template_previewed' AND created_at >= $1 AND created_at < $2) previews,
 (SELECT count(*)::int FROM website_sites WHERE created_at >= $1 AND created_at < $2) created,
 (SELECT count(*)::int FROM website_sites WHERE status='published' AND created_at >= $1 AND created_at < $2) "publishedNow",
 (SELECT count(*)::int FROM (SELECT entity_id,min(created_at) first_at FROM analytics_events WHERE event_name='website_published' AND entity_id IS NOT NULL GROUP BY entity_id) p WHERE first_at >= $1 AND first_at < $2) "firstPublished",
 (SELECT count(*)::int FROM website_sites WHERE status='published') "publishedSites",(SELECT count(*)::int FROM website_ultra_enquiries WHERE created_at >= $1 AND created_at < $2) "ultraEnquiries",
 (SELECT count(*)::int FROM analytics_events WHERE event_name='website_public_site_view' AND created_at >= $1 AND created_at < $2) "publicSiteViews",
 (SELECT count(*)::int FROM analytics_events WHERE event_name='website_public_checkout_started' AND created_at >= $1 AND created_at < $2) "publicCheckoutStarts"`,
 referrals:`SELECT (SELECT count(*)::int FROM referral_profiles WHERE created_at >= $1 AND created_at < $2) participants,
 (SELECT count(DISTINCT referred_user_id)::int FROM referral_attributions WHERE referred_user_id IS NOT NULL AND bound_at >= $1 AND bound_at < $2) "referredAccounts",
 (SELECT count(DISTINCT o.id)::int FROM orders o WHERE ${paid} AND referrer_user_id IS NOT NULL AND paid_at >= $1 AND paid_at < $2) "paidReferredOrders"`,
 earnings:`SELECT coalesce(sum(amount_minor),0)::float8 "sellerReleasedMinor" FROM finance_operations WHERE kind='store_sale' AND state='available' AND created_at >= $1 AND created_at < $2`
};
export class GrowthAnalyticsStore {
 static async ingest(value:unknown,userId?:string){
  const v=validateGrowth(value);if(v.event==='identity'&&!userId)throw new GrowthError('Sign in to link a visit.',401);
  const db=getPool();if(!db)throw new GrowthError('Analytics unavailable.',503);
  const name='growth_'+v.event,once=['identity','standalone_launch','installed','install_prompt','install_accepted','install_dismissed'].includes(v.event),client=await db.connect();
  try{await client.query('BEGIN');await client.query("SET LOCAL statement_timeout='2000ms'");
   const entity=once?'session':v.metadata.productId||v.metadata.page;
   const key=[v.visitorId,v.sessionId,name,entity,v.event==='identity'?userId||'':''].join(':');
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
   const old=await client.query(`SELECT id FROM analytics_events WHERE event_name=$1 AND visitor_id=$2 AND session_id=$3 AND entity_id=$4 AND ($5::boolean OR created_at>=NOW()-interval '30 seconds') AND ($6::text IS NULL OR user_id=$6) LIMIT 1`,[name,v.visitorId,v.sessionId,entity,once,v.event==='identity'?userId:null]);
   if(!old.rowCount)await client.query('INSERT INTO analytics_events(id,event_name,user_id,visitor_id,session_id,entity_type,entity_id,metadata_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',['evt_'+randomUUID(),name,userId||null,v.visitorId,v.sessionId,'platform',entity,JSON.stringify(v.metadata)]);
   await client.query('COMMIT');return {accepted:true,duplicate:Boolean(old.rowCount)};
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
 static clearCache(){cache.clear();inflight.clear();}
 static async summary(range:unknown,now=new Date()):Promise<GrowthReport>{
  const period=growthPeriod(range,now),hit=cache.get(period.range);if(hit&&hit.until>Date.now())return hit.value;
  const pending=inflight.get(period.range);if(pending)return pending;
  const work=this.read(period);inflight.set(period.range,work);
  try{const value=await work;if(!value.warnings.length)cache.set(period.range,{until:Date.now()+30000,value});return value;}finally{inflight.delete(period.range);}
 }
 private static async read(period:ReturnType<typeof growthPeriod>):Promise<GrowthReport>{
  const db=getPool();if(!db)throw new GrowthError('Analytics database unavailable.',503);
  const client=await db.connect(),result:any={...period,generatedAt:period.end,warnings:[]};
  try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await client.query("SET LOCAL statement_timeout='2000ms'");
   for(const [domain,sql] of Object.entries(GROWTH_SQL)){
    await client.query('SAVEPOINT analytics_domain');
    try{const rows=(await client.query(sql,[period.start,period.end])).rows;result[domain]=domain==='campaigns'?rows:rows[0];}
    catch{await client.query('ROLLBACK TO SAVEPOINT analytics_domain');result[domain]=null;result.warnings.push(domain+' is temporarily unavailable.');}
    await client.query('RELEASE SAVEPOINT analytics_domain');
   }
   await client.query('COMMIT');
   if(result.traffic){const observed=new Map(result.traffic.trend.map((d:any)=>[d.day,d]));result.traffic.trend=Array.from({length:period.range},(_,i)=>{const date=new Date(Date.parse(period.start)+i*86400000).toISOString().slice(0,10);return observed.get(date)||{day:date,views:0,sessions:0};});}
   return result;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
}
