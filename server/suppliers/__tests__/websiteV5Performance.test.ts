/** Website Builder V5 performance: business websites load their own code only, and owner photos come in phone sizes. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SafeImage} from '../../../src/components/website/SafeImage.js';

test('the entry script picks one surface and loads only that code',()=>{
  const main=readFileSync('src/main.tsx','utf8');
  assert.doesNotMatch(main,/^import App/m,'the main app is not part of the entry');
  for(const lazy of ["import('./components/website/PublicPublishedSite')","import('./components/website/IsolatedTemplatePreview')","import('./App.tsx')"])assert.ok(main.includes(lazy),lazy);
  assert.match(main,/\/\^\\\/sites\\\/\(\[\^\/\?#\]\+\)\//,'same /sites/:slug rule as App.tsx');
  assert.match(readFileSync('src/App.tsx','utf8'),/pathname\.match\(\/\^\\\/sites\\\/\(\[\^\/\?#\]\+\)\/\)/);
  const vite=readFileSync('vite.config.ts','utf8');
  assert.match(vite,/preloadMainApp\(\)/,'other pages start downloading the app straight away');
  assert.match(vite,/if\(!\/\^\\\\\/sites\\\\\/\/\.test\(location\.pathname\)/,'but never on business websites');
});

test('the unreachable demo renderer with fake cart and booking is gone',()=>{
  assert.equal(existsSync('src/components/website/DynamicTemplateRenderer.tsx'),false);
  assert.doesNotMatch(readFileSync('src/utils/templateRendererUtils.tsx','utf8'),/DynamicTemplateRenderer/);
});

test('owner photos on Cloudinary get a width set; other images stay exactly as given',()=>{
  const cloud='https://res.cloudinary.com/fixture/image/upload/v1/owner/photo.jpg';
  const hero=renderToStaticMarkup(React.createElement(SafeImage,{src:cloud,alt:'Fixture',loading:'eager'}));
  for(const w of [480,800,1200,1600])assert.ok(hero.includes(`f_auto,q_auto,c_limit,w_${w}/v1/owner/photo.jpg ${w}w`),String(w));
  assert.match(hero,/sizes="100vw"/);
  const card=renderToStaticMarkup(React.createElement(SafeImage,{src:cloud,alt:'Fixture'}));
  assert.match(card,/sizes="\(min-width: 1024px\) 50vw, 100vw"/);
  const own=renderToStaticMarkup(React.createElement(SafeImage,{src:cloud,srcSet:'custom 1x',sizes:'10vw'}));
  assert.match(own,/srcSet="custom 1x"|srcset="custom 1x"/);
  const external=renderToStaticMarkup(React.createElement(SafeImage,{src:'https://images.unsplash.com/photo-fixture?w=800'}));
  assert.doesNotMatch(external,/srcset/i);
});
