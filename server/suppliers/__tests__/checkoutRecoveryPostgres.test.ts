import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {getPool,initDatabase} from '../../db/connection.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {AuthStore} from '../../db/authStore.js';
import {CommercialService} from '../../services/commercialService.js';
import {PaystackServerService} from '../../services/paystackService.js';
import {createGuestCheckoutOnce,recoverDirectCheckout,guestCheckoutId} from '../../services/directCheckoutRecovery.js';
import type {OrderRecord} from '../../types/orders.js';
const url=process.env.MYSTERY_CHECKOUT_POSTGRES_URL;
test('native PostgreSQL checkout uniqueness, recovery and unchanged financial records',{skip:!url},async t=>{
 assert.equal(process.env.DATABASE_URL,undefined);assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
 const observer=new pg.Pool({connectionString:url,ssl:false});const original=PaystackServerService.initializeTransaction;
 try{
  assert.equal((await observer.query("SELECT to_regclass('public.orders') AS name")).rows[0].name,null,'Requires an empty disposable database');
  Object.assign(process.env,{DATABASE_URL:url,DATABASE_SSL:'false',MYSTERY_TEST_DATABASE_OPT_IN:'true',NODE_ENV:'test'});await initDatabase();
  const pool=getPool()!,now=new Date().toISOString();
  const fixture=(extra:Partial<OrderRecord>={}):OrderRecord=>({id:'ord_'+randomUUID(),user_id:null,public_reference:'MH-'+randomUUID(),customer_name:null,customer_email:'fixture@example.test',customer_phone:'+233271234567',recipient_phone:'+233271234567',network:'airteltigo',service_type:'data',product_id:'at-1gb',product_name_snapshot:'Synthetic data',bundle_size_snapshot:'1GB',amount:499,currency:'GHS',status:'pending_payment',payment_provider:'paystack',payment_reference:'SYNTHETIC_'+randomUUID(),payment_status:'pending',supplier_provider:'success_biz_hub',supplier_order_id:null,supplier_response:null,supplier_cost_minor:390,supplier_offer_ref:null,supplier_last_checked_at:null,failure_reason:null,created_at:now,updated_at:now,paid_at:null,submitted_at:null,delivered_at:null,...extra});
  const counts=async()=>{const names=['finance_accounts','finance_ledger','admin_audit_log'];const rows=[];for(const name of names)rows.push((await observer.query(`SELECT count(*)::int AS n FROM ${name}`)).rows[0].n);return rows;};
  const before=await counts();
  await t.test('independent connections race on the real order primary key; no overwrite',async()=>{
   const requestId=randomUUID(),a=fixture(),b=fixture();const left=await observer.connect(),right=await observer.connect();
   try{
    assert.notEqual((await left.query('SELECT pg_backend_pid() AS id')).rows[0].id,(await right.query('SELECT pg_backend_pid() AS id')).rows[0].id);
    const results=await Promise.allSettled([createGuestCheckoutOnce(a,{requestId}),createGuestCheckoutOnce(b,{requestId})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    const rejected=results.find(r=>r.status==='rejected') as PromiseRejectedResult;assert.equal(rejected.reason.checkout.paymentState,'unconfirmed');
    const stored=await OrdersStore.findOrder(guestCheckoutId(requestId)!);assert.ok(stored);assert.ok([a.public_reference,b.public_reference].includes(stored.public_reference));
    assert.equal((await observer.query('SELECT count(*)::int AS n FROM orders WHERE id=$1',[stored.id])).rows[0].n,1);
    await assert.rejects(()=>recoverDirectCheckout(undefined,{requestId},stored.product_id,stored.recipient_phone,stored.customer_email!),(e:any)=>e.existingOrderReference===stored.public_reference);
    await assert.rejects(()=>recoverDirectCheckout(undefined,{requestId},stored.product_id,'+233241234567',stored.customer_email!),(e:any)=>!e.existingOrderReference);
    assert.deepEqual(await counts(),before);
   }finally{left.release();right.release();}
  });
  await t.test('authenticated durable initialization is serialized with no duplicate provider call',async()=>{
   await AuthStore.createUser({id:'checkout-fixture',name:'Synthetic',email:'fixture@example.test',phone:null,passwordHash:'SYNTHETIC',role:'customer'});
   let calls=0;PaystackServerService.initializeTransaction=async p=>{calls++;await new Promise(r=>setTimeout(r,20));return {success:true,reference:p.reference,accessCode:'synthetic',authorizationUrl:'https://checkout.invalid'};};
   const requestId=randomUUID();const results=await Promise.allSettled([CommercialService.initialize(fixture({user_id:'checkout-fixture',product_id:'mtn-1gb',network:'mtn'}),{requestId}),CommercialService.initialize(fixture({user_id:'checkout-fixture',product_id:'mtn-1gb',network:'mtn'}),{requestId})]);
   assert.ok(results.some(r=>r.status==='fulfilled'));assert.equal(calls,1);assert.equal((await observer.query("SELECT count(*)::int AS n FROM finance_operations WHERE kind='direct_checkout'")).rows[0].n,1);assert.equal((await observer.query('SELECT count(*)::int AS n FROM finance_ledger')).rows[0].n,0);
   const row=(await observer.query("SELECT * FROM orders WHERE user_id='checkout-fixture'")).rows[0];const recovered=await recoverDirectCheckout('checkout-fixture',{requestId},row.product_id,row.recipient_phone,row.customer_email);assert.equal(recovered?.checkout.accessCode,'synthetic');
  });
 }finally{PaystackServerService.initializeTransaction=original;await getPool()?.end();await observer.end();delete process.env.DATABASE_URL;delete process.env.MYSTERY_TEST_DATABASE_OPT_IN;}
});
