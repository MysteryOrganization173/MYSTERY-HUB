import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type {Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {adminWebsiteRouter} from '../../routes/websiteFreeApi.js';
import {websiteRouter,handlePublicSiteBySlug} from '../../routes/websiteApi.js';
import {WebsiteStore} from '../../db/websiteStore.js';
import {WebsiteAssetStore} from '../../db/websiteAssetStore.js';
import {WebsiteAnalyticsStore} from '../../db/websiteAnalyticsStore.js';
import {AuthStore} from '../../db/authStore.js';
import {AdminAuditStore} from '../../db/adminAuditStore.js';
let server:Server,base:string;
before(async()=>{const app=express();app.use(express.json());app.use('/api/admin/website-builder',adminWebsiteRouter);app.use('/api/websites',websiteRouter);app.get('/api/public/sites/:slug',handlePublicSiteBySlug);server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;});
after(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));});
beforeEach(async()=>{
  delete process.env.DATABASE_URL;process.env.NODE_ENV='test';WebsiteStore.clearDevStore();WebsiteAssetStore.clearDevStore();WebsiteAnalyticsStore.clearDevStore();AuthStore._clearDevStore();
  for(const id of ['owner','other','admin']){await AuthStore.createUser({id,name:`${id} account`,email:`${id}-private@fixture.test`,phone:id==='owner'?'0591111111':null,passwordHash:'PRIVATE_HASH_NEVER_RETURN',role:id==='admin'?'admin':'customer'});await AuthStore.createSession(id,`token-${id}`);}
});
const request=(path:string,token?:string,method='GET',body?:unknown)=>fetch(`${base}/${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
const create=async(user='owner')=>(await WebsiteStore.createSite(user,{template_id:'tmpl-legon-consult',name:'Synthetic project',content:{businessName:'Distinct business',phone:'0242222222',whatsapp:'0203333333',email:'business@fixture.test'}})).site;

test('Admin inspects authoritative owner contacts separately from business contacts',async()=>{
  const site=await create();const response=await request(`admin/website-builder/${site.id}`,'token-admin');assert.equal(response.status,200);
  const result=await response.json();assert.deepEqual(result.site.owner,{name:'owner account',email:'owner-private@fixture.test',phone:'+233591111111'});
  assert.deepEqual(result.site.businessContact,{phone:'0242222222',whatsapp:'0203333333',email:'business@fixture.test'});
  assert.equal(result.site.id,site.id);assert.equal(result.site.name,'Synthetic project');assert.equal(result.site.businessName,'Distinct business');assert.equal(result.site.publicUrl,null);
  assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(!JSON.stringify(result).includes('PRIVATE_HASH_NEVER_RETURN'));
});
test('owner contacts are absent from bulk summaries and public site responses',async()=>{
  let site=await create();site=(await WebsiteStore.publishSite(site.id,'owner',site.updated_at))!;
  const bulk=await (await request('admin/website-builder?range=all','token-admin')).json();const publicSite=await (await request(`public/sites/${site.slug}`)).json();
  for(const payload of [bulk,publicSite]){const body=JSON.stringify(payload);assert.ok(!body.includes('owner-private@fixture.test'));assert.ok(!body.includes('+233591111111'));assert.ok(!body.includes('PRIVATE_HASH_NEVER_RETURN'));}
  assert.equal(bulk.metrics.published,1);assert.equal(bulk.sites[0].owner,undefined);
});
for(const [token,status] of [[undefined,401],['bad-token',401],['token-owner',403],['token-other',403]] as const)test(`private inspection denies ${token??'anonymous'} access`,async()=>{
  const site=await create();const response=await request(`admin/website-builder/${site.id}`,token);assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'no-store');const text=await response.text();assert.ok(!text.includes('owner-private@fixture.test'));assert.ok(!text.includes('0591111111'));
});
test('missing account phone and business WhatsApp are null, not invented values',async()=>{
  const site=await create('other');await WebsiteStore.updateSite(site.id,'other',{expectedUpdatedAt:site.updated_at,content:{whatsapp:''}});
  const body=await (await request(`admin/website-builder/${site.id}`,'token-admin')).json();assert.equal(body.site.owner.phone,null);assert.equal(body.site.businessContact.whatsapp,null);
});
test('invalid inspection ID is rejected before lookup',async()=>{assert.equal((await request('admin/website-builder/not-a-site','token-admin')).status,400);});
test('fresh inspection reflects updates; drafts remain private and publication dates/status stay authoritative',async()=>{
  let site=await create();assert.equal((await request(`public/sites/${site.slug}`)).status,404);
  const before=await (await request(`admin/website-builder/${site.id}`,'token-admin')).json();assert.equal(before.site.publicUrl,null);
  site=(await WebsiteStore.publishSite(site.id,'owner',site.updated_at))!;
  const published=await (await request(`admin/website-builder/${site.id}`,'token-admin')).json();assert.equal(published.site.status,'published');assert.equal(published.site.publicUrl,`/sites/${site.slug}`);assert.ok(published.site.published_at);
  await WebsiteStore.updateSite(site.id,'owner',{expectedUpdatedAt:site.updated_at,content:{phone:'0244444444'}});
  const refreshed=await (await request(`admin/website-builder/${site.id}`,'token-admin')).json();assert.equal(refreshed.site.businessContact.phone,'0244444444');
});
test('force-unpublish confirmation and auditing preserve customer content',async()=>{
  let site=await create();site=(await WebsiteStore.publishSite(site.id,'owner',site.updated_at))!;
  assert.equal((await request(`admin/website-builder/${site.id}/force-unpublish`,'token-admin','POST',{confirmation:'wrong'})).status,400);
  assert.equal((await WebsiteStore.findSiteById(site.id))?.status,'published');
  assert.equal((await request(`admin/website-builder/${site.id}/force-unpublish`,'token-admin','POST',{confirmation:site.slug})).status,200);
  const after=await WebsiteStore.findSiteById(site.id);assert.equal(after?.status,'draft');assert.deepEqual(after?.content_json,site.content_json);assert.equal((await request(`public/sites/${site.slug}`)).status,404);
  assert.ok((await AdminAuditStore.findRecent()).some(a=>a.entity_id===site.id&&a.action==='website_admin_unpublished'));
});
