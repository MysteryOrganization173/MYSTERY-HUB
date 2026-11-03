/** V7.3 Release A: working Classic Kitchen and Classic Shop order lists, and Data Store styles with their own catalogue. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {WEBSITE_TEMPLATES} from '../../../src/data/templates.js';
import {mergeSiteWithTemplate,renderTemplateLayout} from '../../../src/utils/templateRendererUtils.js';
import {addOrderLine,orderMessage,orderTotalMinor,setOrderQuantity,whatsappOrderUrl} from '../../../src/utils/websiteOrderList.js';
import {BusinessEnquiry} from '../../../src/components/website/BusinessEnquiry.js';
import {STORE_STYLE_CSS} from '../../../src/components/website/storefront/storeStyles.js';
import type {SiteContent, TemplateItem} from '../../../src/types/index.js';

const byId=(id:string)=>WEBSITE_TEMPLATES.find(t=>t.id===id)!;
const render=(id:string,content?:SiteContent)=>renderToStaticMarkup(renderTemplateLayout(content?mergeSiteWithTemplate(byId(id),content):byId(id)));
const source=(file:string)=>readFileSync(file,'utf8');
const dishes:TemplateItem[]=[
  {id:'k1',name:'Asaana-glazed grilled tilapia with banku, fresh pepper and green shito from the Volta',price:'GH₵ 120',category:'Grills',desc:'Whole tilapia',options:['With banku','With fried yam']},
  {id:'k2',name:'Waakye special',price:'GH₵ 45',category:'Breakfast'},
  {id:'k3',name:'Family jollof tray',price:'Ask',category:'Party trays'},
];
const products:TemplateItem[]=[
  {id:'s1',name:'Infinix Hot 40 Pro',price:'GH₵ 2,450',category:'Phones',options:['128GB','256GB'],image:'/fixture-phone.svg'},
  {id:'s2',name:'Oraimo FreePods 4',price:'GHC 380',category:'Audio'},
];
const owner=(extra:Partial<SiteContent>):SiteContent=>({businessName:'Auntie Esi Chop Bar',tagline:'Fixture tagline',aboutText:'Fixture about',location:'Kokomlemle, Accra',whatsapp:'0241234567',phone:'0241234567',email:'',heroImage:'/fixture-hero.svg',logoUrl:'',items:dishes,...extra} as SiteContent);

test('Classic Kitchen: every dish can be opened and added; table enquiries stay a separate journey',()=>{
  const html=render('tmpl-buka-bistro',owner({}));
  for(const value of ['Waakye special','GH₵ 120','aria-label="Add Waakye special to your order"','2 choices','aria-label="Menu categories"','Party trays','send them to Auntie Esi Chop Bar on WhatsApp'])assert.ok(html.includes(value),value);
  // The enquiry asks about a table, a group or catering, never lists the dishes, and says nothing is booked.
  const enquiry=html.slice(html.indexOf('id="reserve"'));
  for(const value of ['value="a table"','value="a group or event"','Number of guests','Any booking or payment must be confirmed directly with them'])assert.ok(enquiry.includes(value),value);
  assert.ok(!enquiry.includes('value="Waakye special"'),'dishes are not reservation topics');
  for(const absent of ['Reserve Table','Reservations','Table booked','reservation confirmed'])assert.ok(!html.includes(absent),absent);
});

test('Classic Shop: real order list, no fake stars, cart counts or checkout, even on websites made before starter versions',()=>{
  const legacy=owner({businessName:'Kofi Gadgets',items:products});delete (legacy as Partial<SiteContent>).starterVersion;
  const html=render('tmpl-makola-mart',legacy);
  for(const value of ['Kofi Gadgets','Infinix Hot 40 Pro','GH₵ 2,450','128GB · 256GB','aria-label="Choose an option for Infinix Hot 40 Pro"','aria-label="Add Oraimo FreePods 4 to your order list"','aria-label="Your order list"','grid-cols-2','nothing is paid on this website'])assert.ok(html.includes(value),value);
  for(const absent of ['(48)','fill-current','Add to Bag','Checkout','Enquire</span>'])assert.ok(!html.includes(absent),absent);
  assert.doesNotMatch(source('src/components/website/templates/EcommerceTemplateView.tsx'),/cartCount|Star\b|setTimeout/);
});

test('gallery demos of both designs are labelled examples and make no invented claims',()=>{
  const kitchen=render('tmpl-buka-bistro'),shop=render('tmpl-makola-mart');
  assert.ok(kitchen.includes('Example menu'));assert.ok(shop.includes('Example products'));
  for(const html of [kitchen,shop])for(const claim of ['12-Month','Same-Day','Sale -15%','(48)','Free Sleeve','Bestseller','Instant WhatsApp'])assert.ok(!html.includes(claim),claim);
  for(const id of ['tmpl-buka-bistro','tmpl-makola-mart'])for(const claim of ['Warranty','Same-Day','Instant','Checkout'])assert.ok(!byId(id).features.join(' ').includes(claim),`${id} ${claim}`);
});

test('a Ghanaian multi-item order: options, quantities, an honest total only when every price is plain',()=>{
  let lines=addOrderLine([],dishes[0],'With fried yam');lines=addOrderLine(lines,dishes[1]);lines=addOrderLine(lines,dishes[1]);lines=setOrderQuantity(lines,lines[0].key,3);
  const message=orderMessage('Auntie Esi Chop Bar',lines,'https://mysterybundlehub.com/s/auntie-esi');
  assert.equal(message,[
    'Hello Auntie Esi Chop Bar, I\'d like to order:',
    '• 3 × Asaana-glazed grilled tilapia with banku, fresh pepper and green shito from the Volta (With fried yam) · GH₵ 120',
    '• 2 × Waakye special · GH₵ 45',
    'Total at your listed prices: GH₵450.00',
    'Please confirm availability, delivery and payment.',
    'https://mysterybundlehub.com/s/auntie-esi',
  ].join('\n'));
  // An item priced "Ask" removes the total instead of inventing one.
  const withAsk=addOrderLine(lines,dishes[2]);assert.equal(orderTotalMinor(withAsk),null);assert.ok(!orderMessage('X',withAsk).includes('Total'));
  assert.match(whatsappOrderUrl('024 123 4567',message)!,/^https:\/\/wa\.me\/233241234567\?text=Hello%20Auntie/);
  assert.equal(whatsappOrderUrl('',message),null,'no number, no WhatsApp link: the sheet offers Contact the business');
});

test('the dining enquiry form takes its own topics and an optional party size',()=>{
  const template={...byId('tmpl-buka-bistro'),siteContent:owner({}),items:dishes};
  const html=renderToStaticMarkup(React.createElement(BusinessEnquiry,{template,topics:['a table','catering'],guestsLabel:'Number of guests'}));
  assert.ok(html.includes('value="a table"')&&html.includes('value="catering"')&&html.includes('Number of guests'));
  assert.ok(!html.includes('Waakye special'));
  const plain=renderToStaticMarkup(React.createElement(BusinessEnquiry,{template}));
  assert.ok(plain.includes('value="Waakye special"')&&!plain.includes('Number of guests'),'other designs keep listing their items');
});

test('owners can add options and extra photos to Classic Kitchen dishes and Classic Shop products',()=>{
  assert.match(source('src/components/website/editor/WebsiteItemPanel.tsx'),/\['nightkitchen','boutique','restaurant','ecommerce'\]\.includes\(layout\) && <WebsiteItemExtras/);
  // Only Night Kitchen has an Owner's picks section to pin to.
  assert.match(source('src/components/website/editor/WebsiteV5Controls.tsx'),/\{layout === 'nightkitchen' && <label/);
});

test('Data Store styles present bundles differently: cards for Horizon, Market, Studio and Signature; rows for the rest',()=>{
  const css=STORE_STYLE_CSS.replace(/\/\*[\s\S]*?\*\//g,'');
  for(const style of ['horizon','market','studio','signature']){
    assert.match(css,new RegExp(`\\[data-store-style=${style}\\] \\.store-rows\\{grid-template-columns:repeat\\(2,minmax\\(0,1fr\\)\\)`),style);
    assert.match(css,new RegExp(`\\[data-store-style=${style}\\] \\.store-row,\\[data-store-style=${style}\\] \\.store-row\\.has-action\\{[^}]*grid-template-areas:`),style);
    assert.match(css,new RegExp(`@media \\(max-width:(339|359)px\\)\\{\\[data-store-style=${style}\\] \\.store-rows\\{grid-template-columns:1fr\\}`),`${style} drops to one column on the smallest phones`);
  }
  for(const style of ['compact','editorial'])assert.doesNotMatch(css,new RegExp(`\\[data-store-style=${style}\\] \\.store-rows\\{grid-template-columns:repeat\\(2`),style);
  // Each card style has its own signature: a featured lead, a hairline numeral grid, tickets with a perforation.
  assert.match(css,/\[data-store-style=horizon\] \.store-row\.is-featured:first-child\{grid-column:1\/-1/);
  // Studio draws each cell's own hairlines, so an odd last cell leaves a blank space, not a filled block.
  assert.match(css,/\[data-store-style=studio\] \.store-row,\[data-store-style=studio\] \.store-row\.has-action\{[^}]*box-shadow:inset -1px -1px 0 var\(--store-border\)/);
  assert.doesNotMatch(css,/\[data-store-style=studio\] \.store-rows\{[^}]*background:/);
  assert.match(css,/\[data-store-style=signature\] \.store-row::after\{[^}]*border-top:1\.5px dashed/);
  assert.doesNotMatch(STORE_STYLE_CSS,/url\(|@import|expression|javascript:/i);
});

test('every style uses one bundle component and one checkout; the gallery shows the same Buy layout at example prices',()=>{
  const managed=source('src/components/website/ManagedDataStorefront.tsx');
  assert.equal(managed.match(/<BundleRow /g)?.length,1);assert.doesNotMatch(managed,/styleVariant|data-store-style/);
  assert.match(source('src/components/website/storefront/ResellerCatalogue.tsx'),/\$\{featured \? ' is-featured' : ''\}/);
  const html=render('tmpl-data-reseller');
  assert.ok(html.includes('aria-label="Example: MTN'),'gallery bundles announce themselves as examples');
  assert.ok(html.includes('Example bundles and prices'));
  assert.match(html,/class="store-row has-action"/);
});

test('signed-out My Business describes every kind of website, not only Data Stores',()=>{
  const page=source('src/components/website/BusinessWorkspacePage.tsx');
  assert.match(page,/edit and publish your website, see visitors and customer activity, and, for a Data Store, manage orders, prices and Store Earnings/);
  assert.doesNotMatch(page,/shows your website, orders, prices and earnings/);
});
