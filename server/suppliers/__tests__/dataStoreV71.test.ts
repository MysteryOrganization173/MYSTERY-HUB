/**
 * V7.1 Premium Data Store: store styles (Horizon, Market, Studio, Classic), wording ideas, the owner's style picker,
 * the share kit, and the guarantees around them: existing stores keep Classic untouched, the checkout contract and
 * server prices are unchanged, and nothing invented (prices, speeds, reviews) enters a store or a message.
 */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {WEBSITE_TEMPLATES} from '../../../src/data/templates.js';
import {mergeSiteWithTemplate,renderTemplateLayout} from '../../../src/utils/templateRendererUtils.js';
import {websiteStarter,WEBSITE_STARTER_VERSION} from '../../../src/config/websiteStarters.js';
import {WEBSITE_STYLE_VARIANTS,WEBSITE_STYLE_VARIANT_IDS,resolveWebsiteStyle,DATA_STORE_COPY_IDEAS} from '../../../src/config/websiteStyleVariants.js';
import {validateWebsiteContentPatch,websiteV5Fields} from '../../services/websiteValidation.js';
import {createPublishedSnapshot,publicWebsiteContent,publishedWebsiteRecord} from '../../services/websitePublication.js';
import {withV5Clears} from '../../../src/utils/websiteDraftRecovery.js';
import {websitePublishChanges} from '../../../src/utils/websitePublishChanges.js';
import {DATA_RESELLER_LEGACY_HERO_IMAGE as LEGACY,DATA_RESELLER_STARTER_HERO_IMAGE as STARTER} from '../../../src/utils/dataResellerArtwork.js';
import {storeShareMessages} from '../../../src/components/website/StoreShareKit.js';
import {WebsiteStoreLook,WebsiteCopyIdeas} from '../../../src/components/website/editor/WebsiteStoreLook.js';
import {VisualEditContext} from '../../../src/components/website/editor/VisualEditMarkers.js';
import {visualTargets} from '../../../src/utils/websiteVisualEditing.js';
import {WebsiteStore} from '../../db/websiteStore.js';
import type {SiteContent,SiteSettings} from '../../../src/types/index.js';

const data=WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-data-reseller')!;
const source=(path:string)=>readFileSync(path,'utf8');
const LOGO='https://res.cloudinary.com/da6oeat7m/image/upload/v1/owner-uploads/quickbyte-logo.png';
const settings:SiteSettings={primaryColor:'#0f172a',accentColor:'#2563eb',backgroundColor:'#0a0f1d',fontFamily:'font-sans',borderRadius:'rounded-xl'};
// The protected QuickByte-style store as it is saved today: no styleVariant, the legacy banner, its own wording.
const legacy:SiteContent={businessName:'Quickbyte data',tagline:'Affordable data. Simple delivery.',aboutText:'Buy MTN, Telecel and AirtelTigo bundles from one simple storefront.',location:'Dansoman',phone:'0240000000',whatsapp:'0240000000',email:'',logoUrl:LOGO,heroImage:LEGACY,ctaLabel:'Buy Data',ctaTarget:'',social:{},items:[],stats:[],features:[]};
const managed=React.createElement('div',{id:'managed-fixture'});
const render=(content:SiteContent|undefined,extra:Record<string,unknown>={})=>renderToStaticMarkup(renderTemplateLayout(content?mergeSiteWithTemplate(data,content,settings):data,{managedCheckout:managed,managedAvailability:'available',...extra} as any));

test('style registry: Data Store styles (seven since V7.2), Horizon for new stores, Classic for every existing store without a choice',()=>{
  assert.deepEqual(WEBSITE_STYLE_VARIANTS.reseller.map(s=>s.id),['horizon','market','studio','compact','editorial','signature','classic']);
  assert.equal(resolveWebsiteStyle('reseller',undefined,true),'classic','an existing owner keeps the original look');
  assert.equal(resolveWebsiteStyle('reseller',undefined,false),'market','the gallery shows the new default (V7.4: Market)');
  assert.equal(resolveWebsiteStyle('reseller','neon',true),'classic','an unknown saved value never changes an owner store');
  assert.equal(resolveWebsiteStyle('reseller','studio',true),'studio');
  assert.equal(resolveWebsiteStyle('boutique','horizon',true),'','layouts without variants are untouched');
});

test('server accepts only offered styles; null clears; the published snapshot carries the choice',()=>{
  for(const id of WEBSITE_STYLE_VARIANT_IDS)assert.doesNotThrow(()=>validateWebsiteContentPatch({styleVariant:id}));
  for(const bad of ['neon','<b>','',3,{}])assert.throws(()=>validateWebsiteContentPatch({styleVariant:bad}),/offered styles/);
  assert.deepEqual(websiteV5Fields({styleVariant:null}),{styleVariant:null});
  assert.equal(publicWebsiteContent({...legacy,styleVariant:'market'}).styleVariant,'market');
  assert.ok(!('styleVariant' in publicWebsiteContent(legacy)),'no value is invented for a store that never chose');
  assert.deepEqual(withV5Clears({...legacy,styleVariant:'studio'},legacy as SiteContent),{...legacy,styleVariant:null},'removing a style in the editor clears it on save');
  const snapshot={version:1 as const,templateId:'tmpl-data-reseller',name:'Q',content:legacy,settings,draftUpdatedAt:'',publishedAt:''};
  assert.deepEqual(websitePublishChanges(snapshot,{templateId:'tmpl-data-reseller',content:{...legacy,styleVariant:'market'},settings}),['Store style']);
});

test('QuickByte-style legacy store renders Classic exactly: no style attribute, no style CSS, same banner, logo and words',()=>{
  const before=structuredClone(legacy);
  const site={id:'site_1791231782316_hfxt11',user_id:'owner',template_id:'tmpl-data-reseller',name:'Quickbyte data',slug:'quickbyte-data',status:'published',content_json:legacy,settings_json:settings,created_at:'',updated_at:'',published_at:''} as any;
  const record=publishedWebsiteRecord({...site,published_snapshot_json:createPublishedSnapshot(site)});
  const html=render(record.content_json);
  assert.ok(!html.includes('data-store-style'));assert.ok(!html.includes('sx-hero'));assert.ok(!html.includes('[data-store-style'));
  for(const value of ['Quickbyte data','quickbyte-logo.png',LEGACY.split('/upload/')[1],'Dansoman','Affordable data. Simple delivery.','store-art','managed-fixture'])assert.ok(html.includes(value),value);
  assert.deepEqual(legacy,before,'rendering never rewrites saved content');
  // An existing owner whose saved hero is empty still gets the legacy banner, in every style.
  for(const style of ['horizon','market','classic'])assert.ok(render({...legacy,heroImage:'',styleVariant:style}).includes(LEGACY.split('/upload/')[1]),style);
});

test('each new style has its own composition but the same content, tap targets and managed checkout',()=>{
  const owner:SiteContent={...legacy,heroImage:STARTER,location:''};
  const markers:Record<string,string>={horizon:'hz-media',market:'mk-art',studio:'st-mark'};
  for(const style of ['horizon','market','studio']){
    const content={...owner,styleVariant:style};
    const template=mergeSiteWithTemplate(data,content,settings);
    const html=renderToStaticMarkup(React.createElement(VisualEditContext.Provider,{value:visualTargets(template)},renderTemplateLayout(template,{managedCheckout:managed,managedAvailability:'available'} as any)));
    assert.ok(html.includes(`data-store-style="${style}"`),style);assert.ok(html.includes(markers[style]),style);
    for(const other of Object.values(markers).filter(m=>m!==markers[style]))assert.ok(!html.includes(`class="${other}`),`${style} has no ${other}`);
    for(const target of ['content:tagline','content:aboutText','content:ctaLabel','content:businessName','content:logoUrl','copy:reseller.secondary'])assert.ok(html.includes(`data-visual-target="${target}"`),`${style} ${target}`);
    for(const value of ['managed-fixture','id="bundle-catalog"','id="store-help"','Secure checkout by Paystack','Affordable data. Simple delivery.'])assert.ok(html.includes(value),`${style} ${value}`);
    assert.equal(html.includes('content:heroImage'),style!=='studio',`${style} banner tap target`);
    // Studio downloads no banner at all.
    assert.equal(html.includes(STARTER.split('/upload/')[1]),style!=='studio',`${style} banner image`);
  }
});

test('Horizon and Market respect the owner focus point and description; Classic is unchanged',()=>{
  const content:SiteContent={...legacy,heroImage:STARTER,imageMeta:{heroImage:{x:80,y:30,alt:'Phone on a desk'}}};
  for(const style of ['horizon','market'])assert.ok(render({...content,styleVariant:style}).match(/object-position:80% 30%/)&&render({...content,styleVariant:style}).includes('alt="Phone on a desk"'),style);
  assert.ok(!render(content).includes('80% 30%'),'Classic keeps its centred banner');
});

test('gallery demo shows Market (V7.4) with labelled example prices and the new starter wording',()=>{
  const html=renderToStaticMarkup(renderTemplateLayout(data));
  assert.ok(html.includes('data-store-style="market"'));assert.ok(html.includes('Example store'));assert.ok(html.includes('Buy data in a few taps.'));
});

test('wording ideas: short, plain and truthful: no prices, numbers, speed, guarantees, reviews or AI claims',()=>{
  const all=[...DATA_STORE_COPY_IDEAS.tagline,...DATA_STORE_COPY_IDEAS.aboutText,...DATA_STORE_COPY_IDEAS.ctaLabel];
  for(const text of all){
    assert.doesNotMatch(text,/\d|GH₵|%|instant|immediate|guarantee|fast|cheapest|lowest|best|review|rated|trusted by|AI\b|non-expir/i,text);
    assert.doesNotThrow(()=>validateWebsiteContentPatch({tagline:text.slice(0,150),aboutText:text}));
  }
  for(const t of DATA_STORE_COPY_IDEAS.tagline)assert.ok(t.length<=40,t);
  for(const c of DATA_STORE_COPY_IDEAS.ctaLabel)assert.ok(c.length<=20,c);
  assert.equal(websiteStarter('tmpl-data-reseller','A').content.tagline,DATA_STORE_COPY_IDEAS.tagline[0]);
});

test('style picker and wording ideas render accessible choices; Classic is selected for a store without a style',()=>{
  const html=renderToStaticMarkup(React.createElement(WebsiteStoreLook,{layout:'reseller',value:undefined,onChange(){}}));
  assert.equal((html.match(/role="radio"/g)||[]).length,WEBSITE_STYLE_VARIANTS.reseller.length);assert.match(html,/aria-checked="true"[^>]*data-style="classic"/);
  assert.match(html,/live store changes only when you publish/);
  assert.equal(renderToStaticMarkup(React.createElement(WebsiteStoreLook,{layout:'boutique',value:undefined,onChange(){}})),'');
  const ideas=renderToStaticMarkup(React.createElement(WebsiteCopyIdeas,{ideas:DATA_STORE_COPY_IDEAS.tagline,value:'Stay connected for less.',onPick(){}}));
  assert.equal((ideas.match(/aria-pressed="true"/g)||[]).length,1);
  const editor=source('src/components/website/editor/WebsiteEditor.tsx');
  assert.match(editor,/changeContent\(\{styleVariant:style\}\)/,'a style change is an ordinary, undoable draft edit');
  assert.match(editor,/editVisualValue\(`content:\$\{ideaField\}`,text\)/,'an idea goes through the validated visual edit path');
});

test('creating a store: new clients get Horizon; an older client that sends no style gets the original look',async()=>{
  const {site}=await WebsiteStore.createSite('usr_v71_new',{template_id:'tmpl-data-reseller',name:'Esi Data',businessName:'Esi Data',starterVersion:WEBSITE_STARTER_VERSION,content:{whatsapp:'0241234567'}});
  assert.equal(site.content_json.styleVariant,'market');
  const old=await WebsiteStore.createSite('usr_v71_old',{template_id:'tmpl-data-reseller',name:'Old Client Store',content:{businessName:'Old Client Store'}} as any);
  assert.equal(old.site.content_json.styleVariant,undefined);
  await assert.rejects(()=>WebsiteStore.createSite('usr_v71_bad',{template_id:'tmpl-data-reseller',name:'Bad',businessName:'Bad',starterVersion:WEBSITE_STARTER_VERSION,content:{styleVariant:'neon'}} as any),/offered styles/);
});

test('share kit: fixed messages with the owner name and link only, shown only when customers can buy',()=>{
  const url='https://mysterybundlehub.com/sites/esi-data';
  for(const m of storeShareMessages('Esi Data',url)){
    assert.ok(m.text.includes(url));assert.doesNotMatch(m.text.replace(url,''),/\d|GH₵|%|instant|fast|cheap|guarantee|discount|free/i,m.text);
  }
  const page=source('src/components/website/BusinessWorkspacePage.tsx');
  // V7.2.1: and only until the store has paid orders in the period, so an established store isn't taught to share.
  assert.match(page,/reseller && published && \(s\.sellable \?\? 0\) > 0 && s\.paidOrders === 0 \? <StoreShareKit/);
});

test('money boundaries unchanged: server products and prices, the same payment call, no checkout in previews',()=>{
  const store=source('src/components/website/ManagedDataStorefront.tsx');
  assert.match(store,/priceMinor:p\.retailMinor/,'only server retail prices');
  assert.match(store,/const pick=\(b:StoreBundle\)=>choose\(toBundle\(b\)\)/);
  assert.match(store,/store:\{siteId,requestId:requestId\.current!,expectedMinor:Math\.round\(selected\.priceGhc\*100\)\}/);
  assert.match(store,/if\(preview\)\{setError\('Preview only\./,'drafts never start checkout');
  for(const file of ['src/components/website/storefront/storeStyles.ts','src/config/websiteStyleVariants.ts','src/components/website/editor/WebsiteStoreLook.tsx','src/components/website/StoreShareKit.tsx'])
    assert.doesNotMatch(source(file),/js\.paystack|usePaystack|initializeServerPayment|store-checkout|wholesale|retailMinor|reserveBps/i,file);
});
