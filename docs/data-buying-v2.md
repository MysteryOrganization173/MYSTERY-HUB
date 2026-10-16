# Premium Data Buying Experience V2

Branch: `claude/data-buying-v2-s6j5qn`, based on `main` after Homepage V2 (PR #11) merged.

## Design rationale

The journey has three moments: **choose, pay, follow**. Each one gets a single calm surface, and every claim on screen comes from the server.

| Moment | Before | After |
| --- | --- | --- |
| Choose | Three rows of controls before the first bundle. A Cards/Compact toggle offered two different purchase models (one had a phone box on every card). 20+ bright green Buy buttons. MTN timing appeared only after the list. | One segmented service switch, network chips, and size chips with search one tap away. One list of the shared compact rows (also used on Homepage V2). The Buy pill is quieter and fills on hover or focus, so the price leads. MTN timing appears before the list. |
| Pay | A centred modal with Pay below the fold on phones. The order summary appeared twice and there were two disclaimers. While Paystack was open the screen only said "Opening secure checkout…". | A bottom sheet on phones (centred dialog on desktop) that follows the visual viewport, so Pay stays above the Android keyboard. Order of fields: product, recipient, payment method, receipt, one confirmation block (recipient and total). The recipient formats as `024 123 4567` and shows its network inline. A mismatch warning appears only once the number is complete. While Paystack is open, the sheet says "approve the prompt on your phone with your PIN", gives the reference and adds a PIN-safety line. |
| Recover | Closing Paystack showed a 4-second toast. A reload lost the reference. An offline failure showed the raw "Failed to fetch". | A closed window shows "The payment window was closed", the reference, and **Check payment status** (a server lookup). The customer can then edit details and pay again. The device keeps the last payment reference for 24 hours, so the Data and Orders pages offer "Did your last payment go through?". Connectivity failures before Paystack opens say plainly that nothing was charged. |
| Follow | Small ✓/○ text, action buttons before the details, no sign of whether status was current. | A vertical timeline (Payment confirmed, then Processing, then Delivered) built only from `dataOrderPresentation`. A stopped order marks the step where it stopped. "Last checked hh:mm" appears, with a calm offline notice. The receipt (product, amount, recipient, reference with copy) comes before the actions. Help is emphasised when an order needs attention. |

## Transaction boundaries kept

- `initializeServerPayment`, commercial quote revisions (`expectedTotalMinor`, `pricingRevision`, `promotionRevision`), the Wallet request ID, `submissionPending` and the disabled-while-busy rules are unchanged.
- The Paystack close callback still calls `/api/payments/cancel` as before.
- Recovery only reads `/api/orders/lookup/:ref`. It never re-initializes, retries, verifies or marks anything paid. "Pay again" is always a customer tap.
- Stored recovery data is the public order reference, a product label and a timestamp. No phone number or email is stored.
- The phone is formatted for display only. The server still normalizes and validates it (`validateAndNormalizeGhanaPhone`).
- Reseller storefront `BundleCard` (Website Builder) is unchanged.

## Changed files

- `src/components/checkout/CheckoutModal.tsx`: the sheet layout, pinned Pay action, payment-in-progress and closed-window states, connectivity copy, phone formatting.
- `src/components/checkout/OrderStatusModal.tsx`: the sheet layout, timeline, freshness and offline line, receipt-first order.
- `src/components/checkout/PendingPaymentBanner.tsx` (new): the "Did your last payment go through?" card.
- `src/components/data/DataPage.tsx`: one list, the service segmented control, compact filters, MTN note before the list, banner.
- `src/components/data/CompactBundleRow.tsx`: quieter Buy pill, price-led hierarchy. The API is unchanged for Homepage V2.
- `src/components/orders/OrdersPage.tsx`: banner, and the shared lookup mapping.
- `src/utils/checkoutRecovery.ts` (new): phone formatting, connectivity detection, last-payment storage, lookup mapping.
- `src/hooks/useVisualViewport.ts` (new), `src/index.css` (sheet animation, reduced-motion safe).
- Tests: `dataBuyingV2.test.ts` (new). These were updated where V2 intentionally changed layout: `dataCheckoutRescue` (recipient before receipt), `dataMobileSelection` (no card view), and `bundleCardCompression` (a stale assertion that contradicted the existing no-delivery-note rule and was already failing on `main`).
- `scripts/reviewDataBuying.py` (new): an isolated browser review with synthetic API responses and a Paystack stub.

## Verification

- `tsc --noEmit` passes and `vite build` passes.
- `npm test`: 1825 pass, 1 fail. The failure is `websiteBuilderV1.test.ts`, which fails identically on `main` (template name "Ghana Data Express" vs "QuickByte Data"). It is Website Builder code and out of scope.
- `scripts/reviewDataBuying.py` drives 30 screens at 360, 390, 768 and 1280px with no horizontal overflow and no page errors. It covers: full purchase to queued, processing and delivered; closing Paystack then a server-confirmed late payment; returning after a reload; an active MTN order; an unavailable package; offline before payment; a slow initialization; a wrong-network number; and the receipt while the status check is offline. Every `/api` call is answered by the script, and only the initialize and cancel stubs accept writes.

## Backend limitations (for a separate Codex task)

1. **Closing Paystack cancels the order immediately.** A MoMo customer who approves on the phone and then closes the window gets a `cancelled` order. When the payment lands, `OrdersStore` marks it paid but sets `manual_review` (see `ordersStore.ts` around line 1003). The customer then sees "Your order needs support review" instead of normal delivery. V2 shows this honestly but cannot avoid it. Smallest correction: record the close as `payment_closed_at` without cancelling, and let the existing stale-pending reconciler (which checks Paystack first) cancel or expire the order.
2. **The guest receipt email is required by the client only.** The server already falls back to a placeholder address. Making it optional is a product decision (see `feat/optional-data-checkout-email-v1`). V2 leaves the requirement but explains what it is for.
3. **The receipt polls every 3s while open**, regardless of connection quality. A server-side push or backoff would reduce load. The frontend now shows the freshness of the status.
4. **The Instant Bundle fee in checkout is a display estimate** carried over from before. The server total remains authoritative.

## Connectivity & Purchase Experience V2 (follow-up on this branch)

Masked's broader brief extends this work to Instant Bundles, Airtime and AFA. Data, Instant and Airtime ship here; the AFA Registration page ships in a separate draft PR stacked on this one, so its identity handling gets its own review.

| Area | Before | After |
| --- | --- | --- |
| Prices | Each surface formatted cedis differently (`GH₵ 15.00`, `GH₵5.99`, mono, green). | One `Money` treatment: a quiet GH₵ mark, whole cedis at full weight, smaller pesewas, tabular figures. |
| Buy actions | Colour change on hover only; on a phone a tap gave no sign until the sheet opened. | Press-in scale, the pill fills green and pulses once, with an 8ms vibration on Android. Reduced motion keeps only the colour change. |
| Instant Bundles | Large cards, each with its own recipient box (the number was asked again in checkout). Price only; the checkout fee appeared first in checkout. Emoji filter pills plus an always-open search. | Tappable rows like Data: amount, network, a coloured condition chip (Midnight-only data, For supported video usage), validity, price and "+ GH₵0.23 fee". Out-of-stock rows sink to the end and are disabled. Search sits behind an icon. |
| Flexi | Free number field defaulting to GH₵10 with tiny min/max text. Checkout reused the fee the server priced for the minimum amount, whatever was typed. | "Choose amount" opens an inline panel with quick picks within the server limits, inline errors and "Bundle GH₵20.00 + checkout fee about GH₵0.52". Checkout labels a Flexi fee as an estimate and computes it for the typed amount. |
| Airtime | Numbered steps starting with the network; network cards labelled with MoMo wallet names; errors as toasts. | Number first (formatted, with a "This looks like a Telecel number. Switch to Telecel" hint once complete), network chips, a 3×2 amount grid with "Other amount", a total panel and "Continue · GH₵10.00". Errors sit under the field. The number carries into checkout. |
| FAQ | Category pills plus a custom accordion. | Plain disclosures, first one open. |

Kept as is: server pricing, quotes, the Flexi min/max limits, the zero Airtime fee, supported networks, and checkout's payment logic. The fee estimate (`src/utils/instantFee.ts`) mirrors the server's default gross-up, and a test checks it against `calculateFlexiInstantBundlePrice`.

Backend note 5 (for Codex): the catalogue prices a Flexi bundle only at its minimum amount, and there is no quote endpoint for other amounts. The checkout total for a typed Flexi amount is therefore a client estimate until Paystack shows the server's figure. A small `GET /api/instant-bundles/:id/quote?amount=` would make it exact.

## Not yet checked

A real Android device: the keyboard covering the sheet (handled through `visualViewport`) and switching to the MoMo prompt and back. Live Paystack and telecom behaviour were not exercised, by design.

## Release train update (2026-10-16)

- Flexi amounts no longer reach checkout with a client-side fee estimate. Checkout calls `GET /api/instant-bundles/:productKey/quote?amount=`, a read-only route that runs the same catalogue lookup and `calculateFlexiInstantBundlePrice` as `/api/payments/initialize`. Pay stays unavailable until the quote arrives; a failed quote shows "Price not confirmed" with Try again. `instantFlexiQuote.test.ts` checks quote total equals the initialized Paystack amount for several payable ratios.
- Initialization still receives the amount the customer typed (`requestedAmount`), never the quoted retail price.
- Still open for Codex: closing Paystack cancels the order immediately, so a late MoMo approval lands as paid + manual_review. Unchanged by this release.
