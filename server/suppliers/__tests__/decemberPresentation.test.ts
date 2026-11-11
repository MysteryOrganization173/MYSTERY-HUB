import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {directQuoteView,formatGhsShort} from '../../../src/utils/directQuotePresentation';
import {campaignPriceForBundle,welcomePriceForBundle} from '../../../src/utils/welcomeOfferPresentation';
import {CompactBundleRow} from '../../../src/components/data/CompactBundleRow';
import {BundleCard} from '../../../src/components/data/BundleCard';
import {CustomerOrderCard} from '../../../src/components/orders/CustomerOrderCard';
import {welcomeFigure,WELCOME_HEADLINE_CEILING} from '../../../src/seasonal/christmas/kit/welcome';
import {WEBSITE_TEMPLATES} from '../../../src/data/templates';

/* December Specials presentation: checkout explains standard price, December price, the one-time welcome benefit and the
   payable total, all from the server quote; catalogue rows show one price; nothing invents or recomputes a charge. */

const text=(html:string)=>html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const offer=(state:string)=>({enabled:true,discountMinor:100,requirement:'unique_phone',state});
const campaign={id:'december-specials-2026',label:'December Special',endDate:'2027-01-05',stacksWithWelcome:true,revision:'r'};
const quote=(regular:number,discount:number,extra:any={})=>({regularMinor:regular,discountMinor:discount,totalMinor:regular-discount,pricingRevision:'p',promotionRevision:'w',offer:offer(discount?'eligible':'guest'),...extra});
const bundle:any={id:'mtn-1gb',network:'mtn',dataAmount:'1GB',dataBytesValue:1024,validity:'Direct Credit',validityCategory:'Monthly',priceGhc:5.49,isPopular:true};
const december:any={...bundle,priceGhc:4.99,standardPriceGhc:5.49,priceCampaign:{label:'December Special',stacksWithWelcome:true}};
const eligible={enabled:true,state:'eligible',discountMinor:100};

test('no promotion: the confirmed total only, no discount rows or notes',()=>{
 const v=directQuoteView(quote(549,0))!;assert.equal(v.totalMinor,549);assert.equal(v.standardMinor,549);assert.equal(v.campaignLabel,null);assert.equal(v.savingMinor,0);assert.equal(v.welcomeNote,null);assert.equal(v.stateNote,null);
 assert.equal(v.description,'total GH₵5.49.');
});
test('welcome only (today): regular price, the one-time benefit, total 4.49',()=>{
 const v=directQuoteView(quote(549,100))!;assert.equal(v.sellingMinor,549);assert.equal(v.totalMinor,449);assert.equal(v.savingMinor,100);
 assert.equal(v.welcomeNote,'Your GH₵1 welcome benefit applies to your first qualifying purchase only.');
});
test('December, not eligible: regular 5.49 crossed out, December Special 4.99, total 4.99, save 0.50',()=>{
 const v=directQuoteView(quote(499,0,{standardMinor:549,campaignSavingMinor:50,campaign}))!;
 assert.deepEqual([v.standardMinor,v.sellingMinor,v.discountMinor,v.totalMinor,v.savingMinor,v.campaignLabel],[549,499,0,499,50,'December Special']);
 assert.equal(v.welcomeNote,null);assert.equal(v.description,'Regular price GH₵5.49, December Special GH₵4.99; total GH₵4.99; you save GH₵0.50.');
});
for(const [standard,dec,first] of [[549,499,399],[1049,899,799]])test(`December and welcome eligible: ${standard} → ${dec} → −100 → ${first}`,()=>{
 const v=directQuoteView(quote(dec,100,{standardMinor:standard,campaignSavingMinor:standard-dec,campaign}))!;
 assert.deepEqual([v.standardMinor,v.sellingMinor,v.discountMinor,v.totalMinor,v.savingMinor],[standard,dec,100,first,standard-first]);
 assert.match(v.welcomeNote!,/first qualifying purchase only/);assert.match(v.description,/first-order welcome benefit minus GH₵1\.00; total/);
});
test('returning customer sees the December price with no welcome suggestion; reserved says why',()=>{
 const returning=directQuoteView(quote(499,0,{standardMinor:549,campaign,offer:offer('previous_buyer')}))!;assert.equal(returning.welcomeNote,null);assert.equal(returning.stateNote,null);
 const reserved=directQuoteView(quote(499,0,{standardMinor:549,campaign,offer:offer('reserved')}))!;assert.match(reserved.stateNote!,/held by a payment that is still being confirmed/);
});
test('an inconsistent or incomplete quote is never shown as confirmed',()=>{
 for(const bad of [null,{},quote(549,0,{totalMinor:500}),quote(549,100,{totalMinor:449.5}),quote(499,0,{standardMinor:499,campaign}),quote(499,0,{standardMinor:450,campaign}),quote(499,0,{standardMinor:549}),quote(499,0,{standardMinor:'549',campaign}),{...quote(100,100)}])assert.equal(directQuoteView(bad),null,JSON.stringify(bad));
 assert.equal(formatGhsShort(100),'GH₵1');assert.equal(formatGhsShort(150),'GH₵1.50');
});
test('checkout shows nothing as a total or Pay amount until the quote is confirmed',()=>{
 const checkout=readFileSync('src/components/checkout/CheckoutModal.tsx','utf8');
 assert.match(checkout,/quotePending \? <span className="text-base font-semibold text-slate-400">\{quoteError \? 'Not confirmed' : 'Checking price…'\}<\/span>/);
 assert.match(checkout,/quotePending \? \(quoteError \? 'Price not confirmed' : 'Checking price…'\) : `Pay GH₵/);
 assert.match(checkout,/\{quoteError \? 'Not confirmed' : 'Checking…'\}/,'the summary card has no price before the quote');
 assert.match(checkout,/<dt>First-order welcome benefit<\/dt>/);assert.match(checkout,/<del aria-label=\{`Regular price/);
 assert.match(checkout,/The total changed from \$\{formatGhs\(previous.total\)\} to \$\{formatGhs\(commercial.totalMinor\)\}. Review it before paying./);
 assert.match(checkout,/expectedStandardMinor:commercial.standardMinor/);assert.doesNotMatch(checkout,/Christmas|December|seasonal/i,'one checkout for every experience');
});

test('catalogue row, December only: one price, the label, the crossed-out standard price and the saving',()=>{
 const html=renderToStaticMarkup(React.createElement(CompactBundleRow,{bundle:december,onBuy(){}}));
 assert.match(text(html),/December Special GH₵5\.49 GH₵4\.99 You save GH₵0\.50/);assert.match(html,/<del>GH₵5\.49<\/del>/);
 assert.match(html,/aria-label="Buy 1GB MTN Ghana data\. December Special GH₵4\.99; regular price GH₵5\.49\. You save GH₵0\.50\."/);
 assert.doesNotMatch(text(html),/Popular|instant/i);
});
test('catalogue row, December and eligible: the first-order 3.99 with the standard price crossed out',()=>{
 const html=renderToStaticMarkup(React.createElement(CompactBundleRow,{bundle:december,directWelcomeOffer:eligible,onBuy(){}}));
 assert.match(text(html),/Welcome Price GH₵5\.49 GH₵3\.99 You save GH₵1\.50/);assert.doesNotMatch(text(html),/GH₵4\.99 /,'no second conflicting price');
 assert.match(html,/December Special GH₵4\.99, less your GH₵1\.00 welcome benefit\. You save GH₵1\.50 on one qualifying purchase only\./);
 const card=renderToStaticMarkup(React.createElement(BundleCard,{bundle:{...december,id:'mtn-2gb',dataAmount:'2GB',priceGhc:8.99,standardPriceGhc:10.49},directWelcomeOffer:eligible,onBuy(){}}));
 assert.match(text(card),/Welcome Price GH₵10\.49 GH₵7\.99 You save GH₵2\.50/);
});
test('no campaign: rows are exactly as before; reseller cards, Instant and Airtime never show campaign prices',()=>{
 assert.equal(campaignPriceForBundle(bundle),null);assert.equal(welcomePriceForBundle(bundle,eligible)!.totalMinor,449);
 const themed=renderToStaticMarkup(React.createElement(BundleCard,{bundle:december,colorScheme:WEBSITE_TEMPLATES[0].colorScheme,onBuy(){}}));assert.doesNotMatch(themed,/December Special|<del>/);
 for(const extra of [{serviceType:'airtime'},{serviceType:'instant_bundle'},{id:'instant-mtn-1gb'}])assert.equal(campaignPriceForBundle({...december,...extra}),null);
 assert.equal(campaignPriceForBundle({...december,standardPriceGhc:4.99}),null,'not a reduction, not a special');
});
test('a campaign that does not stack shows its price, never a welcome price',()=>{
 const own={...december,priceCampaign:{label:'Christmas Day deal',stacksWithWelcome:false}};
 assert.equal(welcomePriceForBundle(own,eligible),null);assert.match(text(renderToStaticMarkup(React.createElement(CompactBundleRow,{bundle:own,directWelcomeOffer:eligible,onBuy(){}}))),/Christmas Day deal GH₵5\.49 GH₵4\.99/);
});
test('welcome headline: capped at the approved ceiling, so December keeps "up to 18%" instead of dropping to a smaller figure',()=>{
 const guest={enabled:true,state:'guest',discountMinor:100};
 const today=[bundle,{...bundle,id:'at-1gb',network:'airteltigo',priceGhc:4.99},{...bundle,id:'mtn-2gb',dataAmount:'2GB',priceGhc:10.49}];
 assert.deepEqual(welcomeFigure(guest,today,true),{percent:18,regularMinor:549,label:'MTN 1GB'},'today: unchanged');
 const dec=[december,{...december,id:'mtn-2gb',dataAmount:'2GB',priceGhc:8.99,standardPriceGhc:10.49},{...bundle,id:'mtn-3gb',dataAmount:'3GB',priceGhc:14.99}];
 assert.equal(welcomeFigure(guest,dec,true)!.percent,WELCOME_HEADLINE_CEILING,'GH₵1 off GH₵4.99 is 20%: the headline stays at the 18% ceiling, never above it');
 assert.equal(welcomeFigure(guest,[dec[2]],true)!.percent,6);
 assert.equal(welcomeFigure(guest,[{...december,priceCampaign:{label:'x',stacksWithWelcome:false}}],true),null);
});
test('order history shows the saving from the order\'s own snapshot, not today\'s prices',()=>{
 const base:any={id:'MH-1',publicReference:'MH-1',network:'mtn',dataAmount:'1GB',bundleSize:'1GB',recipientPhone:'0240000001',amountGhc:3.99,status:'delivered',serviceType:'data',createdAt:'2026-12-10T10:00:00Z',bundle:{dataAmount:'1GB'}};
 const status={group:'delivered',label:'Delivered'} as const;
 const render=(commercialPricing:any)=>text(renderToStaticMarkup(React.createElement(CustomerOrderCard,{order:{...base,commercialPricing},status,onOpen(){},now:new Date('2026-12-10T12:00:00Z')})));
 assert.match(render({regularMinor:499,discountMinor:100,paidMinor:399,standardMinor:549}),/GH₵3\.99.*Saved GH₵1\.50/);
 assert.match(render({regularMinor:549,discountMinor:100,paidMinor:449}),/Saved GH₵1\.00/);
 assert.doesNotMatch(render({regularMinor:499,discountMinor:0,paidMinor:499}),/Saved/,'a sale with no campaign or welcome saving claims none');
});
