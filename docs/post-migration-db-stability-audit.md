# Post-migration database stability audit — 20 October 2026

Status: **FIX READY FOR REVIEW. Not merged or deployed.**

## 1. Current main

VERIFIED: freshly fetched `origin/main` is `99a4a7434cd63e2faa26a1e5d02e65a21e9016a5`. The isolated candidate starts from that exact revision. PRs #29 and #31 remain open, unmerged, with their reported heads unchanged. The completed domain migration is preserved.

## 2. Investigation period and evidence boundaries

Historical investigation covers 19 October 23:18 UTC through 20 October approximately 09:37 UTC. Render's five-minute metrics query returned buckets from 23:15 through 09:30; boundary buckets are rounded, not exact per-request timestamps. This is historical telemetry plus spot checks, not a continuous local uptime test. Supabase log queries independently covered the incident windows. Sanitized evidence and test/build output are retained privately outside Git.

## 3. Render state and production health

VERIFIED: `mysteryhub-api` is live at main `99a4a7434cd63e2faa26a1e5d02e65a21e9016a5`, deploy `dep-dbba38t9fdbs73duivmg`, completed 19 October 23:03:43 UTC. It remains one Frankfurt 0.5-CPU/512-MiB instance. No availability/restart/failure/deployment events were returned after cutover. Configuration and domains were not changed.

At 20 October 09:37 UTC, `/health` and `/api/health` returned 200 JSON on the public domain; the backend's original `/api/health` returned 200. The existing QuickByte website and Dell product HTML returned 200, exercising their database-backed public metadata readers. Anonymous `/api/admin/system` returned 401 JSON. Health endpoints alone are process-liveness checks, not database-readiness proof.

## 4. Exact database pool configuration

VERIFIED from the live masked Render environment, classified without disclosing its URL, credentials or hostname: Supabase shared Supavisor endpoint, port 5432, **session mode**, not a direct or transaction-mode connection. There are no linked environment groups. The deployed source has one module-level `pg.Pool` in `server/db/connection.ts`, lazily shared by all stores:

- `max: 20` before this patch.
- `idleTimeoutMillis: 30000`.
- `connectionTimeoutMillis: 10000`.
- No explicit minimum, query timeout or session-retry layer.
- Existing TLS options are unchanged; see section 19.

The pooler explicitly rejected sessions at **15**, which is distinct from PostgreSQL's separately observed `max_connections=60` and `superuser_reserved_connections=3`. The database also reports `statement_timeout=120000` and `idle_in_transaction_session_timeout=0`. These database settings were only read.

## 5. Cause of EMAXCONNSESSION

VERIFIED defect: the application is allowed to request 20 dedicated sessions from an endpoint that rejects sessions beyond 15. A released pg client remains an open provider session until idle eviction; `release()` is not a disconnect. Correct cleanup therefore does not prevent this mismatch.

Supabase independently recorded three `ClientHandler: (EMAXCONNSESSION)` rejections at 06:38:14–06:38:17 UTC and five more at **07:32:44.285–.286 UTC**. The latter recurrence was absent from Render's error-level application logs.

LIKELY WITH EVIDENCE: concurrent work plus retained idle sessions reached the provider budget. The oversized pool is a demonstrated contributor. Historical checked-out/idle/waiting counts and identities of all other session clients were not recorded, so the precise initiating request mix and ownership of every slot remain UNVERIFIED. A leak, long-running query or external competing process is not established.

## 6. Connection lifecycle assessment

VERIFIED static review: only one production pool constructor exists. The 20 explicit connection-acquisition sites in initialization/stores/services have matching `finally` release paths; passed-in transaction clients remain owned by their caller. Single-query `pool.query` calls use node-postgres's automatic release. Reviewed paths include auth, finance, orders/webhooks, AFA, referral controls/recovery, website transactions/analytics, assisted orders, order resolution and customer champions.

Success, query rejection, failed actions, rollback, failed schema initialization and acquisition failure were exercised with node-postgres's actual queue and socket-free synthetic clients. Acquisition timeout removes the waiter; failed dialing does not retain a pool client. Existing code does not cancel a database query merely because its HTTP caller disconnects; the abandoned-caller mock confirms eventual release after completion, not real-socket cancellation or instantaneous reclamation. An in-flight long query can still hold a slot until it finishes/fails.

At approximately 09:30 UTC, the database snapshot had six idle client backends plus the diagnostic query, with no idle-in-transaction, blocked, other-active or >10-second active queries. Provider background workers were also visible. These are aggregate database counts, not application pool counters and not proof of incident-time behavior.

## 7. Admin and background behavior

`requireAdmin` in `server/middleware/authMiddleware.ts` resolves the session through the shared pool and then asynchronously touches its last-seen time. The SQL update is conditional on five-minute staleness, but a query is still issued per authenticated request. Database verification failures remain fail-closed.

`AdminOverviewSection.tsx` starts five parallel sources. `adminSignals.ts` also fetches badges; only the overview request is coalesced/cached for 60 seconds, so marketplace and withdrawal reads can overlap. The withdrawal endpoint fans out over returned rows using `Promise.all`. This is legitimate concurrency pressure, not evidence of a leak or proof that Admin caused the incident. Overview/System Health refresh on mount and explicit user action; the 30-second `Freshness` timer only updates display text. No automatic System Health polling storm was found.

`server.ts` schedules initial recovery after ten seconds, pending-payment work every ten minutes and supplier reconciliation every three minutes. Supplier orders are iterated sequentially; separate timer invocations have no general overlap latch if a run exceeds its interval. Startup uses one schema client before listening. No incident-time evidence attributes exhaustion to these jobs; changing their financial recovery behavior is unjustified here.

## 8. HTTP 500

VERIFIED: five responses in Render's 06:40 five-minute bucket. The 06:38:17.439654588 Admin middleware error and 06:38:17.507867881 System status error both explicitly contain EMAXCONNSESSION. The latter log uniquely identifies `/api/admin/system` in `server/routes/adminApi.ts`; both catch paths return generic 500 responses without granting access.

LIKELY WITH EVIDENCE: at least part of the 500 burst relates to those failures. UNVERIFIED: the complete five-request route/status mapping. Exact-path metrics for System Health, Overview and `/health` returned no series; that is missing evidence, not zero traffic.

## 9. HTTP 503

VERIFIED: one response in each 23:30 and 07:35 bucket. No corresponding restart, resource-limit event or application warning was found. The 07:35 bucket is temporally close to the independently confirmed 07:32:44 pool rejections.

UNVERIFIED cause and routes. `server/routes/publicHtml.ts` deliberately emits a silent, generic 503 if a database-backed metadata lookup fails; optional authenticated routes can also return 503 on session verification failure. These are possible paths, not identified historical requests. Neither response can be conclusively assigned to Render, a database error or a timeout.

## 10. HTTP 404

VERIFIED: 752 responses in the returned metric buckets, including 255 at 04:40 and 266 at 07:35. Actual paths/user agents are UNVERIFIED. Logs expose only `app` and `build` types; the filtered historical request-log query returned zero entries despite the metric counts. Existing application logs do not record access paths. Supabase sees database activity, not the original HTTP URL.

Do not label the bursts harmless bots, broken assets, missing customer sites or crawler failures without evidence. No blocker, redirect, WAF or route rewrite was added. Existing tests confirm missing assets and unknown APIs retain 404, metadata errors fail closed, and public product/site previews retain their original-domain behavior.

## 11. Timeline and resource context

- 19 October 23:03:43: current backend deployment completed, before cutover.
- Approximately 23:18: domain cutover; initial mixed-edge propagation was recorded separately in the migration evidence.
- 23:30 bucket: 115 HTTP 404 and one HTTP 503.
- 20 October 04:40 bucket: 255 HTTP 404.
- 06:38:14–17: Supabase rejects three sessions; two matching Render application errors at 06:38:17.
- 06:40 bucket: five HTTP 500.
- 07:32:44: Supabase rejects five sessions.
- 07:35 bucket: 266 HTTP 404 and one HTTP 503; correlation does not prove a shared cause.
- 09:37: safe health/public-page checks pass; anonymous Admin remains denied.

## 12. Confirmed versus unresolved

Confirmed: an unsafe 20-versus-15 pool budget, repeated session rejection, two affected Admin code paths and a historical request-observability gap. Not confirmed: leaked clients, abnormal Admin polling, bots, broken frontend assets, CPU/RAM exhaustion, universal 500/503 attribution or causation by the domain migration. Moving HTML to Express adds database-backed owner/product metadata reads, but that does not prove which requests triggered these incidents.

## 13. Minimal correction

Change only `max: 20` to `max: 5` in the shared connection factory. Excess work queues locally with the existing ten-second acquisition limit. Two revised application processes use at most ten sessions, leaving five of the observed budget for operational/other use. This is a conservative budget, not a measured throughput optimum or a guarantee against arbitrary other clients. No provider limit, connection mode, URL, timeout, transaction behavior, retry, schema or authorization contract changes.

The first eventual rollout can briefly overlap the old 20-client process with the new one. Confirm available session headroom before that separately approved deployment; the two-times-five allowance applies after both processes use the revised setting. Monitor queue latency/timeouts rather than blindly increasing the cap.

## 14. Verification and scope

- New lifecycle suite: **13/13 passed**, using the actual pg pool queue with synthetic clients and no network database access. The old 20-client control produces exactly five provider rejections even though all 15 accepted clients return idle; the five-client candidate and two-process case complete successfully.
- Covers success, query rejection, transaction rollback/no replay, account rollback, initialization failure, acquisition saturation/timeout, unavailable provider, dial timeout/recovery, concurrent Admin verification, fail-closed errors and an abandoned-caller simulation.
- Focused DB isolation, auth/account, Admin, finance, payment/webhook integrity and social-routing regression: **276/276 passed**.
- Full isolated regression: **2206 total, 2179 passed, 0 failed, 27 optional PostgreSQL skips**. Exact main-tree evidence from the immediately preceding release was 2193 total / 2166 passed / 0 failed / the same 27 skips. Difference: 13 added passing tests, no regression. No inherited failures were present in this baseline.
- `npx tsc --noEmit`, production build and `git diff --check`: passed. Existing non-blocking build warnings were left alone.
- No real PostgreSQL concurrency/stress test was performed; provider saturation was simulated. No production test data was created. Existing external-DB test isolation was preserved.

Runtime diff: one connection setting plus its explanation. Other committed files: the focused test and this report. No dependencies or environment files.

## 15. Performance observations

VERIFIED returned five-minute series: CPU maximum 0.00467041 CPU (about 0.93% of the 0.5-CPU allocation); memory maximum 172466180 bytes (about 164.5 MiB, 32.1% of 512 MiB); instance count exactly one. Latency series unavailable. Returned HTTP buckets total 2881 responses, including five 500 and two 503. These observations do not justify a plan upgrade. They do not exclude short spikes between samples.

## 16. Privacy and financial safety

No production records, sessions, balances, orders, schemas, DNS, domains, secrets or service settings were modified. Database diagnostics were read-only aggregates and provider logs. No authenticated production request or financial/supplier action was used. No passwords, tokens, connection strings, raw query parameters, customer bodies or database usernames were published. Tests retain fail-closed Admin/optional-auth behavior and existing financial rollback/idempotency protections. PRs #29/#31 were untouched.

## 17. Monitoring recommendations

During an approved release, compare Supavisor rejections, API 500/503 counts and acquisition latency before/after. Sample the app pool's `totalCount`, `idleCount`, `waitingCount` through a protected operational surface or sanitized error log; the current `isDbConnected()` only reports pool initialization state. Do not expose these counts as public account diagnostics.

Historical path evidence cannot be reconstructed here. Render documents request logs as a Pro-workspace capability; the paid service plan alone does not establish availability. A small separately reviewed, rate-bounded error counter/log using Express route patterns (never raw URLs/query strings, IPs, tokens or bodies), status category and pool counts would close the gap without a new service or subscription. Unknown-route errors should use fixed categories such as `missing_asset`, `unknown_api`, `unmatched_site` and `other`, not arbitrary user-supplied paths. Leave legitimate Meta/WhatsApp/search crawlers alone.

## 18. Delivery

Branch: `codex/post-migration-db-stability`, from the verified current main. Commit and PR identifiers are supplied in the delivery report to avoid a self-referencing commit. Founder review only; do not merge or deploy automatically.

## 19. Remaining risks

The patch is not live, and absence of a later error is not proof of resolution. Other clients can still consume the provider budget; acquisition can still time out under sustained load. No historical application-pool counters, route-level request logs, p95 latency or production workload benchmark were available. Background timer overlap and withdrawal fan-out warrant observation, not speculative rewrites.

Existing source uses `{ rejectUnauthorized: false }` for PostgreSQL TLS unless SSL is explicitly disabled. This predates the incident and is unchanged here. Server-certificate verification should receive a separate scoped review using the correct CA/hostname; no bypass or TLS/configuration change was introduced by this task.

## 20. Exact next founder action

Review the focused PR and approve a separate release if satisfied. Keep current domains and provider settings unchanged. Before deployment, check session headroom for overlap with the old process. After deployment, verify the actual Render revision/startup, Admin access/System Health, public metadata pages and provider error/queue trends during ordinary traffic. If exhaustion recurs, capture protected pool counters and privacy-safe route categories before changing capacity or worker behavior. The unexplained historical 404/503 cases remain explicitly open.

### Official references

- [Supabase connection endpoints and session/transaction semantics](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase connection management](https://supabase.com/docs/guides/database/connection-management)
- [node-postgres pool lifecycle, queue and timeouts](https://node-postgres.com/apis/pool)
- [Render application and HTTP request logs](https://render.com/docs/logging)

**FIX READY FOR REVIEW**
