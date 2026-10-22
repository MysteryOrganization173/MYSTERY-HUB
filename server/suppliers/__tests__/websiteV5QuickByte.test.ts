/**
 * V5 Signal on the protected QuickByte Data site (site_1791231782316_hfxt11). The fixture mirrors its saved
 * content with anonymised contacts; production records were not read or changed. Signal is a renderer change
 * only: every saved field, the address, the banner, logo and colours stay exactly as the owner left them.
 */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {WEBSITE_TEMPLATES} from '../../../src/data/templates';
import {DATA_RESELLER_LEGACY_HERO_IMAGE as LEGACY} from '../../../src/utils/dataResellerArtwork';
import {mergeSiteWithTemplate,renderTemplateLayout} from '../../../src/utils/templateRendererUtils';
import {createPublishedSnapshot,publishedWebsiteRecord} from '../../../server/services/websitePublication';
import type {SiteContent,SiteSettings} from '../../../src/types';

const reseller=WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-data-reseller')!;
const LOGO='https://res.cloudinary.com/da6oeat7m/image/upload/v1/owner-uploads/quickbyte-logo.png';
const content:SiteContent={businessName:'Quickbyte data',tagline:'Affordable data. Simple delivery.',aboutText:'Buy MTN, Telecel and AirtelTigo bundles from one simple storefront.',location:'Dansoman',phone:'0240000000',whatsapp:'0240000000',email:'',logoUrl:LOGO,heroImage:LEGACY,ctaLabel:'Buy Data',ctaTarget:'',social:{},items:[],stats:[],features:[]};
const settings:SiteSettings={primaryColor:'#0f172a',accentColor:'#2563eb',backgroundColor:'#0a0f1d',fontFamily:'font-sans',borderRadius:'rounded-xl'};
const site={id:'site_1791231782316_hfxt11',user_id:'owner',template_id:'tmpl-data-reseller',name:'Quickbyte data',slug:'quickbyte-data',status:'published',content_json:content,settings_json:settings,created_at:'2026-10-05T20:23:02.316Z',updated_at:'2026-10-17T11:03:52.205Z',published_at:'2026-10-17T11:03:52.205Z'} as any;

test('QuickByte gets Signal automatically with its own name, logo, banner, colours and address',()=>{
  const before=structuredClone(site);
  const record=publishedWebsiteRecord({...site,published_snapshot_json:createPublishedSnapshot(site)});
  assert.equal(record.slug,'quickbyte-data');assert.equal(record.id,'site_1791231782316_hfxt11');assert.deepEqual(record.content_json,content);
  const template=mergeSiteWithTemplate(reseller,record.content_json,record.settings_json);
  const html=renderToStaticMarkup(renderTemplateLayout(template,{managedCheckout:React.createElement('div',{id:'managed-fixture'}),managedAvailability:'available'}));
  for(const value of ['Quickbyte data','quickbyte-logo.png',LEGACY.split('/upload/')[1],'Dansoman','Affordable data. Simple delivery.','managed-fixture'])assert.ok(html.includes(value),value);
  assert.equal(template.accentColor,'#2563eb');assert.equal(template.colorScheme?.background,'#0a0f1d');
  // The design name never replaces the owner's, and no opt-in is needed.
  for(const generic of ['Your Data Store','QuickByte Data design','Example store'])assert.ok(!html.includes(generic),generic);
  assert.ok(!('sections' in content));assert.ok(html.includes('id="store-help"'),'all optional sections show by default');
  assert.deepEqual(site,before,'rendering never rewrites the saved record');
});

test('Signal keeps the managed checkout contract: server prices, review dialog, unchanged payment call',()=>{
  const source=readFileSync('src/components/website/ManagedDataStorefront.tsx','utf8');
  assert.match(source,/choose\(toBundle\(picked\), ?phone\)/,'review hands the same bundle and number to the existing flow');
  assert.doesNotMatch(source,/popular|best ?seller|most bought/i,'no invented popularity');
  assert.match(source,/data-network=\{n\}/,'the buyer confirms the network');
});
