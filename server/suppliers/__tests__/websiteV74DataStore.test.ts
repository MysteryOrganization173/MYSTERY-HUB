import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DATA_STORE_ARTWORK, DATA_RESELLER_LEGACY_HERO_IMAGE, DATA_RESELLER_STARTER_HERO_IMAGE, dataStoreArtworkFamily,
  heroAfterColourChange, isAutomaticDataStoreArtwork, matchedDataStoreArtwork, resolveDataResellerHeroImage,
} from '../../../src/utils/dataResellerArtwork.js';
import { WEBSITE_PALETTES } from '../../../src/utils/websitePalettes.js';
import { WEBSITE_DEFAULT_STYLE, resolveWebsiteStyle } from '../../../src/config/websiteStyleVariants.js';
import { websiteStarter } from '../../../src/config/websiteStarters.js';
import { getCloudinarySrcSet } from '../../../src/utils/cloudinary.js';

const source = (path: string) => readFileSync(path, 'utf8');
const palette = (name: string) => WEBSITE_PALETTES.find(p => p.name === name)!;
const ASSET = 'v1792354394/Global_Connectivity_Tech_Showcase_w4kgd6.png';

test('V7.4 C: twelve artwork families, all from the one verified Cloudinary asset; blue is the starter itself', () => {
  const all = Object.values(DATA_STORE_ARTWORK);
  assert.equal(all.length, 12);
  assert.equal(new Set(all.map(a => a.src)).size, 12);
  for (const a of all) assert.match(a.src, new RegExp(`^https://res\\.cloudinary\\.com/da6oeat7m/image/upload/(e_hue:-?\\d+/|e_grayscale/)?${ASSET.replace(/[./]/g, m => '\\' + m)}$`));
  assert.equal(DATA_STORE_ARTWORK.blue.src, DATA_RESELLER_STARTER_HERO_IMAGE);
});

test('V7.4 C: every palette picks a sensible artwork, including the founder\'s examples', () => {
  assert.equal(dataStoreArtworkFamily(palette('Signal blue')), 'blue');
  assert.equal(dataStoreArtworkFamily(palette('Fresh green')), 'emerald');
  assert.equal(dataStoreArtworkFamily(palette('Royal indigo')), 'indigo');
  assert.equal(dataStoreArtworkFamily(palette('Kente gold')), 'gold');
  assert.equal(dataStoreArtworkFamily(palette('Berry')), 'berry');
  assert.equal(dataStoreArtworkFamily(palette('Monochrome')), 'mono');
  for (const p of WEBSITE_PALETTES) assert.ok(DATA_STORE_ARTWORK[dataStoreArtworkFamily(p)], p.name);
  // Every family is used by at least one palette.
  assert.equal(new Set(WEBSITE_PALETTES.map(p => dataStoreArtworkFamily(p))).size, 12);
  // Case and spacing never change the answer; custom colours follow the accent hue; greys are monochrome.
  assert.equal(dataStoreArtworkFamily({ backgroundColor: ' #1A1408', primaryColor: '#2A1F0B', accentColor: '#E0A526 ' }), 'gold');
  assert.equal(dataStoreArtworkFamily({ accentColor: '#16a34a' }), 'emerald');
  assert.equal(dataStoreArtworkFamily({ accentColor: '#dc2626' }), 'red');
  assert.equal(dataStoreArtworkFamily({ accentColor: '#7c3aed' }), 'purple');
  assert.equal(dataStoreArtworkFamily({ accentColor: '#6b7280' }), 'mono');
  assert.equal(dataStoreArtworkFamily({ accentColor: 'not-a-colour' }), 'blue');
  assert.equal(dataStoreArtworkFamily({}), 'blue');
});

test('V7.4 C: automatic artwork follows colours; an owner photo, the legacy banner and legacy empty heroes never change', () => {
  const upload = 'https://res.cloudinary.com/da6oeat7m/image/upload/v1/mysteryhub/websites/site_x/asset_y.jpg';
  for (const a of Object.values(DATA_STORE_ARTWORK)) assert.ok(isAutomaticDataStoreArtwork(a.src));
  assert.ok(isAutomaticDataStoreArtwork(` ${DATA_RESELLER_STARTER_HERO_IMAGE} `));
  assert.ok(!isAutomaticDataStoreArtwork(upload));
  assert.ok(!isAutomaticDataStoreArtwork(DATA_RESELLER_LEGACY_HERO_IMAGE));
  assert.ok(!isAutomaticDataStoreArtwork(''));
  assert.equal(heroAfterColourChange(DATA_RESELLER_STARTER_HERO_IMAGE, palette('Berry')), DATA_STORE_ARTWORK.berry.src);
  assert.equal(heroAfterColourChange(DATA_STORE_ARTWORK.berry.src, palette('Kente gold')), DATA_STORE_ARTWORK.gold.src);
  assert.equal(heroAfterColourChange(upload, palette('Berry')), upload);
  assert.equal(heroAfterColourChange(DATA_RESELLER_LEGACY_HERO_IMAGE, palette('Berry')), DATA_RESELLER_LEGACY_HERO_IMAGE);
  assert.equal(heroAfterColourChange('', palette('Berry')), '');
  // Rendering is unchanged: a saved hero is shown as saved, and an empty owner hero keeps the legacy banner.
  assert.equal(resolveDataResellerHeroImage(DATA_STORE_ARTWORK.gold.src, true), DATA_STORE_ARTWORK.gold.src);
  assert.equal(resolveDataResellerHeroImage('', true), DATA_RESELLER_LEGACY_HERO_IMAGE);
  assert.equal(matchedDataStoreArtwork(palette('Signal blue')), DATA_RESELLER_STARTER_HERO_IMAGE);
});

test('V7.4 C: the editor applies the rules in the draft only: colours, Remove, the tap-to-edit panel and the hint', () => {
  const editor = source('src/components/website/editor/WebsiteEditor.tsx');
  assert.match(editor, /const hero=\(isDataReseller\?heroAfterColourChange\(draftRef\.current\.content\.heroImage,next\)/);
  assert.match(editor, /<WebsitePaletteControl settings=\{settings\} onApply=\{applyPalette\}\/>/);
  assert.equal(editor.match(/heroImage:isDataReseller&&!url\?matchedDataStoreArtwork\(settings\):url/g)?.length, 2);
  assert.match(editor, /heroImage: isDataReseller \? matchedDataStoreArtwork\(settings\) : ''/);
  assert.match(editor, /data-artwork-state="automatic"/);
  assert.match(editor, /Match the artwork to my colours/);
  assert.doesNotMatch(editor, /DATA_RESELLER_STARTER_HERO_IMAGE/);
  const visual = source('src/utils/websiteVisualEditing.ts');
  assert.match(visual, /template\.layoutType === 'reseller' && !value\.trim\(\) \? matchedDataStoreArtwork\(settings\) : value/);
  // No automatic publishing: nothing here calls publish.
  assert.doesNotMatch(source('src/utils/dataResellerArtwork.ts'), /publish|fetch\(/i);
});

test('V7.4 C: responsive delivery chains the colour transform after format, quality and width', () => {
  const set = getCloudinarySrcSet(DATA_STORE_ARTWORK.gold.src, [480, 1024], { format: 'auto', quality: 'auto' });
  assert.match(set, /\/upload\/f_auto,q_auto,w_480\/e_hue:-85\/v1792354394\/Global_Connectivity_Tech_Showcase_w4kgd6\.png 480w/);
  assert.match(set, /w_1024\/e_hue:-85\//);
});

test('V7.4 C: Market leads the gallery and new stores; existing stores keep their look', () => {
  assert.equal(WEBSITE_DEFAULT_STYLE.reseller, 'market');
  assert.equal(resolveWebsiteStyle('reseller', undefined, false), 'market');
  assert.equal(resolveWebsiteStyle('reseller', undefined, true), 'classic');
  assert.equal(resolveWebsiteStyle('reseller', 'horizon', true), 'horizon');
  const starter = websiteStarter('tmpl-data-reseller', 'Test Store');
  assert.equal(starter.content.styleVariant, 'market');
  assert.ok(isAutomaticDataStoreArtwork(starter.content.heroImage));
});

test('V7.4 C: one-page navigation lands clear of sticky bars, works on phones and only links to real sections', () => {
  const css = source('src/components/website/websitePresentation.css');
  assert.match(css, /\.website-presentation :is\(section, div, footer\)\[id\] \{ scroll-margin-top: var\(--site-anchor-offset, 76px\); \}/);
  // Smooth scrolling is the app's own rule and is switched off for reduced motion.
  const app = source('src/index.css');
  assert.match(app, /scroll-behavior: smooth;/);
  assert.match(app, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?scroll-behavior: auto !important;/);
  const nk = source('src/components/website/templates/NightKitchenTemplateView.tsx');
  assert.match(nk, /\.nk-nav\{display:flex;order:3;width:100%/);
  assert.match(nk, /\.nk-nav a\{[^}]*min-height:44px/);
  assert.match(nk, /enquiry: <section key="enquiry" id="enquiry"/);
  assert.match(nk, /const nav = sections\.filter\(s => s\.visible && s\.nav && blocks\[s\.id\]\);/);
  assert.match(source('src/config/websiteContentV5.ts'), /S\('enquiry', 'Table enquiry', \{ nav: 'Enquire' \}\)/);
});
