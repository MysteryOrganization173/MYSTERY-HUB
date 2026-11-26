/** Explicitly opted-in NEW disposable loopback database only; never loads an application .env. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {getPool,initDatabase} from '../../db/connection.js';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {AuthStore} from '../../db/authStore.js';
import {WebsiteStore} from '../../db/websiteStore.js';
import {WebsiteBusinessService as Business} from '../../services/websiteBusinessService.js';
import {FulfilmentService} from '../../services/fulfilmentService.js';
import {PaystackServerService} from '../../services/paystackService.js';
import {FinanceStore} from '../../db/financeStore.js';
import {AUTHORITATIVE_PRODUCTS} from '../../data/productCatalog.js';
import {STORE_POLICY_DEFAULTS} from '../../../shared/storeEconomics.js';
import {opsOrder} from './adminOperationsFixtures.js';
import {OrdersStore} from '../../db/ordersStore.js';

const url=process.env.MYSTERY_V51_POSTGRES_URL;
test('V5.1 native pricing/publication integrity with five application connections',{skip:!url,timeout:60000},async t=>{
 assert.equal(process.env.DATABASE_URL,undefined);assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
 const observer=new pg.Pool({connectionString:url,ssl:false,max:1});let pool:pg.Pool|null=null;
 try{
  assert.equal((await observer.query("SELECT to_regclass('public.users') AS name")).rows[0].name,null,'New empty synthetic database required');
  process.env.DATABASE_URL=url;process.env.DATABASE_SSL='false';process.env.MYSTERY_TEST_DATABASE_OPT_IN='true';pool=getPool()!;assert.equal(pool.options.max,5);await initDatabase();await initDatabase();
  for(const id of ['owner','other','legacy'])await AuthStore.createUser({id,name:id,email:`${id}@fixture.test`,phone:null,passwordHash:'fixture',role:'customer'});
  const site=(await WebsiteStore.createSite('owner',{template_id:'tmpl-data-reseller',name:'Synthetic store'})).site;
  const products=Object.values(AUTHORITATIVE_PRODUCTS).filter(p=>p.isActive);
  await FinanceStore.transaction('owner',async tx=>{await tx.saveConfig('store-policy',{...STORE_POLICY_DEFAULTS,enabled:true,reserveBps:300,reserveFixedMinor:10,version:'fixture'});await tx.saveConfig('store-wholesale',Object.fromEntries(products.map(p=>[p.id,{enabled:true,wholesaleMinor:300}])));});
  await t.test('five simultaneous versioned saves use five connections, one winner, no leaks',{timeout:10000},async()=>{
   const results=await Promise.allSettled(Array.from({length:5},()=>Business.savePrices(site.id,'owner',{expectedVersion:'empty',products:products.map(p=>({productId:p.id,retailMinor:500,enabled:true}))})));
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
   for(const r of results)if(r.status==='rejected')assert.equal(r.reason.status,409);
   assert.equal((await Business.catalog(site.id,'owner')).products.filter(p=>p.eligible).length,products.length);assert.equal(pool!.waitingCount,0);
  });
  await t.test('invalid final row rolls back the complete mixed activation/price batch',async()=>{
   const before=await Business.catalog(site.id,'owner'),audit=(await observer.query('SELECT count(*) FROM admin_audit_log')).rows[0].count;
   await assert.rejects(Business.savePrices(site.id,'owner',{expectedVersion:before.version,products:[{productId:products[0].id,retailMinor:600,enabled:false},{productId:products[1].id,retailMinor:1,enabled:true}]}),/minimum/);
   assert.deepEqual(await Business.catalog(site.id,'owner'),before);assert.equal((await observer.query('SELECT count(*) FROM admin_audit_log')).rows[0].count,audit);
  });
  await t.test('audit failure rolls back otherwise-valid config update on the same transaction',async()=>{
   const before=await Business.catalog(site.id,'owner');await observer.query("CREATE FUNCTION reject_v51_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='store_prices_changed' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER v51_audit_failure BEFORE INSERT ON admin_audit_log FOR EACH ROW EXECUTE FUNCTION reject_v51_audit()");
   try{await assert.rejects(Business.savePrices(site.id,'owner',{expectedVersion:before.version,products:[{productId:products[0].id,retailMinor:600,enabled:false}]}),/Synthetic audit failure/);assert.deepEqual(await Business.catalog(site.id,'owner'),before);}finally{await observer.query('DROP TRIGGER v51_audit_failure ON admin_audit_log; DROP FUNCTION reject_v51_audit()');}
  });
  await t.test('five approved storefronts initialize with five connections and durable intent locks',{timeout:10000},async sub=>{
   const fixtureIds=['buyer-owner-1','buyer-owner-2','buyer-owner-3','buyer-owner-4','buyer-owner-5'];
   const product=products[0];
   const live=await Promise.all(fixtureIds.map(async owner=>{
    await AuthStore.createUser({id:owner,name:owner,email:`${owner}@fixture.test`,phone:null,passwordHash:'fixture',role:'customer'});
    const draft=(await WebsiteStore.createSite(owner,{template_id:'tmpl-data-reseller',name:owner,content:{whatsapp:'0241234567'}})).site;
    await Business.savePrices(draft.id,owner,{expectedVersion:'empty',products:[{productId:product.id,retailMinor:500,enabled:true}]});
    const published=await WebsiteStore.publishSite(draft.id,owner);
    assert.ok(published);
    return published;
   }));
   await FinanceStore.transaction('owner',async tx=>{
    const costs=await tx.config('store-wholesale');
    await tx.saveConfig('store-wholesale',{...costs,[product.id]:{...costs[product.id],version:'fixture'}});
   });
   const previousFlag=process.env.MANAGED_DATA_STOREFRONT_CHECKOUT_ENABLED;
   process.env.MANAGED_DATA_STOREFRONT_CHECKOUT_ENABLED='true';
   const previousKey=process.env.PAYSTACK_SECRET_KEY;
   delete process.env.PAYSTACK_SECRET_KEY;
   sub.after(()=>{
    if(previousFlag===undefined)delete process.env.MANAGED_DATA_STOREFRONT_CHECKOUT_ENABLED;else process.env.MANAGED_DATA_STOREFRONT_CHECKOUT_ENABLED=previousFlag;
    if(previousKey===undefined)delete process.env.PAYSTACK_SECRET_KEY;else process.env.PAYSTACK_SECRET_KEY=previousKey;
   });
   sub.mock.method(globalThis,'fetch',async()=>assert.fail('network forbidden in PostgreSQL fixture'));
   sub.mock.method(FulfilmentService,'preflightCheck',async()=>({allowed:true,supplierCostMinor:200,supplierOfferRef:'fixture'}));
   const adapter=sub.mock.method(PaystackServerService,'initializeManagedDataStoreTransaction');
   const input=()=>({productId:product.id,recipientPhone:'0241111111',customerEmail:'receipt@fixture.test',requestId:randomUUID(),expectedMinor:500});
   const attempts=live.map(website=>({website,details:input()}));
   const receipts=await Promise.all(attempts.map(({website,details})=>Business.initialize(website.id,details)));
   assert.equal(adapter.mock.callCount(),5);
   assert.equal(new Set(receipts.map(receipt=>receipt.reference)).size,5);
   assert.ok(receipts.every(receipt=>receipt.amountPesewas===500&&receipt.isSimulated));
   assert.equal((await Business.initialize(attempts[0].website.id,attempts[0].details)).reference,receipts[0].reference);
   assert.equal(adapter.mock.callCount(),5);
   assert.equal(Number((await observer.query("SELECT count(*) FROM finance_operations WHERE kind='store_checkout' AND state='pending'")).rows[0].count),5);
   assert.equal(pool!.waitingCount,0);
  });
  await t.test('paid order snapshot and financial records survive pricing changes',async()=>{
   const order=opsOrder({id:'v51-paid',user_id:'other',payment_reference:'v51-paid',public_reference:'MH-v51-paid',payment_status:'success',status:'delivered',store_context:{channel:'website_store',siteId:site.id,ownerId:'owner',retailMinor:500,wholesaleMinor:300,reserveMinor:25,earningMinor:175} as any});await OrdersStore.createOrder(order);
   const before=(await observer.query('SELECT * FROM orders ORDER BY id')).rows,money=(await observer.query('SELECT * FROM finance_ledger ORDER BY id')).rows,c=await Business.catalog(site.id,'owner');
   await Business.savePrices(site.id,'owner',{expectedVersion:c.version,products:[{productId:products[0].id,retailMinor:700,enabled:false}]});assert.deepEqual((await observer.query('SELECT * FROM orders ORDER BY id')).rows,before);assert.deepEqual((await observer.query('SELECT * FROM finance_ledger ORDER BY id')).rows,money);
  });
  await t.test('cross-owner pricing remains forbidden and draft catalogue remains private',async()=>{const before=await Business.catalog(site.id,'owner');await assert.rejects(Business.savePrices(site.id,'other',{expectedVersion:before.version,products:[]}),/not found|own/i);await assert.rejects(Business.catalog(site.id),/not found/i);assert.deepEqual(await Business.catalog(site.id,'owner'),before);});
  await t.test('server contact enforcement, publication rollback, legacy compatibility and unpublish',async()=>{
   let s=(await WebsiteStore.createSite('legacy',{template_id:'tmpl-boutique',name:'Legacy synthetic',content:{items:[]}})).site;
   await assert.rejects(WebsiteStore.publishSite(s.id,'legacy',s.updated_at),/WhatsApp/);assert.equal((await WebsiteStore.findSiteById(s.id))!.status,'draft');
   s=(await WebsiteStore.updateSite(s.id,'legacy',{expectedUpdatedAt:s.updated_at,content:{whatsapp:'0241234567'}}))!;s=(await WebsiteStore.publishSite(s.id,'legacy',s.updated_at))!;
   // Model an actual pre-V5.1 published row, not a client-supplied exemption.
   await observer.query("UPDATE website_sites SET content_json=content_json-'whatsapp',published_snapshot_json=jsonb_set(published_snapshot_json,'{content}',(published_snapshot_json->'content')-'whatsapp') WHERE id=$1",[s.id]);
   s=(await WebsiteStore.findSiteById(s.id))!;assert.ok(await WebsiteStore.publishSite(s.id,'legacy',s.updated_at));
   const live=await WebsiteStore.findPublishedSiteBySlug(s.slug);s=(await WebsiteStore.updateSite(s.id,'legacy',{expectedUpdatedAt:(await WebsiteStore.findSiteById(s.id))!.updated_at,content:{tagline:'Changed menu headline'}}))!;
   await assert.rejects(WebsiteStore.publishSite(s.id,'legacy',s.updated_at),/WhatsApp/);assert.deepEqual((await WebsiteStore.findPublishedSiteBySlug(s.slug))!.content_json,live!.content_json);
   s=(await WebsiteStore.unpublishSite(s.id,'legacy',s.updated_at))!;await assert.rejects(WebsiteStore.publishSite(s.id,'legacy',s.updated_at),/WhatsApp/);assert.equal(await WebsiteStore.findPublishedSiteBySlug(s.slug),null);
  });
 }finally{await pool?.end();await observer.end();delete process.env.DATABASE_URL;delete process.env.DATABASE_SSL;delete process.env.MYSTERY_TEST_DATABASE_OPT_IN;}
});
