import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import express from 'express';
import type {AddressInfo} from 'node:net';
import pg from 'pg';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {getPool,initDatabase} from '../../db/connection.js';
import {AuthStore} from '../../db/authStore.js';
import {FinanceStore} from '../../db/financeStore.js';
import {FinanceReconciliationStore} from '../../db/financeReconciliationStore.js';
import {FinanceService} from '../../services/financeService.js';
import {AfaService} from '../../services/afaService.js';
import {CommercialService} from '../../services/commercialService.js';
import {PaystackServerService} from '../../services/paystackService.js';
import type {SuccessBizHubProvider} from '../successBizHub/provider.js';
import {apiRouter} from '../../routes/api.js';
import {AFA_PRICING_DEFAULT,AFA_CAMPAIGN_ACTIVATION,AFA_COST_CONFIRMATION} from '../../../shared/afaPricing.js';

/** Native engine: MYSTERY_AFA_PRICING_POSTGRES_URL must point at an EMPTY disposable *_test database. Synthetic data; no supplier or Paystack. */
const url=process.env.MYSTERY_AFA_PRICING_POSTGRES_URL;
test('native PostgreSQL AFA pricing: reviewed fee, Wallet debit, immutable snapshot, stale quotes write nothing, audited activation',{skip:!url},async t=>{
 assert.equal(process.env.DATABASE_URL,undefined);assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
 const observer=new pg.Pool({connectionString:url,ssl:false}),env={...process.env};
 const original={provider:AfaService.provider,init:PaystackServerService.initializeTransaction,now:CommercialService.now,fetch:globalThis.fetch};
 const server=await new Promise<any>(r=>{const app=express();app.use(express.json());app.use('/api',apiRouter);const s=app.listen(0,'127.0.0.1',()=>r(s));});
 const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
 try{
  assert.equal((await observer.query("SELECT to_regclass('public.orders') AS name")).rows[0].name,null,'Requires an empty disposable database');
  Object.assign(process.env,{DATABASE_URL:url,DATABASE_SSL:'false',MYSTERY_TEST_DATABASE_OPT_IN:'true',NODE_ENV:'test',AFA_PII_ENCRYPTION_KEY:'cd'.repeat(32),AFA_SERVICE_ENABLED:'true',AFA_RETAIL_PRICE_MINOR:'2999',APP_URL:'https://fixture.example'});
  await initDatabase();
  globalThis.fetch=(async(input:any,init:any)=>String(input).startsWith('http://127.0.0.1')?original.fetch(input,init):Promise.reject(new Error('External request blocked'))) as any;
  let inits=0;PaystackServerService.initializeTransaction=async p=>{inits++;return {success:true,reference:p.reference,authorizationUrl:'https://checkout.paystack.com/fixture'};};
  AfaService.provider={client:{isConfigured:()=>true,isFulfillmentEnabled:()=>true},checkAfaAvailable:async()=>({available:true,status:'available'}),placeAfaRegistration:async()=>{throw new Error('no supplier in tests');},getAfaStatus:async()=>{throw new Error('no supplier in tests');}} as unknown as SuccessBizHubProvider;
  CommercialService.now=()=>new Date('2026-11-13T10:00:00Z');
  for(const [id,role] of [['afa-customer','customer'],['afa-admin','admin']] as const){await AuthStore.createUser({id,name:id,email:`${id}@example.test`,phone:null,passwordHash:'SYNTHETIC',role});await AuthStore.createSession(id,`${id}-token`);}
  const post=(body:any)=>original.fetch(`${base}/afa/payments/initialize`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer afa-customer-token'},body:JSON.stringify({name:'Synthetic AFA Customer',idNumber:'GHA-202501234-5',location:'Accra',region:'Greater Accra',dateOfBirth:'1990-02-12',consent:true,customerEmail:'receipt@example.test',...body})});
  const quote=async()=>(await original.fetch(`${base}/afa/quote`)).json();
  const count=async(table:string)=>(await observer.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;

  await t.test('switched off: the standard server price, no snapshot, exactly as before',async()=>{
   const q=await quote();assert.equal(q.totalMinor,2999);assert.equal(q.pricingRevision,'afa:2999');
   const r=await post({phone:'0249116301'});assert.equal(r.status,200);const body=await r.json();
   const row=(await observer.query('SELECT amount,commercial_context FROM orders WHERE public_reference=$1',[body.orderRef])).rows[0];assert.equal(row.amount,2999);assert.equal(row.commercial_context,null);
  });
  let version='';
  await t.test('cost confirmation and activation commit with their audit rows under the commercial lock',async()=>{
   const cfg:any=await CommercialService.save('afa-admin',{kind:'afa-cost',confirmed:true,expectedVersion:AFA_PRICING_DEFAULT.version,costMinor:1500,evidence:'Synthetic written quote from the AFA supplier, 13 Nov 2026',confirmation:AFA_COST_CONFIRMATION});
   const on:any=await CommercialService.save('afa-admin',{kind:'afa-campaign',confirmed:true,expectedVersion:cfg.version,enabled:true,activation:AFA_CAMPAIGN_ACTIVATION,startDate:'2026-12-01',endDate:'2027-01-04',campaignMinor:1999});
   version=on.version;assert.equal(on.enabled,true);
   assert.equal((await observer.query("SELECT count(*)::int AS n FROM admin_audit_log WHERE action IN ('commercial_afa_cost_confirmed','commercial_afa_campaign_changed')")).rows[0].n,2);
   await assert.rejects(()=>CommercialService.save('afa-admin',{kind:'afa-campaign',confirmed:true,expectedVersion:cfg.version,enabled:false,startDate:'2026-12-01',endDate:'2027-01-04',campaignMinor:1999}),/Refresh/);
  });
  await t.test('active: Paystack order at the reviewed 1999 with an immutable snapshot; reconciliation sees no conflict',async()=>{
   CommercialService.now=()=>new Date('2026-12-10T12:00:00Z');const q=await quote();assert.equal(q.totalMinor,1999);
   const before=inits;const r=await post({phone:'0249116302',expectedTotalMinor:1999,pricingRevision:q.pricingRevision});assert.equal(r.status,200);assert.equal(inits,before+1);
   const body=await r.json();const row=(await observer.query('SELECT id,amount,commercial_context FROM orders WHERE public_reference=$1',[body.orderRef])).rows[0];
   assert.equal(row.amount,1999);assert.equal(row.commercial_context.standardMinor,2999);assert.equal(row.commercial_context.priceCampaignRevision,`afa:2999~${version}`);
   await assert.rejects(()=>observer.query("UPDATE orders SET commercial_context=jsonb_set(commercial_context,'{paidMinor}','2999') WHERE id=$1",[row.id]),/immutable/);
   const report=await FinanceReconciliationStore.report({reference:body.orderRef,filter:'all'});assert.notEqual(report.rows[0].code,'finance_conflict');
   assert.equal((await observer.query('SELECT count(*)::int AS n FROM afa_registrations WHERE order_id=$1 AND encrypted_payload IS NOT NULL',[row.id])).rows[0].n,1,'identity stays encrypted in its own table');
  });
  await t.test('a stale or unreviewed fee writes no order, registration, debit or Paystack call',async()=>{
   const orders=await count('orders'),regs=await count('afa_registrations'),ledger=await count('finance_ledger'),before=inits;
   for(const body of [{phone:'0249116303'},{phone:'0249116303',expectedTotalMinor:2999,pricingRevision:'afa:2999'},{phone:'0249116303',paymentMethod:'wallet',requestId:randomUUID(),expectedTotalMinor:2999,pricingRevision:'afa:2999'}]){
    const r=await post(body);assert.equal(r.status,409,JSON.stringify(body));assert.equal((await r.json()).code,'AFA_REVIEW_REQUIRED');
   }
   assert.deepEqual([await count('orders'),await count('afa_registrations'),await count('finance_ledger'),inits],[orders,regs,ledger,before]);
  });
  await t.test('Wallet: exactly 1999 debited once, in the same transaction as the order and registration',async()=>{
   await FinanceService.adjustment('afa-admin','afa-customer',{confirmed:true,direction:'credit',amountMinor:5000,requestId:randomUUID(),reason:'Synthetic fixture'});
   const q=await quote(),requestId=randomUUID(),body={phone:'0249116304',paymentMethod:'wallet',requestId,expectedTotalMinor:1999,pricingRevision:q.pricingRevision};
   const a=await (await post(body)).json(),b=await (await post(body)).json();assert.equal(a.amountPesewas,1999);assert.equal(a.orderRef,b.orderRef);
   assert.equal((await FinanceService.summary('afa-customer')).walletMinor,3001);
   const debit=(await observer.query("SELECT delta_minor FROM finance_ledger WHERE user_id='afa-customer' AND delta_minor<0")).rows;assert.deepEqual(debit.map((r:any)=>Number(r.delta_minor)),[-1999]);
  });
 }finally{
  AfaService.provider=original.provider;PaystackServerService.initializeTransaction=original.init;CommercialService.now=original.now;globalThis.fetch=original.fetch;
  await new Promise<void>(r=>server.close(()=>r()));await getPool()?.end();await observer.end();
  for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);
 }
});
