# Temporary PostgreSQL standby and return runbook

## Baseline and staged copy

Supabase production is project `fcvydpuuwbciuulrvizk`, database `postgres`. Neon Free standby is project `patient-term-85828320`, branch `br-wild-boat-bji8j9fu`, PostgreSQL 17, AWS London. The original `mysteryhub_staging` database is empty. A separate ICU candidate `mysteryhub_standby_icu` has been prepared on that branch for the first rehearsal. The production backend was running on one auto-deployed Render instance in Frankfurt. This PR leaves its existing connection selected.

Production inventory was 69 application tables across seven schemas. It included 227 indexes, 15 application triggers, 12 routines and three sequences. All application tables had owner-based RLS and no custom policies. The production branch started at commit `4215ea82c02a950445edf8bddf18e79b71e6d578`. The application uses Express authentication and its own stored sessions. It does not need Supabase-managed Auth, Storage, Realtime, Vault, or other platform schemas. The activity logs, webhook and order references, customer accounts and sessions, finance ledger and accounts, referrals, catalogue, website records, SMS, notification, AI and operations records are all in scope. Paystack recovery uses the existing persisted payment references and financial idempotency keys.

The source returned no duplicate order or payment references, duplicate finance idempotency keys, Wallet balance drift, or Wallet entries without an account. These were aggregate read-only checks. Production used UTF-8 with ICU `en-US` version `153.121`. The original Neon database used the PostgreSQL builtin `C.UTF-8` locale, and the available Neon `en-US` ICU collation reported `153.120`. The original database therefore fails the clone's locale gate. A separately named ICU database is required. A version difference between otherwise matching ICU locales must pass the ordering and case conversion comparison over existing sign-in keys and public slugs, then application smoke tests.

The operator reported restoring all 69 application tables into `mysteryhub_standby_icu` from a verified local backup. During a later comparison with live Supabase, `public.orders`, `mysteryhub_sms.messages` and `mysteryhub_sms.settings` differed. Use a new snapshot after draining writes for final parity. Preserve the rehearsal archive and database.

A read-only check on November 23 confirmed that the separate final candidate, `mysteryhub_standby_cutover_20261123`, contains zero application tables. The forward clone still pins `mysteryhub_standby_icu`. Review and update that exact destination pin during the separately authorized cutover before attempting the final restore. The runtime TLS rollout does not use either Neon database.

## Rehearse with an isolated target

1. Use Node and the PostgreSQL **17** client tools `pg_dump`, `pg_restore` and `psql` on WSL2/Linux. Confirm `pg_dump --version`. Use the direct Supabase connection if IPv6 is reachable. On an IPv4-only network, open **Connect → Session pooler** in the production Supabase project and copy its exact hostname. Session mode uses port `5432` and `postgres.fcvydpuuwbciuulrvizk` on database `postgres`. Port `6543` and other transaction-pooling routes are rejected. The connection verifies TLS and the script confirms the server's cluster identity before reading application rows. If the cluster was rebuilt, reverify the pinned identity through the project-scoped management connection before using Session Pooler.

2. Select the existing **`mysteryhub_standby_icu`** database on the verified Neon branch, with the intended backend owner and the direct endpoint. Forward staging is pinned to that exact database. The clone refuses a nonempty destination. Allow a different forward database only through a separately reviewed pin update for a later attempt or the final maintenance snapshot.

3. Run `npm ci` at the merged revision. Use a private, operator-owned archive directory with mode `0700` on encrypted storage outside Git. For the IPv4 path, run the following in Bash, after setting the archive path. If certificate validation requires a project CA, set `MYSTERY_SOURCE_CA_FILE` or `MYSTERY_STANDBY_CA_FILE` to the provider-issued CA path before running the commands.

   ```bash
   (
   set -e
   set +x
   export MYSTERY_STANDBY_ARCHIVE_DIR=/path/to/private/encrypted/standby
   install -d -m 700 "$MYSTERY_STANDBY_ARCHIVE_DIR"
   read -r -p 'Supabase Connect Session pooler hostname: ' MYSTERY_SUPABASE_SESSION_HOST
   export MYSTERY_SUPABASE_SESSION_HOST
   read -rs -p 'Supabase database password: ' MYSTERY_SOURCE_PASSWORD
   printf '\n'
   export MYSTERY_SOURCE_PASSWORD
   MYSTERY_SOURCE_DATABASE_URL="$(node -e 'const e=process.env; process.stdout.write("postgresql://postgres.fcvydpuuwbciuulrvizk:"+encodeURIComponent(e.MYSTERY_SOURCE_PASSWORD)+"@"+e.MYSTERY_SUPABASE_SESSION_HOST+":5432/postgres?sslmode=verify-full")')"
   unset MYSTERY_SOURCE_PASSWORD
   read -rs -p 'Neon direct URI for mysteryhub_standby_icu: ' MYSTERY_STANDBY_DATABASE_URL
   printf '\n'
   export MYSTERY_SOURCE_DATABASE_URL MYSTERY_STANDBY_DATABASE_URL
   node scripts/db-standby-clone.mjs --probe-source
   node scripts/db-standby-clone.mjs
   node scripts/db-standby-preflight.mjs
   )
   ```

   On an IPv6-capable host, use a silent prompt for the full source direct URI instead of constructing the Session Pooler URI. Keep the same Neon and verification steps. The `--probe-source` run verifies that a second PostgreSQL 17 client can import the exported snapshot by dumping just the definition of `public.users` to `/dev/null`. It does not create an archive or connect to Neon. Proceed only after it succeeds. Session Pooler uses the same Supabase project and remains subject to its availability and quota restrictions.

4. The clone saves a custom-format archive under the private directory, then restores SQL with `ON_ERROR_STOP` in one transaction. The snapshot used for the archive also supplies the source content checks. A restore error rolls back the application schema. Existing private roles and objects on the source are preserved there. The destination uses the verified owner and backend-only RLS model. The script removes public and client grants and validates the destination's effective permissions. The comparison covers every row, named constraints, indexes, triggers, functions, column structure, sequence state, and financial invariants. Output contains table and object names and statuses. Keep the archive encrypted with a retention policy. Generated plain SQL is temporary and should be removed from the encrypted volume if an operator interrupts a run.
5. A successful comparison means archive parity at the captured snapshot. It does not mean automatic promotion. PostgreSQL sequences are outside MVCC, so a rehearsal on the moving source can detect differences even with the exported snapshot. A failed comparison leaves a restored target isolated for investigation. Use a fresh, explicitly pinned destination for another attempt. A separate live-source comparison can detect changes made after the dump snapshot. Final validation requires frozen writers.
6. Verify an isolated candidate with no provider secrets and an outbound rule denying payment, supplier, SMS and push calls. Use a synthetic PostgreSQL rehearsal account for sign-in, session and ownership checks. On a real-data copy, an authorized operator can compare known existing login, session, order and Admin properties privately. Favor read-only checks for real copied data. Never expose the staging API or copy it into a frontend build. Check one instance with the exact runtime role and TLS connection path, and confirm the notified queues and holds are preserved. Any uncertain paid or supplier state stays held until investigated with the provider.

Run the repeatable final comparison from the same secure environment with both URLs exported.

```bash
node scripts/db-standby-preflight.mjs
```

Exit status 0 means parity passed. Status 2 indicates count, content, structure, sequence, locale behavior or financial parity failed. Status 1 indicates a connection, input, program or permission error. The CLI never changes the application's `DATABASE_URL`. Use the active source and the fresh intended destination when comparing.

## Runtime TLS rollout before maintenance

**Phase A — compatible code deployment.** With no strict flag or database-switch guard configured, the existing production Supabase project and its port-5432 connection retain the existing node-postgres SSL behavior. A startup log identifies this compatibility policy. Treat it as transitional, even if the current URL already selects verification. An HTTP health response alone establishes service availability.

**Phase B — enable verified TLS on Supabase under separate approval.**

1. Obtain the provider-issued **Supabase Root 2021 CA** from the authenticated project dashboard. Verify the public certificate subject, issuer and SHA-256 fingerprint against the provider's certificate or trusted local copy. Upload the PEM CA as the Render service secret file `supabase-root-2021.crt` in **mysteryhub-api → Environment → Secret Files**. Its runtime path is `/etc/secrets/supabase-root-2021.crt`. Upload the CA certificate only. Keep private keys and connection URLs in their existing secret storage. Make the file available in the running revision before enabling strict TLS.
2. In an authorized Render Shell, verify that the file is readable and probe the existing Supabase connection with the application driver. These temporary process settings leave the service configuration alone.

   ```bash
   test -r /etc/secrets/supabase-root-2021.crt &&
     DATABASE_SSL=verify-full DATABASE_SSL_CA_FILE=/etc/secrets/supabase-root-2021.crt \
     node --import tsx scripts/db-tls-probe.ts postgres
   ```

   The probe performs a read-only database-name check after the TLS handshake and prints a sanitized result. Existing URL mode `require` can be used for this step because the strict app policy still verifies both certificate and hostname. Move obsolete `ssl`, `sslkey`, `sslcert`, `uselibpqcompat` or insecure `sslmode` options out of the URL through an approved configuration update before enabling the flag. A URL `sslrootcert` path and the environment CA path must agree when both are set. The Pooler requires the provider CA for strict mode. If Render Shell is unavailable, rehearse with the same Node version and trust in an isolated runtime before requesting the configuration deployment.
3. Once the probe passes and the operator approves the configuration deployment, set `DATABASE_SSL=verify-full` and `DATABASE_SSL_CA_FILE=/etc/secrets/supabase-root-2021.crt` together. Keep the current Supabase provider selected. Verify the startup message `[DB] PostgreSQL certificate and hostname verified.` and confirm the live health checks. Keep maintenance disabled throughout this rehearsal. If the process cannot verify its certificate or resolve the database, stop before the maintenance window.

**Phase C — verify Neon before promotion.** In an isolated process, supply the actual candidate's direct or pooled Neon URL securely with `sslmode=verify-full`; clear the Supabase-specific `DATABASE_SSL_CA_FILE` for that process. Run `DATABASE_SSL=verify-full node --import tsx scripts/db-tls-probe.ts mysteryhub_standby_cutover_20261123`. The client uses Node's trusted roots without a custom CA. Render can opt in to OS roots with Node's `NODE_USE_SYSTEM_CA=1` if needed. node-postgres enables SCRAM channel binding when the server offers it. The driver does not require it even when the provider URI includes `channel_binding=require`. Strict TLS always verifies the server certificate and hostname. After restoring and verifying the final snapshot, retain `DATABASE_SSL=verify-full`, remove Supabase-only CA settings from the deployed Neon configuration, and require `/ready` in maintenance before the first writable Neon boot.

[Render secret files and deployment options](https://render.com/docs/configure-environment-variables#secret-files)

## Supabase to Neon during an approved maintenance window

1. Verify the candidate rehearsal, the current source's availability, the Neon quota headroom, the release revision, and access to both provider dashboards. Record secure checkpoints for initialized payment references, open provider submissions and uncertain outcomes. Where an independent ingress gate exists, stop new checkout admission and allow existing handlers and provider calls to finish. Otherwise the maintenance rollout and verified old-instance shutdown below establish the admission freeze. Paystack delivery relies on the existing authenticated callbacks and reconciliation. Check its retry and verification facilities for the planned outage. Preserve each recent payable reference. Do not rely on the provider repeating every kind of webhook.
2. Put the Render API into maintenance with `DATABASE_MAINTENANCE=true` and `DATABASE_EXPECTED_NAME=postgres`, keeping its URL on Supabase. The guarded runtime requires a matching database name, verified TLS and a URL explicitly configured with `sslmode=verify-full`. Complete the Supabase CA and driver verification above before the window. Deploy only the approved revision. The maintenance process serves `/health` and `/ready`, and responds with 503 to app calls, including webhooks. It skips schema initialization, admin bootstrap, and all background jobs.
3. Wait for Render to show the old deployment is deactivated, including any connection draining or SIGTERM grace period. Check that the old source connections, jobs and in-flight provider or financial work have ended and that every other writer is frozen. The new maintenance HTTP response alone does not prove the old worker stopped. Confirm any remaining provider ambiguity can be reconciled without a dispatch retry. If the source is restricted before a current recoverable snapshot exists, keep checkout closed and recover the missing authoritative state before a switch.
4. While all writers are stopped, take a **fresh** full snapshot into another empty, verified ICU Neon database after reviewing its exact destination pin. Run the independent parity command against the frozen source and destination. Compare secure pending payment and supplier reference checkpoints with the provider dashboards. Keep the earlier backup and preserve the source.
5. Keep Render in maintenance and change its only database URL to the **verified Neon candidate database**, changing `DATABASE_EXPECTED_NAME` to that exact name in the same update. A five-connection pool is sufficient to start the test. For the app, use the verified pooled URL when its path and database are supported. Use the direct application URL with the same TLS verification if required. Confirm one maintenance instance is live. Probe `/ready` once and check that maintenance requests receive 503. Reconfirm Neon connectivity, role, locale, restored snapshot and sufficient quota. `/ready` checks database identity, restored account and paid data, core schema/RLS and writable mode. Full parity remains a separate gate.
6. Only after the authorized operator accepts these checks, decide to reopen the API and remove `DATABASE_MAINTENANCE`. Keep `DATABASE_EXPECTED_NAME`. The startup gate checks the restored database before normal initialization. Treat the first **normal startup** on Neon as the transfer of authority. Startup and recovery can write before the first customer request. Confirm login, read-only tracking, Admin summaries and background worker health promptly. Reconcile preserved Paystack references with current provider truth and existing idempotency protections. Never replay raw unsigned payloads or resubmit an uncertain supplier order.
7. Keep the old Supabase database isolated from application writes. Record snapshot and authority-transfer times, release revision, and a secured backup location. A URL-only rollback is safe only before any Neon write, including startup and maintenance operator writes. After that point, suspend checkout and perform the verified reverse procedure.

## Neon to Supabase after the allowance resets

1. Confirm the reset, Supabase availability and headroom independently on or after December 8. Validate the direct connection and the exact runtime pool or direct connection to a new, distinctly named `mysteryhub_return_*` database. The live Supabase owner reported `CREATEDB` during inspection. Recheck that an isolated destination and runtime route are supported before reserving the window. Use UTF-8, ICU `en-US` and the intended backend owner. Preserve the old Supabase `postgres` database and the authoritative Neon database.
2. Repeat maintenance and writer-drain checks on Neon. Reconcile in-flight operations and hold uncertain submissions. Swap the script's source and destination inputs, with the direct Neon source and the new direct Supabase return database. Take a new complete archive from the frozen Neon writer. Restore and run parity. The tool refuses reverse restores into the original `postgres` database.
3. Validate constraints, sequences, Wallet, references, open holds, and the isolated Supabase role and TLS path. Restore the Supabase CA setting for a Session Pooler return and run the read-only app-driver probe against the exact return database before switching. In maintenance, point the one Render service at the verified return database and set its expected name. After `/ready`, reconciliation, and the operator's authorized reopening decision, start the single writer there. Preserve protected recovery copies on both sides. Keep checkout closed if verification or provider recovery fails. There is no scheduled move on December 8.

[Paystack webhook delivery behavior](https://paystack.com/docs/payments/webhooks/)

## Free-plan risk and follow-through

Official Neon documentation lists 1 GB storage per project, 100 CU-hours per project per month, 5 GB public network transfer, and a fixed five-minute inactivity suspension on Free. The standby compute reports a fixed 0.25 CU. At that size, 100 CU-hours buys 400 continuously active hours. November 23 to December 8 is roughly 360 hours or 90 CU-hours if charged to one allowance period. Earlier activation, prior usage or more compute can consume the remaining margin. Existing SMS and push schedules and three-minute reconciliation may prevent idle suspension during operation. Use the Neon console's actual allowance period and consumption. The provider's published cold wake is usually a few hundred milliseconds. Check Frankfurt-to-London latency and connectivity under comparable traffic before promotion. The candidate reports 112 PostgreSQL connections with four reserved. The existing backend pool remains capped at five connections per instance. Check the exact endpoint's limits again before activation.

At 300–400 MB/day, a 15-day window consumes 4.5–6 GB before transfer overhead and can exceed Neon's network allowance. Supabase and Neon meters are different. Monitor both on complete UTC days at similar load. November 21's partial Supabase reading cannot establish a full-day rate. PR #138 is already deployed and the true billed reduction is pending. The next full days support a comparison against November 17–20. After returning, aim for 100–120 MB/day, leaving room below the 161–167 MB/day mathematical allowance. Keep the service on Free and retain a protected recovery archive outside both providers. If either provider becomes unavailable before an authoritative verified copy exists, preserve the data and keep checkout in maintenance.

Arkesel automatic HTTP 422 troubleshooting remains a separate provider investigation. This release changes no SMS template, recipient, supplier routing, payment rules, Wallet behavior or automatic send settings.

[Neon plans and allowances](https://neon.com/docs/introduction/plans) · [Neon compute suspension](https://neon.com/docs/introduction/scale-to-zero) · [PR #138 audit](database-egress-p0.md)

[Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres) · [Supabase IPv4 backup procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
