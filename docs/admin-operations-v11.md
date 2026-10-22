# Admin Operations V1.1 handoff

Initial main: `56ce783be7ddd4004a7f8513ea05a8c4695142fc`.
Branch: `codex/admin-operations-v11`.
Recommendation: **READY FOR RELEASE**, subject to founder review and normal CI. No merge or deployment is authorized by this implementation task.

## Confirmed findings and corrections

- The existing default Orders search excluded cancelled/expired orders, including an exact reference supplied by a customer. `adminOrderSearchParams` now searches all existing states when the default lens has a query. Explicit service, network, review, date and situation filters still apply. An inline explanation and Reset view make that distinction visible. No public search endpoint was added.
- Detail loading only compared the reference, so a late response for the same order could replace newer information. List projections also overwrote full detail records. Separate request channels now invalidate older responses after a newer read, close/reopen, mutation, unmount or session change. A passive detail refresh re-reads the full order and refreshes the list/badges when the recorded update changes. A list projection never replaces full detail state.
- Direct order links now use one detail request rather than fetching twice. They initialise an existing internal note correctly, retain typed edits during refresh, and expose loading, cancellation and retry states.
- Refresh failures previously replaced useful records with an error-only screen. Orders, Overview, recent orders and System Health retain last-loaded information with explicit stale/error notices. Failed full-detail refreshes pause actions until the record is re-read successfully. Freshness timestamps advance only on successful reads.
- Overview showed queue totals and broad alerts, but no order evidence. The new passive sample shows up to five newest orders from the existing `needs_attention` filter, with reference, product/service/network, payment status, supplier identifier or uncertainty, reason, safe next step and age of the recorded order update. It links directly to the existing order drawer and full queue. It does not claim the timestamp is the failure time or invent a new attention threshold.
- The uncertainty timeline incorrectly said “Not delivered.” It now says “Delivery not confirmed” and “Supplier reconciliation.” A legacy processing state with no supplier identifier no longer asserts supplier acceptance. The frontend also honours the server's exclusion of unpaid pre-launch fixtures.
- Orders search, filters, page and filter-panel state survive navigation away and back within the same staff session. These values remain in bounded component memory, never browser storage, and are discarded on session change. Active filters remain visible; shrinking result sets return to a valid page.
- Parent order actions share a synchronous duplicate-submit guard, disable the action area while pending and preserve clear server errors. Existing Marketplace fulfilment changes require explicit acknowledgement of the exact reference and consequences; cancellation does not claim to refund. No new financial action was added.
- Browser testing reproduced a nested Admin confirmation's Escape event also closing its parent. `AdminSheet` now handles only its own cancel event. Cancelling a confirmation leaves the order open and page locked; closing the order releases the lock.

## Existing sound architecture retained

Server RBAC, private no-store responses, passive `readOnly=true` list/overview calls, payment/fulfilment separation, supplier identifiers, audit trails, customer resolution, guarded paid-order recovery, Ultra Inbox, System Health's configuration-versus-payment distinctions and responsive navigation already exist. They were reused. Ordinary processing and unpaid attempts are not automatically incidents; unresolved paid failures, genuine uncertainty, open refunds and explicit review flags follow the existing server queue rules.

There are no changes to API contracts, database schema, Paystack verification, durable supplier submission, Wallet/ledger handling, prices, rewards/referrals, Store Earnings, website publishing, authentication or server authorization. Clearing a flag is still not a customer remedy. Uncertain supplier acceptance without an identifier still requires support reconciliation, not a retry button. No new polling was introduced.

## Completed journeys

1. **Customer reference:** reproduced `MH-CANCELLED` returning no result on unchanged main, then found it via the default search in the candidate, opened authoritative details, copied the reference and returned to the retained search. Search remains private and staff-authorized.
2. **Delayed/uncertain order:** Overview sample → direct order → recorded payment and supplier facts → accurate uncertainty explanation → existing eligibility/reconciliation workflow. No supplier identifier means no “Check supplier now” button for ordinary Data and no blind resend. Normal processing is not labelled failed.
3. **Daily operations:** Overview retains the existing truthful Ghana-day metrics and full reporting basis; links to attention/full Orders. Page two and filters survive leaving for Overview and returning. Changed detail state reappears in the list and invalidates navigation metrics through the existing refresh callback.

## Verification

- Unchanged-main full baseline: **2,453 total; 2,421 passed; 2 failed; 30 skipped; 0 cancelled**.
- Final full isolated regression: **2,469 total; 2,437 passed; 2 failed; 30 skipped; 0 cancelled**. All 16 added regression tests passed. No new failures or skips.
- Focused Admin/auth/recovery/payment/fulfilment/finance/test-isolation selection: **467 total; 451 passed; 0 failed; 16 optional database skips; 0 cancelled**. Counts overlap the full run.
- The two unchanged-main failures are `V5.2 Signal is bundle-first and keeps the payment contract` and `V5.2 gallery: one tile per industry in the strip; compact phone cards`. They are existing LF-only source assertions against this Windows CRLF checkout. Their files and the relevant Builder implementation are unchanged by this PR. Tests were not weakened.
- `npx tsc --noEmit`: passed. `npm run build`: passed. `git diff --check`: passed. Existing Vite native-loader/chunk-size warnings remain non-blocking.
- New HTTP tests cover private search/detail/overview authorization, no customer enumeration, cancelled/expired reference lookup, filters and pagination, attention-list/overview/presentation agreement, passive refresh, and uncertainty. Deferred-response tests cover list/detail/overview/queue/clipboard ordering, same-order reopen, mutation invalidation, session change and unmount.
- Actual compiled baseline and candidate were served on loopback with synthetic records and real memory-backed application APIs. All provider outbound requests and financial/authentication/supplier writes were blocked. One synthetic internal-note write was allowed: a rapid double-click produced exactly one PATCH; the entire action fieldset, Done and Close were disabled while it completed. No payment/refund/recovery/fulfilment confirmation was submitted.
- Overview, Orders and order detail were inspected at **360, 390, 430, 768 and 1280px**, with actual viewport dimensions recorded. No horizontal overflow was found. Native dialogs kept the root scroll lock and accessible controls; nested cancellation left the parent intact, and final close released the lock. System Health was also checked at 390px.
- Browser checks included direct-link note retention, copy, pagination/context restoration, failed list/detail/overview refreshes, late detail response after closing, current delivery refresh and list synchronization, and confirmation cancellation. Deliberate synthetic 503 responses were expected fault-injection evidence, not production errors.

## Security and release considerations

Application changes are confined to Admin presentation, request ordering and two small UI helpers. Server operational/financial implementations remain byte-for-byte unchanged. Existing RBAC and finance/supplier integrity suites pass. The attention sample contains private order facts but no raw supplier payload or customer contact fields; the existing protected detail view remains the place for authorized contact information. No customer searches are persisted or logged by this change.

No migration, production database access, environment setting, provider configuration, extra dependency or manual deployment is required. Release later through the normal founder-approved process. Rolling back the frontend needs no database rollback. The worktree and PR contain no .env, credentials, logs, screenshots, fixture servers, build output or generated artifacts.

Limitations: the attention sample is the existing newest-first first page, not an exhaustive or oldest-first incident queue; open the full queue for all cases. No speculative “stuck after N minutes” threshold was introduced. Cross-tab/live push synchronization is not added; operators use explicit refresh and existing action invalidation. Financial/supplier operations were verified with isolated tests, never real transactions. Browser responsive checks do not certify a physical Android keyboard or touchscreen. Optional PostgreSQL tests remain skipped in the full isolated memory run; no SQL or schema changed. No unresolved P0/P1 blocker was found in this focused scope.

Before release, a founder can confirm on a phone: search an order reference; open and copy it; investigate an uncertain case without submitting anything; cancel a Marketplace confirmation; return from Overview to the prior Orders filters/page. Deployment and production acceptance belong to the subsequent authorized release task.
