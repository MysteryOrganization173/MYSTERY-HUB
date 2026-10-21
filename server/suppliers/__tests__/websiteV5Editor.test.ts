/** Website Builder V5 editor: undo, publish summary, draft recovery, conflict-safe clears and colour sets. */
import assert from 'node:assert/strict';
import {test,beforeEach} from 'node:test';
import {readFileSync} from 'node:fs';
import {applyUndo,pushUndo,undoDiff,undoLabel,UNDO_COALESCE_MS,UNDO_LIMIT,type UndoDraft} from '../../../src/utils/websiteUndo.js';
import {websitePublishChanges} from '../../../src/utils/websitePublishChanges.js';
import {WEBSITE_PALETTES,paletteIsReadable} from '../../../src/utils/websitePalettes.js';
import {readDraftRecovery,writeDraftRecovery,clearDraftRecovery,withV5Clears} from '../../../src/utils/websiteDraftRecovery.js';
import {WebsiteStore} from '../../db/websiteStore.js';
import {websiteBrowserKeys} from '../../../src/utils/websiteDeletion.js';
import type {SiteContent,SiteSettings} from '../../../src/types/index.js';

const settings:SiteSettings={primaryColor:'#111111',accentColor:'#00a85a',backgroundColor:'#ffffff',fontFamily:'font-sans',borderRadius:'rounded-xl'};
const draft=(content:Partial<SiteContent>,s:Partial<SiteSettings>={}):UndoDraft=>({content:{businessName:'Fixture',tagline:'One',...content} as any,settings:{...settings,...s} as any});

test('undo reverts only the newest change that is still in place, never an unrelated later edit',()=>{
  const a=draft({}),b=draft({tagline:'Two'}),c=draft({tagline:'Two',businessName:'Renamed'});
  let stack=pushUndo([],undoDiff(a,b),0);stack=pushUndo(stack,undoDiff(b,c),10_000);
  let r=applyUndo(stack,c);assert.equal(r.draft.content.businessName,'Fixture');assert.equal(r.draft.content.tagline,'Two','the later tagline edit is untouched');assert.equal(undoLabel(r.entry),'business name');
  r=applyUndo(r.stack,r.draft);assert.equal(r.draft.content.tagline,'One');
  // An entry whose field was overwritten afterwards (e.g. by a restored version) is skipped, not forced back.
  const overwritten=draft({tagline:'Server version'});assert.equal(applyUndo(pushUndo([],undoDiff(a,b),0),overwritten).entry,null);
});

test('typing into one field is one undo step; limits hold; removed fields come back',()=>{
  let stack=pushUndo([],undoDiff(draft({}),draft({tagline:'O'})),0);
  stack=pushUndo(stack,undoDiff(draft({tagline:'O'}),draft({tagline:'On'})),UNDO_COALESCE_MS-1);
  assert.equal(stack.length,1);assert.equal(applyUndo(stack,draft({tagline:'On'})).draft.content.tagline,'One');
  let many:any[]=[];for(let i=0;i<UNDO_LIMIT+10;i++)many=pushUndo(many,undoDiff(draft({tagline:String(i)}),draft({tagline:String(i+1)})),i*10_000);assert.equal(many.length,UNDO_LIMIT);
  const withHours=draft({hours:{days:[]}} as any),without=draft({});
  assert.deepEqual(applyUndo(pushUndo([],undoDiff(withHours,without),0),without).draft.content.hours,{days:[]});
  const palette=undoDiff(draft({}),draft({},{accentColor:'#e8833a',backgroundColor:'#140d0b'}));assert.equal(undoLabel({fields:palette,at:0}),'colours');
});

test('the publish summary names what changes on the live website, in plain words',()=>{
  const live:SiteContent={businessName:'Fixture',tagline:'Old',items:[{id:'a',name:'A'},{id:'b',name:'B'}]} as SiteContent;
  const snapshot={version:1 as const,templateId:'tmpl-buka-bistro',name:'Fixture',content:live,settings,draftUpdatedAt:'r1',publishedAt:'r1'};
  assert.deepEqual(websitePublishChanges(snapshot,{templateId:'tmpl-buka-bistro',content:live,settings},'dish'),[]);
  const next={...live,tagline:'New',whatsapp:'0241234567',hours:{days:[]},items:[{id:'a',name:'A2'},{id:'c',name:'C'}]} as any;
  assert.deepEqual(websitePublishChanges(snapshot,{templateId:'tmpl-night-kitchen',content:next,settings:{...settings,accentColor:'#e8833a'}},'dish'),
    ['New design: Night Kitchen','Headline','Opening hours','Contact details','1 dish added','1 dish removed','1 dish changed','Colours']);
  assert.deepEqual(websitePublishChanges(null,{templateId:'x',content:live,settings}),[]);
});

test('draft recovery is offered only when it holds unsaved work, expires, and is cleared on delete',()=>{
  const store=new Map<string,string>();(globalThis as any).localStorage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v),removeItem:(k:string)=>store.delete(k)};
  const site={id:'site_fixture',name:'Fixture',content_json:{businessName:'Fixture',tagline:'Saved'} as SiteContent,settings_json:settings};
  writeDraftRecovery(site.id,{base:'r1',name:'Fixture',content:{...site.content_json,tagline:'Unsaved'},settings});
  assert.equal(readDraftRecovery(site)!.content.tagline,'Unsaved');
  assert.equal(readDraftRecovery({...site,content_json:{...site.content_json,tagline:'Unsaved'}}),null,'already saved: nothing to offer');
  writeDraftRecovery(site.id,{base:'r1',name:'Fixture',content:{...site.content_json,tagline:'Old'},settings});
  assert.equal(readDraftRecovery(site,Date.now()+15*24*3600_000),null,'older than two weeks is dropped');
  assert.ok(websiteBrowserKeys(site.id).includes(`mh_website_draft_recovery:${site.id}`),'deleting the website removes it');
  clearDraftRecovery(site.id);assert.equal(store.size,0);delete (globalThis as any).localStorage;
});

beforeEach(()=>WebsiteStore.clearDevStore());
test('removing hours, policies, sections or gallery in the editor clears them on the server',async()=>{
  let site=(await WebsiteStore.createSite('owner',{template_id:'tmpl-night-kitchen',name:'Fixture'} as any)).site;
  const v5={hours:{days:[0,1,2,3,4,5,6].map(()=>({closed:true}))},policies:{delivery:'Fixture'},sections:{hidden:['gallery']},gallery:['https://images.unsplash.com/photo-fixture']};
  site=(await WebsiteStore.updateSite(site.id,'owner',{content:{...site.content_json,...v5} as any,expectedUpdatedAt:site.updated_at}))!;
  for(const key of Object.keys(v5))assert.ok((site.content_json as any)[key],key);
  const edited={...site.content_json};for(const key of Object.keys(v5))delete (edited as any)[key];
  const payload=withV5Clears(site.content_json,edited as SiteContent);for(const key of Object.keys(v5))assert.equal((payload as any)[key],null,key);
  site=(await WebsiteStore.updateSite(site.id,'owner',{content:payload as any,expectedUpdatedAt:site.updated_at}))!;
  for(const key of Object.keys(v5))assert.equal((site.content_json as any)[key],undefined,key);
  assert.deepEqual(withV5Clears({} as SiteContent,{tagline:'x'} as SiteContent),{tagline:'x'},'nothing saved, nothing cleared');
});

test('curated colour sets keep button text and accents readable',()=>{
  assert.ok(WEBSITE_PALETTES.length>=6);for(const p of WEBSITE_PALETTES)assert.ok(paletteIsReadable(p),p.name);
});

test('the editor reports failed and offline saves and asks before overwriting a newer version',()=>{
  const toolbar=readFileSync('src/components/website/editor/WebsiteEditorToolbar.tsx','utf8'),editor=readFileSync('src/components/website/editor/WebsiteEditor.tsx','utf8');
  for(const text of ['Offline · changes kept on this device','Not saved · tap Save to retry','Draft saved · not on your live site yet','Saved · live site is up to date'])assert.ok(toolbar.includes(text),text);
  assert.match(editor,/err instanceof WebsiteSaveConflict/);assert.match(editor,/<WebsiteConflictSheet/);assert.match(editor,/addEventListener\('online'/);
  assert.match(readFileSync('src/services/apiClient.ts','utf8'),/res\.status === 409 && \/changed\/i/);
});

import {websiteCompressionPlan,formatImageBytes,prepareWebsiteImage,WEBSITE_IMAGE_TARGET} from '../../../src/utils/websiteImageCompression.js';
test('phone photos are resized before upload; small images and unsupported browsers keep the original',async()=>{
  assert.deepEqual(websiteCompressionPlan(4032,3024,4_800_000),{resize:true,width:2000,height:1500,reencode:true});
  assert.equal(websiteCompressionPlan(1200,800,900_000).reencode,false,'already web-sized');
  assert.equal(websiteCompressionPlan(1600,1200,2_400_000).reencode,true,'heavy but not wide is re-encoded');
  assert.equal(websiteCompressionPlan(3000,3000,200_000).reencode,false,'tiny files are left alone');
  assert.equal(WEBSITE_IMAGE_TARGET.maxEdge,2000);assert.equal(formatImageBytes(4_200_000),'4.2 MB');assert.equal(formatImageBytes(610_000),'610 KB');
  const file=new File([new Uint8Array(1000)],'a.jpg',{type:'image/jpeg'});
  assert.equal((await prepareWebsiteImage(file,8_000_000)).file,file,'no canvas support: original is uploaded');
  await assert.rejects(prepareWebsiteImage(new File([new Uint8Array(2000)],'b.jpg',{type:'image/jpeg'}),1000));
  assert.match(readFileSync('src/components/website/editor/WebsiteImageField.tsx','utf8'),/prepareWebsiteImage\(original,limits\.maxBytes\)/);
});

test('Data owners pick featured bundles from what is on sale, within the limit, saved as site content',()=>{
  const controls=readFileSync('src/components/website/editor/WebsiteV5Controls.tsx','utf8'),editor=readFileSync('src/components/website/editor/WebsiteEditor.tsx','utf8');
  assert.match(controls,/filter\(\(p: any\) => p\.eligible\)/,'only bundles on sale');
  assert.match(controls,/\.slice\(0, WEBSITE_V5_LIMITS\.pinnedBundles\)/);
  assert.match(editor,/<WebsiteFeaturedBundlesControl siteId=\{currentSite\.id\} token=\{sessionToken\} value=\{content\.pinnedBundles\}/);
  assert.match(readFileSync('src/components/website/ManagedDataStorefront.tsx','utf8'),/pinnedBundles\|\|\[\]\)\.filter\(id=>bundles\.some\(b=>b\.id===id/,'the store drops picks that are no longer on sale');
});
