# Public order tracking privacy V1 — founder review

Status: non-production release candidate. **Production release remains blocked by isolated official Paystack verification.** No main merge or deployment is authorized by this report.

## Starting state and scope

- Verified remote main: `5233879079413b6422f829631676b16c3ea81597`.
- Exact checkout release base: `6535c43d4d47033ca8192ab4b173d288d2200602`, containing original checkout hotfix `b0e85b33fd804cc654cdc2d38fe13e2d7ed027cf`.
- Privacy branch: `fix/public-order-tracking-privacy-v1`; isolated worktree, preserving all eight existing clean worktrees.
- Permitted integration candidate: `integrate/reseller-checkout-privacy-release-v1`, pointing to the same privacy commit, with no additional implementation commits.
- Separate Customer Experience Release `77887d3a5a6261b225ead164a33b2321926275bc` and Mystery Earn V2 `f731b52341bbecaef7d4ec0fb560e9b28e6f4c45` are not ancestors of the checkout/privacy candidate. Their branches are preserved.
- Exact final privacy/integration commit and remote verification are reported in the accompanying Git checkpoint response; this document is part of that commit.

Original exposure: `toSafePublicOrder()` returned raw `recipient_phone` and private delivery/pickup fields to anonymous reference holders. The reseller UI masked the phone, but its JSON remained readable. Frontend masking was insufficient.

## Response-surface inventory

The model, both original projections, every serializer caller, route authorization, and frontend field consumers were inspected before implementing the patch. Route paths below include the `/api` prefix.

- **GET `/orders/lookup/:reference`** — public; no ownership grant, even with a valid or invalid bearer header. Calls `findOrder` and the existing throttled supplier status refresh, then `toSafePublicOrder`. Shape `{success, order}`. Previously exposed raw recipient and delivery/pickup/variant snapshots. Now returns only the public allowlist below. Existing coverage: `orderStatusSync`, `checkoutPerformanceAndStatus`, `websiteBusinessV1`; new real-router privacy tests cover all five service types, statuses, malformed/unknown references and credential audiences.
- **GET `/websites/:id/store-orders/:reference`** — public; `store_context.siteId` must equal the requested site before provider refresh. `WebsiteBusinessService.publicOrder` calls `toSafePublicOrder`. Shape `{success, data}`. Previously exposed the raw recipient through the shared serializer. Now masked and minimal. Existing coverage: `websiteBusinessV1`, `resellerContrast`; new privacy tests exercise both valid and wrong-store/invalid/unknown references without provider access on rejection.
- **GET `/payments/verify/:reference`** — public reference-based verification; not a private account endpoint. Every already-paid, newly verified and unverified order response uses `toSafePublicOrder`. Shape `{verified, order, message}`. Same former exposure. Now public projection and generic unconfirmed message, without returning provider error payloads. Payment validation, dispatch and financial recovery are unchanged. Existing coverage: `productionIntegrity`, `financeApi`, `websiteBusinessV1`; new tests cover paid and unconfirmed responses, missing records and failure logging.
- **POST `/payments/cancel`** — public reference-based action; POST does not prove ownership. Existing cancellation semantics retained. Shape `{success, cancelled, alreadyPaid, order}` using public projection. Former raw recipient/delivery exposure removed. Existing coverage: payment/checkout production-integrity tests; new tests verify both pending cancellation and already-paid protection with masked JSON, unknown references and failure logging.
- **GET `/account/orders` and GET `/orders/my-orders`** — `requireAuth`, active session, normal password-change restriction; `findOrdersByUserId` matches `user_id`, not phone/email. Shape `{success, orders}`. New `toAuthenticatedCustomerOrder` retains the customer's full recipient and stored delivery/variant/pickup details; a defense-in-depth `user_id` filter precedes serialization. Existing account history hiding of cancelled/expired/unpaid attempts is unchanged. Existing coverage: `authAndWaitlist`, `accountRecovery`, `memberHomeAuth`; new tests cover correct/wrong customer, missing/invalid/expired session, guest orders with matching phone/email, guessed references, empty history and mismatched store results. No new private single-order API was introduced.
- **GET `/admin/orders`, GET `/admin/orders/:reference`, POST `/admin/orders/:reference/refresh`, PATCH review/status operations, POST `/admin/orders/:reference/close-test-order`, GET `/admin/users/:id` orders** — existing `requireAdmin` applies to the router, with no permission changes. All use `toAdminOrderDetails` (lists/detail or nested customer orders). Full recipient, customer contacts, delivery fields, internal order/payment/supplier details and private notes remain available to authorized operators. AFA detail still adds existing masked operational registration data. Existing coverage: `adminV1`, `afaRegistration`, production-integrity tests; new RBAC and rich-detail tests confirm the projection remains correct.
- **GET `/websites/:id/business`** — `requireAuth` plus owned-site check. Shape `{success, data}` with orders, owned Store Earnings, analytics and activity. `safeStoreOrder` retains last-four recipient masking and own-store economics. It now reuses the same recipient masker. Cross-owner read/write checks remain. Existing coverage: `websiteBusinessV1`; new tests assert seller masking, legitimate earning visibility and denial to another owner.
- **GET `/admin/website-builder/:id/business`** — existing Admin RBAC plus site lookup, then the owner's business projection. Existing operational access preserved; no public path to seller economics.
- **POST `/payments/initialize`** — optional auth for direct Data/Airtime/Instant Bundle/Marketplace checkout; authenticated Wallet branch retains ownership/idempotency checks. Replies contain checkout reference, public order reference, authoritative totals and checkout authorization/access code for the initiating buyer, or minimal Wallet result. It never serializes a whole order. Duplicate-order replies expose a reference/status, not a private record. No initialization or retry changes.
- **POST `/afa/payments/initialize`** — authenticated registration; existing replies contain checkout fields/minimal Wallet result, not registration PII. No change to encrypted payload, purge, supplier latch or dispatch.
- **POST `/websites/:id/store-checkout`** — optional auth with invalid credentials rejected; public write limiter. Existing initiating-buyer response contains checkout reference, public reference, totals and payment access fields. It does not return customer contact data or economic snapshots. No change to initialization/recovery semantics.
- **POST `/webhooks/paystack`, supplier webhooks, scheduled payment/supplier reconciliation** — webhook replies are acknowledgements; scheduled jobs have no public order response. They do not call the public serializer. Signature/amount/currency/purpose checks and idempotency are untouched.
- **Finance API and website/public-event API** — inspected for secondary order response leaks; they do not return raw `OrderRecord` through an anonymous tracking path. Existing analytics rejects arbitrary PII/financial events. No analytics or finance changes.

## Public allowlist and audience boundary

`SafePublicOrderDetails` now describes only the actual public contract:

- `public_reference`, `recipient_phone` (masked), `network`, `service_type`;
- `product_name_snapshot`, `bundle_size_snapshot` (contact/private-field text redaction);
- `amount`, `amount_ghc`, `currency`;
- `status`, `manual_review`, `created_at`, `paid_at`, `delivered_at`;
- optional `face_value_ghc`, `service_fee_ghc`;
- `fulfilment_method`, `marketplace_status`;
- optional `commercial_pricing` with only customer-facing regular/discount/paid minor amounts, preserving the existing savings display. No supplier margin, reserve or reward economics are returned.

No raw record spread is used by the public projection. Nested customer/supplier/Marketplace/store/commercial records are excluded. Future raw-record additions do not automatically enter JSON.

`maskOrderRecipient` accepts stored local/international/formatted numbers and emits `******1111` for the synthetic recipient. Only the last four digits survive. Short/corrupt values return `******`, never a short complete number. There is no raw companion field or local/international variant. Existing client masking leaves the already-masked value unchanged, including when a presentation-only buyer flag is set.

Public product/package summaries are catalogue snapshots, not delivery instructions. The serializer removes complete email/phone-like strings and exact known customer name, email, address/note/pickup values if legacy summaries contain them. Private variant and product-slug snapshots are omitted publicly rather than copied. Redaction is not a general-purpose classifier for arbitrary prose; catalogues should never contain customer PII.

Excluded publicly: full recipient/customer phone, email/name/identity, all delivery city/area/landmark/note and pickup-location snapshots, variant/product-slug snapshots, internal order/user/payment/supplier IDs, provider payloads, private notes, referral ownership, authorization/access fields, wholesale/reserve/seller earnings and nested context. Stored records are unchanged.

Authorized customer history restores only the prior own-order presentation fields; it does not expose customer contact identity, internal supplier/payment metadata or store economics. Admin projection builds on that richer customer presentation plus the existing explicit Admin allowlist. No one gains private access from a reference or a bearer header alone. A logged-in user with a matching guest email/phone still does not own the guest record.

## Functional compatibility and request safety

- General tracking supports Data, Airtime, Instant Bundle, Marketplace and AFA using existing statuses; supplier refresh calls remain in place, including the existing server throttle.
- Reseller tracking retains site isolation, reference validation, current status, manual review, price and package. Wrong-store and malformed/unknown references remain non-disclosing 404s.
- Marketplace public tracking retains product/amount/status and fulfilment mode, without a private delivery address. Current tracking UI did not consume the removed delivery/pickup/variant fields. Admin still sees them; own-account API retains them. A guest cannot use a reference to retrieve complete private delivery instructions. A future guest identity-verification flow would require separate approval.
- `ManagedDataStorefront` and `OrderStatusModal` already accept masked strings. `dataPurchasePresentation` does not double-mask or reconstruct digits. No component styling changes were required. `OrdersPage` account orders keep `buyerRecipientVisible`; public lookup never opts into ownership. Member Home and AFA confirmation tolerate the same string field. API client history return types now identify the richer account contract.
- Native-dialog dismissal, official V2 Paystack bridge, duplicate/late callback gate, submitted-detail lock, pending recovery/reference preservation, initialization uncertainty and production simulation rejection are inherited without source edits to the checkout components or hook.
- Existing reseller public tracking shares the existing 30/minute per-IP public-write limiter. General tracking formerly had no dedicated limiter; it now allows 60/minute per IP, suitable for the existing three-second modal polling. General reference validation accepts existing alphanumeric/underscore/hyphen formats up to 128 characters. Reseller format remains unchanged. Limits are process-local; no new infrastructure was added.
- Order/payment/account paths and reseller/Admin routers set `Cache-Control: no-store` before auth/rate-limit handling, including relevant failures. Existing server/provider refresh throttling is unchanged.
- Public lookup/verify/cancel and account-history exception logs omit arbitrary caught payloads. Unverified payment messages no longer echo provider errors. Supplier/payment business logging elsewhere was not rewritten; live/provider-wide log privacy is outside this response-projection patch.
- No migration, balance, ledger, reserve, wholesale, earnings, rewards, payout, supplier or payment-success implementation changed. Read-only public tracking does not alter stored snapshots or financial values; synthetic tests assert unchanged records.

## Verification

Final focused command: `npm test --` with `publicOrderPrivacy`, `resellerCheckoutLifecycle`, `websiteBusinessV1`, `resellerReserveDiagnostics`, `resellerBranding`, `resellerContrast`, `productionIntegrity`, `financeV1`, `financeApi`, `orderStatusSync`, `websiteRepairV1`, `dataCheckoutRescue`, `mtnDuplicateProtection`, `checkoutPerformanceAndStatus`, `marketplaceFlexibility`, `adminV1`, and `afaRegistration` test files.

- **Focused: 630 passed / 630, zero failed/skipped/cancelled.** Includes the entire preceding checkout release's focused set.
- **New privacy file: 75 passing cases.** Real Express routers, actual memory stores/session checks, synthetic local/international/formatted phones, contact/address/nested fixture data, public HTTP JSON scans, authorization, caching and safe error logging. External fetch is blocked; supplier refresh/payment verification are explicit isolated seams. Existing checkout/payment tests separately verify underlying lifecycle behavior.
- **One full isolated regression: 1,397 total; 1,390 passed, six failed, one skipped, zero cancelled.** Exact difference from checkout base's recorded full run (1,322 total; 1,315 passed, six failed, one skipped): 75 additional passes, no new failure or skip.
- **Unchanged exact base `6535c43`: 168 targeted cases; 162 passed, the same six failed, zero skipped.** Failure names and reasons match the final full run: one stale bundle-card Direct SIM copy expectation; one stale member-home Earn Coming Soon expectation; two stale mobile Earn/membership expectations; Website Builder sample-name expectation (`QuickByte Data` vs `Ghana Data Express`); Windows CRLF-sensitive additive SQL mirror assertion in Website Free V1. None was changed to hide a new failure.
- The one full-suite skip is optional disposable-PostgreSQL finance-kind migration coverage when no isolated database is configured. This task performs no migrations and did not connect to PostgreSQL.
- **`npm run lint` (`tsc --noEmit`): passed.**
- **`npm run build`: passed.** Existing non-blocking Vite native-loader/`__dirname` and chunk-size warnings retained.
- **`git diff --check`: passed.** Final diff reviewed; no generated files, screenshots, local logs, secrets, environment files or dependencies in the patch.

Chrome used compiled actual production tracking components, synthetic account context and synthetic API responses; every external request was blocked. **55 general tracking service/status combinations** (five services times eleven actual statuses), **11 reseller status cases**, manual review, loading/disabled submission, empty history, unknown reference errors, a 62-character reference, and readable last-four masking passed. General modal and reseller tracking were checked at **320, 360, 390, 430, 768, 1024 and 1280px**. Automated overflow checks and captured screenshots were inspected. No JS errors or unexpected mutations. No visual claims are made about a live customer site, real authentication session or official Paystack iframe. Existing screenshot/harness evidence remains outside Git in `privacy-tracking-evidence`.

## Files in this privacy patch

1. `server/types/orders.ts` — public/customer/Admin projections and shared last-four masking.
2. `server/routes/api.ts` — own-history projection, public reference validation/rate limit, cache headers and safe response/log messages.
3. `server/routes/websiteBusinessApi.ts` — early no-store handling.
4. `server/routes/adminApi.ts` — early no-store handling.
5. `server/services/websiteBusinessService.ts` — seller projection reuses the same recipient masker only.
6. `src/services/apiClient.ts` — explicit account-history response type.
7. `server/suppliers/__tests__/publicOrderPrivacy.test.ts` — router/presentation regression coverage.
8. `docs/public-order-tracking-privacy-v1.md` — this report.

## Release gates and limitations

The privacy branch is based directly on the checkout release. If remote checks remain unchanged at publication, the integration branch is created at the same new privacy commit, retaining source branches and excluding Customer Experience Release and Earn V2. No feature merge into main or deployment is performed.

The public contract intentionally still reveals non-private tracking facts (reference, last four digits, package, price, status and timestamps). A tracking reference remains a public tracking identifier. Existing reference-only cancellation/payment-verification semantics are unchanged; authorization redesign of those actions is not part of this patch. Public tracking will not return full delivery instructions just to preserve anonymous convenience.

No live payments, supplier orders, production database calls, Render actions or configuration changes were performed. Only synthetic in-memory financial effects were exercised by existing isolated regression tests. Production remains exposed until a separately approved safe release occurs; branch publication alone does not fix the deployed API.

**Official Paystack release gate remains open and blocks production checkout release.** A configured isolated official TEST merchant/frontend/backend environment is required. Operator must verify TEST public/secret keys correspond, approved callback origin and webhook signature configuration are correct, checkout catalogue/reserve/wholesale settings are reviewed, and testing cannot hit live supplier submission or production storage. Do not substitute live keys or a live payment to satisfy this gate. Configuration readiness was not asserted or changed during this task.

Separate controlled TEST checks should demonstrate the actual official iframe/popup is usable after native dialog dismissal; cancel/reopen and payment completion behave correctly; exact server amount/currency/purpose validation works; duplicate/late callbacks and signed webhooks cannot duplicate credits/dispatch; saved references remain recoverable on timeout/reload; supplier ambiguity stays protected. Those require an isolated setup and separate approval, not fabricated evidence from the synthetic harness.

Recommended next action: founder review of this candidate, then isolated official Paystack verification and deployment-readiness checks before any explicitly approved production merge. There are no new privacy-patch test failures; inherited baseline failures and optional PostgreSQL skip are recorded above.

Rollback guidance: do not revert to the leaking serializer merely to restore full anonymous details. If a release is later found incompatible, restrict/disable public lookup at the operator boundary while preparing an approved corrective commit that retains the privacy allowlist. Use normal forward commits/reverts only after review; do not rewrite these published branches or mutate order data. No rollback/deployment action was performed here.
