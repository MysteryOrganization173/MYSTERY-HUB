import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {getPool,initDatabase} from '../../db/connection.js';
import {AuthStore} from '../../db/authStore.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {FinanceReconciliationStore,FINANCE_RECONCILIATION_SQL} from '../../db/financeReconciliationStore.js';
import {PaystackServerService} from '../../services/paystackService.js';
import {FulfilmentService} from '../../services/fulfilmentService.js';
import {FinanceService} from '../../services/financeService.js';
import type {OrderRecord} from '../../types/orders.js';
const url=process.env.MYSTERY_FINANCE_RECONCILIATION_POSTGRES_URL;

test('native read-only financial reconciliation evidence and isolation',{skip:!url},async t=>{
 assert.equal(process.env.DATABASE_URL,undefined);assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
 const observer=new pg.Pool({connectionString:url,ssl:false});let sequence=0;const expected:Array<{reference:string;code:string;label:string}>=[];
 const now=Date.now(),at=(offset=0)=>new Date(now+offset).toISOString();
 try{
  assert.equal((await observer.query("SELECT to_regclass('public.users') AS name")).rows[0].name,null,'A new empty disposable database is required');
  Object.assign(process.env,{NODE_ENV:'test',DATABASE_URL:url,DATABASE_SSL:'false',MYSTERY_TEST_DATABASE_OPT_IN:'true'});await initDatabase();
  const db=getPool()!;
  await db.query('EXPLAIN '+FINANCE_RECONCILIATION_SQL,[null,'all',25,0]);
  for(const id of ['fixture-owner','fixture-seller','fixture-admin'])await AuthStore.createUser({id,name:id,email:null,phone:null,passwordHash:'SYNTHETIC_SECRET',role:id==='fixture-admin'?'admin':'customer'});
  const order=async(label:string,code:string,patch:Partial<OrderRecord>={})=>{
   const n=++sequence;const o:OrderRecord={id:'ord_'+randomUUID(),user_id:'fixture-owner',public_reference:`MH-FIN-${n}`,customer_name:'PRIVATE CUSTOMER',customer_email:'private-customer@fixture.test',customer_phone:'0591111111',recipient_phone:`024${String(n).padStart(7,'0')}`,network:'telecel',service_type:'data',product_id:'synthetic-data',product_name_snapshot:'Synthetic data',bundle_size_snapshot:'1GB',amount:1200,currency:'GHS',status:'delivered',payment_provider:'paystack',payment_reference:`SYNTHETIC-PAY-${n}`,payment_status:'success',supplier_provider:'success_biz_hub',supplier_order_id:`SYNTHETIC-SUPPLIER-${n}`,supplier_response:'SENSITIVE_PROVIDER_BODY',supplier_cost_minor:800,supplier_offer_ref:null,supplier_last_checked_at:at(),failure_reason:null,created_at:at(-3600000-n),updated_at:at(),paid_at:at(-1800000),submitted_at:at(-1700000),delivered_at:at(-600000),...patch};
   await OrdersStore.createOrder(o);await db.query('UPDATE orders SET manual_review=$2,archived_at=$3 WHERE id=$1',[o.id,o.manual_review||false,o.archived_at||null]);expected.push({reference:o.public_reference,code,label});return o;
  };
  const operation=async(kind:string,state:string,amount:number,payload:any,user='fixture-owner')=>{
   const id='fin_'+randomUUID();await db.query('INSERT INTO finance_operations(id,user_id,kind,idempotency_key,state,amount_minor,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,user,kind,id,state,amount,JSON.stringify(payload)]);return id;
  };
  const entry=async(operationId:string,bucket:'wallet'|'store',delta:number,user='fixture-owner')=>{await db.query('INSERT INTO finance_ledger(id,user_id,operation_id,bucket,delta_minor,balance_after_minor,description) VALUES($1,$2,$3,$4,$5,$6,$7)',['led_'+randomUUID(),user,operationId,bucket,delta,bucket==='wallet'?10000:null,'Synthetic private ledger detail']);};
  const purchase=async(o:OrderRecord,state='completed')=>{const id=await operation('purchase',state,o.amount,{orderId:o.id,productId:o.product_id});await entry(id,'wallet',-o.amount);return id;};
  const refund=async(o:OrderRecord,state='completed')=>{const id=await operation('refund',state,o.amount,{orderId:o.id});await entry(id,'wallet',o.amount);return id;};
  const history=async(o:OrderRecord,r:any)=>{await db.query('UPDATE orders SET resolution_json=$2 WHERE id=$1',[o.id,JSON.stringify(r)]);await db.query('INSERT INTO order_resolution_events(id,order_id,request_id,input_hash,action,actor_id,result) VALUES($1,$2,$3,$4,$5,$6,$7)',['ores_'+randomUUID(),o.id,randomUUID(),'synthetic','synthetic','fixture-admin',JSON.stringify(r)]);};
  const manual=(outcome='manual_fulfillment')=>({version:1,stage:'resolved',outcome,lastActor:'fixture-admin',updatedAt:at(),manual:{outcome,actor:'fixture-admin',at:at(),reason:'Recorded synthetic service outcome',evidence:'Independent synthetic operator evidence',...(outcome==='external_compensation'?{method:'External MoMo',reference:'SYNTHETIC-REMEDY'}:{})}});
  const resolution=(o:OrderRecord,patch:any={})=>({version:1,stage:'resolved',outcome:o.payment_provider==='wallet'?'wallet_refund':'paystack_refund',amountMinor:o.amount,paymentReference:o.payment_reference,verifiedAt:at(),...(o.payment_provider==='paystack'?{refundId:String(100000+sequence),providerStatus:'processed'}:{}),lastActor:'fixture-admin',updatedAt:at(),...patch});
  const unpaid={status:'pending_payment',payment_status:'pending',paid_at:null,submitted_at:null,delivered_at:null,supplier_order_id:null} as const;
  await order('verified order with pending checkout initialization','completed').then(async o=>{await operation('direct_checkout','pending',o.amount,{orderId:o.id,productId:o.product_id,checkout:{reference:o.payment_reference}});});
  await order('abandoned or callback never received','awaiting',unpaid);
  await order('browser closed without recorded payment','unpaid_closed',{...unpaid,status:'cancelled',payment_status:'cancelled'});
  await order('old unconfirmed attempt is not an emergency','awaiting',{...unpaid,created_at:at(-90*86400000)});
  await order('paid after closed checkout','review_flag',{...unpaid,status:'cancelled',payment_status:'success',paid_at:at(),manual_review:true});
  await order('browser callback lost but durable payment/delivery exists','completed');
  await order('supplier acceptance is uncertain','uncertain_submission',{status:'queued',delivered_at:null,supplier_order_id:null,failure_reason:'supplier_submission_uncertain'});
  await order('ordinary supplier delay','progressing',{status:'processing',delivered_at:null});
  await order('paid definitive failure without remedy','remedy_open',{status:'failed',delivered_at:null});
  await order('legacy delivered label lacks timestamp','delivery_incomplete',{delivered_at:null});
  await order('delivered order with an open resolution is not silently closed','resolution_incomplete',{resolution_json:{version:1,stage:'under_review',lastActor:'fixture-admin',updatedAt:at()}}).then(async o=>{await history(o,{version:1,stage:'under_review',lastActor:'fixture-admin',updatedAt:at()});});
  await order('payment success lacks timestamp','payment_incomplete',{paid_at:null});
  await order('supplier facts without payment confirmation','payment_conflict',{payment_status:'pending',paid_at:null});
  await order('unsupported currency is not a verified sale','payment_incomplete',{currency:'USD' as any});
  await order('complimentary is not payment revenue','non_payment',{payment_provider:'complimentary',payment_status:'not_required',paid_at:null});
  await order('operator-recorded is not provider verification','non_payment',{payment_provider:'admin_external',payment_status:'recorded',paid_at:null});
  await order('Marketplace refund_pending retains delivered global status','remedy_open',{service_type:'marketplace',marketplace_status:'refund_pending'});
  await order('Marketplace cancellation needs payment evidence review','remedy_open',{service_type:'marketplace',marketplace_status:'cancelled'});
  await order('legitimate Marketplace completion','completed',{service_type:'marketplace',marketplace_status:'completed'});
  await order('legitimate AFA progress has no invented MTN SLA','progressing',{service_type:'afa',network:'mtn',status:'processing',paid_at:at(-96*3600000),delivered_at:null});
  await order('MTN exceptional processing review boundary','mtn_review_due',{network:'mtn',status:'processing',paid_at:at(-48*3600000-1000),delivered_at:null});
  await order('MTN inside exceptional window remains monitoring','progressing',{network:'mtn',status:'processing',paid_at:at(-48*3600000+60000),delivered_at:null});
  for(const status of ['failed','cancelled','refund_pending'] as const){const o=await order(`resolved manual history keeps ${status}`,'manual_fulfillment',{status,delivered_at:null,archived_at:status==='failed'?at():null});await history(o,manual());}
  {const o=await order('external remedy is not a verified refund','external_compensation',{status:'failed',delivered_at:null});await history(o,manual('external_compensation'));}
  {const o=await order('manual JSON without matching history','resolution_incomplete',{status:'failed',delivered_at:null});await db.query('UPDATE orders SET resolution_json=$2 WHERE id=$1',[o.id,JSON.stringify(manual())]);}
  {const o=await order('altered manual evidence cannot match history','resolution_incomplete',{status:'failed',delivered_at:null});await history(o,manual());await db.query("UPDATE orders SET resolution_json=jsonb_set(resolution_json,'{manual,evidence}','\"Changed evidence\"') WHERE id=$1",[o.id]);}
  {const o=await order('processed exact Paystack refund','paystack_refund',{status:'refunded',delivered_at:null});await history(o,resolution(o));}
  {const o=await order('pending customer refund is not completion','refund_progress',{status:'refund_pending',delivered_at:null});const r=resolution(o,{stage:'refund_pending',providerStatus:'processing'});delete (r as any).verifiedAt;await history(o,r);}
  {const o=await order('supplier reimbursement is not customer refund','remedy_open',{status:'refund_pending',delivered_at:null});await history(o,{version:1,stage:'under_review',lastActor:'fixture-admin',updatedAt:at(),supplierEvidence:{status:'refunded',note:'Supplier balance only',actor:'fixture-admin',at:at()}});}
  {const o=await order('refund verification unavailable remains open','remedy_open',{status:'refund_pending',delivered_at:null});await history(o,{version:1,stage:'under_review',lastActor:'fixture-admin',updatedAt:at(),lastAttemptAt:at(),lastError:'Unavailable'});}
  {const o=await order('refund amount mismatch cannot close','resolution_incomplete',{status:'refunded',delivered_at:null});await history(o,resolution(o,{amountMinor:1100}));}
  {const o=await order('refund evidence changed after history','resolution_incomplete',{status:'refunded',delivered_at:null});await history(o,resolution(o));await db.query("UPDATE orders SET resolution_json=jsonb_set(resolution_json,'{refundId}','\"987654\"') WHERE id=$1",[o.id]);}
  {const o=await order('Wallet purchase debit confirmed','completed',{payment_provider:'wallet'});await purchase(o);}
  {const o=await order('Wallet paid without debit','finance_conflict',{payment_provider:'wallet'});}
  {const o=await order('Wallet debit cannot be an unpaid attempt','finance_conflict',{...unpaid,payment_provider:'wallet'});await purchase(o);}
  {const o=await order('Wallet debit cannot be cancelled/unpaid','finance_conflict',{...unpaid,status:'cancelled',payment_status:'cancelled',payment_provider:'wallet'});await purchase(o);}
  {const o=await order('Wallet refund credit cannot coexist with completed delivery','finance_conflict',{payment_provider:'wallet'});await purchase(o);await refund(o);}
  {const o=await order('original Wallet refund ledger and history agree','wallet_refund',{payment_provider:'wallet',status:'refunded',delivered_at:null});await purchase(o);await refund(o);await history(o,resolution(o));}
  {const o=await order('legacy Wallet credit does not require a second refund','wallet_refund_unreconciled',{payment_provider:'wallet',status:'refunded',delivered_at:null});await purchase(o);await refund(o);}
  {const o=await order('duplicate pending refund credit cannot hide','finance_conflict',{payment_provider:'wallet',status:'refunded',delivered_at:null});await purchase(o);await refund(o);await refund(o,'pending');await history(o,resolution(o));}
  {const o=await order('operation amount mismatch','finance_conflict');await operation('direct_checkout','pending',o.amount+1,{orderId:o.id,productId:o.product_id});}
  {const o=await order('operation reference mismatch','finance_conflict');await operation('direct_checkout','pending',o.amount,{orderId:o.id,productId:o.product_id,checkout:{reference:'ANOTHER-REFERENCE'}});}
  {const o=await order('known simulated direct initialization is not payment proof','finance_conflict');await operation('direct_checkout','pending',o.amount,{orderId:o.id,productId:o.product_id,checkout:{reference:o.payment_reference,isSimulated:true}});}
  {const o=await order('discount snapshot arithmetic mismatch','finance_conflict',{commercial_context:{regularMinor:1300,discountMinor:200,paidMinor:1200} as any});}
  {const o=await order('integral JSON monetary values accept equivalent decimal representation','completed',{commercial_context:{regularMinor:1300,discountMinor:100,paidMinor:1200} as any});await db.query('UPDATE orders SET commercial_context=$2::jsonb WHERE id=$1',[o.id,'{"regularMinor":1300.0,"discountMinor":100.00,"paidMinor":1200.0}']);}
  await order('malformed monetary snapshot cannot throw or look valid','finance_conflict',{commercial_context:{regularMinor:'untrusted text',discountMinor:0,paidMinor:1200} as any});
  {const o=await order('initialization operation cannot carry Wallet money','finance_conflict');const id=await operation('direct_checkout','pending',o.amount,{orderId:o.id,productId:o.product_id});await entry(id,'wallet',o.amount);}
  const store=async(label:string,code:string,state:string,patch:Partial<OrderRecord>={},opts:{credit?:boolean;availableAt?:boolean;earning?:number;badArithmetic?:boolean}={})=>{
   const earning=opts.earning??240,ctx={channel:'website_store',siteId:'site_fixture',ownerId:'fixture-seller',productId:'synthetic-data',retailMinor:1200,wholesaleMinor:opts.badArithmetic?950:1200-60-earning,reserveMinor:60,earningMinor:earning,supplierCostMinor:800,currency:'GHS',policyVersion:'frozen-policy',wholesaleVersion:'frozen-wholesale',priceVersion:'frozen-retail'} as const;
   const o=await order(label,code,{store_context:ctx,...patch});await operation('store_checkout','pending',o.amount,{orderId:o.id,reference:o.payment_reference,productId:o.product_id,siteId:ctx.siteId,customerId:o.user_id||null},'fixture-seller');
   const id=await operation('store_sale',state,earning,{orderId:o.id,siteId:ctx.siteId,snapshot:ctx,...(opts.availableAt?{availableAt:at()}: {})},'fixture-seller');if(opts.credit)await entry(id,'store',earning,'fixture-seller');return {o,id,earning};
  };
  await store('seller margin only after stored delivery','completed','available',{}, {credit:true,availableAt:true});
  await store('valid zero-margin seller delivery','completed','available',{}, {earning:0,availableAt:true});
  await store('enabled guest store checkout remains valid','completed','available',{user_id:null},{credit:true,availableAt:true});
  {const {o}=await store('known simulated store initialization is not payment proof','finance_conflict','available',{}, {credit:true,availableAt:true});await db.query("UPDATE finance_operations SET payload=jsonb_set(payload,'{isSimulated}','true') WHERE kind='store_checkout' AND payload->>'orderId'=$1",[o.id]);}
  await store('seller credit without delivered order','earning_unbacked','available',{status:'processing',delivered_at:null},{credit:true,availableAt:true});
  await store('seller pending with an actual credit','finance_conflict','pending',{}, {credit:true});
  await store('seller frozen snapshot arithmetic mismatch','finance_conflict','available',{}, {credit:true,availableAt:true,badArithmetic:true});
  await store('delivered store earning awaits existing sync','earnings_pending','pending');
  await store('seller state unsupported by recovery is unknown','unknown','unexpected_state');
  await store('seller reversal restriction stays attention','reversal_open','manual_review',{status:'failed',delivered_at:null},{credit:true,availableAt:true});
  {const {o}=await store('actual seller credit requires reversal even without metadata','reversal_open','reversed',{status:'failed',delivered_at:null},{credit:true});await history(o,manual());}
  {const {o,earning}=await store('exact seller reversal plus historical manual service','manual_fulfillment','reversed',{status:'failed',delivered_at:null},{credit:true,availableAt:true});const r=await operation('reversal','completed',earning,{orderId:o.id,source:'store'},'fixture-seller');await entry(r,'store',-earning,'fixture-seller');await history(o,manual());}
  {const {o,earning}=await store('duplicate seller reversal cannot be treated settled','reversal_open','reversed',{status:'failed',delivered_at:null},{credit:true,availableAt:true});for(let i=0;i<2;i++){const r=await operation('reversal','completed',earning,{orderId:o.id,source:'store'},'fixture-seller');await entry(r,'store',-earning,'fixture-seller');}await history(o,manual());}
  {const {o}=await store('valid zero-margin reversal needs no ledger movement','manual_fulfillment','reversed',{status:'failed',delivered_at:null},{earning:0,availableAt:true});await operation('reversal','completed',0,{orderId:o.id,source:'store'},'fixture-seller');await history(o,manual());}
  const funding=async(label:string,code:string,state:string,opts:{credit?:boolean;times?:boolean;negative?:boolean}={})=>{const id=await operation('topup',state,1000,{reference:'SYNTHETIC-TOPUP-'+randomUUID(),currency:'GHS',...(opts.times?{verifiedAt:at(),creditedAt:at()}:{}),...(opts.negative?{lastVerifiedAt:at()}: {})});if(opts.credit)await entry(id,'wallet',1000);expected.push({reference:id,code,label});return id;};
  await funding('unconfirmed Wallet top-up is not a lost payment','awaiting','pending');
  await funding('funding transport uncertainty is not failed money','funding_uncertain','initialization_uncertain');
  await funding('verified Wallet credit agrees','funding_credit','credited',{credit:true,times:true});
  await funding('funding negative verification without credit','funding_failed','failed',{negative:true});
  await funding('funding pending with verified-credit timestamps','finance_conflict','pending',{times:true});
  await funding('credited funding without verification is unknown','funding_uncertain','credited',{credit:true});
  await funding('credited funding missing Wallet credit is review','finance_conflict','credited',{times:true});
  await funding('funding reversal awaiting recovered balance','reversal_open','reversal_review',{credit:true,times:true});
  for(const [label,code,state,count] of [['credited funding plus reversal is inconsistent','finance_conflict','credited',1],['exact compensating funding reversal','funding_reversed','reversed',1],['duplicate funding reversal cannot hide','finance_conflict','reversed',2]] as const){const id=await funding(label,code,state,{credit:true,times:true});for(let i=0;i<count;i++){const r=await operation('reversal','completed',1000,{topupId:id});await entry(r,'wallet',-1000);}}
  {const id=await operation('purchase','completed',1200,{orderId:'ord_absent',productId:'synthetic-data'});expected.push({reference:id,code:'missing_order',label:'required order absent'});}
  {const id=await operation('reversal','completed',1000,{topupId:'fin_absent'});await entry(id,'wallet',-1000);expected.push({reference:id,code:'missing_funding',label:'reversal missing original funding'});}
  {const id=await operation('review','manual_review',1000,{rewardId:'reward_synthetic'});expected.push({reference:id,code:'reversal_open',label:'unresolved reward reversal'});}

  for(const c of expected)await t.test(c.label,async()=>{const report=await FinanceReconciliationStore.report({reference:c.reference,filter:'all'});assert.equal(report.total,1,`${c.reference}: one canonical record`);assert.equal(report.rows[0]?.code,c.code);});
  await t.test('exact snapshot, bounded pagination, old/archived cases and duplicate history do not inflate counts',async()=>{
   const before=await FinanceReconciliationStore.report({filter:'all',limit:50});assert.equal(before.total,expected.length);
   const manualCase=expected.find(e=>e.label==='resolved manual history keeps failed')!;const o=(await OrdersStore.findOrder(manualCase.reference))!;
   for(let i=0;i<3;i++)await history(o,o.resolution_json);
   const first=await FinanceReconciliationStore.report({filter:'all',limit:25}),second=await FinanceReconciliationStore.report({filter:'all',limit:25,offset:25});assert.equal(first.total,before.total);assert.deepEqual(first.counts,before.counts);assert.equal(new Set([...first.rows,...second.rows].map(r=>r.key)).size,50);
   assert.equal((await FinanceReconciliationStore.report({reference:manualCase.reference})).rows[0].archived,true);
   assert.equal(Object.values(first.counts).reduce((a,b)=>a+b,0),first.total);
   const attention=await FinanceReconciliationStore.report({filter:'attention',limit:50});assert.equal(attention.filteredTotal,first.counts.needs_review+first.counts.evidence_unavailable);assert.ok(attention.rows.every(r=>r.requiresInvestigation));
  });
  await t.test('narrow output cannot expose customer contacts, raw provider bodies or private ledger details',async()=>{
   const report=await FinanceReconciliationStore.report({filter:'all',limit:50}),json=JSON.stringify(report);
   for(const forbidden of ['PRIVATE CUSTOMER','private-customer@fixture.test','0591111111','SENSITIVE_PROVIDER_BODY','SYNTHETIC_SECRET','Synthetic private ledger detail','SYNTHETIC-PAY-'])assert.ok(!json.includes(forbidden),forbidden);
  });
  await t.test('linked checkout, purchase, sale and refund IDs open their one canonical order',async()=>{
   const linked=(await db.query("SELECT DISTINCT ON(f.kind) f.id,f.kind,o.public_reference FROM finance_operations f JOIN orders o ON o.id=f.payload->>'orderId' WHERE f.kind IN ('direct_checkout','store_checkout','purchase','store_sale','refund') ORDER BY f.kind,f.id")).rows;
   assert.equal(linked.length,5);for(const f of linked){const report=await FinanceReconciliationStore.report({reference:f.id}),byOrder=await FinanceReconciliationStore.report({reference:f.public_reference});assert.equal(report.total,1,f.kind);assert.equal(report.rows[0].orderReference,f.public_reference);assert.deepEqual(report.counts,byOrder.counts);}
  });
  await t.test('registered synthetic provenance is excluded from counters but exact authorized history remains readable',async()=>{
   const before=await FinanceReconciliationStore.report({}),o=await order('registered synthetic fixture','test_record');
   await db.query("INSERT INTO order_test_fixtures(order_id,provenance) VALUES($1,'synthetic_no_gateway')",[o.id]);
   assert.equal((await FinanceReconciliationStore.report({})).total,before.total);
   const found=await FinanceReconciliationStore.report({reference:o.public_reference});assert.equal(found.total,1);assert.equal(found.rows[0].code,'test_record');assert.equal(found.counts.completed,0);
  });
  const snapshot=async()=>{const result:Record<string,string>={};for(const name of ['orders','finance_operations','finance_accounts','finance_ledger','reward_ledger','order_resolution_events','admin_audit_log'])result[name]=(await db.query(`SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'')) AS digest FROM ${name} t`)).rows[0].digest;return result;};
  await t.test('successful, concurrent and failing reads cannot mutate financial/order/history rows or contact providers',async()=>{
   const before=await snapshot(),originals=[PaystackServerService.initializeTransaction,FulfilmentService.processPaidOrder,FinanceService.refund];let calls=0;
   const forbidden=async()=>{calls++;throw Error('Reporting must not call a financial provider');};
   PaystackServerService.initializeTransaction=forbidden as any;FulfilmentService.processPaidOrder=forbidden as any;FinanceService.refund=forbidden as any;
   try{await Promise.all(Array.from({length:7},()=>FinanceReconciliationStore.report({filter:'attention'})));
    const blocker=await observer.connect();try{await blocker.query('BEGIN');await blocker.query('LOCK TABLE orders IN ACCESS EXCLUSIVE MODE');await assert.rejects(FinanceReconciliationStore.report({}),e=>e instanceof Error&&e.message.includes('No records were changed'));}finally{await blocker.query('ROLLBACK');blocker.release();}
    assert.equal(calls,0);assert.deepEqual(await snapshot(),before);
    assert.equal((await db.query("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity")).rows[0].count,'0');
   }finally{[PaystackServerService.initializeTransaction,FulfilmentService.processPaidOrder,FinanceService.refund]=originals as any;}
  });
  await t.test('read-only transaction, deadlines and connection reuse are enforced',async()=>{
   const original=db.connect,statements:string[]=[];let released=0;
   db.connect=(async()=>{const c=await (original as any).call(db),query=c.query,release=c.release;c.query=((sql:any,...args:any[])=>{statements.push(String(sql));return (query as any).call(c,sql,...args);}) as any;c.release=(...args:any[])=>{released++;c.query=query;c.release=release;return release.apply(c,args as any);};return c;}) as any;
   try{await FinanceReconciliationStore.report({});assert.equal(statements[0],'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.ok(statements.some(s=>s.includes("statement_timeout='2500ms'")));assert.ok(statements.some(s=>s.includes("lock_timeout='500ms'")));assert.equal(statements.filter(s=>s.startsWith('\nWITH')).length,1);assert.equal(released,1);}finally{db.connect=original;}
  });
  await t.test('query plans execute on native PostgreSQL without new indexes or DDL',async()=>{
   const plan=(await db.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+FINANCE_RECONCILIATION_SQL,[null,'attention',25,0])).rows[0]['QUERY PLAN'][0];assert.ok(plan['Execution Time']<2000);console.log(`Native reconciliation plan: ${plan['Execution Time']}ms; one on-demand snapshot, ${expected.length} synthetic records.`);
  });
 }finally{await getPool()?.end();await observer.end();delete process.env.DATABASE_URL;delete process.env.DATABASE_SSL;delete process.env.MYSTERY_TEST_DATABASE_OPT_IN;}
});
