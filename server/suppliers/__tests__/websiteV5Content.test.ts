/** Website Builder V5 additive content model: validation, storage, publication, references and helpers. */
import assert from 'node:assert/strict';
import {test,beforeEach} from 'node:test';
import {WebsiteStore} from '../../db/websiteStore.js';
import {WebsiteAssetStore, websiteImageReferences} from '../../db/websiteAssetStore.js';
import {validateWebsiteContentPatch} from '../../services/websiteValidation.js';
import {publicWebsiteContent} from '../../services/websitePublication.js';
import {websiteMediaLimits} from '../../services/websiteCloudinary.js';
import {websiteOpenState, websiteHoursRows, websiteDirectionsUrl, displayTime, focalPosition, defaultWebsiteHours, type WebsiteHours} from '../../../src/config/websiteContentV5.js';
import {migrateWebsiteTemplate, websiteMigrationSummary} from '../../../src/utils/websiteTemplateMigration.js';
import {WEBSITE_MEDIA_DEFAULTS} from '../../../src/config/websiteMedia.js';

beforeEach(()=>{assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.DATABASE_URL,undefined);WebsiteStore.clearDevStore();WebsiteAssetStore.clearDevStore();});
const week=(open='11:00',close='21:00'):WebsiteHours=>({days:[0,1,2,3,4,5,6].map(i=>i===6?{closed:true}:{closed:false,open,close}),note:'Kitchen closes 30 minutes earlier'});
const v5={hours:week(),policies:{delivery:'Delivery in Osu and Labone, or pick up from the shop.',payment:'Mobile Money or cash on pickup.',returns:'Exchanges within 3 days with receipt.'},sections:{order:['menu','gallery'],hidden:['gallery']},imageMeta:{heroImage:{x:30,y:60,alt:'Jollof and grilled chicken on a plate'},logoUrl:{alt:'Esi Kitchen logo'}},gallery:['https://images.unsplash.com/photo-1'],pinnedBundles:['mtn-1gb','mtn-5gb']};
const item={id:'dish-1',name:'Jollof with chicken',price:'GH₵ 65',image:'https://images.unsplash.com/photo-2',images:['https://images.unsplash.com/photo-3'],label:'Spicy',pinned:true,alt:'Jollof',focal:{x:50,y:40},options:['Small','Large']};
async function site(template='tmpl-buka-bistro'){return (await WebsiteStore.createSite('owner',{template_id:template,name:'Esi Kitchen',content:{whatsapp:'0241234567'}})).site;}

test('a complete V5 payload validates, is stored normalized and stays private until published',async()=>{
  let record=await site();
  record=(await WebsiteStore.updateSite(record.id,'owner',{content:{...v5,items:[item]} as any,expectedUpdatedAt:record.updated_at}))!;
  assert.deepEqual(record.content_json.hours,v5.hours);assert.deepEqual(record.content_json.policies,v5.policies);assert.deepEqual(record.content_json.sections,v5.sections);
  assert.deepEqual(record.content_json.imageMeta,v5.imageMeta);assert.deepEqual(record.content_json.gallery,v5.gallery);assert.deepEqual(record.content_json.items![0],item);
  assert.equal((await WebsiteStore.findPublishedSiteBySlug(record.slug)),null);
  const live=(await WebsiteStore.publishSite(record.id,'owner',record.updated_at))!;const published=(await WebsiteStore.findPublishedSiteBySlug(live.slug))!;
  assert.deepEqual(published.content_json.hours,v5.hours);assert.deepEqual(published.content_json.items![0],item);assert.deepEqual(published.content_json.policies,v5.policies);
  const later=(await WebsiteStore.updateSite(record.id,'owner',{content:{policies:{returns:'No returns'}},expectedUpdatedAt:live.updated_at}))!;
  assert.equal(later.content_json.policies?.returns,'No returns');assert.equal((await WebsiteStore.findPublishedSiteBySlug(live.slug))!.content_json.policies?.returns,v5.policies.returns,'draft edits never leak to the live site');
});

test('older content without V5 fields validates, merges and publishes exactly as before',async()=>{
  const record=await site();const before=structuredClone(record.content_json);
  const saved=(await WebsiteStore.updateSite(record.id,'owner',{content:{tagline:'Fresh daily'},expectedUpdatedAt:record.updated_at}))!;
  for(const key of ['hours','policies','sections','imageMeta','gallery','pinnedBundles'])assert.equal(key in saved.content_json,false,key);
  assert.deepEqual({...saved.content_json,tagline:before.tagline},before);
  assert.deepEqual(Object.keys(publicWebsiteContent(saved.content_json)).filter(k=>['hours','policies','sections','imageMeta'].includes(k)),[]);
});

test('unsent V5 fields keep their saved values; null hours clears them; hero alt and focal merge',async()=>{
  let record=await site();record=(await WebsiteStore.updateSite(record.id,'owner',{content:v5 as any,expectedUpdatedAt:record.updated_at}))!;
  record=(await WebsiteStore.updateSite(record.id,'owner',{content:{tagline:'x'},expectedUpdatedAt:record.updated_at}))!;assert.deepEqual(record.content_json.hours,v5.hours);
  record=(await WebsiteStore.updateSite(record.id,'owner',{content:{imageMeta:{heroImage:{x:10,y:20}}},expectedUpdatedAt:record.updated_at}))!;assert.deepEqual(record.content_json.imageMeta,{heroImage:{x:10,y:20},logoUrl:{alt:'Esi Kitchen logo'}});
  record=(await WebsiteStore.updateSite(record.id,'owner',{content:{hours:null} as any,expectedUpdatedAt:record.updated_at}))!;assert.equal(record.content_json.hours,undefined);
});

const rejects:[string,unknown][]=[
  ['six days of hours',{hours:{days:week().days.slice(0,6)}}],['impossible time',{hours:{days:week('25:00').days}}],['missing close time',{hours:{days:[{closed:false,open:'09:00'},...week().days.slice(1)]}}],
  ['non-boolean closed',{hours:{days:[{closed:'no'},...week().days.slice(1)]}}],['unknown hours key',{hours:{...week(),timezone:'UTC'}}],['long note',{hours:{...week(),note:'x'.repeat(81)}}],
  ['unknown policy',{policies:{refunds:'x'}}],['unsafe policy',{policies:{delivery:'<script>alert(1)</script>'}}],['long policy',{policies:{payment:'x'.repeat(401)}}],
  ['bad section id',{sections:{order:['Menu Items']}}],['duplicate section',{sections:{hidden:['menu','menu']}}],['too many sections',{sections:{order:Array.from({length:17},(_,i)=>`s${i}`)}}],
  ['focal out of range',{imageMeta:{heroImage:{x:101,y:0}}}],['fractional focal',{imageMeta:{heroImage:{x:1.5,y:0}}}],['unknown image meta',{imageMeta:{cover:{}}}],['long alt',{imageMeta:{logoUrl:{alt:'x'.repeat(151)}}}],
  ['seven gallery photos',{gallery:Array.from({length:7},(_,i)=>`https://images.unsplash.com/p${i}`)}],['unsafe gallery url',{gallery:['javascript:alert(1)']}],['relative gallery url',{gallery:['/x.png']}],
  ['seven pinned bundles',{pinnedBundles:['a','b','c','d','e','f','g']}],['duplicate pinned bundle',{pinnedBundles:['mtn-1gb','mtn-1gb']}],['bad bundle id',{pinnedBundles:['MTN 1GB']}],
  ['three extra item photos',{items:[{...item,images:['https://a.example/1','https://a.example/2','https://a.example/3']}]}],['seven options',{items:[{...item,options:['1','2','3','4','5','6','7']}]}],
  ['empty option',{items:[{...item,options:['']}]}],['long label',{items:[{...item,label:'x'.repeat(31)}]}],['string pinned',{items:[{...item,pinned:'yes'}]}],['bad item focal',{items:[{...item,focal:{x:-1,y:3}}]}],['unknown item key',{items:[{...item,stock:3}]}],
];
for(const [name,content] of rejects)test(`V5 validation rejects ${name}`,()=>{assert.throws(()=>validateWebsiteContentPatch(content));});

test('gallery and extra item photos are image references: another website’s managed image is refused',async()=>{
  const record=await site();const foreign='https://res.cloudinary.com/fixture/image/upload/v1/mysteryhub/websites/site_other/asset_x.png';
  for(const content of [{gallery:[foreign]},{items:[{...item,images:[foreign]}]}])await assert.rejects(()=>WebsiteStore.updateSite(record.id,'owner',{content:content as any,expectedUpdatedAt:record.updated_at}),/verified image/);
  const refs=websiteImageReferences({...record.content_json,gallery:['https://a.example/g.png'],items:[{...item}]} as any).map(r=>r.location);
  assert.ok(refs.includes('Gallery photo 1'));assert.ok(refs.includes('Business item 1 photo 2'));
});

test('Free plan media limit is 60 images per website',()=>{assert.equal(WEBSITE_MEDIA_DEFAULTS.maxAssets,60);delete process.env.WEBSITE_FREE_MAX_ASSETS;assert.equal(websiteMediaLimits().maxAssets,60);});

test('"Open now" uses Accra time (UTC), handles overnight hours and hides itself without hours',()=>{
  const at=(iso:string)=>new Date(iso);
  // 2026-10-19 is a Monday.
  assert.deepEqual(websiteOpenState(week(),at('2026-10-19T12:00:00Z')),{open:true,label:'Open now · until 9 pm'});
  assert.deepEqual(websiteOpenState(week(),at('2026-10-19T09:30:00Z')),{open:false,label:'Closed now · opens 11 am'});
  assert.deepEqual(websiteOpenState(week(),at('2026-10-19T21:00:00Z')),{open:false,label:'Closed now · opens tomorrow 11 am'});
  assert.deepEqual(websiteOpenState(week(),at('2026-10-25T12:00:00Z')),{open:false,label:'Closed now · opens tomorrow 11 am'},'Sunday closed');
  assert.deepEqual(websiteOpenState(week(),at('2026-10-24T22:00:00Z')),{open:false,label:'Closed now · opens Monday 11 am'},'Saturday night skips closed Sunday');
  const late=week('18:00','02:00');
  assert.deepEqual(websiteOpenState(late,at('2026-10-19T23:30:00Z')),{open:true,label:'Open now · until 2 am'});
  assert.deepEqual(websiteOpenState(late,at('2026-10-20T01:15:00Z')),{open:true,label:'Open now · until 2 am'},'after midnight continues Monday night');
  assert.deepEqual(websiteOpenState(late,at('2026-10-20T03:00:00Z')),{open:false,label:'Closed now · opens 6 pm'});
  assert.deepEqual(websiteOpenState(late,at('2026-10-26T01:00:00Z')),{open:false,label:'Closed now · opens 6 pm'},'Sunday is closed, so Monday 1 am is closed');
  assert.equal(websiteOpenState(undefined),null);assert.equal(websiteOpenState({days:week().days.slice(0,6)}),null);
  assert.equal(websiteOpenState({days:week().days.map(()=>({closed:true}))}),null);
  assert.deepEqual(websiteOpenState(week('00:00','00:00'),at('2026-10-19T04:00:00Z')),{open:true,label:'Open now'});
});

test('hours rows group identical days and format times for people',()=>{
  assert.deepEqual(websiteHoursRows(week()),[{days:'Mon – Sat',time:'11 am – 9 pm'},{days:'Sunday',time:'Closed'}]);
  assert.equal(displayTime('00:30'),'12:30 am');assert.equal(displayTime('12:00'),'12 pm');assert.equal(displayTime('09:05'),'9:05 am');
  assert.equal(defaultWebsiteHours().days.length,7);assert.deepEqual(websiteHoursRows(undefined),[]);
});

test('directions link uses only the written location, safely encoded; focal positions are CSS-safe',()=>{
  assert.equal(websiteDirectionsUrl('Oxford Street, Osu & Labone'),'https://www.google.com/maps/search/?api=1&query=Oxford%20Street%2C%20Osu%20%26%20Labone');
  assert.equal(websiteDirectionsUrl('  '),null);assert.equal(websiteDirectionsUrl(undefined),null);
  assert.equal(focalPosition({x:30,y:60}),'30% 60%');assert.equal(focalPosition({x:300,y:1} as any),undefined);assert.equal(focalPosition(undefined),undefined);
});

test('changing to another industry keeps hours, policies and logo description; section choices reset',()=>{
  const content={businessName:'Esi',tagline:'t',aboutText:'',location:'Osu',phone:'',whatsapp:'',email:'',heroImage:'h',ctaLabel:'Order via WhatsApp',ctaTarget:'',...v5,items:[item]} as any;
  const moved=migrateWebsiteTemplate(content,'tmpl-buka-bistro','tmpl-legon-consult');
  assert.deepEqual(moved.hours,v5.hours);assert.deepEqual(moved.policies,v5.policies);assert.deepEqual(moved.imageMeta,{logoUrl:v5.imageMeta.logoUrl});
  assert.equal(moved.sections,undefined);assert.equal(moved.gallery,undefined);assert.deepEqual(moved.items,[]);
  assert.ok(websiteMigrationSummary('tmpl-buka-bistro','tmpl-legon-consult').kept.includes('Opening hours & policies'));
});
