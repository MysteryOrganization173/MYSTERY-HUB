# Christmas member homepage V4

**Status: review only.** The season stays off by default and nothing here activates it. Baseline: `main` at `2fb92ee` (the PR #107 merge). The only changes are the presentation of the signed-in Christmas homepage and the welcome advertisement's copy. Prices, payments, Wallet, orders, suppliers, authentication and the Website Builder are untouched.

## What was wrong, and what changed

| Area | Found in V3 | V4 |
| --- | --- | --- |
| First screen on phones | With an active or attention order, the order card moved first (correct), but it pushed Buy Data and Airtime under the tab bar at 390×844 (their bottom edge at 837 px; the tab bar starts at 779 px). | The two purchases become one slim row while an order leads. Bottom edge 745 px with the founder preview ribbon, 700 px without. The order still comes first. |
| Welcome | Sparse on desktop: the gift floated between the greeting and the Wallet. Only two seasonal lines. | A light strand over the welcome. The gift stands on a light pool and carries a cream tag reading "For {name}". Lid open and lit on Christmas Day; midnight velvet and silver from 27 December. Each day of the season has its own line and sign-off. A tap while the gift is still playing is ignored instead of restarting it. |
| Wallet and quick actions | Three separate cards. | One deck: the Wallet's own component (the real balance and every state unchanged) on an engraved panel, with Buy Data and Airtime in it. Top Up is champagne, so green stays with buying. Each tile has a press reaction on its icon only; nothing delays the purchase. |
| Latest order | The phone number and reference were the only details. | A network dot, and the order's time ("Today, 10:42"). Attention gets an amber edge and a WhatsApp support button. Steps are tighter. Every state, label and action is the ordinary view's own. |
| Recent activity and help | Plain rectangles below the services. | Recent orders print on a cream receipt beside the latest order (desktop) or under it (phones). A brand-new account has no receipt; the first-purchase invitation sits there instead. Help is a compact panel beside the Greetings preview. |
| More from Mystery Hub | Generic illustrations; the website card did not say what to do next. | The website card draws the account's real site state (empty page, draft with a dashed edge and pencil, or live with a light and its `/sites/…` address) and names the next step: Start building, Continue editing or Manage website. Marketplace shows up to three real featured products from the public catalogue, falling back to the parcels. All services has its own mark. Each tile's press moves only its own detail. |
| Mystery Greetings | A static teaser. | A shared kit entry (`kit/GreetingsPreview` plus `kit/greetings.ts`): the three steps, an envelope with a letter inside, and "Not open yet". It takes no account data, so guests and members can use the same component. |
| Motion | — | Entrances still play once per visit. Product photos fade in only the first time they load in a visit. A data refresh replays nothing. Transform and opacity only. Reduced motion stops everything. |

Desktop is shorter than V3 (2,070 px against 2,165 px). Phones are about the same length (3,247 px against 3,202 px) while adding the receipt and the Greetings steps.

## Welcome advertisement (guest and member)

The card keeps its design. Its copy is now:
- **UP TO 18% OFF** (the computed figure, never above the approved ceiling);
- *Your first data bundle*;
- **For new customers** (members who are eligible see **Ready on your account**);
- the CTA **Create Your Free Account**, for guests.

The paragraph explaining GH₵1, the bundle price and the percentage is gone. Checkout remains the place that shows the exact saving and the total. Eligibility (`guest`/`eligible` only), the figure (`welcomeFigure` with `WELCOME_HEADLINE_CEILING = 18`) and all pricing are unchanged. A future server-authorised campaign can change the headline at the same point (`welcomeFigure`/`WelcomeCard`) without redesigning the card. No 27% or 33% claim was added.

## Mystery Greetings: what integrating PR #104 needs

PR #104 (`feat/mystery-experiences-core-v1`, head `56b3813`) is open and review-only, and it was not modified. It provides the backend: public endpoints with no login, `GET /api/experiences/templates` (with `creationConfigured`), `POST /api/experiences/greetings`, `GET /api/experiences/greetings/:shareId`, and revoke and report. Creation is anonymous: the sender's browser holds a random creator token. So the **same creator serves guests and members, and nobody has to sign in.** Nothing on `main` calls these endpoints today.

To deliver the full experience:
1. Merge PR #104 and, after separate approval, install its optional schema. Then set `MYSTERY_EXPERIENCES_ENABLED`, `MYSTERY_GREETING_LINKS_ENABLED`, `MYSTERY_GREETINGS_ENABLED` and the 64-hex `EXPERIENCES_ABUSE_SECRET`. All gates default off.
2. Routing: make sure the canonical `/g/:shareId` reaches the Express responder (`render.yaml` still has a static SPA catch-all).
3. **Creator screen**, one route for both audiences:
   - template or custom message;
   - optional recipient and sender names;
   - variant (`gift-classic-v1` or `gift-starlight-v1`).
   - In private storage, create a 32-byte base64url creator token and a UUIDv4 idempotency key; never put either in links or analytics.
   - Show the share link, with WhatsApp sharing.
4. **Recipient screen** at `/g/:shareId`: the gift or envelope opens to reveal the message (plain text nodes only). Expired or revoked links show a 404 state. Include a "make your own" link back to the creator.
5. **Final fixed gift artwork** for the social preview. Today's image is an interim app card.
6. **Interaction-only analytics events**, respecting the existing consent rules.
7. **Homepage switch:** set `GREETINGS_ENTRY` in `src/seasonal/christmas/kit/greetings.ts` from `creationConfigured`, with `createHref` pointing at the creator. Both homepages then show "Create a greeting" through the same `GreetingsPreview`.
8. **New Year's Eve countdown:** use PR #104's `GET /api/experiences/countdown`, which targets `2027-01-01T00:00:00Z`.

## Verification

- Unit tests (`christmasMemberHomeV3.test.ts`, 10) cover:
  - the seasonal and ordinary member views agree across 12 order states;
  - no celebration on problems;
  - website, Earn and Greetings truthfulness;
  - no `/api/experiences` call anywhere in `src`;
  - every phase's copy and gift;
  - order time;
  - no account reads or payments (the one new read is the public catalogue);
  - wiring;
  - the phone compaction;
  - namespace and motion rules.
- The seasonal test pins the new welcome copy and forbids the old fine print.
- **Full suite:** 3296 tests, **3250 pass, 0 fail**, 46 skipped (the existing PostgreSQL-only suites). `tsc` is clean and the production build succeeds.
- **Signed-in browser checks: 78 of 78.** They run on a local in-memory server with a synthetic account; orders, balances, websites, quotes and Marketplace products are synthetic mocks. They cover:
  - season off;
  - the session check with no flicker;
  - every order state;
  - website none, draft and published;
  - first purchase, with and without the offer;
  - every action landing where the ordinary page sends it;
  - entrances once, Back, the gift press and reduced motion;
  - the chunk fallback;
  - sign-in, sign-out and a real local sign-up;
  - install visibility;
  - eight calendar days;
  - widths 320 to 1440, including short phones;
  - the keyboard;
  - Buy Data and Airtime above the tab bar while an order leads;
  - a second gift tap not restarting the animation;
  - a refresh replaying nothing;
  - product pictures not fading in again;
  - the guest welcome copy;
  - Exit preview;
  - account A then account B in one tab, with nothing of A shown to B.
- **Guest browser checks: 19 of 19** (every V3 guest interaction guard, plus the new welcome copy).
- **Bundle (gzip):**
  - the ordinary first load is unchanged (entry 73.64 KB, App 75.90 KB);
  - the member chunk grows from 4.83 to 7.96 KB JS and from 5.32 to 6.94 KB CSS, loaded only while a season applies to a signed-in customer;
  - the shared seasonal kit is 6.89 KB JS and 1.73 KB CSS.
- **Screenshots:** in `docs/screenshots/christmas-member-v4/`. Member images use synthetic data.

## How to review

Open the PR on a phone and start with `docs/screenshots/christmas-member-v4/`, where each image is V3 beside V4. To try it, sign in wherever this branch runs and open `/?season-preview=christmas-2026&season-date=2026-12-25`. Change the date to `2026-12-26`, `2026-12-31` or `2027-01-01` for the other days. **Exit preview** ends it; only that tab is affected.
