# Mystery Hub 3.6 · The premium Data store

**Status:** implemented on `claude/elegant-lamport-q2binq`. The ordinary design is a permanent upgrade and ships with the normal deploy. The seasonal look is off by default: it shows only while the existing season system applies a pack (`SEASONAL_EXPERIENCE`, not changed here) or in a founder preview tab.

**Baseline:** `origin/main` at `65acc66` (PR #140 merge). Open PRs at the start: only the draft backend PR #69, which this work does not touch.

Before/after images are in [`docs/screenshots/data-buying-3-6/`](screenshots/data-buying-3-6/). They use synthetic data only.

## Design direction

There is one purchasing page with two appearances, not two pages.

- **Ordinary (all year).** The page uses the brand's charcoal depth and Mystery Green for every action. It has:
  - a lit title panel with original "coverage rings" artwork;
  - one sliding indicator for the service (Data, Instant, Airtime) and one for the network;
  - a catalogue of tiles, each leading with the data size;
  - the network's colour on each tile's edge.
- **Christmas and New Year.** The same components, re-toned through the page's own design tokens:
  - Christmas: evergreen velvet, champagne and berry. The title panel has a light strand, baubles and an original illustration: a phone wrapped as a present, with the signal glowing on its screen.
  - Christmas Day: a warm light opens behind the phone.
  - From 27 December: midnight blue, plum, silver and gold, with a crescent and bursts.
  - Every bundle tile gets a satin edge. Popular and best-value tiles carry a small bow (a silver star from 27 December).
  - Green stays the colour of buying.

Why tiles: on phones, a two-column grid shows as many bundles per screen as the old rows. It also gives the deciding fact (the size) the largest type. Prices stay in one consistent place, so they are easy to compare. The whole tile is the button, so buying stays one tap.

## What changed

| Area | Change |
| --- | --- |
| Title panel (`DataStoreHero.tsx`) | Title and short lede, three assurances (desktop), and an audience **journey line**. Guests read "No account needed…". Members read "Signed in as Ama. Checkout starts with your number 024 123 4567…", or are asked for a number if the account has none. |
| Service switcher | Data, Instant and Airtime share one sliding indicator, with sub-labels on desktop. AFA stays a separate shortcut. |
| Network selector (`DataNetworkSelector.tsx`) | Same API. A single brand-coloured indicator slides between the four networks, with optional bundle counts. Also used by Instant. |
| Catalogue (`DataBundleTile.tsx`) | A tile made for the Data page. It shows: the size; a meta line (offer label, validity, or **price per GB** worked out from the tile's own price); the price block; and Buy. Server campaign prices and confirmed Welcome Prices show a struck regular price and a saving, using the same helpers as before. With All networks, the catalogue is grouped and titled by network. |
| Instant, Airtime, questions, support | Restyled into the same surfaces. Text, rules, fees and states are unchanged. Members get an optional **Use my number** in Airtime. |
| Checkout (`CheckoutModal.tsx`) | Presentation only. A prefilled recipient is labelled "your account number" or "the number you chose", with a **Change number** action that focuses and selects the field. Typing another number removes the label. |
| Seasonal (`seasonal/christmas/data/`, `Seasonal.tsx`, `dataStoreSeason.ts`) | A lazy chunk loaded only while a season applies. The page root carries `data-ds-season` / `data-ds-look` / `data-ds-phase`. These follow `shellActive`, the same rule as the shared header, so guests and members see the same page. The member checkout sheet gets the guest pack's seasonal bow (`shell.css`). |

### Shared components protected
- **Homepage rows:** `CompactBundleRow`, used by `HomeFeaturedData`, is untouched.
- **Reseller storefronts:** `BundleCard` is untouched.
- **Isolation:** the new styles are all under `.mh-ds`, and the page loads them with its own lazy chunk. The seasonal Data rules are all under `.mh-ds[data-ds-season="christmas"]`. Tests check every selector of both files.

## Micro-interactions

All motion uses transform and opacity only. `prefers-reduced-motion` stops everything; the browser check found 0 running animations.

- **Network and service:** the indicator slides on a soft spring. The selected dot grows. Icons settle in.
- **Tiles:**
  - Entrance: a short staggered rise, only when the view changes (network or size). A search keystroke, a catalogue refresh, opening checkout or returning to the page does not replay it. The browser check confirmed 0 tile animations after checkout and a refresh.
  - On devices that hover: a lift, a network-coloured edge, and a soft light that follows the pointer. In season, one warm sheen passes and the bow tilts.
  - On press: a scale-down and the existing tap ring.
  - Prices never move.
- **Title panel:** settles in once per visit. The ordinary rings breathe slowly.
- **Ambient artwork motion is finite.** It settles after about half a minute and pauses whenever the title panel is off-screen, so scrolling the catalogue on a budget phone never pays for it.
- **Season:** baubles sway in, the signal on the phone lights from the centre outward, and the lights twinkle. A tap on the illustration makes the phone hop and the sparks flare.
- **Search and panels:** search opens with a short scale-in. Mode switches and opened questions fade up.

## Guest and member journeys

- **Guest:** browse, tap a tile, enter the number and a receipt email, review the server total, pay (Paystack), track. Nothing is prefilled, and there is no sign-in step.
- **Member:**
  - Checkout opens with the account's number when there is one, labelled as such, with **Change number**.
  - The receipt email is prefilled from the remembered receipt address or the account email, with **Change**.
  - Wallet appears where it is eligible.
  - The recipient is always editable and shown again under **Confirm your order**.
  - Missing details are asked for normally.
- **Account isolation:** checkout already resets its fields from the current account on every open. Two new safeguards cover the Data page itself:
  - the Airtime number is cleared when the signed-in account changes;
  - the journey line reads the current account only and stores nothing.
  - In-tab browser check: Ama, then sign out, then sign in as Efua through the real form. Nothing of Ama's showed.

## Unchanged business behaviour

None of the following changed:
- prices, quotes and the server's pricing authority;
- December campaign rules and expiry;
- Welcome Offer eligibility;
- product and network identifiers;
- Instant conditions and fees;
- recipient validation and the number-portability warning;
- Paystack initialization and verification;
- Wallet;
- retries, recovery and the pending-payment banner;
- duplicate-order (active MTN) handling;
- order status;
- authentication;
- reseller pricing and storefronts.

The MTN delivery notice, the AirtelTigo notice, the FAQ wording and the trust line are all kept. The seasonal copy (`DATA_LINE`) is greetings only, and a test forbids offer, bonus, guarantee and delivery-promise language.

## Verification

- **Type check and build:**
  - `tsc --noEmit`: clean.
  - `npm run build`: passes.
  - Bundle impact, gzip:
    - entry unchanged (74.65 KB);
    - App +0.41 KB;
    - Data page +2.26 KB JS and +4.26 KB CSS, loaded only on the Data page;
    - seasonal Data chunk 2.72 KB JS and 2.97 KB CSS, only while a season applies.
- **Tests:**
  - New `dataStorePremium36.test.ts`: 12 tests.
  - Full suite: 3668 tests, 3607 pass, 0 fail, 61 skipped. The baseline was 3656 / 3595 / 0 / 61.
  - Two structural pins were updated without weakening them:
    - the MTN notice must still come before the list, now `DataBundleTile`;
    - the mode tabs must share exactly one active style, now one indicator.
- **Browser QA:** 216 of 216 checks passed, against frontend-only Vite with every `/api` call answered synthetically. Paystack and Wallet initialization were counted and refused, and none happened. The checks covered:
  - **Layout:**
    - widths 320–1440, with short Android heights (320×568, 360×640, 360×740);
    - guest and member, ordinary and seasonal;
    - no sideways scrolling and no clipped tile text;
    - at 360×740 the first bundle row, with its price and Buy, sits above the tab bar.
  - **Catalogue:**
    - network selection, size filter, search and the empty state;
    - campaign and Welcome prices;
    - the catalogue still listing bundles when the server catalogue is offline.
  - **Instant:** loading, offline, unavailable and Flexi.
  - **Checkout:**
    - guest checkout with nothing prefilled;
    - member prefill, Change number, editing and reopening;
    - a member without a phone or email;
    - a remembered receipt address;
    - Airtime "Use my number";
    - sign-out and account switching in the same tab;
    - the pending-payment banner.
  - **Accessibility:**
    - keyboard: Enter and Space on tiles, visible focus;
    - axe found no serious or critical issues (ordinary, Christmas guest, New Year member);
    - reduced motion.
  - **Season:**
    - 10, 25 and 31 December and 1 January, for guests and members;
    - Exit preview restores the ordinary page in place;
    - the seasonal chunk is never fetched when off;
    - Admin and published sites never carry the Data look.

## Independent review

A separate review agent reviewed the diff. It found no critical issues.

It raised two important issues, both fixed:
- ambient SVG animations never stopped, which is costly on budget Android phones;
- the member journey line named a checkout number in Airtime mode.

It also raised minor issues, all fixed except one:
- focus is now kept after "Use my number";
- "Use my number" is now labelled as the account number in checkout;
- "Change number" uses its visible text as its accessible name;
- the per-GB figure is now worked out from the size shown on the tile;
- long offer prices wrap instead of clipping;
- the Instant loading skeleton pulses again;
- "Best value" now reaches screen readers;
- the Airtime number is kept when the sign-in check finishes;
- "Any Ghana number" now reads "MTN, AT and Telecel";
- the pointer light is updated at most once per frame.

Not changed: on Instant cards, the store's border colour overrides the out-of-stock border. Out-of-stock cards keep their reduced opacity, "Unavailable" label and disabled state.

## Limits and follow-ups

- **Off-season QA:** the 6 January off-state is covered by the server calendar test. A founder preview deliberately maps later dates to the New Year look, so the browser check used Exit preview instead.
- **Real devices:** not checked on real Android devices or in an installed PWA. Chromium emulation only.
- **Smallest phones:** at 320×568, bundles start after a short scroll.
- **Next:** dress the order-status and Instant flexi sheets for the season, and add real-device performance traces.
