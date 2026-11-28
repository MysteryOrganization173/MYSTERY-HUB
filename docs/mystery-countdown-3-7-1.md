# Mystery Hub 3.7.1 · Mystery Countdown

**Status:** code release, merged in PR #154 (`bf906db`) and deployed on 28 November 2026. The link-preview head was verified live (read-only); the rest of the live check could not be made from the build sandbox. See section 13.

**What it is:** an original New Year countdown at [`/countdown`](https://mysterybundlehub.com/countdown) to **midnight on 1 January 2027 in Accra** (Africa/Accra is GMT all year, with no daylight saving). It is public, needs no account, and is shareable. It works on its own from the moment it deploys, with every feature setting off.

**What this release does not do:**
- It doesn't switch on Christmas, the seasonal homepages, Mystery Greetings or Mystery Gifts.
- It doesn't touch promotions, services, payments, prices, suppliers, refunds, financial records, SMS, push or WhatsApp broadcasts, DNS or Cloudinary.
- It changes no production setting, secret, environment variable or database. Nothing it does reads or writes a database.

**Starting checkpoint:** `origin/main` at `7bf833b` (PR #153), the assignment's checkpoint. The only open PR was the stale draft #69, which this release doesn't touch.

**Screenshots:** [`docs/screenshots/mystery-countdown-3-7-1/`](screenshots/mystery-countdown-3-7-1/). They come from a local production build in Chromium, with a synthetic server clock and a device clock set months wrong on purpose. The sandbox cannot reach Cloudinary, so the brand mark in them (and in the link-preview image) is a crop of the approved mark taken from the existing Greetings preview image. Production serves the real Cloudinary mark.

## 1. Design

**Direction.** Midnight navy and plum, champagne gold, silver and ivory, with a quiet field of stars. The type is Fraunces italic for headings, Outfit for numerals and Plus Jakarta Sans for text. Everything is drawn in SVG and CSS. There is no video, no image download for the page itself, no animation library and no music.

**The Midnight Dial.** An original celestial clock face: hairline rings, hour or minute marks, one star at 12 o'clock, and a lit gold arc that is the time left in the dial's current span. The arc always ends at 12 o'clock, so every stage converges on the same point: midnight. A small light travels the ring once a minute.

**The dial zooms in as midnight approaches:**

| Stage | When (Accra) | What the dial shows | Words |
|---|---|---|---|
| Days | more than 24 hours left | 24 marks; the arc is the rest of today | "Counting down to 2027", days, hours, minutes, seconds |
| New Year's Eve | the final 24 hours (all of 31 December) | 24 marks; the arc shrinks through the day | "Tonight we welcome 2027", hours, minutes, seconds |
| Final hour | 60 minutes | 60 marks; the arc is the hour | "Almost 2027", minutes and seconds; sharing goes quiet |
| Final minute | 60 seconds | the arc is the minute | "Here comes 2027", the seconds large in the dial; only the way back remains |
| Final ten seconds | 10 seconds | ten gold segments go out one by one | each number arrives on its own; the sky deepens |
| Midnight | 00:00:00 | one celebration (about 5 seconds): the ring sweeps to full, 12 rays and 28 sparks, a bloom of light, and the outlined 7 of 2027 fills with light, rising | "Welcome, 2027" |
| Welcome | 1 to 7 January | a full lit ring and a lit 2027 | "Happy New Year from all of us at Mystery Hub. Afehyia pa!", the real Accra date, New Year wishes to share, and **Replay midnight** |
| Commemorative | from 8 January | the same calm, lit dial | "2027 began here", with no sharing and nothing that suggests the countdown is still on |

**No strobing.** Nothing flashes. The final seconds use one gentle entrance per number. The celebration is a single, finite sequence. Twinkling stars stop after about 2.4 seconds. No animation on the page loops forever.

**The way back.** The Mystery Hub mark (top left) and **Visit Mystery Hub** both go to the homepage. There are no ads, offers or prices anywhere on the page.

## 2. Route and architecture

**A standalone surface.** `src/main.tsx` sends `/countdown` (and `/countdown/`) to `src/countdown/CountdownPage.tsx`, loaded lazily with its stylesheet, in the same way as the Greetings pages.
- It doesn't load the commerce app, the account context, the API client or Paystack.
- The inline `preloadMainApp` script in `vite.config.ts` no longer preloads the app on `/countdown`.
- The browser checks confirm that `App`, `AppContext`, `AppLandingPage` and `usePaystack` are never requested (section 9).

**One engine for every countdown.** `src/greetings/countdown.ts` is shared by the full page and by the card under New Year greetings (`NewYearCountdown.tsx`).
- It uses the existing `/api/experiences/countdown`, which this release does not change.
- That endpoint is public, needs no feature setting and reads no database.
- It uses the existing target (`COUNTDOWN_TARGET` in `shared/mysteryExperiences.ts`). There is no second endpoint and no second copy of the target.

**Files:**

| File | Role |
|---|---|
| `src/greetings/countdown.ts` | The shared clock: anchors, estimates, when to ask again, and the view states (rewritten; old exports kept) |
| `src/countdown/stage.ts` | Pure stage, dial and words logic, used for tests and rendering |
| `src/countdown/CountdownPage.tsx` | The page: sky, top bar, dial, timer, honest states, sharing, celebration, announcements |
| `src/countdown/Dial.tsx` | The Midnight Dial and the 2027 mark (SVG) |
| `src/countdown/share.ts` | The canonical link, share text, the WhatsApp link, native share and copy |
| `src/countdown/immersive.ts` | Full screen and the screen wake lock, with fallbacks |
| `src/countdown/sound.ts` | Optional synthesized sound (Web Audio) |
| `src/countdown/countdown.css` | Styles, loaded only with this page |
| `server/routes/experienceApi.ts` | The countdown read gets its own bounded admission budget (section 3) |
| `server/services/publicSocialMetadata.ts`, `src/utils/socialMetadata.ts` | The `/countdown` link-preview head |
| `public/og/mystery-countdown-2027-v1.jpg` | The 1200×630 link-preview image, drawn by `scripts/renderCountdownShareImage.tsx` |

## 3. Timing

**The server decides the time; the device clock never does.**
- The page asks `/api/experiences/countdown` what time it is.
- It pins the answer to its own monotonic clock (`performance.now`) at the midpoint of the request.
- Every display works out the time left again from that anchor; nothing counts down a stored number.
- A phone whose clock is wrong by months shows exactly the same countdown (tested at −183 and +400 days).
- Without a server answer, the page says so plainly. It never guesses from the device.

**Two clocks keep each other honest.** The page also keeps the device's wall clock at the anchor, and compares how far each clock has moved.
- If the wall clock ran ahead, the monotonic clock was paused: the phone slept. The wall clock's elapsed time is the better guess.
- If the wall clock fell behind, someone set it back, so the monotonic count is kept.
- Either way, the page shows "Re-checking the time…" and asks the server again at once.
- A sample whose request straddled such a jump is discarded.
- A slow answer is still used, and asked again (at most twice) for a tighter one.

**When it asks the server.** It never polls every second.
- Once when the page opens.
- At once whenever the two clocks disagree.
- When the page comes back to the foreground, or the connection returns, but only if the last answer is at least 5 minutes old. Quick app switches cost nothing.
- Every 30 minutes while the page is visible.
- Once in the final minutes, when the last answer is more than a minute old. Each page picks its own moment between T−3:00 and T−2:00, so open pages don't all ask together.
- After a failure with no answer yet: 5, 15, 30 then 60 seconds, each spread by ±20%. Automatic retries leave the "unavailable" message in place, so a screen reader isn't told the same thing again on every retry.
- An hour of watching costs two or three requests (tested). Nothing happens at midnight itself.
- At midnight after a clock jump, it asks until the server confirms (section 3, "Midnight, exactly once").

**While hidden, the page does no work at all:** no ticks, no timers, no requests. On return it shows the right time at once.

**Offline after one good answer:** it keeps counting from that answer, accurately, and doesn't keep retrying.

**Out of order and abandoned answers.** Every request carries a generation number. An answer to an older or abandoned request changes nothing.

**Midnight, exactly once:**
- Midnight is declared only from a trusted estimate.
- If a clock jumped (the device slept across midnight, or someone moved its clock forward past midnight), the page shows "Checking the time in Accra…", never 0 and never a celebration on a guess. It waits for the server's word, however long that takes. While it can't reach the server it says "We can't confirm the time in Accra right now. Trying again…" and keeps asking, spaced out. A moved clock therefore never brings an early Welcome 2027. When the server says time is still left, the countdown simply resumes.
- The celebration plays only if this page was counting, is visible, and saw midnight happen within the last 60 seconds. A tab brought back 30 seconds late still celebrates; one brought back later gets the calm welcome.
- It plays once per page load (a module-level guard), whatever re-renders, foreground returns, reconnects or re-checks happen afterwards.
- The display rounds up, so it reaches 0 exactly at midnight and never shows a negative number.

**The server's admission budget.** In production every unqualified visitor shares one local rate-limit key, so the whole of `/api/experiences` (Greetings included) shares 240 requests a minute. That is right for creating greetings, but too tight for a public clock on New Year's Eve.
- The countdown read now has its own admission (`server/middleware/clockAdmission.ts`), registered ahead of the shared budget. A busy evening can't exhaust the Greetings budget, and Greetings traffic can't stall the clock.
- **Bounds:** 1,200 reads a minute per visitor network, and 12,000 a minute (200 a second) for the whole process. Unqualified ingress, where everyone shares one key, is held to the process ceiling.
- **Memory:** it keeps one number per visitor key in fixed one-minute windows, all cleared when the window turns. Memory stays small, and no new visitor is refused just because many others came first.
- Refusals are `429` with `Retry-After`. The same private, no-store, noindex and nosniff headers apply.
- **Tested:** after the shared budget is spent, the clock still answers, and clock reads don't spend it. The per-visitor bound, the process ceiling, the shared key, window reset and no lock-out are each tested.
- Even if a page were refused, a page with one good answer keeps counting correctly.

## 4. States and words

**Honest states:**
- **Syncing.** "Checking the time in Accra…" sits in an empty frame of the timer, with dashes, never numbers. After 4 seconds: "Still connecting… your connection seems slow."
- **Unavailable.** "We can't check the time in Accra right now." with **Try again**, and the page explains that it never guesses from the device's clock.
- **Re-checking.** After a clock jump, the count stays on screen with "Re-checking the time…".
- **Confirming.** At midnight after a clock jump: "Checking the time in Accra…", then, if the server can't be reached, "We can't confirm the time in Accra right now. Trying again…".

**The words** are greetings and time only. There are no offers, prices, giveaways, delivery promises or statistics. Accra is named throughout: "Midnight, 1 January 2027 · Accra time (GMT)" and "Times are Accra time (GMT). The countdown follows Mystery Hub's clock, not your device's."

**After midnight:**
- The page title changes to "Welcome 2027 · Happy New Year — Mystery Hub".
- The kicker gives the real Accra date ("New Year's Day · Accra", then for example "3 January 2027 · Accra").

**Replay.** Anyone may tap **Replay midnight**; it plays the same sequence, labelled "Replay · not live". It never plays by itself for someone who missed midnight.

**Post-season policy.** From 8 January 2027, the same day the card under New Year greetings bows out, the page becomes commemorative:
- "2027 began here" and a thank-you;
- no sharing and no timer;
- still the way back to Mystery Hub, and a working page for anyone holding an old link.

It needs no further release. A later year would be a new, separately reviewed release.

## 5. Sound, full screen and the screen

**Sound** is off by default. It starts only after a tap on **Sound off/on** (as browsers require).
- It is made in the page with Web Audio: a soft confirmation when switched on, a soft tick for each of the final ten seconds, and a short bell chord at midnight.
- No audio file is downloaded and no music is used.
- It pauses whenever the page is hidden and closes with the page.
- The button carries `aria-pressed`. If the browser refuses to start audio, it switches back to "Sound off".

**Full screen** is optional, and only ever entered from a tap.
- Where the browser allows it, the page goes full screen and hides everything but the countdown. It also asks the browser to keep the screen on (Screen Wake Lock), which is useful for a phone propped up for midnight. Browsers drop that lock when the page is hidden, so the page asks again on return. It lets go on exit, including a lock granted only after leaving.
- iPhone Safari has no full screen for web pages. There, the quiet layout alone is the immersive view.
- A refused or cancelled request changes nothing.
- **Exit full screen**, Escape and the browser's own exit all leave, and focus returns to the button.
- Turning the phone keeps the layout tidy (tested at 844×390).

## 6. Sharing and link previews

**The link** is always the canonical `https://mysterybundlehub.com/countdown`, with nothing personal and no tracking identifier in it.

**Sharing:**
- **Share** (the phone's share sheet) appears only where the browser supports it.
- **WhatsApp** opens `wa.me` with "Counting down to 2027 with Mystery Hub. Join me for midnight in Accra:" and the link. After midnight it says "Happy New Year! 2027 has arrived in Accra. Afehyia pa!".
- **Copy link** says "Link copied." If the browser blocks copying, the page shows the link to copy by hand.
- Nothing claims that anything was sent.
- Sharing goes quiet in the final hour and gives way in the final minute, so the page is all countdown.

**Link previews.** The Express responder that serves `mysterybundlehub.com` now gives `/countdown` its own head: title, description, canonical URL, the brand icon and a 1200×630 image with alt text. It is indexable.
- The words follow the server's own clock. Before midnight: "Countdown to 2027 · Midnight in Accra — Mystery Hub" and an invitation to count down. After midnight: "Welcome 2027 · Happy New Year from Accra — Mystery Hub", never a "live countdown".
- The HTML is `no-store`, so a preview fetched after midnight gets the new words.

**The preview image** (`public/og/mystery-countdown-2027-v1.jpg`, 58 KB) is drawn from the page's own dial and stylesheet by `scripts/renderCountdownShareImage.tsx`. It shows "Midnight in Accra", the dial and the Mystery Hub mark. It carries no date, number or personal detail, so one fixed image serves everyone, before and after midnight. Bump the file version (v1 → v2) whenever it changes.

## 7. Discovery and activation

**The page itself** is public and live as soon as this release deploys. It needs no feature setting, account or seasonal pack. Nothing else is switched on by it.

**Where it is suggested:**
- **Seasonal homepages, guest and member,** from 27 December to 1 January (Accra): "Watch the countdown to 2027" (27–30 December), "Join the countdown to midnight" (31 December) and "See Welcome 2027" (1 January).
  - Never during Christmas, so it never competes with the Christmas homepage.
  - Gone from 2 January.
  - On the member homepage, never beside a payment or order that needs attention.
  - These homepages appear only when the founder sets `SEASONAL_EXPERIENCE=christmas-2026` on the API service. This release doesn't set it (at the 3.6.4 release it was not set). Until it is set, the links don't appear.
- **Under a New Year greeting:** the existing countdown card gains a "Watch the full countdown →" link while it is counting. Mystery Greetings itself stays off until the founder opens it.
- Anyone can share or type the link directly.

**Analytics** use only what already exists, under the same consent rules (Do Not Track and Global Privacy Control switch it off):
- the growth `page_view` with page `countdown` (already in `GROWTH_PAGES`);
- the experience event `countdown_open` when the countdown or welcome actually appears.
- Experience events stay gated by Mystery Greetings links, which are off, so `countdown_open` records nothing until then.
- Nothing personal is sent.

## 8. Accessibility

- One `h1`, a `main` landmark, and a labelled stage region.
- The ticking digits are hidden from screen readers. Instead, a `role="timer"` region carries one sentence at minute precision ("About 3 days, 2 hours and 5 minutes until midnight on 1 January 2027 in Accra.").
- A polite live region speaks **once per stage change while counting**, never each second: "It's New Year's Eve in Accra." / "One hour to go until 2027." / "One minute to go." / "Ten seconds to go." / "Happy New Year! It's 2027 in Accra." (the last only when midnight was seen live).
- Errors use `role="alert"`; syncing uses `role="status"`.
- Every control is at least 44×44 px, keyboard reachable in order, with a visible gold focus ring. On phones under 420 px the top-bar buttons are icon-only, with their names kept for screen readers.
- **Reduced motion:** with the system setting on, every animation and transition stops. There are no rays or sparks, and the midnight moment is a still, lit 2027 for about a second.
- axe-core 4.10 (WCAG 2.1 A and AA) reports **no violations** on the days, final-seconds, welcome, commemorative and unavailable states.

## 9. Performance

**What `/countdown` downloads** (gzip):

| What | Size |
|---|---|
| The site-wide entry (`index.js`, `index.css`), which every page loads | 72.2 KB JS + 29.1 KB CSS |
| The countdown page and its stylesheet | 7.2 KB JS + 4.5 KB CSS |
| The shared clock engine | 1.7 KB |
| Small shared pieces (icons, business constants, the seasonal calendar, analytics, share helpers) | about 9 KB |

**What it never downloads:** the commerce app (`App`, 96 KB gzip), `AppContext`, `AppLandingPage` or Paystack.

**Lab measurement** (Chromium, 390 px, 4× CPU slowdown, 1.6 Mbps with 150 ms latency, local build):
- first contentful paint 1.6 s, largest contentful paint 1.7 s, the countdown showing at 1.75 s (1.75–2.3 s across runs);
- cumulative layout shift **0.007**. It was 0.12 before the syncing frame held the timer's place;
- **no long tasks while ticking.**

**Each second** changes only a few text nodes, one dash offset and one rotation. The marks are drawn once per stage. Every motion is transform, opacity or a dash offset.

**For Release C:** the site-wide `index.js` and `index.css` are the bulk of this page's download, and `/g` and `/greetings` still preload the whole commerce app. Both are recorded for 3.7.3 and left as they are here.

## 10. Tests

**Automated (Node test runner, `server/suppliers/__tests__/mysteryCountdown371.test.ts`, 38 tests).** A controlled world runs server truth, a monotonic clock, a deliberately wrong wall clock, timers and the network. It covers:
- **Timing:** the anchor maths; a wrong device clock; syncing, slow, unavailable and spread retries (including Try again during a retry); offline after an answer; no polling over an hour; foreground return and rapid switching; a phone that slept; a clock set back; an out-of-order answer abandoned after a sleep; slow round trips refined at most twice.
- **Phases:** every phase boundary, including the first second of the eve (24:00:00) and of the final hour (60:00); the eve starting at 00:00 on 31 December; the final ten seconds in order and a single live arrival with no request at midnight; the jittered final check; hidden at midnight (back within and after the grace period); opened just after midnight, days later and after 8 January; a sleep across midnight (confirmed, and offline until it can be confirmed); a device clock moved past midnight while offline (no early welcome, the countdown resumes, and the real midnight still celebrates live).
- **The page:** the embedded card's states and link, and the card rendered through the shared engine; the dial model; the words (no offers or promises); server-rendered markup for every state; the single-celebration guard; finite animations and reduced motion; accessible structure.
- **Sharing, sound and full screen:** sharing (native, cancelled, refused, WhatsApp, no "sent"); sound (off until tapped, no downloads, a refused start reported as off); full screen (unsupported and refused).
- **Previews, route and server:** link-preview heads before and after midnight and on every route spelling; the preview image (a real 1200×630 JPEG under 150 KB); the route and preload pins; the page's whole static import graph (no app, accounts, checkout or Paystack); no HTML sinks, storage or device-clock time; the server endpoint's headers and its separate budget; the clock admission's bounds; discovery dates and the attention guard.

**Real browser (`scripts/reviewMysteryCountdown.cjs`, Playwright Chromium, local production build, 43 checks).** Every check runs with the device clock set months wrong. They cover:
- **Phases and midnight:** each phase; the first paint while syncing (an empty frame, no numbers); midnight live (the final ten seconds 10 → 1, one finite celebration, the announcement, no repeat after foreground returns and reconnects, the labelled replay with keyboard focus kept on it); opened just after midnight; opened days later and after 8 January; reduced motion.
- **Time and network:** slow sync; failed sync and Try again; offline across the start of the final hour, then reconnecting; foreground return; a device clock changed while open; rapid refreshes.
- **Full screen, sound and sharing:** full screen with Escape and focus return; the iPhone-style fallback with rotation; the screen wake lock (held, asked again after an app switch, let go on exit); sound; copy, blocked copy, WhatsApp and native share.
- **Layout:** 320×568, 360×740, 390×844, 430×932, 768×1024, 1280×800, 1440×900, 844×390, 390×600 and 667×375. Each is checked for no horizontal overflow and no content cut off at the edges, the dial and timer on screen, and every target at least 44 px.
- **Accessibility:** axe on five states, and keyboard order with visible focus.
- **Discovery and Greetings:** the seasonal homepage preview on 27 and 31 December (link shown) and on 25 December (no link); the New Year greeting card still counting and linking to `/countdown`.
- **Network and performance:** network isolation, and lab performance.

**Results:** recorded in section 13.

**Screenshots** (in [`docs/screenshots/mystery-countdown-3-7-1/`](screenshots/mystery-countdown-3-7-1/), 390 px unless named):
- **Phases:** `01` syncing (the empty frame), `02` days, `03` New Year's Eve, `04` final hour, `05` final minute, `06` final seconds.
- **Midnight and after:** `07` midnight, `08` welcome, `09` replay (labelled), `10` commemorative, `11` midnight with reduced motion.
- **States and sizes:** `12` unavailable, `13` 320×568, `14` 844×390 landscape, `15` 667×375 landscape, `16` and `17` desktop 1440×900.
- **Immersive:** `18` the immersive layout, `19` immersive landscape.
- **Discovery and Greetings:** `20` the New Year homepage link (founder preview, 27 December), `21` the card under a New Year greeting.

## 11. Limitations and risks

- **Browsers.** Only Chromium was run. WebKit and Firefox are not available in this sandbox. This is browser emulation, not physical-device testing. Physical acceptance on Android Chrome, iPhone Safari and the WhatsApp in-app browser is still to do.
- **Link previews.** These were checked as the server's HTML head (unit tests). No real WhatsApp or Facebook crawler fetch was made. The live head is checked read-only after deployment (section 13).
- **A clock moved forward while offline** looks the same as a sleeping phone. The page then shows "Re-checking the time…" with a count based on the moved clock until the connection returns, and it never declares midnight on that basis. A clock moved forward while online is corrected within one round trip (tested in the browser).
- **A phone that slept and woke offline** before midnight stays on "Re-checking the time…". If it is still offline at midnight, it waits for the server before welcoming 2027, so that viewer gets the calm welcome rather than the live celebration. This is the honest choice, because the page can't tell a sleep from a moved clock.
- **A clock moved within 1.5 seconds** is below the detection threshold. The count can be off by up to that much until the next check.
- **Clock drift** is at most a fraction of a second over the 30-minute refresh.
- **Shared admission key.** In production, unqualified visitors share one admission key, so the process ceiling (12,000 clock reads a minute) is shared by everyone. Above it, new visitors would see "unavailable" and retry with spacing. Visitors who already have an answer keep counting. Normal use is one read on opening, plus one in the final minutes.
- **Background tabs.** Hidden tabs do nothing, so a tab left hidden through midnight celebrates only if brought back within a minute.

## 12. Independent review

An independent review agent read the whole change against the assignment, ran the type check and the new tests, and probed the engine with its own scripts. Every finding was confirmed and fixed before the pull request:

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Blocker | Offline, a device clock moved forward past midnight led, after a failed check, to a permanent early "Welcome 2027". The card under New Year greetings showed it too. | Midnight is never declared from an unconfirmed estimate. The page stays on "Checking…" or "We can't confirm…" and keeps asking. When the server says time is left, the countdown resumes. Two tests cover it. |
| 2 | Important | The first second of the eve and of the final hour read 00:00:00 and 00:00. | The larger unit is folded in, so these read 24:00:00 and 60:00. Boundary tests were added. |
| 3 | Important | The screen wake lock was never asked for again after an app switch (an inverted check). A lock granted after leaving immersive could leak. | The check is fixed, and a granted lock is held only while immersive. A browser check covers both. |
| 4 | Important | The new budget reused a limiter that refuses all new visitors once it holds 10,000 keys (swept every 5 minutes) and stores every timestamp. | A purpose-built admission: fixed windows, one number per key, a per-visitor bound and a process ceiling, and no lock-out. Tested. |
| 5 | Minor | Replay removed itself while focused, so focus fell to the page. | The button stays in place, inert while playing, and keeps focus (browser check). |
| 6 | Minor | A live midnight reached after a check was not announced. | It is now announced. |
| 7 | Minor | The preview head repeated the target date. | It uses the shared `COUNTDOWN_TARGET`. |
| 8 | Minor | A refused audio start was unhandled, and the button said "Sound on". | `enable()` reports whether audio really started; the button follows it. |
| 9 | Tests | Some unit tests only matched source text, or checked markup that cannot show an effect. The browser overflow check could not see content cut off by the page's own overflow guard. | Those tests are labelled as source pins, with behaviour covered in the browser. The embedded card is now rendered. The overflow check also catches content cut off at the edges. |

**Found sound by the review:**
- stale answers are abandoned; `stop()` clears every timer; hidden pages do no work;
- the retry spacing, the absence of polling, and the detection of a sleep or a clock set back;
- the spread final check; nothing negative and no repeated midnight;
- the Express ordering and headers;
- the lazy surface and no App chunk;
- the head and canonical URL; the discovery dates;
- no HTML sinks or storage; consent-gated analytics;
- greetings-only words, 44 px targets, finite animations and blanket reduced motion.

## 13. Release record

**Rollback:**
- Revert the release PR. The page and its links disappear, and the card under New Year greetings returns to its 3.6 behaviour.
- There is no data, setting or schema to undo, and nothing to clean up.
- To withdraw only the discovery links, revert the `countdownInvite` changes; the page stays.

**Pull request:** [#154](https://github.com/MysteryOrganization173/MYSTERY-HUB/pull/154), from `claude/project-thread-nn92c8`.
- **Reviewed head:** `98c4871795c293fd5026d98c64d7fc975295e166`, directly on `7bf833b`. `main` did not move during the release, so nothing else was merged in. The only other open PR was the stale draft #69, which this release doesn't touch.
- **Merge:** `bf906db5ce798428102516f9fadceb2001121ecc`, a merge commit, 28 November 2026 at about 03:01 (Accra time is UTC). Its tree is identical to the reviewed head's (`0ef5c47`).

**CI ("Database security", `backend-rls`):**
- passed on the PR head;
- passed on `main` after the merge.

**Deployment:**
- Production now gives `/countdown` its own head (below). Before this release that path got the site's generic head, so the new server code is live.
- A local build of the merged tree serves `index-BzMsjhbW.js`, replacing `index-0HDt-EWd.js` (3.6.4). The bundle name in production could not be read from the sandbox (see below).

**Live verification** (read-only, 28 November 2026, about 03:11 Accra time). Only GET requests were made, with no sign-in, form or write.
- **`/countdown`:**
  - 200, HTML;
  - title "Countdown to 2027 · Midnight in Accra — Mystery Hub", the before-midnight words, as the server's clock requires;
  - canonical and `og:url` are `https://mysterybundlehub.com/countdown`;
  - `og:image` is `https://mysterybundlehub.com/og/mystery-countdown-2027-v1.jpg`, 1200×630, `image/jpeg`, with the final alt text;
  - `twitter:card` is `summary_large_image`.
- **The homepage `/`:** 200, with its ordinary head unchanged.

**Not verified live.** The sandbox's network policy denies `mysterybundlehub.com`, so the only route was a read-only page reader. That reader returns a page's head metadata only. It can't read images: the Greetings image, which has been live since 3.6, failed the same way as the countdown image, so this is the reader's limit and not the site's. It also obeys `robots.txt`, which disallows `/api`. These are therefore not checked live:
- the preview image itself;
- `/api/experiences/countdown`, and the clock admission in front of it;
- the page rendering and counting in a browser;
- the bundle name;
- `/api/seasonal/status`. This release doesn't touch `SEASONAL_EXPERIENCE`. It was not set at the 3.6.4 check (27 November, 18:47 UTC), and it was not re-read here.

Opening `https://mysterybundlehub.com/countdown` on a phone covers all of them except the seasonal status.

**Where each part stands:**

| State | What |
|---|---|
| Implemented, tested locally, reviewed | Everything in sections 1–9 (section 10 has the tests; section 12 has the review). |
| Merged | PR #154, `bf906db`. |
| Deployed | Yes. Production serves the 3.7.1 head for `/countdown`. |
| Verified live (read-only) | The `/countdown` link-preview head; the ordinary homepage head is unchanged. |
| Not yet verified live | The preview image, the clock endpoint, the page in a browser, the bundle name and the seasonal status. The build sandbox couldn't reach them. |
| Awaiting activation | The seasonal homepage links wait for `SEASONAL_EXPERIENCE`, and the card under a New Year greeting waits for Mystery Greetings. `countdown_open` events wait for Greetings links (`MYSTERY_GREETING_LINKS_ENABLED`). The page itself needs none of them. |
| Awaiting physical-device acceptance | Android Chrome, iPhone Safari, the WhatsApp in-app browser, and a real WhatsApp link preview. |
