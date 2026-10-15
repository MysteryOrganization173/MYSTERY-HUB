# Premium Data Buying Experience V2

Branch: `claude/data-buying-v2-s6j5qn`, stacked on Homepage V2 (`claude/homepage-v2-bl4bst`, PR #11). It will be rebased onto `main` once Homepage V2 ships.

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

## Not yet checked

A real Android device: the keyboard covering the sheet (handled through `visualViewport`) and switching to the MoMo prompt and back. Live Paystack and telecom behaviour were not exercised, by design.
