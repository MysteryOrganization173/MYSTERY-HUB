import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {getPageFromPath, editorSiteIdFromPath, websiteEditorPath, safeEditorReturnPath, ROUTE_PATH_MAP} from '../../../src/utils/routing';
import {pageIndexingHead} from '../../../src/utils/socialMetadata';
import {WebsiteStoreSetup} from '../../../src/components/website/editor/WebsiteStoreSetup';
import type {ResellerCatalogueSummary} from '../../../src/utils/websiteOwnerAttention';

const source = (path: string) => readFileSync(path, 'utf8');
const app = source('src/App.tsx'), page = source('src/components/website/WebsiteEditorPage.tsx'), editor = source('src/components/website/editor/WebsiteEditor.tsx');
const context = source('src/context/AppContext.tsx'), builder = source('src/components/website/WebsiteBuilderPage.tsx'), workspace = source('src/components/website/BusinessWorkspacePage.tsx');
const preview = source('src/components/website/TemplatePreviewModal.tsx'), setup = source('src/components/website/editor/WebsiteStoreSetup.tsx');

test('the editor has its own address under the Builder', () => {
  assert.equal(websiteEditorPath('site_abc-123'), '/website-builder/edit/site_abc-123');
  assert.equal(getPageFromPath('/website-builder/edit/site_abc-123'), 'editor');
  assert.equal(getPageFromPath('/website-builder/edit/site_abc-123/'), 'editor');
  assert.equal(getPageFromPath('https://mysterybundlehub.com/website-builder/edit/site_1?x=1'), 'editor');
  for (const path of ['/website-builder', '/website-builder/edit', '/website-builder/edit/', '/website-builder/template/tmpl-boutique', '/website'])
    assert.equal(getPageFromPath(path), 'website', path);
  assert.equal(getPageFromPath('/my-business/orders'), 'business');
  assert.equal(ROUTE_PATH_MAP.editor, '/website-builder', 'an editor without a website falls back to the Builder');
});

test('editor addresses accept only a plain website id, with its case kept', () => {
  assert.equal(editorSiteIdFromPath('/website-builder/edit/site_1791231782316_hfxt11'), 'site_1791231782316_hfxt11');
  assert.equal(editorSiteIdFromPath('/website-builder/edit/Site_AbC?tab=1#x'), 'Site_AbC');
  for (const bad of ['/website-builder/edit/a%2Fb', '/website-builder/edit/%3Cscript%3E', '/website-builder/edit/a.b', '/website-builder/edit/x/y', '/website-builder/edit/%E0%A4%A', `/website-builder/edit/${'a'.repeat(121)}`])
    assert.equal(editorSiteIdFromPath(bad), null, bad);
});

test('leaving the editor only ever returns to a local app address', () => {
  assert.equal(safeEditorReturnPath('/my-business/orders'), '/my-business/orders');
  assert.equal(safeEditorReturnPath('/website-builder?template=tmpl-boutique'), '/website-builder?template=tmpl-boutique');
  for (const bad of ['//evil.test', 'https://evil.test', '/website-builder/edit/site_1', '/\\evil.test', 'my-business', 42, null, '/a b'])
    assert.equal(safeEditorReturnPath(bad), null, String(bad));
});

test('the editor page is private and never indexed', () => {
  const head = pageIndexingHead('/website-builder/edit/site_secret_id');
  assert.equal(head.noindex, true);
  assert.equal(head.title, 'Website Editor — Mystery Hub');
  assert.ok(!JSON.stringify(head).includes('site_secret_id'), 'never echoes the website id');
  assert.equal(pageIndexingHead('/website-builder').noindex, undefined, 'the public Builder stays indexable');
  assert.match(source('public/robots.txt'), /Disallow: \/website-builder\/edit/);
});

test('a signed-out visitor keeps the chosen design through sign-up, exactly once', async () => {
  const store = new Map<string, string>();
  (globalThis as any).window = {sessionStorage: {getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k)}};
  try {
    const intent = await import('../../../src/utils/websiteStartIntent');
    intent.saveWebsiteStartIntent({templateId: 'tmpl-boutique', businessName: 'Akosua Styles', whatsapp: '0244123456', location: 'Osu'}, 1000);
    const taken = intent.takeWebsiteStartIntent(2000);
    assert.equal(taken?.templateId, 'tmpl-boutique'); assert.equal(taken?.businessName, 'Akosua Styles');
    assert.equal(intent.takeWebsiteStartIntent(2000), null, 'taken once, so it can never create a second website');
    intent.saveWebsiteStartIntent({templateId: 'tmpl-boutique', businessName: 'Old', whatsapp: '', location: ''}, 0);
    assert.equal(intent.takeWebsiteStartIntent(intent.WEBSITE_START_INTENT_TTL_MS + 1), null, 'expires after 30 minutes');
    for (const raw of ['not json', JSON.stringify({templateId: 'javascript:alert(1)', businessName: 'Ama', at: 1}), JSON.stringify({templateId: 'tmpl-boutique', businessName: 'A', at: 1})]) {
      store.set('mh_website_start_intent', raw); assert.equal(intent.takeWebsiteStartIntent(2), null, raw);
    }
    intent.saveWebsiteStartIntent({templateId: 'tmpl-boutique', businessName: 'Kept', whatsapp: '', location: ''});
    intent.clearWebsiteStartIntent(); assert.equal(store.size, 0);
  } finally { delete (globalThis as any).window; }
  assert.match(context, /const closeAuth = \(\) => \{\n\s+\/\/ A visitor who closes sign-in without an account gives up the website they were starting\.\n\s+clearWebsiteStartIntent\(\);/);
  assert.match(source('src/components/website/WebsiteStartSheet.tsx'), /saveWebsiteStartIntent\(\{templateId, \.\.\.input\}\);/);
  assert.match(builder, /const intent = takeWebsiteStartIntent\(\);/);
});

test('the editor shell has no marketing chrome and stays a separate download', () => {
  const shell = app.slice(app.indexOf("if (activePage === 'editor')"), app.indexOf("if (activePage === 'admin')"));
  assert.ok(shell.includes('<WebsiteEditorPage />'));
  for (const chrome of ['<Navbar', '<Footer', '<MobileNav', '<MysteryAiAssistant', '<AppLaunchLayer']) assert.ok(!shell.includes(chrome), chrome);
  for (const kept of ['<AuthModal', '<ToastContainer', '<AccountControls']) assert.ok(shell.includes(kept), kept);
  assert.match(app, /const WebsiteEditorPage = lazyPage\(\(\) => import\('\.\/components\/website\/WebsiteEditorPage'\)/);
  // One host: nobody else renders the editor.
  for (const [name, text] of [['builder', builder], ['workspace', workspace], ['preview', preview]] as const) assert.ok(!/<WebsiteEditor\b/.test(text), name);
  assert.equal((page.match(/<WebsiteEditor\b/g) || []).length, 1);
});

test('direct entry is resolved by the server and never leaks another account', () => {
  assert.match(page, /getWebsiteByIdOnServer\(sessionToken, siteId\)/);
  assert.match(page, /editorLaunch\.token === sessionToken/, 'an in-app record is reused only for the same session');
  assert.match(page, /const state: Load = load\.key === loadKey \? load\.state : \{ kind: 'loading' \};/, 'a different account never sees the previous answer');
  assert.match(page, /status === 401\) \{ window\.dispatchEvent\(new CustomEvent\('mystery-auth-invalid'/);
  assert.match(page, /status === 404 \? \{ kind: 'missing' \} : status === 403 \? \{ kind: 'forbidden' \}/);
  assert.match(page, /isDeletedWebsite\(siteId\)/);
  assert.match(source('src/services/apiClient.ts'), /Object\.assign\(new Error\(data\.error \|\| 'Failed to load website project\.'\), \{ status: res\.status \}\)/);
  assert.match(context, /setActiveEditorSite\(null\); setEditorAiContext\(null\); setEditorLaunch\(null\);/, 'signing out forgets the editor');
});

test('opening and leaving the editor keep history predictable and never publish', () => {
  assert.match(context, /const fromPreview = Boolean\(window\.history\.state\?\.mhPreview\);/);
  assert.match(context, /if \(fromPreview \|\| window\.location\.pathname === path\) window\.history\.replaceState\(state, '', path\);/);
  assert.match(page, /window\.history\.go\(guard \? -2 : -1\)/);
  assert.match(editor, /mhEditor: true \}, '', window\.location\.href\)/);
  const exit = editor.slice(editor.indexOf('const exitEditor'), editor.indexOf('const exitRef'));
  assert.ok(exit.includes('handleSaveDraft()') && !/publish/i.test(exit), 'leaving saves the draft and never publishes');
  assert.match(exit, /closing\.current = true;\n\s+leave\(\);/);
  assert.match(editor, /if \(!closing\.current && !window\.history\.state\?\.mhEditor\) void exitRef\.current\(true\);/);
  assert.ok(!editor.includes('editorMounts'), 'no second history mechanism');
});

test('returning owners continue editing first; My Business and gallery stay one tap away', () => {
  const banner = builder.slice(builder.indexOf('id="website-owner-card"'), builder.indexOf('id="website-owner-card"') + 2400);
  assert.ok(banner.indexOf('Continue editing') < banner.indexOf('My Business</a>'));
  assert.match(banner, /href=\{websiteEditorPath\(activeSite\.id\)\}/);
  assert.match(workspace, /openWebsiteEditor\(target, \{ publish \}\)/);
  assert.match(source('src/components/website/editor/WebsiteEditorToolbar.tsx'), /Open My Business/);
  assert.match(source('src/components/website/editor/WebsitePublishSheet.tsx'), /managed \? 'Manage orders & earnings' : 'Open My Business'/);
});

const catalogue = (patch: Partial<ResellerCatalogueSummary>): ResellerCatalogueSummary => ({sellable: 0, ownerOnSale: 0, available: 20, checkoutEnabled: true, ...patch});
const render = (props: Partial<React.ComponentProps<typeof WebsiteStoreSetup>>) => renderToStaticMarkup(React.createElement(WebsiteStoreSetup, {businessName: 'Esi Data Plug', published: false, liveChanges: false, catalogue: null, onBrand() {}, onBundles() {}, onPublish() {}, onBusiness() {}, ...props}));

test('Data Store setup line tells the truth from the server catalogue', () => {
  assert.match(render({catalogue: catalogue({})}), /Store setup · 1 of 3 done/);
  assert.match(render({catalogue: catalogue({})}), /Set up bundles/);
  assert.match(render({catalogue: catalogue({sellable: 4})}), /Store setup · 2 of 3 done/);
  const open = render({catalogue: catalogue({sellable: 4}), published: true});
  assert.match(open, /Customers can buy 4 bundles/); assert.match(open, /data-store-setup="ready"/);
  assert.doesNotMatch(render({catalogue: catalogue({sellable: 4}), published: true, liveChanges: true}), /Customers can buy/, 'unpublished edits are not called done');
  const paused = render({catalogue: catalogue({checkoutEnabled: false, ownerOnSale: 3}), published: true});
  assert.match(paused, /Checkout paused/); assert.doesNotMatch(paused, /Customers can buy/);
  assert.doesNotMatch(render({catalogue: null, published: true}), /Customers can buy/, 'unknown is never shown as open');
  assert.match(setup, /resellerStoreStatus\(\{published, catalogue\}\)/, 'one readiness model with My Business');
  assert.doesNotMatch(setup, /fetch\(|websiteBusinessRequest|paystack/i, 'no new requests and no payment code');
  assert.match(editor, /setCatalogue\(resellerCatalogueSummary\(r\)\)/, 'from the bundles response the editor already loads');
});
