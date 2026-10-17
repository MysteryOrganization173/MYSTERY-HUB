# Admin Operations V3 engineering record

Initial remote main: `1b4d955c1abd9ce5921f9b07ea5662a373c9bb8b` (16 October 2026).
Work is isolated from Marketplace V2 `d0d0032`, Connectivity safety `3cb5cb1`, and Builder B1 `1ca1eb3` / Claude B1 `44f4fd1`.
Production investigation is SELECT-only. No production order, account, refund or supplier action is part of testing.

## Issue inventory (source-confirmed)

- P0: Legacy manual closure treats every non-JSON supplier response as unverifiable, including the locally written `Paystack verify API` receipt marker. The reported order has that marker, no supplier ID, no submitted timestamp, and a recorded prelaunch closure. The marker is not evidence of supplier rejection; manual closure must require separate documented supplier nonacceptance/failure evidence. Do not rewrite the live order.
- P0: Finance summary reads enter mutation transactions and implicitly create zero-balance accounts. Passive admin inspection must use read-only snapshots, without reconciliation or account creation.
- P1: Overview subtracts recorded cost from all successful payments, including failures/refunds, silently treating missing costs as zero. Wallet redemptions are presented as new customer receipts. Correct reporting uses payment, submission and delivery event dates separately.
- P1: Earn liability is globally clamped after aggregation. One customer's reversal debt can hide another customer's positive entitlement. Show per-customer positive liabilities and separate reconciliation shortfalls.
- P1: Registered-account history is linked only by authoritative user_id. Guest purchases do not automatically belong to later registrations. Historical checkout customer_phone is the recipient; it is not distinct payer evidence. Never infer a buyer or merge accounts from this value.
- P1: Signup issues a valid session but leaves last_login_at null. Login updates it; authenticated middleware updates session last_seen_at. “Last Active / Never” and animated “Active” labels are misleading. Show retained session activity and recorded login separately; enabled is access state, not online presence.
- P1: Customer deep links initialize purchase summaries to zero rather than the server's actual aggregates. Detail and list must share definitions.
- P1: Older Orders filter responses can overwrite newer results, making working lenses appear unresponsive. Guard list requests against stale responses.
- P1: Customer Champions and immutable giveaway decisions do not exist; existing ranking is referrers only. Guest payer identity requires explicit evidence review because historical recipient fields are not proof.
- P1: No dedicated assisted-order source, immutable quote/confirmation, or safe admin recovery workflow exists. Never manufacture provider-paid status, blind-retry ambiguous submissions, or use status override as delivery evidence.
- P2: Overview buries financial performance beneath alerts and duplicates inconsistent period figures. Put the server-defined summary first, with supporting-order drilldowns.
- Backlog: Provider asset deletion/abandoned-upload cleanup and real Android camera acceptance remain separate from a successful mocked upload test. Preserve the V2 upload protections.

## Other sections reviewed

Marketplace uses existing admin RBAC, readiness validation, signed uploads and provider-side finalize checks. No pending Marketplace branch was imported; the subsequently released Marketplace, Connectivity, AFA and Builder changes on current main are preserved by the review integration. Builder/Ultra uses published snapshots, owner lookup and read-only inbox APIs; no renderer changes belong here. Commercial Pricing has abort/timeout/retry handling and backend-authoritative revisions; no economics are changed. Launch Requests uses persisted status updates and protected CSV export with formula neutralization. System Health distinguishes configuration from transaction proof. Financial actions retain explicit confirmations, account locking, audit history and idempotency. New work must preserve these contracts.

## Reporting contract

Amounts are safe integer GHS minor units. Ghana boundaries use UTC; weeks start Monday. Gross Paystack order receipts use paid_at. Wallet purchases are liability redemptions, with top-ups separately reported in Finance. Completed sales require verified paid, delivered, non-refunded purchases and delivered_at. Gross margin pairs only those sales with documented direct cost. Unknown completed costs are excluded and disclosed. Customer refund confirmation is distinct from supplier-wallet reimbursement and from funds visible in a customer's bank. No net-profit claim is made without fees, rewards, taxes and overhead.

All new admin APIs sit behind requireAdmin and no-store responses. New private tables must enable RLS and revoke all privileges from PUBLIC, anon and authenticated. Isolated PostgreSQL tests must verify actual role grants, repeated initialization, concurrency and rollback.

## Delivery boundaries

A: Accuracy/read-only reporting, customer semantics, navigation reliability.
B: Champions rankings, explicit guest identity evidence, frozen rounds, award history; no dispatch or money movement.
C: Manual-resolution evidence compatibility and fail-closed recovery eligibility.
D: Assisted-order quote, source classification, confirmation, durable dispatch and reconciliation through existing supplier integration.

Release status and exact verification evidence are recorded after implementation. Nothing is production verified solely because a page renders.

## Recovery boundary

Known local payment notices are distinguished from provider responses. Closing a legacy notice case requires independent documented supplier failure/nonacceptance and legitimate customer-remedy evidence. Unknown/malformed supplier responses, active delivery, uncertainty and any linked customer refund still block closure. Original supplier and payment facts remain unchanged. The reported live order was read only, never corrected by this implementation.

The new recovery action supports only direct Data orders still in unclaimed `paid` state. It re-verifies the exact live Paystack payment or original Wallet debit, runs supplier preflight, locks and rechecks the order, atomically claims it with audit and durable history, then continues the existing dispatcher. An intent/crash/ambiguous response cannot be replayed. Queued/failed/submitted orders cannot be blindly resubmitted; refresh an existing supplier ID or reconcile externally. Supplier ID is persisted before ancillary state updates. A status PATCH cannot mark supplier-backed delivery.

Recovery checkpoint evidence: 123/123 focused payment/manual-resolution tests; 8/8 native isolated PostgreSQL tests, including separate-connection claims and audit rollback. TypeScript passed. Full combined regression and compiled browser review remain final-candidate gates.

## Assisted-order boundary

The initial assisted service is Data bundles supported by the live supplier catalogue and the current server retail catalogue. Other service-specific assistance is not advertised as implemented. Quote cost comes from the supplier catalogue, not a local estimate; terms are rechecked before authorization and dispatch. Quotes last two minutes. Registered customer selection is explicit; separate guest payer/contact and recipient remain distinct.

Two new private append-only tables retain quotes and one authorization per quote/request/order. Authorization, original order and audit commit atomically under PostgreSQL locking. Complimentary orders have amount zero, payment status `not_required` and no paid_at. Externally collected orders have `recorded`, the server retail amount and operator payment evidence, never provider success. Neither generates Welcome Offer, referral eligibility, Wallet activity or provider-verified sales. External collections and complimentary cost are separately disclosed in reporting.

The existing dispatcher is reused after authorization. A durable acceptance-uncertain marker precedes POST; publicId is saved before ancillary updates. Replays inspect the existing order only. Concurrent/recent recipient duplicates, expiry, changed prices/costs, disabled supplier service or insufficient balance block authorization. Uncertain outcomes stay in review; no automatic resend/refund is introduced. Existing customer and public views receive only a coarse payment-basis label, never private authorization evidence.

Assisted checkpoint evidence: combined focused A/B/C/D tests 59/59; real PostgreSQL 9/9 with role permissions, repeat initialization, separate connections and rollback. A JSONB key-order defect was reproduced and fixed using canonical quote comparison. No production schema or records were modified. Native PostgreSQL tests use disposable loopback databases only.

## Final engineering review refinements

Compiled browser review reproduced a one-minute navigation-badge cache and a retained order-reference search when changing a deep-linked order lens. Successful actions now force fresh passive signals; older responses cannot overwrite the newer cache. All order lenses were exercised with synthetic records. No-ID labels now say acceptance is not recorded instead of asserting a request was never sent. Customer cards are keyboard buttons, access labels say Enabled, activity/login timestamps are distinct, and staff history includes every linked record so its count agrees with the account summary. Normal customer history filtering remains unchanged. Older giveaway rounds can be loaded beyond the latest fifty. Mobile financial cards retain their accounting explanations for screen readers and in the expandable basis.

The combined candidate on its original base completed 1,928 tests: 1,907 passed, 3 confirmed inherited failures and 18 skipped. Nine new isolated PostgreSQL scenarios passed separately. A subsequent targeted customer-history/signals/assisted check passed 32/32. TypeScript, production build and diff checks passed. The unchanged initial main baseline was 1,855 total: 1,843 passed, 3 failed and 9 skipped. The failures are the stale Direct SIM assertion, Website Builder V1 test-file failure and an existing SQL mirror newline assertion. None was weakened to pass this work.

Browser evidence is private outside Git under `C:/Users/AB/Documents/Codex/admin-operations-v3-evidence`. It includes before/after Overview at 390/1280, the 360/390/430/768/1280 layouts, every Admin navigation destination, each Orders lens, a real synthetic evidence-to-manual-remedy journey with immediate attention refresh, controlled paid recovery, a complimentary assisted quote/submission, frozen Champions and anonymous shortlist/award history. Provider HTTP methods were mocked in the synthetic server and all external fetches blocked. These are not live provider or physical Android acceptance claims.

Remote main advanced during the final handoff to `34a0096ae302656e8bfa445a462e1ef19e3a7e6a`. The initial checkpoints are preserved; current-main compatibility requires separate integration review and fresh combined evidence. No automatic production merge is authorized by a passing test on the older base. No production migration, data mutation, real supplier charge, payment, credit or refund occurred.

Remaining boundaries: assisted creation and never-claimed recovery currently cover direct Data bundles, not AFA PII/airtime/Instant-specific assistance. Claimed/failed/uncertain POSTs cannot be resent automatically merely from missing IDs or operator guesses. Manual remedies retain original supplier facts and are excluded from supplier-confirmed completed sales and purchase rankings. Reports currently project the full modest orders dataset; SQL aggregation/indexing and quote-retention maintenance are scaling follow-ups. Live Cloudinary upload acceptance and physical Android acceptance remain operator checks, not inferred from mocked regressions.

## Current-main review candidate (17 October 2026)

`integrate/admin-operations-v3-review` combines current main `34a0096ae302656e8bfa445a462e1ef19e3a7e6a` with the four preserved operational checkpoints. This is a review branch, not a production merge. The SQL mirror and two customer order views conflicted. Resolution retained current main's schema/checkout design and added only the operational schema and truthful assisted-payment labels. Current main's new public lookup mapper also preserves the coarse assisted payment basis. A regression covers the mapper, public masking and ordinary versus assisted receipt steps. No customer checkout, template, publication, pricing or provider configuration was redesigned.

Final evidence:

- Unchanged current main: **1,942 total; 1,928 passed; 4 failed; 10 skipped**.
- Combined review candidate: **2,017 total; 1,994 passed; 4 failed; 19 skipped**. Difference: 75 additional cases, 66 additional passes and nine optional PostgreSQL skips. The nine PostgreSQL cases passed separately against a fresh disposable database.
- The same four failures were independently observed on unchanged current main: reduced-motion CSS newline assertion; empty-location visual-edit-context newline assertion; Website Builder V1's stale `Ghana Data Express` versus `QuickByte Data` expectation; and the existing Website Free SQL mirror newline assertion. They were not changed to make this candidate pass.
- Affected Admin, receipt, financial, Champions, recovery and assisted checks: **88/88 passed**.
- Native PostgreSQL 17.6: **9/9 passed**, including initialization twice under a non-superuser owner with BYPASSRLS, removal of inherited public grants, source-record preservation, passive read-only financial inspection, separate-connection concurrency and full rollback on audit failures. HTTP supplier methods were mocked; no real supplier requests occurred.
- TypeScript and production build passed. Existing bundle-size/dynamic-import warnings remain non-blocking. Final whitespace checks passed.
- Final compiled browser review confirmed customer list/history agreement (six linked fixture records including an unpaid attempt), truthful missing-login/activity labels, keyboard detail opening, distinct guest contact search, Finance requests/history/settings, and loaded Builder/Ultra empty states. Earlier unchanged-code synthetic journeys exercised manual remedy, immediate attention refresh, controlled paid recovery, complimentary assistance and immutable giveaway history. These are synthetic functional checks, not live provider acceptance.
- Final Overview captured at **360, 390, 430, 768 and 1280px**; no horizontal document overflow. All ten navigation destinations and eleven order lenses were exercised during review. No browser console errors were observed in the final compiled review. Physical Android/touchscreen acceptance remains outstanding.

Verification logs and screenshots are outside Git in `C:/Users/AB/Documents/Codex/admin-operations-v3-evidence`. Final logs: `integration-final-regression.log`, `current-main-regression.log`, `integration-focused.log`, `integration-postgres.log`, `integration-typecheck.log`, `integration-build.log`. Initial-main before screenshots remain valid historical comparisons; `overview-integration-390.png` and `overview-integration-1280.png` show the integrated result. Synthetic server code, screenshots, credentials, generated bundles and test databases are not included in the release diff.

## Schema and deployment gate

Five additive private tables: `admin_guest_buyer_evidence`, `admin_giveaway_rounds`, `admin_giveaway_awards`, `admin_assisted_quotes`, `admin_assisted_orders`. They use existing user/order foreign keys, parameterized writes, unique idempotency bindings, private indexes and append-only update/delete protection. RLS is enabled and all table privileges, including TRUNCATE, are revoked from PUBLIC/anon/authenticated. The application backend owner remains responsible for access; customer sessions do not use Supabase Auth. No balances, ledger entries or historical orders are backfilled or relabelled.

A read-only production role precheck on 17 October confirmed `postgres` is non-superuser, has BYPASSRLS, USAGE/CREATE on public and ownership rights on the application orders table. This matches the previously supplied Render database username's underlying role and the isolated owner-role test. No production DDL was executed. Reconfirm the actual Render runtime role/configuration at release time rather than treating a management-console query as proof of the runtime connection.

**GO for founder/engineering review; not a claim of production readiness or deployment.** Review A, B, C and D independently, then review the exact current-main integration. Before an authorized release: re-fetch main, check for further divergence, confirm a fresh recoverable backup, confirm runtime role ownership, and stage backend first so additive schema and admin endpoints are healthy before the new frontend. Keep financial actions paused during rollout verification. Check admin RBAC, private-table grants, read-only reporting and history access before testing any operator action. No automatic supplier retries or real financial smoke tests are part of this task.

Rollback must preserve new operational history and original financial facts. Prefer a reviewed application revert after stopping financial/operator actions; do not drop new private tables or erase evidence. Reconcile any already authorized or uncertain supplier request before any further dispatch. Do not use a schema rollback, status override or missing supplier ID as permission to resend.

## Review checkpoints and founder acceptance

- A `feat/admin-operations-v3-accuracy`: `0abf1982cdbdf705eab91a14675bd4b15d919e08` (includes `42dfed7`).
- B `feat/admin-operations-v3-champions`: `9efcc1d296c1c7f329a15366a5eadfc9b8b75bb6`.
- C `fix/admin-operations-v3-recovery`: `5946ee68dabb8ec99fd710a651c466cc48a1e17a`.
- D `feat/admin-operations-v3-assisted-orders`: `918801153563a4a135ad45e09197a03e44e7179d` (includes `69841b6cb20cdd907f8a9b7291a3cb3113a6b224`).
- Final current-main compatibility and verification are on `integrate/admin-operations-v3-review`; the final report supplies its exact commit and review PR links. Original checkpoint branches remain intact.

Android acceptance after a separately authorized deployment:

1. Open Overview at phone width; choose Today, This week and Custom dates. Inspect a metric's supporting records and its accounting basis.
2. Open all Admin destinations through the mobile menu; switch order lenses and return from details without a retained reference hiding the selected lens. Check attention list and navigation counts agree after a reviewed action.
3. Compare a known account's linked history with its count. Check login and observed activity separately; search guest contacts without attaching them to the account.
4. Inspect Finance Summary, Requests, Customer history and Settings without submitting adjustments, payouts or policy changes.
5. Review Champions eligibility, ties, exclusions, transactions, editable prizes and historical rounds. Use a synthetic environment to freeze a round or record prize evidence; freezing never sends prizes.
6. Inspect the reported legacy case's current evidence and eligibility. Do not resolve a real case until the founder independently confirms the remedy and supplier state.
7. In an isolated environment inspect an assisted quote, complimentary versus external source, price/cost, keyboard visibility and confirmation. Any later real supplier charge requires a separate explicit operator decision. An uncertain submission must remain blocked from replay.

All implementation and checks are local/review-only. No main merge, Render deployment, production mutation, live payment, refund, Wallet credit or supplier purchase was performed. Real operator acceptance is pending.
