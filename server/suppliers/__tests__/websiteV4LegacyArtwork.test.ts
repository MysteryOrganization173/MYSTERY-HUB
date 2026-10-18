import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {WEBSITE_TEMPLATES} from '../../../src/data/templates';
import {DATA_RESELLER_LEGACY_HERO_IMAGE as LEGACY,DATA_RESELLER_STARTER_HERO_IMAGE as STARTER,resolveDataResellerHeroImage,showsLegacyDataResellerArtwork} from '../../../src/utils/dataResellerArtwork';
import {mergeSiteWithTemplate,renderTemplateLayout} from '../../../src/utils/templateRendererUtils';
import {migrateWebsiteTemplate} from '../../../src/utils/websiteTemplateMigration';
import {applyVisualValue} from '../../../src/utils/websiteVisualEditing';
import {websiteStarter} from '../../../src/config/websiteStarters';
import {createPublishedSnapshot,publishedWebsiteRecord} from '../../../server/services/websitePublication';
import {WebsiteStore} from '../../../server/db/websiteStore';
import type {SiteContent,SiteSettings} from '../../../src/types';

/**
 * V4 protection for existing Data Business artwork. The fixtures mirror the protected QuickByte Data site
 * (site_1791231782316_hfxt11) with anonymised contact details; production records were not read or changed.
 */
const reseller=WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-data-reseller')!;
const OWNER_LOGO='https://res.cloudinary.com/da6oeat7m/image/upload/v1/owner-uploads/quickbyte-logo.png';
const quickbyte=(heroImage:string):SiteContent=>({businessName:'Quickbyte data',tagline:'Affordable data. Simple delivery.',aboutText:'Buy MTN, Telecel and AirtelTigo bundles from one simple storefront.',location:'Dansoman',phone:'0240000000',whatsapp:'0240000000',email:'',logoUrl:OWNER_LOGO,heroImage,ctaLabel:'Buy Data',ctaTarget:'',social:{},items:[],stats:[],features:[]});
const settings:SiteSettings={primaryColor:'#0f172a',accentColor:'#2563eb',backgroundColor:'#0a0f1d',fontFamily:'font-sans',borderRadius:'rounded-xl'};
const render=(content?:SiteContent)=>renderToStaticMarkup(renderTemplateLayout(mergeSiteWithTemplate(reseller,content,content?settings:undefined)));
const shows=(html:string,url:string)=>html.includes(url.split('/upload/')[1]);

test('new Data Business sites start with the approved neutral artwork; the legacy banner is frozen',()=>{
  assert.equal(STARTER,'https://res.cloudinary.com/da6oeat7m/image/upload/v1792354394/Global_Connectivity_Tech_Showcase_w4kgd6.png');
  assert.equal(LEGACY,'https://res.cloudinary.com/da6oeat7m/image/upload/v1791053950/ChatGPT_Image_Oct_3_2026_06_58_33_PM_jr9ait.png');
  assert.equal(reseller.heroImage,STARTER);
  assert.equal(websiteStarter('tmpl-data-reseller','Ama Data').content.heroImage,STARTER);
  const gallery=render();
  assert.ok(shows(gallery,STARTER));assert.ok(!shows(gallery,LEGACY));
});

for(const [label,saved] of [['saved explicitly',LEGACY],['never saved (empty)',''],['an older retired placeholder','https://images.unsplash.com/photo-1556742049-0a67e5572293?w=1200'],['the old Neon placeholder','https://res.cloudinary.com/x/Neon_Data_Bundles_in_Accra.png']] as const){
  test(`QuickByte keeps its QuickByte banner when the hero is ${label}`,()=>{
    const content=quickbyte(saved),before=structuredClone(content);
    const html=render(content);
    assert.ok(shows(html,LEGACY),'banner');assert.ok(!shows(html,STARTER),'no starter');
    assert.ok(html.includes('quickbyte-logo.png'),'owner logo');assert.ok(html.includes('Quickbyte data'),'business name');
    assert.deepEqual(content,before,'saved content is never rewritten');
    assert.equal(showsLegacyDataResellerArtwork(saved),true);
  });
}

test('the published snapshot and public projection keep the saved hero and logo byte for byte',()=>{
  for(const hero of [LEGACY,'']){
    const site={id:'site_1791231782316_hfxt11',user_id:'owner',template_id:'tmpl-data-reseller',name:'Quickbyte data',slug:'quickbyte-data',status:'published',content_json:quickbyte(hero),settings_json:settings,created_at:'2026-10-05T20:23:02.316Z',updated_at:'2026-10-17T11:03:52.205Z',published_at:'2026-10-17T11:03:52.205Z'} as any;
    const record=publishedWebsiteRecord({...site,published_snapshot_json:createPublishedSnapshot(site)});
    assert.equal(record.slug,'quickbyte-data');assert.equal(record.content_json.heroImage,hero);assert.equal(record.content_json.logoUrl,OWNER_LOGO);
    assert.ok(shows(render(record.content_json),LEGACY));
  }
});

test('customised Data sites keep their own uploads',()=>{
  const custom='https://res.cloudinary.com/da6oeat7m/image/upload/v1/owner-uploads/my-shop.jpg';
  assert.equal(resolveDataResellerHeroImage(custom,true),custom);
  const html=render(quickbyte(custom));assert.ok(html.includes('my-shop.jpg'));assert.ok(!shows(html,LEGACY));assert.ok(!shows(html,STARTER));
});

test('a new owner can replace the starter, and removing a photo selects the starter rather than the legacy banner',()=>{
  const content=websiteStarter('tmpl-data-reseller','Ama Data').content as SiteContent;
  const template=mergeSiteWithTemplate(reseller,content,settings);
  const replaced=applyVisualValue(content,settings,template,'content:heroImage','https://res.cloudinary.com/da6oeat7m/image/upload/v1/owner-uploads/ama.jpg')!;
  assert.equal(replaced.content.heroImage,'https://res.cloudinary.com/da6oeat7m/image/upload/v1/owner-uploads/ama.jpg');
  const removed=applyVisualValue(replaced.content,settings,template,'content:heroImage','')!;
  assert.equal(removed.content.heroImage,STARTER);
  assert.ok(shows(render(removed.content),STARTER));
});

test('switching a draft into the Data design writes the starter; previews never touch the saved legacy hero',()=>{
  const restaurant={...quickbyte('https://example.test/food.jpg'),businessName:'Ama Kitchen'};
  assert.equal(migrateWebsiteTemplate(restaurant,'tmpl-buka-bistro','tmpl-data-reseller').heroImage,STARTER);
  const legacy=quickbyte('');
  assert.equal(migrateWebsiteTemplate(legacy,'tmpl-data-reseller','tmpl-data-reseller').heroImage,'');
  assert.equal(legacy.heroImage,'');
});

test('server creation persists the starter explicitly for new Data sites (legacy and B1 contracts)',async()=>{
  WebsiteStore.clearDevStore();
  const legacyClient=await WebsiteStore.createSite('v4-owner-a',{template_id:'tmpl-data-reseller',name:'Ama Data'} as any);
  assert.equal(legacyClient.site.content_json.heroImage,STARTER);
  const b1=await WebsiteStore.createSite('v4-owner-b',{template_id:'tmpl-data-reseller',businessName:'Kofi Data',starterVersion:1} as any);
  assert.equal(b1.site.content_json.heroImage,STARTER);
  WebsiteStore.clearDevStore();
});
