/** Website Builder V5: deletion as an archive, fresh re-creation, unique identities and template naming. Memory only. */
import assert from 'node:assert/strict';
import {test,before,after,beforeEach} from 'node:test';
import express from 'express';
import {randomUUID} from 'node:crypto';
import type {Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {apiRouter} from '../../routes/api.js';
import {adminRouter} from '../../routes/adminApi.js';
import {WebsiteBusinessService as Business} from '../../services/websiteBusinessService.js';
import {WebsiteDeletionService, DELETION_PENDING_PAYMENT_WINDOW_MS} from '../../services/websiteDeletion.js';
import {WebsiteStore} from '../../db/websiteStore.js';
import {WebsiteAssetStore} from '../../db/websiteAssetStore.js';
import {WebsiteAnalyticsStore} from '../../db/websiteAnalyticsStore.js';
import {FinanceStore} from '../../db/financeStore.js';
import {AuthStore} from '../../db/authStore.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {ReferralStore} from '../../db/referralStore.js';
import {PaystackServerService} from '../../services/paystackService.js';
import {FulfilmentService} from '../../services/fulfilmentService.js';
import {WEBSITE_TEMPLATES, findTemplateByLink, templateDesignLabel, LEGACY_TEMPLATE_TITLE_SLUGS} from '../../../src/data/templates.js';
import {mergeSiteWithTemplate, getTemplateById} from '../../../src/utils/templateRendererUtils.js';
import {deletionNameMatches, forgetDeletedWebsite, isDeletedWebsite, withoutDeletedWebsites, websiteBrowserKeys} from '../../../src/utils/websiteDeletion.js';
import {WEBSITE_STARTER_VERSION} from '../../../src/config/websiteStarters.js';

const originals={fetch:globalThis.fetch,init:PaystackServerService.initializeTransaction,verify:PaystackServerService.verifyTransaction,preflight:FulfilmentService.preflightCheck,rawCatalog:FulfilmentService.getProvider().getRawCatalog,resolve:FulfilmentService.getProvider().resolvePackage};
let server:Server,base:string,transaction:any;
before(async()=>{assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.DATABASE_URL,undefined);const app=express();app.use(express.json());app.use('/api',apiRouter);app.use('/api/admin',adminRouter);server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
after(async()=>{globalThis.fetch=originals.fetch;PaystackServerService.initializeTransaction=originals.init;PaystackServerService.verifyTransaction=originals.verify;FulfilmentService.preflightCheck=originals.preflight;FulfilmentService.getProvider().resolvePackage=originals.resolve;FulfilmentService.getProvider().getRawCatalog=originals.rawCatalog;await new Promise<void>(r=>server.close(()=>r()));});
beforeEach(async()=>{
  FinanceStore._reset();WebsiteStore.clearDevStore();WebsiteAssetStore.clearDevStore();WebsiteAnalyticsStore.clearDevStore();OrdersStore.clearDevStore();AuthStore._clearDevStore();ReferralStore._clearDevStore();process.env.PAYSTACK_SECRET_KEY='sk_test_fixture';
  for(const role of ['owner','other','admin']){await AuthStore.createUser({id:role,name:role,email:`${role}@fixture.test`,phone:null,passwordHash:'fixture-only',role:role==='admin'?'admin':'customer'});await AuthStore.createSession(role,`${role}-token`);}
  globalThis.fetch=async()=>{throw Error('External network forbidden');};
  FulfilmentService.getProvider().getRawCatalog=async()=>[];
  FulfilmentService.getProvider().resolvePackage=async()=>({resolved:{supplierCostMinor:200,offerSlug:'fixture',sizeLabel:'1GB',network:'mtn'} as any});
  FulfilmentService.preflightCheck=async()=>({allowed:true,supplierCostMinor:200});
  PaystackServerService.initializeTransaction=async params=>{transaction=params;return {success:true,reference:params.reference,accessCode:'fixture-access',authorizationUrl:'https://checkout.paystack.com/fixture'};};
  PaystackServerService.verifyTransaction=async reference=>({isVerified:true,status:'success',reference,amountPesewas:transaction.amountPesewas,currency:'GHS',metadata:transaction.metadata});
});
const request=(path:string,method='GET',body?:unknown,token='')=>originals.fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
const createB1=(token:string,templateId:string,businessName:string)=>request('/api/websites','POST',{templateId,businessName,starterVersion:WEBSITE_STARTER_VERSION},token);
/** The founder's case: a website first made from the Kitchen sample, renamed, then switched to the Data design. */
async function founderSite(publish=true){
  let site=(await WebsiteStore.createSite('owner',{template_id:'tmpl-data-reseller',name:'Gold Coast Artisan Kitchen'})).site;
  site=(await WebsiteStore.updateSite(site.id,'owner',{name:'MYSTERY TEST hub',content:{businessName:'MYSTERY TEST hub'},expectedUpdatedAt:site.updated_at}))!;
  if(publish)site=(await WebsiteStore.publishSite(site.id,'owner',site.updated_at))!;
  return site;
}
async function configure(siteId:string){await Business.savePolicy('admin',{confirmed:true,expectedVersion:'unconfigured',enabled:true,reserveBps:300,reserveFixedMinor:10,withdrawalMinimumMinor:500,withdrawalFeeBps:300});await Business.saveWholesale('admin',{confirmed:true,expectedVersion:'empty',productId:'mtn-1gb',wholesaleMinor:300,enabled:true});await Business.savePrices(siteId,'owner',{expectedVersion:'empty',products:[{productId:'mtn-1gb',retailMinor:500,enabled:true}]});}
const checkoutBody=()=>({productId:'mtn-1gb',recipientPhone:'0241111111',customerEmail:'receipt@fixture.test',requestId:randomUUID()});
const del=(siteId:string,confirmation:string,token='owner-token')=>request(`/api/websites/${siteId}`,'DELETE',{confirmation},token);

test('owner last-four search covers all pages, stays site-bound, masks numbers and rejects invalid queries',async()=>{
  const site=await founderSite();await configure(site.id);await Business.initialize(site.id,checkoutBody());
  const source=OrdersStore.adminDevOrders()[0];
  for(let i=0;i<29;i++)await OrdersStore.createOrder({...source,id:`ord-search-${i}`,public_reference:`MH-search-${i}`,payment_reference:`search-${i}`,recipient_phone:i===28?'0242229876':'0243331111',created_at:new Date(Date.now()-i*1000).toISOString(),store_context:{...source.store_context!,siteId:i===27?'another-site':site.id}});
  const response=await request(`/api/websites/${site.id}/business?lastFour=9876`,'GET',undefined,'owner-token');assert.equal(response.status,200);
  const {data}=await response.json();assert.equal(data.orders.length,1);assert.equal(data.orders[0].id,'ord-search-28');assert.ok(data.capabilities.hasStoreHistory);assert.ok(!JSON.stringify(data).includes('0242229876'));
  assert.ok(data.orders[0].recipient.endsWith('9876'));
  for(const query of ['123','12345','abcd',"1234%27",'1234&lastFour=5678'])assert.equal((await request(`/api/websites/${site.id}/business?lastFour=${query}`,'GET',undefined,'owner-token')).status,400);
  for(const [token,status] of [['',401],['other-token',403]] as const)assert.equal((await request(`/api/websites/${site.id}/business?lastFour=9876`,'GET',undefined,token)).status,status);
  const page=await (await request(`/api/websites/${site.id}/business?lastFour=1111&offset=25`,'GET',undefined,'owner-token')).json();assert.ok(page.data.orders.length>0&&page.data.orders.length<25);assert.ok(!page.data.orders.some((o:any)=>o.id==='ord-search-27'));
});

test('store earnings use gross withdrawal totals, include approved reservations, and retain historical lifetime',async()=>{
  await FinanceStore.transaction('owner',async tx=>{
    const sale=await tx.create('store_sale','definition-sale',1000,{availableAt:'2026-10-21'},'available');await tx.append(sale,'store',1000,'fixture');
    for(const [key,state,amount] of [['review','pending_review',100],['approved','approved',200],['paid','paid',300]] as const){const w=await tx.create('withdrawal',key,amount,{source:'store',feeMinor:10,netMinor:amount-10},state);await tx.append(w,'store',-amount,'fixture');}
    await tx.create('store_sale','pending-sale',50,{},'pending');
    await tx.update(sale,'reversed');
  });
  const e=await FinanceStore.read('owner',tx=>tx.storeEarnings());
  assert.deepEqual({available:e.availableMinor,pending:e.pendingMinor,reserved:e.reservedMinor,withdrawn:e.withdrawnMinor,lifetime:e.lifetimeMinor},{available:400,pending:50,reserved:300,withdrawn:300,lifetime:1000});
});
const financialState=()=>JSON.stringify({orders:OrdersStore.adminDevOrders().map(o=>({id:o.id,status:o.status,payment_status:o.payment_status,amount:o.amount,store_context:o.store_context})).sort((a,b)=>a.id.localeCompare(b.id))});

test('founder journey: the check names the exact website, deletion archives it and frees the Free slot',async()=>{
  const site=await founderSite();assert.equal(site.slug,'gold-coast-artisan-kitchen');
  const check=await (await request(`/api/websites/${site.id}/deletion-check`,'GET',undefined,'owner-token')).json();
  assert.equal(check.site.name,'MYSTERY TEST hub');assert.equal(check.site.slug,'gold-coast-artisan-kitchen');assert.equal(check.site.published,true);
  assert.equal(check.site.publicUrl,'https://mysterybundlehub.com/sites/gold-coast-artisan-kitchen');assert.deepEqual(check.blockers,[]);assert.equal(check.canDelete,true);
  const response=await del(site.id,'mystery test HUB');assert.equal(response.status,200);assert.equal((await response.json()).alreadyDeleted,false);
  assert.deepEqual((await (await request('/api/websites/mine','GET',undefined,'owner-token')).json()).sites,[]);
  assert.equal((await request(`/api/websites/${site.id}`,'GET',undefined,'owner-token')).status,404);
  const record=await WebsiteStore.findSiteRecordById(site.id);assert.equal(record?.status,'archived');assert.ok(record?.published_snapshot_json,'live snapshot kept for staff history');
});

test('founder journey: a new template and a new name create a new site ID and slug that inherit nothing',async()=>{
  const old=await founderSite();await del(old.id,'MYSTERY TEST hub');
  const response=await createB1('owner-token','tmpl-buka-bistro','Esi Kitchen');assert.equal(response.status,201);const {site,alreadyExists}=await response.json();
  assert.equal(alreadyExists,false);assert.notEqual(site.id,old.id);assert.equal(site.slug,'esi-kitchen');assert.equal(site.template_id,'tmpl-buka-bistro');assert.equal(site.status,'draft');
  const text=JSON.stringify(site);for(const leaked of ['MYSTERY TEST hub','gold-coast-artisan-kitchen',old.id])assert.doesNotMatch(text,new RegExp(leaked,'i'));
  assert.equal((await WebsiteAssetStore.forSite(site.id)).length,0);
});

test('a deleted address is never reassigned, even to the same business name or another account',async()=>{
  const old=await founderSite();await del(old.id,'MYSTERY TEST hub');
  const again=(await (await createB1('owner-token','tmpl-data-reseller','Gold Coast Artisan Kitchen')).json()).site;assert.notEqual(again.slug,'gold-coast-artisan-kitchen');assert.match(again.slug,/^gold-coast-artisan-kitchen-/);
  const other=(await (await createB1('other-token','tmpl-data-reseller','Gold Coast Artisan Kitchen')).json()).site;assert.notEqual(other.slug,'gold-coast-artisan-kitchen');assert.notEqual(other.slug,again.slug);
  assert.equal((await request('/api/public/sites/gold-coast-artisan-kitchen')).status,410);
});

test('the deleted public address is a neutral closed page: no name, branding, contacts or redirect',async()=>{
  const old=await founderSite();await WebsiteStore.updateSite(old.id,'owner',{content:{whatsapp:'0245550101',tagline:'Secret tagline'},expectedUpdatedAt:(await WebsiteStore.findSiteById(old.id))!.updated_at});await del(old.id,'MYSTERY TEST hub');
  const response=await request('/api/public/sites/gold-coast-artisan-kitchen',);assert.equal(response.status,410);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.redirected,false);
  const body=await response.json();assert.equal(body.closed,true);assert.equal(body.orderTracking,null);for(const leaked of ['MYSTERY','0245550101','Secret','tmpl-','owner'])assert.doesNotMatch(JSON.stringify(body),new RegExp(leaked));
  assert.equal((await request('/api/public/sites/never-existed')).status,404);
});

test('typed confirmation and ownership are enforced; nothing changes on refusal',async()=>{
  const site=await founderSite();
  for(const [confirmation,token,status] of [['wrong name','owner-token',400],['','owner-token',400],['MYSTERY TEST hub','other-token',403],['MYSTERY TEST hub','bad-token',401],['MYSTERY TEST hub','',401]] as const)assert.equal((await del(site.id,confirmation,token)).status,status);
  assert.equal((await WebsiteStore.findSiteById(site.id))?.status,'published');
  assert.equal((await request(`/api/websites/${site.id}/deletion-check`,'GET',undefined,'other-token')).status,403);
  await del(site.id,'MYSTERY TEST hub');assert.equal((await del(site.id,'MYSTERY TEST hub','other-token')).status,404,'an archived website of another owner is not revealed');
});

test('deletion is idempotent and retry-safe, including concurrent requests; one lifecycle event is recorded',async()=>{
  const site=await founderSite();
  const results=await Promise.all([del(site.id,'MYSTERY TEST hub'),del(site.id,'MYSTERY TEST hub')]);
  assert.deepEqual(results.map(r=>r.status),[200,200]);const bodies=await Promise.all(results.map(r=>r.json()));assert.equal(bodies.filter(b=>b.alreadyDeleted).length,1);
  const retry=await del(site.id,'MYSTERY TEST hub');assert.equal(retry.status,200);assert.equal((await retry.json()).alreadyDeleted,true);
  assert.equal((await WebsiteAnalyticsStore.events(null)).filter(e=>e.event_name==='website_deleted').length,1);
});

test('an order still being delivered blocks deletion and explains why; nothing is changed',async()=>{
  const site=await founderSite();await configure(site.id);const payment=await Business.initialize(site.id,checkoutBody());await FulfilmentService.processPaidOrder(payment.reference,new Date().toISOString());
  const check=await (await request(`/api/websites/${site.id}/deletion-check`,'GET',undefined,'owner-token')).json();assert.equal(check.canDelete,false);assert.ok(check.blockers.some((b:any)=>b.code==='orders_in_progress'));
  const before=financialState();const response=await del(site.id,'MYSTERY TEST hub');assert.equal(response.status,409);const body=await response.json();assert.equal(body.code,'WEBSITE_DELETION_BLOCKED');assert.ok(body.blockers.length);
  assert.equal((await WebsiteStore.findSiteById(site.id))?.status,'published');assert.equal(financialState(),before);
});

test('an unfinished payment still blocks after 24 hours without provider-confirmed expiry',async()=>{
  const site=await founderSite();await configure(site.id);await Business.initialize(site.id,checkoutBody());
  assert.ok((await WebsiteDeletionService.check(site)).blockers.some(b=>b.code==='payment_pending'));
  await assert.rejects(()=>WebsiteDeletionService.archive(site.id,'owner','MYSTERY TEST hub'),/unfinished payment/);
  const later=Date.now()+DELETION_PENDING_PAYMENT_WINDOW_MS+60_000;assert.ok((await WebsiteDeletionService.check(site,later)).blockers.some(b=>b.code==='payment_pending'));
});

test('store earnings that are pending or available block deletion, because withdrawal needs the website',async()=>{
  const site=await founderSite();await configure(site.id);const payment=await Business.initialize(site.id,checkoutBody());await FulfilmentService.processPaidOrder(payment.reference,new Date().toISOString());
  const order=(await OrdersStore.findOrder(payment.reference))!;await OrdersStore.updateOrderStatus(order.id,'delivered',undefined,'fixture-supplier');await Business.ownerSummary(site.id,'owner');
  const earnings=await FinanceStore.read('owner',tx=>tx.storeEarnings());assert.ok(earnings.pendingMinor+earnings.availableMinor>0,'fixture produced store earnings');
  const blockers=(await WebsiteDeletionService.check(site)).blockers;assert.ok(blockers.some(b=>['earnings_pending','earnings_available'].includes(b.code)));assert.ok(!blockers.some(b=>b.code==='orders_in_progress'));
  const before=JSON.stringify(await FinanceStore.read('owner',tx=>tx.ledger()));assert.equal((await del(site.id,'MYSTERY TEST hub')).status,409);assert.equal(JSON.stringify(await FinanceStore.read('owner',tx=>tx.ledger())),before);
});

test('after deletion past buyers can still track orders, new purchases are refused and records are untouched',async()=>{
  const site=await founderSite();await configure(site.id);const payment=await Business.initialize(site.id,checkoutBody());
  const order=(await OrdersStore.findOrder(payment.reference))!;await OrdersStore.updateOrderStatus(order.id,'expired');
  const before=financialState();const ledger=JSON.stringify(await FinanceStore.read('owner',tx=>tx.ledger()));
  await WebsiteDeletionService.archive(site.id,'owner','MYSTERY TEST hub');
  const closed=await (await request(`/api/public/sites/${site.slug}`)).json();assert.equal(closed.orderTracking.siteId,site.id);
  const tracked=await request(`/api/websites/${site.id}/store-orders/${order.public_reference}`);const trackedBody=await tracked.json();assert.equal(tracked.status,200,JSON.stringify(trackedBody));assert.equal(trackedBody.data.status,'expired');
  const attempt=await request(`/api/websites/${site.id}/store-checkout`,'POST',checkoutBody());assert.ok([404,409].includes(attempt.status));
  assert.equal(financialState(),before);assert.equal(JSON.stringify(await FinanceStore.read('owner',tx=>tx.ledger())),ledger);assert.equal(OrdersStore.adminDevOrders().length,1);
});

test('staff keep read access to a deleted website and its business records',async()=>{
  const site=await founderSite();await del(site.id,'MYSTERY TEST hub');
  const detail=await request(`/api/admin/website-builder/${site.id}`,'GET',undefined,'admin-token');assert.equal(detail.status,200);assert.equal((await detail.json()).site.status,'archived');
  const business=await request(`/api/admin/website-builder/${site.id}/business`,'GET',undefined,'admin-token');assert.equal(business.status,200,await business.text());
  assert.equal((await request(`/api/admin/website-builder/${site.id}`,'GET',undefined,'owner-token')).status,403);
});

test('deletion keeps media records: nothing referenced is destroyed and nothing moves to the new site',async()=>{
  const site=await founderSite();await del(site.id,'MYSTERY TEST hub');
  const next=(await (await createB1('owner-token','tmpl-makola-mart','New Shop')).json()).site;assert.equal((await WebsiteAssetStore.forSite(next.id)).length,0);
  assert.equal((await request(`/api/websites/${next.id}/assets`,'GET',undefined,'owner-token')).status,200);
});

test('two accounts on the same design are fully isolated (Journey F)',async()=>{
  const a=(await (await createB1('owner-token','tmpl-data-reseller','Kofi Connect')).json()).site,b=(await (await createB1('other-token','tmpl-data-reseller','Ama Data')).json()).site;
  assert.notEqual(a.id,b.id);assert.notEqual(a.slug,b.slug);assert.equal(a.template_id,b.template_id);
  assert.equal((await request(`/api/websites/${b.id}`,'PATCH',{content:{tagline:'Hijack'},expectedUpdatedAt:b.updated_at},'owner-token')).status,403);
  assert.equal((await request(`/api/websites/${b.id}`,'GET',undefined,'owner-token')).status,403);
  assert.equal((await del(b.id,'Ama Data','owner-token')).status,403);
  assert.equal((await WebsiteStore.findSiteById(b.id))?.content_json.tagline,b.content_json.tagline);
  for(const site of [a,b])assert.match(site.id,/^site_[0-9a-f-]{36}$/);
});

test('renaming a business never changes its address; addresses carry no private IDs',async()=>{
  const created=(await (await createB1('owner-token','tmpl-glow-salon','Nectar Studio')).json()).site;
  const renamed=await WebsiteStore.updateSite(created.id,'owner',{name:'Totally New Name',content:{businessName:'Totally New Name'},expectedUpdatedAt:created.updated_at});
  assert.equal(renamed?.slug,created.slug);assert.doesNotMatch(created.slug,/site_|owner|[0-9a-f]{8}-/);
});

test('shared name confirmation and browser cleanup used by the Danger Zone',()=>{
  const site={name:'Old name',slug:'old-name',content_json:{businessName:'  MYSTERY   TEST hub '}} as any;
  assert.ok(deletionNameMatches(site,'mystery test hub'));assert.ok(deletionNameMatches(site,'Old name'));assert.ok(deletionNameMatches(site,'old-name'));
  for(const typed of ['mystery test','','   ',null,'x'.repeat(201)])assert.equal(deletionNameMatches(site,typed),false);
  const removed:string[]=[];forgetDeletedWebsite('site_fixture',[{removeItem:key=>removed.push(key)}]);assert.deepEqual(removed,websiteBrowserKeys('site_fixture'));
  assert.ok(!removed.some(key=>key.startsWith('mh_store_checkout')),'a buyer checkout recovery key is never cleared');
  assert.ok(isDeletedWebsite('site_fixture'));assert.deepEqual(withoutDeletedWebsites([{id:'site_fixture'},{id:'site_new'}]),[{id:'site_new'}]);
});

test('template chrome never shows a real customer or sample business as the design name',()=>{
  for(const template of WEBSITE_TEMPLATES){assert.doesNotMatch(template.title,/QuickByte/i);assert.doesNotMatch(template.demoBusinessName,/QuickByte/i);}
  assert.equal(getTemplateById('tmpl-data-reseller').title,'Data Store');
  assert.equal(templateDesignLabel(getTemplateById('tmpl-data-reseller')),'Data Store design · Data & Telecom');
  assert.equal(new Set(WEBSITE_TEMPLATES.map(t=>t.title)).size,WEBSITE_TEMPLATES.length,'design names are unique');
});

test('old shared design links and legacy owner content keep working after the rename',()=>{
  for(const [slug,id] of Object.entries(LEGACY_TEMPLATE_TITLE_SLUGS))assert.equal(findTemplateByLink(slug)?.id,id);
  assert.equal(findTemplateByLink('tmpl-data-reseller')?.id,'tmpl-data-reseller');assert.equal(findTemplateByLink('data-reseller')?.id,'tmpl-data-reseller');assert.equal(findTemplateByLink('signal')?.id,'tmpl-data-reseller');assert.equal(findTemplateByLink('nope'),undefined);
  // An owner record that never stored a business name renders exactly as before the rename.
  assert.equal(mergeSiteWithTemplate(getTemplateById('tmpl-data-reseller'),{tagline:'x'} as any).demoBusinessName,'QuickByte Data');
  assert.equal(mergeSiteWithTemplate(getTemplateById('tmpl-data-reseller'),{businessName:'Kofi Connect'} as any).demoBusinessName,'Kofi Connect');
  assert.equal(getTemplateById('tmpl-data-reseller').demoBusinessName,'Your Data Store');
});

test('older gallery clients that send a sample name still create an unbranded website',async()=>{
  for(const name of ['QuickByte Data','Your Data Store']){WebsiteStore.clearDevStore();const {site}=await WebsiteStore.createSite('owner',{template_id:'tmpl-data-reseller',name});assert.equal(site.name,'My Business');assert.doesNotMatch(site.slug,/quickbyte/);}
});
