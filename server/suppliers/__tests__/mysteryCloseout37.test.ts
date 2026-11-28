import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { COUNTDOWN_SHARE_AFTER, COUNTDOWN_SHARE_BEFORE, COUNTDOWN_URL, countdownShareText, countdownWhatsappHref, shareCountdown } from '../../../src/countdown/share.js';
import { countdownHead } from '../../../src/utils/socialMetadata.js';
import { createCountdownSound, moodFor, tickNote, TICK_NOTES } from '../../../src/countdown/sound.js';
import { SCALE, seeded, startScore } from '../../../src/countdown/score.js';
import { combinedWelcomeFigure, welcomeCombinedLikely, welcomeFigure, WELCOME_HEADLINE_CEILING } from '../../../src/utils/welcomeAdvert.js';
import { WelcomeAdvert } from '../../../src/components/offers/WelcomeAdvert.js';
import { WelcomeCard } from '../../../src/seasonal/christmas/kit/WelcomeCard.js';
import { COUNTDOWN_SERIF_HREF, SEASONAL_SERIF_HREF } from '../../../src/seasonal/christmas/font.js';
import { DIRECT_RETAIL_MINOR } from '../../../shared/directPricing.js';
import { DECEMBER_2026_APPROVED_PLAN, campaignHeadlinePercent } from '../../../shared/directCampaign.js';
import { AFA_APPROVED } from '../../../shared/afaPricing.js';

/* Mystery Hub 3.7 closeout: the founder's ten refinements (docs/mystery-hub-3-7-closeout.md). */

const read = (file: string) => readFileSync(file, 'utf8');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/* ───────── 1. The member welcome line ───────── */

test('member welcome: the short line stays in the ordinary and the seasonal member homepages', () => {
  for (const file of ['src/components/home/MemberHomeView.tsx', 'src/seasonal/christmas/member/ChristmasMemberView.tsx']) {
    assert.match(read(file), /'Welcome! Let’s get you connected\.'/, file);
    assert.doesNotMatch(read(file), /Welcome to Mystery Hub\. Let’s get you connected/, file);
  }
});

/* ───────── 2. Countdown sharing ───────── */

test('sharing: warm words, the canonical link once, native sharing never repeats the link', async () => {
  assert.equal(countdownShareText(false), 'Counting down to 2027 with Mystery Hub! ✨\nAnother year, another chance to make beautiful memories. Let’s welcome 2027 together! 🥂💚');
  assert.equal(countdownShareText(true), 'Happy New Year! 🎉\nMay 2027 bring you happiness, peace, new opportunities and countless reasons to smile.\nHere’s to another beautiful year together. Afehyia pa! 💚');
  for (const after of [false, true]) {
    assert.doesNotMatch(countdownShareText(after), /https?:|mysterybundlehub/, 'the link is never inside the native-share text');
    const message = decodeURIComponent(countdownWhatsappHref(after).replace('https://wa.me/?text=', ''));
    assert.equal(message, `${countdownShareText(after)}\n${COUNTDOWN_URL}`);
    assert.equal(message.split(COUNTDOWN_URL).length - 1, 1, 'one link');
    assert.doesNotMatch(message, /utm_|ref=|\bid=/);
    let shared: ShareData | null = null;
    const nav = { share: async (d: ShareData) => { shared = d; }, canShare: () => true } as unknown as Navigator;
    assert.equal(await shareCountdown(after, nav), 'opened');
    assert.equal(shared!.url, COUNTDOWN_URL);
    assert.equal(shared!.text, countdownShareText(after));
  }
  assert.ok(COUNTDOWN_SHARE_BEFORE && COUNTDOWN_SHARE_AFTER);
});

test('sharing: the link preview says the same, before and after midnight, without emoji', () => {
  const before = countdownHead(new Date('2026-12-20T12:00:00Z')), after = countdownHead(new Date('2027-01-01T00:00:01Z'));
  assert.match(before.description, /Another year, another chance to make beautiful memories/);
  assert.match(before.description, /welcome 2027 together/);
  assert.match(after.description, /May 2027 bring you happiness, peace, new opportunities and countless reasons to smile\. Afehyia pa!/);
  for (const head of [before, after]) {
    assert.equal(head.url, COUNTDOWN_URL);
    assert.doesNotMatch(`${head.title} ${head.description}`, /\p{Extended_Pictographic}/u);
  }
  assert.doesNotMatch(read('src/countdown/share.ts'), /Join me for midnight in Accra/);
});

/* ───────── 3. Countdown sound ───────── */

/** A Web Audio stand-in that records what is created and scheduled. */
function fakeAudio(state: { contexts: number; oscillators: number; starts: number[]; resumeTo?: string }, startState = 'running') {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ connect(next: unknown) { return next ?? {}; }, disconnect() {} });
  return class FakeContext {
    state = 'suspended'; currentTime = 0; sampleRate = 8000; destination = node();
    constructor() { state.contexts++; }
    createGain() { return { ...node(), gain: param() }; }
    createOscillator() { state.oscillators++; return { ...node(), type: '', frequency: param(), detune: param(), start: (t: number) => { state.starts.push(t); }, stop() {} }; }
    createBiquadFilter() { return { ...node(), type: '', Q: param(), frequency: param() }; }
    createConvolver() { return { ...node(), buffer: null }; }
    createDynamicsCompressor() { return { ...node(), threshold: param(), ratio: param(), attack: param(), release: param() }; }
    createBuffer(channels: number, length: number) { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { getChannelData: (c: number) => data[c] }; }
    resume() { this.state = state.resumeTo ?? startState; return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  };
}

test('sound: nothing is created or loaded before the tap; the music loads only when sound is on and wanted', async () => {
  const state = { contexts: 0, oscillators: 0, starts: [] as number[] };
  let loads = 0;
  let started: unknown = null;
  const loader = async () => {
    loads++;
    const module = await import('../../../src/countdown/score.js');
    return { startScore: (...args: Parameters<typeof module.startScore>) => (started = module.startScore(...args)) as ReturnType<typeof module.startScore> };
  };
  const sound = createCountdownSound({ AudioContext: fakeAudio(state) } as unknown as Window, loader)!;
  sound.tick(5); sound.midnight(); sound.setMood('minute', .5);
  assert.equal(state.contexts, 0); assert.equal(loads, 0, 'no audio and no music code before the tap');
  assert.equal(await sound.enable(), true);
  await new Promise(r => setTimeout(r, 20));
  assert.equal(state.contexts, 1); assert.equal(loads, 1, 'the music is loaded on the tap');
  assert.ok(started, 'the score itself started (not only the two welcome bells)');
  assert.ok(state.oscillators > 4, 'the soundtrack is playing');
  sound.setMusic(false);
  const before = state.oscillators;
  sound.tick(3);
  assert.ok(state.oscillators > before, 'countdown sounds still play with the music off');
  sound.close();
  assert.equal(sound.on, false);
});

test('sound: a refused or silent start is reported as off; the music never loads', async () => {
  const state = { contexts: 0, oscillators: 0, starts: [] as number[] };
  let loads = 0;
  const sound = createCountdownSound({ AudioContext: fakeAudio(state, 'suspended') } as unknown as Window, async () => { loads++; return import('../../../src/countdown/score.js'); })!;
  assert.equal(await sound.enable(), false);
  assert.equal(sound.on, false); assert.equal(loads, 0);
});

test('sound: a browser that will not restart audio after the page comes back reports sound off, honestly', async () => {
  const state = { contexts: 0, oscillators: 0, starts: [] as number[], resumeTo: undefined as string | undefined };
  const sound = createCountdownSound({ AudioContext: fakeAudio(state) } as unknown as Window, () => import('../../../src/countdown/score.js'))!;
  assert.equal(await sound.enable(), true);
  sound.pause();
  assert.equal(await sound.resume(), true, 'a normal return keeps sound on');
  sound.pause(); state.resumeTo = 'suspended';
  assert.equal(await sound.resume(), false, 'a refused restart is reported');
  assert.equal(sound.on, false);
  const page = read('src/countdown/CountdownPage.tsx');
  assert.match(page, /if \(!still\) \{ setOn\(false\); setNote\('lost'\); \}/);
  // A start the visitor already cancelled never reports back as "didn't allow sound".
  assert.match(page, /if \(id !== request\.current\) return;/);
  sound.close();
});

test('sound: the final ten seconds climb a scale (never one repeated note); stages map to the score', () => {
  const notes = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(tickNote);
  assert.deepEqual(notes, TICK_NOTES);
  assert.equal(new Set(notes).size, 10);
  for (let i = 1; i < notes.length; i++) assert.ok(notes[i] > notes[i - 1]);
  assert.deepEqual(['syncing', 'days', 'eve', 'hour', 'minute', 'final', 'welcome', 'commemorative'].map(moodFor), ['calm', 'calm', 'calm', 'hour', 'minute', 'final', 'welcome', 'welcome']);
});

test('score: varied notes from one scale, stops scheduling when held or stopped, original and download-free', () => {
  const state = { contexts: 0, oscillators: 0, starts: [] as number[] };
  const Ctx = fakeAudio(state);
  const ctx = new Ctx() as unknown as AudioContext;
  const timers: (() => void)[] = []; let cleared = 0;
  const score = startScore(ctx, ctx.createGain(), 'calm', seeded(7), ((fn: () => void) => { timers.push(fn); return timers.length; }) as never, (() => { cleared++; }) as never);
  for (let i = 0; i < 40; i++) { (ctx as unknown as { currentTime: number }).currentTime += .25; timers[0](); }
  assert.ok(state.oscillators > 40, 'pads and piano are scheduled');
  score.hold(); assert.equal(cleared, 1, 'hidden: the scheduler stops');
  score.release(); assert.equal(timers.length, 2);
  score.setMood('minute', .5); score.setMood('final'); score.celebrate(); score.setMood('welcome');
  score.stop(); assert.equal(cleared, 2);
  assert.match(read('src/countdown/score.ts'), /if \(settle\) \{ clearTimeout\(settle\); settle = null; \}/, 'stopping clears the celebration timer');
  // The melody's vocabulary is one pentatonic scale, so no line can clash or sit on one note.
  assert.deepEqual(SCALE, [65, 67, 69, 72, 74, 77, 79, 81, 84]);
  for (const file of ['src/countdown/score.ts', 'src/countdown/sound.ts', 'src/countdown/voices.ts']) {
    assert.doesNotMatch(read(file), /\.mp3|\.ogg|\.wav|\.m4a|fetch\(|new Audio\(|decodeAudioData|Math\.random/, file);
  }
});

test('sound controls: off by default, Music appears only while sound is on, visibility and leaving pause it', () => {
  const page = read('src/countdown/CountdownPage.tsx');
  assert.match(page, /const \[on, setOn\] = useState\(false\)/);
  assert.match(page, /\{sound\.instance && sound\.on && \(/);
  assert.match(page, /aria-pressed=\{sound\.music\}/);
  assert.match(page, /window\.addEventListener\('pagehide', onHide\)/);
  assert.match(page, /This browser didn’t allow sound/);
  assert.match(read('src/countdown/countdown.css'), /\.cd-sound-note \{ position: absolute;/, 'the note never moves the page');
  // The music's code is its own chunk, fetched on the tap (a dynamic import), not part of the countdown's first load.
  assert.match(read('src/countdown/sound.ts'), /=> import\('\.\/score'\)/);
  assert.doesNotMatch(read('src/countdown/sound.ts'), /^import \{[^}]*\} from '\.\/score'/m, 'only types come from score.ts statically');
});

/* ───────── 4. The seasonal serif ───────── */

test('serif: seasonal pages and Greetings use the fixed opsz 72 file; the Countdown keeps the full range', () => {
  assert.equal(SEASONAL_SERIF_HREF, 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,72,500;1,72,600&display=swap');
  assert.equal(COUNTDOWN_SERIF_HREF, 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,500;1,9..144,600&display=swap');
  assert.match(read('src/countdown/CountdownPage.tsx'), /loadSeasonalSerif\(COUNTDOWN_SERIF_HREF\)/);
});

/* ───────── 6–7. Welcome Offer advertising and the stacked December saving ───────── */

const bundle = (id: string, network: string, dataAmount: string, priceGhc: number, extra = {}) => ({ id, network, dataAmount, priceGhc, ...extra }) as never;
// The live catalogue on 28 November 2026 (read-only): MTN Data paused, so no MTN products; AirtelTigo 1GB is the cheapest.
const live = [bundle('at-1gb', 'airteltigo', '1GB', 4.99), bundle('at-2gb', 'airteltigo', '2GB', 9.49), bundle('telecel-10gb', 'telecel', '10GB', 44.99)];
const guest = { enabled: true, state: 'guest', discountMinor: 100 }, eligible = { ...guest, state: 'eligible' };
const december = (id: string, gb: string) => bundle(id, 'mtn', gb, DECEMBER_2026_APPROVED_PLAN.products[id].campaignMinor / 100,
  { standardPriceGhc: DIRECT_RETAIL_MINOR[id] / 100, priceCampaign: { label: 'December Special', stacksWithWelcome: true } });
const decemberCatalogue = [december('mtn-1gb', '1GB'), december('mtn-2gb', '2GB'), december('mtn-3gb', '3GB'), december('mtn-4gb', '4GB'), december('mtn-5gb', '5GB'), ...live];

test('welcome headline: the live catalogue supports "up to 18%" (GH₵1 of GH₵4.99 is 20%, held to the approved ceiling)', () => {
  assert.equal(WELCOME_HEADLINE_CEILING, 18);
  assert.equal(Math.floor(100 * 100 / 499), 20);
  assert.deepEqual(welcomeFigure(guest, live, true), { percent: 18, regularMinor: 499, label: 'AirtelTigo 1GB' });
  assert.equal(welcomeFigure(guest, live, false), null, 'nothing until the server catalogue is on screen');
  assert.equal(welcomeFigure({ ...guest, enabled: false }, live, true), null);
  // Only bundles of GH₵10 or more: the figure follows the real prices down, never a typed-in 18%.
  assert.equal(welcomeFigure(guest, [bundle('telecel-10gb', 'telecel', '10GB', 44.99)], true)!.percent, 2);
});

test('the 33% check: approved December Data prices plus the welcome benefit reach 27% at most; 33% is AFA, and not Data', () => {
  const rows = Object.entries(DECEMBER_2026_APPROVED_PLAN.products).map(([id, { campaignMinor }]) => {
    const standard = DIRECT_RETAIL_MINOR[id], first = campaignMinor - 100;
    return { id, campaign: Math.floor((standard - campaignMinor) * 100 / standard), combined: Math.floor((standard - first) * 100 / standard) };
  });
  assert.deepEqual(rows, [
    { id: 'mtn-1gb', campaign: 9, combined: 27 }, { id: 'mtn-2gb', campaign: 14, combined: 23 }, { id: 'mtn-3gb', campaign: 10, combined: 17 },
    { id: 'mtn-4gb', campaign: 8, combined: 13 }, { id: 'mtn-5gb', campaign: 8, combined: 12 },
  ]);
  assert.equal(campaignHeadlinePercent(rows.map(r => ({ amountPesewas: DECEMBER_2026_APPROVED_PLAN.products[r.id].campaignMinor, standardPesewas: DIRECT_RETAIL_MINOR[r.id] }))), 14, 'campaign-only headline');
  assert.equal(Math.floor((AFA_APPROVED.standardMinor - AFA_APPROVED.campaignMinor) * 100 / AFA_APPROVED.standardMinor), 33, 'AFA Registration 29.99 -> 19.99');
  assert.deepEqual(combinedWelcomeFigure(eligible, decemberCatalogue, true), { percent: 27, label: 'MTN 1GB', campaignLabel: 'December Special' });
  assert.equal(combinedWelcomeFigure(eligible, live, true), null, 'no campaign applied (and while MTN is paused, December applies to nothing)');
  // A campaign whose combined saving is no larger than the welcome figure alone adds no second line.
  const small = [bundle('telecel-20gb', 'telecel', '20GB', 19.9, { standardPriceGhc: 20, priceCampaign: { label: 'December Special', stacksWithWelcome: true } })];
  assert.equal(welcomeFigure(eligible, small, true)!.percent, 5);
  assert.equal(combinedWelcomeFigure(eligible, small, true), null, 'combined 5% is not larger than 5%');
  const noStack = decemberCatalogue.map(b => (b as { priceCampaign?: object }).priceCampaign ? { ...(b as object), priceCampaign: { label: 'December Special', stacksWithWelcome: false } } : b) as never[];
  assert.equal(combinedWelcomeFigure(eligible, noStack, true), null);
});

const advert = (variant: 'card' | 'line' | 'chip', offer: object | null, bundles = live, confirmed = true) =>
  renderToStaticMarkup(React.createElement(WelcomeAdvert, { variant, offer: offer as never, bundles, catalogConfirmed: confirmed, onCreateAccount: () => {} }));

test('advert: guests are invited, eligible customers are told it is ready, everyone else sees nothing', () => {
  assert.equal(text(advert('card', guest)), 'Welcome offer Up to 18% off your first data bundle For new customers Create a free account');
  assert.equal(text(advert('card', eligible)).replace(/\s+/g, ' '), 'Welcome offer Up to 18% off your first data bundle Ready on your account');
  for (const state of ['previous_buyer', 'redeemed', 'reserved', 'phone_required', 'phone_conflict', 'unavailable', 'disabled']) {
    for (const variant of ['card', 'line', 'chip'] as const) assert.equal(advert(variant, { ...guest, state }), '', `${variant} ${state}`);
  }
  assert.equal(advert('card', guest, live, false), '', 'unconfirmed catalogue');
  assert.equal(advert('card', null), '');
  assert.match(advert('line', guest), /<button type="button" class="mh-wa mh-wa-line is-action"/);
  // The words on screen are the words read out, with whose offer it is after them.
  assert.equal(text(advert('line', eligible)), 'Ready: up to 18% off your first bundle Welcome offer, on your account.');
  // Wide screens say "create a free account", phones "sign up" (each hidden by CSS where the other shows).
  assert.equal(text(advert('line', guest)), 'Up to 18% off your first bundle · create a free account sign up Welcome offer for new customers.');
  assert.match(read('src/components/offers/welcomeAdvert.css'), /\.mh-wa \.mh-wa-wide \{ display: none; \}\n@media \(min-width: 640px\) \{ \.mh-wa \.mh-wa-wide \{ display: inline; \} \.mh-wa \.mh-wa-narrow \{ display: none; \} \}/);
  assert.doesNotMatch(advert('line', guest), /aria-hidden="true">[^<]*[A-Za-z]/, 'no visible words are hidden from screen readers');
  assert.equal(text(advert('chip', eligible)), 'Up to 18% off your first bundle , welcome offer ready on your account.');
  // The one-line variants keep to the welcome figure, even in December.
  assert.doesNotMatch(advert('line', eligible, decemberCatalogue), /27%/);
  // No worked-out figure, no advert.
  for (const variant of ['card', 'line', 'chip'] as const) assert.equal(advert(variant, guest, []), '', `${variant} without a figure`);
  // During December (when MTN sells), the combined figure is named as the campaign's.
  assert.match(text(advert('card', eligible, decemberCatalogue)), /Up to 18% off .* Up to 27% with the December Special/);
  assert.match(text(renderToStaticMarkup(React.createElement(WelcomeCard, { offer: eligible as never, bundles: decemberCatalogue, catalogConfirmed: true }))), /Up to 27% with the December Special/);
  for (const html of [advert('card', guest), advert('line', eligible), advert('chip', eligible)]) assert.doesNotMatch(html, /GH₵|\d\.\d\d/, 'no money amount: checkout shows the exact total');
});

test('advert placement: every ordinary surface, year-round, independent of the season', () => {
  const home = read('src/components/home/HomeFeaturedData.tsx');
  assert.match(home, /<WelcomeAdvert variant="card" offer=\{welcomeOffer\}/);
  // Room is held only for a signed-out visitor, only until the server answers, and never longer than 8 seconds.
  assert.match(home, /const welcomeReserve = !sessionToken && !welcomeSettled && !welcomeWaitOver \?/);
  assert.match(home, /setWelcomeWaitOver\(true\), 8000\)/);
  assert.match(home, /data-reserve=\{welcomeReserve\}/);
  assert.match(read('src/components/home/homepage.css'), /\.home-welcome-slot\[data-reserve\] \{ min-height: 176px; \}\n\.home-welcome-slot\[data-reserve="tall"\] \{ min-height: 200px; \}/);
  assert.equal(welcomeCombinedLikely(live, false, new Date('2026-11-28T12:00:00Z')), false);
  assert.equal(welcomeCombinedLikely(live, false, new Date('2026-12-01T00:00:00Z')), true, 'December window, catalogue still loading');
  assert.equal(welcomeCombinedLikely(live, true, new Date('2026-12-01T00:00:00Z')), false, 'the confirmed catalogue has no December price: no combined line');
  assert.equal(welcomeCombinedLikely(live, false, new Date('2027-01-05T00:00:00Z')), false);
  assert.equal(welcomeCombinedLikely(decemberCatalogue, true, new Date('2026-11-28T12:00:00Z')), true, 'a stacking price on screen');
  const member = read('src/components/home/MemberHome.tsx');
  assert.match(member, /welcome:!loading&&!error&&orders\.length===0\?<MemberWelcomeChip\/>:undefined/);
  assert.match(read('src/components/home/MemberHomeView.tsx'), /Start here<\/h2>\{welcome\}<\/div>/);
  assert.match(read('src/components/home/member-home.css'), /\.member-first \.member-order-head \{ min-height: 24px; \}/);
  assert.match(read('src/components/data/DataPage.tsx'), /<WelcomeAdvert variant="line" offer=\{welcomeOffer\}/);
  for (const file of ['src/components/offers/WelcomeAdvert.tsx', 'src/utils/welcomeAdvert.ts']) assert.doesNotMatch(read(file), /useSeason|seasonal\//, `${file} is not seasonal`);
});
