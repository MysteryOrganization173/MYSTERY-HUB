# Emergency Neon standby: controlled PostgreSQL provider switch

Status (November 21, 2026): **PREPARATION ONLY. NOT A LIVE CUTOVER.** This document does not authorize deploying a new connection string.

## Verified infrastructure

- Supabase production project: `fcvydpuuwbciuulrvizk`, active/healthy on Free. Its organization is at risk of a Fair Use Policy restriction **November 23, 2026**, not December 23.
- Neon Free project: `patient-term-85828320` ("Mystery Hub Emergency Standby"), region `aws-eu-west-2`; database `mysteryhub_staging` on branch `main`. Verified reachable November 21 but **no application tables or customer data yet**.
- Production uses one server-side `pg.Pool` in `server/db/connection.ts` sourced from `DATABASE_URL`. It is already provider-neutral PostgreSQL. **Do not rewrite checkout, supplier handling, auth, or admin for provider switching.**
- Source application footprint when inspected: **38 public tables, 31 private-schema tables, 15 application triggers, 12 functions**. These are application resources, separate from Supabase-owned internal schemas.
- Source database has live order, customer, session, SMS, notification, referral, website, finance, and webhook records. App-owned tables have relationships and transaction invariants. **Never copy only orders/users or finance balances.**

## Invariants

1. **Exactly one writable authoritative database at any time.** No dual-write, per-request fallback, automatic retry against the old provider, or mixed order/payment state.
2. Copy **all application-owned database schemas and data**, not the whole Supabase platform. Include `public` and all schemas matching `mysteryhub_*`, plus triggers/functions, indexes, constraints, sequences, and required roles or safe replacements. Exclude Supabase internal `auth`, `storage`, `realtime`, `vault`, etc. only after dependency audit.
3. Do not change Paystack webhook endpoints, vendor API settings, frontend code, or Cloudinary asset storage merely to change database host.
4. No real payments, supplier submissions, SMS, refunds, or withdrawals during dry runs. Disable checkout before a write freeze if necessary.
5. Do not put any database password, `pg_dump` archive, customer records, or raw connection URI in a Git commit, issue, logs, or chat.
6. Existing production `initDatabase()` automatically creates/migrates tables on startup. **Never boot it against the empty standby.** A successful server boot is not evidence of data restoration.
7. A rollback after Neon accepts writes requires a **new full Neon-to-Supabase data migration**. Simply reverting `DATABASE_URL` would lose all orders/payments created during Neon operation.

## Stage A: build and test standby with no production changes

1. Take a locally controlled, encrypted custom-format PostgreSQL snapshot from Supabase using a direct connection where available. Use `pg_dump` with `--format=custom --no-owner --no-acl --schema=public --schema='mysteryhub_*'`, excluding provider-owned schemas. Confirm that every application-owned schema was included. Retain the source archive securely.
2. Inspect archive contents with `pg_restore --list`. Check dependencies on extensions, owner roles, ACLs, functions, triggers, and schema references before import.
3. Restore into the **empty Neon `mysteryhub_staging`** using a **direct, TLS-protected** connection, not a transaction pooler, and `pg_restore --no-owner --no-acl`. For any errors, fix role/extension incompatibilities and repeat in an isolated disposable Neon database or branch; never run a destructive restore over production.
4. Compare inventory and aggregate counts with:
   `MYSTERY_SOURCE_DATABASE_URL=... MYSTERY_STANDBY_DATABASE_URL=... node scripts/db-standby-preflight.mjs`
   Export both variables securely in your local environment; never paste URLs into command history or Git. The tool only reads metadata and counts. **Before final cutover, freeze writes or count differences will be expected.**
5. Verify detailed table definitions, constraints, sequences, indexes, triggers, functions, required role privileges, and targeted checksums/IDs. Aggregate counts alone cannot establish correctness. Check session/login handling, order reference lookup, idempotency, paid/refunded states, and ledger reconciliation without triggering real provider actions.
6. Smoke-test the application using a separate nonproduction backend instance with the Neon URL and **all supplier/payment/SMS outbound side effects disabled**; validate on staging. Do not expose the staging backend to public traffic.

## Stage B: controlled one-way cutover ONLY after Stage A passes

1. Announce a short maintenance window and prevent **new checkout/payment initialization**. Stop/complete in-flight transactions; reconcile recorded Paystack payments and supplier deliveries. Pause all writers: live API, scheduled reconciliation, SMS and push workers, and inbound webhooks (verify replay/retry and recovery).
2. Take a **new final full app-owned dump after the freeze**, then restore it into a clean standby state. Do not trust an earlier testing snapshot. Verify all table counts, high-water marks, payment references, ledger sums, constraints, and provider event IDs against the frozen source.
3. Stop the old backend instance and wait for its workers and connections to finish. Change **only the backend's** `DATABASE_URL` secret to the Neon **pooled application** connection. Keep `NODE_ENV=production`; do not let in-memory fallback handle real orders.
4. Deploy **one backend writer**. Verify boot/migration success, DB readiness, login, read-only order tracking, admin order lookup, and finance reporting before reopening checkout.
5. Re-enable incoming webhooks and workers after verification; run controlled reconciliation. Watch duplicate webhook events, retries, SMS side effects, and payment idempotency. Only then reopen checkout.
6. Keep the Supabase database intact and read-only from the application. Do not delete it. Retain encrypted backups and a rollback plan.

## Stage C: December 8 return to Supabase

- **Never treat this as a connection-string toggle alone.** After the first Neon-side write, Supabase is stale.
- When Supabase's allowance refills, freeze Neon-side writes and repeat the verified full data transfer **Neon -> Supabase**, restoring into a safely isolated replacement or clean validated destination. Compare keys, ledgers, counts, references, functions, constraints, and recovery state. Only then point the backend back to Supabase.
- The December 8 reset is when restrictions may lift, with possible delay; it does **not** prove Free-plan sustainability. Measure two complete *normal-load production days after returning to Supabase*, and compare to the 5 GB / cycle budget. Prefer a safety margin of roughly 100–120 MB per day, not just the ~161–167 MB mathematical maximum.
- November 22 is the first complete UTC day after the November 21 optimization. November 21's partial usage cannot establish a daily rate. Compare the documented November 17–20 baseline (~300–400 MB per day) only with full days at comparable customer load.
- If the post-fix rate remains above target, do not repeatedly migrate databases to avoid billing. Continue reducing redundant reads/workers or choose infrastructure that the real business revenue supports.

## Cost and operational cautions

- Neon is also on a **Free** plan, with compute and network limits and scale-to-zero behavior. Monitor its quotas daily. It is not unlimited bandwidth.
- Cross-region latency (Render service region vs Neon `aws-eu-west-2`) may differ; check production-like timings.
- The source and standby are both PostgreSQL 17, but this does not guarantee matching extensions, roles, privileges, or behavior.
- Arkesel automatic SMS troubleshooting is a separate pending supplier issue. Do not claim its HTTP 422 issue is resolved or enable live send tests without approval.
- If the final migration cannot be verified before November 23, prioritise **safe checkout suspension** over untested migration. No live sale should proceed if its payment and order record may diverge.

## Rollback trigger

If post-cutover login, payments, order tracking, financial balance calculations, or webhook idempotency fail, immediately disable checkout and stop writers. Investigate and restore from a known-good encrypted snapshot; if Neon has already accepted writes, export and reconcile those writes before returning to Supabase. Do not switch URLs first and reconcile later.
