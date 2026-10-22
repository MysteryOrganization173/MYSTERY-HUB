/**
 * Website Builder V5.1: bundle setup planning, deletion help, publish readiness, Signal starter on a
 * design switch and the one design count. Pure functions and source contracts only; no production data.
 */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {bundleSaveRows,isSellableDraft,planBundleSetup,sellableCount,sellerDrafts,type BundleSetupChoice,type SellerBundle} from '../../../src/utils/websitePricing';
import {deletionBlockerSummary,websiteDeletionSupportUrl} from '../../../src/utils/websiteSupport';
import {hasWorkingWhatsApp,websiteContactNeed,websiteLiveState,websiteReadiness,WEBSITE_LIVE_LABELS} from '../../../src/utils/websiteReadiness';
import {migrateWebsiteTemplate} from '../../../src/utils/websiteTemplateMigration';
import {websiteStarterWording} from '../../../src/config/websiteStarters';
import {WEBSITE_TEMPLATES,readyDesignCount,orderedWebsiteTemplates} from '../../../src/data/templates';
import {mergeSiteWithTemplate,renderTemplateLayout} from '../../../src/utils/templateRendererUtils';
import {createPublishedSnapshot} from '../../../server/services/websitePublication';
import type {SiteContent,SiteSettings} from '../../../src/types';

const source=(file:string)=>readFileSync(file,'utf8');
const bundle=(id:string,network:string,min:number|null,over:Partial<SellerBundle>={}):SellerBundle=>({id,network,networkName:network.toUpperCase(),dataAmount:id,retailMinor:0,enabled:false,minimumMinor:min,wholesaleMinor:min?min-50:null,configured:min!==null,...over});
const catalogue=():SellerBundle[]=>[
  bundle('mtn-1','mtn',500),bundle('mtn-2','mtn',1000),bundle('mtn-5','mtn',2300,{retailMinor:2500,enabled:true}),
  bundle('tel-1','telecel',450),bundle('tel-2','telecel',900,{retailMinor:990,enabled:true}),
  bundle('at-1','airteltigo',null),bundle('at-2','airteltigo',0,{configured:true}),
];
const choice=(over:Partial<BundleSetupChoice>):BundleSetupChoice=>({networks:['mtn'],priceMode:'markup',kind:'percent',value:'10',activation:'enable',...over});

// ---------- Section 6: bundle setup ----------
test('MTN only, 10% markup and put on sale prices from the minimum and enables only MTN',()=>{
  const p=catalogue(),d=sellerDrafts(p),plan=planBundleSetup(p,d,choice({}));
  assert.deepEqual(plan.rows.map(r=>r.id),['mtn-1','mtn-2','mtn-5']);
  assert.deepEqual(plan.rows.map(r=>r.after.price),['5.50','11.00','25.30']);
  assert.ok(plan.rows.every(r=>r.after.enabled));
  assert.equal(plan.summary.newlyEnabled,2);assert.equal(plan.summary.priceChanges,3);
  assert.equal(plan.summary.sellableBefore,2);assert.equal(plan.summary.sellableAfter,4);
  assert.equal(plan.summary.liveRemoved,0);
  assert.equal(d['tel-1'].enabled,false,'other networks untouched');
});
test('flat GH₵ markup across all networks reports unconfigured and invalid-minimum bundles as ineligible',()=>{
  const p=catalogue(),plan=planBundleSetup(p,sellerDrafts(p),choice({networks:['mtn','telecel','airteltigo'],kind:'flat',value:'1.5'}));
  const row=(id:string)=>plan.rows.find(r=>r.id===id)!;
  assert.equal(row('mtn-1').after.price,'6.50');assert.equal(row('tel-2').after.price,'10.50');
  assert.equal(row('at-1').status,'ineligible');assert.equal(row('at-2').status,'ineligible');
  assert.equal(row('at-1').after.enabled,false,'never activates what Mystery Hub has not configured');
  assert.equal(plan.summary.ineligible,2);assert.equal(plan.summary.sellableAfter,5);
});
test('prices only keeps every on-sale state exactly as it was',()=>{
  const p=catalogue(),d=sellerDrafts(p),plan=planBundleSetup(p,d,choice({networks:['mtn','telecel'],activation:'keep'}));
  for(const r of plan.rows)assert.equal(r.after.enabled,r.before.enabled,r.id);
  assert.equal(plan.summary.newlyEnabled,0);assert.equal(plan.summary.newlyDisabled,0);
});
test('take off sale reports live bundles that customers lose',()=>{
  const p=catalogue(),plan=planBundleSetup(p,sellerDrafts(p),choice({networks:['telecel'],priceMode:'keep',activation:'disable'}));
  assert.equal(plan.summary.newlyDisabled,1);assert.equal(plan.summary.liveRemoved,1);assert.equal(plan.summary.priceChanges,0);
  assert.equal(plan.summary.sellableAfter,1);
});
test('enabling without a valid price is reported as needs-price and never switched on',()=>{
  const p=catalogue(),plan=planBundleSetup(p,sellerDrafts(p),choice({priceMode:'keep'}));
  const r=plan.rows.find(x=>x.id==='mtn-1')!;
  assert.equal(r.status,'needs-price');assert.equal(r.after.enabled,false);
  assert.equal(plan.summary.needsPrice,2);assert.equal(plan.summary.newlyEnabled,0);
});
test('a price already below a raised minimum cannot be switched on by keep-prices',()=>{
  const p=[bundle('m','mtn',1000,{retailMinor:900,enabled:false})];
  const plan=planBundleSetup(p,sellerDrafts(p),choice({priceMode:'keep'}));
  assert.equal(plan.rows[0].status,'needs-price');assert.equal(isSellableDraft(p[0],plan.rows[0].after),false);
});
test('re-applying the same setup counts nothing as changed',()=>{
  const p=catalogue(),first=planBundleSetup(p,sellerDrafts(p),choice({}));
  const after={...sellerDrafts(p)};for(const r of first.rows)after[r.id]=r.after;
  const again=planBundleSetup(p,after,choice({}));
  assert.equal(again.summary.priceChanges,0);assert.equal(again.summary.newlyEnabled,0);assert.equal(again.summary.unchanged,3);
});
test('setup refuses an empty choice and invalid markups',()=>{
  const p=catalogue(),d=sellerDrafts(p);
  assert.throws(()=>planBundleSetup(p,d,choice({networks:[]})),/at least one network/);
  assert.throws(()=>planBundleSetup(p,d,choice({priceMode:'keep',activation:'keep'})),/price change/);
  assert.throws(()=>planBundleSetup(p,d,choice({value:'-5'})),/non-negative/);
  assert.throws(()=>planBundleSetup(p,d,choice({value:'1.234'})),/two decimal/);
});
test('no configured bundles: nothing becomes sellable',()=>{
  const p=[bundle('a','mtn',null),bundle('b','mtn',null)],plan=planBundleSetup(p,sellerDrafts(p),choice({}));
  assert.equal(plan.summary.ineligible,2);assert.equal(plan.summary.sellableAfter,0);
});
test('save rows contain only real differences, in the shape the existing PUT accepts',()=>{
  const p=catalogue(),saved=sellerDrafts(p),drafts={...saved,'mtn-1':{price:'5.50',enabled:true},'mtn-5':{price:'25.00',enabled:true},'tel-2':{price:'9.90',enabled:false}};
  assert.deepEqual(bundleSaveRows(p,saved,drafts),[{productId:'mtn-1',enabled:true,retailMinor:550},{productId:'tel-2',enabled:false,retailMinor:990}]);
  assert.deepEqual(bundleSaveRows(p,saved,saved),[]);
  assert.equal(sellableCount(p,drafts),2);
});
test('bundle workspace saves through the versioned endpoint and reports refreshed server counts',()=>{
  const s=source('src/components/website/WebsiteBundlePricing.tsx');
  assert.match(s,/expectedVersion:catalog\.version/);assert.match(s,/'PUT'/);
  assert.match(s,/eligible/);assert.match(s,/data-bundle-saved/);
  assert.match(s,/Prices changed|changed/);
  assert.ok(!/websites\/\$\{siteId\}\/bundles\/bulk/.test(s),'no new bulk endpoint');
  const editor=source('src/components/website/editor/WebsiteEditor.tsx');
  assert.match(editor,/<WebsiteBundleSetupSheet/);assert.ok(!editor.includes('onOpenPricing'));
});

// ---------- Section 4–5: dashboard and deletion ----------
test('dashboard has no Website tab, old links land on Overview and Settings needs no launcher',()=>{
  const s=source('src/components/website/WebsiteBusinessDashboard.tsx');
  assert.match(s,/export const dashboardTabFor=\(tab\?:string\)=>tab==='Website'\?'Overview':tab;/);
  assert.ok(!s.includes("'Website',"));
  for(const tab of ['Overview','Orders','Bundles & Pricing','Store Earnings','Analytics','Settings'])assert.ok(s.includes(`'${tab}'`),tab);
  const settings=source('src/components/website/WebsiteSettingsControls.tsx');
  assert.match(settings,/Change design/);assert.match(settings,/Delete website/);
  assert.ok(!source('src/components/website/WebsiteBuilderPage.tsx').includes('Open website settings'));
});
test('blocker wording explains below-minimum earnings without changing the server decision',()=>{
  const below=deletionBlockerSummary({code:'earnings_available',message:'x',amountMinor:71},500);
  assert.match(below.title,/GH₵0\.71/);assert.match(below.why,/below the GH₵5\.00 withdrawal minimum/);assert.equal(below.resolve,'Store Earnings');
  assert.match(deletionBlockerSummary({code:'earnings_available',message:'x',amountMinor:900},500).title,/ready to withdraw/);
  assert.equal(deletionBlockerSummary({code:'orders_in_progress',message:'x',count:2}).title,'2 paid orders are still in progress');
  assert.equal(deletionBlockerSummary({code:'mystery',message:'Server says no'}).why,'Server says no');
});
test('support message is prefilled, URL-encoded and carries no secrets or customer data',()=>{
  const url=websiteDeletionSupportUrl('https://wa.me/233592066298',{name:'Ama & Sons "Data"',publicAddress:'mysterybundlehub.com/sites/ama'},[{code:'earnings_available',message:'internal',amountMinor:71},{code:'orders_in_progress',message:'internal',count:1}],500);
  assert.ok(url.startsWith('https://wa.me/233592066298?text='));
  const text=decodeURIComponent(url.split('?text=')[1]);
  assert.ok(!url.split('?text=')[1].includes(' ')&&!url.split('?text=')[1].includes('&'),'fully encoded');
  assert.match(text,/^Hello Mystery Hub Support\./);
  assert.match(text,/"Ama & Sons "Data"" \(mysterybundlehub\.com\/sites\/ama\)/);
  assert.match(text,/GH₵0\.71 in Store Earnings \(below the GH₵5\.00 withdrawal minimum\)/);
  assert.match(text,/1 paid order is still in progress/);
  for(const secret of ['token','Bearer','site_','internal','password','@'])assert.ok(!text.includes(secret),secret);
  assert.ok(websiteDeletionSupportUrl('https://x.test/help?a=1',{name:'A',publicAddress:'b'},[]).includes('?a=1&text='));
});
test('delete sheet never bypasses the server check and never sends anything itself',()=>{
  const s=source('src/components/website/WebsiteDeleteSheet.tsx');
  assert.match(s,/data-support-link/);assert.match(s,/Your money is safe/);
  assert.ok(!/force|writeOff|moveToWallet/i.test(s));
  assert.match(s,/getWebsiteDeletionCheck\(token, site\.id\)/);assert.match(s,/WebsiteDeletionBlocked/);
});

// ---------- Section 7–8, 12: starter copy, WhatsApp rule, readiness ----------
test('switching into the Data store gives Signal starter wording and a Buy Data button',()=>{
  const from:SiteContent={businessName:'Ama',tagline:'Fresh jollof daily',aboutText:'Our kitchen',ctaLabel:'Contact us',whatsapp:'0241234567'} as SiteContent;
  const next=migrateWebsiteTemplate(from,'tmpl-buka-bistro','tmpl-data-reseller');
  const starter=websiteStarterWording('tmpl-data-reseller')!;
  assert.equal(next.tagline,starter.tagline);assert.ok(next.tagline);assert.equal(next.aboutText,starter.aboutText);
  assert.equal(next.ctaLabel,'Buy Data');assert.equal(next.businessName,'Ama');assert.equal(next.whatsapp,'0241234567');
});
test('button labels: industry-specific ones reset, contact-style ones stay outside the Data store',()=>{
  assert.equal(migrateWebsiteTemplate({businessName:'Ama',ctaLabel:'Book a table'} as SiteContent,'tmpl-buka-bistro','tmpl-data-reseller').ctaLabel,'Buy Data');
  assert.equal(migrateWebsiteTemplate({businessName:'Ama',ctaLabel:'Message us'} as SiteContent,'tmpl-buka-bistro','tmpl-glow-salon').ctaLabel,'Message us');
  assert.notEqual(migrateWebsiteTemplate({businessName:'Ama',ctaLabel:'Message us'} as SiteContent,'tmpl-buka-bistro','tmpl-data-reseller').ctaLabel,'Message us');
});
test('WhatsApp is required to publish WhatsApp-first designs, never forced on Data stores',()=>{
  for(const id of ['tmpl-buka-bistro','tmpl-night-kitchen','tmpl-boutique','tmpl-makola-mart'])assert.equal(websiteContactNeed(id),'whatsapp',id);
  assert.equal(websiteContactNeed('tmpl-data-reseller'),'none');assert.equal(websiteContactNeed('tmpl-glow-salon'),'contact');
  const shop=websiteReadiness({templateId:'tmpl-boutique',content:{businessName:'Ama',tagline:'x'}});
  assert.deepEqual(shop.filter(i=>i.level==='required').map(i=>i.id),['whatsapp']);
  assert.equal(websiteReadiness({templateId:'tmpl-data-reseller',content:{businessName:'Ama',tagline:'x'},sellableBundles:3}).length,0);
});
test('WhatsApp numbers follow the published website rule: 024…, 23324… and +233… all work',()=>{
  for(const n of ['0241234567','233241234567','+233 24 123 4567','+233-24-123-4567'])assert.ok(hasWorkingWhatsApp(n),n);
  for(const n of ['','12345','abc','024'])assert.ok(!hasWorkingWhatsApp(n),n);
  const bad=websiteReadiness({templateId:'tmpl-night-kitchen',content:{businessName:'A',tagline:'x',whatsapp:'024'}});
  assert.equal(bad[0].title,'Check your WhatsApp number');
});
test('readiness warns about an empty heading, no bundles on sale and a contact-style Data button',()=>{
  const r=websiteReadiness({templateId:'tmpl-data-reseller',content:{businessName:'A',tagline:'',ctaLabel:'Contact us'},sellableBundles:0});
  assert.deepEqual(r.map(i=>i.id),['tagline','bundles','cta']);assert.ok(r.every(i=>i.level==='warning'));
  assert.equal(r[0].fix?.patch.tagline,websiteStarterWording('tmpl-data-reseller')!.tagline);
  assert.equal(r[2].fix?.patch.ctaLabel,'Buy Data');
  assert.ok(!websiteReadiness({templateId:'tmpl-data-reseller',content:{businessName:'A',tagline:''},layoutMode:'sections'}).some(i=>i.id==='tagline'));
});
test('publish sheet holds the button only for required items and never celebrates zero sellable bundles',()=>{
  const s=source('src/components/website/editor/WebsitePublishSheet.tsx');
  assert.match(s,/required\.length > 0/);assert.match(s,/Add what’s missing first/);
  assert.match(s,/Your website is live, but customers can’t buy yet/);
  const start=source('src/components/website/WebsiteStartSheet.tsx');assert.match(start,/needed to publish/);assert.match(start,/hasWorkingWhatsApp/);
});
test('one status vocabulary compares the draft with what visitors see',()=>{
  const content:SiteContent={businessName:'A',tagline:'t'} as SiteContent,settings:SiteSettings={primaryColor:'#000',accentColor:'#0f0',backgroundColor:'#000',fontFamily:'font-sans',borderRadius:'rounded-xl'};
  const base={status:'published',template_id:'tmpl-data-reseller',content_json:content,settings_json:settings,published_at:'2026-10-20T10:00:00Z',updated_at:'2026-10-21T10:00:00Z'};
  const snap=createPublishedSnapshot({...base,id:'s',user_id:'u',name:'A',slug:'a',created_at:''} as any);
  assert.equal(websiteLiveState({...base,published_snapshot_json:snap}),'live','a later save with nothing new is still up to date');
  assert.equal(websiteLiveState({...base,content_json:{...content,tagline:'new'},published_snapshot_json:snap}),'live-changes');
  assert.equal(websiteLiveState({...base,status:'draft'}),'not-published');
  assert.equal(websiteLiveState({...base,published_snapshot_json:null}),'live-changes','timestamp fallback for old sites');
  assert.equal(WEBSITE_LIVE_LABELS.live.short,'Live');
});

// ---------- Sections 9–11: preview, gallery, logo ----------
test('the gallery count and View all use one rule: ready designs, not the blank start',()=>{
  assert.equal(readyDesignCount(),WEBSITE_TEMPLATES.length-1);
  assert.equal(readyDesignCount(orderedWebsiteTemplates()),readyDesignCount());
  const page=source('src/components/website/WebsiteBuilderPage.tsx');
  assert.match(page,/\$\{readyDesignCount\(\)\} designs/);assert.match(page,/View all \$\{readyDesignCount\(filteredTemplates\)\}/);
  assert.ok(!page.includes('View all ${filteredTemplates.length}'));
});
test('the full-screen preview is opaque, owns a history entry and hides gallery live renders',()=>{
  const m=source('src/components/website/TemplatePreviewModal.tsx');
  assert.match(m,/pushState\(\{ mhPreview: true/);assert.match(m,/window\.history\.back\(\)/);
  assert.match(m,/mh-preview-open/);assert.match(m,/bg-\[#05080c\]/);
  assert.match(source('src/index.css'),/\.mh-preview-open \.template-card-live/);
});
test('the selection label moves below targets at the top of the page; logos are never cropped in the editor',()=>{
  const v=source('src/components/website/editor/VisualSelectionSurface.tsx');
  assert.match(v,/const below = rect\.top \+ window\.scrollY < 40/);assert.match(v,/is-below/);assert.ok(!v.includes('Math.max(tag.top, 34)'));
  const f=source('src/components/website/editor/WebsiteImageField.tsx');assert.match(f,/data-logo-preview/);assert.match(f,/objectFit:'contain'/);
  const e=source('src/components/website/editor/WebsiteEditor.tsx');assert.equal((e.match(/<WebsiteImageField logo /g)||[]).length,2);
});

// ---------- Existing customer preservation ----------
test('QuickByte: V5.1 readiness asks nothing of it and rendering keeps its own record',()=>{
  const reseller=WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-data-reseller')!;
  const content:SiteContent={businessName:'Quickbyte data',tagline:'Affordable data. Simple delivery.',aboutText:'Buy MTN, Telecel and AirtelTigo bundles from one simple storefront.',location:'Dansoman',phone:'0240000000',whatsapp:'0240000000',email:'',logoUrl:'https://res.cloudinary.com/da6oeat7m/image/upload/v1/owner-uploads/quickbyte-logo.png'} as SiteContent;
  const before=structuredClone(content);
  assert.deepEqual(websiteReadiness({templateId:'tmpl-data-reseller',content,sellableBundles:12}),[]);
  const html=renderToStaticMarkup(renderTemplateLayout(mergeSiteWithTemplate(reseller,content),{managedCheckout:React.createElement('div'),managedAvailability:'available'}));
  for(const v of ['Quickbyte data','quickbyte-logo.png','Dansoman','Affordable data. Simple delivery.'])assert.ok(html.includes(v),v);
  assert.deepEqual(content,before,'nothing rewrites saved content');
});
