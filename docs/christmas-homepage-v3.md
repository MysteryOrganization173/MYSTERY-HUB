# Christmas homepage V3: the refined guest homepage and a signed-in Christmas homepage

**Status: review only.** The season stays **off** by default: `SEASONAL_EXPERIENCE` is unset and nothing here changes it. This work is not merged and not activated. Prices, payments, orders, Wallet balances, suppliers, authentication rules, referral economics and discounts are untouched.

The work is delivered as two milestones on one branch:

| Milestone | Commit | What it covers |
| --- | --- | --- |
| Stage 1: guest | `d15fd82` | The refined signed-out homepage and the shared seasonal shell: logo hat, Sign Up, phone menu, footer, and the sign-up / sign-in invitation. |
| Stage 2: signed-in | see the PR | The signed-in Christmas homepage, the season for members, smooth sign-in and sign-out, and the final polish to the shell and the guest hero. |

## How to review it (works on a phone)

**1. Look at the evidence first.** Every screen below has a screenshot in `docs/screenshots/christmas-homepage-v3/`. Open the pull request in the GitHub app → **Files changed**, or browse that folder. Start with `compare/`: V2 (before) and V3 (after), side by side.

**2. Try it yourself (private to your browser tab).** Wherever this branch runs, add a preview to the homepage address. Nobody else sees it, and the ribbon at the top names the day being previewed.

| Day | Add to the homepage address |
| --- | --- |
| Christmas season | `/?season-preview=christmas-2026&season-date=2026-12-10` |
| Christmas Eve | `/?season-preview=christmas-2026&season-date=2026-12-24` |
| Christmas Day | `/?season-preview=christmas-2026&season-date=2026-12-25` |
| Boxing Day | `/?season-preview=christmas-2026&season-date=2026-12-26` |
| New Year's Eve | `/?season-preview=christmas-2026&season-date=2026-12-31` |
| New Year's Day | `/?season-preview=christmas-2026&season-date=2027-01-01` |
| Early January | `/?season-preview=christmas-2026&season-date=2027-01-03` |

- **Guest homepage:** open the link in a private tab, where you are signed out.
- **Signed-in homepage:** sign in first, then open the same link in that tab. Your own orders, Wallet and website appear exactly as they do today, presented for the season.
- **Leaving:** tap **Exit preview** in the ribbon, or close the tab.
- **Admin:** Admin → System Health → Seasonal experience also opens and copies these preview links. The panel now says who sees what (everyone gets the seasonal header, menu and footer; guests get every guest page; signed-in customers get the seasonal homepage).

On the live site the preview works only after this branch is merged and deployed. Even then the season stays off for every visitor until the `SEASONAL_EXPERIENCE` setting is changed, which is the founder's decision.

## Stage 1: the guest homepage, issue by issue

Each issue was reproduced and measured in a browser before it was fixed. The checks that guard the fixes run as browser tests (19 of 19 pass) and unit tests.

| # | Issue | Root cause | Fix | Verified by |
| --- | --- | --- | --- | --- |
| A1 | On phones, the hero art filled the first screen and the actions sat below it. | One wide composition (640×560) was simply scaled down to phone width. | A second, compact composition for phones (`HeroScene layout="compact"`): a flatter light swag, the gifts brought together, a 640×354 stage. The two actions sit side by side from 360 px. Short phones get two tighter tiers (up to 720 px and up to 600 px tall) that scale the scene as a whole. Gift taps are kept. | The actions' bottom edge was measured against the tab bar's top edge, as visitors see the page (without the founder-only preview ribbon), at 320×568, 320×640, 360×640, 375×667, 360×740, 412×732, 393×786, 390×844 and 430×932. The actions are clear of the tab bar at every size. At 360×640 they end at 465 px and the tab bar starts at 575 px. |
| A2 | Hat placement. | The V1 hat sat on the Home tab icon. V2 left a small star on the active tab. | A velvet Santa hat drawn for the brand mark's right peak (`LogoHat`). It is absolutely positioned, so the header keeps its size. It shows only through Boxing Day; from 27 December the site greets the New Year and the logo goes back to plain. Nothing seasonal is drawn on any tab icon. | Unit tests: one `logo-hat` slot, sitting after `BrandLogo`; no seasonal code in `MobileNav`; no `::before`/`::after` on the tab bar. Browser checks: hat on 10–26 December, gone from 31 December, gone when the season is off. |
| A3 | Header and phone menu. | The seasonal header was a light restyle, and the menu had no seasonal identity. | A seasonal Sign Up button (green, a champagne ring, one sheen). The phone menu gets a lit heading ("Afehyia pa · Merry Christmas from Mystery Hub"), 48 px rows and a gold bar on the current page (`aria-current`). The Navbar gained only class hooks and `aria-current`; its scroll lock, focus handling and Escape behaviour are untouched. | Browser: Escape closes the menu and focus returns to the menu button. Unit: Sign Up still calls `openAuth('signup')`. |
| A4 | Create Your Account / Sign In. | The dialog was the ordinary form with a small ornament. | A premium invitation: a lit banner with a gift and a sealed envelope, then "Your next chapter starts here" (Create account) or "Merry Christmas, welcome back" (Sign in; New Year wording from 27 December). Fields are 48 px with a green focus ring. Only a `variant="auth"` attribute reaches `SecurityDialog`. | Unit: the auth submit and validation code is unchanged. Browser: a short password is still blocked, Escape closes the dialog, and each mode shows its own line. |
| A5 | Service cards replayed their entrance on a press, on unrelated state changes, and after Back. | The entrance and the press reactions were CSS animations on the same elements. A press replaced the entrance animation, and a remount (Back) replayed it, sometimes from opacity 0. | A shared motion kit (`kit/motion.ts`). `useReveal` moves each section from armed to in to done, removes the entrance once it has played, and remembers it for the visit. A press animates only the card's inner artwork and clears itself when the last reaction ends. With reduced motion, or without IntersectionObserver, everything is shown at once. | Browser: presses start only press reactions; cards settle after arriving; Back replays nothing. |
| A6 | Ribbons looked flat and pasted on. | Every card carried the same corner bow, laid over its artwork. | Each card's wrapping is drawn as part of its paper, and the tie varies by card: Data, a satin gold band with a dimensional bow; Airtime, ivory satin; Website, a hanging tag; Earn, none (clearer); AFA, a pinstripe; Marketplace, twine. The Website Builder sample lost its ribbon (A9). | Screenshots `guest/*/03-services.jpg`, compare `03-service-cards-390.jpg`. |
| A7 | Featured Data and the Welcome Offer. | The offer notice was a plain line of text. | A foil-edged welcome card. Its headline, "Up to 18% off your first data bundle", is computed from the live offer and catalogue (see the welcome offer section below). The fine print names the plain amount and the exact bundle. It shows only for the server's `guest` or `eligible` state, once the catalogue is confirmed by the server. | Unit: the welcome-figure maths, including the 18% ceiling. Browser: the computed figure and fine print. |
| A8 | The envelope letter appeared below the envelope, taps reset it, and it seemed to re-render. | Measured: the letter rested 24 px below the envelope's bottom edge and was not clipped. Each tap swapped keyframe animations, so the entrance restarted. | The envelope is a two-state button (`data-state`, `aria-pressed`) moved only by CSS transitions. The letter lives in a letterbox clipped at the envelope's bottom edge. The flap turns in 3D and changes stacking at the moment it stands edge-on. It opens by itself once, when half visible; a tap toggles it; Enter and Space work; reduced motion makes it instant. | Browser: the letter's position over 20 repeated taps never goes below the edge; the clip; no keyframes on the letter; the keyboard opens it. Frames: `interactions/guest-envelope-*.jpg`. |
| A9 | Website Builder: an awkward ribbon, tag text overflowing, a late "refresh" decoration, an unclear selection. | The corner ribbon's entrance played about 470 ms after the frame, which looked like a refresh. Switching templates re-mounted the live preview with a flash. Long names overflowed the SVG tags. | A premium browser frame with an address pill ("Design preview · name") and no ribbon. Template chips are toggle buttons, with a check on the chosen one. The live preview is keyed by template and fades in. SVG tag text is fitted with `useFitSvgText` (`textLength`). | Browser: no delayed decoration; choosing a design switches the frame and marks it; every fitted text stays within its tag. |
| A10 | Pressing a Creative Studio design made it disappear and reappear. | The press "sway" animation replaced the hanging entrance animation on the same element; when it ended, the entrance restarted from opacity 0. | The entrance stays on the list item. The swing runs on the card through the Web Animations API and is ignored while one is already playing. | Browser: opacity stays 1 in every frame of the swing. Frames: `interactions/guest-creative-swing.jpg`. |
| A11 | Marketplace was too tall before its real content. | A large decorative heading. | A compact heading with a small parcel illustration beside it, so the real categories and products come sooner. | Screenshots `guest/*/08-marketplace.jpg`. |
| A12 | Install was unbalanced. | The copy column collapsed on desktop. | A balanced card (the phone and the copy) with explicit grid placement. The real install detection (`InstallAppPromo`) is unchanged and shows nothing where installing cannot work. | Screenshots `guest/*/06-install.jpg` (Android Chrome path simulated with the browser's own install event). |
| A13 | Coming Soon was too large and could read as available. | A full card grid. | A compact strip with three sealed items, "+N more", and the badge "Coming soon · Not available yet". Nothing in it is purchasable. | Screenshots `guest/*/10-coming-soon.jpg`. |
| A14 | The footer needed a full redesign. | — | A seasonal footer (`ChristmasFooter`): a national brand line ("Data, airtime, websites and tech for customers across Ghana…"); a support card (WhatsApp, phone, email, channels); grouped links; a legal row with MoMo chips; the location; and the Staff Portal link (`setActivePage('admin')`, unchanged authorisation). The ordinary footer is untouched and is the fallback. | Unit: every footer destination, and the ordinary footer still rendered as the fallback. Screenshots `guest/*/13-footer.jpg`. |

## Stage 2: the signed-in Christmas homepage

**B1. Same data, same actions.** `MemberDashboard` still owns all account data (orders, website record, retry) and is keyed by the session, so another account always gets a fresh dashboard. It builds one `view` object. While a season applies, `<SeasonalMemberHome view={view} fallback={<MemberHomeView {...view}/>}/>` presents that object; otherwise, or if the seasonal chunk cannot load or render, the ordinary `MemberHomeView` does, exactly as before. The seasonal view (`ChristmasMemberView`) fetches nothing and can start no payment. It reuses the ordinary view's own helpers for order selection, tone, steps, labels, next step and Buy again, and the same networks, titles and website states.

**B2. The season for members.**
- **Default off:** the switch is the same server setting as for guests. A preview works for both audiences, and the ribbon says what is affected when signed in.
- **No auth flicker:** the shell (hat, menu, footer) follows the season whatever the sign-in state. While a returning customer's session is checked, the season's quiet placeholder holds the page instead of the ordinary skeleton.
- **Preloading:** the member chunk starts downloading during that check, and when a guest opens Sign in or Create account.
- **Measured transitions:** guest Christmas home → Christmas placeholder → member Christmas home on sign-in, and member → guest Christmas home on sign-out. No ordinary page appears in between, and no account data remains after sign-out.
- **Fallback:** if the member chunk is blocked, the ordinary member homepage shows the same orders.

**B3. Welcome.** "Afehyia pa", the real time-of-day greeting, the customer's first name, the same state line as the ordinary page ("One of your orders needs attention." and so on), and a serif line: "Your digital world, wrapped for the season." (from 27 December, "…ready for the new year."). A small velvet gift lifts its lid when pressed; it opens nothing and gates nothing. A calendar line sits under it ("15 days until Christmas", "Tonight we welcome 2027").

**B4. Wallet.** The existing `HomeWalletSummary` (the real balance, Top Up, Wallet activity, the "cannot be withdrawn" disclosure) is restyled in place. When it cannot load it says "Balance unavailable. Retry" and never shows a number.

**B5. Buy Data and Airtime.** Two premium tiles: Mystery green with a champagne ring and a single satin sheen, and berry velvet. They open the same catalogue as today, with no "open a gift" step.

**B6. Orders: truth first.**

| State | What the customer sees |
| --- | --- |
| First purchase | "Start here · Your first order starts here.", network picks, "Or top up airtime" |
| Loading | "Loading your orders…" with a shimmer |
| Delivered | "Latest order", Delivered, Buy again (opens the catalogue only), Track Order |
| Processing | "Order to follow", the live status, and only the steps the server has confirmed |
| Attention | "Needs attention", the next step, WhatsApp support, Track Order |
| Unavailable | "Your orders are unavailable right now.", Try again, Open My Orders |

- Manual review is never hidden.
- An order that needs the customer, or is still moving, comes before new buying on phones.
- Attention cards carry no festive material, and the seasonal line steps aside after "One of your orders needs attention."
- There is no confetti or celebration anywhere on this page.

**B7. More from Mystery Hub.** Five tiles, each in its own material: Website (evergreen velvet, large), Mystery Earn (wine), Marketplace (cream paper), AFA (midnight), All services (night).

**B8. Website states.**
- **No record yet:** "Create a free website".
- **Draft:** "Finish your website", tagged *Draft*, "… · not published yet".
- **Published:** "Your website is live", tagged *Live*.
- **Not loaded:** "Website Builder".

**B9. Earn.** "Share your link. Earn when friends' purchases qualify." No amounts and no guarantees.

**B10. Recent activity, Mystery AI and support.** The same recent list and empty states as the ordinary page, Ask Mystery AI, and WhatsApp support.

**B11. Seasonal teaser and countdown.** Mystery Greetings appears as a preview only ("Coming soon … Not open yet"), with no button and no fake creator. The day line uses the same calendar as the guest page, in Accra time (UTC+0), so it agrees with PR #104's countdown target of `2027-01-01T00:00:00.000Z`.

The **first-purchase welcome card** ("Up to 18% off · Ready on your account") appears only for a customer without orders, and only when the existing quote endpoint says the offer is `eligible` on this account. A customer with orders makes no quote request at all.

## Seasonal architecture

| Flag (`SeasonProvider`) | Meaning |
| --- | --- |
| `shellActive` | A pack applies, whoever is visiting: the header logo, the phone menu heading and the footer are seasonal (`data-season-shell`). |
| `active` | Signed out: every guest page composition, the guest homepage and the auth invitation (`data-season`). |
| `memberActive` | Signed in: the seasonal member homepage. Other account pages stay as they are. |
| `heldForSignedIn` | A pack applies and the visitor is signed in or still being checked; used to preload the member homepage. |

| Lazy chunk (each retried once, each with a fallback) | Loaded for | Fallback |
| --- | --- | --- |
| `ChristmasShell` | Everyone, while a pack applies | The ordinary footer, and no hat or menu heading |
| `ChristmasPack` | Guests | Nothing (pages stay ordinary) |
| `ChristmasHome` | The guest homepage | `NormalGuestHome` |
| `ChristmasMemberHome` | The member homepage | `MemberHomeView` |

**CSS namespaces:** `.xh-` (guest home), `.xm-` (member home), `.xk-` (shared kit), `.xs-` (shell, under `.mh-app[data-season-shell]`) and `.xmas-` (guest pack, under `.mh-app[data-season]`). Unit tests check that every selector stays in its namespace.

**Motion:** transform and opacity only; one owner per moving element; entrances once per visit; endless loops only for status (the live dot, the loading shimmer) or on large hover screens; and a full stop under reduced motion.

## The welcome offer: "up to 18% off" (founder-approved)

Founder approval, verbatim: *"Yes, do it. It's already confirmed it works, and it's up to 18% off. Since when you calculate for the lowest bundle, it's high. You get it. So up to 18% off, so you can do it."*

- **Offer unchanged:** GH₵1 off one qualifying data purchase (`OFFER_DEFAULT`). The economics are untouched.
- **How the headline is worked out:** `welcomeFigure` reads the live catalogue. It takes the best percentage on a qualifying data bundle at or under the approved **18%** ceiling, rounded down, and names that bundle in the fine print: "…which is 18% on the MTN 1GB bundle at GH₵5.49".
- **The ceiling in practice:** a cheaper bundle that would give more than 18% (AirtelTigo 1GB at GH₵4.99 would be 20%) is skipped, so the headline never exceeds what was approved.
- **When it shows:** only after the server has confirmed the catalogue, and only for the server's `guest` or `eligible` state.

## PR #104 (Seasonal Experience Core) compatibility

PR #104 is still open and unmerged. It was read and not modified.

| PR #104 phase | This front end |
| --- | --- |
| `christmas_season` | `christmas-season` |
| `christmas_day` | `christmas-day` |
| `boxing_day` | `boxing-day` |
| `new_year_transition` | `year-end` |
| `new_year_eve` | `new-years-eve` |
| `new_year_day` | `new-years-day` |
| `new_year_celebration` | `new-year` |

- **Countdown:** PR #104 targets `2027-01-01T00:00:00.000Z`, which is Accra midnight, the same instant this front end counts towards. A live hours-and-minutes countdown can later feed the hero tag (`countBig` / `countSmall`) and the member day line.
- **Greetings:** PR #104's templates (`shared/mysteryExperiences.ts` on that branch) are not used. The member teaser has no button until the real creator route exists.

## Accessibility and performance

- **Keyboard:** every action is a native button or link, and the champagne focus ring is visible (verified by keyboard on Buy Data, then Enter). The envelope and the template chips announce their state with `aria-pressed`. The current menu page carries `aria-current`. Decorative art is `aria-hidden`.
- **Reduced motion:** everything appears immediately and nothing animates, including the live dot and the shimmer. This is verified on both homepages.
- **No sideways scroll and no clipped labels** at 320, 360, 390, 430, 768, 1024, 1280 and 1440 px and on a short phone, for both homepages (browser checks).

Bundle sizes, gzip, from production builds:

| Chunk | `main` (V2) | This branch |
| --- | --- | --- |
| Entry JS (`index`) | 73.55 KB | 73.65 KB |
| `App` JS | 76.84 KB | 75.91 KB, plus the shared catalogue/offer hooks (1.52 KB) now in their own chunk |
| Entry CSS | 30.36 KB | 30.42 KB |
| Seasonal shell JS / CSS (lazy, season only) | — | 2.71 / 3.01 KB |
| Guest pack JS / CSS (lazy, guests during the season) | 3.55 / 3.38 KB | 4.52 / 3.98 KB |
| Guest Christmas homepage JS / CSS (lazy) | 14.74 / 9.78 KB | 12.33 / 11.00 KB, plus the shared seasonal kit 7.08 / 1.11 KB |
| Member Christmas homepage JS / CSS (lazy) | — | 4.83 / 5.32 KB, plus the shared seasonal kit |

An ordinary first load (season off) carries no seasonal chunk and grows by about 0.6 KB of chunk overhead. Now that three pages share the catalogue and offer hooks, the bundler moved them out of `App` into their own small chunk.

## Tests and verification

- **Full suite (`npm test`):** 3293 tests: **3247 pass, 0 fail, 46 skipped**. The skipped ones are the existing PostgreSQL-only suites, which need a disposable database this environment does not have.
- **Typecheck (`npm run lint`):** clean. **Build (`npm run build`):** succeeds.
- **New unit tests:** `christmasMemberHomeV3.test.ts` (7):
  - the seasonal and ordinary member views agree on every fact in 12 order states;
  - no celebration on problems;
  - website, Earn and teaser truthfulness;
  - the phase greetings;
  - no data reads or payments in the seasonal view;
  - the wiring and fallbacks;
  - namespace and motion rules.
- **Changed unit tests:** `seasonalExperience.test.ts` now requires that nothing is drawn on the tab bar (V2 asserted a star there). `pwaLaunchReadiness.test.ts` accepts the single install slot as a prop of the shared member view; it still requires exactly one.
- **Browser checks, guest:** **19 of 19 pass**. They cover the envelope (opens once by itself, clipped at its edge, transitions only, 20 repeated taps, closed state, keyboard), the Creative Studio swing (never fades, arrival not replayed), card presses and settling, Back with no replay, the website frame and selection, fitted tag text, no overflow, the welcome figure, and auth (validation unchanged, the sign-in line, Escape).
- **Browser checks, signed in:** the final full run passed **66 of 67** checks. The one miss was a timing flake: under parallel load the Data page had not finished loading when the check looked. That check now waits for the destination page and passes **4 of 4** on re-run; all nine actions land on the same page and heading as on the ordinary member homepage. The checks cover season off (the ordinary page, no seasonal download); the session check with no flicker; processing, attention, delivered, unavailable and loading; website none, draft and published; the first purchase with eligible and ineligible offers; the actions, Track Order and Mystery AI; entrances once; Back; the gift press; reduced motion; the chunk-failure fallback; sign-in and sign-out with no data left behind; a real local sign-up; install visibility; eight calendar days; eight widths, including short phones, in two states; and the keyboard. All use a local, in-memory server and a synthetic account; orders, website records, balances and quotes are mocks labelled synthetic, apart from one real sign-up of a synthetic person on the local server.

## Evidence (`docs/screenshots/christmas-homepage-v3/`)

| Folder | Contents |
| --- | --- |
| `compare/` | V2 (before) and V3 (after): hero at 390 and 1440, service cards, data and welcome offer, envelope, website, marketplace, install, coming soon, footer |
| `guest/mobile-390/`, `guest/desktop-1440/` | First screen, header, logo hat (enlarged), every section, the envelope closed and open, the open phone menu, Create account and Sign in, reduced motion, overviews |
| `member-synthetic/mobile-390/`, `member-synthetic/desktop-1440/` | First screen; welcome, Wallet and actions; first purchase with the welcome card; processing; delivered; attention; unavailable; loading; website none/draft/published; discovery; teaser; recent and help; sign-off; install slot; reduced motion; a real local sign-up of a synthetic account; overviews. **Every name, order, balance and website here is synthetic.** |
| `interactions/` | Frame strips: envelope opening and closing, the Creative Studio swing, the member gift press, sign-in (guest → member) and sign-out (member → guest) |
| `phases/` | Guest phone heroes and member desktop pages for 10, 24, 25, 26, 31 Dec, 1 Jan and 3 Jan |
| `responsive/` | Both homepages at 320–1440 px |
| `recordings/` | Two short screen recordings (WebM): the guest phone journey, and sign-in to sign-out with synthetic data |

## Deferred and recommended

- **Support email.** The footer shows the configured contact address (a personal Gmail). A branded support address is recommended; none was invented.
- **Other signed-in pages.** Orders, Wallet and account pages keep their ordinary look; only the homepage and the shell are seasonal for members.
- **Mystery Greetings creation.** This depends on PR #104's backend and a creator UI. Today it is a preview only.
- **A live New Year countdown** (hours and minutes) from PR #104's countdown endpoint.
- **New raster art.** All art is SVG/CSS. No Cloudinary or Canva assets were generated or uploaded.
- **iPhone Add to Home Screen** could not be reproduced in headless Chromium. The Android Chrome and desktop install paths were simulated with the browser's own install event.
- **The founder preview ribbon** takes some height on short phones. Visitors never see it, and the measurements above exclude it.

## What this pull request does not do

It does not:
- merge anything or turn the season on;
- change Render, production environment variables, migrations or the database schema;
- touch Paystack verification, payment amounts, Wallet balances or the ledger, supplier APIs, order dispatch or reconciliation, authentication rules, referral economics, website publishing, Marketplace checkout, or live discounts;
- make purchases;
- modify PR #104 or PR #69.
