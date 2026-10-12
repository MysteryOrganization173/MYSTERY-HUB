import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {WEBSITE_TEMPLATES} from '../../../src/data/templates';
import {createWebsiteComposition} from '../../../src/config/websiteBuilder';
import {mergeSiteWithTemplate,renderTemplateLayout} from '../../../src/utils/templateRendererUtils';
import {normalizeWebsiteColor,resolveResellerTheme,websiteContrast,websiteActionText} from '../../../src/utils/websiteBrand';
import {migrateWebsiteTemplate} from '../../../src/utils/websiteTemplateMigration';
const text=(path:string)=>readFileSync(path,'utf8');
const content={businessName:'Synthetic owner business',tagline:'Our edited headline',aboutText:'Our edited description',phone:'0241234567',whatsapp:'0241234567',email:'fixture@example.test',location:'Synthetic Accra',heroImage:'/fixture-cover.svg',logoUrl:'/fixture-logo.svg',ctaLabel:'Contact the owner',ctaTarget:'https://example.test/contact',social:{instagram:'synthetic_owner'},items:[],stats:[],features:[]};
for(const base of WEBSITE_TEMPLATES) test(base.id+' maps saved identity, images and contacts into the common presentation',()=>{
  const template=mergeSiteWithTemplate(base,content,{accentColor:'#7c3aed'});
  const preview=renderToStaticMarkup(renderTemplateLayout(template,{onCtaClick:()=>{}}));
  const published=renderToStaticMarkup(renderTemplateLayout(template));
  assert.equal(preview,published);for(const value of [content.businessName,content.heroImage,content.logoUrl,content.email])assert.ok(published.includes(value),value);
  assert.equal(template.accentColor,'#7c3aed');assert.equal(template.id,base.id);
});
for(const background of ['#ffffff','#000000','#ffffee','#123456']) test('mixed foreground/background '+background+' is readable without changing saved brand',()=>{
  const base=WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-data-reseller')!;
  const saved={primaryColor:'#ffffee',accentColor:'#ffcc00',backgroundColor:background};const before=structuredClone(saved);
  const template=mergeSiteWithTemplate(base,content,saved);const palette=resolveResellerTheme(template.colorScheme!);
  for(const [fg,bg] of [[palette.text,palette.background],[palette.surfaceText,palette.surface],[palette.mutedText,palette.background],[palette.surfaceMutedText,palette.surface],[websiteActionText(palette.accent),palette.accent]])assert.ok(websiteContrast(fg,bg)>=4.5);
  assert.deepEqual(saved,before);assert.equal(palette.accent,saved.accentColor);
});
for(const bad of ['#','#f','#ff','broken','rgb(1,2,3)',''])test('partial color '+JSON.stringify(bad)+' cannot crash or corrupt the merged presentation',()=>{
  const template=mergeSiteWithTemplate(WEBSITE_TEMPLATES[0],content,{primaryColor:bad,accentColor:bad,backgroundColor:bad});assert.match(template.accentColor,/^#[0-9a-f]{6}$/i);assert.doesNotThrow(()=>renderToStaticMarkup(renderTemplateLayout(template)));assert.equal(normalizeWebsiteColor(bad,'#123456'),'#123456');
});
test('ordered enabled sections and protected managed catalog share the same renderer',()=>{
  const base=WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-data-reseller')!;const composition=createWebsiteComposition();composition.sections.splice(composition.sections.length-1,0,{id:'hidden-about',type:'about',enabled:false,variant:'centered',order:8,data:{heading:'Must stay hidden'}});const template=mergeSiteWithTemplate(base,{...content,composition});
  const html=renderToStaticMarkup(renderTemplateLayout(template,{managedCheckout:React.createElement('p',null,'Authoritative catalog fixture'),managedAvailability:'available'}));assert.equal((html.match(/Authoritative catalog fixture/g)||[]).length,1);assert.ok(!html.includes('Must stay hidden'));assert.ok(html.includes(content.tagline));assert.ok(html.indexOf(content.businessName)<html.indexOf(content.tagline));
});
test('legacy managed branding keeps editable description and CTA instead of runtime replacement copy',()=>{
  const template=mergeSiteWithTemplate(WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-data-reseller')!,content);const html=renderToStaticMarkup(renderTemplateLayout(template,{managedCheckout:React.createElement('p',null,'Catalog'),managedAvailability:'available'}));assert.ok(html.includes(content.aboutText));assert.ok(html.includes(content.ctaLabel));assert.ok(html.includes(content.email));
});
test('owner preview and public site share entry; real iframe width supplies responsive media queries',()=>{
  assert.match(text('src/components/website/PublicPublishedSite.tsx'),/<WebsiteSiteRenderer siteId=/);assert.match(text('src/components/website/IsolatedTemplatePreview.tsx'),/<WebsiteSiteRenderer[^>]*preview/);assert.equal((text('src/components/website/editor/WebsiteEditor.tsx').match(/<WebsitePreviewFrame/g)||[]).length,2);const frame=text('src/components/website/WebsitePreviewFrame.tsx');assert.match(frame,/event.origin===window.location.origin/);assert.match(frame,/event.source===frame.current/);assert.match(frame,/owner_preview=1/);
});
test('preview denies payment initiation, reference lookup, event tracking and external form/navigation actions',()=>{
  const store=text('src/components/website/ManagedDataStorefront.tsx');assert.match(store,/if\(preview\|\|!selected\|\|guard.current\)return/);assert.match(store,/if\(preview\|\|!ref\)return/);assert.match(store,/if\(preview\)\{setError/);assert.match(text('src/components/website/WebsiteSiteRenderer.tsx'),/onSubmitCapture/);assert.match(text('src/components/website/WebsiteSiteRenderer.tsx'),/event.stopPropagation/);
});
test('template migration keeps business identity and safe links without changing a site address',()=>{const migrated=migrateWebsiteTemplate(content,'tmpl-data-reseller','tmpl-buka-bistro');assert.equal(migrated.businessName,content.businessName);assert.equal(migrated.phone,content.phone);assert.ok(!('slug' in migrated));});
