/**
 * Business Workspace V7.2.1: My Business is one coherent owner application. The guarantees: an owner's Website opens
 * My Business (never a loop, never a second website, the gallery one explicit step away), My Business shows one
 * navigation system (no consumer chrome, the dock and More never repeat each other), the Overview leads with the
 * business's state instead of a directory of links, and nothing here touches money, orders or publishing rules.
 */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {businessDock,builderVisitOpensBusiness,WEBSITE_DESIGNS_PATH,workspaceSections,initialWorkspaceTabs} from '../../../src/utils/businessWorkspace.js';
import {getPageFromPath} from '../../../src/utils/routing.js';
import {pageIndexingHead} from '../../../src/utils/socialMetadata.js';

const source=(file:string)=>readFileSync(file,'utf8');
const app=source('src/App.tsx');
const workspace=source('src/components/website/BusinessWorkspacePage.tsx');
const dashboard=source('src/components/website/WebsiteBusinessDashboard.tsx');
const builder=source('src/components/website/WebsiteBuilderPage.tsx');

test('the Website destination opens My Business for owners; the gallery, design links and the editor stay put',()=>{
  for(const path of ['/website-builder','/website-builder/','/website','/website-builder/index.html'])assert.equal(builderVisitOpensBusiness(path),true,path);
  for(const [path,search] of [[WEBSITE_DESIGNS_PATH,''],['/website-builder','?template=tmpl-data-reseller'],['/website-builder','?t=tmpl-glow-salon'],['/website-builder/template/tmpl-glow-salon',''],['/website-builder/edit/site_1',''],['/my-business','']])
    assert.equal(builderVisitOpensBusiness(path,search),false,`${path}${search}`);
  // The gallery is a real Builder address (same page, refresh-safe) with the Builder's public metadata.
  assert.equal(getPageFromPath(WEBSITE_DESIGNS_PATH),'website');
  assert.deepEqual(pageIndexingHead(WEBSITE_DESIGNS_PATH),pageIndexingHead('/website-builder'));
  assert.notEqual(pageIndexingHead(WEBSITE_DESIGNS_PATH).noindex,true);
  // Replacing the entry (not pushing) keeps Back free of loops; never while a resumed design or a switch is open.
  assert.match(builder,/useEffect\(\(\) => \{ if \(opensBusiness && !resuming\.current\) replacePath\('\/my-business'\); \}, \[opensBusiness\]\);/);
  assert.match(builder,/user && activeSite && !resumingStart && !changeTarget && !startTemplate && builderVisitOpensBusiness/);
  // Closing a design link keeps the gallery; the editor's way back names where it really goes.
  assert.match(source('src/components/website/TemplatePreviewModal.tsx'),/replaceState\(null, '', WEBSITE_DESIGNS_PATH\)/);
  // A new owner who started from the bare Builder address is going back to My Business (the Builder redirects there).
  assert.match(source('src/components/website/WebsiteEditorPage.tsx'),/from\.current\?\.startsWith\('\/website-builder'\) \? \(builderVisitOpensBusiness\(from\.current\) \? 'Back to My Business' : 'Back to Website Builder'\)/);
});

test('Create → Editor → My Business: a website made just now leaves its editor for My Business',()=>{
  assert.match(source('src/context/AppContext.tsx'),/options\.created \? \{ page: 'editor', mhEditorFrom: '\/my-business', mhEditorCreated: true \}/);
  assert.match(builder,/openWebsiteEditor\(site, \{ created: !alreadyExists \}\)/);
  assert.match(source('src/components/website/TemplatePreviewModal.tsx'),/openWebsiteEditor\(site,\{created:!alreadyExists\}\)/);
  const page=source('src/components/website/WebsiteEditorPage.tsx');
  assert.match(page,/const created = useRef\(Boolean\(window\.history\.state\?\.mhEditorCreated\)\);/,'survives a refresh in the editor');
  // Never steps back onto the design link (which would reopen its preview over My Business): the editor's entry is replaced.
  assert.match(page,/if \(origin && \(!target \|\| target === origin\) && !created\.current\) \{ window\.history\.go/);
});

test('the Website tab goes straight to My Business when this session already knows the account owns a website',()=>{
  const hook=source('src/hooks/useOwnerWebsites.ts');
  assert.match(hook,/return token && cache\?\.token === token \? cache\.sites\.length > 0 : null;/,'per account only; unknown is null, never a guess');
  assert.match(source('src/components/common/MobileNav.tsx'),/setActivePage\(item\.id === 'website' && ownerHasWebsite\(sessionToken\) \? 'business' : item\.id\)/);
  assert.match(source('src/components/common/Navbar.tsx'),/setActivePage\(pageId === 'website' && ownerHasWebsite\(sessionToken\) \? 'business' : pageId\)/);
  assert.match(source('src/components/home/MemberHome.tsx'),/primeOwnerWebsites\(sessionToken,sites\)/);
  // The account menu keeps both: My Business, and the Website Builder gallery itself.
  assert.match(source('src/components/common/Navbar.tsx'),/onClick=\{openDesigns\}/);
});

test('My Business is its own shell: one navigation system, no consumer chrome',()=>{
  const shell=app.slice(app.indexOf("if (activePage === 'business')"),app.indexOf('  return (\n    <div className="mh-app'));
  assert.ok(shell.includes('<BusinessWorkspacePage />'));
  for(const chrome of ['<Navbar','<Footer','<MobileNav','<MysteryAiAssistant','<AppLaunchLayer','<CheckoutModal'])assert.ok(!shell.includes(chrome),chrome);
  assert.ok(!app.includes("activePage === 'business' && <BusinessWorkspacePage"),'not also rendered inside the consumer shell');
  // Every state of the page (signed out, loading, failed, no website, the workspace) carries the business bar.
  assert.equal((workspace.match(/<>\{bar\}/g)||[]).length,5);
  assert.match(workspace,/<nav aria-label="Breadcrumb" className="bw-crumbs">/);
  assert.match(workspace,/<span className="sr-only">Back to <\/span>Mystery Hub/);
  assert.match(workspace,/<span aria-current="page">My Business<\/span>/);
  assert.match(workspace,/aria-label=\{`My account, \$\{account\.name\}`\}/);
});

test('the dock and More never list the same area',()=>{
  const all=workspaceSections(initialWorkspaceTabs(true));
  assert.deepEqual(businessDock(all,true),['overview','orders','products','earnings']);
  assert.deepEqual(all.filter(s=>!businessDock(all,true).includes(s)),['analytics','website']);
  const site=workspaceSections(initialWorkspaceTabs(false));
  assert.deepEqual(businessDock(site,false),['overview','analytics','website'],'other websites: only the areas they have');
  // A design change that kept Data history still has at most four dock areas; the rest stay reachable in More.
  const history=workspaceSections(['Overview','Orders','Store Earnings','Analytics','Settings']);
  assert.equal(businessDock(history,false).length,4);
  assert.match(workspace,/const secondary = available\.filter\(target => !dock\.includes\(target\)\);/);
  assert.match(workspace,/secondary\.map\(target => navLink\(target, true\)\)/);
  assert.doesNotMatch(workspace,/available\.map\(target => navLink\(target, true\)\)/,'More never repeats the dock');
});

test('More: phone Back closes it, choices replace its entry, leaving never bypasses unsaved prices',()=>{
  assert.match(workspace,/window\.history\.pushState\(\{ page: 'business', bwMenu: true \}/);
  assert.match(workspace,/if \(!window\.history\.state\?\.bwMenu\) setMenuOpen\(false\);/);
  assert.match(workspace,/const closeMenu = \(\) => \{ setMenuOpen\(false\); if \(menuEntry\(\)\) window\.history\.back\(\); \};/);
  assert.match(workspace,/window\.history\[replace \|\| fromMenu \? 'replaceState' : 'pushState'\]/);
  assert.match(workspace,/if \(menuEntry\(\)\) \{ replacePath\(path\); return; \}/);
  assert.match(workspace,/const leaveBusiness = \(path = '\/'\) => \{ if \(!confirmPricingLeave\(\)\) return;/);
  for(const exit of ["onHome={() => leaveBusiness('/')}","leaveBusiness(WEBSITE_DESIGNS_PATH)","leaveBusiness('/'); }}><House"])assert.ok(workspace.includes(exit),exit);
  assert.match(workspace,/const editSite = \(target: WebsiteSiteRecord, publish = false\) => \{ if \(!confirmPricingLeave\(\)\) return;/);
  // Native modal dialog: focus moves in, Escape closes, page scroll is locked, focus returns to More.
  assert.match(workspace,/element\.showModal\(\);/);
  assert.match(workspace,/onCancel=\{event => \{ event\.preventDefault\(\); onClose\(\); \}\}/);
  assert.match(workspace,/opener\?\.focus\?\.\(\{ preventScroll: true \}\)/);
});

test('Overview: status and alerts first, then figures, activity and next steps; no directory of links',()=>{
  assert.doesNotMatch(workspace+dashboard,/Manage your business|bw-hub|overviewHub/);
  assert.doesNotMatch(dashboard,/Everything looks good/,'no filler box when nothing needs the owner');
  assert.ok(workspace.indexOf("{section === 'overview' && siteCard}")<workspace.indexOf('<WebsiteBusinessDashboard '),'website status leads');
  const order=['data-store-status','website-attention-title','data-overview-metrics','bw-activity-title','overviewNext?.(summary)','website-suggestions-title'].map(marker=>dashboard.indexOf(marker));
  assert.ok(order.every(index=>index>0),JSON.stringify(order));
  assert.deepEqual([...order].sort((a,b)=>a-b),order,'store status, alerts, figures, activity, next steps, suggestions');
  // Figures are server fields only; nothing financial is derived in the browser.
  const glance=dashboard.slice(dashboard.indexOf('const periodGlance'),dashboard.indexOf('const navigate'));
  for(const field of ['a?.paidOrders','a?.salesMinor','a?.uniqueVisitors','e?.availableMinor','e?.pendingMinor','sellable'])assert.ok(glance.includes(field),field);
  assert.doesNotMatch(glance,/[a-z]Minor\s*[-*/]|[-*/]\s*e\?\.|percentMinor/,'no client-side money arithmetic');
  assert.match(glance,/nowGlance:Glance\[\]=reseller\?/,'store figures only for a Data store');
  // The website card already handles publishing for other websites; a Data store's status covers it there.
  assert.match(dashboard,/attention\.filter\(item=>item\.id!=='publish'\)/);
  // The share kit is for a store still waiting for its first paid orders, not every visit.
  assert.match(workspace,/s\.paidOrders === 0 \? <StoreShareKit/);
});

test('editor: an already-live, fully saved website says "Up to date" instead of offering a no-op Update Live',()=>{
  const toolbar=source('src/components/website/editor/WebsiteEditorToolbar.tsx');
  assert.match(toolbar,/const upToDate = p\.published && !p\.liveBehind && p\.status==='saved';/);
  assert.match(toolbar,/disabled=\{p\.publishing\|\|upToDate\}/);
  assert.match(toolbar,/\{p\.publishing\?'Publishing…':upToDate\?'Up to date':p\.published\?'Update Live':'Publish'\}/);
  // Publication itself is unchanged: the same handler and server call.
  assert.match(source('src/components/website/editor/WebsiteEditor.tsx'),/onPublish=\{\(\)=>\{setVisualSelection\(null\);setPublishOpen\(true\);\}\}/);
});

test('spacing: the member home and business shell carry no stacked bottom gaps',()=>{
  const home=source('src/components/home/member-home.css');
  assert.match(home,/\.member-home-inner \{ max-width: 1180px; margin-inline: auto; padding: 18px 16px 8px;/);
  assert.doesNotMatch(home,/padding: 18px 16px 104px/);
  const css=source('src/components/website/businessWorkspace.css');
  assert.match(css,/\.bw\{padding-bottom:calc\(84px \+ env\(safe-area-inset-bottom,0px\)\)\}/,'clears the dock and the gesture area');
  assert.doesNotMatch(css,/data-business-mode/);
  // Phone inputs keep 16px text (no zoom) and 44px buttons inside the new shell too.
  assert.match(source('src/index.css'),/:is\(\.mh-app, \.mh-business-shell\) button:not\(\.mh-compact-control\) \{ min-height: 44px; \}/);
});

test('no money, order or checkout code in the changed navigation surfaces',()=>{
  for(const file of ['src/components/website/BusinessWorkspacePage.tsx','src/utils/businessWorkspace.ts','src/hooks/useOwnerWebsites.ts','src/components/common/MobileNav.tsx'])
    assert.doesNotMatch(source(file),/paystack|initializeServerPayment|store-withdrawals|wholesale|reserveBps|fetch\(/i,file);
});
