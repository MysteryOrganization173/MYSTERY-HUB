# Managed Data checkout integration — 15 October 2026

## Decision

INTEGRATED; RELEASE BLOCKED pending an actual Paystack TEST-mode checkout session. Do not merge this candidate into auto-deploying main on synthetic evidence alone.

Starting main: `a60786c314b757de9cd38377199f5a1b81fdf801`. Original repair: `6535c43d4d47033ca8192ab4b173d288d2200602`, based on `5233879079413b6422f829631676b16c3ea81597`. Release branch: `release/reseller-checkout-v1-production`.

Original repairs were cherry-picked in order with provenance: `b0e85b33fd804cc654cdc2d38fe13e2d7ed027cf` → `fe67210`; `6535c43d4d47033ca8192ab4b173d288d2200602` → `da6ca5b`.

Both integration conflicts were in ManagedDataStorefront. The current shared renderer, owner theme, explicit preview flag and draft/published contracts were retained. Checkout state is scoped to both site ID and preview/published mode, disposing previous callbacks on mode/site changes. Preview does not read payment recovery storage, initialize payments, track orders or emit checkout analytics. No old renderer replaced V1.2.

## Checkout behavior

The native review dialog closes synchronously before server initialization or SDK resume, releasing its top-layer input interception. Submitted recipient/email/product/request identity stay locked. A deliberate resume after cancellation reuses the same request identity. Server idempotency remains authoritative. A 20-second browser deadline means uncertainty; late responses retain references without opening a late popup. Reload enters reference/identity-only recovery. No recipient, email, access code, secret or asserted paid state is stored in recovery storage. If storage is unavailable, existing in-memory safeguards remain active.

Callback settlement and unmount guards suppress duplicate/stale UI effects. SDK success requests backend verification and then authoritative order tracking; pending or failed verification never marks a local order paid. Safe recovery from a server-confirmed payment releases the previous client lock; uncertain attempts remain tracking/support-only. No new public recovery endpoint or financial behavior was added.

## Official SDK evidence and precise blocker

Official documentation reviewed: https://paystack.com/docs/payments/accept-payments/ and https://paystack.com/docs/developer-tools/inlinejs/ . Documentation shows server initialization and access-code resume, lifecycle callbacks, and mandatory backend verification.

The actual official script from https://js.paystack.co/v2/inline.js was downloaded outside Git. SHA-256: `b855783ab68e5bb11468a9bbfbf59118680e50b902733bfa0a400e56db782f56`. Its actual resumeTransaction implementation was executed and confirmed to forward accessCode plus onSuccess/onCancel/onLoad/onError from the second argument. Its close and cancel events invoke onCancel. No invented SDK callback-registration workaround was introduced.

The full official SDK was also loaded in the isolated browser fixture using a deliberately invalid, nontransactional access code. It created its Paystack checkout frame, invoked the loading-error path, restored review, retained the reference and did not claim success. This proves only that error path and callback wiring, not a valid TEST checkout or its cancellation/success lifecycle.

The inspected local application configuration and inherited environment contain no usable Paystack TEST secret/public key. No live key was used or printed. The founder was asked for only the path of a private TEST configuration file. A private Paystack TEST secret key or an appropriately issued TEST access code is needed for a controlled session with an isolated backend, synthetic buyer data and no production database or supplier access. Do not substitute production initialization or a mocked PaystackPop for this release gate.

## Verification

The exact starting-main baseline is the verified Builder V1.2 final run: 1,729 tests, 1,724 passes, three inherited failures and two optional skips. Final integrated suite: 1,761 tests, 1,756 passes, the same three failures and two optional skips — 32 additional passing tests and no new failures. Real embedded PostgreSQL publication checks ran rather than being skipped. The known failures are obsolete Direct SIM copy, an obsolete Builder template-name expectation, and the raw Free schema-mirror assertion. No unrelated test was weakened.

Final focused lifecycle/preview/publishing/reserve verification, including direct Data/Airtime compatibility, passed 83/83. TypeScript and production build passed. Diff whitespace check passed. Existing Vite warnings remain unchanged. Installed dependencies and manifests are unchanged.

Compiled component browser checks used synthetic loopback endpoints and a clearly labelled synthetic provider frame at 320/360/390/430/768/1280px. Review stayed inside each viewport without measured horizontal overflow. Native modal was absent at every SDK open; iframe cancellation was clickable, restored the review and focus, and retained locked submitted details. Cancellation/resume made two initialization requests with one unique order identity. A synthetic SDK success with verification returning pending remained Pending Payment. Price mismatch, uncertain initialization and missing SDK retained recovery and disabled blind repayment. A response arriving after the 20-second timeout preserved its reference without opening a provider frame. Reload blocked a new purchase. Executable component tests cover preview, duplicate submission and stale callbacks after unmount/mode/site replacement; the shared real hook tests additionally cover Data and Airtime.

Preview browser counters after attempted Buy and reference lookup: zero initialization, verification, tracking, analytics and unique orders. Physical Android Chrome and Mobile Safari were unavailable; responsive in-app browser tests are not represented as physical-device certification. Actual provider focus, scroll handling and valid TEST popup interaction remain unverified.

## Scope, safety and remaining release procedure

Source changes remain frontend-only: ManagedDataStorefront, usePaystack and storeCheckoutAttempt. Supporting tests comprise resellerCheckoutLifecycle, resellerReserveDiagnostics, resellerBuilderV12Integration and the existing narrowly updated systemwideProductPolish assertion. This document records release readiness. No vendor SDK, local fixture, screenshot, log, environment file, dependency or generated build output belongs in the commit.

Backend services/routes/database, publishing schema and renderers, payment validation/webhook/fulfilment, pricing/reserve/economics, earnings, withdrawals, refunds, Admin resolution and Welcome Offer behavior match starting main. No production database access or mutation, customer-site/order edit, payment, refund, supplier submission, transfer, migration, Render change, merge or deployment was performed during this integration.

After a valid isolated official TEST session demonstrates popup visibility, interaction, cancellation and callback/recovery behavior, recheck remote main and candidate scope. If main advanced, re-integrate and run affected checks. Otherwise normally fast-forward the release, push without force, verify both Render revisions and health, inspect existing published Data review and confirm owner preview remains nontransactional. No backend contract change or new migration is required by this candidate. A frontend rollback must retain the already deployed V1.2 snapshot model; never restore a pre-V1.2 backend or drop snapshots. No live transaction is authorized by this checklist.
