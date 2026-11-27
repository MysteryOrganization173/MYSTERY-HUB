# Mystery Hub 3.6.4 · Christmas Grand Finale

**Status:** code release. It integrates and hardens the existing seasonal presentation; it does not switch it on.

**What this release does not do:**
- It doesn't switch on Christmas, Mystery Greetings or the December campaign.
- It doesn't restore MTN Data or turn on storefront payments.
- It changes no production setting, payment path, supplier, price or database.

**What deploys after merge:**
- the ordinary-site improvements (availability-aware service cards, the Help question, accessibility fixes);
- a dormant seasonal layer that starts on its own on 1 December, but only if `SEASONAL_EXPERIENCE=christmas-2026` is set on the API service.

**Starting checkpoint:** `origin/main` at `6f0c671` (PR #149). The only open PR was the stale draft #69, which this release doesn't touch.

**Screenshots:** [`docs/screenshots/christmas-grand-finale-3-6-4/`](screenshots/christmas-grand-finale-3-6-4/). They are synthetic data from a local production build. Customer pages use synthetic API answers. Seasonal pages use the founder preview, except the January restoration image, which uses the real public lifecycle.

## 1. Whole-product assessment (Stage A)

Every customer page was rendered: ordinary and Christmas, guest and member, at 390 px, on `main`.

**Strong and kept as approved:**
- the guest and member Christmas homepages;
- the premium Data page and its seasonal look;
- Orders and the Mystery Receipt;
- the Service Control Center notices;
- the shared shell (logo hat, phone menu, footer);
- the Greetings discovery card.

**Findings.** No P0 was found: payments, recovery, restrictions and privacy were intact.

| # | Priority | Finding | Fixed |
|---|---|---|---|
| 1 | P1 | **Seasonal lifecycle.** The provider asked the server once, on load. There was no Accra midnight boundary, no foreground or reconnect refresh, and Greetings readiness was never refreshed. Worse, the status said `active: false, pack: null` on 30 November whether the season was set or off, so an open page or installed app could not change on 1 December, and could not return to normal on 6 January without a reload. | Yes |
| 2 | P1 | **Endless decorative motion.** The guest header lights twinkled forever on every guest page. Guest and member hero idles looped. The live dots looped. The Data page art ran about 30 s and the Orders art about 6.6 s. Two ordinary-page marks (a Website Builder plan badge, the Marketplace radio icon) pulsed forever. | Yes |
| 3 | P1 | **Availability copy.** "Data Bundles: MTN, Telecel & AirtelTigo · Available" appeared on the ordinary and Christmas guest homepages, both member Buy Data tiles and More Services while MTN Data was paused. | Yes |
| 4 | P1 | **Festive edge on serious states.** The festive sheet edge and ribbon showed on serious states for guests and members: a refund-review or support receipt, and the checkout's paused, refused, closed and recovering states. | Yes |
| 5 | P1 | **Pop-up and overlays.** The exceptional announcement pop-up (3.6.3) was not registered with the shared overlay stack. Install, notification and channel invitations could not see it, and the page behind it did not hold still. | Yes |
| 6 | P2 | **Member pages.** Signed-in customers' secondary pages carried only the logo hat; guests had a quiet seasonal line on each. | Yes, for members on shared pages, Wallet and Earn |
| 7 | P2 | **Cut-off seasonal lines.** They were cut off on phones (About and Help at 320 px, Earn at 430 px). | Yes |
| 8 | P2 | **Help.** It had no answer for "a service is paused". | Yes |
| 9 | P2 | **Admin seasonal panel.** It said "Off" before 1 December even with the setting present, and lacked 1 December, 27 December and 5 January previews. | Yes |
| 10 | P2 | **Accessibility (all year).** Wallet activity details had low contrast. A disabled Earn share row scrolled with nothing focusable. | Yes |

**Not defects:**
- Members' checkout already had the seasonal edge, through a 3.6 rule in `shell.css`; only the serious-state exception was missing.
- The `/app` "Checking…" spinner settles after 1.5 s.
- The About hero box is a Cloudinary image that the test harness blocks.

## 2. Seasonal lifecycle (the main correction)

**The contract.** `GET /api/seasonal/status` keeps every field and adds two:
- `scheduledPack`: the pack the setting names, even before its first day or after its last;
- `serverTime`.

These are presentation facts only. Nothing a request sends can change them.

**The page** (`src/seasonal/SeasonProvider.tsx` and `src/seasonal/seasonClock.ts`):
- **Works out the Accra day itself.** Ghana keeps GMT with no daylight saving, so a timer fires at the next 00:00 UTC. Phases change at midnight without any request: 1 December, 25, 26 and 27 December, 31 December, 1 January, and back to normal on 6 January.
- **Asks the server again only when the answer could change:**
  - just after midnight, at a random moment in the first 30 s so open pages don't all ask at once;
  - back in the foreground (visibility, focus or a page restored from the back-forward cache) once the last answer is over 5 minutes old;
  - when the connection returns;
  - every 30 minutes while visible.
- **Controls its requests.** One request runs at a time, with an 8 s timeout. After a failure, retries back off: 30 s, 1 min, 2 min, and so on up to 10 min.
- **Corrects a wrong clock.** A phone more than 10 minutes from the server's clock is corrected. That is longer than the status can be cached, so a cached answer never shifts a correct phone. An answer more than a year out is treated as broken and ignored.
- **Offline,** the last server answer stands for up to 7 days, always within the pack's dates. After that the page is ordinary until the server answers. Answers stored before 3.6.4 are ignored, so the first visit after deploy asks the server.
- **Greetings readiness** is refreshed with the season. When creation opens or closes, an open page offers or withdraws the creator, so it never shows a dead link.
- **Preview is unchanged:** a per-tab `sessionStorage` override with a ribbon.
  - A preview without a date follows today and changes at midnight.
  - A forced 6 January preview still shows New Year for review, while the public lifecycle restores ordinary.
- **Never changes prices, availability, eligibility or orders.** A change of season keeps every page mounted; only attributes, slots and the homepage composition change. A checkout left open across midnight keeps its place and the typed number (tested).

## 3. Motion

- **Finite and short.** Every decorative seasonal animation now ends within about five seconds (WCAG 2.2.2), and the stylesheets are tested for it:
  - the header strand twinkles twice, then stays lit;
  - the guest hero floats and twinkles once the first time it is seen, never again on scroll;
  - the member hero glints twice;
  - live dots pulse three times;
  - the Data and Orders art settle within five seconds.
- **Ordinary pages.** The two endless ordinary-page pulses now pulse three times (`.mh-brief-pulse`).
- **What still loops** is real loading feedback only: skeletons, spinners and the sign-in busy indicator. The chip-row edge fade is scroll-driven and moves only while the customer scrolls.
- **Reduced motion** keeps everything still, now including the member accents.

## 4. Integration

**Service availability (Service Control Center):**
- Service cards name only the networks selling now ("Telecel & AirtelTigo" while MTN Data is paused), or "Paused for maintenance" when none is. This covers the ordinary and Christmas guest homepages, both member homepages and More Services.
- More Services marks a paused network's chip.
- A delay never removes a network.
- MTN Airtime and Instant Bundles are independent and stay listed.

**Serious states stay plain.**
- **Marked serious:**
  - the checkout's paused sheet;
  - its refused, closed, recovering and active-MTN-order states (`data-sheet-mood="serious"`);
  - receipts that need help or a refund review (`data-rc-mood="serious"`, from 3.6.2).
- **Effect:** these never get the festive edge or ribbon, for guests (pack) or members (shell).
- **No change:** the 3.6.2 celebration rules are untouched (one celebration, only for a delivery the receipt saw happen).

**Members (Level B):**
- Signed-in customers now get the same quiet seasonal line and ornament on shared pages: Services, About, Help, Website Builder, Creative Studio, Marketplace, AFA, Results Checkers, App, Wallet and Earn.
- The Wallet line is hidden while an account is under review.
- Only accent styles were widened to `[data-season-audience="member"]`. The guest background, header lights, footer greeting, sign-in styling, Help colours and celebrations stay guest-only.
- Nothing renders while the account is still being checked.

**Overlays.** The exceptional pop-up now registers with the shared overlay stack. While it is open the page holds still and invitations wait, as for every other dialog. No second coordination system was added.

**Shell and phones.**
- The logo hat, menu, footer and navigation are unchanged.
- On phones up to 480 px each seasonal line keeps one ornament, so its words always fit (About now reads "Merry Christmas, Ghana").

**Unchanged and verified:**
- Data and Checkout keep their purchasing behaviour (prices, eligibility, recipient and receipt-email rules, recovery).
- Orders and receipts keep their status truth, masking, ownership and account switching.
- The integrated countdown uses the shared calendar ("N days until Christmas", "Tonight we welcome 2027", "2027"), so it is never negative or expired.
- No CTA advertises the future standalone Countdown.

**Help** answers "What does it mean when a service is paused?" without guarantees, and links to Orders.

**Admin → System → Seasonal experience** now shows:
- "Set · starts on its own on 1 December 2026", "On for everyone", "Set, but the season has ended" or "Off";
- the season dates and what happens on 6 January;
- who sees what, including that serious states stay plain;
- that the season is independent of MTN, Greetings, the campaign and storefront payments;
- how to leave a preview;
- preview buttons for 1, 10, 24, 25, 26, 27 and 31 December and 1 and 5 January.

It still only reads.

## 5. Verification

| Check | Result |
|---|---|
| Type-check, production build | Clean |
| New suite `christmasGrandFinale364.test.ts` | 11/11 |
| Full suite | 3,638 pass, 0 fail (62 opt-in database tests skipped) |
| Browser lifecycle, controlled clock (guest and member boundaries, open checkout across midnight, background, wrong clock, offline and reconnect, Greetings open and close, 6 January restoration, malformed previews) | 31/31 |
| Customer journeys 1–10 plus phase days, widths 320/360/390/430/768/1280/1440 (guest and member, 8 pages each), failed seasonal chunk, blocked storage | 170/170 |
| Performance, accessibility and motion (lab bytes, slow-phone lab LCP/CLS, axe on 14 seasonal pages, reduced motion, settled motion after 9 s at 1440, Pixel 7 and iPhone 13 emulation) | 37/37 |
| 3.6.3 Service Control browser checks, rerun | 111/111 and 107/107 |

**Performance** (local lab, not field data):

| Page | Transferred | Requests |
|---|---|---|
| Ordinary guest homepage | 375 KB | 58 |
| Seasonal guest homepage | 588 KB | 74 |

- Ordinary visitors download no Christmas chunk on any page tested.
- Seasonal chunks are small, and lazy per role:

  | Chunk | JS (gzip) | CSS (gzip) |
  |---|---|---|
  | Guest homepage | 12.7 KB | 11.0 KB |
  | Member homepage | 8.2 KB | 7.1 KB |
  | Guest pack | 4.5 KB | 4.1 KB |
  | Shell | 2.9 KB | 3.5 KB |
  | Data | 2.7 KB | 3.0 KB |
  | Orders | 2.1 KB | 1.7 KB |

- Lab LCP and CLS, at 4× CPU, about 1.6 Mbps and 150 ms RTT:

  | Homepage | LCP | CLS |
  |---|---|---|
  | Ordinary | 2.7 s | 0.017 |
  | Seasonal | 4.4 s | 0 |

  Production Core Web Vitals (field, 75th percentile) are not available to this release, and no claim is made about them.

**Not executed here:**
- WebKit and Firefox: only Chromium is installed in this environment.
- Real devices.
- The WhatsApp in-app browser.

Device checks were Chromium emulation only, which is not equivalent to physical testing.

## 6. Financial, privacy and scope boundaries

**Not changed:** payment initialization, verification, webhooks, recovery, Wallet, suppliers, refunds, reconciliation, pricing, the December campaign (amounts or activation), managed storefront checkout and any restricted payment path.

**Scope:** the season never reaches Admin, the website editor, My Business, published sites, template previews or the standalone Greetings pages; this is tested.

**Copy:** no supplier names, no outage claims, no refund promises and no date guarantees in new copy.

## 7. Dependencies on Mystery Hub 3.5 (Codex)

1. **Greetings activation remains 3.5's:**
   - trusted-ingress evidence;
   - backup and schema installation;
   - the abuse secret;
   - `MYSTERY_GREETING_LINKS_ENABLED` and `MYSTERY_GREETINGS_ENABLED`;
   - a monitored real-domain test.

   See `docs/mystery-greetings-backend-qualification.md`. Christmas does not depend on it: until then both homepages say "Coming soon", and an open page offers the creator within minutes of it opening.
2. **Caching.** The seasonal status is publicly cacheable (60–300 s). If a CDN is added in front of the API, keep that TTL short; the page's clock correction ignores differences under 10 minutes.
3. **Earlier service-control items** stand as written in `docs/service-control-3-6-3.md`: settings backups, cross-instance staleness and payments in flight.

## 8. December 1 launch runbook

### A. Before activation (as of this release)

- **Deployed commit:** see the PR merge. Before the merge, production served `index-BLz_va7i.js` from `6f0c671`.
- **Ordinary website:** live.
- **Seasonal status:** off.
  - Before this release the status could not say whether the setting is present.
  - After deploy, Admin → System → Seasonal experience shows "Set · starts on its own on 1 December 2026" if it is, or "Off (setting not present)" if not.
- **Services** (read-only, 27 November):
  - MTN Data is in maintenance from the shipped default, with nothing saved in the Service Control Center.
  - The MTN Data announcement is live.
  - MTN Airtime and Instant are not paused.
- **Greetings:** closed ("Coming soon").
- **December campaign:** staged and off (all five products are MTN Data, paused).

### B. Founder preview

Open each link in a private window to see the signed-out site, or in a tab where you are signed in to see the member site. A ribbon says "Christmas preview" or "New Year preview"; leave with **Exit preview** or close the tab.

| Day | Link |
|---|---|
| 1 Dec | `https://mysterybundlehub.com/?season-preview=christmas-2026&season-date=2026-12-01` |
| 10 Dec | `…&season-date=2026-12-10` |
| 24 Dec | `…&season-date=2026-12-24` |
| 25 Dec | `…&season-date=2026-12-25` |
| 26 Dec | `…&season-date=2026-12-26` |
| 27 Dec | `…&season-date=2026-12-27` |
| 31 Dec | `…&season-date=2026-12-31` |
| 1 Jan | `…&season-date=2027-01-01` |
| 5 Jan | `…&season-date=2027-01-05` |

(The same buttons are in Admin.)

A preview is a look at the artwork in one tab. It is not activation and not a security boundary. It never changes prices, availability, Greetings, eligibility or what anyone else sees.

### C. Actual activation (founder-authorized; not done by this release)

1. **Set the variable.** On the Render **API** service, set `SEASONAL_EXPERIENCE=christmas-2026` and redeploy or restart it as Render requires. It can be set before 1 December: the season then starts by itself at midnight Accra time.
2. **Expected timing:**
   - New visits see it from the first status answer, which is cacheable for up to 5 minutes.
   - Pages and installed apps already open change at Accra midnight without a reload. If the setting is added after midnight, they change on their next refresh: back in the foreground after 5 min, or within 30 min while visible.
3. **Verify:**
   - Admin shows "On for everyone · christmas-2026".
   - A private window shows the guest Christmas homepage; a signed-in tab shows the member homepage.
   - Data: MTN is still marked under maintenance, and Telecel and AirtelTigo bundles are listed.
   - Tracking a known reference works.
   - Wallet and Orders are unchanged.

### D. Separate decisions (not one operation)

Each of these is decided and switched on its own:
1. Christmas presentation: `SEASONAL_EXPERIENCE`.
2. MTN restoration: the Service Control Center, following the procedure in `docs/service-control-3-6-3.md`.
3. Greetings activation: 3.5's gates.
4. December commercial campaign: Admin → Commercial Pricing.
5. Managed storefront checkout: its own approval gate.

Switching on the season changes none of the others.

### E. Rollback

1. **Remove `SEASONAL_EXPERIENCE`** from the API service (redeploy or restart as Render requires).
2. **Expected timing:**
   - New visits are ordinary within about 5 minutes (status cache).
   - Open pages within about 35 minutes (5-minute cache plus the 30-minute refresh while visible), or sooner when brought back to the foreground or reconnected.
   - A device that stays offline keeps the last answer for at most 7 days, never past 5 January.
3. **Nothing else changes:**
   - order history, payment recovery, accounts, Wallet;
   - Service Control Center pauses and announcements;
   - existing Greeting links;
   - the permanent Data and Orders designs.

   Never delete data as part of a seasonal rollback.

### F. Physical-device acceptance (founder, no purchase needed)

On a budget Android phone (Chrome), the installed PWA, an iPhone (Safari) if available, and a link opened inside WhatsApp, check:
- **Guest homepage, Christmas preview:** the hero, the maintenance bar, and that the Data gift names Telecel and AirtelTigo only.
- **Signed-in homepage:** your name, the Buy Data tile, any order cards.
- **Data:** choose MTN and see the maintenance state; choose Telecel, open checkout, and close before paying.
- **Orders:** open an existing receipt.
- **Exit preview:** the ordinary site returns.
- **Feel:** scrolling and taps are smooth; nothing keeps flashing after a few seconds; no notice covers the bottom navigation or a payment screen.
