# PostgreSQL egress audit and release checks

## Production baseline on November 21, 2026

GitHub main and the live Render API both started at `962838b3c23b1fd6a2318ffcc74888c83ec6c592`. Render reported one backend instance with automatic deployment from main. The production domain also returned a Render response identifier and the Render static site reported the same live commit. PostgreSQL is accessed through the existing `pg` connection pool using `DATABASE_URL`. Each backend process has a maximum of five connections, a 30-second idle timeout and a 10-second connection acquisition timeout. A point-in-time database sample saw 11 total client backends across consumers, including the audit connection. That count does not measure the Render pool alone.

The Supabase dashboard figures supplied by the founder show 12.32 GB uncached egress against a 5 GB allowance and a database of about 42 MB. Shared Pooler Egress accounted for most of the usage. November 15 was about 1.596 GB. The recent complete days of November 17–20 were about 300–400 MB each. The 156.5 MB on November 21 was a partial reading at 13:05 UTC. Supabase warned of possible HTTP 402 restrictions starting November 23. Reducing traffic cannot remove accrued usage this cycle, and there is no verified grace-period extension.

The original finance-history lookup stood at 317,856 calls and 15,713,116 result rows. These are historical counters. They stayed flat during a 25-second read-only stats comparison, while the already deployed user-scoped idempotency lookup accumulated calls. That fix is already in production.

The strongest ongoing finding was the managed-store recovery batch. At 13:24 UTC the existing query returned 50 delivered orders whose earnings were already available. At 13:33 UTC it again returned 50 settled orders. The replacement query returned zero eligible orders against that same snapshot. The previous loop reopened a finance transaction for each settled order and locked and reread financial state. Every one of those 50 slots was unavailable to other orders that might need recovery.

## Scheduled database work

| Work | Existing cadence | Database behaviour and decision |
| --- | --- | --- |
| Supplier reconciliation | Startup and every 3 minutes | Wallet, store, and commercial recovery plus AFA cleanup and supplier status checks. Narrow only the store candidate query. Preserve supplier, payment, and Wallet operations. |
| Stale-payment reconciliation | Startup and every 10 minutes | Current bounded payment checks and recovery remain in place. |
| Automatic SMS and outbox | 5-second scheduler with existing busy and error guards | Automatic event discovery, heartbeat, credit check, and claim at idle. Keep discovery and heartbeat, skip only empty claim transactions and repeated idle balance refreshes. Delivery-report reconciliation remains at one minute, runtime health at 30 seconds, sender checks at 10 minutes and retention at one hour. |
| Web Push worker | Every 10 seconds, including startup | Previously attempted guest retention, event expansion and delivery claims even with no work. A read-only probe chooses the existing paths only when due. |
| Sales reliability monitor | Every 5 seconds | Flushes an in-process buffer when work is available and maintains retention periodically. Keep the existing batching. |

The 25-second production sample observed three idle SMS passes and three idle push passes. SMS returned no work from its automatic discovery and queue selection during that window, and push expanded or claimed no rows. These were observations over a short interval. No statistics were reset, no production tables were written, and no real checkout or provider requests were initiated by the audit.

## Changes and measured effects

| Change | Evidence | Correctness and latency |
| --- | --- | --- |
| Store recovery in `WebsiteBusinessService.recoverEffects` | The old candidate query selected 50 settled rows vs zero for the replacement in the same production snapshot. The mean stored row size was 1,152 bytes. At 480 sweeps per day that is up to 24,000 avoidable finance transactions and about 27.6 MB/day in selected-order row size alone, if that snapshot represents the normal idle case. It excludes the order reread, financial rows and protocol overhead. | Joins on the existing unique owner and idempotency key. Still selects paid orders, missing earnings, pending delivered credits, reversible failures and refunds, and eligible supplier review. Existing transaction rechecks and idempotency remain. Genuine work can reach the next three-minute sweep without competing with those 50 settled rows. Permanently unresolved reviews or reversals may still occupy slots. |
| Push idle probe in `processNotificationBatch` | Native PostgreSQL exercised both paused and unpaused idle ticks and observed one SQL statement, with no transaction. An unpaused empty pass previously issued eight statements including transaction setup and completion, based on the worker control flow. | Existing locks and rechecks still apply to event expansion, claims, transient failures, and subscriber permission. Newly created work remains eligible on the next normal tick. |
| SMS idle check in `smsTick` | Native PostgreSQL measured zero provider credit calls across two warm idle ticks, one call after the idle balance expired, and one fresh credit call and one mocked send for queued work on the next tick. The warm idle path skips the claim transaction and balance write. | The sender, budget, consent, claim, and crash recovery checks are retained. Queued work still checks current provider credits before processing. The displayed idle credit snapshot can be up to about a minute old. Report polling, duplicate protection, and uncertain-send handling retain their existing cadence. |
| Admin finance projection in `reportingFinancialOrders` | In a bounded production sample of 50 recent rows, mean PostgreSQL composite size changed from 759 to 284 bytes (63% less). In disposable PostgreSQL, the same report fixture shrank from 109,618 to 43,021 serialized JSON bytes (61% less), with equal totals across four date windows and a verified refund fixture. | The two report summaries use their existing accounting calculations and read the same order population. Detail views still receive the fields they need. No client caching or frontend refresh behaviour changes. The summary still scales with the number of orders. |

Row counts, PostgreSQL tuple size and test JSON size are different from billed Shared Pooler bytes. Latency percentiles, database CPU changes and daily billed savings have not been established by the audit. The worker schedules, checkout path, order tracking and Admin refresh timing did not change. The optimization introduces no index, schema migration, external dependency, financial-state cache or additional database pool.

## Assessing sustainability

Collect at least two or three complete UTC days of Shared Pooler Egress after rollout and compare with complete pre-release days with similar order, tracking and Admin traffic. Record deployment time, request volume, HTTP errors and existing latency percentiles alongside the daily totals. If an alert restricts traffic, exclude that period from a comparable-load analysis. Use bounded query-count and returned-row deltas over the same intervals where attribution is useful.

The free allowance averages about 161 MB/day across 31 days. Reaching 100–120 MB/day from 300–400 MB/day requires roughly 180–300 MB/day less traffic. The evidence for this release does not establish that reduction. If daily usage remains above target, the next measurement should attribute the remaining bytes to frequently called statements before changing them.

1. Measure customer history and Admin/finance summary request volume. `OrdersStore`, `reportingOrders` and `FinanceStore.metricsSnapshot` still have wider history reads. Scope projections and pagination to their actual callers. Any replacement for the accounting totals needs native parity tests for payments, refunds, costs and managed-store wholesale.
2. Check scheduled commercial-benefit recovery and the automatic SMS event-discovery queries for rows repeatedly revisited with no transition possible. Keep late payments and retries recoverable, and distinguish rows inspected inside the database from rows transferred to the backend.
3. Inspect duplicate reads by usage volume before changing public catalogue, marketplace and Admin refreshes. Reuse existing authorization boundaries. Keep Wallet, payment, refund and attention state authoritative. An ordinary Git revert of this PR can restore the previous query and worker paths without data restoration.

## PostgreSQL portability

Application runtime uses the existing PostgreSQL connection string, transaction and locking primitives, JSONB, and PL/pgSQL triggers. The source production project also lists `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault` and `uuid-ossp`. Inspection of application code found no new reliance on Supabase APIs or Vault. Keep provider-owned schemas out of any application-specific restore, and confirm actually used extensions against the dump. The current statistics query uses Supabase's `extensions.pg_stat_statements` and is operational tooling.

Before a separate Neon staging exercise, verify ownership, grants, RLS and roles such as `anon`, `authenticated` and `service_role`; preserve manually installed private schemas and their triggers. Verify the application role and pooled TLS connection, the region and cold-start impact, advisory-lock and worker-claim concurrency, billing limits, restore completeness, and rollback. This release does not change hosting or create a second database.
