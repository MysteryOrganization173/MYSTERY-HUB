/** Website Builder V5 flagships: Night Kitchen, Boutique, the WhatsApp order list and section visibility. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {WEBSITE_TEMPLATES} from '../../../src/data/templates.js';
import {mergeSiteWithTemplate,renderTemplateLayout} from '../../../src/utils/templateRendererUtils.js';
import {migrateWebsiteTemplate,websiteMigrationSummary} from '../../../src/utils/websiteTemplateMigration.js';
import {websiteStarter} from '../../../src/config/websiteStarters.js';
import {resolveWebsiteSections,WEBSITE_SECTION_REGISTRY} from '../../../src/config/websiteContentV5.js';
import {validateWebsiteContentPatch} from '../../services/websiteValidation.js';
import {isValidTemplateId} from '../../types/website.js';
import {addOrderLine,orderMessage,orderPriceMinor,orderTotalMinor,setOrderQuantity,whatsappOrderUrl,ORDER_LIST_LIMITS} from '../../../src/utils/websiteOrderList.js';
import type {SiteContent} from '../../../src/types/index.js';

const byId=(id:string)=>WEBSITE_TEMPLATES.find(t=>t.id===id)!;
const week={days:[0,1,2,3,4,5,6].map(i=>i===6?{closed:true}:{closed:false,open:'11:00',close:'21:00'})};
const dish={id:'d1',name:'Fixture jollof',price:'GH₵ 65',category:'Mains',desc:'Fixture description',image:'/fixture-dish.svg',label:'Spicy',pinned:true,options:['Regular','Large']};
const product={id:'p1',name:'Fixture tote',price:'GHC 280',category:'Bags',desc:'Fixture bag',image:'/fixture-bag.svg',label:'New',options:['Tan','Black']};
const owner=(extra:Partial<SiteContent>={}):SiteContent=>({businessName:'Fixture Chop House',tagline:'Fixture headline',aboutText:'Fixture about',location:'Fixture Street, Accra',whatsapp:'0241234567',phone:'0241234567',email:'fixture@example.test',heroImage:'/fixture-hero.svg',logoUrl:'/fixture-logo.svg',items:[dish],...extra} as SiteContent);
const render=(id:string,content?:SiteContent)=>renderToStaticMarkup(renderTemplateLayout(content?mergeSiteWithTemplate(byId(id),content):byId(id)));

test('both flagships are valid, previewable designs with their own layout and the right content family',()=>{
  for(const [id,family] of [['tmpl-night-kitchen','restaurant'],['tmpl-boutique','ecommerce']]){
    const t=byId(id);assert.ok(isValidTemplateId(id));assert.equal(t.contentFamily,family);assert.ok(WEBSITE_SECTION_REGISTRY[t.layoutType!]);
    const html=render(id);assert.ok(html.length>2000);
    // Gallery previews never invent ratings, reviews or stock.
    for(const claim of [/rating/i,/review(s|ed)? by/i,/in stock/i,/\b\d+ left\b/i,/Powered by Mystery Hub Sites/])assert.doesNotMatch(html,claim);
  }
});

test('new websites from the flagships start with labelled examples and their own wording',()=>{
  for(const id of ['tmpl-night-kitchen','tmpl-boutique']){
    const {content}=websiteStarter(id,'Fixture Business');
    assert.equal(content.items!.length,3);assert.ok(content.items!.every(i=>i.isExample));assert.ok(content.tagline&&!content.tagline.includes('Welcome to'));
  }
});

test('Classic Kitchen and Night Kitchen share content both ways; a shop design does not',()=>{
  const content=owner({hours:week,policies:{delivery:'Fixture delivery'},sections:{hidden:['gallery']}});
  assert.equal(websiteMigrationSummary('tmpl-buka-bistro','tmpl-night-kitchen').compatible,true);
  const night=migrateWebsiteTemplate(content,'tmpl-buka-bistro','tmpl-night-kitchen');
  assert.deepEqual(night.items,content.items);assert.equal(night.tagline,content.tagline);assert.deepEqual(night.hours,week);
  assert.equal(night.sections,undefined,'section choices belong to one layout');
  const back=migrateWebsiteTemplate(night,'tmpl-night-kitchen','tmpl-buka-bistro');assert.deepEqual(back.items,content.items);
  assert.equal(websiteMigrationSummary('tmpl-makola-mart','tmpl-boutique').compatible,true);
  assert.deepEqual(migrateWebsiteTemplate(owner({items:[product]}),'tmpl-makola-mart','tmpl-boutique').items,[product]);
  const shop=migrateWebsiteTemplate(content,'tmpl-night-kitchen','tmpl-boutique');
  assert.deepEqual(shop.items,[]);assert.equal(shop.businessName,content.businessName);assert.deepEqual(shop.hours,week,'hours describe the business, not the design');
});

test('Night Kitchen renders the owner’s menu, labels, hours and directions, never sample claims',()=>{
  const html=render('tmpl-night-kitchen',owner({hours:week}));
  for(const value of ['Fixture Chop House','Fixture jollof','Spicy','GH₵ 65','Mon – Sat','Sunday','google.com/maps/search','Fixture%20Street%2C%20Accra','fixture-logo.svg'])assert.ok(html.includes(value),value);
  assert.ok(html.includes('https://wa.me/233241234567'),'main action opens the owner’s WhatsApp');
  for(const sample of ['Your Kitchen','Example hours','Light soup with fufu'])assert.ok(!html.includes(sample),sample);
  // Without hours the badge and the hours section disappear, and so does the Hours link.
  const none=render('tmpl-night-kitchen',owner());
  assert.ok(!none.includes('Open now')&&!none.includes('Closed now'));assert.ok(!none.includes('href="#hours"'));assert.ok(!none.includes('id="hours"'));
});

test('hidden sections keep their content, disappear from the page and from navigation; essentials cannot be hidden',()=>{
  const content=owner({hours:week,gallery:['/fixture-gallery.svg'],sections:{hidden:['hours','gallery','menu','header'],order:['findus','picks']}});
  const html=render('tmpl-night-kitchen',content);
  assert.ok(!html.includes('id="hours"'));assert.ok(!html.includes('href="#hours"'));assert.ok(!html.includes('fixture-gallery.svg'));
  assert.ok(html.includes('id="menu"'),'the menu is essential');assert.ok(html.includes('Fixture jollof'));
  assert.ok(html.indexOf('id="find-us"')<html.indexOf('id="menu"'),'owner order is respected around fixed sections');
  const resolved=resolveWebsiteSections('nightkitchen',content.sections);
  assert.ok(resolved.filter(s=>s.essential).every(s=>s.visible));assert.equal(resolved.length,WEBSITE_SECTION_REGISTRY.nightkitchen.length);
  assert.deepEqual(content.hours,week,'hidden content is kept');
});

test('Boutique renders a two-up product grid, owner labels and policies only when written',()=>{
  const html=render('tmpl-boutique',owner({businessName:'Fixture Boutique',items:[product],policies:{returns:'Fixture returns policy'}}));
  for(const value of ['Fixture Boutique','Fixture tote','New','GHC 280','2 options','Fixture returns policy','Returns &amp; exchanges','Order list (0)'])assert.ok(html.includes(value),value);
  for(const absent of ['Delivery &amp; pickup','Example wording','Your Boutique','Kente occasion set'])assert.ok(!html.includes(absent),absent);
  assert.ok(!render('tmpl-boutique',owner({items:[product]})).includes('id="policies"'),'no policies, no section');
  assert.match(readFileSync('src/components/website/templates/BoutiqueTemplateView.tsx','utf8'),/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('Signal respects hidden optional sections and keeps the catalogue',()=>{
  const html=render('tmpl-data-reseller',owner({sections:{hidden:['help','steps','catalogue']}}));
  assert.ok(!html.includes('id="store-help"'));assert.ok(!html.includes('href="#store-help"'));assert.ok(html.includes('id="bundle-catalog"'));
  assert.ok(render('tmpl-data-reseller',owner()).includes('id="store-help"'));
});

test('order list prices: plain owner prices total, anything else asks the business',()=>{
  assert.equal(orderPriceMinor('GH₵ 85.00'),8500);assert.equal(orderPriceMinor('GHC 1,280'),128000);assert.equal(orderPriceMinor('65'),6500);assert.equal(orderPriceMinor('GHS 12.5'),1250);
  for(const text of ['Ask','From 40','40 - 60','',undefined,'GH₵ 85 per plate'])assert.equal(orderPriceMinor(text as any),null,String(text));
  let lines=addOrderLine([],dish as any,'Large');lines=addOrderLine(lines,dish as any,'Large');lines=addOrderLine(lines,dish as any,'Regular');
  assert.equal(lines.length,2);assert.equal(lines[0].quantity,2);assert.equal(orderTotalMinor(lines),19500);
  assert.equal(orderTotalMinor(addOrderLine(lines,{id:'x',name:'Ask item',price:'Ask'})),null);
  assert.deepEqual(setOrderQuantity(lines,lines[0].key,0).map(l=>l.option),['Regular']);
  let many=lines;for(let i=0;i<40;i++)many=addOrderLine(many,{id:'i'+i,name:'Item '+i,price:'1'});assert.equal(many.length,ORDER_LIST_LIMITS.lines);
  assert.equal(setOrderQuantity(lines,lines[0].key,999)[0].quantity,ORDER_LIST_LIMITS.quantity);
});

test('the WhatsApp message is plain, in the buyer’s voice, and promises nothing',()=>{
  const lines=addOrderLine(addOrderLine([],dish as any,'Large'),product as any);
  const text=orderMessage('Fixture Chop House',lines,'https://example.test/sites/fixture');
  assert.match(text,/^Hello Fixture Chop House, I'd like to order:/);assert.ok(text.includes('• Fixture jollof (Large) · GH₵ 65'));
  assert.ok(text.includes('Total at your listed prices: GH₵345.00'));assert.ok(text.includes('Please confirm availability, delivery and payment.'));
  assert.doesNotMatch(text,/paid|confirmed order|reserved/i);
  assert.equal(whatsappOrderUrl('024 123 4567','hi'),'https://wa.me/233241234567?text=hi');assert.equal(whatsappOrderUrl('',''),null);assert.equal(whatsappOrderUrl('12',''),null);
  const source=readFileSync('src/components/website/storefront/OrderList.tsx','utf8');
  assert.doesNotMatch(source,/fetch\(|apiClient|localStorage|Checkout/,'the order list is client-side only and never says checkout');
});

test('flagship wording slots validate like every other design',()=>{
  assert.doesNotThrow(()=>validateWebsiteContentPatch({copy:{'nightkitchen.menuHeading':'Our menu','boutique.collectionHeading':'New in'}}));
  assert.throws(()=>validateWebsiteContentPatch({copy:{'boutique.unknownSlot':'x'}}));
});

test('one Mystery Hub line: designs no longer repeat the platform name in their own footers',()=>{
  for(const file of ['Restaurant','Salon','RealEstate','Hotel','Construction','Portfolio','TechAgency','Ecommerce','NightKitchen','Boutique'])
    assert.doesNotMatch(readFileSync(`src/components/website/templates/${file}TemplateView.tsx`,'utf8'),/Mystery Hub Sites Ghana|© 2026/,file);
  assert.match(readFileSync('src/components/website/PublicPublishedSite.tsx','utf8'),/showAttribution !== false/);
});
