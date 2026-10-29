import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resellerCatalogueSummary,resellerStoreStatus,resellerLaunchSteps,type ResellerCatalogueSummary} from '../../../src/utils/websiteOwnerAttention.js';
import {estimatedEarningMinor,planBundleSetup,planExample,sellerDrafts,type SellerBundle} from '../../../src/utils/websitePricing.js';
import {storeReserve,minimumStorePrice,type StorePolicy} from '../../../shared/storeEconomics.js';
import {percentMinor} from '../../../shared/money.js';

const source=(path:string)=>readFileSync(path,'utf8');
const summary=(patch:Partial<ResellerCatalogueSummary>={}):ResellerCatalogueSummary=>({sellable:4,ownerOnSale:4,available:20,checkoutEnabled:true,...patch});

test('catalogue summary reads only server fields from the owner bundle catalogue',()=>{
  assert.equal(resellerCatalogueSummary(null),null);
  assert.equal(resellerCatalogueSummary({} as any),null,'never guesses before products load');
  assert.deepEqual(resellerCatalogueSummary({policy:{enabled:true},products:[
    {eligible:true,configured:true,enabled:true,retailMinor:700},
    {eligible:false,configured:true,enabled:true,retailMinor:100},
    {eligible:false,configured:false,enabled:true,retailMinor:900},
    {eligible:false,configured:true,enabled:false,retailMinor:0},
  ]}),{sellable:1,ownerOnSale:3,available:3,checkoutEnabled:true});
  assert.equal(resellerCatalogueSummary({products:[]})!.checkoutEnabled,false,'a missing policy is treated as checkout off');
});

test('store status never says open unless checkout is on, bundles are eligible and the store is published',()=>{
  assert.equal(resellerStoreStatus({published:true,catalogue:null}),null);
  const open=resellerStoreStatus({published:true,catalogue:summary()})!;
  assert.equal(open.state,'open');assert.equal(open.tone,'ready');assert.equal(open.action?.action,'share');assert.match(open.title,/4 bundles/);
  // Each blocking condition wins over "open", in the order an owner can do something about it.
  const paused=resellerStoreStatus({published:true,catalogue:summary({checkoutEnabled:false,sellable:0})})!;
  assert.equal(paused.state,'checkout-paused');assert.equal(paused.tone,'blocked');assert.equal(paused.action?.action,'support');
  assert.match(paused.detail,/prices are kept/);
  assert.match(resellerStoreStatus({published:false,catalogue:summary({checkoutEnabled:false,sellable:0,ownerOnSale:0})})!.detail,/set up your bundles/);
  const supply=resellerStoreStatus({published:true,catalogue:summary({available:0,sellable:0})})!;
  assert.equal(supply.state,'catalogue-unavailable');assert.equal(supply.tone,'blocked');
  const liveEmpty=resellerStoreStatus({published:true,catalogue:summary({sellable:0,ownerOnSale:0})})!;
  assert.equal(liveEmpty.state,'needs-bundles');assert.equal(liveEmpty.label,'Live, no bundles');assert.equal(liveEmpty.action?.action,'pricing');
  assert.match(resellerStoreStatus({published:true,catalogue:summary({sellable:0,ownerOnSale:3})})!.detail,/can be sold right now/);
  const draft=resellerStoreStatus({published:false,catalogue:summary()})!;
  assert.equal(draft.state,'needs-publish');assert.equal(draft.action?.action,'publish');
  for(const s of [paused,supply,liveEmpty,draft])assert.doesNotMatch(`${s.title} ${s.detail} ${s.label}`,/ready to sell|live checkout|open for orders/i);
  // The existing launch steps keep their contract.
  assert.equal(resellerLaunchSteps({sellableBundles:1,published:true}),null);
});

test('dashboard shows one status card, launch steps only while setup is left, and no false "live and selling" text',()=>{
  const dash=source('src/components/website/WebsiteBusinessDashboard.tsx');
  assert.doesNotMatch(dash,/live, reachable and/);
  assert.doesNotMatch(dash,/website-live-strip/);
  assert.match(dash,/status\.state==='needs-bundles'\|\|status\.state==='needs-publish'\)\?resellerLaunchSteps/);
  assert.match(dash,/\['bundles','publish','share'\]\.includes\(item\.id\)/,'status card replaces those attention items');
  // Done launch steps no longer offer their action again ("Store published" + "Publish").
  assert.match(dash,/\{next&&\(step\.id!=='share'\|\|onShare\)&&<button/);
  // Suggestions come after the business picture.
  assert.ok(dash.indexOf('data-suggestions')>dash.indexOf("tab==='Overview'?'Customer activity'"));
  assert.match(dash,/websiteBusinessRequest\(`websites\/\$\{site\.id\}\/bundles`,token\)\.then\(\(r:any\)=>\{if\(live\)setCatalogue\(resellerCatalogueSummary\(r\)\)/);
});

test('withdrawals: form only when Available meets the server minimum; fee preview uses the server rounding',()=>{
  const dash=source('src/components/website/WebsiteBusinessDashboard.tsx');
  assert.match(dash,/const canWithdraw=available>=minimum&&available>0;/);
  assert.match(dash,/minimum=Number\(data\.policy\.withdrawalMinimumMinor/);
  assert.match(dash,/percentMinor\(requested,feeBps\)/);
  assert.doesNotMatch(dash,/GH₵5|300 ?bps|3%/,'no hardcoded withdrawal policy');
  assert.doesNotMatch(dash,/instant(ly)? (paid|payout|withdraw)|automatic(ally)? (paid|sent)/i);
  assert.match(dash,/it is not instant/);
  const finance=source('server/services/financeService.ts');
  assert.match(finance,/const fee=percentMinor\(amount,settings\.withdrawalFeeBps\)/);
  assert.equal(percentMinor(1000,300),30);
  for(const [value,label] of [['mtn','MTN MoMo'],['telecel','Telecel Cash'],['airteltigo','AirtelTigo Money']])assert.ok(dash.includes(`['${value}','${label}']`));
});

const policy:StorePolicy={enabled:true,reserveBps:300,reserveFixedMinor:10,withdrawalMinimumMinor:500,withdrawalFeeBps:300,version:'fixture'};
const bundle=(id:string,dataAmount:string,wholesale:number|null):SellerBundle=>({id,network:'mtn',networkName:'MTN',dataAmount,retailMinor:0,enabled:false,configured:wholesale!==null,wholesaleMinor:wholesale,minimumMinor:wholesale===null?null:minimumStorePrice(wholesale,policy)});

test('earning estimate is the same sum the server snapshots, and never shown below the minimum',()=>{
  const p=bundle('mtn-5gb','5GB',2000);
  assert.equal(estimatedEarningMinor(p,2600,policy),2600-2000-storeReserve(2600,policy));
  assert.equal(estimatedEarningMinor(p,p.minimumMinor!-1,policy),null);
  assert.ok(estimatedEarningMinor(p,p.minimumMinor!,policy)!>=0,'the minimum covers cost and reserve');
  assert.equal(estimatedEarningMinor(bundle('x','1GB',null),900,policy),null);
  const server=source('server/services/websiteBusinessService.ts');
  assert.match(server,/estimatedMinor:eligible\?price\.retailMinor-cost\.wholesaleMinor-storeReserve\(price\.retailMinor,policy\):null/);
});

test('quick setup preview shows one honest example and changes nothing by itself',()=>{
  const products=[bundle('mtn-1gb','1GB',400),bundle('mtn-5gb','5GB',2000),bundle('mtn-none','2GB',null)];
  const drafts=sellerDrafts(products);
  const plan=planBundleSetup(products,drafts,{networks:['mtn'],priceMode:'markup',kind:'percent',value:'10',activation:'enable'});
  const example=planExample(products,plan,policy)!;
  assert.equal(example.name,'MTN 5GB');
  const five=products[1];
  assert.equal(example.retailMinor,five.minimumMinor!+Math.round(five.minimumMinor!*0.1));
  assert.equal(example.earningMinor,estimatedEarningMinor(five,example.retailMinor,policy));
  assert.deepEqual(drafts,sellerDrafts(products),'the plan is a preview only');
  const off=planBundleSetup(products,drafts,{networks:['mtn'],priceMode:'keep',kind:'percent',value:'10',activation:'disable'});
  assert.equal(planExample(products,off,policy),null,'nothing on sale, no example');
});

test('pricing explains the minimum in plain words and keeps every server safeguard',()=>{
  const pricing=source('src/components/website/WebsiteBundlePricing.tsx');
  assert.match(pricing,/data-pricing-explainer/);assert.match(pricing,/data-plan-example/);
  assert.doesNotMatch(pricing,/Eligible means|configured<\/strong>|The rest can\./);
  assert.match(pricing,/data-checkout-paused/);
  assert.match(pricing,/expectedVersion:catalog\.version/);
  assert.match(pricing,/e\.status===409/);
  assert.match(pricing,/onSaved\?\.\(live\)/);
});
