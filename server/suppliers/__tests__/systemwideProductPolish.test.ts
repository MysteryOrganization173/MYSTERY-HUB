import assert from 'node:assert/strict';
import {test,beforeEach} from 'node:test';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {preferredPaymentMethod} from '../../../src/utils/checkoutPresentation';
import {safeAssistantHref,assistantInline} from '../../../src/utils/assistantFormatting';
import {AssistantText} from '../../../src/components/ai/AssistantText';
import {customerActivityLabel} from '../../../src/utils/customerActivity';
import {WEBSITE_TEMPLATES} from '../../../src/data/templates';
import {mergeSiteWithTemplate,renderTemplateLayout} from '../../../src/utils/templateRendererUtils';
import {WebsiteStore} from '../../db/websiteStore';
import {migrateWebsiteTemplate} from '../../../src/utils/websiteTemplateMigration';
const source=(file:string)=>readFileSync(file,'utf8');
beforeEach(()=>WebsiteStore.clearDevStore());
for(const [label,auth,balance,total,restricted,expected] of [
 ['guest',false,10000,499,false,'paystack'],['sufficient balance',true,5000,499,false,'wallet'],['exact balance',true,499,499,false,'wallet'],['insufficient balance',true,498,499,false,'paystack'],['unknown balance',true,null,499,false,'paystack'],['restricted wallet',true,5000,499,true,'paystack'],['zero quote',true,5000,0,false,'paystack'],['non-finite balance',true,Infinity,499,false,'paystack'],['invalid quote',true,5000,NaN,false,'paystack']
] as const)test(`payment presentation: ${label}`,()=>assert.equal(preferredPaymentMethod(auth,balance,total,restricted),expected));
test('checkout presents recipient and exact quoted total in its single guarded payment step',()=>{const s=source('src/components/checkout/CheckoutModal.tsx');assert.ok(!s.includes('reviewingData'));assert.match(s,/submissionPending.current/);assert.match(s,/Pay GH₵/);assert.match(s,/recipientPhone/);assert.match(s,/expectedTotalMinor/);assert.match(s,/pricingRevision/);});
test('Wallet choice uses server balance, keeps manual choice, and hides guest controls',()=>{const s=source('src/components/finance/WalletPaymentChoice.tsx');assert.match(s,/financeRequest\(sessionToken\)/);assert.match(s,/if \(!sessionToken\) return null/);assert.match(s,/touched.current = true/);assert.match(s,/balanceFailed/);});
test('builder resets template identity and directly routes pricing after save',()=>{const s=source('src/components/website/editor/WebsiteEditor.tsx'),p=source('src/components/website/WebsiteBuilderPage.tsx');assert.match(s,/initialSite.id, initialSite.template_id/);assert.match(p,/key=\{`\$\{activeEditorSite.id\}:\$\{activeEditorSite.template_id\}`\}/);assert.match(s,/onOpenPricing/);assert.match(p,/setDashboardTab\('Bundles & Pricing'\)/);assert.match(p,/website-business-dashboard/);assert.match(s,/isDataReseller/);assert.match(s,/Images &amp; Media/);});
test('image library retains guarded uploads, recovery and compact thumbnails',()=>{const s=source('src/components/website/editor/WebsiteImageField.tsx');for(const contract of ['WEBSITE_IMAGE_MIMES','limits.maxBytes','controller.current?.abort()','Retry image verification','aspect-square','finalizeWebsiteUpload'])assert.ok(s.includes(contract));});
test('template migration out of Data removes Data catalogue while preserving identity/contact/media',async()=>{const {site}=await WebsiteStore.createSite('owner',{template_id:'tmpl-data-reseller',name:'Real Store',content:{phone:'0241234567',heroImage:'https://example.com/store.jpg',items:[{id:'bundle',name:'MTN 1GB',desc:'Data',price:'10'}]}});const migrated=migrateWebsiteTemplate(site.content_json,'tmpl-data-reseller','tmpl-buka-bistro');assert.equal(migrated.phone,'0241234567');assert.equal(migrated.heroImage,'');assert.equal(migrated.businessName,'Real Store');assert.deepEqual(migrated.items,[]);});
for(const t of WEBSITE_TEMPLATES)test(`new ${t.id} website never inherits fictional contacts/catalogue/statistics`,async()=>{const {site}=await WebsiteStore.createSite('owner',{template_id:t.id,name:'Actual Business',content:{logoUrl:'/polish-owner-logo.png'}});assert.equal(site.content_json.phone,'');assert.equal(site.content_json.whatsapp,'');assert.equal(site.content_json.location,'');assert.equal(site.content_json.aboutText,'');assert.deepEqual(site.content_json.items,[]);assert.deepEqual(site.content_json.stats,[]);assert.deepEqual(site.content_json.features,[]);await WebsiteStore.publishSite(site.id,'owner');const published=await WebsiteStore.findPublishedSiteBySlug(site.slug);assert.ok(published);const html=renderToStaticMarkup(renderTemplateLayout(mergeSiteWithTemplate(t,published!.content_json)));assert.ok(html.includes('Actual Business'));const header=html.match(/<(?:nav|header)[\s\S]*?<\/(?:nav|header)>/)?.[0];assert.ok(header?.includes('Actual Business logo'),t.id);for(const claim of ['ISO 9001','D1K1 Certified','All African Telecom','Same-Day Dispatch','12-Month Warranty','Instant SMS','Titled Properties Only','licensed broker','Sony FX6','All items in stock','complimentary chilled hibiscus','Ministry of Works sign-offs','Ada Foah Estuary Sanctuary'])assert.ok(!html.includes(claim),claim);});
test('explicit customer content survives initial site creation',async()=>{const {site}=await WebsiteStore.createSite('owner',{template_id:'tmpl-buka-bistro',name:'Ama',content:{items:[{name:'Soup',desc:'Today',price:'25'}],stats:[{label:'Branches',value:'2'}],features:['Vegetarian options'],phone:'0241234567',location:'Tema',tagline:'Our food',aboutText:'Our story'}});assert.equal(site.content_json.items?.[0].name,'Soup');assert.equal(site.content_json.stats?.[0].value,'2');assert.equal(site.content_json.phone,'0241234567');assert.equal(site.content_json.aboutText,'Our story');});
test('partial published content does not resurrect template contact or statistics',()=>{const t=WEBSITE_TEMPLATES[0],merged=mergeSiteWithTemplate(t,{businessName:'Owner',email:''});assert.equal(merged.hoursOrContact,'');assert.deepEqual(merged.items,[]);assert.deepEqual(merged.stats,[]);});
test('assistant preserves paragraphs, bold, lists and links as escaped React nodes',()=>{const html=renderToStaticMarkup(React.createElement(AssistantText,{text:'First **important** line\nSecond line\n\n- One\n- Two\n\n[Help](https://example.com/help)\n<script>alert(1)</script>'}));assert.match(html,/<strong>important<\/strong>/);assert.match(html,/<ul/);assert.match(html,/<li>One<\/li>/);assert.match(html,/rel="noopener noreferrer"/);assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));});
for(const href of ['javascript:alert(1)','data:text/html,test','//evil.test','https://name:secret@example.com','https://example.com/\\evil','https://bad host'])test(`assistant rejects unsafe link ${href}`,()=>assert.equal(safeAssistantHref(href),null));
test('assistant allows local route and retains unsafe link as literal text',()=>{assert.equal(safeAssistantHref('/orders'),'/orders');assert.deepEqual(assistantInline('[Bad](javascript:evil)'),[{type:'text',text:'[Bad](javascript:evil)'}]);});
test('customer activity codes use understandable labels without hiding unknown activity',()=>{assert.equal(customerActivityLabel('pending_review'),'Awaiting review');assert.equal(customerActivityLabel('checkout_started'),'Checkout started');assert.equal(customerActivityLabel('custom_event'),'Custom event');});
test('Admin navigation includes every existing operational area at mobile widths',()=>{const s=source('src/components/admin/AdminPage.tsx');assert.match(s,/aria-label="Admin area"/);for(const area of ['overview','orders','customers','finance','earn','commercial','marketplace','websites','waitlist','system'])assert.ok(s.includes(area+':'));assert.ok(!s.includes('Connected to PostgreSQL store.'));});
test('custom dialog lifecycle includes trapping, Escape, restoring focus and scroll',()=>{const s=source('src/hooks/useDialogFocus.ts');for(const key of ["event.key === 'Escape'","event.key !== 'Tab'",'previous?.isConnected','document.body.style.overflow = savedOverflow'])assert.ok(s.includes(key));});

for(const id of ['tmpl-buka-bistro','tmpl-salon','tmpl-hotel','tmpl-construction','tmpl-real-estate','tmpl-tech-agency','tmpl-portfolio'])test(`published ${id} uses contact instead of a simulated booking form`,()=>{
 const t=WEBSITE_TEMPLATES.find(t=>t.id===id || (id==='tmpl-salon'&&t.layoutType==='salon') || (id==='tmpl-hotel'&&t.layoutType==='hotel') || (id==='tmpl-construction'&&t.layoutType==='construction') || (id==='tmpl-real-estate'&&t.layoutType==='realestate') || (id==='tmpl-tech-agency'&&t.layoutType==='agency') || (id==='tmpl-portfolio'&&t.layoutType==='portfolio'))!;
 assert.ok(t,id);
 const html=renderToStaticMarkup(renderTemplateLayout(mergeSiteWithTemplate(t,{businessName:'Owner Business',phone:'0240000888',whatsapp:'0240000888',tagline:'Owner heading',aboutText:'Owner introduction',location:'Owner location',items:[]})));
 assert.ok(html.includes('Contact the business'));assert.ok(!html.includes('<form'));for(const text of ['certified bill of quantities','Est. 2018','Reserve Your Table in Osu','Premier Luxury Studio','Ada Foah, Ghana'])assert.ok(!html.includes(text),text);
});
test('template switch changes inherited Data CTA but keeps a custom owner action',()=>{
 const from=WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-data-reseller')!,target=WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-buka-bistro')!;
 assert.equal(migrateWebsiteTemplate({businessName:'Owner',ctaLabel:'Buy Data'} as any,from.id,target.id).ctaLabel,'Order via WhatsApp');
 assert.equal(migrateWebsiteTemplate({businessName:'Owner',ctaLabel:'Talk to Ama'} as any,from.id,target.id).ctaLabel,'Talk to Ama');
});
test('Admin financial inputs display cedi amounts and percentages while sending original integer units',()=>{
 const finance=source('src/components/admin/sections/AdminFinanceSection.tsx'),commercial=source('src/components/admin/sections/AdminCommercialSection.tsx'),reseller=source('src/components/admin/sections/AdminResellerControls.tsx');
 assert.ok(finance.includes('value={settings[key]/100}'));assert.ok(finance.includes('[key]:Math.round(Number(e.target.value)*100)'));assert.ok(commercial.includes('reserveBps:Math.round(Number(bps)*100)'));assert.ok(reseller.includes('withdrawalFeeBps:Math.round(Number(policy.withdrawalFeeBps)*100)'));
 for(const s of [finance,commercial,reseller])assert.ok(!s.includes('(basis points)'));
});

test('public reseller bundle input retains the recipient and locks it after payment starts',()=>{const s=source('src/components/website/ManagedDataStorefront.tsx');assert.ok(s.includes('recipientPhone={phone}'));assert.ok(s.includes('onPhoneChange={value=>{if(!started.current&&!guard.current)setPhone(value);}}'));assert.ok(s.includes('recipientPhone:phone,customerEmail:email'));assert.ok(s.includes('guard.current=true'));});

test('Wallet shortfall is not shown before a valid positive service quote exists',()=>{assert.ok(source('src/components/finance/WalletPaymentChoice.tsx').includes("Number.isFinite(amountMinor)&&amountMinor>0&&preferred!=='wallet'"));});

test('Airtime fee percentage matches its existing zero-fee quote and service discovery reflects live Earn',()=>{assert.match(source('src/components/data/DataPage.tsx'),/serviceFee = 0[\s\S]*feePercent: 0/);const services=source('src/data/services.ts');assert.match(services,/id: 'srv-rewards'[\s\S]*status: 'active'/);assert.ok(!source('src/components/auth/AuthModal.tsx').includes('Join thousands'));});

for (const layout of ['restaurant','construction','salon','realestate','portfolio','hotel','ecommerce','agency']) test(`published ${layout} with no catalogue explains the next action`,()=>{
 const template=WEBSITE_TEMPLATES.find(t=>t.layoutType===layout)!;
 assert.ok(template,layout);
 const html=renderToStaticMarkup(renderTemplateLayout(mergeSiteWithTemplate(template,{businessName:'Actual Owner',items:[],phone:'0240000888'}),{onCtaClick:()=>{}}));
 assert.ok(html.includes('Details have not been published here yet.'));
 assert.ok(html.includes('Ask the business'));
});

test('owner Full Preview transmits saved content only to its same-origin frame, without putting it in the URL',()=>{
 const modal=source('src/components/website/TemplatePreviewModal.tsx'),frame=source('src/components/website/IsolatedTemplatePreview.tsx');
 assert.ok(modal.includes("event.source !== iframeRef.current?.contentWindow"));
 assert.ok(modal.includes("event.origin !== window.location.origin"));
 assert.ok(modal.includes("MYSTERYHUB_PREVIEW_CONTENT"));
 assert.ok(modal.includes("'&owner_preview=1'"));
 assert.ok(modal.includes("selectedTemplatePreview.siteContent) return"));
 assert.ok(frame.includes("event.source !== window.parent"));
 assert.ok(frame.includes('event.data.template?.id === template.id'));
 assert.ok(frame.includes('renderTemplateLayout(shownTemplate'));
 assert.ok(frame.includes("event.key === 'Escape'"));
 assert.ok(modal.includes("event.data?.type === 'MYSTERYHUB_PREVIEW_CLOSE') handleClose()"));
 assert.ok(!modal.includes('JSON.stringify(t)'));
});
