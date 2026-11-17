import type {PoolClient} from 'pg';
import {smsTransaction} from './store.js';
import {CONTACT_SALE_SQL,DIRECT_CONTACT_SQL} from '../db/contactHubStore.js';
import {FinanceError} from '../db/financeStore.js';

const DAY=86400000;
const median=(values:number[])=>{const a=[...values].sort((a,b)=>a-b);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
/** Last21 buying days, same UTC day collapsed; median/MAD resist bursts and outliers. */
export function buyingPattern(dates:(string|Date)[],now=new Date(),purchaseCount=dates.length) {
  const days=[...new Set(dates.map(d=>+new Date(d)).filter(d=>Number.isFinite(d)&&d<=+now).map(d=>Math.floor(d/DAY)))].sort((a,b)=>a-b).slice(-21);
  if(!days.length)return {group:'insufficient',cycleDays:null,daysSinceLast:null,reason:'No qualifying completed direct purchase history.'};
  const elapsed=Math.max(0,Math.floor(+now/DAY)-days.at(-1)!);
  if(days.length===1&&purchaseCount>1)return {group:'insufficient',cycleDays:null,daysSinceLast:elapsed,reason:'Multiple purchases on one buying day cannot establish a repeat cycle.'};
  if(days.length===1)return {group:'one_time',cycleDays:null,daysSinceLast:elapsed,reason:'One buying day cannot establish a repeat cycle.'};
  const gaps=days.slice(1).map((d,i)=>d-days[i]),cycle=median(gaps),mad=median(gaps.map(g=>Math.abs(g-cycle)));
  if(gaps.length<3||mad>cycle*.75)return {group:'insufficient',cycleDays:null,daysSinceLast:elapsed,reason:gaps.length<3?'At least four buying days are needed.':'Intervals vary too much for a reliable cycle.'};
  const due=Math.ceil(cycle+Math.max(2,mad)),unusual=Math.ceil(Math.max(cycle*1.75,cycle+3*mad,cycle+7)),long=Math.ceil(Math.max(60,cycle*3,unusual+14));
  const group=elapsed>=long?'long_inactive':elapsed>=unusual?'unusual':elapsed>=due?'due':elapsed<=Math.max(2,cycle*.35)?'recent':'normal';
  return {group,cycleDays:Math.round(cycle*10)/10,daysSinceLast:elapsed,reason:`Median ${Math.round(cycle*10)/10} days across ${gaps.length} intervals; variation ${Math.round(mad*10)/10} days. Due from ${due}, unusual from ${unusual}, long inactive from ${long} days.`};
}
export async function buyingPatterns(client?:PoolClient) {
  const read=async(c:PoolClient)=>{
    const now=new Date();
    const rows=(await c.query(`WITH eligible AS (
      SELECT o.user_id,date_trunc('day',o.delivered_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS buying_day,count(*) AS purchases
      FROM public.orders o WHERE ${CONTACT_SALE_SQL} AND o.user_id IS NOT NULL GROUP BY o.user_id,buying_day
    ), ranked AS (SELECT *,row_number() OVER(PARTITION BY user_id ORDER BY buying_day DESC) rn FROM eligible), histories AS (SELECT user_id,array_agg(buying_day ORDER BY buying_day) dates,sum(purchases) AS purchases FROM ranked WHERE rn<=21 GROUP BY user_id)
    SELECT u.id,u.name,COALESCE(h.dates,'{}'::timestamptz[]) AS dates,COALESCE(h.purchases,0) AS purchases FROM public.users u LEFT JOIN histories h ON h.user_id=u.id
    WHERE u.role='customer' AND u.status='active' AND
      (NOT EXISTS(SELECT 1 FROM public.orders o WHERE o.user_id=u.id) OR EXISTS(SELECT 1 FROM public.orders o WHERE o.user_id=u.id AND ${DIRECT_CONTACT_SQL}))
    ORDER BY u.id LIMIT 10001`,[now.toISOString()])).rows;
    if(rows.length>10000)throw new FinanceError('Narrow the direct customer dataset before buying-pattern review.',413);
    const customers=rows.map(r=>({id:r.id,name:r.name,...buyingPattern(r.dates,now,Number(r.purchases))}));
    return {observedAt:now.toISOString(),customers,counts:Object.fromEntries(['recent','normal','due','unusual','long_inactive','one_time','insufficient'].map(g=>[g,customers.filter(c=>c.group===g).length])),retentionAutomation:false,basis:'Qualifying completed direct purchases only. Same-day purchases count as one buying day. Last21 buying days; median interval and median absolute deviation. Suggestions are not consent or a sending schedule.'};
  };
  return client?read(client):smsTransaction(read);
}
