import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import express from 'express';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createPublicHtmlRouter, injectSocialHead } from '../../routes/publicHtml.js';
import { resolvePublicSocialMetadata } from '../../services/publicSocialMetadata.js';
import { publicImageUrl, socialImage, marketplaceProductHead, publicPageHead, websiteSocialHead, PUBLIC_ORIGIN } from '../../../src/utils/socialMetadata.js';
import { marketplaceProductKey } from '../../../src/utils/marketplaceDeepLink.js';
import { DATA_RESELLER_LEGACY_HERO_IMAGE as LEGACY, DATA_RESELLER_STARTER_HERO_IMAGE as NEUTRAL } from '../../../src/utils/dataResellerArtwork.js';
import { toPublicMarketplaceProduct } from '../../types/marketplace.js';
import { publishedWebsiteRecord } from '../../services/websitePublication.js';
import type { MarketplaceProduct, PublicWebsiteSite } from '../../../src/types/index.js';

const product = (extra: Partial<MarketplaceProduct> = {}): MarketplaceProduct => ({
  id: 'mp_fixture', slug: 'synthetic-laptop', name: 'Synthetic Latitude Laptop', category: 'laptops_computers', categoryLabel: 'Laptops',
  tagline: '16GB RAM, 256GB SSD', description: 'Saved product description', priceType: 'fixed', priceMinor: 445000, priceDisplay: 'GH₵4,450',
  availability: 'available', availabilityLabel: 'Available', highlights: [], purchaseEnabled: true, fulfilmentMode: 'delivery',
  imageUrl: 'https://res.cloudinary.com/fixture/image/upload/v1/own-laptop.jpg', ...extra,
});
const site = (extra: Partial<PublicWebsiteSite> = {}): PublicWebsiteSite => ({
  id: 'synthetic-site', slug: 'synthetic-cafe', name: 'Owner Cafe', template_id: 'tmpl-buka-bistro',
  content: { businessName: 'Owner Cafe', tagline: 'Coffee by the coast', heroImage: 'https://images.example.com/cafe.jpg', logoUrl: 'https://images.example.com/logo.png' } as any,
  settings: {} as any, ...extra,
});
let directory: string, server: Server, base: string;
const products = new Map<string, MarketplaceProduct>();
const sites = new Map<string, PublicWebsiteSite>();
const reads: string[] = [];
const readers = {
  product: async (key: string) => { reads.push(`product:${key}`); if (key === 'broken') throw Error('Private failure secret'); return products.get(key) as any || null; },
  site: async (key: string) => { reads.push(`site:${key}`); return sites.get(key) || null; },
};
before(async () => {
  assert.equal(process.env.DATABASE_URL, undefined, 'Use isolated test runner');
  products.set('synthetic-laptop', product()); products.set('mp_fixture', product());
  products.set('other', product({slug:'other',name:'Different Phone',imageUrl:'https://images.example.com/phone.jpg'}));
  sites.set('synthetic-cafe', site()); sites.set('other', site({slug:'other',name:'Other owner',content:{businessName:'Other owner',heroImage:'https://images.example.com/other.jpg'} as any}));
  directory = mkdtempSync(path.join(tmpdir(), 'mh-social-'));
  writeFileSync(path.join(directory, 'index.html'), readFileSync('index.html'));
  mkdirSync(path.join(directory, 'assets')); writeFileSync(path.join(directory,'assets','fixture.js'),'window.synthetic=true;');
  const app = express();
  app.get('/api/health', (_req,res) => { res.json({status:'ok'}); });
  app.post('/api/webhooks/paystack', express.raw({type:'application/json'}), (req,res) => { res.json({raw:Buffer.isBuffer(req.body)}); });
  app.use(createPublicHtmlRouter(directory, readers));
  server = await new Promise<Server>(resolve => { const running=app.listen(0,'127.0.0.1',()=>resolve(running)); });
  base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => { await new Promise<void>(resolve=>server.close(()=>resolve())); rmSync(directory,{recursive:true,force:true}); });
const html = async (url: string, headers: Record<string,string>={}) => {
  const response=await fetch(base+url,{headers:{'User-Agent':'facebookexternalhit/1.1',...headers}});
  return {response,text:await response.text()};
};

test('raw HTML contains actual product identity, price, stored image and saved specs without JavaScript', async()=>{
  const {response,text}=await html('/marketplace?product=synthetic-laptop&ref=MH-EXAMPLE&q=laptop');
  assert.equal(response.status,200); assert.match(response.headers.get('content-type')!,/text\/html/);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.match(text,/<title>Synthetic Latitude Laptop<\/title>/); assert.match(text,/GH₵4,450/); assert.match(text,/16GB RAM, 256GB SSD/);
  assert.match(text,/own-laptop.jpg/); assert.match(text,/c_fit,h_630,w_1200/); assert.doesNotMatch(text,/MH-EXAMPLE|q=laptop/);
  assert.equal((text.match(/property="og:title"/g)||[]).length,1); assert.equal((text.match(/name="twitter:image"/g)||[]).length,1);
  assert.match(text,/<div id="root"><\/div>/); assert.match(text,/src="\/src\/main.tsx"/,'SPA entry remains intact');
});
test('distinct products and owners cannot bleed metadata across requests',async()=>{
  for(let i=0;i<2;i++){
    const a=await html('/marketplace?product=synthetic-laptop'),b=await html('/marketplace?product=other');
    assert.match(a.text,/own-laptop.jpg/);assert.doesNotMatch(a.text,/Different Phone|phone.jpg/);assert.match(b.text,/Different Phone/);assert.doesNotMatch(b.text,/own-laptop.jpg/);
    const c=await html('/sites/synthetic-cafe'),d=await html('/sites/other');assert.match(c.text,/<title>Owner Cafe/);assert.doesNotMatch(c.text,/other.jpg/);assert.match(d.text,/other.jpg/);
  }
});
for(const url of ['/marketplace/synthetic-laptop?ref=MH-EXAMPLE','/marketplace?item=synthetic-laptop&category=laptops','/marketplace?id=mp_fixture','/marketplace/index.html?product=synthetic-laptop'])test(`legacy URL initial HTML: ${url}`,async()=>{
  const {response,text}=await html(url);assert.equal(response.status,200);assert.match(text,/<title>Synthetic Latitude Laptop/);assert.equal(response.headers.get('location'),null);
});
for(const key of ['missing','draft','archived'])test(`${key} public product returns neutral 404 with no private content`,async()=>{
  const {response,text}=await html('/marketplace?product='+key);assert.equal(response.status,404);assert.match(text,/noindex/);assert.doesNotMatch(text,/own-laptop|Synthetic Latitude/);
});
test('coming-soon public listing remains truthful and never promises checkout',()=>{
  const p=toPublicMarketplaceProduct({id:'x',slug:'x',name:'Future item',price_type:'fixed',price_minor:10000,availability:'coming_soon',published:true,archived:false} as any);
  const head=marketplaceProductHead(p);assert.match(head.description,/Coming Soon/);assert.match(head.description,/Enquire/);assert.doesNotMatch(head.description,/Online checkout/);
});
test('variant From price, quotation and unavailable prices use the authoritative public projection',()=>{
  const raw={id:'x',slug:'x',name:'Options',price_type:'fixed',price_minor:99999,availability:'available',variants:JSON.stringify([{id:'small',name:'Small',priceMinor:5000,active:true},{id:'large',name:'Large',priceMinor:12000,active:true}])};
  assert.match(marketplaceProductHead(toPublicMarketplaceProduct(raw as any)).description,/From GH₵50/);
  assert.match(marketplaceProductHead(toPublicMarketplaceProduct({...raw,price_type:'quote'} as any)).description,/Request Quote/);
  assert.doesNotMatch(marketplaceProductHead(toPublicMarketplaceProduct({...raw,price_type:'quote'} as any)).description,/Online checkout/);
  assert.match(marketplaceProductHead(product({priceMinor:null})).description,/Contact for pricing/);
});
test('enquiry-only listing does not claim immediate online checkout',()=>{assert.match(marketplaceProductHead(product({purchaseEnabled:false,fulfilmentMode:'inquiry_only'})).description,/Enquire/);});
test('missing or unsafe product image uses approved Marketplace fallback',()=>{
  for(const imageUrl of [undefined,'javascript:alert(1)','http://images.example.com/a.jpg']){
    const head=marketplaceProductHead(product({imageUrl}));assert.match(head.image,/Futuristic_Ghana_Tech_Marketplace_Banner/);
  }
});
test('external images stay exact without fabricated dimensions or MIME',()=>{
  const image='https://images.example.com/photo.jpg?fit=contain';assert.deepEqual(socialImage(image),{image});
  assert.deepEqual(socialImage('https://res.cloudinary.com/fixture/image/upload/w_100/v1/a.png'),{image:'https://res.cloudinary.com/fixture/image/upload/w_100/v1/a.png'});
});

for (const shape of ['portrait', 'square', 'landscape']) test(`Marketplace ${shape} original is shown whole over a blurred fill of itself`,()=>{
  const imageUrl=`https://res.cloudinary.com/fixture/image/upload/v1/${shape}.jpg`;
  const head=marketplaceProductHead(product({imageUrl}));
  // Base layer: the same photo filled and blurred. Foreground: the whole photo fitted (never stretched or cropped).
  assert.equal(head.image,`https://res.cloudinary.com/fixture/image/upload/c_fill,h_630,w_1200/e_blur:1500/e_brightness:-35/l_${shape}/c_fit,h_630,w_1200/fl_layer_apply,g_center/b_rgb:0b0f12,c_pad,h_630,w_1200/f_jpg/q_auto/v1/${shape}.jpg`);
  assert.equal(head.imageWidth,1200);assert.equal(head.imageHeight,630);assert.equal(head.imageType,'image/jpeg');
  const foreground=head.image.split(`l_${shape}/`)[1].split('/fl_layer_apply')[0];
  assert.equal(foreground,'c_fit,h_630,w_1200','the product layer only scales to fit');
  assert.doesNotMatch(head.image,/c_crop|c_scale|b_rgb:ffffff/);
  const output=injectSocialHead('<head><title>Old</title></head>',head);
  for(const tag of ['og:image','og:title','og:description','og:url']) assert.equal((output.match(new RegExp(`property="${tag}"`, 'g'))||[]).length,1);
});

test('Marketplace fallback also uses the dark canvas; marketing defaults stay unchanged',()=>{
  assert.match(marketplaceProductHead(product({imageUrl:''})).image,/c_pad,w_1200,h_630,b_rgb:0b0f12\/v\d+\/Futuristic_Ghana_Tech_Marketplace_Banner/);
  assert.match(publicPageHead('marketplace').image,/b_rgb:ffffff/);
});

for(const slug of ['quickbyte-data','independent-cafe']) test(`${slug} owner image keeps its existing white-padding rendition`,()=>{
  const image='https://res.cloudinary.com/fixture/image/upload/v1/owner-banner.png';
  const record=site({slug,content:{businessName:slug,heroImage:image,logoUrl:'https://images.example.com/owner-logo.png'} as any});
  const before=structuredClone(record),head=websiteSocialHead(record);
  assert.equal(head.image,`https://res.cloudinary.com/fixture/image/upload/f_jpg,q_auto,c_pad,w_1200,h_630,b_rgb:ffffff/v1/owner-banner.png`);
  assert.equal(head.icon,record.content.logoUrl);assert.deepEqual(record,before);
});
test('published website initial HTML uses owner title, image, favicon and no platform ownership graph',async()=>{
  const {response,text}=await html('/sites/synthetic-cafe?ref=MH-EXAMPLE');assert.equal(response.status,200);assert.match(text,/<title>Owner Cafe/);assert.match(text,/cafe.jpg/);assert.match(text,/rel="icon" href="https:\/\/images.example.com\/logo.png"/);
  assert.doesNotMatch(text,/schema.org|rel="manifest"|30338777|MH-EXAMPLE/);assert.match(text,/https:\/\/mysterybundlehub.com\/sites\/synthetic-cafe/);
});
for(const slug of ['missing','unpublished'])test(`${slug} website never leaks owner branding`,async()=>{
  const {response,text}=await html('/sites/'+slug);assert.equal(response.status,404);assert.doesNotMatch(text,/cafe.jpg|Owner Cafe|logo.png/);assert.match(text,/noindex/);
});
test('QuickByte original empty and retired hero resolution is preserved read-only',()=>{
  for(const heroImage of ['', 'https://images.unsplash.com/photo-1556742049-0a67e5572293']){
    const record=site({slug:'quickbyte-data',template_id:'tmpl-data-reseller',content:{businessName:'QuickByte Data',heroImage} as any}),before=structuredClone(record);
    assert.equal(websiteSocialHead(record).image,socialImage(LEGACY).image);assert.deepEqual(record,before);
  }
});
test('neutral starter and owner-chosen replacement remain authoritative for new Data businesses',()=>{
  const owned=site({template_id:'tmpl-data-reseller',content:{businessName:'Another business',heroImage:NEUTRAL,logoUrl:''} as any});
  assert.equal(websiteSocialHead(owned).image,socialImage(NEUTRAL).image);
  assert.equal(websiteSocialHead({...owned,content:{...owned.content,heroImage:'https://images.example.com/custom.jpg'}}).image,'https://images.example.com/custom.jpg');
  assert.equal(websiteSocialHead({...owned,content:{...owned.content,logoUrl:'https://images.example.com/own-logo.png'}}).icon,'https://images.example.com/own-logo.png');
});
test('active section-layout hero image follows the published renderer; dormant/disabled sections do not override it',()=>{
  const content={businessName:'Section Business',heroImage:'https://images.example.com/base.jpg',composition:{version:1,sections:[{id:'hero',type:'hero',enabled:true,order:0,data:{image:'https://images.example.com/section.jpg'}}]}} as any;
  assert.equal(websiteSocialHead(site({content})).image,'https://images.example.com/section.jpg');
  assert.equal(websiteSocialHead(site({content:{...content,layoutMode:'template'}})).image,'https://images.example.com/base.jpg');
  content.composition.sections[0].enabled=false;assert.equal(websiteSocialHead(site({content})).image,'https://images.example.com/base.jpg');
});
test('legacy snapshot compatibility and draft isolation use the existing publication projection',()=>{
  const raw={id:'site',slug:'legacy-cafe',name:'Public Cafe',template_id:'tmpl-buka-bistro',status:'published',content_json:{businessName:'Public Cafe',heroImage:'https://images.example.com/old.jpg'},settings_json:{},published_snapshot_json:null,published_at:'2026-10-01',updated_at:'2026-10-01'} as any;
  const legacy=publishedWebsiteRecord(raw);assert.equal(legacy.content_json.businessName,'Public Cafe');
  const snapshot={version:1,templateId:raw.template_id,name:raw.name,content:raw.content_json,settings:{},publishedAt:raw.published_at};
  const projected=publishedWebsiteRecord({...raw,content_json:{businessName:'PRIVATE DRAFT',heroImage:'https://images.example.com/private.jpg'},published_snapshot_json:snapshot});
  const head=websiteSocialHead(site({name:projected.name,template_id:projected.template_id,content:projected.content_json}));assert.equal(head.title,'Public Cafe');assert.match(head.image,/old.jpg/);assert.doesNotMatch(JSON.stringify(head),/PRIVATE|private.jpg/);
});
test('metadata injection escapes all attributes, quotes, tags and bounds oversized owner text',()=>{
  const head=marketplaceProductHead(product({name:'Laptop </title><script>alert("X")</script>',tagline:'" onload="x & y',description:'x'.repeat(1000)}));
  const output=injectSocialHead('<head><title>Old</title></head>',head);assert.doesNotMatch(output,/<script>|onload="x/);assert.match(output,/&lt;script&gt;/);assert.match(output,/&quot;/);
  assert.equal(marketplaceProductHead(product({name:'x'.repeat(500)})).title.length,90);
  assert.ok(websiteSocialHead(site({content:{businessName:'x'.repeat(500),aboutText:'x'.repeat(500)} as any})).description.length<=160);
});
for(const value of ['javascript:alert(1)','data:image/svg+xml,hi','//evil.example/x','https://user:pass@images.example.com/a','https://127.0.0.1/a','https://169.254.169.254/a','https://localhost/a','https://host.internal/a','https://[::1]/a','https://example.com\\evil/a','https://example.com:8888/a','not-a-url'])test(`unsafe image rejected: ${value}`,()=>{assert.equal(publicImageUrl(value),'');});
test('spoofed Cloudinary host is not transformed and relative safe image has fixed origin',()=>{
  assert.deepEqual(socialImage('https://res.cloudinary.com.evil.example/a'),{image:'https://res.cloudinary.com.evil.example/a'});
  assert.equal(publicImageUrl('/images/own.jpg'),PUBLIC_ORIGIN+'/images/own.jpg');
});
test('host poisoning, cookies and referral values do not change metadata or cause redirects',async()=>{
  const a=await html('/marketplace?product=synthetic-laptop'),b=await html('/marketplace?product=synthetic-laptop&ref=OTHER&token=private',{Host:'attacker.example','X-Forwarded-Host':'attacker.example',Cookie:'session=private'});
  assert.equal(a.text,b.text);assert.doesNotMatch(b.text,/attacker|token=|session=/);assert.equal(b.response.headers.get('location'),null);
});
test('malformed slugs never reach public readers; errors fail closed without secret messages',async()=>{
  const start=reads.length;await html('/sites/%3Cscript%3E');await html('/marketplace?product=https%3A%2F%2F127.0.0.1%2Fsecret');assert.equal(reads.length,start);
  const broken=await html('/marketplace?product=broken');assert.equal(broken.response.status,503);assert.doesNotMatch(broken.text,/Private failure secret/);assert.equal(broken.response.headers.get('cache-control'),'no-store');
  await assert.rejects(()=>resolvePublicSocialMetadata('//evil.example/marketplace',readers));
});
test('payment webhook raw bodies, API responses and unknown API errors do not receive SPA HTML',async()=>{
  assert.deepEqual(await(await fetch(base+'/api/health')).json(),{status:'ok'});
  assert.deepEqual(await(await fetch(base+'/api/webhooks/paystack',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"fixture":true}'})).json(),{raw:true});
  const unknown=await fetch(base+'/api/does-not-exist');assert.equal(unknown.status,404);assert.match(unknown.headers.get('content-type')!,/application\/json/);
});
test('static assets keep correct type and missing JS never gets HTML',async()=>{
  const js=await fetch(base+'/assets/fixture.js');assert.match(js.headers.get('content-type')!,/javascript/);assert.match(js.headers.get('cache-control')!,/immutable/);assert.equal(await js.text(),'window.synthetic=true;');
  const missing=await html('/assets/missing.js');assert.equal(missing.response.status,404);assert.doesNotMatch(missing.text,/<html/);
});
for(const [route,page] of [['/','home'],['/index.html','home'],['/data','data'],['/website-builder','website'],['/website','website'],['/marketplace','marketplace'],['/earn','earn'],['/rewards','earn'],['/afa-registration','afa'],['/services','services']])test(`service HTML is specific and complete: ${route}`,async()=>{
  const {response,text}=await html(route);assert.equal(response.status,200);assert.ok(text.includes(publicPageHead(page).title.replaceAll('&','&amp;')));assert.match(text,/name="twitter:title"/);assert.match(text,/property="og:url"/);
});
test('metadata parser keeps all established query and path aliases without changing inputs',()=>{
  const query='?item=SYNTHETIC-LAPTOP&ref=MH-ABC&category=laptops&q=hello';assert.equal(marketplaceProductKey('/marketplace',query),'synthetic-laptop');assert.equal(query,'?item=SYNTHETIC-LAPTOP&ref=MH-ABC&category=laptops&q=hello');
  assert.equal(marketplaceProductKey('/marketplace/synthetic-laptop',''),'synthetic-laptop');assert.equal(marketplaceProductKey('/marketplace/index.html',''),null);
});
