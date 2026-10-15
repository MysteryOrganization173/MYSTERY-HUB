import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {WEBSITE_TEMPLATES} from '../../../src/data/templates';
import {mergeSiteWithTemplate,renderTemplateLayout} from '../../../src/utils/templateRendererUtils';

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

test('Data hero shows owner artwork as its own band on phones, not only as a faded backdrop',()=>{
  const base=WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-data-reseller')!;
  const html=renderToStaticMarkup(renderTemplateLayout(mergeSiteWithTemplate(base,content)));
  const band=html.indexOf('sm:hidden relative -mx-5 -mt-5 mb-4 aspect-[16/9]');
  assert.ok(band>0);assert.ok(html.slice(band,band+1500).includes('example.test/hero.jpg'));
});

test('editor, settings, design switch and exit share the Canvas First patterns',()=>{
  const editor=text('src/components/website/editor/WebsiteEditor.tsx'),settings=text('src/components/website/WebsiteSettingsControls.tsx'),builder=text('src/components/website/WebsiteBuilderPage.tsx'),dashboard=text('src/components/website/WebsiteBusinessDashboard.tsx');
  assert.ok(editor.includes('role="tablist" aria-label="Editing area"'));assert.ok(!editor.includes('<select aria-label="Editing area"'));
  assert.match(editor,/isPhone && activeTab === 'edit' \? 'mobile'/);
  assert.ok(settings.includes('website-sheet-foot'));assert.ok(settings.includes('Switch design'));
  assert.match(builder,/exitTarget\.current = 'website-business-dashboard'/);assert.match(builder,/window\.scrollTo\(\{ top: 0 \}\)/);
  assert.ok(!dashboard.includes('aria-label="Manage website"'));
  // Owner chrome styles never reach the customer site renderer.
  assert.ok(!text('src/components/website/WebsiteSiteRenderer.tsx').includes('websiteBuilder.css'));
});
