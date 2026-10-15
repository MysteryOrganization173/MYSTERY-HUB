import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type {Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {WEBSITE_TEMPLATES} from '../../../src/data/templates';
import {websiteStarter} from '../../../src/config/websiteStarters';
import {websiteLayoutMode} from '../../../src/utils/websiteLayout';
import {websiteBusinessCapabilities} from '../../../src/utils/websiteBusinessCapabilities';
import {mergeSiteWithTemplate,renderTemplateLayout} from '../../../src/utils/templateRendererUtils';
import {WebsiteStore,WebsiteReviewRequiredError} from '../../db/websiteStore';
import {WebsiteCheckpointStore,WEBSITE_CHECKPOINT_LIMIT} from '../../db/websiteCheckpointStore';
import {WebsiteAssetStore} from '../../db/websiteAssetStore';
import {AuthStore} from '../../db/authStore';
import {websiteRouter} from '../../routes/websiteApi';
import {createWebsiteComposition} from '../../../src/config/websiteBuilder';
import {publicWebsiteContent} from '../../services/websitePublication';
import {validateWebsiteContentPatch} from '../../services/websiteValidation';
import {WEBSITE_CHECKPOINT_SCHEMA} from '../../db/websiteCheckpointSchema';
import {WebsiteBusinessService} from '../../services/websiteBusinessService';
import {FinanceStore} from '../../db/financeStore';
import {OrdersStore} from '../../db/ordersStore';
let server:Server,base:string;
before(async()=>{assert.equal(process.env.DATABASE_URL,undefined);const app=express();app.use(express.json());app.use('/api/websites',websiteRouter);server=await new Promise<Server>(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/websites`;});
after(async()=>{await new Promise<void>(r=>server.close(()=>r()));});
beforeEach(async()=>{WebsiteStore.clearDevStore();WebsiteAssetStore.clearDevStore();AuthStore._clearDevStore();for(const id of ['owner','other']){await AuthStore.createUser({id,name:id,email:null,phone:null,passwordHash:'fixture',role:'customer',status:'active'});await AuthStore.createSession(id,id+'-token',false);}});
const create=(templateId='tmpl-buka-bistro',owner='owner')=>WebsiteStore.createSite(owner,{template_id:templateId,name:'Actual owner business',businessName:'Actual owner business',starterVersion:1});
async function api(path:string,method='GET',body?:unknown,token:string|null='owner-token') {const r=await fetch(base+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body?{'Content-Type':'application/json'}:{ })},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
for(const template of WEBSITE_TEMPLATES.filter(t=>t.id!=='tmpl-data-reseller'&&t.id!=='tmpl-start-blank'))test(`B1 ${template.id}: starter/create/reload/example review/publication agree`,async()=>{
  const {site}=await create(template.id),starter=websiteStarter(template.id,'Actual owner business');
  assert.equal(site.content_json.starterVersion,1);assert.deepEqual(site.settings_json,starter.settings);
  assert.equal(site.name,site.content_json.businessName);assert.deepEqual(site.content_json.items,starter.content.items);assert.equal(site.content_json.items?.length,3);
  for(const i of site.content_json.items!){assert.equal(i.isExample,true);assert.equal(i.price,undefined);assert.equal(i.rating,undefined);assert.equal(i.specs,undefined);}
  for(const key of ['phone','whatsapp','email','location'] as const)assert.equal(site.content_json[key],'');
  assert.deepEqual(site.content_json.stats,[]);assert.deepEqual(site.content_json.features,[]);assert.equal(site.content_json.composition,undefined);
  const html=renderToStaticMarkup(renderTemplateLayout(mergeSiteWithTemplate(template,site.content_json)));assert.ok(html.includes('Example'));assert.ok(!html.includes('(48)'));
  await assert.rejects(()=>WebsiteStore.publishSite(site.id,'owner',site.updated_at),WebsiteReviewRequiredError);
  assert.equal((await WebsiteStore.findSiteById(site.id))?.status,'draft');
  const review=await api(`/${site.id}/review-examples`,'POST',{expectedUpdatedAt:site.updated_at,confirmed:true,itemIds:site.content_json.items!.map(i=>i.id),action:'confirm'});assert.equal(review.status,200);
  const published=await WebsiteStore.publishSite(site.id,'owner',review.data.site.updated_at);const live=(await WebsiteStore.findPublishedSiteBySlug(site.slug))!;
  assert.equal(live.content_json.items?.length,3);assert.ok(!JSON.stringify(live.content_json).includes('isExample'));assert.ok(published?.published_snapshot_json);
});
test('Start Blank remains sections; managed Data has no fictional products',async()=>{
  const blank=(await create('tmpl-start-blank')).site;assert.equal(websiteLayoutMode(blank.template_id,blank.content_json),'sections');assert.ok(blank.content_json.composition);
  await assert.rejects(()=>WebsiteStore.transitionLayout(blank.id,'owner','template',blank.updated_at),/Start Blank/);
  const data=(await create('tmpl-data-reseller','other')).site;assert.deepEqual(data.content_json.items,[]);assert.equal(websiteStarter(data.template_id,'Owner').capabilities.managed,true);
});
test('public starter preview uses same versioned factory and no customer records',async()=>{
  const preview=await api('/starter-preview?templateId=tmpl-glow-salon','GET',undefined,null);assert.equal(preview.status,200);assert.deepEqual(preview.data.content,websiteStarter('tmpl-glow-salon','Your business').content);
  assert.equal((await api('/starter-preview?templateId=unknown','GET',undefined,null)).status,400);
  await assert.rejects(()=>WebsiteStore.createSite('owner',{template_id:'tmpl-buka-bistro',name:'x',businessName:'x',starterVersion:0}),/Starter content changed/);
  await assert.rejects(()=>WebsiteStore.createSite('owner',{template_id:'tmpl-buka-bistro',name:'x',businessName:' ',starterVersion:1}),/Required text/);
});
test('HTTP publication fails visibly with structured review details, not silent filtering',async()=>{
  const {site}=await create();const result=await api(`/${site.id}/publish`,'POST',{expectedUpdatedAt:site.updated_at});
  assert.equal(result.status,409);assert.equal(result.data.code,'EXAMPLE_REVIEW_REQUIRED');assert.equal(result.data.review.count,3);
  assert.equal((await api(`/${site.id}/publication-readiness`)).data.canPublish,false);
  const removed=await api(`/${site.id}/review-examples`,'POST',{expectedUpdatedAt:site.updated_at,confirmed:true,itemIds:site.content_json.items!.map(i=>i.id),action:'remove'});assert.equal(removed.status,200);
  const live=await WebsiteStore.publishSite(site.id,'owner',removed.data.site.updated_at);assert.deepEqual(live?.published_snapshot_json?.content.items,[]);
  const saved=await WebsiteStore.updateSite(site.id,'owner',{expectedUpdatedAt:live!.updated_at,content:{tagline:'Owner edit'}});assert.deepEqual(saved?.content_json.items,[]);
});
test('legacy sites never reseed; intentionally supplied empty arrays stay empty',async()=>{
  const {site}=await WebsiteStore.createSite('owner',{template_id:'tmpl-buka-bistro',name:'Legacy',content:{items:[]}});assert.equal(site.content_json.layoutMode,undefined);assert.deepEqual(site.content_json.items,[]);
  const published=(await WebsiteStore.publishSite(site.id,'owner',site.updated_at))!;const snapshot=structuredClone(published.published_snapshot_json);
  const changed=(await WebsiteStore.updateSite(site.id,'owner',{expectedUpdatedAt:published.updated_at,content:{tagline:'Private'}}))!;assert.deepEqual(changed.published_snapshot_json,snapshot);assert.deepEqual((await WebsiteStore.findPublishedSiteBySlug(site.slug))!.content_json.tagline,'Welcome to our business');
  const another=await WebsiteStore.createSite('other',{template_id:'tmpl-buka-bistro',name:'Owner',businessName:'Owner',starterVersion:1,content:{items:[]}});assert.deepEqual(another.site.content_json.items,[]);
});
test('normal edits retain example status until explicit review, including price edits and metadata dropped by old clients',async()=>{
  const {site}=await create();
  const items=site.content_json.items!.map(({isExample,...item})=>({...item,price:'25.00'}));
  const saved=(await WebsiteStore.updateSite(site.id,'owner',{expectedUpdatedAt:site.updated_at,content:{items}}))!;
  assert.ok(saved.content_json.items!.every(item=>item.isExample));
  await assert.rejects(()=>WebsiteStore.updateSite(site.id,'owner',{expectedUpdatedAt:saved.updated_at,content:{items:items.map(i=>({...i,name:''}))}}),/explicitly remove/);
  await assert.rejects(()=>WebsiteStore.publishSite(site.id,'owner',saved.updated_at),WebsiteReviewRequiredError);
  const confirmed=await api(`/${site.id}/review-examples`,'POST',{expectedUpdatedAt:saved.updated_at,confirmed:true,itemIds:items.map(i=>i.id),action:'confirm'});
  assert.equal(confirmed.status,200);assert.ok(confirmed.data.site.content_json.items.every((i:any)=>i.isExample===false));
  assert.equal((await WebsiteStore.publishSite(site.id,'owner',confirmed.data.site.updated_at))!.published_snapshot_json!.content.items![0].price,'25.00');
});
test('private recovery HTTP contracts reject foreign/stale/forged data, expose metadata separately and restore saved content only',async()=>{
  const {site}=await create();const layout=await api(`/${site.id}/layout`,'POST',{mode:'sections',confirmed:true,expectedUpdatedAt:site.updated_at});assert.equal(layout.status,200);
  const history=await api(`/${site.id}/checkpoints`),checkpoint=history.data.checkpoints[0];assert.equal(history.status,200);assert.equal(checkpoint.document,undefined);
  const plan=await api(`/${site.id}/template-plan?targetTemplateId=tmpl-glow-salon`);assert.equal(plan.status,200);assert.equal(plan.data.revision,layout.data.site.updated_at);assert.equal(plan.data.checkpointSlotsRemaining,9);
  assert.equal((await api(`/${site.id}/checkpoints/${checkpoint.id}`,'GET',undefined,'other-token')).status,403);
  assert.equal((await api(`/${site.id}/checkpoints/${checkpoint.id}`)).data.checkpoint.document.content.businessName,site.name);
  for(const extra of [{document:{}},{status:'published'},{slug:'changed'},{user_id:'other'}])assert.equal((await api(`/${site.id}/restore-draft`,'POST',{checkpointId:checkpoint.id,confirmed:true,expectedUpdatedAt:layout.data.site.updated_at,...extra})).status,400);
  assert.equal((await api(`/${site.id}/restore-draft`,'POST',{checkpointId:checkpoint.id,confirmed:true,expectedUpdatedAt:site.updated_at})).status,409);
  const restored=await api(`/${site.id}/restore-draft`,'POST',{checkpointId:checkpoint.id,confirmed:true,expectedUpdatedAt:layout.data.site.updated_at});assert.equal(restored.status,200);assert.deepEqual(restored.data.site.content_json,site.content_json);
  assert.equal((await api(`/${site.id}/review-examples`,'POST',{itemIds:[site.content_json.items![0].id],action:'confirm',confirmed:true,expectedUpdatedAt:site.updated_at})).status,409);
});
test('layout round-trip retains inactive sections, original items, identity and live snapshot',async()=>{
  const {site}=await WebsiteStore.createSite('owner',{template_id:'tmpl-buka-bistro',name:'Legacy',content:{items:[{id:'food',name:'Actual food'}]}});
  const published=(await WebsiteStore.publishSite(site.id,'owner',site.updated_at))!,snapshot=structuredClone(published.published_snapshot_json);
  const sections=await WebsiteStore.transitionLayout(site.id,'owner','sections',published.updated_at);
  const edited=(await WebsiteStore.updateSite(site.id,'owner',{expectedUpdatedAt:sections.updated_at,content:{composition:{...sections.content_json.composition!,sections:sections.content_json.composition!.sections.map(s=>s.type==='hero'?{...s,data:{heading:'Sections only'}}:s)}}}))!;
  const dedicated=await WebsiteStore.transitionLayout(site.id,'owner','template',edited.updated_at);
  assert.equal(dedicated.content_json.composition?.sections[1].data.heading,'Sections only');assert.equal(mergeSiteWithTemplate(WEBSITE_TEMPLATES[0],dedicated.content_json).composition,undefined);
  assert.equal(publicWebsiteContent(dedicated.content_json).composition,undefined);assert.equal((await WebsiteStore.transitionLayout(site.id,'owner','sections',dedicated.updated_at)).content_json.composition?.sections[1].data.heading,'Sections only');
  assert.deepEqual((await WebsiteStore.findSiteById(site.id))!.published_snapshot_json,snapshot);assert.equal(dedicated.slug,published.slug);assert.equal(dedicated.user_id,published.user_id);
});
test('explicit sections publication excludes disabled content while retaining valid public order and private draft',async()=>{
  const composition=createWebsiteComposition(['header','hero','about','footer']);composition.sections[2].enabled=false;composition.sections[2].data.body='Private disabled content';
  const b1=(await WebsiteStore.createSite('other',{template_id:'tmpl-start-blank',name:'Owner',businessName:'Owner',starterVersion:1,content:{composition}})).site;
  const published=(await WebsiteStore.publishSite(b1.id,'other',b1.updated_at))!;
  const content=published.published_snapshot_json!.content;assert.equal(content.composition!.sections.length,3);assert.deepEqual(content.composition!.sections.map(s=>s.order),[0,1,2]);assert.ok(!JSON.stringify(content).includes('Private disabled content'));
  assert.equal(published.content_json.composition!.sections.length,4);
});
test('switch and restore recover exact draft without touching URL/status/published snapshot',async()=>{
  const {site}=await WebsiteStore.createSite('owner',{template_id:'tmpl-buka-bistro',name:'Owner',content:{tagline:'Original',items:[{id:'dish',name:'Owner dish'}]},settings:{accentColor:'#abcdef'}});
  const published=(await WebsiteStore.publishSite(site.id,'owner',site.updated_at))!;const draft=(await WebsiteStore.updateSite(site.id,'owner',{expectedUpdatedAt:published.updated_at,content:{tagline:'Unpublished work'}}))!;
  const switched=await WebsiteStore.changeTemplate(site.id,'owner','tmpl-glow-salon',draft.updated_at),checkpoint=(await WebsiteCheckpointStore.forSite(site.id,'owner'))[0];
  assert.deepEqual(switched.content_json.items,[]);assert.deepEqual(checkpoint.document.content,draft.content_json);assert.equal((await WebsiteStore.findPublishedSiteBySlug(site.slug))!.template_id,site.template_id);
  const restored=await WebsiteStore.restoreDraft(site.id,'owner',checkpoint.id,switched.updated_at);assert.deepEqual(restored.content_json,draft.content_json);assert.deepEqual(restored.settings_json,draft.settings_json);assert.equal(restored.slug,site.slug);assert.equal(restored.status,'published');assert.deepEqual(restored.published_snapshot_json,published.published_snapshot_json);
  await assert.rejects(()=>WebsiteStore.restoreDraft(site.id,'other',checkpoint.id,restored.updated_at),/do not own/);
  await assert.rejects(()=>WebsiteStore.restoreDraft(site.id,'owner',checkpoint.id,switched.updated_at),/changed/);
});
test('same revision cannot win concurrent layout mutations; denied actions have no checkpoint',async()=>{
  const {site}=await WebsiteStore.createSite('owner',{template_id:'tmpl-buka-bistro',name:'Owner'});
  const results=await Promise.allSettled([1,2].map(()=>WebsiteStore.transitionLayout(site.id,'owner','sections',site.updated_at)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await WebsiteCheckpointStore.forSite(site.id,'owner')).length,1);
  const before=await WebsiteStore.findSiteById(site.id);await assert.rejects(()=>WebsiteStore.changeTemplate(site.id,'other','tmpl-glow-salon',before!.updated_at),/do not own/);assert.deepEqual(await WebsiteStore.findSiteById(site.id),before);
});
test('history is bounded; explicit removal frees a slot, never automatic eviction',async()=>{
  let site=(await WebsiteStore.createSite('owner',{template_id:'tmpl-buka-bistro',name:'Owner'})).site;
  for(let n=0;n<WEBSITE_CHECKPOINT_LIMIT;n++)site=await WebsiteStore.transitionLayout(site.id,'owner',n%2?'template':'sections',site.updated_at);
  const checkpoints=await WebsiteCheckpointStore.forSite(site.id,'owner');assert.equal(checkpoints.length,WEBSITE_CHECKPOINT_LIMIT);
  await assert.rejects(()=>WebsiteStore.transitionLayout(site.id,'owner','sections',site.updated_at),/history is full/);assert.deepEqual(await WebsiteStore.findSiteById(site.id),site);
  assert.equal((await api(`/${site.id}/checkpoints/${checkpoints[0].id}`,'DELETE',{expectedUpdatedAt:site.updated_at,confirmed:true})).status,200);
  assert.equal((await WebsiteCheckpointStore.forSite(site.id,'owner')).length,WEBSITE_CHECKPOINT_LIMIT-1);
});
test('auth, confirmation, revision and field allowlists protect new actions and private history',async()=>{
  const {site}=await create();
  assert.equal((await api(`/${site.id}/checkpoints`,'GET',undefined,null)).status,401);
  assert.equal((await api(`/${site.id}/checkpoints`,'GET',undefined,'other-token')).status,403);
  assert.equal((await api(`/${site.id}/layout`,'POST',{mode:'sections',expectedUpdatedAt:site.updated_at,confirmed:true,user_id:'other'})).status,400);
  assert.equal((await api(`/${site.id}/layout`,'POST',{mode:'bad',expectedUpdatedAt:site.updated_at,confirmed:true})).status,400);
  assert.equal((await api(`/${site.id}/layout`,'POST',{mode:'sections',expectedUpdatedAt:'stale',confirmed:true})).status,409);
  assert.equal((await WebsiteCheckpointStore.forSite(site.id,'owner')).length,0);
  await assert.rejects(()=>WebsiteStore.changeTemplate(site.id,'owner','tmpl-glow-salon',''),/changed/);
  await assert.rejects(()=>WebsiteStore.updateSite(site.id,'owner',{expectedUpdatedAt:site.updated_at,content:{composition:createWebsiteComposition()}}),/confirmed layout/);
});
test('finite validation and public projections cannot expose example metadata or inactive layouts',()=>{
  for(const items of [[{id:'1',name:'x',isExample:'yes'}],[{name:'x',isExample:true}],[{id:'same',name:'a'},{id:'same',name:'b'}],[{id:'1',name:'<img>'}],[{id:'1',name:'x',image:'javascript:alert(1)'}]])assert.throws(()=>validateWebsiteContentPatch({items}));
  assert.throws(()=>validateWebsiteContentPatch({layoutMode:'unknown'}));
  const publicContent=publicWebsiteContent({layoutMode:'template',items:[{id:'1',name:'hidden',isExample:true},{id:'2',name:'owner',isExample:false,secret:'no'}],composition:createWebsiteComposition()});
  assert.deepEqual(publicContent.items,[{id:'2',name:'owner'}]);assert.equal(publicContent.composition,undefined);assert.ok(!JSON.stringify(publicContent).includes('isExample'));
  const sections=publicWebsiteContent({layoutMode:'sections',items:[{name:'inactive menu'}],composition:createWebsiteComposition()});assert.equal(sections.items,undefined);
});
test('non-Data owner summary preserves zero-value historical order access and owner-level earnings without new finance mutations',async()=>{
  FinanceStore._reset();OrdersStore.clearDevStore();
  const {site}=await WebsiteStore.createSite('owner',{template_id:'tmpl-glow-salon',name:'Current non-Data business'});
  const originalOrders=WebsiteBusinessService.siteOrders;
  // An unpaid historical order should expose history without creating an earning.
  const order:any={id:'historical',public_reference:'fixture',created_at:new Date().toISOString(),network:'mtn',bundle_size_snapshot:'1GB',recipient_phone:'0241234567',amount:0,status:'pending',payment_status:'pending',store_context:{siteId:site.id,ownerId:'owner',earningMinor:0}};
  WebsiteBusinessService.siteOrders=async()=>[order];
  try{
    const before=await FinanceStore.transaction('owner',async tx=>({operations:await tx.operations(),ledger:await tx.ledger(),earnings:await tx.storeEarnings()}));
    const result=await WebsiteBusinessService.ownerSummary(site.id,'owner');assert.equal(result.capabilities.hasStoreHistory,true);assert.equal(result.capabilities.draftManaged,false);assert.equal(result.orders.length,1);assert.equal(result.capabilities.earningsScope,'owner');
    const after=await FinanceStore.transaction('owner',async tx=>({operations:await tx.operations(),ledger:await tx.ledger(),earnings:await tx.storeEarnings()}));assert.deepEqual(after,before);
  }finally{WebsiteBusinessService.siteOrders=originalOrders;}
});
test('same-name creation remains unique, real names authoritative, later identity changes keep URL',async()=>{
  const sites=await Promise.all(['owner','other'].map(id=>WebsiteStore.createSite(id,{template_id:'tmpl-glow-salon',name:'Ignored demo',businessName:'Ama Beauty',starterVersion:1})));
  assert.notEqual(sites[0].site.slug,sites[1].site.slug);assert.equal(sites[0].site.name,'Ama Beauty');assert.equal(sites[0].site.content_json.businessName,'Ama Beauty');
  const changed=await WebsiteStore.updateSite(sites[0].site.id,'owner',{expectedUpdatedAt:sites[0].site.updated_at,name:'New name',content:{businessName:'New name'}});assert.equal(changed?.slug,sites[0].site.slug);
});
for(const kind of ['store_sale','withdrawal','reversal'])test(`history capabilities retain zero/pending/reversed ${kind} without balance calculations`,()=>{
  const site:any={id:'site',template_id:'tmpl-glow-salon',status:'published',published_snapshot_json:{templateId:'tmpl-data-reseller'}};
  const operations=[{kind,payload:{siteId:'site',source:'store'},amount_minor:0,state:'manual_review'}],before=structuredClone(operations);
  const flags=websiteBusinessCapabilities(site,false,operations,false);assert.equal(flags.hasStoreHistory,true);assert.equal(flags.hasStoreFundsOrWithdrawals,true);assert.equal(flags.liveManaged,true);assert.equal(flags.draftManaged,false);assert.equal(flags.earningsScope,'owner');assert.deepEqual(operations,before);
});
test('schema mirror and backend-only role protections are explicit',()=>{
  assert.ok(readFileSync('server/db/schema.sql','utf8').replace(/\r\n/g,'\n').includes(WEBSITE_CHECKPOINT_SCHEMA.trim()));
  assert.match(WEBSITE_CHECKPOINT_SCHEMA,/ENABLE ROW LEVEL SECURITY/);assert.match(WEBSITE_CHECKPOINT_SCHEMA,/REVOKE ALL/);assert.ok(!WEBSITE_CHECKPOINT_SCHEMA.includes('GRANT ALL'));
});
