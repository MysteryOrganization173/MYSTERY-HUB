# Admin Operations Recovery V1

Review branch: fix/admin-paid-order-resolution-v1.
Verified unchanged base: d2d27a61db771bb3a66bf1e512b95c89cc82bd20.
Status: ready for founder release review; not merged, deployed, or activated in production.

## Root cause

Forced supplier refresh skipped failed/refund_pending Data orders; identical responses did not record a new check time. Supplier refund statuses lacked explicit mapping. Review flags and notes offered no durable customer remedy, and a generic paid-order status change could claim refunded without refund proof. Historical paid failures could be hidden by review/test flags. Supplier balance refunds and customer refunds are separate events.

## Workflow and safety

Admin Orders retains the existing drawer, search, notes and review controls. Its order-linked customer-resolution section records the original payment, supplier response/check time, customer remedy, last operator and append-only history.

Supported actions are begin review, record supplier evidence, verify an externally initiated Paystack refund, and refund an original Wallet purchase. Each requires authenticated admin RBAC, explicit confirmation, operational reason, request ID and current order/resolution revision. Amounts come from immutable order/payment facts. Stale or conflicting actions are rejected. Repeating the identical request ID and input returns the recorded result. Changing its actor or payload is rejected.

Paystack: the application does not create refunds. An authorized operator uses the verified Paystack dashboard after checking the original payment and any existing refund. The server performs authenticated read-only GET /refund/:id and a dedicated refund transaction read. Exact original transaction ID/reference, full amount, GHS, refund ID and both live domains must match. Pending/processing is not completion. Only processed with a valid refunded_at and original transaction status reversed (or success during state propagation) closes the case. Timeout or malformed/mismatched evidence cannot close it. One provider refund ID is uniquely bound to one order. No payment secrets/raw customer provider response are stored in resolution history. Closure means Paystack processed the refund; it does not prove funds are already visible in the customer's bank or MoMo account.

The reviewed V1 commit incorrectly used ordinary payment verification, which requires success and rejected genuine reversed transactions after a processed refund. fetchRefundTransaction now validates identity without granting payment-success eligibility. Ordinary verifyTransaction remains unchanged and still rejects reversed payments for supplier dispatch, purchase confirmation and Wallet funding. Official lifecycle: https://paystack.com/docs/payments/refunds/#refund-status; API: https://paystack.com/docs/api/refund/.

Wallet: only the original Wallet-paid purchase, its owning account and its matching actual debit qualify. Confirmed supplier failure evidence is required. The existing full original-purchase refund uses one idempotent refund operation. The account/ledger, locked order, resolution event and admin audits commit together. Missing or mismatched debit/credit fails closed. Repeated requests cannot credit twice. PostgreSQL account locking precedes order locking.

Paystack-to-Wallet compensation is disabled, including guest orders. Generic Wallet adjustments are not an order resolution. Partial refunds, off-provider transfers, replacing an already linked refund ID and creating/retrying Paystack refunds are outside V1. Failed/needs-attention provider refunds remain unresolved for dashboard reconciliation. Do not manufacture a confirmed resolution for unsupported evidence.

Supplier refresh performs GET/status lookup only, never resubmission. Explicit admin reconciliation can operate with dispatch disabled when the supplier client is configured. Missing IDs require documented manual evidence. Known late success can recover failed/refund_pending fulfillment only before a customer refund has been linked. Unknown responses cannot resurrect delivery. Pending/confirmed customer refunds block conflicting late supplier recovery. AFA retains its own durable submission and duplicate-registration protections.

Refund completion invokes the existing terminal commercial/referral/store reconciliation after commit. The money/order/history transaction does not depend on a provider network call. Downstream failures retain the durable terminal order for existing reconciliation rather than manufacturing a second refund.

## Customer privacy and metrics

Public/customer APIs expose only review, refund_pending or refund_confirmed, alongside the existing safe order DTO. They do not expose operational notes, history, operator IDs, supplier evidence or provider refund IDs. Public tracking retains phone masking and existing support links.

A legacy global refunded status without order-linked verified customer evidence displays refund unverified/review. An original Wallet refund already present in the ledger can be reconciled idempotently once its original debit, credit and supplier evidence are checked; it is not credited again.

Needs attention today means qualifying attention cases created today, using the existing server GMT date boundary. The navigation opens Needs Attention across all dates. Paid unresolved count includes paid failed/refund_pending/cancelled/expired/refunded cases without a resolved customer record. Removing a flag, including a prelaunch-looking reason, cannot hide such paid cases. The historical manual-review queue remains the broader attention queue, not merely a count of manual_review=true.

## Additive migration and release prechecks

Repeatable initialization adds nullable orders.resolution_json, a unique partial provider-refund-ID index, and order_resolution_events with unique order/request identity and a history index. schema.sql mirrors orderResolutionSchema.ts. Existing financial records are not backfilled, relabeled or deleted. History enables RLS and revokes PUBLIC/anon/authenticated access; it uses the existing authorized backend database connection.

Before founder-authorized deployment:
1. Review the diff and preserve a database backup/snapshot.
2. Validate initialization and simultaneous separate-connection refund attempts on disposable/staging PostgreSQL with production-equivalent permissions. Confirm the backend role can access private history.
3. Confirm the existing live PAYSTACK_SECRET_KEY and supplier read-only status configuration are available; no new environment variable is required. Do not expose keys.
4. Confirm the operator's refund authority/policy and Paystack Dashboard access.
5. After an authorized release, verify repeatable initialization/startup, admin authorization, safe customer DTOs, and read-only status lookup before handling customer money.

No production migration was executed in this task. Rollback must preserve additive columns/table, history and all financial records; do not drop or restore over customer money. If application rollback is needed, suspend use of refund controls and reconcile existing history/ledger before re-enabling operations. The old generic refunded action is not an acceptable refund procedure.

## Verification evidence

Recovery/provider/database/lifecycle tests: 96/96 pass, including 30 new lifecycle tests using raw synthetic Paystack HTTP responses through the actual adapters and resolution service.
Final affected refund + Wallet + payment integrity + customer journey checks: 261/261.
Final full isolated suite: 1613 tests; 1609 passed, 3 inherited failures, 1 skipped.
Unchanged same-SHA baseline: 1517 tests; 1513 passed, 3 failures, 1 skipped.
Difference: 96 additional passing tests over main (30 additional passing tests over reviewed V1), no additional failures/skips.

Raw HTTP coverage includes processed/reversed, pending/reversal_pending, failed/success, partial/wrong amounts, wrong currency, transaction ID/reference mismatches, test domains, missing completion, timeout/malformed evidence, duplicate ID binding/idempotency and reversed transactions rejected by ordinary payment verification. Existing Wallet transaction, rollback, audit, locking and idempotency protections are preserved.

Inherited failures remain untouched:
- bundleCardCompression: obsolete direct-SIM delivery-copy expectation.
- websiteBuilderV1: obsolete QuickByte template assertion causing file failure.
- websiteFreeV1: raw schema-source containment assertion (Windows line endings).

Two existing tests were deliberately updated for the new truthful refund contract: customer refunded presentation requires confirmed customer proof; generic admin refund of an uncertain AFA submission must return 409 while retaining encrypted evidence and blocking repurchase. Neither financial/AFA safety expectation was weakened.

TypeScript, production build and diff check passed. Build retains the existing non-blocking Vite large-chunk warning.

The database test used disposable embedded PostgreSQL (PGlite, real PostgreSQL execution), executing the complete SQL schema and repeated additive migration. It verified RLS, denied SELECT/INSERT/UPDATE/DELETE privileges for anon and authenticated, an actual permission-denied read under anon, backend SELECT/INSERT privileges, post-write rollback of Wallet/ledger/order/history/audits, exactly one original Wallet credit, unique provider ID binding and immutable payment facts. It did not contact an external database. A standalone PostgreSQL server/container runtime is unavailable locally; separate-connection/cross-process concurrency and actual deployment-role permissions remain mandatory staging release gates. Memory concurrent requests and actual embedded PostgreSQL transaction/constraint rollback were exercised. The optional database test skips when MYSTERY_TEST_PGLITE_PATH is absent; it ran and passed in this task. This correction adds no schema changes.

Previously recorded V1 compiled synthetic browser checks at 1280px and 390px covered Overview navigation, unresolved queue, failed drawer, explicit confirmation, disabled submit, checking/loading, unavailable verification, pending/processed refund, original Wallet refund, missing-ID manual review, resolved history and customer tracking. Mobile body/root width was 390px, dialog width 364px, with no horizontal overflow. Mobile console had no errors. The correction changes only refund verification and explanatory text; it was verified with raw HTTP, presentation regression tests and the production build, without repeating those browser journeys. Test infrastructure/providers/screenshots/logs live outside Git; no new application dependency.

## Production incidents: operator procedure after release

Read-only checks confirmed both MH-20261013-865159 and MH-20261010-458066 remain Paystack-paid GH₵5.49, refund_pending, manual_review=false, with their original updated/check timestamps unchanged. They were not processed.

For each separately:
1. Search its exact MH reference in Admin Orders and confirm the original paid amount/method/reference.
2. Refresh the existing supplier identifier using status GET only. If unavailable or ambiguous, preserve the actual response and document authoritative manual evidence. Never retry supplier POST.
3. Distinguish supplier-wallet reimbursement from money returned to the customer.
4. Begin customer refund review and record the evidence source.
5. The authorized operator checks the original transaction and existing refunds/disputes in Paystack. If a customer refund is owed and authorized, initiate it once through that verified dashboard. This task does not authorize automated live processing.
6. Enter its provider refund ID in Verify External Paystack Refund. Pending means keep the case open and verify that same ID later. Only the exact full processed refund closes the case.
7. Mismatch, partial amount, timeout, missing evidence or a conflicting remedy remains unresolved for manual investigation. Do not use generic Wallet adjustment or a decorative status change.

No main merge, deployment, production financial write, supplier POST, live payment/refund or configuration change occurred. Unreleased Builder/payment/reseller branches and unrelated worktrees were preserved.

Release decision: GO for founder review of this correction; NO-GO for production activation until the standalone PostgreSQL concurrency/actual-role prechecks above are completed and the founder approves deployment. No live Paystack or supplier verification/refund operation was performed for this correction; the two incident orders were not accessed or modified.

## Reviewed file inventory (32 files across V1 and correction)

- docs/admin-paid-order-resolution-v1.md
- server/db/adminAuditStore.ts
- server/db/connection.ts
- server/db/orderResolutionSchema.ts
- server/db/orderResolutionStore.ts
- server/db/ordersStore.ts
- server/db/schema.sql
- server/routes/adminApi.ts
- server/services/financeService.ts
- server/services/fulfilmentService.ts
- server/services/orderResolutionService.ts
- server/services/paystackService.ts
- server/suppliers/__tests__/adminOrderResolution.test.ts
- server/suppliers/__tests__/adminOrderResolutionPostgres.test.ts
- server/suppliers/__tests__/adminRefundProvider.test.ts
- server/suppliers/__tests__/adminRefundLifecycle.test.ts
- server/suppliers/__tests__/afaRegistration.test.ts
- server/suppliers/__tests__/dataPurchaseJourney.test.ts
- server/suppliers/successBizHub/provider.ts
- server/types/orderResolution.ts
- server/types/orders.ts
- src/components/admin/AdminPage.tsx
- src/components/admin/sections/AdminOrderResolution.tsx
- src/components/admin/sections/AdminOrdersSection.tsx
- src/components/admin/sections/AdminOverviewSection.tsx
- src/components/checkout/OrderStatusModal.tsx
- src/components/orders/OrdersPage.tsx
- src/context/AppContext.tsx
- src/services/apiClient.ts
- src/types/index.ts
- src/utils/dataPurchasePresentation.ts
- src/utils/memberHomePresentation.ts
