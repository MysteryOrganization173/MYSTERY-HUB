/** Opt-in standalone PostgreSQL fixtures only. Never loads application credentials. */
import assert from 'node:assert/strict';
import {before,after,beforeEach,test} from 'node:test';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {getPool,initDatabase} from '../../db/connection.js';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {AuthStore} from '../../db/authStore.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {FinanceStore} from '../../db/financeStore.js';
import {WebsiteBusinessService as Business} from '../../services/websiteBusinessService.js';
import {FulfilmentService} from '../../services/fulfilmentService.js';
import {opsOrder} from './adminOperationsFixtures.js';

const target=process.env.RESELLER_PRICING_TEST_DATABASE_URL;
const enabled=process.env.MYSTERY_RESELLER_PG_TEST==='true'&&Boolean(target);
let bootstrap:pg.Client,pool:pg.Pool;
const provider=FulfilmentService.getProvider(),original={raw:provider.getRawCatalog,fetch:globalThis.fetch};
let supplierCost=400;
const proposal=()=>({productIds:['mtn-1gb','mtn-2gb'],perGbMinor:450,discountFromGb:10,discountBps:0,activation:'enable'});
const snapshot=async()=>Object.fromEntries(await Promise.all(['users','orders','finance_accounts','finance_operations','finance_ledger','finance_config','admin_audit_log'].map(async table=>[table,(await pool.query(`SELECT * FROM ${table} ORDER BY id`.replace('finance_accounts ORDER BY id','finance_accounts ORDER BY user_id'))).rows])));
const protectedRows=(state:any)=>Object.fromEntries(Object.entries(state).filter(([key])=>!['finance_config','admin_audit_log'].includes(key)));
before(async()=>{
  if(!enabled)return;
  assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:target,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
  const url=new URL(target!);assert.match(url.pathname,/^\/mystery_reseller_pricing_\d+_test$/);assert.equal(url.search,'');
  bootstrap=new pg.Client({connectionString:target,ssl:false});await bootstrap.connect();
  assert.equal((await bootstrap.query("SELECT to_regclass('public.users') AS table_name")).rows[0].table_name,null,'Use a NEW empty disposable database, never restored or existing application data.');
  await bootstrap.query("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='reseller_owner') THEN CREATE ROLE reseller_owner LOGIN BYPASSRLS; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END $$; GRANT USAGE,CREATE ON SCHEMA public TO reseller_owner");
  await bootstrap.query(`GRANT CREATE ON DATABASE ${url.pathname.slice(1)} TO reseller_owner`);
  url.username='reseller_owner';url.password='';process.env.NODE_ENV='test';process.env.DATABASE_URL=url.href;process.env.DATABASE_SSL='false';process.env.MYSTERY_TEST_DATABASE_OPT_IN='true';
  pool=getPool()!;globalThis.fetch=async()=>{throw Error('External network forbidden in isolated reseller tests');};
  await initDatabase();
  assert.ok((await pool.query("SELECT to_regclass('mysteryhub_builder_private.website_draft_checkpoints') AS table_name")).rows[0].table_name,'All existing private Builder schema initialization must succeed');
  assert.equal((await pool.query('SELECT rolsuper FROM pg_roles WHERE rolname=current_user')).rows[0].rolsuper,false);
  for(const id of ['admin-a','admin-b','admin-c','seller','buyer'])await AuthStore.createUser({id,name:'Synthetic',email:id+'@example.test',phone:null,passwordHash:'fixture-only',role:id.startsWith('admin')?'admin':'customer'});
  for(const id of ['admin-a','admin-b'])await FinanceStore.transaction(id,async()=>{});
  await FinanceStore.transaction('seller',async tx=>{const topup=await tx.create('topup','fixture-funding',1000,{},'credited');await tx.append(topup,'wallet',1000,'Synthetic test funding');const sale=await tx.create('store_sale','fixture-sale',35,{},'available');await tx.append(sale,'store',35,'Synthetic test earning');});
  await OrdersStore.createOrder(opsOrder({user_id:'buyer',store_context:{channel:'website_store',siteId:'synthetic-site',ownerId:'seller',productId:'mtn-1gb',retailMinor:500,wholesaleMinor:430,reserveMinor:17,earningMinor:53,supplierCostMinor:400,currency:'GHS',policyVersion:'historical-policy',wholesaleVersion:'historical-wholesale',priceVersion:'historical-price'}}));
  provider.getRawCatalog=async fresh=>{assert.equal(fresh,true);return [{slug:'synthetic-mtn',name:'Synthetic MTN',kind:'data',network:'mtn',packages:[{sizeLabel:'1GB',priceMinor:supplierCost},{sizeLabel:'2GB',priceMinor:850}]}] as any;};
});
beforeEach(async()=>{
  if(!enabled)return;supplierCost=400;
  const version=randomUUID(),plan=(price:number,active:boolean)=>({wholesaleMinor:price,enabled:active,version:randomUUID(),actorId:'admin-a',updatedAt:'2026-10-18T00:00:00Z',supplierCostMinor:400});
  for(const [id,value] of Object.entries({'store-policy':{enabled:true,reserveBps:200,reserveFixedMinor:7,withdrawalMinimumMinor:500,withdrawalFeeBps:300,version},'store-wholesale':{'mtn-1gb':plan(430,true),'mtn-2gb':plan(900,false)},'store:synthetic-site':{version:'seller-original',products:{'mtn-1gb':{retailMinor:700,enabled:true}}}}))await pool.query('INSERT INTO finance_config(id,value) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET value=EXCLUDED.value',[id,JSON.stringify(value)]);
});
after(async()=>{
  if(!enabled)return;provider.getRawCatalog=original.raw;globalThis.fetch=original.fetch;await pool?.end();await bootstrap?.end();delete process.env.DATABASE_URL;delete process.env.DATABASE_SSL;delete process.env.MYSTERY_TEST_DATABASE_OPT_IN;
});
test('reseller PostgreSQL preview is read-only and preserves the configured two-percent reserve',{skip:!enabled},async()=>{
  const before=await snapshot(),preview=await Business.resellerBulkPreview('admin-a',proposal());assert.equal(preview.valid,true);assert.equal(preview.policy.reserveBps,200);assert.equal(preview.rows[1].supplierCostMinor,850);assert.deepEqual(await snapshot(),before);
});
test('separate PostgreSQL connections permit exactly one concurrent bulk apply and one audit',{skip:!enabled},async()=>{
  const previews=await Promise.all(['admin-a','admin-b'].map(actor=>Business.resellerBulkPreview(actor,proposal()))),before=await snapshot(),pids=new Set<number>();
  const query=pg.Client.prototype.query;
  pg.Client.prototype.query=function(this:pg.Client,...args:any[]){if(typeof args[0]==='string'&&args[0].includes('pg_advisory_xact_lock')&&args[1]?.[0]==='store-config')pids.add((this as any).processID);return (query as any).apply(this,args);} as any;
  let results:PromiseSettledResult<unknown>[];
  try{results=await Promise.allSettled([0,1,0].map(i=>Business.resellerBulkApply(i?'admin-b':'admin-a',{confirmed:true,revision:previews[i].revision,proposal:proposal()})));}finally{pg.Client.prototype.query=query;}
  assert.ok(pids.size>=2,'Competing applications must use independent PostgreSQL connections');assert.equal(results!.filter(x=>x.status==='fulfilled').length,1);
  const next=await snapshot();assert.equal((next.admin_audit_log as any[]).length,(before.admin_audit_log as any[]).length+1);
  const audit=(next.admin_audit_log as any[]).find(x=>!(before.admin_audit_log as any[]).some(old=>old.id===x.id));assert.equal(JSON.parse(audit.metadata_safe_json).changes.length,2);
  assert.deepEqual(protectedRows(next),protectedRows(before));assert.deepEqual(await FinanceStore.readConfig('store:synthetic-site'),{version:'seller-original',products:{'mtn-1gb':{retailMinor:700,enabled:true}}});
  assert.deepEqual(await FinanceStore.readConfig('store-policy'),(before.finance_config as any[]).find(x=>x.id==='store-policy').value);
});
for(const table of ['finance_config','admin_audit_log'])test(`PostgreSQL ${table} failure rolls back config, account creation, audit and historical rows`,{skip:!enabled},async()=>{
  const preview=await Business.resellerBulkPreview('admin-c',proposal()),before=await snapshot();
  await pool.query(`CREATE FUNCTION reseller_test_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected reseller write failure'; END $$; CREATE TRIGGER reseller_test_reject BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION reseller_test_reject()`);
  try{await assert.rejects(()=>Business.resellerBulkApply('admin-c',{confirmed:true,revision:preview.revision,proposal:proposal()}),/Injected reseller write failure/);assert.deepEqual(await snapshot(),before);}finally{await pool.query(`DROP TRIGGER reseller_test_reject ON ${table}; DROP FUNCTION reseller_test_reject()`);}
});
test('PostgreSQL stale supplier costs and policy revisions fail without writes',{skip:!enabled},async()=>{
  const input=proposal(),preview=await Business.resellerBulkPreview('admin-a',input);supplierCost=401;let before=await snapshot();await assert.rejects(()=>Business.resellerBulkApply('admin-a',{confirmed:true,revision:preview.revision,proposal:input}),/changed/);assert.deepEqual(await snapshot(),before);
  supplierCost=400;await pool.query("UPDATE finance_config SET value=jsonb_set(value,'{version}','\"new-policy\"') WHERE id='store-policy'");before=await snapshot();await assert.rejects(()=>Business.resellerBulkApply('admin-a',{confirmed:true,revision:preview.revision,proposal:input}),/changed/);assert.deepEqual(await snapshot(),before);
});
test('PostgreSQL activation-only changes no price, seller setting, historical record or reserve',{skip:!enabled},async()=>{
  const input={...proposal(),perGbMinor:null,activation:'disable'},before=await snapshot(),preview=await Business.resellerBulkPreview('admin-a',input);assert.equal(preview.changeCount,1);
  assert.equal((await Business.resellerBulkApply('admin-a',{confirmed:true,revision:preview.revision,proposal:input})).applied,1);
  const old=(before.finance_config as any[]).find(x=>x.id==='store-wholesale').value,next=await FinanceStore.readConfig('store-wholesale');for(const id of Object.keys(old))assert.equal(next[id].wholesaleMinor,old[id].wholesaleMinor);assert.deepEqual(next['mtn-2gb'],old['mtn-2gb']);assert.deepEqual(protectedRows(await snapshot()),protectedRows(before));
  assert.deepEqual(await FinanceStore.readConfig('store-policy'),(before.finance_config as any[]).find(x=>x.id==='store-policy').value);
});
test('PostgreSQL simultaneous manual and bulk edits cannot silently overwrite each other',{skip:!enabled},async()=>{
  const input=proposal(),preview=await Business.resellerBulkPreview('admin-a',input),costs=await FinanceStore.readConfig('store-wholesale');
  const results=await Promise.allSettled([Business.resellerBulkApply('admin-a',{confirmed:true,revision:preview.revision,proposal:input}),Business.saveWholesale('admin-b',{confirmed:true,productId:'mtn-1gb',expectedVersion:costs['mtn-1gb'].version,wholesaleMinor:460,enabled:true})]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
});
test('PostgreSQL repeat schema initialization preserves all seeded financial and customer rows',{skip:!enabled},async()=>{
  const before=await snapshot();await initDatabase();await initDatabase();assert.deepEqual(await snapshot(),before);
});
