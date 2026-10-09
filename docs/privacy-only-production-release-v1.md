# Privacy-only production release V1 — founder report

Release decision: **push the verified hotfix; do not merge main.** Mandatory deployment-knowledge gate G is unverified. Gate I has service-health evidence but incomplete deployment/configuration readiness. This decision follows the conditional authorization in the supplied release specification; it is not a new permission requirement.

## A. Git integrity and extraction

- Starting and final unchanged `origin/main`: `5233879079413b6422f829631676b16c3ea81597`.
- Privacy source: `9e25bd41a820b16e2074a5b074058435cb9008f3`.
- Source direct parent / excluded checkout release: `6535c43d4d47033ca8192ab4b173d288d2200602`.
- Other excluded checkout commit: `b0e85b33fd804cc654cdc2d38fe13e2d7ed027cf`.
- New isolated branch: `fix/privacy-only-production-v1`, based on freshly fetched production main. The new commit and exact verified remote SHA are reported in the accompanying Git checkpoint response.
- No equivalent privacy patch was already present: the current-main serializer still returned raw recipient and private delivery/pickup/variant fields.
- Extraction: `git cherry-pick --no-commit` of only the source privacy commit. No source-branch merge or parent history imported. No conflicts and no production-code adaptation required: the seven code/test paths in the source parent were identical to current main. Extracted code/test contents were then compared directly with the source commit and matched exactly.
- The source's checkout-based report was replaced by this main-based report, rather than carrying obsolete checkout-integration claims into the new hotfix. This documentation path is expressly requested by the new specification; no extra production code path was added.
- All existing nine worktrees were clean before extraction and are preserved. The new worktree is separate. No branch switch, cleanup, reset, rebase, amend, deletion or force-push on existing work.
- Final candidate has one new commit directly above main. Neither checkout commit, Customer Experience Release `77887d3a5a6261b225ead164a33b2321926275bc`, nor Earn V2 `f731b52341bbecaef7d4ec0fb560e9b28e6f4c45` may be an ancestor of that candidate.
- GitHub repository metadata reports pull/push/Admin permissions. The connector's separate collaborator-permission endpoint returned an integration-access 403, not a repository write denial. Feature push success and remote verification are checked independently.

Exact eight changed paths:

1. `server/types/orders.ts` — public/customer/Admin projections and shared last-four mask.
2. `server/routes/api.ts` — response selection, ownership filter, no-store, public lookup validation/rate limit, generic errors/logging.
3. `server/routes/websiteBusinessApi.ts` — early no-store handling.
4. `server/routes/adminApi.ts` — early no-store handling.
5. `server/services/websiteBusinessService.ts` — existing masked owner projection reuses the same recipient masker only.
6. `src/services/apiClient.ts` — explicit richer account-history response type only.
7. `server/suppliers/__tests__/publicOrderPrivacy.test.ts` — unchanged extracted 75-case suite.
8. `docs/privacy-only-production-release-v1.md` — this report.

## B. Privacy boundary

Audited public reference-based responses:

- GET `/api/orders/lookup/:reference`: `{success, order}` through `toSafePublicOrder`, existing supplier refresh preserved.
- GET `/api/websites/:id/store-orders/:reference`: `{success, data}` through `Business.publicOrder` and the same projection. Site/order relationship checked before provider access; invalid/unknown/wrong-store references are non-disclosing 404s.
- GET `/api/payments/verify/:reference`: `{verified, order, message}` with safe public projection on every branch. Unconfirmed response no longer echoes arbitrary provider error payloads.
- POST `/api/payments/cancel`: `{success, cancelled, alreadyPaid, order}` with safe public projection. Cancellation and already-paid semantics are unchanged.

Those endpoints formerly returned the full recipient in JSON even when UI text was masked. A reference does not establish ownership. Supplying a valid, invalid or expired bearer header to public lookup never grants richer access.

Public allowlist:

- `public_reference`, masked `recipient_phone`, `network`, `service_type`;
- contact-redacted `product_name_snapshot` and `bundle_size_snapshot`;
- `amount`, `amount_ghc`, `currency`;
- `status`, `manual_review`, `created_at`, `paid_at`, `delivered_at`;
- optional customer-facing `face_value_ghc`, `service_fee_ghc`;
- `fulfilment_method`, `marketplace_status`;
- optional `commercial_pricing` containing only regular/discount/paid customer amounts, preserving the existing savings presentation.

`maskOrderRecipient` emits only `******` plus the last four digits for valid-length local/international/formatted recipients. Short/corrupt values reveal no full short number. Stored recipient values remain unchanged; no normalized/raw companion field is returned. Client helpers preserve the existing masked string without double masking or reconstructing digits.

Publicly excluded: full recipient/customer phone, email/name, customer identity, all delivery city/area/landmark/note and pickup snapshots, variant/product-slug snapshots, internal order/user/payment/supplier identifiers, provider payloads, admin notes, referral ownership, checkout access fields, nested Marketplace/store/commercial context, wholesale/reserve/earnings information. Public product/package summaries redact complete phone-like/email strings and exact known private customer/address values if legacy summaries contain them. No raw `OrderRecord` spread occurs. Future raw fields are not automatically exposed.

Authenticated customer routes GET `/api/account/orders` and GET `/api/orders/my-orders` retain real session checks and `user_id` ownership. Their new richer projection restores only legitimate own-order recipient, catalogue/variant and delivery/pickup details. A second boundary filter removes mismatched rows before serialization. Customer contact identity and supplier/economic internals remain absent. Matching guest email or phone, guessed reference, wrong account, invalid/expired/missing session do not confer private ownership. Empty history stays functional.

Admin order list/detail/refresh/review/status and nested customer orders use `toAdminOrderDetails` behind existing Admin RBAC. Full operational recipient, delivery, contacts, supplier/payment data and notes are retained. AFA retains existing masked operational registration detail. No authorization policy changes.

Reseller owner's business route verifies site ownership and retains masked recipient plus own-store sales/earnings. Cross-owner access is denied. Admin business access remains authorized. Seller earnings and payout permissions are unchanged.

Cache/rate handling: `no-store` precedes relevant auth/rate/error handling on order/payment/account paths and reseller/Admin routers. Existing reseller 30/minute public-write limit is preserved. General public tracking now uses 60/minute per IP, compatible with its three-second polling (20/minute per single modal). Existing supplier refresh throttle is unchanged. General reference validation allows existing alphanumeric/underscore/hyphen formats up to 128 characters; reseller validation remains unchanged. Limits are per process, not a distributed anti-enumeration service.

Public lookup/payment/account exception handlers no longer dump arbitrary caught payloads; unverified payment messages are generic. Existing supplier/business logs elsewhere were not rewritten. Remaining public facts intentionally include the reference, last four digits, product, total, status and timestamps. Contact redaction is not a classifier for arbitrary PII prose; catalogue content should never contain customer information. Reference-only payment/cancel action authorization remains the existing main policy. No new guest identity-verification system was invented.

## C. Compatibility and financial isolation

- Data, Airtime, Instant Bundle, Marketplace, AFA and managed reseller tracking retain product/network/amount/reference/status semantics.
- All eleven implemented statuses remain unchanged: pending_payment, paid, queued, submitted, processing, delivered, failed, refund_pending, refunded, cancelled, expired. Manual-review flag remains visible.
- Marketplace delivery/variant/pickup details remain stored and available through authorized paths; public tracking retains product, fulfilment mode and Marketplace status. Anonymous convenience does not restore private address exposure.
- Current-main `OrderStatusModal`, `OrdersPage`, AFA confirmation, Member Home and `ManagedDataStorefront` already accept masked `recipient_phone`. No display/style changes are needed. The API client change is a TypeScript account-history contract change, not a newer customer-experience UI import.
- Verification and cancellation responses preserve server authority; totals, order state, payment verification, signed webhook checks, supplier polling/dispatch and financial recovery are unchanged.
- Exact diff comparison proves these excluded paths match main: ManagedDataStorefront, usePaystack, storeCheckoutAttempt, resellerCheckoutLifecycle tests, resellerReserveDiagnostics tests, systemwideProductPolish tests, fulfilmentService, paystackService, paymentValidation, server/db, shared, server.ts and render.yaml. Absent checkout helper/test files remain absent.
- Full meaningful-hunk review confirms no payment initialization/success/refund/payout/reconciliation, ledger, pricing, Wallet/reward/reserve/wholesale, migration, environment or deployment logic change. No generated assets, logs, screenshots, secrets or new dependencies are committed.
- No production database access, live order, payment, supplier request or financial mutation. Existing isolated regression tests exercise synthetic memory/mocked data only. The runner sets NODE_ENV=test and removes inherited DATABASE_URL and database opt-in; no application server was started against configured production settings.

## D. Verification evidence

- Focused privacy/HTTP, history/auth, Admin/owner, Marketplace, Paystack response, supplier/Airtime/Instant Bundle and production-integrity regressions: **553/553 passed**, zero failed/skipped/cancelled. Includes the unchanged **75-case privacy suite**. External fetch is blocked in that suite; real Express routers, memory stores and actual session/ownership checks are used, with explicit provider-refresh/payment verification seams.
- One full isolated candidate run: **1,370 total; 1,363 passed, six failed, one skipped, zero cancelled**.
- Independent unchanged exact-main reproduction at `5233879`: **168 targeted cases; 162 passed, the same six failed, zero skipped**. Matching failures are stale bundle-card Direct SIM copy; member-home Earn Coming Soon; two mobile Earn/membership expectations; Website Builder sample-name expectation (QuickByte Data versus Ghana Data Express); Windows CRLF-sensitive additive SQL mirror assertion. No failing test was deleted/suppressed/weakened. This is failure-set reproduction, not a second full main run.
- The one skip is optional disposable-PostgreSQL finance-kind migration coverage when no isolated PG instance is configured. No migration is introduced by this hotfix.
- `npm run lint` / `tsc --noEmit`: **passed**.
- `npm run build`: **passed**, with only inherited non-blocking Vite native-loader/__dirname and chunk-size warnings.
- `git diff --check`: **passed**; final staged/committed diff checked again at publication.
- Isolated Chrome exercised actual current-main tracking components with synthetic masked API fixtures and synthetic account context: **55 general service/status combinations and 11 reseller statuses passed**, along with loading/disabled submit, empty/unknown order and manual-review states. A 62-character reference and masked recipient remained usable at **320, 360, 390, 430, 768, 1024 and 1280px**, with no horizontal overflow or browser errors. No external service calls or live credentials were used. Screenshots at 390px and 1280px were inspected for both general and reseller tracking; recipient, reference, amount and review message remain readable. This is isolated compatibility verification, not live authentication or official Paystack SDK verification. Browser evidence remains outside Git in `privacy-only-production-evidence`.

## E. Deployment knowledge and release gates

Read-only findings on 9 October 2026 UTC:

- Tracked `render.yaml` defines a static `mystery-hub` frontend: `npm run build`, `dist`, SPA rewrite to index.html. It does not describe the actual API service, deployed revision or dashboard auto-deploy setting.
- Current source supports a separate Express API (`npm start` invokes `tsx server.ts`) with `/health` and `/api/health`. The unchanged server starts database/schema initialization and scheduled reconciliation; it was not started against production during this task.
- The actual public frontend at `https://mysterybundlehub.com/` returned HTTP 200. Its observed script `/assets/index-DeQ0wo0c.js` contains `https://mysteryhub-api.onrender.com` as the backend host. No secrets were requested or printed.
- Frontend-domain `/health` and `/api/health` returned HTML SPA responses, not API-health evidence.
- Both actual backend health routes returned HTTP 200 JSON `{status:ok, service:mysteryhub-api}`. This proves reachability, not a deployed Git revision, database health, payment configuration or privacy protection.
- GitHub main combined status returned no status entries. Available connected tools provide no authenticated Render service/configuration connector. The Render dashboard read-only attempt reached `/login`; no credentials were entered and no dashboard settings changed.
- Therefore actual frontend/backend tracked branch, auto-deploy trigger, build/start commands, deployed commit, required environment readiness and deploy monitoring status cannot be confirmed. A static YAML and healthy endpoint are insufficient substitutes.

Mandatory gate decisions:

- **A — Git integrity: PASS.** Fresh main base, narrow exact extraction, excluded history/files, concurrent-ref checks before publication.
- **B — Privacy: PASS.** Actual HTTP tests establish public allowlist/masking/address protection.
- **C — Authorization: PASS.** Own-account ownership, Admin RBAC and reseller boundaries tested.
- **D — API compatibility: PASS in isolated current-main testing.** Masked strings remain usable; no frontend behavior/import dependency on checkout release.
- **E — Financial isolation: PASS.** Payment/supplier/accounting/schema behavior unchanged by source and test review.
- **F — Tests: PASS.** Focused tests, TypeScript/build/diff pass; full run has no new failures compared with independently reproduced exact-main failure set.
- **G — Deployment knowledge: UNVERIFIED / BLOCKS MERGE.** Render session/configuration and actual deployment consequences cannot be inspected from the available authenticated surfaces.
- **H — Rollback preparedness: PASS.** Exact previous main recorded; non-destructive revert procedure below.
- **I — Operational readiness: PARTIAL / UNVERIFIED.** Public frontend and API health are observed, isolated ordinary tracking/payment regressions pass; actual required deployment/configuration readiness remains inaccessible. No live financial/auth test was invented.
- **J — Release scope: PASS.** Privacy-only correction is independently useful and has no dependency on unverified checkout changes. Official SDK verification is not a blocker for this separate privacy-only diff.

Release outcome: no automatic main merge, no main push and no manual deployment. Whether feature-branch publication triggers any configured deployment automation cannot be established without the actual service settings. No new deployed revision or production privacy correction is claimed. No approved synthetic live order fixture was available; real customer references were not queried. Production PII-specific verification remains unperformed.

The original checkout/privacy source branches, Customer Experience Release and Earn V2 remain preserved. The pending reseller checkout release still awaits isolated official Paystack SDK verification before its own production release; that work is not imported here.

Rollback plan if a later authorized release regresses: record the actual hotfix commit/merge SHA and subsequent remote main first. For a single hotfix commit, use a reviewed normal `git revert <hotfix-sha>`; for a normal merge commit, use a reviewed `git revert -m 1 <merge-sha>`. Build/test the revert and push normally, retaining later unrelated commits. Do not reset/force-push main or mutate orders. Reverting this privacy fix would restore disclosure, so assess and contain public lookup exposure before any rollback. Deployment rollback is an alternative only if the actual platform supports it and the operator authorizes it. No revert or rollback was performed.

Recommended next action: operator provides read-only access/evidence for the actual frontend/backend Render services (tracked branch, auto-deploy, build/start, current revision and health/readiness). Re-fetch main and recheck the exact narrow diff before applying the already-reviewed conditional release authorization. Confirm backend deployment to the final candidate separately; a frontend-only build cannot release the server serializer fix. Production verification must distinguish local tests, Git push, deployed revision and safe synthetic HTTP privacy evidence.
