import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type {Server} from 'node:http';
import {apiRouter} from '../../routes/api.js';
import {WebsiteStore} from '../../db/websiteStore.js';
import {AuthStore} from '../../db/authStore.js';
import {FinanceStore} from '../../db/financeStore.js';
import {WebsiteBusinessService as Business} from '../../services/websiteBusinessService.js';
import {AUTHORITATIVE_PRODUCTS} from '../../data/productCatalog.js';
import {minimumStorePrice,STORE_POLICY_DEFAULTS} from '../../../shared/storeEconomics.js';
import {planBundleSetup,sellerDrafts,bundleSaveRows} from '../../../src/utils/websitePricing.js';
import type {SellerBundle} from '../../../src/utils/websitePricing.js';
import {websiteContactIssue,websiteReadiness} from '../../../src/utils/websiteReadiness.js';
import {websitePreviewCatalog} from '../../../src/utils/websitePreviewCatalog.js';
import {createPublishedSnapshot} from '../../services/websitePublication.js';

let server:Server,base:string;
const policy={...STORE_POLICY_DEFAULTS,enabled:true,reserveBps:300,reserveFixedMinor:10,version:'fixture'};
before(async()=>{assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.DATABASE_URL,undefined);const app=express();app.use(express.json());app.use('/api',apiRouter);server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));base=`http://127.0.0.1:${(server.address() as any).port}`;});
after(()=>new Promise<void>(r=>server.close(()=>r())));
beforeEach(async()=>{WebsiteStore.clearDevStore();FinanceStore._reset();AuthStore._clearDevStore();for(const id of ['owner','other']){await AuthStore.createUser({id,name:id,email:`${id}@fixture.test`,phone:null,passwordHash:'not-used',role:'customer'});await AuthStore.createSession(id,id+'-token');}await FinanceStore.transaction('owner',async tx=>{await tx.saveConfig('store-policy',policy);await tx.saveConfig('store-wholesale',Object.fromEntries(Object.values(AUTHORITATIVE_PRODUCTS).filter(p=>p.isActive).map(p=>[p.id,{enabled:true,wholesaleMinor:300,version:'fixture'}])));});});
const request=(path:string,body?:unknown,token='owner-token',method=body?'POST':'GET')=>fetch(base+'/api/'+path,{method,headers:{...(token?{authorization:`Bearer ${token}`} :{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
const catalogFor=async(id:string)=>{const c=await Business.catalog(id,'owner');return {...c,products:c.products as (SellerBundle&{eligible:boolean})[]};};
const create=async(template='tmpl-data-reseller')=>{let s=(await WebsiteStore.createSite('owner',{template_id:template,name:'Synthetic business'})).site;return (await WebsiteStore.updateSite(s.id,'owner',{expectedUpdatedAt:s.updated_at,content:{items:[]}}))!;};

for(const networks of [['mtn'],['telecel'],['airteltigo'],['mtn','telecel','airteltigo']])for(const kind of ['percent','flat'] as const)test(`persisted bulk ${kind} setup: ${networks.join(',')}`,async()=>{
 const s=await create(),catalog=await catalogFor(s.id),saved=sellerDrafts(catalog.products);
 const plan=planBundleSetup(catalog.products,saved,{networks,priceMode:'markup',kind,value:'10',activation:'enable'}),next={...saved};for(const row of plan.rows)next[row.id]=row.after;
 const rows=bundleSaveRows(catalog.products,saved,next);
 const response=await request(`websites/${s.id}/bundles`,{expectedVersion:catalog.version,products:rows},'owner-token','PUT');assert.equal(response.status,200);
 const fresh=await catalogFor(s.id);assert.equal(fresh.products.filter(p=>p.eligible).length,rows.length);assert.ok(rows.length>0);
 for(const p of fresh.products){assert.equal(p.enabled,networks.includes(p.network));if(p.enabled)assert.equal(p.retailMinor,next[p.id].price?Math.round(Number(next[p.id].price)*100):0);}
 // A persisted draft catalogue is not public and cannot collect payment.
 assert.equal((await request(`websites/${s.id}/storefront`,undefined,'')).status,404);
 assert.equal((await request(`websites/${s.id}/store-checkout`,{productId:rows[0].productId,recipientPhone:'0241234567',customerEmail:'fixture@fixture.test',requestId:crypto.randomUUID()},'')).status,404);
 const repeated=await request(`websites/${s.id}/bundles`,{expectedVersion:catalog.version,products:rows},'owner-token','PUT');assert.equal(repeated.status,409);
 assert.deepEqual(bundleSaveRows(fresh.products,sellerDrafts(fresh.products),sellerDrafts(fresh.products)),[]);
});
test('prices-only preserves activation; disable affects chosen network; partial setup stays accurate',async()=>{
 const s=await create();let c=await catalogFor(s.id);const first=c.products.find(p=>p.network==='mtn')!;
 await Business.savePrices(s.id,'owner',{expectedVersion:c.version,products:[{productId:first.id,retailMinor:500,enabled:true}]});
 c=await catalogFor(s.id);let saved=sellerDrafts(c.products);let plan=planBundleSetup(c.products,saved,{networks:['mtn','telecel','airteltigo'],priceMode:'markup',kind:'flat',value:'1',activation:'keep'});let next={...saved};for(const r of plan.rows)next[r.id]=r.after;
 await Business.savePrices(s.id,'owner',{expectedVersion:c.version,products:bundleSaveRows(c.products,saved,next)});c=await catalogFor(s.id);assert.equal(c.products.filter(p=>p.enabled).length,1);
 saved=sellerDrafts(c.products);plan=planBundleSetup(c.products,saved,{networks:['telecel'],priceMode:'keep',kind:'flat',value:'0',activation:'disable'});assert.equal(plan.summary.newlyDisabled,0);
 plan=planBundleSetup(c.products,saved,{networks:['mtn'],priceMode:'keep',kind:'flat',value:'0',activation:'disable'});next={...saved};for(const r of plan.rows)next[r.id]=r.after;await Business.savePrices(s.id,'owner',{expectedVersion:c.version,products:bundleSaveRows(c.products,saved,next)});assert.equal((await catalogFor(s.id)).products.filter(p=>p.enabled).length,0);
});
test('one invalid row rolls back prices, activation, version and audit',async()=>{
 const s=await create(),c=await catalogFor(s.id),[a,b]=c.products;
 const before=await FinanceStore.read('owner',tx=>tx.config(`store:${s.id}`));
 const response=await request(`websites/${s.id}/bundles`,{expectedVersion:c.version,products:[{productId:a.id,retailMinor:500,enabled:true},{productId:b.id,retailMinor:minimumStorePrice(300,policy)-1,enabled:true}]},'owner-token','PUT');assert.equal(response.status,400);
 assert.deepEqual(await FinanceStore.read('owner',tx=>tx.config(`store:${s.id}`)),before);assert.deepEqual(await catalogFor(s.id),c);
});
test('policy-disabled, unconfigured and cross-owner edits fail closed; stale concurrent saves have one winner',async()=>{
 const s=await create(),c=await catalogFor(s.id),p=c.products[0],payload={expectedVersion:c.version,products:[{productId:p.id,retailMinor:500,enabled:true}]};
 assert.equal((await request(`websites/${s.id}/bundles`,payload,'other-token','PUT')).status,403);
 assert.equal((await request(`websites/${s.id}/bundles`,payload,'','PUT')).status,401);
 await FinanceStore.transaction('owner',tx=>tx.saveConfig('store-wholesale',{}));await assert.rejects(Business.savePrices(s.id,'owner',payload),/minimum/);
 await FinanceStore.transaction('owner',tx=>tx.saveConfig('store-policy',{...policy,enabled:false}));await assert.rejects(Business.savePrices(s.id,'owner',payload),/minimum/);
 await FinanceStore.transaction('owner',async tx=>{await tx.saveConfig('store-policy',policy);await tx.saveConfig('store-wholesale',{[p.id]:{enabled:true,wholesaleMinor:300}});});
 const race=await Promise.all([1,2].map(()=>request(`websites/${s.id}/bundles`,payload,'owner-token','PUT')));assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
});
for(const template of ['tmpl-buka-bistro','tmpl-night-kitchen','tmpl-boutique','tmpl-makola-mart','tmpl-glow-salon'])test(`publish API requires supported contact for ${template}, draft stays private`,async()=>{
 let s=await create(template),old=structuredClone(s);const denied=await request(`websites/${s.id}/publish`,{expectedUpdatedAt:s.updated_at});assert.equal(denied.status,400);assert.deepEqual(await WebsiteStore.findSiteById(s.id),old);
 assert.equal((await request(`websites/${s.id}/publish`,{expectedUpdatedAt:s.updated_at},'other-token')).status,403);
 s=(await WebsiteStore.updateSite(s.id,'owner',{expectedUpdatedAt:s.updated_at,content:{whatsapp:'+233 24 123 4567'}}))!;
 const published=await request(`websites/${s.id}/publish`,{expectedUpdatedAt:s.updated_at});assert.equal(published.status,200);
 const snapshot=(await WebsiteStore.findPublishedSiteById(s.id))!;
 s=(await WebsiteStore.updateSite(s.id,'owner',{expectedUpdatedAt:(await WebsiteStore.findSiteById(s.id))!.updated_at,content:{whatsapp:''}}))!;
 assert.equal((await request(`websites/${s.id}/publish`,{expectedUpdatedAt:s.updated_at})).status,400);assert.deepEqual((await WebsiteStore.findPublishedSiteById(s.id))!.content_json,snapshot.content_json);
});
test('Data publishes without WhatsApp even with zero eligible bundles, with readiness warning',async()=>{const s=await create();assert.equal((await request(`websites/${s.id}/publish`,{expectedUpdatedAt:s.updated_at})).status,200);assert.equal(websiteReadiness({templateId:s.template_id,content:s.content_json,sellableBundles:0}).find(i=>i.id==='bundles')?.level,'warning');});
test('legacy no-contact snapshot allows unchanged content only, never an unpublished or changed design exemption',()=>{
 const s={template_id:'tmpl-boutique',content_json:{businessName:'Legacy',items:[]},settings_json:{},name:'Legacy',updated_at:'old'} as any,snapshot=createPublishedSnapshot(s);
 assert.equal(websiteContactIssue(s.template_id,s.content_json,snapshot),null);
 assert.equal(websiteContactIssue(s.template_id,{...s.content_json,tagline:'New customer promise'},snapshot),'whatsapp');
 assert.equal(websiteContactIssue('tmpl-night-kitchen',s.content_json,snapshot),'whatsapp');assert.equal(websiteContactIssue(s.template_id,s.content_json,null),'whatsapp');
});
test('preview projection strips private data, rejects ineligible rows and never invents availability',()=>{
 const p={id:'mtn-1gb',network:'mtn',networkName:'MTN',dataAmount:'1GB',retailMinor:500,eligible:true,wholesaleMinor:300,policy:{secret:'no'},ownerId:'private',token:'private'};
 const view=websitePreviewCatalog([p,{...p,id:'off',eligible:false}],true);assert.equal(view.length,1);for(const field of ['wholesaleMinor','policy','ownerId','token','eligible'])assert.ok(!(field in view[0]));assert.deepEqual(websitePreviewCatalog(null),[]);
});
