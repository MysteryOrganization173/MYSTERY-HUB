/**
 * Website Builder V7.2 Phase 1: three more Data Store styles (Compact, Editorial, Signature), a grouped palette
 * library, the editor's Design mode, the mobile business dock and the Analytics presentation. The guarantees around
 * them: existing stores keep their saved look, every style keeps the same content, tap targets and managed checkout,
 * every palette stays readable in every style, and Analytics shows the server's figures without relabelling them.
 */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {WEBSITE_TEMPLATES} from '../../../src/data/templates.js';
import {mergeSiteWithTemplate,renderTemplateLayout} from '../../../src/utils/templateRendererUtils.js';
import {WEBSITE_STYLE_VARIANTS,WEBSITE_STYLE_VARIANT_IDS,resolveWebsiteStyle} from '../../../src/config/websiteStyleVariants.js';
import {validateWebsiteContentPatch} from '../../services/websiteValidation.js';
import {websitePublishChanges} from '../../../src/utils/websitePublishChanges.js';
import {WEBSITE_PALETTES,WEBSITE_PALETTE_GROUPS,paletteIsReadable} from '../../../src/utils/websitePalettes.js';
import {resolveStoreTheme,websiteActionText,websiteContrast} from '../../../src/utils/websiteBrand.js';
import {STORE_STYLE_CSS} from '../../../src/components/website/storefront/storeStyles.js';
import {WebsiteDesignPanel} from '../../../src/components/website/editor/WebsiteDesignPanel.js';
import {WebsiteStoreLook} from '../../../src/components/website/editor/WebsiteStoreLook.js';
import {VisualEditContext} from '../../../src/components/website/editor/VisualEditMarkers.js';
import {visualTargets} from '../../../src/utils/websiteVisualEditing.js';
import {BusinessAnalytics,dailyViewSeries,groupActivity} from '../../../src/components/website/BusinessAnalytics.js';
import {DATA_RESELLER_LEGACY_HERO_IMAGE as LEGACY,DATA_RESELLER_STARTER_HERO_IMAGE as STARTER} from '../../../src/utils/dataResellerArtwork.js';
import type {SiteContent,SiteSettings} from '../../../src/types/index.js';

const data=WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-data-reseller')!;
const source=(path:string)=>readFileSync(path,'utf8');
const LOGO='https://res.cloudinary.com/da6oeat7m/image/upload/v1/owner-uploads/quickbyte-logo.png';
const settings:SiteSettings={primaryColor:'#0f172a',accentColor:'#2563eb',backgroundColor:'#0a0f1d',fontFamily:'font-sans',borderRadius:'rounded-xl'};
const legacy:SiteContent={businessName:'Quickbyte data',tagline:'Affordable data. Simple delivery.',aboutText:'Buy MTN, Telecel and AirtelTigo bundles from one simple storefront.',location:'Dansoman',phone:'0240000000',whatsapp:'0240000000',email:'',logoUrl:LOGO,heroImage:LEGACY,ctaLabel:'Buy Data',ctaTarget:'',social:{},items:[],stats:[],features:[]};
const managed=React.createElement('div',{id:'managed-fixture'});
const NEW_STYLES=['compact','editorial','signature'];
const renderStore=(content:SiteContent,colors:SiteSettings=settings)=>{
  const template=mergeSiteWithTemplate(data,content,colors);
  return renderToStaticMarkup(React.createElement(VisualEditContext.Provider,{value:visualTargets(template)},renderTemplateLayout(template,{managedCheckout:managed,managedAvailability:'available'} as any)));
};

test('registry: three V7.2 styles join the four from V7.1; the server accepts them and still rejects anything else',()=>{
  const ids=WEBSITE_STYLE_VARIANTS.reseller.map(s=>s.id);
  for(const id of [...NEW_STYLES,'horizon','market','studio','classic'])assert.ok(ids.includes(id),id);
  for(const id of NEW_STYLES){assert.ok(WEBSITE_STYLE_VARIANT_IDS.includes(id));assert.doesNotThrow(()=>validateWebsiteContentPatch({styleVariant:id}));}
  for(const bad of ['Compact','editorial ','sig<nature>','url(x)','expression(1)'])assert.throws(()=>validateWebsiteContentPatch({styleVariant:bad}),/offered styles/,bad);
  // Nothing about an existing store changes on its own: no saved style still means Classic for owners.
  assert.equal(resolveWebsiteStyle('reseller',undefined,true),'classic');
  assert.equal(resolveWebsiteStyle('reseller','editorial',true),'editorial');
  const snapshot={version:1 as const,templateId:'tmpl-data-reseller',name:'Q',content:legacy,settings,draftUpdatedAt:'',publishedAt:''};
  assert.deepEqual(websitePublishChanges(snapshot,{templateId:'tmpl-data-reseller',content:{...legacy,styleVariant:'signature'},settings}),['Store style'],'a new style is an ordinary publishable change');
});

test('the protected legacy store still renders Classic exactly, with no V7.2 markup or CSS',()=>{
  const before=structuredClone(legacy),html=renderStore(legacy);
  assert.ok(!html.includes('data-store-style'));
  for(const marker of ['class="store-wrap sx-hero cp"','ed-figure','sg-panel','[data-store-style=compact]'])assert.ok(!html.includes(marker),marker);
  for(const value of ['Quickbyte data','quickbyte-logo.png',LEGACY.split('/upload/')[1],'store-art','managed-fixture'])assert.ok(html.includes(value),value);
  assert.deepEqual(legacy,before,'rendering never rewrites saved content');
});

test('every new style: own composition, same content, tap targets and managed checkout; with or without a logo',()=>{
  // Markup markers (the style CSS is inlined, so bare class names appear in every style's <style> block).
  const markers:Record<string,string>={compact:'class="store-wrap sx-hero cp"',editorial:'class="ed-figure"',signature:'class="sg-panel"'};
  for(const style of NEW_STYLES)for(const logoUrl of [LOGO,'']){
    const html=renderStore({...legacy,heroImage:STARTER,logoUrl,styleVariant:style});
    assert.ok(html.includes(`data-store-style="${style}"`),style);assert.ok(html.includes(markers[style]),style);
    for(const other of Object.values(markers).filter(m=>m!==markers[style]))assert.ok(!html.includes(other),`${style} has no ${other}`);
    for(const target of ['content:tagline','content:aboutText','content:ctaLabel','content:businessName','copy:reseller.secondary'])assert.ok(html.includes(`data-visual-target="${target}"`),`${style} ${target}`);
    for(const value of ['managed-fixture','id="bundle-catalog"','id="store-help"','Secure checkout by Paystack','Affordable data. Simple delivery.'])assert.ok(html.includes(value),`${style} ${value}`);
    assert.equal((html.match(/id="store-hero-title"/g)||[]).length,1,`${style} has one hero heading`);
    assert.equal((html.match(/<h1[ >]/g)||[]).length,1,`${style} keeps one page title`);
    // Compact, like Studio, downloads no banner; Editorial and Signature show it and keep its tap target.
    assert.equal(html.includes(STARTER.split('/upload/')[1]),style!=='compact',`${style} banner`);
    assert.equal(html.includes('data-visual-target="content:heroImage"'),style!=='compact',`${style} banner target`);
    if(!logoUrl)assert.ok(html.includes('>QD<'),`${style} falls back to the store initials`);
  }
});

test('long names, no banner and light or dark colours still render every style',()=>{
  const long='Mama Akosua Premium Data, Airtime and Everyday Digital Services Hub';
  for(const style of NEW_STYLES)for(const p of [WEBSITE_PALETTES[0],WEBSITE_PALETTES.find(x=>x.name==='Ivory and forest')!]){
    const html=renderStore({...legacy,businessName:long,heroImage:'',styleVariant:style},{...settings,backgroundColor:p.backgroundColor,primaryColor:p.primaryColor,accentColor:p.accentColor});
    assert.ok(html.includes(long),style);assert.ok(html.includes(`data-store-tone="${websiteActionText(p.backgroundColor)==='#ffffff'?'dark':'light'}"`),`${style} ${p.name}`);
  }
});

test('style CSS stays scoped, inline and safe: no external loads, no script, no unscoped rules',()=>{
  assert.doesNotMatch(STORE_STYLE_CSS,/url\(|@import|expression|javascript:/i);
  for(const style of NEW_STYLES)assert.ok(STORE_STYLE_CSS.includes(`[data-store-style=${style}]`),style);
  const selectors=STORE_STYLE_CSS.replace(/\/\*[\s\S]*?\*\//g,'').split('}').map(rule=>rule.split('{').slice(-2,-1)[0]?.trim()).filter(Boolean) as string[];
  for(const sel of selectors)if(!/^(@|from|to|\d)/.test(sel))for(const part of sel.split(/,(?![^(]*\))/))assert.match(part.trim(),/\[data-store-style/,part);
  // Signature puts text on the owner's accent colour: it must use the accent's own readable ink.
  assert.match(STORE_STYLE_CSS,/\.sg-panel :is\(\.sx-title[^}]*color:inherit!important/);
  assert.match(source('src/components/website/templates/DataResellerTemplateView.tsx'),/className="sg-panel" style=\{\{ backgroundColor: p\.accent, color: onAccent \}\}/);
});

test('palette library: twenty readable sets in four moods, original eight kept unchanged',()=>{
  assert.ok(WEBSITE_PALETTES.length>=18);
  assert.deepEqual(WEBSITE_PALETTES.slice(0,8).map(p=>p.name),['Ember night','Paper and ink','Signal blue','Fresh green','Kente gold','Berry','Ocean','Charcoal lime']);
  assert.equal(new Set(WEBSITE_PALETTES.map(p=>p.name)).size,WEBSITE_PALETTES.length,'names are unique');
  const groups=WEBSITE_PALETTE_GROUPS.map(g=>g.id);
  for(const p of WEBSITE_PALETTES){
    assert.ok(paletteIsReadable(p),p.name);assert.ok(groups.includes(p.group!),p.name);
    for(const c of [p.backgroundColor,p.primaryColor,p.accentColor])assert.match(c,/^#[0-9a-f]{6}$/,p.name);
    // In the Data Store renderer: page text, muted text and card text all clear WCAG AA.
    const t=resolveStoreTheme({background:p.backgroundColor,accent:p.accentColor,secondary:p.accentColor});
    assert.ok(websiteContrast(t.text,t.background)>=4.5,`${p.name} text`);assert.ok(websiteContrast(t.mutedText,t.background)>=4.5,`${p.name} muted`);
    assert.ok(websiteContrast(t.surfaceMutedText,t.surface)>=4.5,`${p.name} card text`);
    // Signature and button text: the accent's own ink.
    assert.ok(websiteContrast(websiteActionText(p.accentColor),p.accentColor)>=4.5,`${p.name} on accent`);
  }
  for(const g of groups)assert.ok(WEBSITE_PALETTES.filter(p=>p.group===g).length>=3,g);
});

test('Design mode: Style, Colours and Fine-tune for a Data Store; colours only elsewhere; selections reflect the draft',()=>{
  const base={settings,onPalette(){},onStyle(){},targets:[],siteId:'s',token:'t',onChange(){},onDone(){},onAllSettings(){},expanded:false,onExpanded(){}};
  const store=renderToStaticMarkup(React.createElement(WebsiteDesignPanel,{...base,layout:'reseller',styleValue:'market'}));
  assert.deepEqual([...store.matchAll(/role="tab"[^>]*>([^<]+)</g)].map(m=>m[1]),['Style','Colours','Fine-tune']);
  assert.equal((store.match(/role="radio"/g)||[]).length,WEBSITE_STYLE_VARIANTS.reseller.length);
  assert.match(store,/aria-checked="true"[^>]*data-style="market"/);
  assert.match(store,/data-variant="rail"/,'phones start with one swipeable row so the draft stays visible');
  assert.match(store,/Draft only until you publish/);
  const other=renderToStaticMarkup(React.createElement(WebsiteDesignPanel,{...base,layout:undefined}));
  assert.deepEqual([...other.matchAll(/role="tab"[^>]*>([^<]+)</g)].map(m=>m[1]),['Colours','Fine-tune']);
  const signal=WEBSITE_PALETTES.find(p=>p.name==='Signal blue')!;
  const colours=renderToStaticMarkup(React.createElement(WebsiteDesignPanel,{...base,layout:undefined,settings:{...settings,backgroundColor:signal.backgroundColor,primaryColor:signal.primaryColor,accentColor:signal.accentColor},expanded:true}));
  assert.equal((colours.match(/class="design-palette"/g)||[]).length,WEBSITE_PALETTES.length);
  assert.equal((colours.match(/aria-pressed="true" class="design-palette"/g)||[]).length,1,'exactly the draft palette is selected');
  // Style sketches take the draft's own colours.
  assert.match(renderToStaticMarkup(React.createElement(WebsiteStoreLook,{layout:'reseller',value:'classic',onChange(){},colors:{background:'#f8f5ec',accent:'#1f5a3a'}})),/--sk-bg:#f8f5ec/);
});

test('editor: Design is the second dock tool; style and colour changes stay ordinary undoable draft edits',()=>{
  const toolbar=source('src/components/website/editor/WebsiteEditorToolbar.tsx'),editor=source('src/components/website/editor/WebsiteEditor.tsx');
  const dock=toolbar.slice(toolbar.indexOf('<nav className="visual-editor-dock"'),toolbar.indexOf('</nav>'));
  assert.ok(dock.indexOf('Edit</button>')<dock.indexOf("p.brandLabel||'Design'"),'Design sits right after Edit');
  assert.match(dock,/p\.onBundles \?/,'Data Stores get Bundles in the dock');
  assert.match(editor,/onStyle=\{style=>changeContent\(\{styleVariant:style\}\)\}/);
  assert.match(editor,/onPalette=\{applyPalette\}/);
  assert.match(editor,/const applyPalette = [^\n]*markDirty\(\);/);
  assert.doesNotMatch(editor,/onPalette=\{[^}]*publish/i,'choosing a look never publishes');
  assert.match(editor,/data-design-open=\{designOpen/,'phones shrink the canvas instead of covering it');
  assert.match(source('src/components/website/editor/visualEditor.css'),/\[data-design-open\]\{flex-direction:column\}/);
});

test('business dock: at most four areas plus More, a way back to Mystery Hub, unsaved prices protected',()=>{
  const w=source('src/components/website/BusinessWorkspacePage.tsx');
  assert.match(w,/\.slice\(0, 4\);/);
  assert.match(w,/<nav className="bw-dock" aria-label="Business areas"/);
  assert.match(w,/Back to Mystery Hub/);
  assert.match(w,/const leaveBusiness = \(\) => \{ if \(!confirmPricingLeave\(\)\) return;/);
  assert.match(w,/go\(target\); \}\}>\s*<span className="bw-dock-icon"/,'dock links use in-app navigation (no reload) and keep their addresses');
});

test('analytics: gaps are zero only between recorded days; repeats collapse; owner visits are summarised apart',()=>{
  assert.deepEqual(dailyViewSeries([{day:'2026-10-03',views:2},{day:'2026-10-01',views:5}]),[{day:'2026-10-01',views:5},{day:'2026-10-02',views:0},{day:'2026-10-03',views:2}]);
  assert.deepEqual(dailyViewSeries([]),[]);
  const now=new Date('2026-11-02T12:00:00Z');
  const groups=groupActivity([{label:'Website visited',at:'2026-11-02T11:00:00Z'},{label:'Website visited',at:'2026-11-02T10:00:00Z'},{label:'Checkout started',at:'2026-11-01T09:00:00Z'}],now);
  assert.equal(groups[0].rows[0].count,2);assert.equal(groups.length,2);
  const a={views:7,uniqueVisitors:3,whatsappClicks:1,callClicks:0,emailClicks:1,primaryCtaClicks:2,checkoutStarts:4,paidOrders:2,deliveredOrders:1,salesMinor:2400,conversion:50,trend:[{day:'2026-11-01',views:4},{day:'2026-11-02',views:3}],
    activity:[{event:'website_editor_opened',createdAt:'2026-11-02T09:00:00Z'},{event:'website_editor_opened',createdAt:'2026-11-02T08:00:00Z'},{event:'site_view',createdAt:'2026-11-02T07:00:00Z'}]};
  const html=renderToStaticMarkup(React.createElement(BusinessAnalytics,{analytics:a,earnings:{availableMinor:500,pendingMinor:900},activity:[],reseller:true,published:true}));
  for(const text of ['Started paying. Not a payment.','Not withdrawable yet.','Different browsers, not confirmed people.','GH₵24.00','Your own visits','2 times'])assert.ok(html.includes(text),text);
  const customer=html.slice(html.indexOf('ba-days'),html.indexOf('ba-own'));
  assert.ok(!customer.includes('You opened the editor'),'the owner’s editor visits are not customer activity');
  assert.match(html,/role="img" aria-label="Views by day\. 7 views/);
  const none=renderToStaticMarkup(React.createElement(BusinessAnalytics,{analytics:{...a,conversion:null,trend:[],activity:[]},earnings:null,activity:[],reseller:false,published:false}));
  for(const text of ['Paid orders per checkout start','Checkout starts','Store Earnings'])assert.ok(!none.includes(text),`no ${text} for a site that does not sell`);
  assert.ok(none.includes('No visits recorded in this period'));
});
