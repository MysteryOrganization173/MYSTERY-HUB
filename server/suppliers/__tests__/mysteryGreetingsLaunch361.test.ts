import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GreetingStage, OPEN_MS } from '../../../src/greetings/GreetingStage.js';

/**
 * Mystery Hub 3.6.1 · Mystery Greetings launch readiness. These guard the refinements of this release: motion that
 * always ends (battery on budget Android phones), a reveal that settles before the letter is handed over, decoration
 * that never covers words, honest "is it live" signals, and creator interactions that never move the sticky actions.
 */
const read = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const css = read('src/greetings/greetings.css');
const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');

test('no greeting animation loops forever, except the two that exist only while waiting for the network', () => {
  const loops = clean.split('\n').filter(line => /animation[^;{}]*\binfinite\b/.test(line));
  for (const line of loops) assert.match(line, /^\s*(\.mg-loading-gift span|\.mg-spinner|@media \(prefers-reduced-motion: reduce\) \{ \.mg-spinner)/, line);
  // The sealed gift's idle motion and the Starlight sky run a set number of times, then rest.
  assert.match(clean, /\.mg-gift\[data-state="sealed"\] \.mg-gift-art \{ animation: mg-bob 3\.8s ease-in-out 3; \}/);
  assert.match(clean, /\.mg-gift\[data-state="sealed"\] \.mg-gift-halo \{ animation: mg-halo 3\.8s ease-in-out 3; \}/);
  assert.match(clean, /\.mg-gift\[data-state="sealed"\] \.mg-art-bow \{ animation: mg-wiggle 6s ease-in-out 1\.4s 2; \}/);
  assert.match(clean, /\.mg-sky-stars \{[^}]*animation: mg-twinkle 5s ease-in-out 4;/);
});

test('new motion is transform and opacity only, and reduced motion switches every new piece off', () => {
  for (const name of ['mg-bloom', 'mg-ink', 'mg-sky-in', 'mg-step-in', 'mg-pick', 'mg-check-pop', 'mg-done-land', 'mg-glow-once']) {
    const body = clean.match(new RegExp(`@keyframes ${name} \\{([\\s\\S]*?\\})\\s*\\}`))?.[1];
    assert.ok(body, name);
    for (const [, prop] of body!.matchAll(/([a-z-]+):/g)) assert.ok(['opacity', 'transform'].includes(prop), `${name} animates ${prop}`);
  }
  const reduced = [...clean.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map(m => m[1]).join('\n');
  for (const selector of ['.mg-bloom', '.mg-stage[data-state="opening"] .mg-letter > *', '.mg-sky', '.mg-step > *', '.mg-step > form > *', '.mg-design-art svg', '.mg-template::after', '.mg-done-art svg', '.mg-done-art::before', '.mg-pop'])
    assert.ok(reduced.includes(selector), `reduced motion covers ${selector}`);
});

test('the reveal: words appear in reading order and have all settled before the letter is handed over', () => {
  const delays = [...clean.matchAll(/\.mg-stage\[data-state="opening"\] \.mg-letter > :nth-child\((\d)\) \{ animation-delay: ([\d.]+)s; \}/g)].map(m => [Number(m[1]), Number(m[2]) * 1000] as const);
  assert.deepEqual(delays.map(d => d[0]), [1, 2, 3, 4, 5], 'ornament, greeting, message, signature, foot');
  for (let i = 1; i < delays.length; i++) assert.ok(delays[i][1] >= delays[i - 1][1], 'reading order');
  const ink = Number(clean.match(/\.mg-letter > \* \{ animation: mg-ink ([\d.]+)s/)?.[1]) * 1000;
  for (const [, delay] of delays) assert.ok(delay + ink <= OPEN_MS, `settled by ${OPEN_MS} ms (${delay} + ${ink})`);
  // A bloom of light opens behind the rising letter, once; it is decorative and sits behind the gift and the letter.
  const html = renderToStaticMarkup(React.createElement(GreetingStage, { greeting: { occasion: 'christmas-2026', variant: 'gift-classic-v1', recipientName: 'Ama', senderName: null, message: 'Hello there' } }));
  assert.match(html, /<span class="mg-bloom" aria-hidden="true"><\/span><article class="mg-letter" aria-hidden="true">/);
  assert.match(clean, /\.mg-stage \.mg-sealed \{ position: relative; z-index: 1; \}\n\.mg-stage \.mg-letter \{ z-index: 2; \}/);
  assert.match(clean, /\.mg-bloom \{[^}]*z-index: 0;[^}]*pointer-events: none;/);
});

test('one top-level heading: once opened, the letter greeting becomes the page heading (axe page-has-heading-one)', () => {
  const stage = read('src/greetings/GreetingStage.tsx');
  assert.match(stage, /const LetterHeading = state === 'open' \? Heading : headingLevel === 1 \? 'h2' : 'h3';/);
  const sealed = renderToStaticMarkup(React.createElement(GreetingStage, { greeting: { occasion: 'new-year-2027', variant: 'gift-starlight-v1', recipientName: 'Esi', senderName: 'Kwame', message: 'Happy days' } }));
  assert.equal((sealed.match(/<h1/g) || []).length, 1, 'sealed: the invitation is the one h1');
  assert.match(sealed, /<h2 tabindex="-1" class="mg-letter-title">/, 'the hidden letter waits one level below');
});

test('letter decoration (ribbon, stars, 2027 mark) is decorative only and never paints over words', () => {
  assert.match(clean, /\.mg-letter > \* \{ position: relative; \}/, 'words paint above positioned decoration');
  for (const rule of [/\.mg-page\[data-variant="gift-classic-v1"\] \.mg-letter::before \{[^}]*pointer-events: none;/, /\.mg-page\[data-variant="gift-starlight-v1"\] \.mg-letter::before \{[^}]*pointer-events: none;/, /\.mg-page\[data-occasion="new-year-2027"\] \.mg-letter::after \{[^}]*pointer-events: none;/])
    assert.match(clean, rule);
  // The message keeps its line breaks and wraps any long word: nothing is clipped by the letter's rounded edge.
  assert.match(clean, /\.mg-letter-message \{[^}]*white-space: pre-line; overflow-wrap: anywhere;/);
});

test('creator: step entrances never move the sticky actions; Surprise me shows its pick; share actions fit narrow phones', () => {
  assert.match(clean, /\.mg-step > :not\(\.mg-step-actions\):not\(form\), \.mg-step > form > :not\(\.mg-step-actions\) \{ animation: mg-step-in/);
  assert.doesNotMatch(clean, /^\.mg-step \{[^}]*animation/m, 'the step itself (and its sticky bar) is never transformed');
  const creator = read('src/greetings/CreatorPage.tsx');
  assert.match(creator, /input\[name="mg-template"\]\[value="\$\{CSS\.escape\(pick\.id\)\}"\][\s\S]*?scrollIntoView\(\{ block: 'center'/);
  assert.match(creator, /<GreetingsSky key=\{`\$\{occasion\}:\$\{variant\}`\} \/>/);
  assert.match(clean, /@media \(max-width: 420px\) \{ \.mg-done-actions \{ grid-template-columns: 1fr; \} \}/);
});

test('Admin leads with one verdict from what actually works, separate from the switches', () => {
  const panel = read('src/components/admin/sections/AdminGreetingsPanel.tsx');
  for (const status of ['live', "'links-only'", 'off', "'not-working'"]) assert.ok(panel.includes(`${status}: { tone:`), status);
  assert.match(panel, /\['Shared links working now', pill\(ready\.available\.links, 'Yes', 'No'\)\]/);
  assert.match(panel, /\['New greetings accepted now', pill\(ready\.available\.creation, 'Yes', 'No'\)\]/);
  const service = read('server/services/experienceService.ts');
  assert.match(service, /const available=\{links:gates\.links&&storage==='installed',creation:gates\.creation&&abuseSecret&&storage==='installed'&&retentionDue===false\};/);
  // Readiness and the public signal never expose secret values.
  assert.doesNotMatch(service, /EXPERIENCES_ABUSE_SECRET\s*[,}]/);
});
