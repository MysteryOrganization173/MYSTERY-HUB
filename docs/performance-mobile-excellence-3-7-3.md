# Mystery Hub 3.7.3 · Performance & Mobile Excellence

**Status:** Implemented · Verified locally · Independently reviewed · Merged (`aca9351`) · Deployed · Verified live (read-only, partial: section 16) · Awaiting physical-device verification.

This release makes Mystery Hub lighter and steadier to open on a slow phone, without a redesign. It doesn't change any price, payment, order, supplier, service control, account or financial rule. It doesn't touch the server, production configuration, Cloudinary assets, or the Website Builder, Business Workspace, editor and template renderers.

**Starting point:** `origin/main` at `33c6826` (PR #156, after Release B).

**Where the numbers come from.**
- Every figure is from a local lab run in Chromium in this sandbox.
- Setup: a production build served over HTTP/2 with Brotli; a simulated slow 4G connection (150 ms latency, 200 KB/s down, 94 KB/s up); a phone CPU slowed 4×; a 390 × 844 mobile viewport.
- Each page ran 5 times from a cold cache, as a first visit with nothing stored. The tables show the median.
- Cloudinary and Paystack can't be reached from the sandbox, so image bytes aren't in the totals. Image requests are counted instead.
- **These are synthetic lab results, not real-user Core Web Vitals.** No production field data (CrUX or our own real-user measurement) was available for this release.
- Firefox and WebKit (Safari) aren't installed here, so nothing was checked in them. Browser emulation is not physical-device testing.

## 1. Results at a glance

| What | Before | After |
|---|---:|---:|
| Greetings recipient page (`/g/…`): downloaded / LCP | 431 KB, 57 requests / 1.84 s | 268 KB, 24 requests / 1.35 s |
| Greetings creator (`/greetings`): downloaded / LCP | 437 KB, 62 requests / 2.13 s | 274 KB, 29 requests / 1.71 s |
| First seasonal visit (guest): ordinary homepage shown first, then swapped | 5 of 5 runs | 0 of 5 runs |
| First seasonal visit: seasonal hero on screen (guest / member) | 3.55 s / 3.16 s | 3.05 s / 2.74 s |
| First seasonal visit: hero in its final typeface (guest / member) | 4.19 s / 4.05 s | 3.57 s / 3.60 s |
| Layout shift (CLS): Wallet / Mystery Earn / Data / More Services / member homepage | 0.414 / 0.314 / 0.274 / 0.156 / 0.095 | 0.043 / 0.034 / 0.117 / 0.000 / 0.006 |
| Layout shift (CLS): seasonal homepage, guest / member | 0.082 / 0.138 | 0.068 / 0.068 |
| Background API requests while the tab is hidden (guest homepage or Data, 10 min) | 20 | 0 |
| Countdown left open: main-thread work per 5 s once settled (4× CPU) | 1,136 ms | 206 ms |
| JavaScript and CSS shipped (whole build, Brotli) | 900.3 KB | 901.0 KB (+0.7 KB) |

Ordinary pages that were already fast (guest homepage, Data, Orders, More Services, Wallet, Earn, installed app) load in the same time as before, within run-to-run noise. One trade-off is explained in section 9: on the seasonal member homepage, the service announcement bar (the page's LCP element in the lab) arrives about 0.28 s later, because the seasonal page now downloads alongside the app and shares the connection.

## 2. Baseline findings

The baseline (`main` at `33c6826`) was measured with the same harness before any change.

- **Older numbers aren't comparable.** The Christmas Grand Finale report (375 KB / 58 requests / 2.7 s ordinary; 588 KB / 74 requests / 4.4 s seasonal) used a different build and configuration. Today's comparable baseline is lower in bytes because Cloudinary images can't be fetched here.
- **Greetings pages downloaded the commerce app.** `/g/…` and `/greetings` downloaded the whole Mystery Hub app and never ran it. That was about 160 KB of JavaScript and CSS, including checkout code. Release B had flagged this.
- **A first seasonal visit showed the wrong page first.** The seasonal status was asked for only after the app had downloaded and started.
  - So a first-time visitor in season saw the ordinary homepage (at about 2.3 s), which was replaced by the seasonal homepage about 1.2 s later. The seasonal hero appeared at 3.55 s and the serif at 4.2 s.
  - The ordinary page's hero and section images were requested and then thrown away.
  - The baseline LCP of 2.4 s was the ordinary headline that then disappears, so it made the seasonal page look better than it was.
- **Pages jumped while loading.** Measured CLS was Wallet 0.414, Earn 0.314, Data 0.274, More Services 0.156, member homepage 0.095 and seasonal member homepage 0.138. Section 4.4 traces each jump to the element that moved.
- **The Countdown repainted all the time.** With the page left open, the dial's ring and seconds light were redrawn on every animation frame. That cost about 1.1 s of main-thread work in every 5 s at 4× CPU, all day, on a page designed to be left open.
- **Background polling.**
  - An open receipt checked its order every 3 s for as long as it was open. That included time in the background, and payments already cancelled or expired.
  - Every part of a page that showed the catalogue ran its own minute timer and focus refresh: the homepage's featured Data, the Data page and the seasonal homepages.
  - The welcome-offer check ran every 30 s in a hidden tab.
- **Already good, left alone.**
  - The homepage hero image uses `srcset`, `sizes`, `fetchpriority="high"` and eager loading.
  - Lazy routes reserve their space.
  - The installed app has no offline cache, on purpose (section 8).
  - Service status and the session check are already shared and pause in the background.

## 3. Critical loading-path investigation

What a phone waits for, in order, on an app page (lab, ordinary guest homepage). It was traced with request waterfalls, `layout-shift` sources and Chromium performance traces:

1. **HTML** (1.7 KB Brotli). A small inline script in it starts the app download.
2. **Entry script and site stylesheet** (`index.js` 70 KB, `index.css` 26 KB). The render-blocking CSS, plus the Google Fonts stylesheet.
3. **App chunk and its imports** (`App.js` 89 KB plus about 37 small chunks, mostly icons).
   - Before this release, the preload script sat after the stylesheets, so it ran only once they had downloaded (about 0.66 s in).
   - It now runs first in `<head>`.
4. **App start**: the session check, service status and, in season, the seasonal status.
5. **Lazy route chunk** (Data, Orders, Wallet…), then the page renders. On the homepage, the homepage code is part of the app chunk.
6. **Below the fold**: images (Cloudinary), the Outfit and Plus Jakarta Sans fonts, the welcome-offer quote and the catalogue.

On this slow connection, what sets the time is the total bytes before first render, not the order of the requests: the connection is already full when the preload starts. Ideas that only reordered downloads didn't help, and some made things worse (section 9.3).

In season, step 4 used to decide which homepage to show *after* the ordinary one had rendered. Now the homepage asks for the status at step 1, and the seasonal homepage downloads with the app.

## 4. Changes implemented

### 4.1 The page's first script (`src/utils/startupHints.ts`, `vite.config.ts`)

The inline preload in `vite.config.ts` was replaced by one small ES5 script. It is generated at build time and placed before the first stylesheet.

- **Every app page.** It starts downloading the app, as before, with `crossorigin` so the browser reuses that download.
- **Pages that never run the app.** On Greetings (`/g`, `/greetings`), Countdown, business websites (`/sites/…`) and template previews, it does nothing. `main.tsx` serves those pages on their own, and the script uses the same path rules. A test reads `main.tsx` for each rule and fails if a new surface is added there without one.
  - Campaign short links (`/c/…`) also run without the app, but they forward the visitor into it, so the app download is kept there.
- **The homepage only.** It asks for `/api/seasonal/status` at once, with the same URL and headers the app uses.
  - If a pack applies today, it starts downloading that pack's homepage, the seasonal header and footer, and the pack's serif stylesheet.
  - It picks the guest or member homepage from whether this device holds a session, in either storage: "remember me" or this session only.
- **It only downloads.** It runs no app code, applies no styles and decides nothing.

`SeasonProvider` now starts from that early answer when it's there and is newer than the stored one (`startingSeason`). It treats it like the stored last answer:
- it says which pack is on, and never corrects the clock;
- the provider still asks the server itself straight away and follows the server.

Usually the app's own first check is answered from the browser's copy of the early answer. If it starts while the early request is still on its way, a browser may send it again, which is at worst one small extra request, as before.

### 4.2 Countdown dial (`src/countdown/Dial.tsx`, `countdown.css`)

- **Seconds light.** It is drawn in its own SVG layer (the dial's size) with `will-change: transform`. Its turn each second is now a compositor rotation, instead of a repaint of the whole dial on every frame of the movement. Geometry, timing and look are unchanged.
- **Ring.** The ring's dash offset now glides only in the final minute, where it moves a visible distance each second. Before that it moves less than a pixel a second, so it now steps once a second instead of being animated all day.
- **Reduced motion** still switches every animation and transition off.

### 4.3 Background requests (`src/utils/receiptChecks.ts`, `useDirectCatalog.ts`, `useWelcomeOffer.ts`)

- **Receipt.**
  - While an order can still move (pending payment, paid, queued, submitted, processing), it is still checked every 3 s, and never twice at once.
  - A **cancelled or expired** payment is still checked, because a late Mobile Money approval can turn it into a paid order. The schedule is gentler: 6, 12 and 24 s, then every 30 s.
  - In the background there are no checks, including one that was already due. Coming back checks at once and restarts the schedule.
  - Terminal orders are still never checked. Reconciliation and late-payment recovery are unchanged; they run on the server (payment webhooks), not in the receipt.
- **Catalogue.**
  - There is one refresh schedule for the whole page, however many parts show the catalogue: every minute while visible, and on return.
  - An answer under 30 s old is reused, whether a newly shown part or a minute tick right after a return asks for it. A failed read never counts as an answer.
  - Nothing runs while the page is hidden.
  - Checkout still asks the server for its own quote every time it opens, so prices at payment never come from this shelf.
- **Welcome offer.**
  - It is asked for once the server catalogue is on the page. The notice now appears once, instead of appearing, vanishing and coming back (two extra layout jumps and a wasted request).
  - Its 30 s re-check waits while the page is hidden.
  - Returning to the page still re-checks at once and drops a stale eligibility. On a computer that happens on focus; on a phone it happens on the page becoming visible. Both share one re-check.

### 4.4 Layout stability

Each jump was traced to the element that moved (`layout-shift` sources in a throttled browser), then fixed at the cause:

| Page | Cause | Fix |
|---|---|---|
| Every lazy page | The loading placeholder was 70 % of the screen, so the footer showed and then jumped away | The loading placeholder is a full screen (`100svh`). A load error keeps the old height, because it can also stand in for a small floating part |
| Seasonal homepages | The same, for the seasonal homepage placeholders (78 % / 62 %) | Full screen |
| Wallet | "Loading your balance…" was one line; the balance block is about 350 px | The loading state keeps that room (static placeholder shapes, status text unchanged) |
| Mystery Earn | The "Next:" line grows from one line to two; the share panel's topics wrap while loading; the referral code line appears later | Two lines are always kept for "Next:" on phones; the panel keeps its loaded shape while loading; the code line is held (invisible, hidden from screen readers) while loading |
| Member homepage (ordinary and seasonal) | The new-member line "Welcome to Mystery Hub. Let's get you connected." wraps on a phone and pushes the page down | Shortened to "Welcome! Let's get you connected.", which fits on one line at 320 px. **Copy change: founder may prefer the original.** The alternative is keeping two lines' space under the greeting |
| Data | The welcome-offer notice appeared, vanished and returned | Asked once, after the catalogue (section 4.3); see section 17 for the one shift left |

### 4.5 Accessibility fixes found in QA

- **Wallet.** For signed-in members, the page had no `h1`; "Mystery Wallet" was an `h2`. It is now the page's `h1`. It looks the same.
- **More Services search.** The search box had its focus outline turned off by a rule that cancelled the page's own focus ring (equal specificity, later in the file). The 2 px green ring is back; the green border on focus stays.

## 5. Image optimization

The sandbox can't reach Cloudinary, so image bytes and decode times couldn't be measured here. Instead, the review looked at what each page asks for:

- The homepage hero and the seasonal art already use:
  - responsive `srcset`/`sizes`, with `f_auto`/`q_auto`;
  - explicit dimensions or aspect ratios;
  - `fetchpriority="high"` and eager loading on the hero;
  - lazy loading below the fold.

  None of that changed. The real hero is not lazy-loaded.
- **Inventory at 390 px (QA script).** Every drawn image was checked: what it asks Cloudinary for, against the size drawn at up to 3× density, plus its dimensions and priority.
  - The creative-studio, seasonal and brand images ask for about 2.8–2.9× their drawn size, which is right for a 3× phone. They have dimensions and lazy-load below the fold.
  - The More Services illustrations have a 360/640/960 `srcset` for an 88 px slot. The smallest candidate is already right for a 3× phone.
  - One image has no intrinsic size: the Data-reseller artwork inside the homepage's website template preview. It sits inside the fixed-size preview frame, so it can't move the page. Template renderers are out of scope for this release, so it was left alone.
- No image format, size or priority needed changing. With Cloudinary blocked, the remaining image work (real bytes, decode time, the hero's actual LCP on a phone) can only be measured live or on a device.
- A first seasonal visit no longer requests the ordinary homepage's hero and section images before swapping them away. This holds when the early answer arrives before the app starts, which it did in every lab run: 31 image requests before, 19 after, for the same page.
- No Cloudinary asset was created, changed or deleted.

## 6. Bundle changes

No chunk was split, merged or moved. The Website Builder, editor, template renderers and Business Workspace were not touched.

| File (Brotli) | Before | After |
|---|---:|---:|
| HTML (`index.html`, including the first script) | 1.7 KB | 2.4 KB |
| Entry `index.js` | 70.0 KB | 70.0 KB |
| `App.js` | 89.3 KB | 89.5 KB |
| `DataPage` | 14.0 KB | 14.0 KB |
| `ChristmasHome` / `ChristmasMemberHome` | 12.4 / 7.9 KB | 12.4 / 7.9 KB |
| `CountdownPage` | 7.3 KB | 7.3 KB |
| `CreatorPage` / `RecipientPage` (Greetings) | 7.7 / 3.2 KB | 7.7 / 3.2 KB |
| Whole build, JavaScript and CSS | 900.3 KB | 901.0 KB |

The big saving isn't in file sizes but in what each page downloads. Here is the critical request chain for the Greetings recipient page:
- **Before:** HTML → entry → App chunk plus 37 chunks (never used) → recipient chunk.
- **After:** HTML → entry → recipient chunk.

The same applies to the Greetings creator, business websites and template previews. Countdown already didn't download the app.

## 7. API efficiency

Requests were counted at the local server, so browser cache hits don't count. The page's timers ran for 10 simulated minutes in view and 10 in the background (Playwright clock), then the tab was brought back:

| Page | Opening | 10 min in view | 10 min hidden | On return |
|---|---:|---:|---:|---:|
| Homepage, guest | 8 → 7 | 26 → 20 | 20 → 0 | 3 → 3 |
| Data Buying, guest | 5 → 4 | 23 → 21 | 20 → 0 | 3 → 3 |

- **What remains in view** is the catalogue once a minute and the welcome-offer check twice a minute (unchanged, by design), plus service status.
- **Signed-in pages** already paused the session refresh in the background.
- **The receipt schedule** is covered by tests rather than this count. A local order in a cancelled or pending state would need a real payment provider.
- **Not changed, on purpose:** checkout's own server quote, payment verification, order lookup by reference, the session check, service status (already one shared store with a 30 s throttle) and the seasonal status schedule. No cache lifetime was changed anywhere.

## 8. Mobile and PWA refinements

- **Installed app.** Startup in `display-mode: standalone` was measured (section 9, last row). It takes the same time as a browser tab, within noise. The manifest is standalone with 192 px, 512 px and maskable icons.
- **No offline cache, on purpose.** `public/push-sw.js` handles push notifications only. It has no `fetch` handler and caches nothing, so no payment, account or customer response can ever be served from a cache. A broad caching service worker was not added (master assignment section 40).
- **Phones.**
  - Loading states keep their space on every lazy page, so the footer no longer flashes up while a page loads.
  - A receipt left open while the customer approves in the Mobile Money app makes no requests until they come back, then checks at once.
  - The welcome offer re-checks when a phone brings the page back, not only on desktop focus.

## 9. Before-and-after measurements

### 9.1 Method

- Same harness, build settings, local API and throttling for both columns: cold cache, first visit, nothing stored.
- **Before:** `main` at `33c6826`. **After:** this branch. Median of 5 runs.
- **Main content** is when the page's main heading (or first Data tile, or Countdown digit) is on screen.
- **Seasonal serif** is when the Fraunces font finished loading.
- **In season** is 10 December 2026, made in the lab by shifting the server's and the page's clock. It is not the founder preview.
- The local API has a live service announcement ("MTN Data purchases are paused for maintenance"). That bar is the LCP element on several pages.

### 9.2 Tables

| Page | LCP (ms) | Main content (ms) | Seasonal serif (ms) | CLS | TBT (ms) | Main thread (ms) |
|---|---:|---:|---:|---:|---:|---:|
| Homepage, guest | 2328 → 2372 | 2282 → 2325 | – | 0.017 → 0.017 | 0 → 0 | 924 → 970 |
| Homepage, guest, in season (first visit) | 2400 → 3664 ¹ | **3548 → 3052** | **4185 → 3566** | 0.082 → 0.068 | 206 → 234 | 2487 → 2574 |
| Homepage, member | 2588 → 2588 | 2214 → 2221 | – | **0.095 → 0.006** | 0 → 0 | 881 → 849 |
| Homepage, member, in season | 2396 → 2680 ² | **3163 → 2740** | **4050 → 3597** | **0.138 → 0.068** | 47 → 99 | 1500 → 1595 |
| Data Buying, guest | 2564 → 2500 | 2521 → 2468 | – | **0.274 → 0.117** | 243 → 228 | 1930 → 1872 |
| Data Buying, guest, in season | 2576 → 2600 | 2541 → 2570 | 3835 → 3774 | 0.168 → 0.170 | 267 → 278 | 2459 → 2308 |
| Orders, member | 2508 → 2516 | 2380 → 2365 | – | 0.002 → 0.002 | 0 → 0 | 815 → 788 |
| More Services | 2440 → 2476 | 2421 → 2449 | – | **0.156 → 0.000** | 32 → 32 | 869 → 902 |
| Wallet | 2400 → 2384 | – | – | **0.414 → 0.043** | 0 → 0 | 724 → 729 |
| Mystery Earn | 2880 → 2836 | 2527 → 2499 | – | **0.314 → 0.034** | 42 → 64 | 1081 → 1062 |
| Greetings creator | **2128 → 1708** | **2117 → 1692** | 2862 → 2422 | 0.009 → 0.009 | 0 → 0 | 517 → 530 |
| Greetings recipient | **1840 → 1348** | **1821 → 1328** | 2793 → 2283 | 0.002 → 0.002 | 0 → 0 | 403 → 377 |
| Mystery Countdown | 1620 → 1636 | 1364 → 1371 | 2332 → 2366 | 0.007 → 0.007 | 0 → 0 | **1132 → 910** ³ |
| Installed app (standalone), member | 2588 → 2648 | 2204 → 2277 | – | **0.095 → 0.006** | 0 → 0 | 847 → 979 ⁴ |

| Page | Total KB | Requests | JS KB | CSS KB | Font KB | Image requests (blocked) |
|---|---:|---:|---:|---:|---:|---:|
| Homepage, guest | 333 → 334 | 61 → 61 | 247 → 247 | 48 → 48 | 32 → 32 | 14 → 14 |
| Homepage, guest, in season (first visit) | 462 → 462 | 80 → 76 | 274 → 274 | 69 → 69 | 113 → 113 | **31 → 19** |
| Homepage, member | 374 → 376 | 62 → 63 | 247 → 247 | 48 → 48 | 75 → 75 | 3 → 3 |
| Homepage, member, in season | 496 → 497 | 81 → 81 | 269 → 270 | 65 → 65 | 155 → 155 | 7 → 5 |
| Data Buying, guest | 333 → 334 | 60 → 60 | 247 → 247 | 48 → 48 | 32 → 32 | 4 → 3 |
| Data Buying, guest, in season | 434 → 435 | 71 → 70 | 257 → 258 | 59 → 59 | 113 → 113 | 6 → 7 |
| Orders, member | 331 → 332 | 58 → 58 | 247 → 247 | 48 → 48 | 32 → 32 | 3 → 3 |
| More Services | 368 → 369 | 61 → 61 | 254 → 254 | 52 → 52 | 60 → 60 | 21 → 15 |
| Wallet | 340 → 342 | 63 → 63 | 256 → 256 | 48 → 48 | 32 → 32 | 3 → 3 |
| Mystery Earn | 400 → 401 | 71 → 71 | 265 → 265 | 55 → 55 | 75 → 75 | 3 → 3 |
| Greetings creator | **437 → 274** | **62 → 29** | **243 → 92** | 51 → 38 | 140 → 140 | 1 → 1 |
| Greetings recipient | **431 → 268** | **57 → 24** | **238 → 87** | 51 → 38 | 140 → 140 | 1 → 1 |
| Mystery Countdown | 263 → 264 | 28 → 28 | 87 → 87 | 33 → 33 | 140 → 140 | 1 → 1 |
| Installed app (standalone), member | 374 → 376 | 63 → 64 | 247 → 247 | 48 → 48 | 75 → 75 | 3 → 3 |

1. **Seasonal guest LCP went up because it now measures the real page.**
   - Before, LCP was the *ordinary* headline at 2.4 s, which was then thrown away and replaced by the seasonal homepage.
   - Now the seasonal homepage is the first homepage drawn. Its hero is on screen 0.5 s sooner, and its final typeface arrives 0.6 s sooner.
   - Chromium reports LCP again when the Fraunces font replaces the fallback (3 of 5 runs, about 3.6–3.9 s). In the other 2 runs it reported the announcement bar at 2.46 s.
   - The remaining cost is the font (section 17).
2. **Seasonal member LCP: a trade-off.**
   - In both builds, the LCP element here is the service announcement bar, which arrives with the app.
   - The seasonal member homepage now downloads alongside the app instead of after it. So the bar appears about 0.28 s later, while the seasonal page itself appears 0.42 s sooner and its typeface 0.45 s sooner.
   - The announcement bar only shows while an announcement is live.
   - Two ways to give the app the connection first were measured, and neither helped (section 9.3).
3. **Countdown.** This is main-thread work in the load window. Once settled, the page uses **1,136 → 206 ms** of main-thread work in every 5 s at 4× CPU, and the compositor thread uses 679 → 123 ms (Chromium trace, 5 s window after 6 s settled).
4. **Installed app.** The variant tested in section 9.3 doesn't affect this page, and in that run the same page measured 2,712 ms LCP and 1,045 ms main thread. The ±60 ms LCP and ±130 ms main-thread differences here are run-to-run noise.

**Interaction.** Opening checkout from a Data tile (Telecel, guest): dialog visible 283 → 294 ms, INP 216 → 224 ms. That's unchanged within noise; neither checkout nor its dialog code changed.

### 9.3 Tried, measured and reverted

Each of these was implemented, measured with the same harness and removed because it didn't help:

| Idea | Result in the lab | Why |
|---|---|---|
| Moving the app preload to the top of `<head>` | No measurable change in LCP on ordinary pages. Kept, because it costs nothing and the seasonal early answer needs it | The connection is already full at that moment |
| Also warming the current page's own chunk (Data, Orders, Wallet…) from the first script | Data +120 ms and Orders +140 ms slower | Downloading everything at once loses the overlap between the app starting (CPU) and the page chunk arriving (network) |
| Asking for the season and warming seasonal parts on every page, not only the homepage | Seasonal Data page +300 ms slower | The same: decorations competed with the page's own download |
| Warming only the seasonal homepage, without its header, footer and guest pack | Seasonal guest LCP 3.77 s vs 3.47 s with them | The missing parts were then fetched late, one after another |
| Requesting the serif font file early (at once, or at the load event) | No gain; seasonal member homepage +300 ms slower | The 82 KB font competes with the app |
| Seasonal downloads at low fetch priority, so the app goes first | Seasonal guest serif 3.57 → 3.80 s, member LCP 2.68 → 2.76 s | The seasonal parts then arrived after the app and still had to be drawn |

### 9.4 Re-check after the review fixes

The review fixes (section 18) changed the first script slightly and the receipt, catalogue and welcome-offer timers. The measured build and the final build were then timed back to back in the same session, 3 runs each. This session's machine was busier than during the 5-run tables, so both columns are a little slower than in section 9.2; compare them with each other.

| Page | LCP, measured build → final build (ms) | Main content (ms) | CLS |
|---|---:|---:|---:|
| Homepage, guest | 2448 → 2384 | 2405 → 2326 | 0.017 → 0.017 |
| Homepage, guest, in season | 3560 → 3744 | 3037 → 3019 | 0.068 → 0.068 |
| Homepage, member, in season | 2728 → 2584 | 2639 → 2813 | 0.068 → 0.068 |
| Data Buying, guest | 2720 → 2656 | 2660 → 2617 | 0.117 → 0.117 |
| More Services | 2500 → 2576 | 2475 → 2549 | 0.000 → 0.000 |
| Wallet | 2400 → 2504 | – → 2492 ¹ | 0.043 → 0.043 |

The differences go both ways and are within run-to-run noise for 3 runs. Bytes and requests are identical.

1. Wallet now has a main heading (`h1`) to time.

## 10. Accessibility findings

`scripts/reviewMobile373.cjs` ran in Chromium against the local build, with synthetic members and the founder preview link for the seasonal pages:

**128 of 128 checks passed** (Chromium 390 px unless stated; axe-core 4.10.2):

| Check | Pages | Result |
|---|---|---|
| No sideways scrolling and no script errors at 320, 360, 390, 430, 768, 1280 and 1440 px | All 11 (guest and member homepage, both seasonal homepages, Data, More Services, Orders, Wallet, Earn, Greetings creator, Countdown) | 77 / 77 |
| axe, WCAG 2.2 A and AA tags | All 11 | No violations |
| Keyboard: the first 20 Tab stops each show a visible focus | All 11 | Pass, after the More Services search fix (section 4.5) |
| Touch targets under 24 × 24 px (outside inline text links and labelled controls) | All 11 | None |
| Short screens: 390 × 568, 844 × 390 (landscape) and 1280 × 600; main heading on screen, no sideways scrolling | Seasonal homepage, Data, Countdown, guest homepage | 6 / 6 |
| Reduced motion: nothing animates endlessly or transitions | Seasonal guest and member homepages, Countdown | 3 / 3 |
| Text at 150 % (root font size): no sideways scrolling, no clipped heading | Homepage, both seasonal homepages, Data, Wallet, Earn, Countdown | 7 / 7 |
| Installed app (`display-mode: standalone`, member homepage) | Member homepage | Pass |
| PWA files: standalone manifest with 192 / 512 / maskable icons; the service worker only handles push (no `fetch` handler, no caches) | `manifest`, `push-sw.js` | Pass |

Found and fixed during QA:
- the More Services search box had no visible focus ring;
- the signed-in Wallet page had no `h1` (section 4.5).

Two QA-script issues were corrected, not hidden:
- the Data short-screen check looked for the first Data tile instead of the page heading;
- this Chromium ignores `display-mode` media emulation, so the installed-app check now answers the app's own `matchMedia` check, as the timing harness does. CSS `display-mode` rules are not emulated.

**Not covered here:**
- **Browsers.** Firefox and WebKit (Safari) are not available in this sandbox.
- **Assistive technology.** Screen readers were not run (VoiceOver, TalkBack).
- **Touch.** Only emulated touch, no real gestures.
- **Text size.** "150 %" scales the root font size. It is not the phone's own text-size setting.

All of these are on the physical-device checklist (section 15).

## 11. Screenshots

The screenshots are in [`docs/screenshots/performance-mobile-3-7-3/`](screenshots/performance-mobile-3-7-3/), taken during the local review in Chromium with synthetic members. Cloudinary is blocked in the sandbox, so photographs and the brand mark show their fallbacks.

| Screenshot | What it shows |
|---|---|
| `home-390.png` | Guest homepage (ordinary) |
| `home-season-390.png`, `home-season-1280.png` | Seasonal guest homepage (founder preview link, 10 December), phone and desktop |
| `home-member-season-390.png` | Seasonal member homepage, with the shortened new-member line on one line |
| `home-member-standalone.png` | Member homepage as the installed app |
| `data-390.png`, `data-short-390x568.png` | Data Buying, and on a short phone |
| `services-320.png` | More Services at 320 px |
| `orders-390.png` | My Orders (member) |
| `wallet-390.png` | Wallet (member) |
| `earn-390.png`, `earn-text150.png` | Mystery Earn, and with text at 150 % |
| `greetings-390.png` | Mystery Greetings creator |
| `countdown-390.png`, `countdown-reduced-motion.png` | Mystery Countdown, and with reduced motion |

The service announcement in the screenshots comes from the local test API, not production.

## 12. Traces and evidence

- [`docs/evidence/performance-mobile-3-7-3/lab-results.json`](evidence/performance-mobile-3-7-3/lab-results.json) holds both builds.
  - For every page: the medians, the LCP element, and for the median run each layout shift with the time and the elements that moved.
  - The full per-run results (about 0.9 MB per build) and the Chromium traces stayed in the sandbox; they can be regenerated with section 19.
- Layout-shift sources, before → after (median run):
  - **Wallet:** the footer moved twice (0.204 + 0.210) → once, 0.043.
  - **Earn:** the footer (0.156) and the share, summary and milestone areas (0.157) moved → the share actions moved, 0.034.
  - **More Services:** the footer moved (0.156) → no shift.
  - **Member homepage:** the primary actions moved down (0.095) → the services row moved, 0.006.
  - **Data:** the footer (0.156) and the welcome notice (0.117) moved → the welcome notice only, 0.117.
- **Countdown trace (5 s, settled, 4× CPU)**, before → after:
  - main thread 1,136 → 206 ms;
  - `ProxyMain::BeginMainFrame` 1,052 → 164 ms;
  - paint 386 → 41 ms;
  - layerize and pre-paint about 230 → under 20 ms each.
- **Background traffic:** counted at the local server for 10 simulated minutes (section 7).
- **Waterfalls:** Greetings before and after (section 6), and the seasonal homepage: the seasonal chunks now start with the app instead of about 2.3 s in.

## 13. Regression results

- Type check (`npm run lint`, `tsc --noEmit`) passes.
- Build (`npx vite build`) passes.
- Tests: `npm test`: **3,803 tests, 3,741 pass, 0 fail, 62 skipped.** The skipped tests need services that aren't available in this sandbox (such as a database).
- **New tests:** `server/suppliers/__tests__/performanceMobile373.test.ts` (15 tests). They:
  - run the first script itself for every kind of path: business websites, Greetings, Countdown, previews, campaign links, the homepage and other app pages; signed in with or without "remember me", blocked storage; in season or not; failed or odd answers; browsers without `fetch`;
  - check that every surface `main.tsx` serves without the app has a rule;
  - check that the script is placed before every stylesheet in the built HTML;
  - run the receipt and catalogue schedules on a fake clock, including a page hidden while a check is due;
  - render the dial;
  - pin the loading-space fixes.
- **Updated tests:** six older tests. Five pinned the exact text of the replaced preload script or of the receipt's `setInterval`, and now check the same behaviour through the new modules. One pins the member subline copy.

## 14. Remaining 3.5 handoffs (Codex, backend)

1. **Another customer's order reference in MTN conflict answers (privacy).**
   - `server/routes/api.ts` returns `existingOrderReference` (and its status) in the `ACTIVE_MTN_ORDER` 409 responses for Instant Bundles (about lines 560 and 638) and Airtime (about lines 737 and 833).
   - The active order is found by the recipient's phone number. So anyone buying for that number can learn the reference of someone else's order and look it up.
   - Suggested fix: return the reference only to the same signed-in owner (or not at all), and keep the generic message.
   - Not changed here (backend).
2. **Receipt updates.** The receipt still polls every 3 s while an order moves. A server push or a long poll would remove most of these requests.
3. **Seasonal status with the page.** Serving the season (and any live service announcement) in the HTML would remove one more round trip on the homepage, and the announcement shift.
4. **Real-user measurement.** Collect LCP, INP and CLS from real visits (the `web-vitals` library into the existing analytics events), so the 75th percentile can be reported by page and network.
5. **Paystack script.** `usePaystack` loads Paystack's script when checkout mounts. Its cost couldn't be measured here (blocked). Evaluate deferring it until a payment starts, with field data and a payment test on a real device.

## 15. Physical-device checklist

To be done by a person on real phones: ideally a low-cost Android (2 GB RAM, Android 11–13, Chrome) and an iPhone (Safari), on mobile data.

- [ ] Homepage and Data open quickly on a cold start; the footer does not flash up while a page loads.
- [ ] In season (or with the founder preview link), a first visit opens straight on the seasonal homepage, with no ordinary homepage in between.
- [ ] Greetings: open a greeting link from WhatsApp. The page appears quickly and nothing else downloads (check data usage).
- [ ] Countdown: leave it open for 10 minutes on battery. The phone stays cool, the seconds light moves smoothly and the last minute glides.
- [ ] Open a receipt, switch to the Mobile Money prompt and approve. On return, the receipt updates at once.
- [ ] A cancelled payment's receipt left open still turns paid if approved late.
- [ ] Wallet and Mystery Earn don't jump while loading; the referral code and the share buttons appear in place.
- [ ] Installed app (Add to Home Screen) opens standalone, and push notifications still arrive.
- [ ] Text size at the largest setting: no sideways scrolling on the homepage, Data, Wallet, Earn or Countdown.
- [ ] VoiceOver (iPhone) and TalkBack (Android): loading states are announced once; Countdown announcements are unchanged.
- [ ] Safari only: the seasonal serif appears, and the dial's seconds light is aligned with the ring.

## 16. Deployment verification

Recorded on 28 November 2026 (UTC), after the merge.

| Step | Result |
|---|---|
| Pull request | [#157](https://github.com/MysteryOrganization173/MYSTERY-HUB/pull/157). Reviewed head `bad4e5c`, based on `main` at `33c6826`; `main` had not moved, so nothing needed integrating |
| CI on the pull request | `backend-rls` passed (06:08–06:10) |
| Merge | Normal merge commit `aca9351` at 06:11. Its tree (`2c3bace`) is identical to the reviewed head's |
| CI on `main` after the merge | Database security run 182 on `aca9351` passed (06:11–06:12) |
| Deployment | At about 06:14, `https://mysterybundlehub.com/assets/index-CFc4Nm_B.js` answered 200 as JavaScript, starting with the same text as the local build of the merged tree. That build's file name is a content hash. The previous entry, `index-BzMsjhbW.js`, is no longer served. So production serves this release's build |
| Live pages (read-only) | `/` answered 200 ("Mystery Hub — Digital Services Marketplace in Ghana") and `/countdown` answered 200 ("Countdown to 2027 · Midnight in Accra — Mystery Hub") |

**Not verifiable from this sandbox.** The network policy blocks `mysterybundlehub.com` for browsers and scripts here, and the read-only fetch tool returns page metadata rather than raw HTML. So none of these were checked live:
- the first script in the live HTML;
- live timings;
- the Greetings download;
- the receipt and catalogue schedules;
- images.

The physical-device checklist (section 15) covers them.

No production setting, secret, flag, schema or Cloudinary asset was changed.

## 17. Remaining limitations

- **Seasonal homepage LCP.**
  - The seasonal hero is on screen about 0.5 s sooner. But its headline is set in Fraunces, and the browser reports LCP again when the font arrives (about 3.6 s in the lab). That is still above the 2.5 s reference.
  - The font is 82 KB. **Founder option, not applied:** a fixed optical size (`opsz 72`) makes it 45 KB (−37 KB per first seasonal visit) and keeps both weights, but small seasonal text would look slightly different. Using only one weight would also halve it, but would change the hero's weight.
- **Seasonal member homepage.** The service announcement bar arrives about 0.28 s later than before while an announcement is live (section 9, note 2).
- **Data page welcome-offer notice.**
  - The server-confirmed notice appears above the Data hero when the quote arrives, and moves the page (CLS about 0.12 for guests).
  - Showing it before the server confirms it would be wrong, and so would holding empty space for an offer that may not exist.
  - Fixing it means a placement decision (for example, below the store title), which is a design choice for the founder.
- **Service announcements.** When an announcement is live, its bar arrives with the service status and moves the seasonal homepage placeholder down once (CLS about 0.07).
- **Lab only.** There is no field data. Cloudinary images, Paystack, Firefox, Safari and real devices were not measured.

## 18. Independent review

A separate reviewer, who didn't write the change, read the full diff and the draft of this report against the master assignment's constraints. The review was read-only.

**Verdict: no blockers.** None of the hard constraints was broken:
- no payment, authorization, supplier or service-control bypass;
- checkout still uses its own server quote;
- no cache lifetime changed;
- the service worker still has no `fetch` handler;
- nothing in `server/`, `shared/`, `public/`, the Website Builder, editor, template renderers or Business Workspace changed;
- no secrets.

The reviewer also checked and confirmed:
- the head script's escaping and path rules;
- the preload de-duplication and `crossorigin`;
- that SeasonProvider never takes the clock correction from the early answer;
- no timer leaks or overlapping checks in the receipt schedule;
- the catalogue's shared subscriber counting;
- the dial geometry and reduced motion;
- the loading states' announcements.

| # | Finding | Severity | Resolution |
|---|---|---|---|
| 1 | Members signed in without "remember me" (session kept in `sessionStorage`) were treated as guests by the first script, which warmed the guest seasonal homepage | Should fix | Fixed: both storages are read, each guarded; tests for session-only and blocked storage |
| 2 | The receipt still made one check after the page was hidden, if a check was already armed | Should fix | Fixed: hiding drops the armed check and a due check waits for the page to be visible; tests for both |
| 3 | One catalogue test assertion could never fail (the failing stub didn't count requests) | Should fix | Fixed: the stub counts; the test now shows that a return after a failure asks again |
| 4 | The early answer would win over a newer stored answer if SeasonProvider remounted | Nit | Fixed: the newer answer wins |
| 5 | Edge cases against `main.tsx`: `/sites/` with no name and an empty `preview_template_id` serve the app but got no warm-up; the parity test checked one direction only | Nit | Fixed: same rules as `main.tsx`; the test now fails if `main.tsx` gains a surface without a rule. Campaign links keep the app warm-up on purpose |
| 6 | The pack lookup was a plain object lookup (`constructor` would be truthy) | Nit | Fixed: own-property check; tested |
| 7 | JSON in the inline script wasn't escaped for `<` | Nit | Fixed (build-time values only, but now escaped) |
| 8 | Whether the app's own first check reuses the early answer depends on timing | Nit | Wording in section 4.1 corrected |
| 9 | The load-error state also became full-screen, including for a small floating part | Nit | Fixed: errors keep the earlier 70 % height |
| 10 | Earn's two-line reservation applies at all times on phones, not only while loading | Nit | Comment corrected (the reservation is intended) |
| 11 | The catalogue's minute tick ignored an answer that had just arrived | Nit | Fixed: a tick within 30 s of an answer reuses it; tested |
| 12 | On a phone, returning to the page may send only `visibilitychange`, so the welcome-offer re-check could wait up to 30 s | Nit | Fixed: either event re-checks at once, once per return; tested |
| 13 | Report claims: "refund pending" listed as checked every 3 s (it is terminal), "small SVG layer", "five" updated tests, the ordinary images claim, a code comment listing checkout | Nit | All corrected |
| 14 | Lab servers listened on every interface; the path guard accepted sibling folders | Nit | Fixed: loopback only, strict guard |

The reviewer also asked for a founder OK on the shortened new-member line in the Christmas member view (section 4.4). It is listed as a founder decision.

After the fixes, the full test suite, type check, build and QA were run again (section 13). The fixes don't change what is downloaded on ordinary pages or in which order, so the timing tables stand. The rebuilt page script is 58 bytes larger (Brotli); a short timing re-check after the fixes is in section 9.4.

## 19. How to repeat the measurements

```sh
npx vite build                                   # the build to measure
# a local in-memory API on :3911 (never production); for a season, start it with SEASONAL_EXPERIENCE=christmas-2026
PERF_DIST=dist PERF_RUNS=5 node scripts/reviewPerformance373.cjs        # page timings (needs Playwright)
QA_AXE=/path/to/axe.min.js node scripts/reviewMobile373.cjs             # mobile and accessibility review
```
