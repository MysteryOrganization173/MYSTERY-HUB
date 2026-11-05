import {test,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {randomUUID} from 'node:crypto';
import {WebsiteStore} from '../../db/websiteStore.js';
import {WebsiteAnalyticsStore} from '../../db/websiteAnalyticsStore.js';
import {AdminWebsiteStore} from '../../db/adminWebsiteStore.js';
import {AuthStore} from '../../db/authStore.js';
import {adminWebsiteRouter} from '../../routes/websiteFreeApi.js';
const originalSites=WebsiteStore.allSites;
beforeEach(async()=>{
 delete process.env.DATABASE_URL;process.env.NODE_ENV='test';WebsiteStore.allSites=originalSites;WebsiteStore.clearDevStore();WebsiteAnalyticsStore.clearDevStore();AuthStore._clearDevStore();
 for(const [id,role,status] of [['draft-owner','customer','active'],['mixed-owner','customer','active'],['staff','admin','active'],['disabled','customer','disabled']] as const)await AuthStore.createUser({id,name:id,email:`${id}@private.test`,phone:null,passwordHash:'SYNTHETIC_PRIVATE_HASH',role,status});
});
after(()=>{WebsiteStore.allSites=originalSites;});
const make=async(owner='draft-owner')=>(await WebsiteStore.createSite(owner,{name:'Synthetic business',template_id:'tmpl-legon-consult',content:{businessName:'Synthetic business',whatsapp:'0241111111'}})).site;
test('owner snapshot is distinct, current and independent of date/list filters',async()=>{
 const draft=await make(),mixed=await make('mixed-owner'),staff=await make('staff'),disabled=await make('disabled');
 const oldPublished={...mixed,id:'site_old_published',slug:'old-live',status:'published' as const,created_at:'2020-01-01T00:00:00Z',published_at:'2020-01-02T00:00:00Z'};
 WebsiteStore.allSites=async()=>[draft,mixed,oldPublished,staff,disabled];
 const all=await AdminWebsiteStore.projects({range:'all'}) as any;
 assert.deepEqual(all.activation,{customerOwners:2,publishedOwners:1,draftOnlyOwners:1,excludedProjects:2});
 const filtered=await AdminWebsiteStore.projects({range:'7',activation:'draft_only'}) as any;
 assert.deepEqual(filtered.activation,all.activation);assert.deepEqual(filtered.sites.map((s:any)=>s.id),[draft.id]);
 assert.equal(all.sites.find((s:any)=>s.id===mixed.id).ownerStage,'published_owner');
 assert.equal(all.sites.find((s:any)=>s.id===staff.id).ownerStage,'excluded');
 assert.ok(!JSON.stringify(all).includes('@private.test'));
});
test('publication, update and unpublish use current state without creating more owners',async()=>{
 let site=await make();assert.equal((await AdminWebsiteStore.projects({range:'all'}) as any).activation.draftOnlyOwners,1);
 site=(await WebsiteStore.publishSite(site.id,site.user_id,site.updated_at))!;
 await WebsiteAnalyticsStore.action('website_published',site.user_id,site.id,site.template_id);await WebsiteAnalyticsStore.action('website_published',site.user_id,site.id,site.template_id);
 assert.equal((await AdminWebsiteStore.projects({range:'all'}) as any).activation.publishedOwners,1);
 await WebsiteStore.unpublishSite(site.id,site.user_id,site.updated_at);
 const report=await AdminWebsiteStore.projects({range:'all'}) as any;assert.equal(report.activation.publishedOwners,0);assert.equal(report.activation.draftOnlyOwners,1);assert.equal(report.sites[0].publicUrl,null);assert.ok(report.sites[0].published_at,'previous publication is retained, not a first-publication marker');
});
test('an empty snapshot reports zero recorded candidates, not a completed pilot',async()=>{assert.deepEqual((await AdminWebsiteStore.projects({range:'all'}) as any).activation,{customerOwners:0,publishedOwners:0,draftOnlyOwners:0,excludedProjects:0});});
test('selected-site public evidence is Admin-only, bounded and excludes preview/editor events',async()=>{
 await AuthStore.createSession('staff','synthetic-admin');await AuthStore.createSession('draft-owner','synthetic-customer');let site=await make();site=(await WebsiteStore.publishSite(site.id,site.user_id,site.updated_at))!;
 const visitorId=randomUUID(),sessionId=randomUUID();await WebsiteAnalyticsStore.ingest({event:'website_template_previewed',visitorId,sessionId,metadata:{templateId:site.template_id}});await WebsiteAnalyticsStore.action('website_published',site.user_id,site.id,site.template_id);
 const app=express();app.use(express.json());app.use('/websites',adminWebsiteRouter);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${(server.address() as any).port}/websites`;
 const get=(id:string,token?:string)=>fetch(`${base}/${id}/engagement`,{headers:token?{Authorization:`Bearer ${token}`}:{}});
 try{
  assert.equal((await get(site.id)).status,401);assert.equal((await get(site.id,'synthetic-customer')).status,403);
  const empty=await get(site.id,'synthetic-admin');assert.equal(empty.status,200);assert.equal(empty.headers.get('cache-control'),'no-store');const e=(await empty.json()).engagement;assert.equal(e.views,0);assert.equal(e.lastObservedAt,null);
  for(let i=0;i<2;i++){await WebsiteAnalyticsStore.ingestPublic(site.id,{event:'site_view',visitorId,sessionId});await WebsiteAnalyticsStore.ingestPublic(site.id,{event:'whatsapp_click',visitorId,sessionId});}
  const observed=(await (await get(site.id,'synthetic-admin')).json()).engagement;assert.equal(observed.views,1);assert.equal(observed.approximateBrowsers,1);assert.equal(observed.whatsappClicks,1);assert.equal(observed.callClicks,0);assert.ok(observed.lastObservedAt);assert.ok(!JSON.stringify(observed).includes(visitorId));assert.ok(!JSON.stringify(observed).includes('@private.test'));
  assert.equal((await get('not-a-site','synthetic-admin')).status,400);assert.equal((await get('site_missing','synthetic-admin')).status,404);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});

test('invalid owner filters fail closed and combined filters retain pagination semantics',async()=>{
 await make();await make('mixed-owner');
 for(const activation of ['admin','draft',{},['draft_only']])await assert.rejects(AdminWebsiteStore.projects({range:'all',activation}),/Invalid website/);
 const first=await AdminWebsiteStore.projects({range:'all',activation:'eligible',limit:1,offset:0}),second=await AdminWebsiteStore.projects({range:'all',activation:'eligible',limit:1,offset:1});assert.equal(first.total,2);assert.notEqual(first.sites[0].id,second.sites[0].id);
 assert.equal((await AdminWebsiteStore.projects({range:'all',activation:'draft_only',status:'published'})).total,0);
});
test('archived projects and unknown owner records cannot inflate candidate counts',async()=>{
 const site=await make();WebsiteStore.allSites=async()=>[{...site,user_id:'missing-owner'}];
 assert.deepEqual((await AdminWebsiteStore.projects({range:'all'})).activation,{customerOwners:0,publishedOwners:0,draftOnlyOwners:0,excludedProjects:1});
 WebsiteStore.allSites=originalSites;await WebsiteStore.archiveSite(site.id,site.user_id);
 assert.equal((await AdminWebsiteStore.projects({range:'all'})).activation?.customerOwners,0);
});
test('analytics persistence failure does not prevent publication or fabricate engagement',async()=>{
 let site=await make();const original=(WebsiteAnalyticsStore as any).insert;const warn=console.warn;const logs:string[]=[];console.warn=(...args)=>logs.push(JSON.stringify(args));
 try{
  (WebsiteAnalyticsStore as any).insert=async()=>{throw Error('private-content-and-token');};
  site=(await WebsiteStore.publishSite(site.id,site.user_id,site.updated_at))!;await WebsiteAnalyticsStore.action('website_published',site.user_id,site.id,site.template_id);
  assert.equal((await WebsiteStore.findSiteById(site.id))?.status,'published');assert.equal((await WebsiteAnalyticsStore.publicEngagement(site.id)).views,0);assert.ok(!logs.join('').includes('private-content-and-token'));
 }finally{(WebsiteAnalyticsStore as any).insert=original;console.warn=warn;}
});
test('public contact events distinguish handoff links from internal navigation',async()=>{
 const {publicWebsiteClickKind}=await import('../../../src/services/websiteBusinessApi.js');
 const target=(href:string,tagName='A',mark?:string)=>({tagName,getAttribute:(key:string)=>key==='href'?href:key==='data-website-event'?mark:null}) as any;
 assert.equal(publicWebsiteClickKind(target('https://wa.me/233241111111')),'whatsapp_click');assert.equal(publicWebsiteClickKind(target('tel:+233241111111')),'call_click');assert.equal(publicWebsiteClickKind(target('mailto:synthetic@fixture.test')),'email_click');assert.equal(publicWebsiteClickKind(target('#menu')),null);assert.equal(publicWebsiteClickKind(target('','BUTTON')),null);
});
test('malformed successful engagement responses are unavailable, never fictional zeros',async()=>{
 const {getAdminWebsiteEngagement}=await import('../../../src/services/apiClient.js');const original=globalThis.fetch;
 try{
  for(const engagement of [undefined,{}, {since:'bad',through:'bad',views:0},{since:new Date().toISOString(),through:new Date().toISOString(),views:-1,approximateBrowsers:0,whatsappClicks:0,callClicks:0,emailClicks:0,lastObservedAt:null}]){
   globalThis.fetch=async()=>new Response(JSON.stringify({success:true,engagement}),{status:200});await assert.rejects(getAdminWebsiteEngagement('synthetic-admin','site_fixture'),/could not be verified/);
  }
 }finally{globalThis.fetch=original;}
});

test('engagement failure returns unavailable without leaking errors or blocking owner inspection',async()=>{
 await AuthStore.createSession('staff','synthetic-admin');await AuthStore.createSession('draft-owner','synthetic-customer');const site=await make(),original=WebsiteAnalyticsStore.publicEngagement,log=console.error;console.error=()=>{};
 const app=express();app.use(express.json(),adminWebsiteRouter);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as any).port}`;
 try{
  for(const token of [undefined,'synthetic-customer']){const response=await fetch(base+'/?range=all&activation=draft_only',{headers:token?{Authorization:'Bearer '+token}:{}});assert.equal(response.status,token?403:401);assert.ok(!(await response.text()).includes('draft-owner@private.test'));}
  WebsiteAnalyticsStore.publicEngagement=async()=>{throw Error('SYNTHETIC_PRIVATE_DB_ERROR');};
  const response=await fetch(`${base}/${site.id}/engagement`,{headers:{Authorization:'Bearer synthetic-admin'}});assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(!(await response.text()).includes('SYNTHETIC_PRIVATE_DB_ERROR'));
  const inspection=await fetch(`${base}/${site.id}`,{headers:{Authorization:'Bearer synthetic-admin'}});assert.equal(inspection.status,200);assert.equal((await inspection.json()).site.owner.email,'draft-owner@private.test');
 }finally{WebsiteAnalyticsStore.publicEngagement=original;console.error=log;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
