import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getPageFromPath,ROUTE_PATH_MAP} from '../../../src/utils/routing.js';
import {WORKSPACE_SECTIONS,initialWorkspaceTabs,sectionForTab,workspacePath,workspaceSectionFromPath,workspaceSections} from '../../../src/utils/businessWorkspace.js';
import {websitePublishChanges} from '../../../src/utils/websitePublishChanges.js';
import {pageIndexingHead} from '../../../src/utils/socialMetadata.js';

const source=(path:string)=>readFileSync(path,'utf8');
const workspace=source('src/components/website/BusinessWorkspacePage.tsx');
const builder=source('src/components/website/WebsiteBuilderPage.tsx');
const editor=source('src/components/website/editor/WebsiteEditor.tsx');

test('My Business has its own address and every area deep-links back to it',()=>{
  assert.equal(ROUTE_PATH_MAP.business,'/my-business');
  for(const path of ['/my-business','/my-business/','/my-business/orders','/my-business/earnings?x=1','/MY-BUSINESS/analytics'])assert.equal(getPageFromPath(path),'business',path);
  assert.equal(getPageFromPath('/website-builder'),'website','the Website Builder keeps its own page');
  assert.equal(workspacePath('overview'),'/my-business');
  assert.equal(workspacePath('products'),'/my-business/products');
  assert.equal(workspaceSectionFromPath('/my-business/website'),'website');
  assert.equal(workspaceSectionFromPath('/my-business/earnings#top'),'earnings');
  assert.equal(workspaceSectionFromPath('/my-business/nonsense'),'overview','an unknown area opens the Overview');
  assert.equal(workspaceSectionFromPath('/website-builder'),'overview');
  assert.equal(workspaceSectionFromPath(null),'overview');
});

test('areas come from the dashboard tab rule, so a non-reseller design never shows reseller areas',()=>{
  for(const [section,meta] of Object.entries(WORKSPACE_SECTIONS))assert.equal(sectionForTab(meta.tab),section);
  assert.deepEqual(workspaceSections(initialWorkspaceTabs(true)),['overview','orders','products','earnings','analytics','website']);
  assert.deepEqual(workspaceSections(initialWorkspaceTabs(false)),['overview','analytics','website']);
  assert.deepEqual(workspaceSections(['Overview','Orders','Store Earnings','Analytics','Settings']),['overview','orders','earnings','analytics','website'],'Data history kept after a design change');
  assert.match(workspace,/workspaceSections\(summary\.tabs\)|workspaceSections\(/);
  assert.match(workspace,/!available\.includes\(section\)\) go\('overview'/,'a direct link to an area the website lacks falls back');
});

test('kept examples do not leave a permanent "changes waiting" after publishing',()=>{
  const settings={primaryColor:'#111111',accentColor:'#00c365',fontFamily:'font-sans',borderRadius:'rounded-xl'} as any;
  const item={id:'b1',name:'1GB',price:'GH₵ 6'};
  const snapshot={templateId:'tmpl-data-reseller',content:{businessName:'Kwame',items:[item]},settings} as any;
  const draft=(patch:Record<string,unknown>)=>({templateId:'tmpl-data-reseller',content:{businessName:'Kwame',items:[{...item,...patch}]} as any,settings});
  assert.deepEqual(websitePublishChanges(snapshot,draft({isExample:false})),[]);
  assert.deepEqual(websitePublishChanges(snapshot,draft({isExample:true})),['1 item changed'],'an unconfirmed example is still a change');
  assert.deepEqual(websitePublishChanges(snapshot,draft({isExample:false,price:'GH₵ 7'})),['1 item changed']);
});

test('the workspace is lazy, light and reuses the existing business records and controls',()=>{
  assert.match(source('src/App.tsx'),/BusinessWorkspacePage = lazyPage\(/);
  assert.match(source('src/App.tsx'),/activePage === 'business' && <BusinessWorkspacePage \/>/);
  assert.match(workspace,/const WebsiteEditor = lazyPage\(\(\) => import\('\.\/editor\/WebsiteEditor'\)/,'the editor stays a separate download');
  assert.match(workspace,/<WebsiteBusinessDashboard /);
  assert.doesNotMatch(workspace,/TemplateGallery|WEBSITE_TEMPLATES\.map/,'no design gallery in the workspace');
  assert.match(workspace,/useOwnerWebsites\(sessionToken\)/);
  assert.match(builder,/useOwnerWebsites\(sessionToken\)/);
  assert.doesNotMatch(builder,/<WebsiteBusinessDashboard/,'the builder no longer embeds the dashboard');
  assert.match(builder,/href="\/my-business"/);
  // No new money logic: the only server call the workspace makes itself is the existing unpublish.
  assert.match(workspace,/import \{ unpublishWebsiteOnServer \} from '\.\.\/\.\.\/services\/apiClient';/);
  assert.doesNotMatch(workspace,/fetch\(|paystack/i);
});

test('owner websites are cached per account only',()=>{
  const hook=source('src/hooks/useOwnerWebsites.ts');
  assert.match(hook,/state\.token === token \? state\.sites : \[\]/);
  assert.match(hook,/if \(!token\) \{ cache = null;/);
  assert.match(source('src/context/AppContext.tsx'),/setActiveEditorSite\(null\); setEditorAiContext\(null\);/,'signing out closes any open editor');
});

test('navigation: one bottom bar, entries from the account menu, home and the builder',()=>{
  assert.match(source('src/components/common/MobileNav.tsx'),/item\.id === 'website' && activePage === 'business'/);
  assert.match(source('src/components/common/Navbar.tsx'),/handleNavClick\('business'\)/);
  assert.match(source('src/components/home/MemberHome.tsx'),/'business':'website'/);
  assert.match(source('public/robots.txt'),/Disallow: \/my-business/);
  const head=pageIndexingHead('/my-business/orders');
  assert.equal(head.noindex,true);assert.equal(head.title,'My Business — Mystery Hub');assert.equal(head.url.endsWith('/my-business'),true,'never echoes the area or query');
  assert.match(workspace,/aria-label="Business areas/);
  assert.doesNotMatch(source('src/components/website/businessWorkspace.css'),/position:\s*fixed;[^}]*bottom:\s*0/,'no competing bottom navigation');
});

test('editor: Back saves first, never publishes and returns to the same place',()=>{
  assert.match(workspace,/backLabel="Back to My Business"/);
  assert.match(editor,/mhEditor: true/,'Back on Android closes the editor instead of leaving the page');
  assert.match(editor,/if \(!window\.history\?\.pushState\) return;/);
  assert.match(editor,/could not be saved yet\. They are kept on this device/);
  const exit=editor.slice(editor.indexOf('const exitEditor'),editor.indexOf('editorMounts++'));
  assert.ok(exit.length>0);
  assert.doesNotMatch(exit,/publish/i,'leaving the editor never publishes');
  assert.match(workspace,/useEffect\(\(\) => \(\) => closeWebsiteEditor\(\), \[\]\)/);
});

test('unpublish keeps its confirmation and delete keeps the settings safeguards',()=>{
  assert.match(workspace,/window\.confirm\(reseller \? 'Unpublish your store\?/);
  assert.match(workspace,/<WebsiteSettingsControls/);
  assert.match(source('src/components/website/WebsiteSettingsControls.tsx'),/beforeDanger/);
});
