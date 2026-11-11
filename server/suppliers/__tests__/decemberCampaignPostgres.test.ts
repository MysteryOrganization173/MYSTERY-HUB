import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {getPool,initDatabase} from '../../db/connection.js';
import {AuthStore} from '../../db/authStore.js';
import {FinanceStore} from '../../db/financeStore.js';
import {FinanceReconciliationStore} from '../../db/financeReconciliationStore.js';
import {CommercialService} from '../../services/commercialService.js';
import {PaystackServerService} from '../../services/paystackService.js';
import {FulfilmentService} from '../../services/fulfilmentService.js';
import {DIRECT_CAMPAIGN_DEFAULT,DECEMBER_2026_CAMPAIGN_ID} from '../../../shared/directCampaign.js';
import type {OrderRecord} from '../../types/orders.js';

/** Native engine: run with MYSTERY_CAMPAIGN_POSTGRES_URL pointing at an EMPTY disposable *_test database (see docs). */
const url=process.env.MYSTERY_CAMPAIGN_POSTGRES_URL;
test('native PostgreSQL December campaign: atomic welcome reservation and snapshot, immutability, reconciliation, audited activation',{skip:!url},async t=>{
 assert.equal(process.env.DATABASE_URL,undefined);assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
 const observer=new pg.Pool({connectionString:url,ssl:false});
 const original={init:PaystackServerService.initializeTransaction,now:CommercialService.now,resolve:FulfilmentService.getProvider().resolvePackage};
 try{
  assert.equal((await observer.query("SELECT to_regclass('public.orders') AS name")).rows[0].name,null,'Requires an empty disposable database');
  Object.assign(process.env,{DATABASE_URL:url,DATABASE_SSL:'false',MYSTERY_TEST_DATABASE_OPT_IN:'true',NODE_ENV:'test'});await initDatabase();
  const pool=getPool()!;let calls=0;
  PaystackServerService.initializeTransaction=async p=>{calls++;return {success:true,reference:p.reference,accessCode:'synthetic',authorizationUrl:'https://checkout.invalid'};};
  FulfilmentService.getProvider().resolvePackage=async()=>({resolved:{supplierCostMinor:400}} as any);
  CommercialService.now=()=>new Date('2026-12-10T12:00:00Z');
  await AuthStore.createUser({id:'campaign-buyer',name:'Synthetic',email:'buyer@example.test',phone:'+233241230000',passwordHash:'SYNTHETIC',role:'customer'});
  await AuthStore.createUser({id:'campaign-admin',name:'Synthetic admin',email:'admin@example.test',phone:null,passwordHash:'SYNTHETIC',role:'admin'});
  const fixture=(extra:Partial<OrderRecord>={}):OrderRecord=>({id:'ord_'+randomUUID(),user_id:'campaign-buyer',public_reference:'MH-'+randomUUID(),customer_name:null,customer_email:'buyer@example.test',customer_phone:'+233271230000',recipient_phone:'+233271230000',network:'mtn',service_type:'data',product_id:'mtn-1gb',product_name_snapshot:'MTN 1GB',bundle_size_snapshot:'1GB',amount:549,currency:'GHS',status:'pending_payment',payment_provider:'paystack',payment_reference:'PAY-'+randomUUID(),payment_status:'pending',supplier_provider:'success_biz_hub',supplier_order_id:null,supplier_response:null,supplier_cost_minor:400,supplier_last_checked_at:null,failure_reason:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),paid_at:null,submitted_at:null,delivered_at:null,...extra} as OrderRecord);

  await t.test('switched off, the real engine prices exactly as before',async()=>{
   const q=await CommercialService.quote('mtn-1gb','campaign-buyer');assert.equal(q.totalMinor,449);assert.equal(q.pricingRevision,'direct-launch-v1');assert.equal('standardMinor' in q,false);
  });
  await t.test('activation and its audit commit together through the real advisory lock',async()=>{
   const saved=await CommercialService.save('campaign-admin',{kind:'campaign',confirmed:true,expectedVersion:DIRECT_CAMPAIGN_DEFAULT.version,enabled:true,activation:DECEMBER_2026_CAMPAIGN_ID,startDate:'2026-12-01',endDate:'2027-01-05',products:[{productId:'mtn-1gb',campaignMinor:499},{productId:'mtn-2gb',campaignMinor:899}]});
   assert.equal(saved.enabled,true);
   assert.equal((await observer.query("SELECT count(*)::int AS n FROM admin_audit_log WHERE action='commercial_campaign_changed'")).rows[0].n,1);
   await assert.rejects(()=>CommercialService.save('campaign-admin',{kind:'campaign',confirmed:true,expectedVersion:DIRECT_CAMPAIGN_DEFAULT.version,enabled:false,startDate:'2026-12-01',endDate:null,products:[]}),/Refresh/,'a stale revision is refused');
  });
  let paid:OrderRecord;
  await t.test('399 checkout: order, snapshot and welcome reservation commit in one transaction before Paystack',async()=>{
   const q=await CommercialService.quote('mtn-1gb','campaign-buyer');assert.deepEqual([q.standardMinor,q.regularMinor,q.discountMinor,q.totalMinor],[549,499,100,399]);
   paid=await CommercialService.initialize(fixture(),{requestId:randomUUID(),expectedTotalMinor:399,expectedRegularMinor:499,expectedStandardMinor:549,pricingRevision:q.pricingRevision,promotionRevision:q.promotionRevision});
   assert.equal(calls,1);const row=(await observer.query('SELECT amount,commercial_context FROM orders WHERE id=$1',[paid.id])).rows[0];
   assert.equal(row.amount,399);assert.equal(row.commercial_context.standardMinor,549);assert.equal(row.commercial_context.regularMinor,499);assert.equal(row.commercial_context.discountMinor,100);assert.equal(row.commercial_context.priceCampaignId,DECEMBER_2026_CAMPAIGN_ID);
   assert.equal((await observer.query("SELECT state FROM finance_operations WHERE kind='welcome' AND user_id='campaign-buyer'")).rows[0].state,'reserved');
  });
  await t.test('the database refuses any change to the campaign snapshot',async()=>{
   await assert.rejects(()=>observer.query("UPDATE orders SET commercial_context=jsonb_set(commercial_context,'{standardMinor}','499') WHERE id=$1",[paid.id]),/immutable/);
  });
  await t.test('reconciliation sees no snapshot conflict for a campaign order (regular − welcome = paid)',async()=>{
   const report=await FinanceReconciliationStore.report({reference:paid.public_reference,filter:'all'});assert.equal(report.total,1);
   assert.notEqual(report.rows[0].code,'finance_conflict',JSON.stringify(report.rows[0]));
  });
  await t.test('a quote from before a campaign change is refused on the real engine; nothing is written',async()=>{
   const q=await CommercialService.quote('mtn-2gb');const orders=(await observer.query('SELECT count(*)::int AS n FROM orders')).rows[0].n;
   const current=await FinanceStore.readConfig('direct-campaign');
   await FinanceStore.transaction('campaign-admin',tx=>tx.saveConfig('direct-campaign',{...current,version:'changed-'+randomUUID(),products:{'mtn-2gb':{campaignMinor:849}}}));
   await assert.rejects(()=>CommercialService.initialize(fixture({user_id:null,product_id:'mtn-2gb',bundle_size_snapshot:'2GB',recipient_phone:'+233271230001',amount:1049}),{requestId:randomUUID(),expectedTotalMinor:q.totalMinor,expectedRegularMinor:q.regularMinor,pricingRevision:q.pricingRevision}),(e:any)=>e.checkout?.code==='CHECKOUT_REVIEW_REQUIRED');
   assert.equal((await observer.query('SELECT count(*)::int AS n FROM orders')).rows[0].n,orders);assert.equal(calls,1);
  });
 }finally{PaystackServerService.initializeTransaction=original.init;CommercialService.now=original.now;FulfilmentService.getProvider().resolvePackage=original.resolve;await getPool()?.end();await observer.end();delete process.env.DATABASE_URL;delete process.env.MYSTERY_TEST_DATABASE_OPT_IN;}
});
