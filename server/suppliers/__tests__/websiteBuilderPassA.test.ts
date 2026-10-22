import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {WEBSITE_TEMPLATES} from '../../../src/data/templates';
import {mergeSiteWithTemplate,renderTemplateLayout} from '../../../src/utils/templateRendererUtils';
import {websiteContactTarget} from '../../../src/components/website/SiteContactDetails';
import {WebsiteStore} from '../../db/websiteStore';

const text=(path:string)=>readFileSync(path,'utf8');
const content={businessName:'Pass A owner',tagline:'Owner headline',aboutText:'Owner intro',phone:'0241234567',whatsapp:'0551234567',email:'owner@example.test',location:'Osu, Accra',heroImage:'https://example.test/hero.jpg',logoUrl:'https://example.test/logo.png',ctaLabel:'Order now',ctaTarget:'',social:{instagram:'passaowner'},items:[],stats:[],features:[]};

for(const base of WEBSITE_TEMPLATES.filter(t=>!t.composition)) test(`${base.id} ends with its own footer and shows saved contacts there once`,()=>{
  const html=renderToStaticMarkup(renderTemplateLayout(mergeSiteWithTemplate(base,content)));
  const tail=html.slice(html.lastIndexOf('</footer>')+'</footer>'.length);
  // Nothing visible may follow the template's footer (the old appended contact section did).
  assert.equal(tail.replace(/<\/(div|main|section)>/g,'').trim(),'',base.id);
  assert.equal(html.split('>owner@example.test<').length-1,1,'email shown once');
  assert.ok(html.includes('instagram.com/passaowner'),'social');
  assert.ok(html.includes('tel:0241234567'),'call');
  assert.ok(html.includes(content.logoUrl),'logo still in header');
});

test('template galleries without saved content keep their sample contact line',()=>{
  for(const base of WEBSITE_TEMPLATES.filter(t=>!t.composition && t.hoursOrContact && t.id!=='tmpl-data-reseller'))assert.ok(renderToStaticMarkup(renderTemplateLayout(base)).includes(base.hoursOrContact!),base.id);
});

test('Data hero shows owner artwork in its own framed band, not only as a faded backdrop',()=>{
  const base=WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-data-reseller')!;
  const html=renderToStaticMarkup(renderTemplateLayout(mergeSiteWithTemplate(base,content)));
  const band=html.indexOf('class="store-art"');
  assert.ok(band>0);assert.ok(html.slice(band,band+1500).includes('example.test/hero.jpg'));
});

test('editor, settings, design switch and exit share the Canvas First patterns',()=>{
  const editor=text('src/components/website/editor/WebsiteEditor.tsx'),settings=text('src/components/website/WebsiteSettingsControls.tsx'),builder=text('src/components/website/WebsiteBuilderPage.tsx'),dashboard=text('src/components/website/WebsiteBusinessDashboard.tsx');
  assert.ok(editor.includes('role="tablist" aria-label="Editing area"'));assert.ok(!editor.includes('<select aria-label="Editing area"'));
  assert.match(editor,/isPhone && activeTab === 'edit' \? 'mobile'/);
  assert.ok(settings.includes('website-sheet-foot'));assert.ok(settings.includes('Switch design'));
  assert.ok(!builder.includes('openPricing'));assert.ok(editor.includes('<WebsiteBundleSetupSheet'));assert.match(builder,/window\.scrollTo\(\{ top: 0 \}\)/);
  assert.ok(!dashboard.includes('aria-label="Manage website"'));
  // Owner chrome styles never reach the customer site renderer.
  assert.ok(!text('src/components/website/WebsiteSiteRenderer.tsx').includes('websiteBuilder.css'));
});

// A brand-new website has blank contact fields. Its main button must still land somewhere real.
for(const base of WEBSITE_TEMPLATES.filter(t=>!t.composition && t.id!=='tmpl-data-reseller')) test(`${base.id} new website with blank contacts: main button target exists`,async()=>{
  const {site}=await WebsiteStore.createSite(`pass-a-blank-${base.id}`,{template_id:base.id,name:'Brand new business'});
  assert.equal(site.content_json.phone,'');assert.equal(site.content_json.whatsapp,'');assert.equal(site.content_json.email,'');
  const target=websiteContactTarget(site.content_json);
  assert.equal(target,'#website-contact-details');
  const html=renderToStaticMarkup(renderTemplateLayout(mergeSiteWithTemplate(base,site.content_json,site.settings_json)));
  assert.equal(html.split('id="website-contact-details"').length-1,1,'destination rendered exactly once');
  assert.ok(html.includes('Contact details coming soon.'));
  assert.ok(html.indexOf('id="website-contact-details"')>html.lastIndexOf('<footer'),'destination is inside the footer');
});

test('contact fallback prefers WhatsApp, then phone, then email',()=>{
  const blank={...content,phone:'',whatsapp:'',email:'',ctaTarget:''};
  assert.equal(websiteContactTarget({...blank,phone:'024 123 4567'}),'tel:0241234567');
  assert.equal(websiteContactTarget({...blank,email:'a@example.test'}),'mailto:a@example.test');
  assert.equal(websiteContactTarget({...blank,whatsapp:'0551234567',phone:'0241234567'}),'https://wa.me/233551234567');
  // Once a real contact exists the placeholder disappears.
  const base=WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-makola-mart')!;
  assert.ok(!renderToStaticMarkup(renderTemplateLayout(mergeSiteWithTemplate(base,{...blank,phone:'0241234567'}))).includes('Contact details coming soon.'));
});
