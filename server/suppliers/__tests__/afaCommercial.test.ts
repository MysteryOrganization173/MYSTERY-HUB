import assert from 'node:assert/strict';
import {test,before,after,beforeEach,afterEach} from 'node:test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import express from 'express';
import type {Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {AfaStore} from '../../db/afaStore.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {AuthStore} from '../../db/authStore.js';
import {AdminAuditStore} from '../../db/adminAuditStore.js';
import {FinanceStore} from '../../db/financeStore.js';
import {FinanceService} from '../../services/financeService.js';
import {AfaService} from '../../services/afaService.js';
import {CommercialService as C} from '../../services/commercialService.js';
import {FulfilmentService} from '../../services/fulfilmentService.js';
import {PaystackServerService} from '../../services/paystackService.js';
import {SuccessBizHubProvider} from '../successBizHub/provider.js';
import {apiRouter} from '../../routes/api.js';
import {adminRouter} from '../../routes/adminApi.js';
import {toSafePublicOrder} from '../../types/orders.js';
import {AFA_PRICING_DEFAULT,AFA_CAMPAIGN_ACTIVATION,AFA_COST_CONFIRMATION,afaRequestMatchesQuote,savingPercent,normalizeAfaPricing} from '../../../shared/afaPricing.js';
import {DIRECT_CAMPAIGN_DEFAULT} from '../../../shared/directCampaign.js';

/* AFA Registration commercial quote and the (disabled) December price. Synthetic accounts; the supplier and Paystack are
   mocks and every other outbound request is blocked. No funded order is placed and no supplier is contacted. */

const env={...process.env},originalFetch=globalThis.fetch,originalProvider=AfaService.provider,clock=C.now;
const originalInitialize=PaystackServerService.initializeTransaction,originalVerify=PaystackServerService.verifyTransaction,originalPrice=C.afaPrice;
const payload={name:'Synthetic AFA Customer',phone:'0249116309',idNumber:'GHA-202501234-5',location:'Accra',region:'Greater Accra',dateOfBirth:'1990-02-12'};
let server:Server,base:string,posts=0,inits:any[]=[],paid=1999,available=true;
const reply=(status='registered')=>({success:true,data:{publicId:'AFA_FIXTURE',status,phone:payload.phone,priceMinor:'1500'}});
const at=(iso:string)=>{C.now=()=>new Date(iso);};
async function request(path:string,method='GET',body?:unknown,token='customer-token'){
 return originalFetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
const pay=(extra:any={},phone=payload.phone)=>request('/afa/payments/initialize','POST',{...payload,phone,consent:true,customerEmail:'receipt@example.com',...extra});
const quote=async()=>(await request('/afa/quote','GET',undefined,'')).json();
const store=(value:any)=>FinanceStore.transaction('admin',tx=>tx.saveConfig('afa-pricing',value));
const confirmedCost=(costMinor=1500,confirmedAt='2026-11-20T10:00:00Z')=>({costMinor,evidence:'Synthetic written quote from the AFA supplier, dated 20 Nov 2026',confirmedAt,actorId:'admin'});
/** Stored directly (as an Admin save would leave it), to exercise the read side on its own. */
const activeConfig=(extra:any={})=>store({...AFA_PRICING_DEFAULT,enabled:true,version:'afa-fixture-v1',cost:confirmedCost(),...extra});
before(async()=>{const app=express();app.use(express.json());app.use('/api',apiRouter);app.use('/api/admin',adminRouter);server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
after(async()=>{await new Promise<void>(r=>server.close(()=>r()));});
beforeEach(async()=>{
 process.env.NODE_ENV='test';delete process.env.DATABASE_URL;
 process.env.AFA_PII_ENCRYPTION_KEY='ab'.repeat(32);process.env.AFA_SERVICE_ENABLED='true';process.env.AFA_RETAIL_PRICE_MINOR='2999';process.env.APP_URL='https://fixture.example';
 process.env.PAYSTACK_SECRET_KEY='sk_live_fixture';process.env.SUCCESS_BIZ_HUB_API_KEY=`fixture_${randomUUID()}`;process.env.SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED='true';
 OrdersStore.clearDevStore();AfaStore.clearTestStore();AuthStore._clearDevStore();AdminAuditStore._clearDevStore();FinanceStore._reset();posts=0;inits=[];available=true;paid=1999;
 globalThis.fetch=async()=>{throw new Error('Unexpected external request: test blocked it');};
 AfaService.provider={client:{isConfigured:()=>true,isFulfillmentEnabled:()=>true},checkAfaAvailable:async()=>available?{available:true,status:'available'}:{available:false,status:'unavailable'},placeAfaRegistration:async()=>{posts++;return reply();},getAfaStatus:async()=>reply()} as unknown as SuccessBizHubProvider;
 PaystackServerService.initializeTransaction=async p=>{inits.push(p);return {success:true,reference:p.reference,authorizationUrl:'https://checkout.paystack.com/fixture'};};
 PaystackServerService.verifyTransaction=async reference=>({reference,isVerified:true,status:'success',amountPesewas:paid,currency:'GHS'});
 for(const [id,role,phone] of [['customer','customer',null],['data-buyer','customer','+233241112222'],['admin','admin',null]] as const){await AuthStore.createUser({id,name:id,email:`${id}@example.com`,phone,passwordHash:'fixture-only',role});await AuthStore.createSession(id,`${id}-token`);}
 at('2026-12-10T12:00:00Z');C.afaPrice=originalPrice;
});
afterEach(()=>{AfaService.provider=originalProvider;PaystackServerService.initializeTransaction=originalInitialize;PaystackServerService.verifyTransaction=originalVerify;globalThis.fetch=originalFetch;C.now=clock;C.afaPrice=originalPrice;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);});

// ───────── Ordinary AFA (the merged default) ─────────
test('ordinary AFA: the quote is the server setting, and the existing journey is unchanged (no expected fields needed, no snapshot)',async()=>{
 const q=await quote();assert.deepEqual([q.available,q.standardMinor,q.totalMinor,q.pricingRevision,q.welcomeApplies,'campaign' in q],[true,2999,2999,'afa:2999',false,false]);
 assert.equal(q.retailPriceMinor,2999);assert.equal(q.retailPriceGhc,29.99);
 const config=await (await request('/afa/config','GET',undefined,'')).json();assert.deepEqual(Object.keys(config).sort(),['available','enabled','message','retailPriceGhc','retailPriceMinor','status'],'the existing /config contract is untouched');
 const r=await pay({amount:1});assert.equal(r.status,200);const body=await r.json();const order=(await OrdersStore.findOrder(body.orderRef))!;
 assert.equal(order.amount,2999);assert.equal(inits[0].amountPesewas,2999);assert.equal(order.commercial_context??null,null);assert.equal(posts,0);
});
test('disabled (shipped) December AFA price: standard price even inside the December dates; Admin shows it blocked',async()=>{
 assert.equal(AFA_PRICING_DEFAULT.enabled,false);assert.equal(AFA_PRICING_DEFAULT.cost,null,'no cost is pre-confirmed (12.00 is history only)');
 for(const iso of ['2026-12-01T00:00:00Z','2026-12-25T12:00:00Z','2027-01-04T23:59:59Z']){at(iso);assert.equal((await quote()).totalMinor,2999,iso);}
 const view:any=await C.admin();assert.equal(view.afa.promotionApplies,false);assert.equal(view.afa.state,'disabled');assert.ok(view.afa.enableProblems.includes('Confirm the contractual AFA supplier cost first.'));
});
for(const [label,iso,expected] of [['scheduled (30 Nov 23:59:59)','2026-11-30T23:59:59Z',2999],['first second (1 Dec 00:00 Accra)','2026-12-01T00:00:00Z',1999],['last second of 4 Jan','2027-01-04T23:59:59Z',1999],['expired (5 Jan 00:00)','2027-01-05T00:00:00Z',2999]] as const)
 test(`enabled AFA promotion ${label}: ${expected}`,async()=>{await activeConfig();at(iso);const q=await quote();assert.equal(q.totalMinor,expected);assert.equal('campaign' in q,expected===1999);});
test('active: GH₵29.99 → December Special GH₵19.99, saving GH₵10.00, Paystack charged exactly 1999 after review, immutable snapshot',async()=>{
 await activeConfig();const q=await quote();
 assert.deepEqual([q.standardMinor,q.totalMinor,q.savingMinor,q.campaign.label,q.welcomeApplies],[2999,1999,1000,'December Special',false]);assert.equal(q.pricingRevision,'afa:2999~afa-fixture-v1');
 const r=await pay({expectedTotalMinor:1999,pricingRevision:q.pricingRevision});assert.equal(r.status,200);const body=await r.json();assert.equal(body.amountPesewas,1999);assert.equal(inits[0].amountPesewas,1999);
 const order=(await OrdersStore.findOrder(body.orderRef))!;assert.equal(order.amount,1999);
 assert.deepEqual([order.commercial_context!.standardMinor,order.commercial_context!.regularMinor,order.commercial_context!.discountMinor,order.commercial_context!.paidMinor,order.commercial_context!.promotionId],[2999,1999,0,1999,null]);
 assert.deepEqual((toSafePublicOrder(order) as any).commercial_pricing,{regularMinor:1999,discountMinor:0,paidMinor:1999,standardMinor:2999});
 assert.deepEqual(Object.keys(inits[0].metadata).sort(),['product_id','public_reference','service_type'],'no identity or price detail added to Paystack metadata');
});
test('unknown or insufficient supplier cost: the promotion never applies, even if stored as enabled',async()=>{
 await activeConfig({cost:null});assert.equal((await quote()).totalMinor,2999);
 await activeConfig({cost:confirmedCost(2100)});assert.equal((await quote()).totalMinor,2999,'a cost above the December price stops the promotion');
 await activeConfig({cost:{costMinor:1500,evidence:'short',confirmedAt:'2026-11-20T10:00:00Z',actorId:'admin'}});assert.equal((await quote()).totalMinor,2999,'a malformed confirmation is ignored');
 await activeConfig({campaignMinor:2999});assert.equal((await quote()).totalMinor,2999,'not below the standard price, not a promotion');
});
test('disabled supplier service: no payment, no AFA headline, and enabling is refused',async()=>{
 await activeConfig();available=false;const q=await quote();assert.equal(q.available,false);assert.equal(q.totalMinor,null);assert.equal('campaign' in q,false);
 const r=await pay({expectedTotalMinor:1999,pricingRevision:'afa:2999~afa-fixture-v1'});assert.equal(r.status,503);assert.equal(inits.length,0);
 const catalog=await C.catalog();assert.deepEqual(await C.withAfaHeadline(catalog),catalog);
});

// ───────── Quote and payment protection ─────────
test('a fee that changed after review is refused with the new quote; nothing is written or charged',async()=>{
 const before=await quote();await activeConfig();
 for(const accepted of [{expectedTotalMinor:2999,pricingRevision:before.pricingRevision},{expectedTotalMinor:2999},{pricingRevision:before.pricingRevision},{}]){
  const r=await pay(accepted);assert.equal(r.status,409,JSON.stringify(accepted));const body=await r.json();assert.equal(body.code,'AFA_REVIEW_REQUIRED');assert.equal(body.quote.totalMinor,1999);
 }
 assert.equal(OrdersStore.adminDevOrders().length,0);assert.equal(inits.length,0);
 const q=await quote();await store({...AFA_PRICING_DEFAULT,version:'afa-off'});
 const r=await pay({expectedTotalMinor:1999,pricingRevision:q.pricingRevision});assert.equal(r.status,409);assert.equal((await r.json()).quote.totalMinor,2999,'switched off: the customer reviews the higher standard price');
 process.env.AFA_RETAIL_PRICE_MINOR='3199';const changed=await pay({expectedTotalMinor:2999,pricingRevision:'afa:2999'});assert.equal(changed.status,409,'a changed server price is a changed revision');
 assert.equal(afaRequestMatchesQuote({totalMinor:2999,pricingRevision:'afa:2999'},{}),true,'a page from before quotes existed can still pay the standard price');
});
test('payment boundary: a fee that changes after the order is written is cancelled before Paystack and the number is released',async()=>{
 await activeConfig();const q=await quote();let calls=0;
 C.afaPrice=(async(...args:any[])=>{const real=await originalPrice.apply(C,args as any);return ++calls===2&&real?{...real,totalMinor:2999,pricingRevision:'afa:2999'}:real;}) as any;
 const r=await pay({expectedTotalMinor:1999,pricingRevision:q.pricingRevision});assert.equal(r.status,409);assert.equal(inits.length,0);
 const [cancelled]=OrdersStore.adminDevOrders();assert.equal(cancelled.status,'cancelled');
 C.afaPrice=originalPrice;const retry=await pay({expectedTotalMinor:1999,pricingRevision:q.pricingRevision});assert.equal(retry.status,200,'the duplicate block was released for an unpaid cancelled order');
});
test('Wallet debits exactly the reviewed promotional fee; a change inside the transaction debits nothing',async()=>{
 await activeConfig();const q=await quote();
 await FinanceService.adjustment('admin','customer',{confirmed:true,direction:'credit',amountMinor:5000,requestId:randomUUID(),reason:'Synthetic fixture'});
 let calls=0;C.afaPrice=(async(...args:any[])=>{const real=await originalPrice.apply(C,args as any);return ++calls===2&&real?{...real,pricingRevision:'afa:2999~changed'}:real;}) as any;
 const refused=await pay({paymentMethod:'wallet',requestId:randomUUID(),expectedTotalMinor:1999,pricingRevision:q.pricingRevision});
 assert.equal(refused.status,409);assert.equal((await refused.json()).code,'AFA_REVIEW_REQUIRED');assert.equal((await FinanceService.summary('customer')).walletMinor,5000);assert.equal(OrdersStore.adminDevOrders().length,0);
 C.afaPrice=originalPrice;const requestId=randomUUID(),body={paymentMethod:'wallet',requestId,expectedTotalMinor:1999,pricingRevision:q.pricingRevision};
 const [a,b]=[await (await pay(body)).json(),await (await pay(body)).json()];
 assert.equal(a.amountPesewas,1999);assert.equal(a.orderRef,b.orderRef,'an idempotent retry returns the same order');assert.equal((await FinanceService.summary('customer')).walletMinor,3001,'debited once');
});
test('existing protections hold under the promotion: duplicate registration, verified dispatch once, uncertainty latched',async()=>{
 await activeConfig();const q=await quote(),accepted={expectedTotalMinor:1999,pricingRevision:q.pricingRevision};
 const first=await (await pay(accepted)).json();const dup=await pay(accepted);assert.equal(dup.status,409);assert.match((await dup.json()).error,/active or completed/);
 const order=(await OrdersStore.findOrder(first.orderRef))!;process.env.NODE_ENV='development';
 await Promise.all([FulfilmentService.processPaidOrder(order.payment_reference,new Date().toISOString()),FulfilmentService.processPaidOrder(order.payment_reference,new Date().toISOString())]);
 const done=(await OrdersStore.findOrder(order.id))!;assert.equal(posts,1);assert.equal(done.status,'delivered');assert.equal(done.amount,1999);assert.equal(done.supplier_cost_minor,1500);
 process.env.NODE_ENV='test';const other=await (await pay(accepted,'0549116309')).json();const o2=(await OrdersStore.findOrder(other.orderRef))!;
 process.env.NODE_ENV='development';AfaService.provider.placeAfaRegistration=async()=>{posts++;throw Object.assign(new Error('private'),{isTimeout:true});};
 await FulfilmentService.processPaidOrder(o2.payment_reference,new Date().toISOString());await AfaService.submit((await OrdersStore.findOrder(o2.id))!);
 const uncertain=(await OrdersStore.findOrder(o2.id))!;assert.equal(posts,2,'never resubmitted');assert.equal(uncertain.manual_review,true);assert.equal(uncertain.amount,1999);
});
test('a wrong Paystack amount for a promotional order never dispatches',async()=>{
 await activeConfig();const q=await quote();const body=await (await pay({expectedTotalMinor:1999,pricingRevision:q.pricingRevision})).json();
 paid=2999;process.env.NODE_ENV='development';const order=(await OrdersStore.findOrder(body.orderRef))!;
 await request(`/payments/verify/${order.payment_reference}`);assert.equal(posts,0);assert.notEqual((await OrdersStore.findOrder(order.id))!.status,'delivered');
});
test('paid orders keep their amount when the promotion later ends or changes',async()=>{
 await activeConfig();const q=await quote();const body=await (await pay({expectedTotalMinor:1999,pricingRevision:q.pricingRevision})).json();
 const before=(await OrdersStore.findOrder(body.orderRef))!;await store({...AFA_PRICING_DEFAULT,version:'later'});at('2027-01-10T00:00:00Z');
 const after=(await OrdersStore.findOrder(body.orderRef))!;assert.equal(after.amount,1999);assert.deepEqual(after.commercial_context,before.commercial_context);
});
test('the data welcome benefit never applies to AFA',async()=>{
 await activeConfig();assert.equal((await C.quote('mtn-1gb','data-buyer')).offer.state,'eligible','this account would get the data benefit');
 const q=await (await request('/afa/quote','GET',undefined,'data-buyer-token')).json();assert.equal(q.totalMinor,1999);assert.equal(q.welcomeApplies,false);
 const body=await (await pay({expectedTotalMinor:1999,pricingRevision:q.pricingRevision},'0241112222'.replace(/^0/,'0'))).json();
 assert.equal(body.amountPesewas,1999);assert.equal((await C.quote('mtn-1gb','data-buyer')).offer.state,'eligible','AFA did not reserve or consume it');
});

// ───────── Headline ─────────
test('"Up to 33%" only while the AFA December price applies and AFA can be bought; never from a dormant proposal',async()=>{
 const plain=await C.catalog();assert.deepEqual(await C.withAfaHeadline(plain),plain,'AFA off: the catalogue is unchanged');
 await store({...AFA_PRICING_DEFAULT,cost:confirmedCost()});assert.deepEqual(await C.withAfaHeadline(await C.catalog()),plain,'confirmed cost alone is not an offer');
 await FinanceStore.transaction('admin',tx=>tx.saveConfig('direct-campaign',{...DIRECT_CAMPAIGN_DEFAULT,enabled:true,version:'data-on'}));
 assert.equal((await C.withAfaHeadline(await C.catalog())).campaign!.maxSavingPercent,14,'data only: 14%');
 await activeConfig();assert.equal((await C.withAfaHeadline(await C.catalog())).campaign!.maxSavingPercent,33,'AFA purchasable: 33%');
 assert.equal(savingPercent(2999,1999),33,'33.34% shown as 33, never rounded up');
 available=false;assert.equal((await C.withAfaHeadline(await C.catalog())).campaign!.maxSavingPercent,14,'AFA unavailable: back to 14%');
 available=true;await FinanceStore.transaction('admin',tx=>tx.saveConfig('direct-campaign',{...DIRECT_CAMPAIGN_DEFAULT,enabled:false,version:'data-off'}));
 const afaOnly=(await C.withAfaHeadline(await C.catalog())).campaign!;assert.equal(afaOnly.maxSavingPercent,33);assert.equal(afaOnly.title,'December Specials');
 const json=await (await request('/commercial/products','GET',undefined,'')).json();assert.equal(json.campaign.maxSavingPercent,33,'served on the public catalogue');
});

// ───────── Admin ─────────
const costBody=(extra:any={})=>({kind:'afa-cost',confirmed:true,expectedVersion:AFA_PRICING_DEFAULT.version,costMinor:1500,evidence:'Synthetic written quote from the AFA supplier, dated 13 Nov 2026',confirmation:AFA_COST_CONFIRMATION,...extra});
const enableBody=(version:string,extra:any={})=>({kind:'afa-campaign',confirmed:true,expectedVersion:version,enabled:true,activation:AFA_CAMPAIGN_ACTIVATION,startDate:'2026-12-01',endDate:'2027-01-04',campaignMinor:1999,...extra});
test('Admin: recording the contractual cost needs Admin, typed confirmation and evidence; it is audited and does not enable anything',async()=>{
 at('2026-11-13T10:00:00Z');
 assert.equal((await request('/admin/commercial','POST',costBody())).status,403);
 await assert.rejects(()=>C.save('admin',costBody({confirmation:'yes'})),/Type confirm-afa-cost/);
 await assert.rejects(()=>C.save('admin',costBody({evidence:'trust me'})),/evidence/);
 await assert.rejects(()=>C.save('admin',costBody({costMinor:'15'})));
 await assert.rejects(()=>C.save('admin',costBody({expectedVersion:'stale'})),/Refresh/);
 const saved=await C.save('admin',costBody());assert.equal(saved.cost.costMinor,1500);assert.equal(saved.cost.actorId,'admin');assert.equal(saved.enabled,false);
 at('2026-12-10T12:00:00Z');assert.equal((await quote()).totalMinor,2999,'a confirmed cost does not enable the promotion');
 const audit=(await AdminAuditStore.findRecent(10)).find(a=>a.action==='commercial_afa_cost_confirmed')!;assert.equal(JSON.parse(audit.metadata_safe_json||'{}').next.cost.costMinor,1500);
});
test('Admin: enabling needs typed activation, dates, a price below standard covering a fresh confirmed cost, and supplier availability',async()=>{
 at('2026-11-13T10:00:00Z');let cfg:any=await C.save('admin',costBody());
 await assert.rejects(()=>C.save('admin',enableBody(cfg.version,{activation:'yes'})),/Type afa-december-specials-2026/);
 await assert.rejects(()=>C.save('admin',enableBody(cfg.version,{endDate:null})),/first and last day/);
 await assert.rejects(()=>C.save('admin',enableBody(cfg.version,{campaignMinor:2999})),/below the standard price/);
 await assert.rejects(()=>C.save('admin',enableBody(cfg.version,{campaignMinor:1400})),/below the confirmed supplier cost/);
 available=false;await assert.rejects(()=>C.save('admin',enableBody(cfg.version)),/not currently available/);available=true;
 delete process.env.AFA_RETAIL_PRICE_MINOR;await assert.rejects(()=>C.save('admin',enableBody(cfg.version)),/not configured/);process.env.AFA_RETAIL_PRICE_MINOR='2999';
 at('2026-12-20T10:00:00Z');await assert.rejects(()=>C.save('admin',enableBody(cfg.version)),/more than 30 days ago/);
 // Cost changing before activation: a re-confirmed higher cost blocks enabling at 19.99.
 at('2026-11-14T10:00:00Z');cfg=await C.save('admin',costBody({expectedVersion:cfg.version,costMinor:2100}));
 await assert.rejects(()=>C.save('admin',enableBody(cfg.version)),/below the confirmed supplier cost/);
 cfg=await C.save('admin',costBody({expectedVersion:cfg.version,costMinor:1500}));
 const on=await C.save('admin',enableBody(cfg.version));assert.equal(on.enabled,true);
 assert.equal((await quote()).totalMinor,2999,'scheduled: standard until 1 December');at('2026-12-01T00:00:00Z');assert.equal((await quote()).totalMinor,1999);
 const off=await C.save('admin',{kind:'afa-campaign',confirmed:true,expectedVersion:on.version,enabled:false,startDate:'2026-12-01',endDate:'2027-01-04',campaignMinor:1999});
 assert.equal(off.enabled,false);assert.equal((await quote()).totalMinor,2999,'turning it off restores the standard price immediately');
 assert.ok((await AdminAuditStore.findRecent(20)).filter(a=>a.action==='commercial_afa_campaign_changed').length>=2);
});
test('stored AFA settings fail closed when malformed',()=>{
 for(const stored of [null,'x',{enabled:'true'},{enabled:true,startDate:'2026-13-01'},{enabled:true,campaignMinor:-5},{enabled:true,cost:{costMinor:'1500'}}]){
  const c=normalizeAfaPricing(stored);assert.ok(c.enabled===false||c.startDate===null||c.campaignMinor===0||c.cost===null,JSON.stringify(stored));
 }
});
test('page: exact fee review from the server quote, savings only when genuine, reviewed values sent on both payment paths',()=>{
 const page=readFileSync('src/components/services/AfaRegistrationPage.tsx','utf8');
 assert.match(page,/getAfaQuote\(\)/);assert.doesNotMatch(page,/getAfaConfig\(\)/);
 assert.match(page,/const promo = config\?\.campaign && config\.standardMinor != null && config\.totalMinor != null && config\.standardMinor > config\.totalMinor \? config : null;/);
 assert.match(page,/walletCheckout\(sessionToken,'afa\/payments\/initialize',\{\.\.\.payload,consent:true,customerEmail:formData\.customerEmail,\.\.\.\(accepted\|\|\{\}\)/);
 assert.match(page,/initializeAfaPayment\(payload, formData\.consent, formData\.customerEmail, sessionToken, accepted\)/);
 assert.match(page,/review\.code === 'AFA_REVIEW_REQUIRED'/);assert.match(page,/Nothing was charged/);
 assert.match(page,/A one-time registration fee\. MTN AFA call and data packages are bought separately from MTN afterwards\. Data welcome benefits do not apply to AFA\./);
 assert.match(page,/<del aria-label=\{`Regular price/);
});
test('untouched: encryption, supplier payload handling and status reconciliation are not edited by this change',()=>{
 const route=readFileSync('server/routes/afaApi.ts','utf8');assert.match(route,/AfaStore\.create\(order, payload\)/);assert.match(route,/metadata:\{public_reference:publicRef,service_type:'afa',product_id:'afa-registration'\}/);
 const service=readFileSync('server/services/afaService.ts','utf8');assert.doesNotMatch(service,/afa-pricing|campaign/i,'supplier submission and status code read no promotion');
});
test('deploy order: a new page against an API without /quote falls back to /config at the standard price, with no revision sent',async()=>{
 const {getAfaQuote}=await import('../../../src/services/afaApi.js');
 globalThis.fetch=(async(url:any)=>String(url).endsWith('/api/afa/quote')?new Response('{}',{status:404}):new Response(JSON.stringify({enabled:true,available:true,retailPriceMinor:2999,retailPriceGhc:29.99,status:'available',message:'ok'}),{status:200})) as any;
 const q=await getAfaQuote();assert.deepEqual([q.available,q.standardMinor,q.totalMinor,q.pricingRevision,'campaign' in q],[true,2999,2999,null,false]);
 // The page then sends no expected fields (accepted is undefined without a revision), which every API accepts at the standard price.
 assert.match(readFileSync('src/components/services/AfaRegistrationPage.tsx','utf8'),/const accepted = config\?\.totalMinor != null && config\.pricingRevision \? \{/);
});
