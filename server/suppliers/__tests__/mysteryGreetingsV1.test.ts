import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { personalText, greetingInput, CREATOR_TOKEN } from '../../services/experienceValidation.js';
import { GREETING_TEMPLATES } from '../../../shared/mysteryExperiences.js';
import { greetingCreateLink } from '../../../shared/seasonal.js';
import {
  LIMITS, checkText, cleanText, canonicalGreetingUrl, contentFingerprint, createContent, defaultOccasion, draftMessage, draftProblems, emptyDraft, nameScale, type Draft,
} from '../../../src/greetings/model.js';
import { createGreetingsStore, memoryStorage, newCreatorToken, DRAFT_TTL, PARENT_TTL, type KeyValue } from '../../../src/greetings/storage.js';
import { whatsappHref, shareNatively, copyLink, canShareNatively, shareText } from '../../../src/greetings/share.js';
import { countdownParts, deadlineFrom, nextTick, remainingAt, COUNTDOWN_OVER_AFTER } from '../../../src/greetings/countdown.js';
import { classify, createGreeting, fetchGreeting, readGreeting, revokeGreeting, reportGreeting } from '../../../src/greetings/api.js';
import { GreetingStage, sparkLayout } from '../../../src/greetings/GreetingStage.js';
import { RecipientPage, shareIdFromPath } from '../../../src/greetings/RecipientPage.js';
import { analyticsAllowed } from '../../../src/greetings/analytics.js';
import { greetingIdFrom } from '../../../src/components/admin/sections/AdminGreetingsPanel.js';
import { resolvePublicSocialMetadata } from '../../services/publicSocialMetadata.js';
import { GREETINGS_SHARE_IMAGE } from '../../../src/utils/socialMetadata.js';
import { seasonalRouter } from '../../routes/seasonalApi.js';
import { ExperienceService, resetGreetingCreationAvailability } from '../../services/experienceService.js';
import { ExperienceStore } from '../../db/experienceStore.js';
import { reportOutcome } from '../../../src/greetings/ReportDialog.js';
import { removeOutcome } from '../../../src/greetings/CreatorPage.js';

/* Mystery Greetings V1 (creator /greetings, recipient /g/:id): the browser side of the PR #104 contract. */

const read = (file: string) => readFileSync(file, 'utf8');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const ID = 'AbCdEfGhIjKlMnOpQrStUv_-';
const templates = GREETING_TEMPLATES.map(t => ({ ...t }));
const serverAccepts = (value: string, max: number, min = 1) => { try { return personalText(value, max, min); } catch { return null; } };

test('text rules: the browser mirror agrees with the server on every sample, after cleaning invisible characters', () => {
  const samples = ['Ama', '  Ama  ', 'Nana Akosua Serwaa', 'Ɛfua', 'Ama Ɔboɔ', 'Adɛkyɛ', 'Kwame Nkrumah', "D'Souza", 'Nii-Armah', 'Ama 😀', '❤️ Esi', 'Kofi 👋🏾',
    'family 👨‍👩‍👧', 'Ama​', 'Ama‎', '﻿Ama', 'Tab\there', 'Line\r\nbreak', '<b>Ama</b>', 'a > b', 'visit www.example.com', 'http://x.y', 'javascript:alert(1)',
    'my data: plan', 'MAILTO:x', '', '   ', '12', '!!!', '😀', 'ésther', 'x'.repeat(60), 'x'.repeat(61), '😀'.repeat(60), '😀'.repeat(61), 'Line one\n\nLine two'];
  for (const sample of samples) for (const [max, min] of [[LIMITS.name, 1], [LIMITS.message, LIMITS.messageMin]] as const) {
    const mine = checkText(sample, max, min), theirs = serverAccepts(cleanText(sample).text, max, min);
    assert.equal(mine.ok, theirs !== null, `${JSON.stringify(sample)} max ${max}`);
    if (theirs !== null) assert.equal(mine.text, theirs, JSON.stringify(sample));
  }
  // Emoji count as one character each, as on the server (code points), not as two UTF-16 units.
  assert.equal(checkText('A' + '😀'.repeat(59), LIMITS.name).ok, true);
  assert.equal(checkText('A' + '😀'.repeat(60), LIMITS.name).problem, 'long');
  assert.equal(checkText('😀'.repeat(3), LIMITS.name).problem, 'letters', 'like the server, a name needs a letter or number');
  assert.equal(checkText('family 👨‍👩‍👧', LIMITS.name).text, 'family 👨👩👧');
  assert.equal(cleanText('family 👨‍👩‍👧').split, true);
  assert.equal(checkText('Line one\n\nLine two', 600, 4).text, 'Line one\n\nLine two', 'line breaks are kept');
  assert.equal(checkText('a > b', 60).problem, 'markup');
  assert.equal(checkText('see https://x.y', 600, 4).problem, 'link');
  assert.equal(checkText('!!!', 60).problem, 'letters');
  assert.equal(checkText('hi', 600, 4).problem, 'short');
});

test('Ghanaian letters: names such as Ɛfua or Ɔsei get matching serif glyphs; each occasion opens on its own default design', () => {
  // Fraunces lacks these letters; a Noto Serif Display subset of exactly them follows it in the serif stack.
  const chrome = read('src/greetings/chrome.tsx'), css = read('src/greetings/greetings.css');
  assert.match(chrome, /GHANAIAN_LETTERS = 'ƐɛƆɔƉɖƑƔɣƲʋƷʒ'/);
  assert.match(chrome, /family=Noto\+Serif\+Display:ital,wght@1,500;1,600&text=\$\{encodeURIComponent\(GHANAIAN_LETTERS\)\}/);
  assert.match(css, /--mg-serif: 'Fraunces', 'Noto Serif Display', Georgia/);
  assert.match(css, /--mg-sans: 'Plus Jakarta Sans', 'Noto Sans',/);
  assert.equal(emptyDraft('christmas-2026').variant, 'gift-classic-v1');
  assert.equal(emptyDraft('new-year-2027').variant, 'gift-starlight-v1');
});

test('the occasion: an explicit choice wins, otherwise the real Accra date (never a founder preview)', () => {
  assert.equal(defaultOccasion('new-year-2027', new Date('2026-12-01T10:00:00Z')), 'new-year-2027');
  assert.equal(defaultOccasion('christmas-2026', new Date('2027-01-02T10:00:00Z')), 'christmas-2026');
  assert.equal(defaultOccasion('easter', new Date('2026-12-26T23:59:59Z')), 'christmas-2026');
  assert.equal(defaultOccasion(null, new Date('2026-12-27T00:00:00Z')), 'new-year-2027');
  assert.equal(defaultOccasion(undefined, new Date('2026-11-14T08:00:00Z')), 'christmas-2026');
  for (const file of ['src/greetings/model.ts', 'src/greetings/CreatorPage.tsx', 'src/greetings/RecipientPage.tsx']) assert.doesNotMatch(read(file), /season-preview|previewSeason|parsePreviewDate|SeasonProvider/, file);
});

test('the create body is exactly the server contract: template or message, sender only when shown', () => {
  const base: Draft = { ...emptyDraft('christmas-2026'), recipientName: '  Ama ', senderName: 'Kofi', mode: 'template', templateId: 'christmas-warm-v1' };
  const cases: [Draft, Record<string, unknown>][] = [
    [base, { occasion: 'christmas-2026', recipientName: 'Ama', senderName: 'Kofi', showSender: true, templateId: 'christmas-warm-v1', variant: 'gift-classic-v1' }],
    [{ ...base, showSender: false }, { occasion: 'christmas-2026', recipientName: 'Ama', showSender: false, templateId: 'christmas-warm-v1', variant: 'gift-classic-v1' }],
    [{ ...base, senderName: '   ' }, { occasion: 'christmas-2026', recipientName: 'Ama', showSender: false, templateId: 'christmas-warm-v1', variant: 'gift-classic-v1' }],
    [{ ...base, mode: 'custom', message: ' Afehyia pa!\nMay 2027 be kind to you. ', occasion: 'new-year-2027', variant: 'gift-starlight-v1' },
      { occasion: 'new-year-2027', recipientName: 'Ama', senderName: 'Kofi', showSender: true, message: 'Afehyia pa!\nMay 2027 be kind to you.', variant: 'gift-starlight-v1' }],
  ];
  for (const [draft, expected] of cases) {
    const content = createContent(draft);
    assert.deepEqual(content, expected);
    // The real server validation accepts it as sent (the secret and key are generated by the browser).
    const parsed = greetingInput({ ...content, creatorToken: newCreatorToken(), idempotencyKey: crypto.randomUUID() });
    assert.equal(parsed.value.recipientName, 'Ama');
    assert.equal(parsed.value.senderName, draft.showSender && draft.senderName.trim() ? 'Kofi' : null, 'a hidden sender is never stored');
  }
  assert.notEqual(contentFingerprint(createContent(base)), contentFingerprint(createContent({ ...base, recipientName: 'Esi' })));
  assert.equal(contentFingerprint(createContent(base)), contentFingerprint(createContent({ ...base })));
  assert.equal(draftMessage(base, templates), templates.find(t => t.id === 'christmas-warm-v1')!.message);
  // Ghanaian greetings come through the same authoritative catalogue the server validates and serves.
  for (const id of ['christmas-afehyia-v1', 'newyear-afehyia-v1']) {
    const t = templates.find(x => x.id === id)!;
    assert.match(t.message, /^Afehyia pa!/);
    assert.equal(greetingInput({ occasion: t.occasion, recipientName: 'Ama', showSender: false, templateId: id, variant: 'gift-classic-v1', creatorToken: newCreatorToken(), idempotencyKey: crypto.randomUUID() }).value.message, t.message);
  }
});

test('message step problems: specific, kind, and a template must belong to the occasion', () => {
  const draft = emptyDraft('new-year-2027');
  assert.deepEqual(Object.keys(draftProblems(draft, templates)).sort(), ['message', 'recipient']);
  assert.match(draftProblems(draft, templates).recipient!, /name of the person/);
  assert.match(draftProblems({ ...draft, recipientName: 'Ama', templateId: 'christmas-warm-v1' }, templates).message!, /Pick a message/);
  assert.deepEqual(draftProblems({ ...draft, recipientName: 'Ama', templateId: 'newyear-hope-v1' }, templates), {});
  assert.match(draftProblems({ ...draft, recipientName: 'Ama', mode: 'custom', message: 'x'.repeat(601) }, templates).message!, /600 characters/);
  assert.match(draftProblems({ ...draft, recipientName: 'Ama', templateId: 'newyear-hope-v1', senderName: '<Kofi>' }, templates).sender!, /< and >/);
  assert.deepEqual(draftProblems({ ...draft, recipientName: 'Ama', templateId: 'newyear-hope-v1', senderName: '' }, templates), {}, 'an empty name simply stays a mystery');
});

test('only a canonical link from the server is ever shown or shared', () => {
  assert.equal(canonicalGreetingUrl(`https://mysterybundlehub.com/g/${ID}`, ID), `https://mysterybundlehub.com/g/${ID}`);
  for (const [url, id] of [[`http://mysterybundlehub.com/g/${ID}`, ID], [`https://evil.example/g/${ID}`, ID], [`https://mysterybundlehub.com/g/${ID}?t=x`, ID], [`https://mysterybundlehub.com/g/${ID}`, 'short'], [null, ID]] as const)
    assert.equal(canonicalGreetingUrl(url, id), null, String(url));
  assert.deepEqual(['Ama', 'Nana Akosua Ab', 'Nana Akosua Serwaa Boatemaa', 'x'.repeat(40)].map(nameScale), ['lg', 'md', 'sm', 'xs']);
});

test('browser storage: a 43-character secret per browser, sent-list without messages, short-lived drafts, one-time parent', () => {
  const token = newCreatorToken();
  assert.match(token, CREATOR_TOKEN);
  const local = memoryStorage(), session = memoryStorage();
  const a = createGreetingsStore(local, session), b = createGreetingsStore(local, memoryStorage());
  assert.equal(a.persistence, 'device');
  assert.equal(a.creatorToken(), b.creatorToken(), 'the same browser keeps one secret');
  local.setItem('mh_greetings_creator_v1', JSON.stringify({ token: 'tampered' }));
  assert.match(createGreetingsStore(local, session).creatorToken(), CREATOR_TOKEN, 'a damaged secret is replaced, never sent');
  assert.equal(createGreetingsStore(null, session).persistence, 'tab');
  assert.equal(createGreetingsStore(null, null).persistence, 'page');

  const now = Date.now();
  a.remember({ shareId: ID, occasion: 'christmas-2026', recipientName: 'Ama', createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 86400_000).toISOString() });
  a.remember({ shareId: 'X'.repeat(24), occasion: 'christmas-2026', recipientName: 'Old', createdAt: '2025-01-01T00:00:00Z', expiresAt: '2025-12-01T00:00:00Z' });
  assert.deepEqual(a.sent().map(e => e.shareId), [ID], 'expired entries are dropped');
  a.markRemoved(ID); assert.equal(a.sent()[0].removed, true);
  a.forget(ID); assert.deepEqual(a.sent(), []);
  local.setItem('mh_greetings_sent_v1', JSON.stringify([{ shareId: '../../evil', occasion: 'christmas-2026', recipientName: 'x', createdAt: 'x', expiresAt: '2099-01-01' }, 'junk']));
  assert.deepEqual(a.sent(), [], 'malformed entries never reach the page');

  const draft = { ...emptyDraft('christmas-2026'), recipientName: 'Ama', message: 'Private words' };
  a.saveDraft({ draft, stage: 'preview', pending: { key: crypto.randomUUID(), fingerprint: 'f', startedAt: now } }, now);
  assert.equal(a.loadDraft(now + 1000)?.stage, 'preview');
  assert.equal(a.loadDraft(now + DRAFT_TTL + 1), null, 'drafts expire after two hours');
  a.saveDraft({ draft, stage: 'message', pending: { key: 'not-a-uuid', fingerprint: 'f', startedAt: now } }, now);
  assert.equal(a.loadDraft(now)?.pending, null);
  for (const value of [...[local, session]].flatMap(s => ['mh_greetings_sent_v1', 'mh_greetings_draft_v1', 'mh_greetings_last_v1'].map(k => s.getItem(k) || '')))
    assert.ok(!value.includes(a.creatorToken()), 'the secret is stored only under its own key');
  a.clearDraft(); assert.equal(a.loadDraft(now), null);

  session.setItem('mh_greetings_parent_v1', JSON.stringify({ shareId: ID, occasion: 'new-year-2027', at: now }));
  assert.deepEqual(a.takeParent(now + 1000), { shareId: ID, occasion: 'new-year-2027' });
  assert.equal(a.takeParent(now + 1000), null, 'read once');
  session.setItem('mh_greetings_parent_v1', JSON.stringify({ shareId: ID, occasion: 'new-year-2027', at: now }));
  assert.equal(a.takeParent(now + PARENT_TTL + 1), null, 'stale context is ignored');
  a.saveLast({ shareId: ID, url: `https://evil.example/g/${ID}`, occasion: 'christmas-2026', variant: 'gift-classic-v1', recipientName: 'Ama', expiresAt: 'x', savedAt: now });
  assert.equal(a.loadLast(now), null, 'only the canonical link is restored');
});

test('sharing: the WhatsApp teaser carries the link only, encoded; cancelled shares are never reported as sent', async () => {
  const url = `https://mysterybundlehub.com/g/${ID}`;
  const href = whatsappHref('christmas-2026', url);
  assert.match(href, /^https:\/\/wa\.me\/\?text=/);
  const decoded = decodeURIComponent(href.slice('https://wa.me/?text='.length));
  assert.equal(decoded, `${shareText('christmas-2026')} ${url}`);
  assert.doesNotMatch(href, /[ #&]/, 'fully encoded');
  assert.doesNotMatch(code(read('src/greetings/share.ts')), /message|recipientName|senderName|creatorToken/, 'the share text never reads personal fields');
  const nav = (share?: (d: ShareData) => Promise<void>, canShare?: (d: ShareData) => boolean) => ({ share, canShare }) as unknown as Navigator;
  assert.equal(await shareNatively('christmas-2026', url, nav(async () => {})), 'opened');
  assert.equal(await shareNatively('christmas-2026', url, nav(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); })), 'cancelled');
  assert.equal(await shareNatively('christmas-2026', url, nav(async () => { throw Object.assign(new Error('x'), { name: 'NotAllowedError' }); })), 'unsupported');
  assert.equal(await shareNatively('christmas-2026', url, nav()), 'unsupported');
  assert.equal(canShareNatively(nav(async () => {}, () => false), url), false);
  const doc = (ok: boolean) => ({ createElement: () => ({ value: '', style: {}, setAttribute() {}, select() {}, setSelectionRange() {}, remove() {} }), body: { appendChild() {} }, execCommand: () => ok }) as unknown as Document;
  assert.equal(await copyLink(url, doc(false), { clipboard: { writeText: async () => {} } } as unknown as Navigator), 'copied');
  assert.equal(await copyLink(url, doc(true), { clipboard: { writeText: async () => { throw new Error('denied'); } } } as unknown as Navigator), 'copied');
  assert.equal(await copyLink(url, doc(false), {} as Navigator), 'blocked');
  // The page only ever claims a copy it could verify, and has no "sent"/"delivered" wording.
  const page = read('src/greetings/CreatorPage.tsx');
  assert.doesNotMatch(page, /\b(Sent!|Delivered|was sent|has been sent|Shared!)\b/);
  assert.doesNotMatch(page, /window\.open\(|location\.(href|assign)\s*=?\s*\(?\s*whatsapp/i, 'WhatsApp is only ever a link the creator taps');
});

test('countdown: server time anchored to a monotonic clock, whole-second ticks, stops at zero, no drift', () => {
  assert.equal(deadlineFrom(10_000, 1_000, 1_400), 11_200, 'anchored at the midpoint of the request');
  assert.equal(remainingAt(5_000, 9_000), 0);
  assert.deepEqual(countdownParts(47 * 86400_000 + 22 * 3600_000 + 59 * 60_000 + 30_500), { days: 47, hours: 22, minutes: 59, seconds: 31, done: false });
  assert.equal(countdownParts(0).done, true);
  assert.equal(nextTick(0), null);
  for (const ms of [1, 999, 1000, 1001, 59_999, 86_400_000]) assert.ok(nextTick(ms)! > 0 && nextTick(ms)! <= 1000, String(ms));
  // Simulated run with late timers: the display always equals the true remaining time and ends at zero.
  let now = 0; const deadline = deadlineFrom(5_250, 0, 0); let shown = countdownParts(remainingAt(deadline, now)).seconds, ticks = 0;
  while (true) { const left = remainingAt(deadline, now); const delay = nextTick(left); if (delay === null) break; now += delay + 5 + (ticks % 3) * 7; ticks++; const parts = countdownParts(remainingAt(deadline, now)); assert.equal(parts.seconds, Math.ceil(remainingAt(deadline, now) / 1000)); shown = parts.seconds; }
  assert.equal(shown, 0); assert.ok(ticks <= 7);
  assert.equal(COUNTDOWN_OVER_AFTER, Date.parse('2027-01-08T00:00:00Z'));
});

test('API client: honest states, malformed successes rejected, secret only in the Authorization header', async () => {
  assert.deepEqual([classify(0, null), classify(404, 'GREETING_UNAVAILABLE'), classify(429, 'RATE_LIMITED'), classify(409, 'DUPLICATE_CONTENT'), classify(409, 'IDEMPOTENCY_CONFLICT'), classify(400, 'INVALID_PARENT'), classify(400, 'INVALID_TEXT'), classify(413, null), classify(503, 'CREATION_DISABLED')],
    ['offline', 'unavailable', 'busy', 'duplicate', 'conflict', 'parent', 'invalid', 'invalid', 'paused']);
  const good = { schemaVersion: 1, shareId: ID, occasion: 'christmas-2026', recipientName: 'Ama', senderName: null, message: 'Hi there', variant: 'gift-classic-v1', expiresAt: '2027-11-14T00:00:00.000Z' };
  assert.deepEqual(readGreeting(good), good);
  for (const bad of [{ ...good, schemaVersion: 2 }, { ...good, shareId: 'x' }, { ...good, occasion: 'easter-2027' }, { ...good, variant: 'gift-gold-v9' }, { ...good, message: 42 }, null]) assert.equal(readGreeting(bad), null);
  const original = globalThis.fetch;
  const seen: { url: string; init: RequestInit }[] = [];
  const reply = (status: number, body: unknown) => async (url: string, init: RequestInit) => { seen.push({ url, init }); return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); };
  try {
    globalThis.fetch = reply(200, good) as typeof fetch;
    const ok = await fetchGreeting(ID); assert.equal(ok.ok, true);
    assert.equal(seen[0].init.credentials, 'omit'); assert.equal(seen[0].init.referrerPolicy, 'no-referrer'); assert.equal(seen[0].init.cache, 'no-store');
    globalThis.fetch = reply(200, { ...good, schemaVersion: 9 }) as typeof fetch; assert.equal((await fetchGreeting(ID)).ok, false);
    globalThis.fetch = reply(404, { error: { code: 'GREETING_UNAVAILABLE' } }) as typeof fetch; const missing = await fetchGreeting(ID); assert.ok(!missing.ok && missing.failure === 'unavailable');
    globalThis.fetch = (async () => { throw new TypeError('offline'); }) as typeof fetch; const offline = await fetchGreeting(ID); assert.ok(!offline.ok && offline.failure === 'offline');
    // A success whose link is not canonical is not a success.
    globalThis.fetch = reply(201, { schemaVersion: 1, shareId: ID, url: `https://evil.example/g/${ID}`, expiresAt: 'x', duplicate: false }) as typeof fetch;
    assert.equal((await createGreeting(createContent({ ...emptyDraft('christmas-2026'), recipientName: 'Ama', templateId: 'christmas-warm-v1' }), newCreatorToken(), crypto.randomUUID(), null)).ok, false);
    seen.length = 0;
    const secret = newCreatorToken();
    globalThis.fetch = reply(200, { revoked: true }) as typeof fetch;
    assert.equal((await revokeGreeting(ID, secret)).ok, true);
    assert.ok(!seen[0].url.includes(secret)); assert.equal(seen[0].init.body, '{}');
    assert.equal((seen[0].init.headers as Record<string, string>).Authorization, `Greeting ${secret}`);
    globalThis.fetch = reply(200, { accepted: true }) as typeof fetch;
    assert.equal((await reportGreeting(ID, 'spam')).ok, true); assert.equal(seen[1].init.body, '{"reason":"spam"}');
  } finally { globalThis.fetch = original; }
  // The creator secret is used in exactly two places: the create body and the remove header.
  const page = read('src/greetings/CreatorPage.tsx');
  assert.equal((page.match(/creatorToken\(\)/g) || []).length, 2);
  assert.doesNotMatch(code(read('src/greetings/analytics.ts')), /from '\.\/storage'|creatorToken|\.message\b|recipientName|senderName/, 'events carry no personal content');
});

test('analytics: off with Do Not Track, Global Privacy Control, Admin and preview paths', () => {
  assert.equal(analyticsAllowed({ doNotTrack: null }, { pathname: `/g/${ID}`, search: '' }), true);
  assert.equal(analyticsAllowed({ doNotTrack: '1' }, { pathname: `/g/${ID}`, search: '' }), false);
  assert.equal(analyticsAllowed({ doNotTrack: null, globalPrivacyControl: true }, { pathname: '/greetings', search: '' }), false);
  assert.equal(analyticsAllowed({ doNotTrack: null }, { pathname: '/admin', search: '' }), false);
});

test('the recipient page: sealed first, real text only after opening, every failure calm and private', () => {
  const greeting = { occasion: 'christmas-2026' as const, variant: 'gift-classic-v1' as const, recipientName: '<img src=x onerror=alert(1)>', senderName: null, message: 'First line\nSecond line' };
  const html = renderToStaticMarkup(React.createElement(GreetingStage, { greeting }));
  assert.match(html, /data-state="sealed"/);
  assert.match(text(html), /A Christmas gift for <img src=x onerror=alert\(1\)> From a mystery sender Open your gift/);
  assert.doesNotMatch(html, /<img src=x/, 'names are text, never markup');
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /<article class="mg-letter" aria-hidden="true">/, 'the letter waits, hidden, until the gift is opened');
  assert.ok(html.includes('First line\nSecond line'), 'line breaks reach the page as text (shown with pre-line)');
  const ny = text(renderToStaticMarkup(React.createElement(GreetingStage, { greeting: { ...greeting, occasion: 'new-year-2027', recipientName: 'Esi', senderName: 'Kwame' } })));
  assert.match(ny, /A New Year surprise for Esi From Kwame Open your surprise .*Happy New Year, Esi/);
  assert.equal(sparkLayout('new-year-2027', 'gift-starlight-v1').length, 18);
  assert.equal(sparkLayout('christmas-2026', 'gift-classic-v1').length, 12);
  // Malformed links are refused before any request and say nothing about any greeting.
  assert.equal(shareIdFromPath(`/g/${ID}`), ID);
  for (const p of ['/g', '/g/', '/g/short', `/g/${ID}x`, `/g/${ID}/extra`, `/G/${ID}`, `/g/${ID.slice(0, 23)}%`]) assert.equal(shareIdFromPath(p), '', p);
  const malformed = text(renderToStaticMarkup(React.createElement(RecipientPage, { path: '/g/not-a-real-link' })));
  assert.match(malformed, /This link looks incomplete.*Ask the person who sent it to share it again\..*Visit Mystery Hub/);
  assert.doesNotMatch(malformed, /Create a greeting/, 'the creator is offered only once the server says creation is open');
  assert.doesNotMatch(malformed, /not-a-real-link/);
  for (const file of readdirSync('src/greetings').map(f => path.join('src/greetings', f)).filter(f => statSync(f).isFile()))
    assert.doesNotMatch(read(file), /dangerouslySetInnerHTML|\.innerHTML\s*=|insertAdjacentHTML/, file);
});

test('routing: /g and /greetings get their own small surfaces, mirroring the server head rules', async () => {
  const main = read('src/main.tsx');
  assert.match(main, /const greetingPath = \/\^\\\/g\(\?:\\\/\|\$\)\/i\.test\(window\.location\.pathname\);/);
  assert.match(main, /const creatorPath = \/\^\\\/greetings\\\/\?\$\/i\.test\(window\.location\.pathname\);/, 'same case rule as the server head');
  assert.match(main, /import\('\.\/greetings\/greetings\.css'\)/, 'the greetings styles load only with these pages');
  const creator = await resolvePublicSocialMetadata('/greetings?occasion=new-year-2027');
  assert.equal(creator.status, 200);
  assert.equal(creator.head.url, 'https://mysterybundlehub.com/greetings');
  assert.equal(creator.head.image, GREETINGS_SHARE_IMAGE.image);
  assert.equal(creator.head.noindex, true);
  const found = await resolvePublicSocialMetadata(`/g/${ID}`, { product: async () => null, site: async () => null, greeting: async () => true });
  assert.equal(found.status, 200); assert.equal(found.head.image, 'https://mysterybundlehub.com/og/mystery-greetings-v1.jpg');
  assert.equal(found.head.title, '🎁 A special surprise is waiting for you.'); assert.equal(found.head.noindex, true);
  const missing = await resolvePublicSocialMetadata(`/g/${ID}`, { product: async () => null, site: async () => null, greeting: async () => false });
  assert.equal(missing.status, 404); assert.equal(missing.head.image, '');
  // Published business websites keep their own route.
  assert.equal((await resolvePublicSocialMetadata('/sites/greetings', { product: async () => null, site: async () => null })).status, 404);
});

test('the link-preview card is a fixed 1200x630 JPEG served from this site, small enough for WhatsApp', () => {
  const file = readFileSync('public/og/mystery-greetings-v1.jpg');
  assert.ok(file.length < 300_000, `${file.length} bytes`);
  assert.equal(file.readUInt16BE(0), 0xffd8);
  let offset = 2, size: [number, number] | null = null;
  while (offset < file.length) { const marker = file.readUInt16BE(offset); const length = file.readUInt16BE(offset + 2); if (marker >= 0xffc0 && marker <= 0xffc2) { size = [file.readUInt16BE(offset + 7), file.readUInt16BE(offset + 5)]; break; } offset += 2 + length; }
  assert.deepEqual(size, [1200, 630]);
});

test('homepage entries: closed until both gates are on, the abuse secret is set and storage can take a greeting, then one creator link on the page occasion', async () => {
  const keys = ['MYSTERY_GREETING_LINKS_ENABLED', 'MYSTERY_GREETINGS_ENABLED', 'EXPERIENCES_ABUSE_SECRET'] as const;
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const app = express(); app.use('/api/seasonal', seasonalRouter);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const status = async () => (await (await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/seasonal/status`)).json()).greetings;
  // 3.6.1: the creator is advertised only when a greeting would really be accepted. Storage is stubbed here (the native
  // PostgreSQL suite checks the real schema); every read of it is counted, so the gates-off path is shown to skip it.
  const originalReadiness = ExperienceStore.readiness;
  let storage: { installed: boolean; retentionDue: boolean | null } | 'error' = { installed: true, retentionDue: false }, storageReads = 0;
  (ExperienceStore as any).readiness = async () => { storageReads++; if (storage === 'error') throw new Error('unreachable'); return { ...storage, lastMaintenance: null }; };
  try {
    const secret = 'ab'.repeat(32);
    for (const [links, creation, key, expected] of [[undefined, undefined, secret, null], ['true', undefined, secret, null], [undefined, 'true', secret, null], ['true', 'true', undefined, null], ['true', 'true', 'not-hex', null], ['true', 'true', secret, '/greetings']] as const) {
      if (links) process.env.MYSTERY_GREETING_LINKS_ENABLED = links; else delete process.env.MYSTERY_GREETING_LINKS_ENABLED;
      if (creation) process.env.MYSTERY_GREETINGS_ENABLED = creation; else delete process.env.MYSTERY_GREETINGS_ENABLED;
      if (key) process.env.EXPERIENCES_ABUSE_SECRET = key; else delete process.env.EXPERIENCES_ABUSE_SECRET;
      resetGreetingCreationAvailability(); const reads = storageReads;
      assert.deepEqual(await status(), { createPath: expected }, `${links}/${creation}/${key}`);
      assert.equal((await ExperienceService.templates()).creationConfigured, expected !== null, 'the creator page agrees');
      if (expected === null) assert.equal(storageReads, reads, 'switched off: answered without touching the database');
    }
    // Switched on, but storage cannot take a greeting: missing schema, overdue retention (creates are refused), unreadable.
    for (const [state, label] of [[{ installed: false, retentionDue: null }, 'schema missing'], [{ installed: true, retentionDue: true }, 'retention overdue'], ['error', 'storage unreadable']] as const) {
      storage = state; resetGreetingCreationAvailability();
      assert.deepEqual(await status(), { createPath: null }, label);
      assert.equal((await ExperienceService.templates()).creationConfigured, false, `${label}: the creator page agrees`);
    }
    // One check is shared for a minute: repeated homepage loads do not each read the database.
    storage = { installed: true, retentionDue: false }; resetGreetingCreationAvailability();
    const before = storageReads;
    await Promise.all([status(), status(), status(), ExperienceService.templates()]);
    assert.deepEqual(await status(), { createPath: '/greetings' });
    assert.equal(storageReads - before, 1, 'one shared storage check');
  } finally {
    (ExperienceStore as any).readiness = originalReadiness; resetGreetingCreationAvailability();
    await new Promise<void>(r => server.close(() => r())); for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
  assert.equal(greetingCreateLink('/greetings', false), '/greetings?occasion=christmas-2026');
  assert.equal(greetingCreateLink('/greetings', true), '/greetings?occasion=new-year-2027');
});

test('report and removal never claim success the server did not confirm', () => {
  const fail = (failure: string, status: number, code: string | null) => ({ ok: false as const, failure: failure as never, status, code });
  assert.equal(reportOutcome({ ok: true, status: 200, data: { accepted: true } }), 'sent');
  for (const [failure, status, code] of [['busy', 429, 'BUSY'], ['busy', 429, 'RATE_LIMITED'], ['busy', 429, null]] as const) assert.equal(reportOutcome(fail(failure, status, code)), 'busy', 'a limit is not a thank-you');
  assert.equal(reportOutcome(fail('offline', 0, null)), 'offline');
  assert.equal(reportOutcome(fail('paused', 503, 'EXPERIENCE_UNAVAILABLE')), 'unavailable');
  assert.equal(removeOutcome({ ok: true, status: 200, data: { revoked: true } }), 'removed');
  assert.equal(removeOutcome(fail('unavailable', 404, 'GREETING_UNAVAILABLE')), 'not-yours', 'a wrong secret looks like not found, and is never "Removed"');
  assert.equal(removeOutcome(fail('offline', 0, null)), 'offline');
});

test('Admin: a pasted link or ID resolves to one greeting on this site only', () => {
  assert.equal(greetingIdFrom(ID), ID);
  assert.equal(greetingIdFrom(` https://mysterybundlehub.com/g/${ID} `), ID);
  assert.equal(greetingIdFrom(`https://www.mysterybundlehub.com/g/${ID}?utm_source=x`), ID);
  assert.equal(greetingIdFrom(`/g/${ID}`), ID);
  for (const bad of [`https://evil.example/g/${ID}`, `https://mysterybundlehub.com/sites/${ID}`, 'hello', `${ID}x`]) assert.equal(greetingIdFrom(bad), null, bad);
  const panel = read('src/components/admin/sections/AdminGreetingsPanel.tsx');
  assert.match(panel, /confirmed: true/);
  assert.doesNotMatch(panel, /\/configuration|MYSTERY_GREETINGS_ENABLED=|setEnv/, 'the panel never switches anything on');
  assert.match(read('src/components/admin/sections/AdminSystemSection.tsx'), /<AdminSeasonalPanel \/>\n\s*<AdminGreetingsPanel sessionToken=\{sessionToken\} \/>/);
});
