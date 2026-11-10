import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HeroScene } from '../../../src/seasonal/christmas/home/heroArt';

/* Final visual QA (before activation): preview links survive an escaped "&", New Year looks like New Year, and the
   two everyday purchases stay on the first screen of short phones while an order leads. */

const read = (file: string) => readFileSync(file, 'utf8');

test('a preview link whose "&" arrived escaped as "&amp;" still selects its date, and the address is cleaned', () => {
  const provider = read('src/seasonal/SeasonProvider.tsx');
  assert.match(provider, /const date = url\.searchParams\.get\('season-date'\) \?\? url\.searchParams\.get\('amp;season-date'\);/);
  assert.match(provider, /url\.searchParams\.delete\('amp;season-date'\);/);
  // Still only this tab: the preview is kept in sessionStorage, never sent anywhere.
  assert.match(provider, /writeStorage\(\(\) => sessionStorage, PREVIEW_KEY, stored\);/);
});

test('New Year is visibly New Year: midnight-and-silver gift and a midnight sky, Christmas untouched', () => {
  const scene = (phase: string) => renderToStaticMarkup(React.createElement(HeroScene, { phase: phase as never, countBig: '1', countSmall: 'x' }));
  const front = (html: string) => html.match(/<linearGradient id="xh-front"[^>]*><stop offset="0" stop-color="([^"]+)"/)?.[1];
  assert.equal(front(scene('christmas-season')), '#18734f');
  assert.equal(front(scene('christmas-day')), '#18734f');
  for (const phase of ['year-end', 'new-years-eve', 'new-years-day', 'new-year']) assert.equal(front(scene(phase)), '#2b4682', phase);
  const css = read('src/seasonal/christmas/home/christmasHome.css');
  assert.match(css, /\.xh-home:is\(\[data-phase="year-end"\], \[data-phase\^="new-year"\]\) \.xh-hero \{ background:/);
  assert.match(read('src/seasonal/christmas/member/member.css'), /\.xm-home:is\(\[data-phase="year-end"\], \[data-phase\^="new-year"\]\)::before \{ background:/);
});

test('short phones: while an order leads, the slim purchase row sits under the welcome; very short phones always use it', () => {
  const css = read('src/seasonal/christmas/member/member.css');
  const short = css.slice(css.indexOf('@media (max-width: 767px) and (max-height: 720px) {'));
  assert.match(short, /\.xm-dash\.is-urgent \.xm-deck \{ display: contents; \}/);
  assert.match(short, /\.xm-dash\.is-urgent \.xm-buy \{ order: 1; \}/);
  assert.match(short, /\.xm-dash\.is-urgent \.xm-spot \{ order: 2; \}/);
  assert.match(css, /@media \(max-width: 767px\) and \(max-height: 600px\) \{\s*\.xm-dash \.xm-buy-tile \{ flex-direction: row;/);
  // The purchases keep their accessible descriptions when the subtitle is hidden visually.
  assert.match(css, /\.xm-dash \.xm-buy-text > span \{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset\(50%\);/);
});
