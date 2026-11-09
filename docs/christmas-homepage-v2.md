# Christmas homepage v2: "The Gift of Connection — Christmas After Dark"

Mystery Hub 3.2, Focused Assignment 01. This replaces PR #105's decorated homepage with a homepage composed for Christmas, for
signed-out visitors only, while a season is on. The ordinary homepage, every other page and the signed-in homepage are unchanged.

**Status:** preview only. The season stays **off** by default (`SEASONAL_EXPERIENCE` unset). This work is not merged and not activated.

## How to review it

Run the app and open the homepage with a preview date (this browser tab only; nothing changes for anyone else):

| Date | URL |
| --- | --- |
| Christmas season | `/?season-preview=christmas-2026&season-date=2026-12-10` |
| Christmas Eve | `/?season-preview=christmas-2026&season-date=2026-12-24` |
| Christmas Day | `/?season-preview=christmas-2026&season-date=2026-12-25` |
| Boxing Day | `/?season-preview=christmas-2026&season-date=2026-12-26` |
| New Year's Eve | `/?season-preview=christmas-2026&season-date=2026-12-31` |
| New Year's Day | `/?season-preview=christmas-2026&season-date=2027-01-01` |

**Exit preview** in the ribbon (or `?season-preview=off`) returns the tab to the ordinary site. Admin → Seasonal also links to these previews.

## Creative concept

*Mystery Hub Christmas After Dark: the gift of connection.* A warm evening in Ghana, with the services people rely on presented as gifts:

- **Palette:** night evergreen (`#050d0a`, `#0f3a2b`), Mystery Hub green (`#00c365`, kept for actions), champagne gold (`#e9b949`, `#f3d79a`), berry and wine (`#b3263f`, `#3a0f1c`), cream paper (`#fbf4e6`).
- **Type:** Outfit and Inter as usual. Fraunces italic is used sparingly, for the greeting and one accent word per heading. It loads only with the season.
- **Materials:**
  - wrapping paper and satin ribbon (service cards, website frame, "Still wrapped" panel);
  - a velvet tray and a paper receipt (data);
  - an envelope and letter (Mystery Greetings);
  - kraft parcels and gift tags (Marketplace);
  - pegs on twine (Creative Studio);
  - a cream letter card (help).
- **Ghana, not snow:** the kicker reads *Afehyia pa* (Akan season's greeting). Greetings address Ghana nationally ("Merry Christmas, Ghana."). There is no snow imagery.
- **Art:** every illustration is drawn in code (SVG/CSS), with no stock images and no new raster files. Real imagery is reused where it is the product:
  - live template designs, through the real renderer;
  - Marketplace product photos;
  - Studio Concepts sample designs.

## Architecture

- `HomePage` checks the member branch first, then shows `<SeasonalHome fallback={<NormalGuestHome />} />` only while `season.active` (that is, signed out, with the season on or previewed). Otherwise it renders `<NormalGuestHome />`. That component is the ordinary homepage, unchanged and in the same order.
- `SeasonalHome` lazy-loads `src/seasonal/christmas/home/ChristmasHome.tsx` as its own chunk, with one retry. An error boundary falls back to the ordinary homepage if loading or rendering ever fails. While it loads, a dark placeholder of the same height holds the space.
- The shell gets `data-season-page="<page>"`, so homepage-only shell changes stay scoped:
  - the shared light strand and the footer greeting step aside on the homepage, because the page composes its own;
  - the footer joins the sign-off without a gap.
- **No residue when off:** `Hero.tsx` and `MobileNav.tsx` are byte-for-byte as before PR #105. Every homepage style sits under the `xh-` namespace, and no file outside `src/seasonal/christmas/home/` uses that namespace (enforced by a test).
- **Files:**

  | File | What it is |
  | --- | --- |
  | `ChristmasHome.tsx` | Sections and behaviour |
  | `heroArt.tsx` | The hero scene |
  | `homeArt.tsx` | Service art, bows, envelope, parcels, pegs |
  | `christmasHome.css` | Styles |
  | `../font.ts` | Seasonal serif loader |

## Section-by-section audit

Each row covers: the ordinary presentation, what was wrong in PR #105, the redesign and its interactions, layout, and remaining concerns.

### Header
- **Ordinary:** dark bar with logo, navigation and Sign Up.
- **PR #105 problem:** a repeated light strand hung under the header on every page, including directly above the hero's own lights.
- **Redesign:** on the homepage the strand is hidden. The hero carries a single swag of lights, part of its composition, that fades out at both ends. Other pages keep PR #105's treatment, which is outside this assignment.
- **Mobile/desktop:** unchanged layout.
- **Remaining:** the preview ribbon still reads "Christmas preview" on New Year dates (it names the pack, not the day).

### Hero
- **Ordinary:** "Everything digital. One trusted place." over a city skyline, with two actions.
- **PR #105 problem:** the same skyline with ornaments hung over it, a greeting pill and a separate countdown card.
- **Redesign:** an original scene. A velvet evergreen gift with a champagne ribbon lets light out. Data, Airtime, Websites and Shop rise from it as glass tiles along fine streams. One swag of fairy lights hangs overhead, and a paper tag carries the day count.
  - The greeting is the headline: "Merry Christmas, Ghana." in serif gold, with the kicker *Afehyia pa*.
  - The brand line, lede, **Create a Free Website** and **Buy Data** stay, with the same destinations.
- **Phases:**

  | Date | Scene |
  | --- | --- |
  | Through December | Lid ajar, light escaping |
  | 24 Dec | "Tomorrow is Christmas Day" |
  | 25 Dec | Lid lifted, bright light, confetti, "Merry Christmas, Ghana!" |
  | 26 Dec | Lid set down on the floor (the gift has been opened), "Happy Boxing Day, Ghana." with its own tag |
  | 31 Dec | "Tonight we welcome 2027" |
  | 1 Jan | "2027 Happy New Year" |

- **Motion:**
  - Entrance: the gift rises, the bow ties, bulbs light, tiles float up, the tag swings in.
  - A tap on the gift hops the lid and releases sparks.
  - Idle bob and twinkle run only on hover-capable desktops of at least 900 px, and only while the hero is on screen.
- **Mobile:** stacked greeting → scene → headline → actions. The scene is full-bleed and cropped from the sides of a 640×560 composition. Actions stack below 400 px.
- **Desktop:** two columns, with greeting and headline left and the scene right. The greeting scales so "Merry Christmas," fits on one line.
- **Remaining:** on a short Android viewport, the second action can sit just below the first screen. The New Year phases reuse the Christmas gift scene, with new words and tag only.

### Service cards ("Everything, wrapped in one place")
- **Ordinary:** six dark icon tiles.
- **PR #105 problem:** the same tiles, with one bow on the first.
- **Redesign:** six gifts, each with its own wrapping paper and illustration:

  | Service | Paper | Illustration |
  | --- | --- | --- |
  | Data | Pine pinstripe | Phone sending waves |
  | Airtime | Berry polka | Coin dropping into a phone |
  | Website Builder | Cream lattice | Browser with a festive page |
  | Mystery Earn | Gold dots | One gift passing to a friend (referrals, not a giveaway) |
  | AFA | Midnight diamonds | SIM and shield, no network logo |
  | Marketplace | Kraft | Parcels and a swinging tag |

  - A satin ribbon and bow wraps each card's corner. Labels, availability tags and destinations are exactly those of the ordinary homepage.
- **Interactions:** each card plays its own one-shot reaction on press, keyboard Enter/Space, or hover on desktop:
  - Data: the phone buzzes and the waves ripple.
  - Airtime: the coin drops in.
  - Website Builder: the page lights up and the cursor clicks.
  - Mystery Earn: the gift hops along the path.
  - AFA: a shine sweeps the SIM.
  - Marketplace: the parcel hops and the tag swings.

  Reactions never delay or swallow the click (navigation is verified for all six). On arrival the gifts are set down in sequence and their ribbons tie.
- **Layout:** 2 columns on phones, 3 on tablets, 6 on desktop. Descriptions reserve two lines, so titles align.
- **Reduced motion:** static cards, everything visible.

### Featured Data
- **Ordinary:** network tabs, four popular bundles, a buying explainer.
- **PR #105 problem:** unchanged.
- **Redesign:**
  - A velvet tray holds the same network switch. A ribbon slides to the chosen network and takes its brand colour (MTN yellow, AirtelTigo blue, Telecel red).
  - The same `CompactBundleRow` rows show live prices and the welcome-offer note, and **Buy** opens the existing checkout.
  - "How buying works" becomes a paper receipt with the same three facts and "Track an existing order".
- **Mobile:** receipt below the tray. Step descriptions are hidden below 480 px; the titles carry the facts.
- **Desktop:** tray and receipt side by side, with the receipt slightly turned.
- **Remaining:** none known. Prices and checkout are untouched.

### Countdown
- **Before:** PR #105 showed a separate countdown card.
- **Now:** the day count from the season calendar ("15 days until Christmas", "Tomorrow", "Today is Christmas Day") is written on the gift tag, and repeated as screen-reader text.
- It is a day count, not a ticking clock. There is no fake counter and no claim to be the New Year countdown.
- **Integration point:** `HeroScene` takes `countBig` and `countSmall`. A future live countdown can supply them from `/api/experiences/countdown` (see the handoff below).

### Mystery Greetings (share section)
- **Before:** PR #105's share band looked detached from the page.
- **Now:** a wine-lit section previews the coming feature. An envelope opens, and a sample letter ("Dear Ama… — Kojo", labelled *Sample greeting*) rises out of the pocket; pressing it makes the letter peek further.
- The copy says plainly: **Coming soon** and "Not open yet. We'll show it here when it is ready."
- There is **no** create button, link or API call. The only action is "Share the Mystery Hub website on WhatsApp", which shares the real site URL and is labelled as exactly that.
- **Integration point:** `Greetings` accepts `createHref`. Pass the real creator route when PR #104's greetings ship, and the **Create a greeting** button appears.

### Install promo
- **Ordinary:** the existing `InstallAppPromo` card, shown only where installing can work.
- **PR #105 problem:** unchanged.
- **Redesign:** the same component, unchanged in behaviour, set beside a small phone mockup. The phone shows the real day ("10 Dec"), "Merry Christmas" and the Mystery Hub icon glowing among the apps.
- The whole band is hidden unless the promo renders (`:has(.mh-install-promo)`), so it never shows an empty frame, never auto-prompts and never claims success.
- **Verified:** Android Chrome and Chromium desktop, using a stand-in browser install event; **Install** was never pressed. In headless iPhone emulation the promo correctly stays hidden.

### Website Builder
- **Ordinary:** copy, steps and a live template card.
- **PR #105 problem:** unchanged.
- **Redesign:** a cream browser frame, wrapped with a berry ribbon at the corner, shows the real `TemplateCardPreview` (live renderer, sample content labelled).
  - The copy keeps the real design count and the three steps (gold numbered seals).
  - "Preview a design" chips are tag-shaped and open the real template preview.
- **Mobile:** chips scroll horizontally.
- **Remaining:** none. No template, editor or publishing code is touched.

### Marketplace
- **Ordinary:** category tiles and featured products.
- **PR #105 problem:** unchanged.
- **Redesign:** a stack of kraft parcels tied with twine, with a red tag reading "Merry Christmas" or "Happy New Year". Pressing it makes the front parcel hop.
  - The category shortcuts become cream gift tags, with only the active categories shown, as before.
  - Featured products keep their photos, prices, path labels and Buy/Enquire actions.
- **Remaining:** no featured products appear locally (no database). In production they render in the same grid.

### Creative Studio entry
- **Ordinary:** a promo card.
- **PR #105 problem:** unchanged.
- **Redesign:** three real Studio Concepts designs hang from wooden pegs on a sagging twine like Christmas cards. They sway in on arrival, and pressing one makes it sway.
  - The caption says "Studio Concepts: sample designs for fictional brands."
  - The copy mentions church programmes and end-of-year parties.
  - No prices are shown, and payments stay off.

### Coming Soon
- **Ordinary:** a list of planned services.
- **PR #105 problem:** unchanged.
- **Redesign:** "Still wrapped: more services on the way". The panel has a dashed outline, faint pinstripe paper and a gold corner ribbon, and each planned service is sealed with a berry wax seal.
  - The badge reads **Coming soon · Not available yet**, and the links open the existing service previews.
- **Mobile:** shows four seals, with "See What's Coming" for the rest.

### Trust / support and FAQ
- **Ordinary:** "Need help with an order?" card and the FAQ accordion.
- **PR #105 problem:** unchanged.
- **Redesign:**
  - The help card becomes a cream letter with a margin line and the same words, actions and MoMo PIN safety line.
  - The FAQ keeps `FaqAccordion` with `HOME_FAQS`, restyled with champagne accents.
  - No numbers, testimonials, awards or guarantees were added.

### Sign-off and footer transition
- **Ordinary:** the footer follows the FAQ.
- **PR #105 problem:** a separate footer greeting with its own repeated lights, signed "From all of us at Mystery Hub, Accra."
- **Redesign:** a short sign-off closes the page:
  - a row of glowing lights;
  - "Wishing you a wonderful Christmas." in serif;
  - "With love from Mystery Hub, Ghana. *Afehyia pa!*"

  It runs into the footer with no gap, and the footer keeps its content. The seasonal footer greeting used on other pages now also says "Ghana".
- **Note:** the ordinary footer's copyright line "Accra, Ghana" is the business address and was left as is.

### Bottom navigation (phones)
- **Before:** PR #105 attached a Santa hat to the Home icon, and it looked attached rather than designed.
- **Now:** the hat is **removed** (Option B). The selected tab keeps its brand-green pill, finished with a fine champagne ring and one small four-point sparkle.

## Motion system

- **Three kinds of motion, transform and opacity only** (enforced by a test):
  - entrance: once per composition, as it scrolls into view;
  - user-triggered: one short reaction per press, tap, keyboard activation or desktop hover;
  - state-driven: the hero's lid position by phase, and the data ribbon sliding to the chosen network.
- **Idle loops:** only the hero tiles' bob and a few bulbs' twinkle, and only under all of these conditions:
  - a hover-capable screen of at least 900 px;
  - motion allowed;
  - the hero on screen (an IntersectionObserver toggles `data-xh-visible`).
- **Reveal safety:** content is visible by default. A section is held back for its entrance only when IntersectionObserver exists and motion is allowed.
- **`prefers-reduced-motion: reduce`:** all animations and transitions stop, and nothing waits for a reveal. Verified in a browser: 0 running animations.

## Functional protections (verified in a browser, local server, synthetic data, no payment)

These checks ran on the local dev server:

| Check | Result |
| --- | --- |
| Hero **Create a Free Website** → `/website-builder` | Pass |
| Hero **Buy Data** → `/data` | Pass |
| All six service cards navigate (`/data`, `/data`, `/website-builder`, `/earn`, `/afa`, `/marketplace`); press reactions start and clear themselves | Pass |
| Network switch to Telecel shows Telecel bundles (`aria-pressed`) | Pass |
| A bundle opens the existing checkout with that bundle; closed with Escape, nothing submitted | Pass |
| Template preview opens from the Website Builder section and closes back to the Christmas homepage | Pass |
| Greetings offer only the honest website share link; no create button | Pass |
| **Exit preview** restores the ordinary homepage; a plain visit with the season off shows the ordinary homepage | Pass |
| Reduced motion: no running animations, no section held back | Pass |
| No horizontal overflow at 320, 360, 390, 430, 768, 1024, 1280 or 1440 px | Pass |

## Handoff for PR #104 (Codex, Seasonal Experience Core)

This work does not consume PR #104 and does not overlap its files. When PR #104 merges, the frontend can connect at these points.

**1. Phase names.** PR #104 uses underscores (`christmas_day`); this front end uses hyphens (`christmas-day`). Map with `phase.replace(/_/g, '-')`, or adopt one name set in a follow-up.

**2. Countdown.** `GET /api/experiences/countdown` returns `{ target, serverTime, remainingMs, passed }` and targets 1 January 2027 00:00 UTC.
- Compute the clock offset from the request midpoint.
- A future live New Year countdown can fill the hero tag through `HeroScene`'s `countBig` and `countSmall` (for example "4h 12m" / "until 2027").
- Until then, the tag shows only the calendar day count.

**3. Greetings.** When `MYSTERY_GREETINGS_ENABLED` and the creator route exist, render `<Greetings christmas createHref="/greetings/new" />` (or the real route). The recipient page `/g/:shareId` belongs to PR #104 and the follow-up frontend work.

**4. State.** `/api/experiences/state` can later replace or confirm `/api/seasonal/status` as the season authority, without changing this page. The page reads only `status.phase` and `status.date`.

## Tests and performance

**Tests:**
- `server/suppliers/__tests__/seasonalExperience.test.ts` gains three tests:
  - the homepage switch and fallback (members first, the ordinary sections intact and in order, no seasonal code in `Hero`/`MobileNav`, hat removed);
  - styles (`xh-` namespace only, transform/opacity keyframes and transitions, idle loops gated, reduced-motion stop);
  - honesty and facts (real catalogue and checkout hooks; no offers, numbers or promises; Ghana wording; no greeting API or create button; day count only; install hidden unless possible; Creative Studio without prices).
- The shell test was updated for `seasonShellAttributes(season, activePage)`.

**Bundle sizes**, gzip, versus `main` with PR #105:

| Chunk | main | this branch |
| --- | --- | --- |
| index JS | 73.46 KB | 73.55 KB |
| App JS | 79.05 KB | 76.84 KB |
| index CSS | 29.97 KB | 30.04 KB |
| Christmas pack JS / CSS (lazy, season only) | 5.98 / 5.20 KB | 3.55 / 3.39 KB |
| Christmas homepage JS / CSS (lazy, signed-out homepage during the season only) | — | 14.74 / 9.71 KB |

Ordinary visitors download about 2 KB less than today.

## Limitations

- **No new raster art.** Cloudinary image generation is over quota and Canva export needs design approvals, so all new art is SVG/CSS. That keeps it light and crisp, but it is illustration, not photography.
- **New Year phases** reuse the Christmas scene, with new words and tag only. A distinct New Year composition is a candidate for the next phase.
- **Other pages** keep PR #105's lighter treatment; this assignment covers the homepage only.
- **Device coverage:** iPhone Safari's Add to Home Screen path could not be reproduced in headless Chromium. Android Chrome and Chromium desktop were verified.

## Evidence

All evidence is in `docs/screenshots/christmas-homepage-v2/`:

| Folder or file | Contents |
| --- | --- |
| `01–03-compare-*` | Ordinary homepage vs PR #105 vs this redesign (first screen 390 and 1440, service cards) |
| `mobile-390/` | Every section, the first screen, the footer, and the install band on Android Chrome |
| `desktop-1440/` | Every section, the first screen, and a full-page overview |
| `phases/` | 10, 24, 25, 26, 31 Dec and 1 Jan heroes at 390 and 1440 |
| `interactions/` | Hero tap; all six card presses (rest vs mid-reaction, frames paused at the stated time); envelope; Creative Studio sway; Marketplace parcels |
| `reduced-motion/` | Hero and services with motion reduced |
| `functional/` | Checkout open, template preview, Telecel selected, after Exit preview |
| `responsive/` | First screens, services and data at 320–1440 px |
