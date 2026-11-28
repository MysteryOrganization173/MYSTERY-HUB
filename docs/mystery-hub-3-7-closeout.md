# Mystery Hub 3.7 closeout · founder refinements

The founder accepted Releases A (Countdown 3.7.1), B (Mystery Gifts 3.7.2) and C (Performance & Mobile 3.7.3) on 28 November 2026, subject to the documented physical-device and production-verification limits, and asked for ten focused refinements in one closeout PR. Baseline: `main` at `6f43f58`.

No production setting, price, campaign, feature gate, service control, payment, supplier purchase, refund or broadcast was changed or started. MTN purchasing stays paused. Mystery Gifts stays dormant.

## Status

| Item | Implemented | Tested locally | Reviewed | Merged / deployed / live |
|---|---|---|---|---|
| 1. Member welcome line | Kept (already on `main`) | Yes | Yes | See the PR |
| 2. Countdown sharing copy | Yes | Yes (unit and browser) | Yes | See the PR |
| 3. Countdown sound | Yes | Yes (unit, browser, offline render) | Yes | Awaiting physical-device listening |
| 4. Seasonal Fraunces | Adopted for seasonal pages and Greetings; not for the Countdown | Yes (render comparison, lab A/B) | Yes | See the PR |
| 5. Data Welcome Offer placement | Yes | Yes (lab CLS) | Yes | See the PR |
| 6. Year-round Welcome Offer advert | Yes | Yes | Yes | Live config read; production display after deploy |
| 7. December stacked discount | Combined figure shown only while a stacking campaign applies | Yes | Yes | Not active (campaign not applying; MTN paused) |
| 8. Gifts contact audience | Handoff updated | n/a (documentation) | Yes | 3.5 responsibility |
| 9. Boundaries | Nothing outside the frontend changed | Yes | Yes | n/a |

## 1. Member welcome line

"Welcome! Let's get you connected." was applied in 3.7.3 to both the ordinary and the Christmas member homepages. It stays, and a test now holds both.

## 2. Countdown sharing copy

The share message now uses the founder's wording, lightly refined. The link sits on its own line in WhatsApp.

Before midnight:

> Counting down to 2027 with Mystery Hub! ✨
> Another year, another chance to make beautiful memories. Let's welcome 2027 together! 🥂💚
> https://mysterybundlehub.com/countdown

After midnight:

> Happy New Year! 🎉
> May 2027 bring you happiness, peace, new opportunities and countless reasons to smile.
> Here's to another beautiful year together. Afehyia pa! 💚
> https://mysterybundlehub.com/countdown

- **Native sharing** passes the text and the link separately. The share sheet adds the link once, so it never appears twice.
- **WhatsApp** sends the text, a line break, then the canonical link.
- **Link previews** (`countdownHead`) use the same words without emoji: titles "Counting down to 2027 · Midnight in Accra" and "Happy New Year 2027 · Afehyia pa!".
- **Unchanged:** the canonical URL, no tracking parameters, nothing personal, and no "sent" claim.

## 3. Countdown sound

**Before:** Sound on played a two-note confirmation, then nothing until the final ten seconds (one repeated tick note) and a midnight bell chord. Most visitors heard a chime and then silence.

**Now:** Sound on starts an original ambient soundtrack, composed for the Midnight Dial and synthesised live in the browser (`src/countdown/score.ts`). There are no recordings, samples, downloads or existing melodies, so there is nothing to license.

- **The piece (F major):**
  - **Days and the eve:** warm pads that change chord every eight seconds, a soft piano line that wanders the pentatonic scale (never one repeated note), and occasional high chimes.
  - **Final hour:** a little brighter, with a little more piano.
  - **Final minute:** a controlled build. The pulse quickens, the tone opens and the line climbs as the seconds fall.
  - **Final ten seconds:** the music steps back and holds the chord that resolves at midnight. Each second plays its own rising note (ten different notes up the scale).
  - **Midnight:** a warm low swell, a rising bell chord (F A C F) and a scatter of chimes like sparks. The pad blooms into the home chord, then settles into a slower, brighter welcome.
- **Controls:** one **Sound** button, off by default. While sound is on, a second **Music** button lets the visitor keep only the countdown sounds (final ten seconds and midnight). A short note under the controls says what is playing for a few seconds ("Music on. Midnight has its own sounds." or "Music off. Countdown sounds stay on."). It sits outside the page flow, so it moves nothing.
- **Browser limits, stated honestly:** audio starts only from the tap. If the browser refuses, the button switches back off and the note says "This browser didn't allow sound. Try again." A phone's silent switch or media volume can still mute it, and the page can't detect that.
- **Loading:** nothing is created before the tap. The music's code is its own small chunk (1.8 KB gzip), fetched on the tap, and the countdown's first load is unchanged.
- **Hidden and leaving:** hiding the page suspends the audio and stops all scheduling. Coming back resumes it. Leaving the page closes it.
- **Comfortable level:** a gentle limiter on the output. In an offline render of 60 s (calm, build, final ten seconds, midnight), the peak was 0.29 of full scale and the overall level −27 dBFS. Only the first second (the fade-in) was near-silent.
- **Countdown accuracy and performance:** timing still comes only from the server clock. Sound follows the stage the page already shows. Audio runs on the browser's audio thread, and the scheduler wakes four times a second only while sound is on and the page is visible.
- **Reduced motion and accessibility:** unchanged. The buttons have `aria-pressed`, and the note is a polite status.

A 60-second preview, rendered from the same code, is attached to the founder report (`countdown-sound-preview.wav`). Physical-device listening is still needed: browser emulation is not a phone speaker.

## 4. Seasonal serif (Fraunces)

**Compared:** the current file (full optical-size range 9–144, both weights, 81.7 KB latin woff2) and the candidate fixed at optical size 72 (both weights, 45.2 KB). The same Google Fonts family and licence, so this is only a different instance.

**Rendered comparison** (`docs/screenshots/closeout-3-7/fraunces-mobile.jpg`, `fraunces-desktop.jpg`), the same text in both:

| Size | Width change at opsz 72 | Character |
|---|---:|---|
| 10.5–17 px (menu, footer, small labels) | −7 to −8 % | Same letterforms; slightly narrower, finer hairlines |
| 22–32 px (cards, greetings) | −7 % | Same |
| 56 px (seasonal and Countdown headlines) | −3 % | Near-identical |
| 120–240 px (Countdown "2027" and final seconds) | +4 to +6 % | Visibly lower contrast than the automatic opsz 144 display cut |

**Decision:**
- **Adopted** for seasonal pages and Greetings. Their serif runs from 10 to 75 px, and the seasonal hero headline (the page's LCP) is close to the automatic cut.
- **Not adopted** for the Countdown. Its numerals are drawn at up to 240 px, where the high-contrast display cut is part of the approved Midnight Dial. The Countdown keeps the full file (`COUNTDOWN_SERIF_HREF`).
- **Trade-off:** a visitor who opens both a seasonal page and the Countdown downloads both files (45 + 82 KB). The Countdown is usually opened directly from a shared link.

**Lab A/B** (the 3.7.3 method: HTTP/2, 150 ms latency, 200 KB/s, CPU 4×, 5-run median, back to back against a `main` build):

| Page | Fonts KB | Serif ready | LCP |
|---|---|---|---|
| Seasonal homepage, guest | 113 → 77 | 3640 → 3553 ms | 3828 → 3744 ms |
| Seasonal homepage, member | 155 → 120 | 3669 → 3340 ms | 2780 → 2712 ms |
| Countdown (unchanged font) | 140 → 140 | 2459 → 2345 ms | 1676 → 1628 ms |

The Countdown's change is lab noise: its font is identical. Lab figures are not field data.

## 5. Data Welcome Offer placement

**Before:** the server-confirmed notice appeared above the Data title panel once the quote arrived, pushing the whole page down (lab CLS 0.117 for guests).

**Now:** the title panel has one fixed-height line directly under "Stay connected." It always exists and is always 28 px tall:

| Visitor | The line shows |
|---|---|
| Before the server answers | "Total shown before you pay" |
| Guest, offer on | "Up to 18% off your first bundle", a button that opens free sign-up ("· create a free account" on wider screens) |
| Eligible member | "Ready: up to 18% off your first bundle" |
| Everyone else | "Total shown before you pay" |

- **No empty gap:** an ineligible customer never sees empty space; they keep the reassurance. "Total shown before you pay" moved there from the wide-screen list, so it is never shown twice.
- **Verified in a browser:** with the quote held back 1.5 s, the line and the panel kept the same height before and after the answer at 320, 360, 390, 430, 768 and 1280 px. There was no layout shift and no overflow, and the offer text was not cut off.
- **Lab:** Data guest CLS 0.117 → 0.000 (5-run median).
- **Unchanged:** authoritative eligibility (the same server quote and cache), payment recovery first (the pending-payment banner still comes before the panel), and the bundle cards.

## 6. The permanent Welcome Offer: findings

**Production, read-only (28 November 2026, 14:25 UTC):** public guest requests from the founder's own computer's browser. The sandbox can't reach the domain. No sign-in was used and nothing was written.

| Read | Result |
|---|---|
| `GET /api/commercial/products` | `direct-launch-v1`, no campaign. **No MTN products**: MTN Data is paused in the Service Control Center. AirtelTigo 1GB GH₵4.99 is the cheapest. |
| `GET /api/commercial/quote/at-1gb` (guest) | `offer: { enabled: true, discountMinor: 100, state: "guest" }`, promotion `welcome-launch-v1` |
| `GET /api/commercial/quote/mtn-1gb` | 404 "Bundle unavailable." (paused) |
| `GET /api/seasonal/status` | `active: false`, `source: "off"`, scheduled pack `christmas-2026` |

**Configuration is not the problem.** The GH₵1 offer is enabled in production and served correctly. No 3.5 correction is needed for it.

**Why it wasn't prominent: the advertisement only existed in seasonal code.**
- The "Up to 18% off · your first data bundle" card was built for the Christmas homepages. The season is off, so it showed nowhere.
- The ordinary guest homepage and the Data page showed only a small one-line GH₵1 notice.
- The ordinary member homepage showed nothing at all.
- Eligibility worked throughout. The welcome-offer read asks for MTN 1GB first. That returns 404 while MTN is paused, and the read correctly tries one other product, so the state came back on every page.

**Now, all year, independent of the season** (`src/components/offers/WelcomeAdvert.tsx`, figure in `src/utils/welcomeAdvert.ts`):

| Surface | Guest | Eligible member | Anyone else |
|---|---|---|---|
| Ordinary homepage | Card beside "Popular data bundles": "Welcome offer · Up to 18% off · your first data bundle · For new customers · Create a free account". Its room is kept from the first paint, so it moves nothing. | (members see the member homepage) | Nothing |
| Ordinary member homepage | n/a | Chip "✓ Up to 18% off" in the "Start here" heading row (first purchase only). The row keeps its height. | Nothing |
| Data page | Line under the title (section 5) | "Ready: up to 18% off your first bundle" | Reassurance line |
| Christmas homepages | Existing Welcome card, same figure | Same | Nothing |

- **The figure is computed, not typed in:** the confirmed server offer against the confirmed catalogue on screen, rounded down, and never above the approved 18% headline ceiling.
- **Live:** GH₵1 of GH₵4.99 (AirtelTigo 1GB) is 20%, held to "up to 18%".
- **Nothing is advertised** until the server's catalogue and quote are confirmed. A customer who has used the offer, is holding it on a pending payment, or can't get it (no phone, a shared phone) sees nothing.
- **Checkout** is unchanged and remains the only place that shows the exact saving and total.
- **Lab check:** an early build of the advert asked for a web font that ordinary pages don't otherwise load (+28 KB). It now uses the page's own fonts. The final ordinary-page bytes are in section 10.

## 7. December stacked discount: the 33% check

**The configured prices don't support 33% for Data.**

| MTN | Standard | December | First purchase (with GH₵1) | December only | Combined |
|---|---:|---:|---:|---:|---:|
| 1GB | 5.49 | 4.99 | 3.99 | 9% | **27%** |
| 2GB | 10.49 | 8.99 | 7.99 | 14% | 23% |
| 3GB | 14.99 | 13.39 | 12.39 | 10% | 17% |
| 4GB | 19.49 | 17.79 | 16.79 | 8% | 13% |
| 5GB | 23.99 | 21.99 | 20.99 | 8% | 12% |

- Each saving is against the product's own standard price, rounded down. The baseline is not manipulated.
- The **33%** figure is **AFA Registration** (GH₵29.99 → GH₵19.99 = 33.3%), a separate, MTN-only service. Its December price is built but off, and needs an Admin-confirmed contractual supplier cost (`docs/afa-december-pricing.md`).
- **The largest genuine combined Data saving is 27%** (MTN 1GB first purchase). The December-only headline is 14%. The permanent welcome-only headline is 18%.

**Today none of the December prices can apply.** The campaign covers MTN 1–5GB only, and MTN Data is paused. Production shows no campaign object. Whether the campaign is saved as enabled for 1 December couldn't be read without Admin access. Either way, while MTN is paused it applies to no product.

**How the three are now told apart for customers:**
- **Permanent welcome:** "Up to 18% off your first data bundle".
- **December campaign:** the existing Christmas tray headline "December Specials · Up to N% off", only while the server applies the campaign. Prices are crossed out against the standard price.
- **Combined:** new. Only while a campaign the server applies stacks with the welcome benefit, the Welcome card adds "Up to 27% with the December Special" (computed the same way). It shows on both the ordinary advert and the seasonal card.
- **Checkout:** already itemises regular price, December Special, welcome benefit, total and saving.
- **When inactive:** nothing December-related appears, because the server sends no campaign fields.

Nothing was activated, re-priced or restored.

## 8. Mystery Gifts: Gift Recipients audience

`docs/mystery-gifts-3-7-2.md` and its Codex handoff (section 6.6.1) now require a separate **Gift Recipients** audience in Contact Hub, instead of leaving gift recipients out. In short:
- **Separation:** its own source (`gift_recipient`), derived from the greeting-gift association. It is never fed into the registered, guest, payer or ordinary-recipient streams, and never the buyer's number.
- **Provenance:** carried on each record, without the message, the sender's typed name or the link.
- **Admin access:** the same Admin RBAC as today, with filtering and deduplication by canonical phone. Where a number is also a customer, both relationships show and its own permission state wins.
- **Exports:** allowed for administrative and support purposes. Marketing exports, SMS Studio campaigns and bulk SMS exclude it unless the number has its own marketing permission. Gift provenance is never a permission.
- **Withdrawal and suppression:** they apply as for every contact.
- **Spoilers:** automatic recipient-side Mystery Hub messages stay suppressed. The network's own delivery text is outside Mystery Hub's control and is never promised.

No audience control was built in the frontend. The authoritative audience and paid gifting remain 3.5 work.

## 9. Boundaries

Nothing in `server/` changed except tests. Nothing in `shared/` changed. Checkout, payment recovery, the Service Control Center, merchant isolation, pricing and eligibility rules, the dormant Gifts foundation and the Countdown's clock are untouched.

## 10. Verification

- **Focused tests:** `mysteryCloseout37.test.ts` (new, 13 tests) and the updated `mysteryCountdown371`, `welcomeOfferCardPricing`, `dataCheckoutRescue` and `ordersTracking362` suites.
- **Full suite:** see the PR.
- **TypeScript:** passes. **Production build:** passes.
- **Browser** (`scripts/reviewCloseout37.cjs`, local build and local in-memory API): 14 of 14 checks pass.
  - Data at six widths for guests, and for an eligible new member.
  - Homepage guest card at 360 and 1280 px.
  - Member chip at 320 and 390 px.
  - An ineligible-member check that was skipped: the local API requires a phone at signup.
  - The Countdown sound lifecycle in a real Chromium audio context: nothing before the tap; music code fetched on the tap; Music toggle; hidden → suspended → resumed; off; leaving.
  - The offline sound render.
- **Countdown regression** (`scripts/reviewMysteryCountdown.cjs`): 33 of 38. The five failures are "horizontal overflow" checks that fail identically on a build of unchanged `main` in this sandbox. They are pre-existing, not introduced by this change. The sharing and sound checks pass.

## 11. Remaining limitations

- **Physical devices:** sound, the serif and the new placements are verified in browser emulation only. The founder should listen on a phone (speaker and earphones, silent switch off) and check iPhone Safari's audio unlock.
- **Live display:** the new adverts are not verified live until this deploys. Production was read only through public guest requests. Admin-only settings (whether December is saved as enabled, live supplier costs) were not read.
- **Lab only:** no field data.

## 12. Actions for 3.5 (Codex)

1. **Urgent, unchanged:** the MTN duplicate-order privacy fix. Instant Bundle and Airtime `ACTIVE_MTN_ORDER` 409s return another customer's `existingOrderReference` (`server/routes/api.ts`, around lines 562 and 737). This closeout documents it only.
2. **Mystery Gifts:** the separate Gift Recipients audience (handoff section 6.6.1), with the recipient-safe notifications and the rest of section 6, before any gift is sold.
3. **No correction needed** for the Welcome Offer: production serves it enabled at GH₵1.
4. **Founder decisions** (not 3.5 code):
   - December prices apply only if MTN Data purchasing is restored.
   - "Up to 33%" may only be advertised for AFA, after its cost confirmation and enablement.
   - The largest genuine combined Data saving is 27%.
