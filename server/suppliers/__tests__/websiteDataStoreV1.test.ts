/**
 * Data Store V1: the renamed Data reseller design (formerly Signal), its starter, the owner's setup state before
 * the first bundle is on sale, gallery/preview consistency and the reseller launch steps.
 */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {WEBSITE_TEMPLATES,findTemplateByLink,templateDesignLabel} from '../../../src/data/templates.js';
import {mergeSiteWithTemplate,renderTemplateLayout} from '../../../src/utils/templateRendererUtils.js';
import {websiteStarter,websiteStarterWording,WEBSITE_STARTER_VERSION} from '../../../src/config/websiteStarters.js';
import {resellerLaunchSteps,ownerAttention} from '../../../src/utils/websiteOwnerAttention.js';
import {VisualEditContext} from '../../../src/components/website/editor/VisualEditMarkers.js';
import {visualTargets} from '../../../src/utils/websiteVisualEditing.js';
import {WebsiteStore} from '../../db/websiteStore.js';
import type {SiteContent} from '../../../src/types/index.js';

const data=WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-data-reseller')!;
const PRICE=/GH₵\s?\d/;
const starterSite=(name='Kwame Data Hub')=>{const s=websiteStarter('tmpl-data-reseller',name);return mergeSiteWithTemplate(data,s.content as SiteContent,s.settings);};

test('Data Store is the design name; the permanent ID and every old link still resolve',()=>{
  assert.equal(data.title,'Data Store');assert.equal(templateDesignLabel(data),'Data Store design · Data & Telecom');
  assert.match(data.description,/MTN, Telecel and AirtelTigo/);
  for(const link of ['tmpl-data-reseller','data-reseller','data-store','signal','Signal','quickbyte-data'])assert.equal(findTemplateByLink(link)?.id,'tmpl-data-reseller',link);
});

test('starter: real name, Data Store wording, Shop Bundles, starter artwork and no items or prices',()=>{
  const s=websiteStarter('tmpl-data-reseller','Kwame Data Hub');
  assert.equal(s.content.businessName,'Kwame Data Hub');assert.equal(s.content.tagline,'Buy Data. Stay Connected.');
  assert.equal(s.content.aboutText,'Choose a bundle, pay securely and track your order.');assert.equal(s.content.ctaLabel,'Shop Bundles');
  assert.equal(s.content.heroImage,data.heroImage);assert.deepEqual(s.content.items,[]);assert.equal(s.capabilities.managed,true);
  assert.equal(websiteStarterWording('tmpl-data-reseller')?.tagline,s.content.tagline);
  // No speed, availability, expiry or lowest-price claims in the wording a new store starts with.
  for(const text of [s.content.tagline,s.content.aboutText,data.description,data.demoHeroTagline,data.demoSubtext])assert.doesNotMatch(String(text),/instant|guarantee|non-expir|cheapest|lowest|fast/i);
});

test('the gallery demo shows the starter wording and no sample address or phone number',()=>{
  assert.equal(data.demoHeroTagline,websiteStarterWording('tmpl-data-reseller')?.tagline);assert.equal(data.demoSubtext,websiteStarterWording('tmpl-data-reseller')?.aboutText);
  assert.equal(data.location,'');assert.equal(data.hoursOrContact,'');
  const html=renderToStaticMarkup(renderTemplateLayout(data));
  assert.ok(!html.includes('Spintex'));assert.ok(!html.includes('555 7788'));assert.ok(html.includes('Shop Bundles'));
  // Labelled, non-transactional examples only.
  assert.ok(PRICE.test(html));assert.ok(html.includes('Example bundles and prices'));assert.ok(!html.includes('data-store-setup'));
});

test('owner sites that never stored wording or an address render exactly as before',()=>{
  const legacy=mergeSiteWithTemplate(data,{businessName:'Old Store',items:[]} as Partial<SiteContent>);
  assert.equal(legacy.demoHeroTagline,'Data bundles, bought in a few taps');assert.match(String(legacy.demoSubtext),/^Choose a bundle, enter the number/);assert.equal(legacy.location,'Spintex Road, Accra');
  const own=mergeSiteWithTemplate(data,{businessName:'Own',tagline:'Mine',aboutText:'',location:''} as Partial<SiteContent>);
  assert.equal(own.demoHeroTagline,'Mine');assert.equal(own.demoSubtext,'');assert.equal(own.location,'');
  // Other designs are untouched by the Data Store freeze.
  const kitchen=WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-buka-bistro')!;
  assert.equal(mergeSiteWithTemplate(kitchen,{businessName:'K'} as Partial<SiteContent>).location,kitchen.location);
});

test('a new store without bundles shows the owner setup area: networks, example sizes, no prices',()=>{
  const html=renderToStaticMarkup(renderTemplateLayout(starterSite()));
  assert.ok(html.includes('data-store-setup'));assert.ok(html.includes('Your bundles appear here'));assert.ok(html.includes('Only you can see this'));
  for(const n of ['MTN','Telecel','AirtelTigo'])assert.ok(html.includes(n),n);
  assert.ok(html.includes('Your price'));assert.ok(!PRICE.test(html),'no fabricated purchasable prices');
  assert.ok(html.includes('Kwame Data Hub'));assert.ok(html.includes('Buy Data. Stay Connected.'));assert.ok(html.includes('Shop Bundles'));
  assert.ok(!html.includes('Spintex'));assert.ok(!html.includes('View Availability'));
});

test('draft preview with nothing on sale is the setup state; a published empty store is not',()=>{
  const site=starterSite(),checkout=React.createElement('div',{id:'managed-fixture'});
  const setup=renderToStaticMarkup(renderTemplateLayout(site,{managedCheckout:checkout,managedAvailability:'setup'}));
  assert.ok(setup.includes('data-store-setup'));assert.ok(setup.includes('managed-fixture'));assert.ok(setup.includes('Shop Bundles'));
  const empty=renderToStaticMarkup(renderTemplateLayout(site,{managedCheckout:checkout,managedAvailability:'empty'}));
  assert.ok(!empty.includes('data-store-setup'),'customers never see the owner setup area');assert.ok(empty.includes('View Availability'));
  const live=renderToStaticMarkup(renderTemplateLayout(site,{managedCheckout:checkout,managedAvailability:'available',managedSummary:{networks:['mtn'],fromMinor:520,count:1}}));
  assert.ok(!live.includes('data-store-setup'));assert.ok(live.includes('Shop Bundles'));
  const src=readFileSync('src/components/website/ManagedDataStorefront.tsx','utf8');
  assert.match(src,/preview\?'setup':'empty'/);assert.ok(!src.includes('No saved eligible bundles'),'the owner no longer sees a bare grey card with a Contact Business button');
});

test('the setup button exists only as an editor control; markup stays identical outside the editor',()=>{
  const site=starterSite();
  const pub=renderToStaticMarkup(renderTemplateLayout(site));
  const edit=renderToStaticMarkup(React.createElement(VisualEditContext.Provider,{value:visualTargets(site)},renderTemplateLayout(site)));
  assert.equal(edit.replace(/ data-visual-target="[^"]*"| data-visual-empty="[^"]*"| tabindex="0"| aria-label="Edit [^"]*"/g,''),pub);
  const css=readFileSync('src/components/website/storefront/ResellerCatalogue.tsx','utf8');
  assert.ok(css.includes('.store-setup-action{display:none!important'));assert.ok(css.includes('.visual-selection-surface .store-setup-action{display:inline-flex!important}'));
});

test('launch steps: bundles, then publish, then share; gone once live with bundles',()=>{
  assert.equal(resellerLaunchSteps({sellableBundles:null,published:false}),null,'never guesses before the catalogue loads');
  const fresh=resellerLaunchSteps({sellableBundles:0,published:false})!;
  assert.deepEqual(fresh.map(s=>[s.id,s.done,s.ready]),[['bundles',false,true],['publish',false,true],['share',false,false]]);
  assert.equal(fresh[0].action,'pricing');assert.equal(fresh[1].action,'publish');assert.equal(fresh[2].action,'share');
  const priced=resellerLaunchSteps({sellableBundles:3,published:false})!;assert.equal(priced[0].done,true);assert.equal(priced[0].title,'3 bundles on sale');
  const liveEmpty=resellerLaunchSteps({sellableBundles:0,published:true})!;assert.equal(liveEmpty[1].done,true);assert.equal(liveEmpty[2].ready,true);
  assert.equal(resellerLaunchSteps({sellableBundles:1,published:true}),null);
  // The attention list still raises the same items the card replaces, so nothing is lost when the card hides.
  assert.deepEqual(ownerAttention({reseller:true,published:false,sellableBundles:0,content:{whatsapp:'0241234567'}}).map(i=>i.id),['bundles','publish']);
  const dash=readFileSync('src/components/website/WebsiteBusinessDashboard.tsx','utf8');
  for(const label of ['Visitors','Checkout starts','Paid orders','Delivered orders','Sales','Store Earnings available'])assert.ok(dash.includes(`'${label}'`)||dash.includes(`${label}:`),label);
});

test('gallery preview: Data Store accepts only the typed name; owner previews ignore it',()=>{
  const iso=readFileSync('src/components/website/IsolatedTemplatePreview.tsx','utf8');
  assert.match(iso,/!ownerPreview && !channel && template\.id === 'tmpl-data-reseller' && event\.data\?\.type === 'MYSTERYHUB_PREVIEW_NAME'/);
  assert.match(iso,/demoName \? \{\.\.\.template, demoBusinessName: demoName\}/);
  const modal=readFileSync('src/components/website/TemplatePreviewModal.tsx','utf8');
  assert.match(modal,/const namedPreview = !!starterTemplate \|\| dataDemo;/);
});

test('creating a Data Store keeps the starter wording and stores no products or prices',async()=>{
  const {site}=await WebsiteStore.createSite('usr_data_store_v1',{template_id:'tmpl-data-reseller',name:'Kwame Data Hub',businessName:'Kwame Data Hub',starterVersion:WEBSITE_STARTER_VERSION,content:{whatsapp:'0241234567'}});
  const c=site.content_json as SiteContent;
  assert.equal(site.template_id,'tmpl-data-reseller');assert.equal(c.businessName,'Kwame Data Hub');assert.equal(c.tagline,'Buy Data. Stay Connected.');assert.equal(c.ctaLabel,'Shop Bundles');
  assert.deepEqual(c.items,[]);assert.equal(c.location,'');assert.equal(c.whatsapp,'0241234567');assert.ok(!PRICE.test(JSON.stringify(c)));
});
