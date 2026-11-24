# Mystery Hub 3.6.2 · Premium Orders, tracking and the digital receipt

**Status:** code release. This changes how orders are shown, never what they are. Payments, verification, recovery, idempotency, the reorder contract, supplier submission and the Paystack isolation from PR #143 are unchanged. No production flag changed. The ordinary design goes live through the normal deployment. The Christmas and New Year appearance follows the existing season switch (`SEASONAL_EXPERIENCE`), which stays off.

**Baseline:** `origin/main` at `23be3b3` (PR #144). The only open PR was the stale draft #69, which this release does not touch.

**Screenshots:** [`docs/screenshots/orders-tracking-3-6-2/`](screenshots/orders-tracking-3-6-2/). They use synthetic orders only, from a local production build with synthetic API answers.

## Before this release

**Already strong, and kept:**
- **Status helpers:** `customerOrderStatus` and `dataOrderPresentation` already keep refund pending, verified refund, manual completion, external remedy and assisted orders apart.
- **Tracking:** reference-only tracking with masking.
- **Session safety:** per-account remount of the list.
- **Smart Buy Again:** the 3.4.1 contract.
- **Payment recovery:** the recovery banner.

**Genuine defects** (all now fixed, with regression tests):

| # | Defect | Effect |
|---|---|---|
| 1 | **Wrong wording for non-Data receipts.** | An expired or cancelled Airtime, Instant or AFA payment read "Confirming your payment · Checking your payment with Paystack…" with "Amount Paid". An AFA order with a legacy `refunded` status (no verified refund) read "Refunded". Airtime receipts talked about "your bundle" and "Data has been loaded onto your SIM". Non-Data receipts showed a time-agnostic bar filled to ⅓ / ⅔ / full. |
| 2 | **Live updates were dropped.** | The receipt's live check did not update an open account or tracked Airtime, Instant or Marketplace order (only Data and AFA). Those receipts never changed and kept checking every 3 s indefinitely. For Data and AFA, `customerResolution` and `paymentBasis` were not applied. |
| 3 | **The list contradicted the receipt.** | The list copied status fields back from the receipt but not `customerResolution`, `paymentBasis` or the Marketplace stage. A card could still say "Manual review" after the receipt learned of a verified refund. |
| 4 | **Stale or extra answers.** | Late answers could replace the receipt shown. The checking loop restarted on every app render, because `updateOrderStatus` was a new function each time, and so made extra immediate requests. Slow answers could overlap. A late tracking answer could replace a receipt the customer had opened meanwhile. |
| 5 | **Celebration replayed.** | The Christmas celebration played every time an old delivered receipt was reopened. |
| 6 | **Device orders crossed accounts.** | Device-saved orders were shown to anyone using the device. After member A signed out, a guest or member B saw A's device purchases with full recipient numbers. Sign-out also left an open receipt showing. |
| 7 | **Payment reference shown.** | The receipt's "View payment details" showed the device record's Paystack payment reference. |
| 8 | **Card and receipt disagreed on assisted orders.** | For assisted (complimentary or operator-recorded) orders that had stopped, the card said "Support review" while the receipt chip said "Awaiting supplier". |
| 9 | **Animations never stopped.** | The receipt had endless spinner and pulse animations. |

## Design direction: the Mystery Receipt

One permanent design that matches the Data store.

### Orders page

- **Title panel:** a lit charcoal-and-green title panel with an original receipt illustration.
- **Tracking:**
  - For a guest with nothing saved, tracking is the page's main action. It explains:
    - what a reference is;
    - where to find it;
    - why a phone number can't be used;
    - what tracking shows.
  - Otherwise tracking is a compact "Track another order" row.
- **History:** when the list is unfiltered, it reads in the order a customer cares about: Needs attention, In progress, Refund under review, Earlier orders.
- **Filters and summary:**
  - Filters keep their exact classification, with coloured counts.
  - A summary line says what the loaded records show, for example "12 orders · 2 in progress · 1 needs attention". It never shows all-time totals.
- **Cards:**
  - Compact, one control each.
  - A status-coloured edge.
  - "Complimentary" instead of a price.
  - Savings shown only once a payment is confirmed.

### Receipt

The receipt is one sheet for checkout, history and tracking:
- **Status seal**, title, status chip and next step.
- **Three-stage journey** that advances only from server state. It stops visibly at manual review or failure. Refunds and remedies get a resolution journey (payment received → support review → outcome) instead of a delivery bar.
- **Receipt "slip":**
  - the reference first, with Copy;
  - a tear line;
  - the product, recipient (masked for reference lookups), dates and payment state;
  - an honest amount label: Order total, Amount paid, Complimentary ("No charge"), Recorded payment, with notes such as "Refund not confirmed yet".
- **One primary action** chosen by the situation:

  | Situation | Primary action |
  |---|---|
  | Needs help | Get help |
  | Delivered Data, Airtime or Instant | Buy again |
  | Results Checker | Open your receipt |
  | Anything else | Done |

  Support is always reachable. Marketplace, AFA and Results Checker orders are never offered again from a receipt.

## Season (Christmas and New Year)

- **Who and when:** the season applies to guests and members alike (`shellActive`), on the existing calendar. Looks:
  - Christmas: evergreen, champagne and berry;
  - Christmas Day: warmer light;
  - New Year from 27 December: midnight, silver and plum.
- **Loading:** everything comes from one lazy chunk, `christmas/orders`: a wrapped-receipt illustration, a line above the title, a stylesheet that re-tones the page's own tokens, a small ornament on receipts that are going well, and one finite celebration.
- **When the celebration plays:** only for a supplier delivery the server reported while the receipt was open, after first saying "not yet". It never plays for a payment, a manual remedy, an out-of-date saved record or a reopened receipt.
- **Serious receipts stay serious:** attention, refunds, unconfirmed and closed payments never carry the season or the shared sheet bow.
- **Failures:** if the chunk fails, the ordinary design shows.
- **Ending:** the season ends on 6 January with nothing to undo.

## Motion

- **Uses** transform and opacity only.
- **Entrances:** play once, never on a status refresh.
- **On change:**
  - the status section crossfades;
  - journey lines fill;
  - a changed card status pops once;
  - Copy confirms;
  - an untrackable entry gives a small nudge.
- **Finite:** every idle animation stops. The only loops are the loading shimmer and the refresh spinner, which run only while a request is in flight.
- **Reduced motion** holds everything still.

## Welcome Offer (Data page)

- **Position:** the notice now sits inside the page margins, after payment recovery and before the title panel. It renders nothing, and takes no space, when no offer applies.
- **Unchanged:** eligibility, amounts and the guest "Create account" action.

## Changed files

| Area | Files |
|---|---|
| New presentation | `src/utils/orderReceiptPresentation.ts`, `src/components/checkout/receipt.css`, `src/components/orders/orders.css`, `src/components/orders/OrdersArt.tsx` |
| Redesigned | `OrdersPage.tsx`, `CustomerOrderCard.tsx`, `TrackOrderPanel.tsx`, `OrderStatusModal.tsx` |
| Synchronisation and privacy | `src/context/AppContext.tsx` (`updateOrderStatus`, `ownerUserId`, sign-out), `customerOrderPresentation.ts` (`visibleDeviceOrders`, assisted stopped states), `dataPurchasePresentation.ts` (assisted label) |
| Season | `src/seasonal/ordersSeason.ts`, `Seasonal.tsx` (`SeasonalOrders`), `christmas/orders/*`, `christmas/copy.ts` (`ORDERS_LINE`) |
| Other | `DataPage.tsx`, `dataStore.css` (Welcome Offer); `AdminSeasonalPanel.tsx` (text only) |
| Tests | new `ordersTracking362.test.ts` (21 tests); pins updated with the same intent in `dataBuyingV2`, `dataCheckoutRescue`, `seasonalExperience` and `customerCopyP0` |

There are no server, database, payment, webhook, supplier or Admin behaviour changes.

## Verification

- **Type check and build:** `tsc` is clean and the production build passes.
- **Full suite:** **3648 tests, 3587 pass, 0 fail, 61 skipped.** The 61 skipped are the opt-in native PostgreSQL suites. They were not run because this release changes no server or database code.
- **Browser QA:** **297 checks pass.** The production build ran with synthetic API answers; no payment or supplier call was made.

  | Area | Checks | What they cover |
  |---|---|---|
  | Responsive | 156 | 320–1440 px including short Android heights; guest, device, member and 50-order accounts; receipts. |
  | Guest | 23 | Empty, phone number, invalid, unknown and found references; lookup failure; keyboard; masking; device history. |
  | Member | 15 | Sections, filters, search, empty, history failure, refresh failure, 50-order limit, sign-out, account switch with a late answer. |
  | Receipt | 57 | 31 synthetic states, long reference at 320 px, polling cadence, live delivery and resolution sync, Airtime live update, stale answer, copy success and failure, Buy again, discontinued, historical services. |
  | Pending payment | 2 | The recovery banner. |
  | Season | 23 | Guest and member on 10, 25 and 31 December; delivery celebration; serious receipts; exit preview; ordinary when off; reduced motion; chunk failure. |
  | Welcome Offer | 13 | Guest, eligible member and Christmas at 320, 390 and 1280 px; offer off. |
  | Extra | 8 | Keyboard-open height, tracking while signed in, recovery banner. |

- **Accessibility:** axe found no serious or critical issues on the guest page, the member page or the receipt. One contrast issue found during QA was fixed.
- **Bundle (gzip):**

  | Part | Before | After | Change |
  |---|---|---|---|
  | App chunk JS (holds the receipt) | 92.96 KB | 92.78 KB | −0.18 KB |
  | App CSS | 9.58 KB | 11.96 KB | +2.38 KB (receipt styles) |
  | Orders page JS | 5.21 KB | 6.62 KB | +1.42 KB |
  | Orders page CSS | — | 4.03 KB | new |
  | Seasonal Orders chunk (only while a season applies) | — | 2.01 KB JS + 1.62 KB CSS | new |
  | Entry | — | — | unchanged |

- **Independent review:** a separate agent reviewed the change. It found no critical issues and confirmed:
  - no 3.5 interference;
  - polling is better than before;
  - isolation and privacy hold.

  **Fixed, important:**
  - status changes are now announced by a live region that stays mounted;
  - Marketplace orders keep their own words in every stage.

  **Fixed, minor:**
  - AFA review wording now follows the card rule;
  - Results Checker and AFA wording no longer mentions the network;
  - complimentary orders show "No charge";
  - the unverified refund stage is named "Refund confirmation";
  - the celebration needs an observed "not yet" from the server;
  - device records the server never answered claim nothing and are checked;
  - stopped assisted orders are never shown as progressing;
  - tracking uses a request ticket;
  - nits: the tautological test, the repeatable check, the StrictMode guard, the doc comment, "Order" vs "Receipt", and the "Saving" row shown only on the buyer's own records.

## Notes for Mystery Hub 3.5 (not changed here)

- **No account linking.** Device-saved guest orders do not join an account on sign-up, and the backend has no linking contract. The receipt invitation no longer implies that they do.
- **Old device records.** Records made before this release carry no owner and stay visible as device history. A one-time clean-up, or linking them when the buyer signs in, needs a backend contract.
- **Polling cost.** Receipts for cancelled or expired payments keep checking every 3 s while open (unchanged rule). Each check is a database read plus a throttled supplier refresh. A slower schedule for closed states, or server push, would reduce load.
- **Public discount figures.** `commercial_pricing` is part of the public reference lookup. The receipt shows a saving only on the buyer's own records, but the field is still public.
- **Guest header animation.** The guest Christmas header lights (approved shell, outside this release) twinkle on an endless loop.
