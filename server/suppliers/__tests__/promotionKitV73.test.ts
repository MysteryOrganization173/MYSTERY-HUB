/** V7.3 Release C: Promotion Kit V1 for Data Stores. Adverts say only what the owner's published store shows. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {
  PROMO_DESIGNS, PROMO_FORMATS, cleanPromoHeadline, promoBundlesFor, promoBundlesFromStorefront, promoCaption, promoDescription, promoDesign,
  promoDesignAvailable, promoDisplayUrl, promoFileName, promoNetworkList, promoNetworksIn, promoPalette, type PromoChoice, type PromoFacts,
} from '../../../src/utils/promotionKit.js';
import {promoLogoSource,promoUrlLines} from '../../../src/utils/promotionCanvas.js';
import {websiteContrast} from '../../../src/utils/websiteBrand.js';
import {WEBSITE_PALETTES} from '../../../src/utils/websitePalettes.js';
import {businessDock,initialWorkspaceTabs,workspacePath,workspaceSectionFromPath,workspaceSections} from '../../../src/utils/businessWorkspace.js';

const source=(file:string)=>readFileSync(file,'utf8');
const storefront={managed:true,version:'v1',products:[
  {id:'mtn-1gb',network:'mtn',dataAmount:'1GB',validity:'No expiry',retailMinor:600},
  {id:'mtn-5gb',network:'mtn',dataAmount:'5GB',validity:'No expiry',retailMinor:2650},
  {id:'mtn-2gb',network:'mtn',dataAmount:'2GB',validity:'No expiry',retailMinor:1150},
  {id:'telecel-2gb',network:'telecel',dataAmount:'2GB',retailMinor:1100},
  {id:'bad-price',network:'mtn',dataAmount:'3GB',retailMinor:0},
  {id:'bad-network',network:'glo',dataAmount:'3GB',retailMinor:900},
  {id:'fractional',network:'mtn',dataAmount:'4GB',retailMinor:12.5},
]};
const facts=(extra:Partial<PromoFacts>={}):PromoFacts=>({name:'Ama Data Hub',url:'https://mysterybundlehub.com/sites/ama-data-hub',colors:{background:'#0a0f1d',primary:'#0f172a',accent:'#3b82f6'},bundles:promoBundlesFromStorefront(storefront),pinned:['mtn-5gb'],...extra});
const choice=(extra:Partial<PromoChoice>={}):PromoChoice=>({design:'launch',format:'story',treatment:'brand',headline:'Now open',...extra});

test('only well-formed bundles the public storefront sells are used, at its prices',()=>{
  const bundles=promoBundlesFromStorefront(storefront);
  assert.deepEqual(bundles.map(b=>b.id),['mtn-1gb','mtn-5gb','mtn-2gb','telecel-2gb']);
  assert.deepEqual(promoBundlesFromStorefront(null),[]);assert.deepEqual(promoBundlesFromStorefront({products:'x'}),[]);
  assert.deepEqual(promoNetworksIn(bundles),['mtn','telecel'],'networks come from bundles on sale, never assumed');
  assert.equal(promoNetworkList(['mtn','telecel','airteltigo']),'MTN, Telecel and AirtelTigo');
});

test('six distinct designs; the ones that quote prices need verified bundles',()=>{
  assert.deepEqual(PROMO_DESIGNS.map(d=>d.id),['launch','bundles','networks','featured','identity','direct']);
  assert.equal(new Set(PROMO_DESIGNS.map(d=>d.label)).size,6);
  const none=facts({bundles:[]});
  for(const d of PROMO_DESIGNS)assert.equal(promoDesignAvailable(d,none),!d.needsBundles,d.id);
  assert.deepEqual(PROMO_DESIGNS.filter(d=>d.needsBundles).map(d=>d.id),['bundles','networks','featured']);
  assert.deepEqual(PROMO_FORMATS.story,{...PROMO_FORMATS.story,width:1080,height:1920});assert.deepEqual(PROMO_FORMATS.square,{...PROMO_FORMATS.square,width:1080,height:1080});
});

test('permitted messages never invent discounts, urgency, delivery times or popularity',()=>{
  const claims=/%|off\b|discount|sale\b|free\b|cheapest|best|fastest|instant|guarantee|only today|hurry|limited|last chance|minutes|hours|popular|best-?sell|#1|deal|promo/i;
  for(const d of PROMO_DESIGNS)for(const m of d.messages(facts()))assert.doesNotMatch(m,claims,`${d.id}: ${m}`);
  for(const d of PROMO_DESIGNS)assert.doesNotMatch(promoCaption(choice({design:d.id}),facts()),claims,d.id);
  assert.equal(cleanPromoHeadline('  <b>Data   for {all}</b>  '),'bData for all/b');
  assert.equal(cleanPromoHeadline('x'.repeat(80)).length,48);
});

test('bundles shown: the owner’s featured first, then smallest; prices exactly as the storefront sells them',()=>{
  const f=facts();
  assert.deepEqual(promoBundlesFor(choice({design:'bundles'}),f).map(b=>b.id),['mtn-5gb','mtn-1gb','mtn-2gb']);
  assert.deepEqual(promoBundlesFor(choice({design:'bundles',network:'telecel'}),f).map(b=>b.id),['telecel-2gb']);
  assert.deepEqual(promoBundlesFor(choice({design:'bundles',format:'square'}),f).length,3);
  assert.deepEqual(promoBundlesFor(choice({design:'featured',bundleId:'mtn-2gb'}),f).map(b=>b.id),['mtn-2gb']);
  assert.deepEqual(promoBundlesFor(choice({design:'featured',bundleId:'not-on-sale'}),f).map(b=>b.id),['mtn-5gb'],'an unknown pick falls back to a real bundle');
  const caption=promoCaption(choice({design:'bundles'}),f);
  for(const line of ['MTN data bundles from Ama Data Hub:','• 5GB · GH₵26.50','• 1GB · GH₵6.00','the store always shows the current price','https://mysterybundlehub.com/sites/ama-data-hub'])assert.ok(caption.includes(line),line);
  assert.equal(promoCaption(choice({design:'featured',bundleId:'mtn-1gb'}),f),'1GB MTN for GH₵6.00 on Ama Data Hub. The store always shows the current price. https://mysterybundlehub.com/sites/ama-data-hub');
  assert.match(promoCaption(choice({design:'networks'}),f),/MTN and Telecel data bundles, all on Ama Data Hub\. MTN from GH₵6\.00 · Telecel from GH₵11\.00\./);
  assert.ok(!promoCaption(choice({design:'launch'}),facts({bundles:[]})).includes('MTN'),'no networks claimed without bundles');
});

test('every colour treatment keeps text readable on all twenty palettes',()=>{
  for(const p of WEBSITE_PALETTES)for(const t of ['brand','bold','light'] as const){
    const pal=promoPalette({background:p.backgroundColor,primary:p.primaryColor,accent:p.accentColor},t);
    assert.ok(websiteContrast(pal.ink,pal.bg)>=4.5,`${p.name} ${t} ink`);
    assert.ok(websiteContrast(pal.muted,pal.bg)>=4.5,`${p.name} ${t} muted`);
    assert.ok(websiteContrast(pal.onAccent,pal.accent)>=4.5,`${p.name} ${t} button text`);
    // Price lists and the featured card print names and prices on the card colour.
    assert.ok(websiteContrast(pal.ink,pal.panel)>=4.5,`${p.name} ${t} text on cards`);
    assert.ok(websiteContrast(pal.accent,pal.panel)>=3,`${p.name} ${t} prices on cards`);
  }
  // Regression: a light palette with a dark main colour once gave the price list a dark green card under dark text.
  const ivory=promoPalette({background:'#f8f5ec',primary:'#16301f',accent:'#1f5a3a'},'brand');
  assert.ok(websiteContrast(ivory.ink,ivory.panel)>=7,'Ivory and forest cards stay light');
});

test('a long store link breaks cleanly after /sites/ and is never altered',()=>{
  const ctx={font:'',measureText(this:{font:string},text:string){const size=Number(/(\d+)px/.exec(this.font)?.[1]||10);return{width:text.length*size*.56};}} as unknown as CanvasRenderingContext2D;
  const short=promoUrlLines(ctx,'mysterybundlehub.com/sites/ama',904);assert.deepEqual(short.lines,['mysterybundlehub.com/sites/ama']);assert.ok(short.size>=34);
  const long=promoUrlLines(ctx,'mysterybundlehub.com/sites/nana-akosua-owusu-ansah-premium-data',904);
  assert.deepEqual(long.lines,['mysterybundlehub.com/sites/','nana-akosua-owusu-ansah-premium-data']);
  assert.equal(long.lines.join(''),'mysterybundlehub.com/sites/nana-akosua-owusu-ansah-premium-data','no hyphen added, nothing cut');
  assert.ok(long.size>=34,'still readable on a phone');
});

test('link, file name, description and logo source',()=>{
  assert.equal(promoDisplayUrl('https://www.mysterybundlehub.com/sites/ama-data-hub/'),'mysterybundlehub.com/sites/ama-data-hub');
  assert.equal(promoFileName('ama-data-hub',choice({design:'featured',format:'square'})),'ama-data-hub-featured-1080x1080.png');
  assert.equal(promoFileName('../x?y',choice()),'xy-launch-1080x1920.png');
  assert.match(promoDescription(choice({design:'featured',bundleId:'mtn-1gb',headline:'My pick for you'}),facts()),/^Featured bundle advert for Ama Data Hub\. My pick for you\. MTN 1GB GH₵6\.00\. mysterybundlehub\.com\/sites\/ama-data-hub$/);
  assert.equal(promoLogoSource('https://res.cloudinary.com/demo/image/upload/v1/logo.png'),'https://res.cloudinary.com/demo/image/upload/f_png,w_480,h_480,c_limit/v1/logo.png');
  assert.equal(promoLogoSource('javascript:alert(1)'),null);assert.equal(promoLogoSource(''),null);
  assert.equal(promoDesign('direct').label,'Straight to store');
});

test('Promote is a Data Store area in My Business, opened from More and from the share kit, not a second dashboard',()=>{
  const all=workspaceSections(initialWorkspaceTabs(true));
  assert.ok(all.includes('promote'));assert.ok(!businessDock(all,true).includes('promote'),'the dock keeps Overview · Orders · Pricing · Earnings');
  assert.ok(!workspaceSections(initialWorkspaceTabs(false)).includes('promote'),'V1 is for Data Stores');
  assert.equal(workspacePath('promote'),'/my-business/promote');assert.equal(workspaceSectionFromPath('/my-business/promote'),'promote');
  const dashboard=source('src/components/website/WebsiteBusinessDashboard.tsx'),page=source('src/components/website/BusinessWorkspacePage.tsx');
  assert.match(dashboard,/\.\.\.\(reseller\?\['Promote'\]:\[\]\)/);assert.match(dashboard,/\{tab==='Promote'&&promote\}/);
  assert.match(page,/promote=\{reseller && <PromotionKit /);assert.match(page,/<StoreShareKit name=\{name\} url=\{publicUrl\} onPromote=\{\(\) => go\('promote'\)\} \/>/);
});

test('the kit reads prices from the public storefront only, needs no new dependency and never pays or orders',()=>{
  const kit=source('src/components/website/PromotionKit.tsx'),canvas=source('src/utils/promotionCanvas.ts');
  assert.match(kit,/websites\/\$\{encodeURIComponent\(site\.id\)\}\/storefront/);
  assert.doesNotMatch(kit+canvas,/\/bundles`|store-checkout|initializeStorePayment|withdraw|paystack\.co/i);
  assert.match(canvas,/img\.crossOrigin = 'anonymous'/);assert.match(canvas,/if \(logo\) return toBlob\(null\)/,'a tainted logo falls back to initials');
  const pkg=JSON.parse(source('package.json'));for(const dep of ['html2canvas','html-to-image','dom-to-image','konva','fabric'])assert.ok(!pkg.dependencies?.[dep]&&!pkg.devDependencies?.[dep],dep);
});
