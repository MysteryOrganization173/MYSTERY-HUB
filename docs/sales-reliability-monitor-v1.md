# Sales Reliability Monitor V1 — 1 November 2026

## Baseline and verified gap

Started from freshly fetched main `2e3da545288df5592c2c9d74ac3e9074f6f3d656`.
PR #69 remains a separate draft; none of its contract/permission logic is used.
PR #68 deadlines/uncertain submissions and PR #70 RLS protections are preserved.

Unchanged-main regression: 2,738 passed, 34 skipped, zero failed.
The new gap regression was run before implementation: three failed preflights
coexisted with a connected wallet health check, while the independent operational
endpoint returned 404 instead of the required 200. That test now passes.

Existing /api/admin/system calls getBalance; it does not independently establish
working service discovery or a working purchasing journey. Data and Airtime use
FulfilmentService preflight; managed storefronts use the same Data preflight.
Instant initialization performs discovery/catalogue/wallet checks in api.ts.
The old preflight returns can turn transport errors into generic availability,
package or beneficiary rejections. Observing HTTP/transport outcomes at the client
boundary preserves their diagnostic category without changing those returns.

## Observation and financial boundary

An AsyncLocalStorage frame observes existing initialization requests and shared
preflight entry points. Nested storefront/preflight calls produce one observation.
It never accepts client-reported internet errors as supplier evidence. HTTP finish
records completed server outcomes; disconnected callers with no completed HTTP
response are not invented as checkout failures.

Client hooks observe existing authenticated GET /services, /catalog, /wallet and
/instant-bundles and the existing beneficiary check. Order-submission POSTs are
excluded. No supplier probes, retries, cache invalidations or deadline changes are
added. Admin wallet calls outside a checkout frame cannot contribute recovery.

Finite categories distinguish timeouts (headers/body phase), authorization,
connection, other supplier HTTP errors, unsuccessful responses, service rejection,
insufficient supplier wallet, configuration, unexpected preflight exceptions,
unattributed server errors, validation, passed preflight and unverified evidence.
An HTTP 500 alone does not prove an internal defect or a supplier outage.
Only one primary diagnostic is counted per attempt; concurrent endpoint failures
do not inflate the affected-attempt count.

Freshness requires a network response with explicit success:true plus a passed
existing preflight. Cached responses are identified separately. A legacy or
missing success field supplies no fresh positive proof. This only qualifies
monitoring evidence; response parsing, permissions and checkout decisions remain
unchanged. This release does not resolve the original supplier timeout's cause or
the separate contract questions in PR #69.

No Paystack verification, fee/amount calculation, supplier submission, wallet,
ledger, order resolution/refund, referral/earnings or published-site behavior is
changed. A recorded preflight rejection is marked before initialization; other
observations carry no claim that payment was not initialized. The existing
uncertain-submission count remains separate in System Health. No historical
attention cases are reopened or backfilled.

## Detection and recovery policy

Three qualifying failures for the same service and stage within a strict trailing
ten-minute window open one incident. This is a conservative operational policy
for the reported pattern of repeated October 31 failures, not a reconstructed
historical outage analysis. A single transient stays insufficient evidence.
Data (including storefronts), Airtime and Instant are independent groups.

The incident records first/latest failure, affected attempts, rejected-before-
initialization count, latest category and recovery evidence. New failures update
the open incident rather than generating one alert per request. A unique partial
index and serialized writer prevent multiple open incidents for the same group.

Recovery requires two passed preflights with fresh positive evidence for THAT
service and failing stage, at least one minute apart, after the latest failure.
The first moves it to recovering; a new failure resets recovery. Older in-flight
positive responses, a different service, cached responses, a public website or an
Admin wallet probe cannot clear discovery failure. Existing five-minute discovery
caching can naturally delay the second fresh proof; the monitor does not bypass it.
After 15 minutes without relevant evidence, unresolved history says recovery is
unconfirmed rather than automatically recovered. Failures before a confirmed
recovery cannot help one later transient reopen the same incident.

No evidence, incomplete collection, unavailable storage, or a stale snapshot must
not produce a healthy verdict. Positive wording means observed existing checks
passed, not that all products are usable or a payment/delivery succeeded.

## Durable storage, security and load

Two new backend-only tables in private mysteryhub_operations store anonymous
observations and aggregate incidents. Both have RLS, no policies, no FORCE RLS,
and no PUBLIC/anon/authenticated/service_role schema/table access. The existing
non-superuser table-owner backend model remains in use; no roles or broad grants
are added. Before implementation, production had zero public RLS omissions and
the backend postgres role had CREATE privilege for this schema. Native tests use
an owner without BYPASSRLS and verify the resulting 47-table security posture.

The tables contain only random diagnostic IDs, finite service/stage/category/
phase values, timestamps, counters and freshness flags. They contain no customer,
phone, email, order/payment reference, credential, token, raw response or error
message. There is no customer linkage or notification audience.

The request path only appends a small in-memory observation; no request awaits a
monitoring query. Every five seconds, one writer flushes at most 100 observations.
The queue caps at 1,000 and reports losses/degradation. It reuses the existing
five-connection pool, yields to waiting business traffic and leaves headroom.
Transactions use 500ms statement / 100ms lock timeouts and a non-waiting,
monitor-only two-key advisory lock, separate from financial bigint locks.
Admin reads use a consistent read-only transaction without the writer lock.
An unconfirmed COMMIT is not blindly retried; other retries use the same IDs.

Observations retain at most 5,000 rows / 24 hours; incidents at most 100 / 90 days.
Retention runs with writes and hourly during inactivity. Admin shows unresolved
and recent incidents, up to 30, with persisted recent counts. At the recent row
limit, health is uncertain. This is best-effort observation, not a complete sales
census: a process crash can lose its unflushed tail, pool pressure can delay writes,
and collection gaps must not be interpreted as healthy purchasing.

## Admin and alerts

GET /api/admin/sales-reliability inherits requireAdmin and no-store. The existing
System Health section fetches it independently of wallet health, polls every 30
seconds and handles loading, no evidence, failures, stale snapshots and unavailable
storage. Individual service evidence and incident history are shown separately
from Orders → Needs attention. Session-scope guards discard stale responses.

Production inspection confirmed mysteryhub_notifications.settings.paused=true.
Existing push infrastructure is consent-bound transactional/marketing delivery,
not a verified administrator incident channel. V1 therefore provides Admin-only
alerts. It does not enable push/email, unpause workers, change consent, create
campaigns or send customer messages. Out-of-app delivery needs a separate verified
administrator channel; no such delivery is claimed here.

## Verification and release

Focused tests cover the gap, transport/category/freshness/privacy observations,
threshold/recovery boundaries, simultaneous timestamps, unknown/stale history,
bounded queues, write failures, uncertain COMMIT, authorization, duplicate supplier
calls and managed storefront nesting. Native PostgreSQL tests cover concurrency,
restart/read durability, idempotency, retention, repeat schema initialization and
unchanged snapshots of all existing public customer/financial tables.

The Database security GitHub check runs both the 47-table RLS suite and native
monitoring suite against separate disposable PostgreSQL databases. Default npm
tests skip opt-in native suites; those are executed separately, not claimed as
part of the default run. Python Playwright review renders the complete System
Health component against synthetic APIs at 360px/390px, covering 11 states at
each width, including a stalled wallet check and failed refresh. No requests may
leave the loopback review server. Commands:

```sh
npm test
npx tsc --noEmit
npm run build
git diff --check
MYSTERY_MONITOR_POSTGRES_URL=postgresql://app_owner:local-owner-only@127.0.0.1:5432/mystery_monitor_test node --import tsx --test server/suppliers/__tests__/salesReliabilityPostgres.test.ts
MYSTERY_RLS_POSTGRES_URL=postgresql://app_owner:local-owner-only@127.0.0.1:5432/mystery_rls_test node --import tsx --test server/suppliers/__tests__/backendRlsPostgres.test.ts
python scripts/reviewSalesReliability.py
```

Local credentials above are disposable fixtures, never production secrets.
Adversarial self-review corrected stale/hidden unresolved states, late/same-time
events, unknown 500 classification, duplicate observations, retry uncertainty and
read/write isolation. No second-person review is claimed.

Release checks executed: full regression 2,766 passed / 35 skipped / zero failed;
native monitoring 7/7 and RLS 10/10, no skips; mobile browser 22/22, no overflow or
page errors; TypeScript, production build and diff checks pass. The RLS suite now
executes 470 denied client statements across 47 tables.

Final rollout review reproduced a persistence-delay edge case in native PostgreSQL:
three attempts within ten minutes could miss detection if the first aged out of
the writer's flush-time query. The writer now loads the oldest buffered attempt's
event-time window. A regression proves inclusion one millisecond inside the
boundary and exclusion exactly at ten minutes. Admin's recent counts remain based
on the actual current ten-minute window.

The established initDatabase startup schema workflow creates the private tables
after PR #70 protections. The SQL mirror is identical. A monitoring schema/write
failure degrades observability rather than purchasing. After a verified merge,
Render main auto-deployment applies the migration; no second manual DDL apply is
needed. Verify deployed SHA, startup/worker logs, catalogs/advisor, HTTP health,
public catalogue, unauthorized Admin denial and read-only operational counts.
Do not generate production failures, payments or supplier orders for verification.

Recovery is a normal code rollback retaining the private tables and RLS. No
financial data needs reversal; do not disable RLS, alter payment settings or drop
incident history to recover from a monitoring deployment problem.
