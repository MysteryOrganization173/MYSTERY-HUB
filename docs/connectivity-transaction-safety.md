# Connectivity V2 transaction-safety contract

Review candidate only. Do not deploy without founder approval of the financial-flow corrections.
The original design work is PR #12 (a4b3403) followed by stacked PR #15 (26d05ea), on main 41a4e3a.

## Payment closure and recovery

A browser close/cancel event is not evidence that a MoMo transaction failed. POST /api/payments/cancel now verifies the saved payment reference with Paystack. A matching successful transaction enters the existing payment and supplier-dispatch pipeline. Only a matching failed/abandoned provider transaction can close an unpaid attempt. API failures, timeouts, malformed responses, test-domain failures, pending, ongoing, processing and reversed responses cannot cancel an unresolved live attempt.

Cancel and expiry use one conditional SQL update for every service, checking pending status/payment status, no paid timestamp and no supplier submission/delivery. The memory fallback serializes against the same payment lock used to mark paid. A race cannot overwrite a newly paid/dispatched order. Existing cancelled/expired orders that subsequently receive payment remain subject to the existing manual-review hold; they are not automatically reopened or dispatched again.

Stale reconciliation no longer expires a still-pending provider payment merely because it is old. Uncertain attempts remain available for verification. Operators should investigate prolonged pending attempts rather than deleting them or initiating another supplier purchase. Existing financial, Wallet and supplier idempotency mechanisms remain in place.

The SDK bridge deduplicates repeated closure/error signals and permits one later success signal for direct checkout. That signal still invokes server verification; it never proves payment locally. Managed storefront settlement keeps its existing behavior. Checkout identity guards ignore stale UI callbacks after closure, replacement or session change. A new checkout resets presentation loading state without authorizing an old attempt.

Recovery is customer initiated: lookup first, then server Paystack verification for a pending order. Missing references preserve the reminder and advise retaining payment evidence/contacting support; they are not proof that nothing was charged. Storage contains only public reference, product label, network and start time, with runtime validation and a 24-hour reminder lifetime. Public responses remain masked.

## Exact Instant/Flexi quotes

GET /api/instant-bundles/quote?productId=instant-PACKAGE&amount=10 returns success and quote:
- productId, requestedAmount (Flexi face value, null for fixed packages)
- productRetailMinor, feeMinor, totalMinor, currency GHS
- expiresAt (epoch milliseconds), opaque revision and token

The server uses the existing complete pricing calculator, live package supplier ratio/limits and commercial configuration. Wholesale cost/configuration never enter the public response. Amounts must be finite positive numbers with at most two decimal places; malformed package limits fail closed.

The token is signed with a domain-separated HMAC using the existing backend Paystack secret and expires after two minutes. No new production secret or database migration is required. The keyless nonproduction fallback uses a process-local random key; production without its payment secret cannot quote. The opaque revision binds the package, configuration and computed pricing. Key rotation, pricing/catalogue changes, amount/package changes, expiry or tampering invalidate consent.

POST /api/payments/initialize accepts instantQuote (the token). It recomputes authoritative pricing and validates the quote before order creation or payment initialization. Flexi requires a valid quote; legacy fixed-price requests remain compatible, and supplied fixed-package quotes are validated. A stale/missing Flexi quote returns 409 / INSTANT_QUOTE_CHANGED. The frontend refreshes the price but requires another explicit Pay tap. It compares the initialized amount to the approved quote before opening the SDK. No automatic payment retry occurs.

The picker no longer presents a default-only fee estimate as the final commercial model. Checkout distinguishes requested Flexi value from retail bundle price where supplier ratio/minimum margin raises retail, and displays the exact fee and total. Pending/expired quotes disable Pay.

## AFA identity and uncertainty

AFA initialization persists the authenticated registration before contacting Paystack. Definitive provider rejection may close only an unpaid attempt. Ambiguous initialization retains the pending order, encrypted payload and duplicate-registration guard, returning 503 / INITIALIZATION_UNCERTAIN with an existingOrderReference. Unexpected exceptions after persistence also preserve recovery state.

The frontend never claims a connection failure proves that no payment started. It displays the recovery reference and My Orders action, blocks repeat uncertain submission and focuses the recovery notice. Synchronous submit and session guards prevent duplicate/stale form actions. Only HTTPS checkout.paystack.com redirects without embedded credentials/custom ports are accepted.

Return receipts use the server verified flag; an unconfirmed return cannot label payment as received, mark journey steps complete, display a paid fee label or provide registered-only USSD instructions. Only provider-confirmed registration displays those instructions.

Ghana Card and date of birth remain encrypted in the existing authenticated AES-GCM registration payload and are not placed in URLs, analytics or browser persistence. Operational details (including name/location) remain available to authorized staff as before; interface wording now describes that distinction accurately. Existing supplier submission latch, publicId recovery, manual review and terminal sensitive-payload purge remain unchanged. Uncertain initialization deliberately retains encrypted evidence rather than purging it prematurely.

## Verification and release handling

All provider cases use synthetic HTTP responses and supplier stubs. A new disposable native PostgreSQL 17.6 database on loopback verified actual cancel/expiry UPDATEs blocked behind an independent connection's payment/submission transaction. Neither operation overwrote the committed paid/submitted record. No production database was used; no schema changes are introduced.

Final isolated regression: 1,887 total; 1,880 pass; 2 inherited failures; 5 skipped. The two failures are the unchanged websiteBuilderV1 test-file/template expectation and websiteFreeV1 schema-mirror assertion (Windows line endings), already present in the main release baseline. The disposable PostgreSQL test is deliberately skipped in ordinary runs and passed separately with explicit CONNECTIVITY_TEST_DATABASE_URL pointing to a loopback database ending in _test. Four other skips are inherited. Relevant financial/Wallet/Instant/AFA/privacy/hook selection: 609 pass, zero fail, two skips; final UI selection: 41/41. TypeScript, production build and git diff --check pass. Existing Vite warnings remain.

Compiled synthetic browser checks covered 390px Flexi pricing (GH₵10 requested value, GH₵11.05 retail + GH₵0.33 fee = GH₵11.38), popup closure/retry hold, late approval into tracking, AFA pending return, AFA uncertain initialization/recovery focus, and 1280px AFA/Homepage checkout. No horizontal overflow in measured 390/1280 views. Marketplace/Wallet data outside the focused synthetic fixture are intentionally unavailable, not production checks.

Physical Android touch, software keyboard/back/app-switch behavior and real Paystack/provider acceptance remain unverified. No merge, deployment, production setting, live payment, refund, Wallet credit, customer record or supplier purchase was performed.

After founder review, preserve PR #12 before PR #15: incorporate the backend correction and Data-specific frontend correction into the reviewed Data release, then retarget/update the AFA PR against that merged main and incorporate its AFA-specific correction. Recheck the effective AFA-only diff. The combined integration branch is a review artifact, not authorization to bypass that order. Deploy backend before the new quote-dependent frontend; old Flexi clients will safely receive a refresh/review error until frontend rollout completes. Account for that short availability window in rollout planning. Roll back code by a normal revert/release procedure only; never undo financial records or weaken verification to recover availability.

Official provider guidance: https://paystack.com/docs/payments/verify-payments/ and https://paystack.com/docs/payments/webhooks/ . Only provider-confirmed success authorizes payment fulfillment; callbacks and signed webhooks must not duplicate delivery.
