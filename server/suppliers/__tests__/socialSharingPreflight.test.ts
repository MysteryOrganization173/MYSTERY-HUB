import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import express from 'express';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPublicHtmlRouter } from '../../routes/publicHtml.js';
import { websiteSocialHead, socialImage, pageIndexingHead, PUBLIC_ORIGIN } from '../../../src/utils/socialMetadata.js';
import { DATA_RESELLER_LEGACY_HERO_IMAGE as LEGACY, DATA_RESELLER_STARTER_HERO_IMAGE as STARTER } from '../../../src/utils/dataResellerArtwork.js';
import { mergeSiteWithTemplate, getTemplateById, renderTemplateLayout } from '../../../src/utils/templateRendererUtils.js';
import { websiteStarter } from '../../../src/config/websiteStarters.js';
import { applyVisualValue } from '../../../src/utils/websiteVisualEditing.js';

let server: Server, base: string, directory: string, publicReads=0;
before(async()=>{
  directory=mkdtempSync(path.join(tmpdir(),'mh-preflight-'));
  writeFileSync(path.join(directory,'index.html'),readFileSync('index.html'));
  const app=express();app.use(createPublicHtmlRouter(directory,{site:async()=>{publicReads++;return null;},product:async()=>{publicReads++;return null;}}));
  server=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(directory,{recursive:true,force:true});});

for(const slug of ['quickbyte-data','synthetic-legacy-owner'])for(const heroImage of ['',LEGACY,'https://images.unsplash.com/photo-1556742049-0a67e5572293?w=1200','https://res.cloudinary.com/x/Neon_Data_Bundles_in_Accra.png','https://images.example.com/chosen.jpg',STARTER]){
  test(`existing owner renderer/head parity: ${slug}, ${heroImage || 'empty legacy'}`,()=>{
    const content={businessName:'Synthetic independent business',heroImage,logoUrl:'https://images.example.com/owner-logo.png'} as any;
    const input={id:'synthetic',slug,name:content.businessName,template_id:'tmpl-data-reseller',content,settings:{}} as any;
    const before=structuredClone(input),template=mergeSiteWithTemplate(getTemplateById(input.template_id),content);
    assert.equal(websiteSocialHead(input).image,socialImage(template.heroImage!).image);
    const html=renderToStaticMarkup(renderTemplateLayout(template));
    assert.ok(html.includes(template.heroImage!.split('/upload/').at(-1)!),'actual rendered banner source');
    assert.equal(websiteSocialHead(input).icon,content.logoUrl);assert.deepEqual(input,before,'records and published content remain untouched');
  });
}
test('new owner creation and photo removal select the neutral starter; no implicit legacy artwork',()=>{
  const content=websiteStarter('tmpl-data-reseller','Synthetic New Owner').content as any;
  assert.equal(content.heroImage,STARTER);
  const template=mergeSiteWithTemplate(getTemplateById('tmpl-data-reseller'),content);
  const removed=applyVisualValue(content,{} as any,template,'content:heroImage','')!;
  assert.equal(removed.content.heroImage,STARTER);
  assert.equal(websiteSocialHead({id:'new',slug:'new-owner',template_id:'tmpl-data-reseller',name:'Synthetic',content:removed.content,settings:{} as any}).image,socialImage(STARTER).image);
});

for(const route of ['/admin','/ADMIN/orders','/admin/index.html','/wallet','/orders','/account','/account/security','/dashboard','/login','/signup','/register','/auth/reset','/website-builder/editor','/unknown-private-workflow','/?isolated_template_preview=tmpl-data-reseller&editor_site=PRIVATE&editor_channel=SECRET']){
  test(`private or non-marketing route is noindex without redirect: ${route}`,async()=>{
    const before=publicReads,response=await fetch(base+route),html=await response.text();
    assert.equal(response.status,200,'SPA still loads normal auth/navigation');assert.equal(response.headers.get('location'),null);
    assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');assert.match(html,/<meta name="robots" content="noindex, nofollow"/);
    assert.doesNotMatch(html,/PRIVATE|SECRET|Digital Services Marketplace in Ghana<\/title>/);assert.match(html,/<div id="root"><\/div>/);assert.equal(publicReads,before,'no account/product/site lookup');
  });
}
for(const route of ['/','/data','/marketplace','/website-builder','/earn','/afa','/services','/about','/help','/faq']){
  test(`public marketing route remains indexable and specific: ${route}`,async()=>{
    const response=await fetch(base+route),html=await response.text();assert.equal(response.status,200);assert.equal(response.headers.get('x-robots-tag'),null);assert.doesNotMatch(html,/name="robots"/);
    const expected=pageIndexingHead(route);assert.equal(expected.noindex,undefined);assert.ok(html.includes(`<title>${expected.title.replaceAll('&','&amp;')}</title>`));
  });
}
test('private canonical metadata omits operational path details and all query values',()=>{
  const head=pageIndexingHead('/admin/orders/private-order','?token=secret&phone=private');assert.equal(head.url,PUBLIC_ORIGIN+'/admin');assert.doesNotMatch(JSON.stringify(head),/private-order|secret|phone/);
  assert.equal(pageIndexingHead('/marketplace','?ref=MH-EXAMPLE').noindex,undefined);
});
