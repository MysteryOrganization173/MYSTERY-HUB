/**
 * Renders the Mystery Countdown link-preview card, public/og/mystery-countdown-2027-v2.jpg (1200x630 JPEG).
 *
 * The card is drawn from the page's own Midnight Dial and stylesheet, so the preview shows the real experience, and it
 * carries no date, number or personal detail (one fixed image for everyone, before and after midnight). Nothing is
 * uploaded anywhere.
 *
 *   npx tsx scripts/renderCountdownShareImage.tsx [--mark <png>] [--out <jpg>]
 *
 * --mark substitutes a local copy of the approved Mystery Hub mark when Cloudinary cannot be reached (for example in
 * an offline sandbox). Bump the file version (v1 → v2) whenever the image changes, so link previews refresh.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Dial, YearMark } from '../src/countdown/Dial';
import { STARS } from '../src/countdown/CountdownPage';
import { BUSINESS_CONFIG } from '../src/config/business';

// Playwright is a machine-level tool here (like the other review scripts), not a repository dependency.
interface Shot { setContent: (html: string, o: { waitUntil: 'networkidle' }) => Promise<void>; evaluate: (f: () => unknown) => Promise<unknown>; screenshot: (o: { type: 'jpeg'; quality: number }) => Promise<Buffer> }
const { chromium } = createRequire(import.meta.url)('playwright') as { chromium: { launch: () => Promise<{ newPage: (o: object) => Promise<Shot>; close: () => Promise<void> }> } };

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const out = arg('--out') || 'public/og/mystery-countdown-2027-v2.jpg';
const markFile = arg('--mark');
const mark = markFile ? `data:image/png;base64,${readFileSync(markFile).toString('base64')}` : BUSINESS_CONFIG.brandMarkUrl.replace('/upload/', '/upload/f_png,w_96/');
const css = readFileSync(path.resolve('src/countdown/countdown.css'), 'utf8');

const centre = React.createElement('span', { className: 'cd-center-stack' }, React.createElement(YearMark, { lit: false, igniting: false }), React.createElement('span', { className: 'cd-center-caption' }, 'Midnight · Ghana'));
const dial = renderToStaticMarkup(React.createElement(Dial, { stage: 'eve', remainingMs: 4 * 3600_000 + 21 * 60_000 + 9_000, celebrating: false, motion: false, children: centre }));
const stars = STARS.map(s => `<circle cx="${s.x}" cy="${s.y}" r="${(s.r * 0.12).toFixed(3)}" opacity="${s.o}" />`).join('');

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,500;1,9..144,600&family=Outfit:wght@600;700&family=Plus+Jakarta+Sans:wght@500;600&display=block" rel="stylesheet">
<style>${css}
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #03040c; }
.cd-page { min-height: 0; width: 1200px; height: 630px; }
.cd-sky { position: absolute; }
.cd-sky-layer.is-eve { opacity: 1; }
.cd-sky-layer.is-final { opacity: .55; }
.card { position: absolute; inset: 0; display: grid; grid-template-columns: 560px 1fr; align-items: center; padding: 0 70px 0 40px; }
.card .cd-dial { width: 500px; justify-self: center; }
/* The 7 caught mid-fill: the moment the whole experience leads to. */
.card .cd-seven-fill { transform: translateY(46%); }
.card .cd-seven-fill > span { transform: translateY(-46%); }
.card .cd-year-seven::before { opacity: .7; }
.words { display: grid; gap: 18px; }
.words .cd-kicker { font-size: 17px; letter-spacing: .3em; }
.words h1 { margin: 0; font: italic 500 84px/1 var(--cd-serif); letter-spacing: -.02em; background: linear-gradient(180deg, #fffaf0 20%, #e7d6ab); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; padding-bottom: 6px; }
.words p { margin: 0; color: var(--cd-text-2); font: 500 27px/1.35 var(--cd-sans); }
.brand { display: flex; align-items: center; gap: 14px; margin-top: 18px; color: var(--cd-gold-2); font: 700 18px/1 var(--cd-display); letter-spacing: .32em; text-transform: uppercase; }
.brand img { width: 40px; height: auto; }
</style></head><body>
<main class="cd-page" data-stage="eve" data-motion="reduced">
  <div class="cd-sky" aria-hidden="true"><span class="cd-sky-layer is-eve"></span><span class="cd-sky-layer is-final"></span>
    <svg class="cd-stars" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style="-webkit-mask-image:none;mask-image:none">${stars}</svg><span class="cd-horizon"></span></div>
  <div class="card">${dial}
    <div class="words">
      <p class="cd-kicker">Ghana · GMT</p>
      <h1>Midnight in Ghana</h1>
      <p>The New Year countdown to 2027, live to the second.</p>
      <div class="brand"><img src="${mark}" alt="">Mystery Hub</div>
    </div>
  </div>
</main></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const jpeg = await page.screenshot({ type: 'jpeg', quality: 86 });
await browser.close();
writeFileSync(out, jpeg);
console.log(`${out}: ${jpeg.length} bytes`);
