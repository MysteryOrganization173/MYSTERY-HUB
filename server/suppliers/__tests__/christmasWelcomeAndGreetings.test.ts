import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WelcomeCard } from '../../../src/seasonal/christmas/kit/WelcomeCard';
import { GreetingsPreview } from '../../../src/seasonal/christmas/kit/GreetingsPreview';
import { welcomeFigure } from '../../../src/seasonal/christmas/kit/welcome';
import { GREETINGS_COMING_SOON, greetingsEntry } from '../../../shared/seasonal';

/* PR #108 corrections: the welcome advertisement never shows a money amount or an unverified percentage, and both
   seasonal homepages read Mystery Greetings from one server-reported entry. */

const read = (file: string) => readFileSync(file, 'utf8');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const b = (id: string, network: string, dataAmount: string, priceGhc: number, extra = {}) => ({ id, network, dataAmount, priceGhc, ...extra }) as never;
const catalogue = [b('mtn-1gb', 'mtn', '1GB', 5.49), b('at-1gb', 'airteltigo', '1GB', 4.99), b('mtn-2gb', 'mtn', '2GB', 9.99)];
const guest = { enabled: true, state: 'guest', discountMinor: 100 };
const eligible = { ...guest, state: 'eligible' };
const card = (offer: object | null, bundles = catalogue, confirmed = true, signUp = true) =>
  renderToStaticMarkup(React.createElement(WelcomeCard, { offer: offer as never, bundles, catalogConfirmed: confirmed, onCreateAccount: signUp ? () => {} : undefined }));

test('welcome card: a confirmed catalogue gives the computed figure within the approved ceiling', () => {
  const html = card(guest);
  assert.equal(text(html), 'Up to 18% off Your first data bundle For new customers Create Your Free Account');
  assert.match(html, /Up to <b>18%<\/b> off/);
  // The figure follows the real catalogue: dearer bundles give a smaller figure, never a hardcoded 18%.
  assert.equal(text(card(guest, [b('mtn-2gb', 'mtn', '2GB', 9.99)])), 'Up to 10% off Your first data bundle For new customers Create Your Free Account');
});

test('welcome card: nothing is advertised until the server catalogue is confirmed', () => {
  assert.equal(card(guest, catalogue, false), '');
  assert.equal(card(eligible, catalogue, false), '');
});

test('welcome card: with no qualifying bundle it stays an invitation, with no percentage and no amount', () => {
  const html = card(guest, [b('airtime-10', 'mtn', 'GH₵10', 3, { serviceType: 'airtime' })]);
  assert.equal(text(html), 'Welcome saving On your first data bundle For new customers Create Your Free Account');
  assert.doesNotMatch(html, /%/);
});

test('welcome card: guest and signed-in eligibility keep their own note; other states show nothing', () => {
  assert.match(text(card(guest)), /For new customers Create Your Free Account$/);
  const member = text(card(eligible));
  assert.equal(member, 'Up to 18% off Your first data bundle Ready on your account');
  for (const state of ['previous_buyer', 'phone_required', 'phone_conflict', 'redeemed', 'reserved', 'unavailable', 'disabled']) assert.equal(card({ ...guest, state }), '', state);
  assert.equal(card({ ...guest, enabled: false }), '');
  assert.equal(card(null), '');
});

test('welcome card: no money amount or worked calculation anywhere, and pricing is untouched', () => {
  const cases = [card(guest), card(eligible), card(guest, [b('airtime-10', 'mtn', 'GH₵10', 3, { serviceType: 'airtime' })]), card(guest, [b('x', 'mtn', '5GB', 30)])];
  for (const html of cases) assert.doesNotMatch(html, /GH₵|₵|1\.00|5\.49|qualifying data purchase|which is|applies once/);
  const source = read('src/seasonal/christmas/kit/WelcomeCard.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(source, /formatGhs|discountMinor|regularMinor|figure\.label|welcomePriceForBundle|checkout/i);
  // The calculation the headline relies on is unchanged (and checkout keeps its own: the card imports no pricing).
  assert.deepEqual(welcomeFigure(guest as never, catalogue, true), { percent: 18, regularMinor: 549, label: 'MTN 1GB' });
});

test('greetings entry: only a plain same-site path from the server opens it', () => {
  assert.deepEqual(greetingsEntry({ createPath: null }), GREETINGS_COMING_SOON);
  assert.deepEqual(greetingsEntry(undefined), GREETINGS_COMING_SOON);
  assert.deepEqual(greetingsEntry({ createPath: '/greetings/new' }), { state: 'open', createHref: '/greetings/new' });
  for (const bad of ['https://example.com/x', '//example.com', '/a b', '/x?y=1', 'greetings', '', 42, '/../x', '/a//b']) assert.deepEqual(greetingsEntry({ createPath: bad }), GREETINGS_COMING_SOON, String(bad));
});

test('greetings: both homepages read the same server answer; closed shows Coming soon and no create action', () => {
  // One source: the server's season status, parsed once by SeasonProvider, read by both homepages.
  assert.match(read('server/routes/seasonalApi.ts'), /const greetings = \{ createPath: null \};/);
  const provider = read('src/seasonal/SeasonProvider.tsx');
  assert.match(provider, /setGreetings\(greetingsEntry\(data\.greetings\)\);/);
  assert.equal((provider.match(/setGreetings\(/g) || []).length, 1, 'nothing else can open it');
  const guestPage = read('src/seasonal/christmas/home/ChristmasHome.tsx');
  assert.match(guestPage, /const \{ greetings \} = useSeason\(\);/);
  assert.match(guestPage, /<Greetings christmas=\{christmas\} entry=\{greetings\} \/>/);
  const memberHome = read('src/seasonal/christmas/member/ChristmasMemberHome.tsx');
  assert.match(memberHome, /const \{ greetings \} = useSeason\(\);/);
  assert.match(memberHome, /greetings=\{greetings\}/);
  // Closed: the member preview says Coming soon and has no link or button.
  const closed = renderToStaticMarkup(React.createElement(GreetingsPreview, { headingId: 'g', entry: GREETINGS_COMING_SOON }));
  assert.match(text(closed), /Coming soon Mystery Greetings/);
  assert.doesNotMatch(closed, /<a |<button|Create a greeting/);
  // Guest: the badge and note show only while closed, and the create action exists only for an open entry.
  const section = guestPage.slice(guestPage.indexOf('function Greetings('), guestPage.indexOf('function Install('));
  assert.match(section, /const createHref = entry\.state === 'open' \? entry\.createHref : null;/);
  assert.match(section, /\{!createHref && <span className="xh-soon-badge">Coming soon<\/span>\}/);
  assert.match(section, /\{createHref && <a className="mh-button xh-btn-primary" href=\{createHref\}>Create a greeting/);
  // The demonstration envelope stays a real two-state button, and sharing the website stays separate and labelled.
  assert.match(section, /<button ref=\{envelope\} type="button" className="xh-env" data-state=\{open \? 'open' : 'closed'\} aria-pressed=\{open\} onClick=\{toggle\}/);
  assert.match(section, /Share the Mystery Hub website on WhatsApp/);
});

test('greetings: once the server reports a creator, both entries lead to the same route, with no sign-in', () => {
  const entry = greetingsEntry({ createPath: '/greetings/new' });
  const open = renderToStaticMarkup(React.createElement(GreetingsPreview, { headingId: 'g', entry }));
  assert.match(open, /<a class="xk-greet-cta" href="\/greetings\/new">Create a greeting/);
  assert.doesNotMatch(text(open), /Not open yet|Coming soon/);
  // Neither entry asks for an account or reads one.
  const guestPage = read('src/seasonal/christmas/home/ChristmasHome.tsx');
  const section = guestPage.slice(guestPage.indexOf('function Greetings('), guestPage.indexOf('function Install('));
  for (const source of [section, read('src/seasonal/christmas/kit/GreetingsPreview.tsx'), read('shared/seasonal.ts')]) assert.doesNotMatch(source, /openAuth|sessionToken|useApp|user\./);
});

test('greetings: no call to the unmerged greetings API, and ordinary pages never see the entry', () => {
  const files: string[] = [];
  const walk = (dir: string) => { for (const name of readdirSync(dir)) { const p = path.join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(name)) files.push(p); } };
  walk('src');
  const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const file of files) assert.doesNotMatch(code(read(file)), /\/api\/experiences/, file);
  // Only the provider and the two seasonal homepages use it; ordinary components do not.
  const users = files.filter(f => /greetingsEntry|GreetingsEntry|GreetingsPreview|\.greetings\b|greetings=\{/.test(read(f))).map(f => f.replace(/\\/g, '/')).sort();
  assert.deepEqual(users, ['src/seasonal/SeasonProvider.tsx', 'src/seasonal/christmas/home/ChristmasHome.tsx', 'src/seasonal/christmas/kit/GreetingsPreview.tsx', 'src/seasonal/christmas/member/ChristmasMemberHome.tsx', 'src/seasonal/christmas/member/ChristmasMemberView.tsx']);
});
