# Mystery Hub 3.2 · Seasonal Experience, Phase 1: the signed-out Christmas experience

Baseline: `origin/main` `7de758510d1fcc797f35a4e1e1a1526e3d575d52`. Before this work there was no seasonal code in the repository; `docs/v32-handoff.md` lists Christmas *Website Builder templates* as separate future work, and this phase does not touch them.

**Status: off by default, ready for founder review.**

- Nothing changes for any customer until the API service sets `SEASONAL_EXPERIENCE=christmas-2026`, and that needs separate founder approval.
- The founder can preview it in one browser tab at any time.

> **Homepage superseded (Focused Assignment 01).** The signed-out homepage is now its own Christmas composition, described in
> [`christmas-homepage-v2.md`](christmas-homepage-v2.md). The hero ornaments, the service-card bow, the share band and the
> Home-tab hat below are gone; the footer greeting now says "Ghana". Everything else in this document still applies to the
> other guest pages.

## How it works

| Piece | File | What it does |
| --- | --- | --- |
| Calendar and status | `shared/seasonal.ts` | The approved calendar, by Africa/Accra calendar day (see below). Off unless the setting names a known pack and today is inside its dates. |
| Status route | `server/routes/seasonalApi.ts` → `GET /api/seasonal/status` | Public and read-only. Cached for 5 minutes. There are no write routes, and query strings are ignored. |
| Provider | `src/seasonal/SeasonProvider.tsx` | Combines the server answer with an optional founder preview, then applies the guest-only rule. |
| Slots | `src/seasonal/Seasonal.tsx` | `<Seasonal slot=… />` renders nothing when the season is off. When it is on, it lazy-loads the pack. |
| Christmas pack | `src/seasonal/christmas/` (`ChristmasPack.tsx`, `art.tsx`, `copy.ts`, `christmas.css`) | Artwork, compositions, phase-aware copy and scoped styles, in one lazy chunk: about 6.1 KB JS + 5.1 KB CSS gzipped. |
| Admin | `src/components/admin/sections/AdminSeasonalPanel.tsx`, under **System Health** | Read-only status, how the switch works, and preview links for every phase. |

The approved calendar:

| Accra dates | Phase |
| --- | --- |
| 1–24 December | Christmas season |
| 25 December | Christmas Day |
| 26 December | Boxing Day |
| 27–30 December | Toward New Year |
| 31 December | New Year's Eve |
| 1 January | New Year's Day |
| 2–5 January | New Year celebration |
| From 6 January | Off again |

Reversibility:

- Only the customer shell (`<div class="mh-app">`) receives `data-season="christmas"`, and only while a season applies and the visitor is signed out.
- Every Christmas style is scoped under `.mh-app[data-season="christmas"]`. A test checks every selector.
- Removing the attribute restores the normal appearance exactly.
- With the season off, the pack's CSS and JS are never fetched. A browser check confirmed this.
- The main bundle grew by about 0.03 KB JS and 0.18 KB CSS gzipped.

Where it never applies:

- Admin, the website editor and My Business. They return before the customer shell.
- Published customer websites (`/sites/*`) and isolated template previews. They never mount the provider.
- Website Builder template previews. A test forbids element-level selectors that could reach template markup.
- Signed-in customers, until Phase 2.

### Switching it on and off (production)

- **On:** set `SEASONAL_EXPERIENCE=christmas-2026` on the API service in Render. It shows from 1 December 2026 to 5 January 2027 (Accra), and the normal appearance returns on 6 January by itself.
- **Off:** remove the setting. Visitors return to normal within about 5 minutes; returning visitors briefly use their last cached answer until the page asks again.
- Only an exact known pack id turns it on. Values such as `on` or `christmas` are treated as off.

### Founder preview

- Admin → System Health → **Seasonal experience** → choose a day → **Open preview** or **Copy preview link**.
- A link looks like `/?season-preview=christmas-2026&season-date=2026-12-25`.
- The preview lives in that tab's `sessionStorage`. The parameter is removed from the address bar at once, and a **Christmas preview** ribbon shows the day being previewed, with **Exit preview**.
- Nobody else is affected. It is not secret, because the code ships to every visitor, but it cannot change what anyone else sees.
- Phase 1 dresses the signed-out site. If the preview is opened while signed in, the ribbon says so and the site stays normal, so open it in a private window.

## Creative direction

**Concept: a Christmas evening in Accra.**

- Warm lights strung under the header across every page, ornaments hanging over the city in the hero, gold stars, wrapped gifts, bells.
- The theme is family, generosity and light, not snow or winter clothing.
- The Mystery Hub logo and its green are untouched. Green stays the colour of every action.
- Evergreen, berry and warm gold dress the season around it.
- The festive serif (Fraunces italic, already used by Creative Studio) is loaded only with the pack, for greetings.

**Artwork:**

- All original SVG drawn in code: ornaments, star, gift, bell, gift tag, light strand, and a confetti burst. (The Christmas hat was removed in v2.)
- There are no images, no Cloudinary assets and no network requests for art.
- Nothing was generated, and nothing reuses unrelated assets.

**Interaction language:**

- Tap an ornament: it swings.
- Tap a bell: it rings.
- Tap a gift: it bounces.
- Tap a star: it spins and sparkles.
- (v2) The Home tab no longer has a hat; the selected tab gets a champagne ring and one sparkle.
- Ornaments, cards and page accents drop in once.
- A few light bulbs twinkle slowly (opacity only).
- Everything else is still.
- `prefers-reduced-motion` stops every seasonal animation. A browser check measured 0 running animations.

**Copy** (`copy.ts`):

- Greetings change with the phase: "Merry Christmas from Mystery Hub", "Merry Christmas! It's Christmas Day", "Happy Boxing Day…", "Happy New Year's Eve", "Happy New Year 2027".
- The countdown is the real Accra calendar ("15 days until Christmas", "Today is Boxing Day", "3 days until 2027").
- Each page has its own line.
- Errors, prices, availability and service instructions are never changed.
- A test forbids discount, bonus, giveaway, guarantee and delivery-promise language.

## Coverage (guest route and overlay inventory)

| Surface | Treatment |
| --- | --- |
| Header (desktop and mobile menu) | Warm light strand under the bar; berry hairline. Logo and navigation unchanged. |
| Phone tab bar | v2: no hat. The selected tab keeps its green pill with a fine champagne ring and one small sparkle. |
| Footer | Light strand, bells, and "Wishing you a wonderful Christmas. With love from Mystery Hub, Ghana." (v2 wording). On the homepage the page's own sign-off replaces it. |
| Homepage hero | Replaced in v2 by an original scene (see `christmas-homepage-v2.md`). |
| Homepage sections | Replaced in v2: every section is recomposed for Christmas (see `christmas-homepage-v2.md`). |
| Data & Airtime | Ornament composition and "Stay close this Christmas". Lightest touch, because this is the high-frequency purchase path. |
| Guest checkout | A CSS-only ribbon bow on the sheet's top edge and a fine festive edge. `CheckoutModal.tsx` is unchanged. No popup, no step, no delay. |
| Order status | The same edge and bow. "Merry Christmas!" and a short confetti burst appear **only** when the server reports `delivered`, never for initiated, pending, paid, queued or processing. |
| Order tracking (`/orders`) | Gift and "Christmas orders, tracked". |
| Sign-in and registration | Two ornaments hanging into the sheet, plus a greeting on larger screens. Auth logic unchanged (`SecurityDialog` gained an optional decorative slot). |
| Marketplace | Gift tag and gift in the hero, "Christmas shopping, simply". Products, prices and enquiries unchanged. |
| Creative Studio | Its own identity kept: two ornaments over its showroom stage and a berry edge on the catalogue paper. Draft prices and enquiry-only state unchanged. |
| Website Builder landing | Gift and ornament, "A fresh start for your business". The template gallery, previews, editor and published sites are deliberately untouched. |
| More Services, Help, About, AFA, Results Checkers, App, Mystery Earn (guest), Wallet (guest) | A composition per page (stars, bells, ornament trio, gift tag and others), each with its own line and a warm light behind the title. Unavailable services still say they are unavailable: AFA and Results Checkers only say "Season's greetings". |

### Not yet dressed (honest gaps for review)

- **Marketplace overlays:** the product detail, enquiry and Marketplace checkout sheets.
- **Waitlist dialog.**
- **Mystery AI assistant and its launcher.**
- **Toasts:** kept plain on purpose, so errors stay direct.
- **PWA launch layer and install prompts:** left untouched, so no new prompts appear.
- **Interaction captures:** these are still frames from a tap test (`docs/screenshots/christmas-guest-v1`), not video.
- **Devices and PWA:** not checked on real devices or in an installed PWA. Layout was checked in Chromium at 320, 360, 390, 430, 768, 1024, 1280 and 1440 px, with no horizontal overflow on any page.

## Verification

- `npm run lint` (tsc): pass.
- `npm run build`: pass. The pack is a separate lazy chunk.
- `server/suppliers/__tests__/seasonalExperience.test.ts` (8 tests) covers:
  - the calendar, including the Accra midnight boundaries;
  - default-off and strict setting parsing;
  - preview dates;
  - the read-only status route;
  - shell isolation;
  - CSS scoping and element-selector guards;
  - lazy loading;
  - reduced motion;
  - honest copy;
  - checkout left unchanged, and celebration only for delivered.
- Full `npm test` was run, and `directCheckoutRecoveryUi` passes against the unchanged `CheckoutModal`.
- Browser checks used synthetic data only. No order, payment or supplier call was made:
  - preview on and off;
  - pack not fetched when off;
  - signed-in hold;
  - the full guest page set at all widths;
  - checkout opened, not paid;
  - sign-up;
  - a synthetic delivered order answered in the browser;
  - phases;
  - tap swing;
  - reduced motion;
  - the Admin panel, with a local in-memory bootstrap admin.

## Engineering handoff: database-backed Admin activation (not built)

The environment setting is a real central switch, but changing it needs Render access. If the founder wants an in-Admin on/off switch and a schedule, build it separately with authorization:

1. A migration adds a `seasonal_settings` table (`id`, `pack`, `enabled`, `starts_on`, `ends_on`, `updated_by`, `updated_at`), with RLS denying client roles.
2. `GET /api/seasonal/status` reads the row, cached in-process for 60 seconds. The environment setting stays as an emergency override that forces off.
3. `PATCH /api/admin/seasonal`:
   - admin only, through the existing admin middleware;
   - audited in the admin audit log;
   - validates the pack id and dates with `shared/seasonal.ts`.
4. The Admin panel gains On/Off and dates, with a confirmation that names the effect ("every signed-out visitor").

## Later phases (not started)

- **Phase 2:** the signed-in customer experience (member home, orders, wallet, earn and account surfaces), using the same slots and pack.
- **Mystery Greetings:** shareable animated messages.
- **Mystery Countdown:** a full-screen New Year countdown with a midnight transition. Integration points are ready:
  - `seasonCountdown` and the phase model;
  - a hero-card slot that a countdown link can join once the page exists.
  - No buttons point to it yet.
- **New Year visual pack:** from 27 December the Christmas pack already speaks New Year (greetings, countdown, lines), but its artwork stays Christmas.
- **Christmas Day / Boxing Day:** dedicated interactions beyond the current greetings.
- **Midnight Data Drop:** deferred and not authorized.
- **Future packs:** add a pack id to `SEASONAL_PACKS`, a folder beside `christmas/`, and a branch in `Seasonal.tsx`.
