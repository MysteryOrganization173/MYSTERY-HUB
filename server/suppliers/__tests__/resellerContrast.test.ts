import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { WEBSITE_TEMPLATES } from '../../../src/data/templates';
import { DATA_BUNDLES } from '../../../src/data/bundles';
import { BundleCard } from '../../../src/components/data/BundleCard';
import { DataResellerTemplateView } from '../../../src/components/website/templates/DataResellerTemplateView';
import { mergeSiteWithTemplate } from '../../../src/utils/templateRendererUtils';
import { readableWebsiteColor, resolveResellerTheme, websiteActionText, websiteContrast } from '../../../src/utils/websiteBrand';

const base = WEBSITE_TEMPLATES.find(t => t.id === 'tmpl-data-reseller')!;
const mixed = mergeSiteWithTemplate(base, {businessName:'Synthetic store', phone:'0241234567', items:[]}, {backgroundColor:'#ffffff', accentColor:'#7c3aed'});
const light = {...mixed, colorScheme:{...mixed.colorScheme!, surface:'#f8fafc', text:'#0f172a', mutedText:'#64748b'}};

for (const [name, template] of [['dark',base], ['mixed saved white background',mixed], ['light',light]] as const) {
  test(`${name}: resolved background, surface, secondary text and boundaries meet contrast targets`, () => {
    const original = structuredClone(template.colorScheme!);
    const theme = resolveResellerTheme(template.colorScheme!);
    for (const [fg,bg] of [[theme.text,theme.background],[theme.mutedText,theme.background],
      [theme.surfaceText,theme.surface],[theme.surfaceMutedText,theme.surface]]) assert.ok(websiteContrast(fg,bg)>=4.5);
    for (const bg of [theme.background,theme.surface]) {
      assert.ok(websiteContrast(theme.border,bg)>=3);
      assert.ok(websiteContrast(theme.focus,bg)>=3);
    }
    assert.deepEqual(template.colorScheme,original);
  });
  test(`${name}: real bundle rendering uses card foreground and distinct input foreground`, () => {
    const theme = resolveResellerTheme(template.colorScheme!);
    const html = renderToStaticMarkup(React.createElement(BundleCard,{bundle:DATA_BUNDLES[0],colorScheme:template.colorScheme,onBuy:()=>{}}));
    assert.ok(html.includes(`background-color:${theme.surface};border-color:${theme.border};color:${theme.surfaceText}`));
    assert.ok(html.includes(`background-color:${theme.background};border-color:${theme.border};color:${theme.text}`));
    assert.ok(html.includes(`background-color:${theme.accent};color:${websiteActionText(theme.accent)}`));
    assert.ok(html.includes(DATA_BUNDLES[0].priceGhc.toFixed(2)));
  });
}

for (const accent of ['#2563eb','#7c3aed','#00c365','#ffffee']) test(`owner accent ${accent} preserved with readable action text and focus`, () => {
  const theme=resolveResellerTheme({...light.colorScheme!,accent});
  assert.equal(theme.accent,accent);
  assert.ok(websiteContrast(websiteActionText(accent),accent)>=4.5);
  assert.ok(websiteContrast(theme.surfaceAccentText,theme.surface)>=4.5);
  assert.ok(websiteContrast(theme.focus,theme.background)>=3);
});

test('managed template uses availability action instead of an empty purchase promise', () => {
  const html=renderToStaticMarkup(React.createElement(DataResellerTemplateView,{template:mixed,managedCheckout:React.createElement('p',null,'Bundles are not available right now.'),managedAvailability:'empty'}));
  assert.ok(html.includes('View Availability'));
  assert.ok(!html.includes('<span>Buy Data</span>'));
  assert.ok(html.includes('Synthetic store'));
  assert.ok(html.includes('bg-[#25D366]'));
});

test('available managed template retains normal Buy Data action and owner branding', () => {
  const html=renderToStaticMarkup(React.createElement(DataResellerTemplateView,{template:mixed,managedCheckout:React.createElement('p',null,'Configured bundles'),managedAvailability:'available'}));
  assert.ok(html.includes('<span>Buy Data</span>'));
  assert.ok(html.includes('background-color:#7c3aed'));
  assert.ok(html.includes('Configured bundles'));
});

test('managed catalogue and tracking preserve public state boundaries', () => {
  const source=readFileSync('src/components/website/ManagedDataStorefront.tsx','utf8');
  for (const text of ['Loading available bundles','Bundles are not available right now.','Choose another network','aria-label="Order reference"','Check status','maskDataRecipient(order.recipient_phone)','managedAvailability={availability}']) assert.ok(source.includes(text));
  assert.ok(!source.includes('sample-mtn'));
  assert.ok(!source.includes('hover:brightness'));
  assert.ok(!readFileSync('src/components/data/BundleCard.tsx','utf8').includes('hover:brightness'));
});

test('contrast resolver keeps a valid owner foreground unchanged', () => {
  assert.equal(readableWebsiteColor('#0f172a',['#ffffff']),'#0f172a');
});
