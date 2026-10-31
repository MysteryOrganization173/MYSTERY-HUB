# Backend-only RLS hardening — 31 October 2026

## Verified production baseline

Source: current Supabase catalogs/security advisor for project `fcvydpuuwbciuulrvizk`,
and remote main `dc54288c7f363dbabbdc9524d3f6a18c0bc0c5ed`. Both Render services
were live on that revision before this change. PR #69 is unrelated and untouched.

There are 45 application tables: 34 in public, ten in mysteryhub_notifications and
one in mysteryhub_builder_private. Exactly 23 public tables lack RLS:

| Tables | Original table grants (same for every listed table) |
| --- | --- |
| admin_audit_log, afa_registrations | postgres: ALL; anon/authenticated/service_role: TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |
| finance_accounts, finance_config, finance_ledger, finance_operations | same |
| marketplace_categories, marketplace_inquiries, marketplace_products | same |
| referral_attributions, referral_clicks, referral_profile_suspensions, referral_profiles, referral_reward_rules, referral_reward_suppressions | same |
| reward_ledger, sessions, supplier_webhook_events, users, waitlist | same |
| website_assets, website_sites, website_ultra_enquiries | same |

All are owned by postgres, have no policies and no FORCE RLS. There are no explicit
column ACLs or public sequence grants to anon/authenticated. Neither client role
has SELECT/INSERT/UPDATE/DELETE, nor inherits another role. Public schema grants
USAGE but not CREATE to these roles. No active data leak was demonstrated.
Residual TRUNCATE grants are unsafe defense in depth: RLS does not cover TRUNCATE.
The already RLS-enabled orders table has the same residual grants and is included.

The pre-release advisor tool returned 22 no-policy INFO findings and nine function
search-path warnings; it did not list the disabled-RLS findings in that response.
The count of 23 is independently confirmed from pg_class, not inferred from the
advisor. Post-release catalog checks remain necessary even if advisor output lags.

The 22 existing no-policy INFO findings are intentional backend-only isolation,
including private notification/checkpoint tables. They must not be silenced with
permissive policies. After the 23 additions, expect 45 no-policy INFO findings.

## Access model and compatibility evidence

The browser calls Express APIs; source has no Supabase client or service-role key.
Custom users/sessions and bearer-token middleware enforce account/admin identity.
Database stores use the single pg Pool in connection.ts; there is no application
SET ROLE or JWT-based database identity switch. Website and referral stores apply
ownership predicates; financial operations use transactions and advisory locks.

Current production postgres is NOSUPERUSER, BYPASSRLS and owns all application
tables. Active Supavisor sessions use postgres. pg_stat_statements records the
application's users/sessions/orders/wallet/webhook query patterns only as postgres
(28 matching statements, 5,927 calls at inspection). This is operational evidence
in addition to the historical connection audit; MCP current_user alone would not
establish the backend role.

The migration checks the actual startup role's effective table ownership and
rejects FORCE RLS before changing each table. Native PostgreSQL 17 tests use a
stricter NOSUPERUSER, NOBYPASSRLS table owner, not a superuser. Owner access works
without a policy when FORCE RLS is absent. No new role, grant or bypass is needed
in production. Existing service_role grants are preserved; BYPASSRLS by itself
does not confer missing SQL table privileges.

## Migration and recurrence prevention

This repository runs repeatable schema modules from initDatabase, not Supabase
CLI migrations (the production Supabase migration registry was empty). The new
BACKEND_RLS_SCHEMA runs after all tables are created, through the actual backend
connection. The canonical schema.sql contains the identical statement. Three
existing table definitions missing from that mirror are included so standalone
schema initialization also works; runtime definitions are unchanged.

The single atomic DO statement enables RLS on the 23 tables plus orders, revokes
all table privileges from PUBLIC/anon/authenticated, and removes this owner's
public-schema default table grants to those clients. It changes no policies,
owners, financial rows, credentials, triggers, functions, supplier code or UI.
It never enables FORCE RLS. Lock acquisition is bounded to five seconds per lock;
a failure rolls back the entire hardening statement.

Render currently auto-deploys main and runs npm run start. After verification and
merge, that first successful backend startup is the authorized production
migration workflow. Do not also apply a second manual migration through the SQL
editor or Supabase MCP. Later startup rechecks are deliberately idempotent.

The Database security GitHub Actions workflow runs the real isolated PostgreSQL
test on PRs/main. It fails if a new application table lacks RLS, gains a policy
unexpectedly, enables FORCE RLS, or exposes clients. This does not install a
database-wide event trigger or modify platform schemas/defaults for other owners.

## Validation

Unchanged main: 2,737 passed, 33 skipped, zero failed. The new native regression
fails on unchanged main because initialization leaves 24 tables without RLS
(the production-only orders flag explains the difference from 23).

Native hardening tests exercise 450 denied statements (two API roles × 45 tables
× SELECT/INSERT/UPDATE/DELETE/TRUNCATE), accidental restored CRUD grants under
RLS, synthetic password/session/admin lookup, order creation/payment persistence,
ten concurrent dispatch claims, webhook event deduplication, notification trigger,
Wallet idempotency/immutable journal, referrals and Builder/Marketplace stores.
They also prove repeat initialization preserves rows/triggers/trusted grants,
new-table defaults stay restricted, and an incompatible FORCE flag causes atomic
rollback. Payment verification, webhook signatures, supplier POST safety and
authorization remain covered by the existing mock regression suites; no live
payment or supplier submission is part of validation.

Executed locally: native hardening 10/10, existing V5.1 Builder 7/7 and Marketplace
V2 6/6, no skips in those runs. Full regression: 2,738 passed, 34 skipped, zero
failed. The opt-in native hardening test is one of the default-run skips and was
executed separately. TypeScript, production build and diff whitespace checks pass.
Separate adversarial self-review found and corrected a standalone schema-mirror
dependency and updated the non-owner Marketplace read expectation to zero rows.
No second-person review is claimed.

Local invocation requires an empty loopback database ending in _test, owned by a
non-superuser without BYPASSRLS, with anon/authenticated/service_role roles present
and anon/authenticated membership granted to the owner for SET ROLE tests:

```sh
MYSTERY_RLS_POSTGRES_URL=postgresql://app_owner:local-owner-only@127.0.0.1:5432/mystery_rls_test node --import tsx --test server/suppliers/__tests__/backendRlsPostgres.test.ts
npx tsc --noEmit
npm run build
npm test
git diff --check
```

The example password is exclusively for a disposable local database. The checked
in CI workflow provisions this environment without production credentials.

## Production verification and recovery

Before merging: inspect the full diff, checks, current main and role/owner/grant
state. After rollout: require the intended merge SHA on Render, successful schema
initialization, HTTP health/public DB-backed catalogue reads, no new permission
errors, and fresh catalog/advisor results: zero public tables without RLS, no
anon/authenticated table or column privileges, no FORCE RLS, unchanged owners and
trusted grants. Do not infer that supplier purchases work from these checks.

Recovery: a lock/ownership failure aborts the atomic security statement and the
new startup; investigate before retrying. Render retains the prior healthy
instance during a failed rollout. Once applied, the previous application version
remains compatible with owner access, so a code rollback need not undo RLS.
If a legitimate backend role differs unexpectedly, establish its identity and
required privileges first, then propose a narrowly scoped role-specific repair.
Never blanket-disable RLS or restore client TRUNCATE/CRUD grants as recovery.
There are no data rewrites to reverse and no financial restoration is required.

## Separate function hardening backlog

The nine mutable-search-path functions are all SECURITY INVOKER, not DEFINER:
public.finance_ledger_immutable, admin_operations_immutable,
mystery_commercial_snapshot_guard, store_snapshot_immutable,
mystery_canonical_phone, mystery_phone_identity_guard, order_management_immutable;
mysteryhub_notifications.snapshot_template and capture_order_event.
Eight return trigger; mystery_canonical_phone returns text. No privilege escalation
was established. Pinning search paths requires a separate schema-qualified,
trigger-tested change; their bodies/ACLs are deliberately unchanged here.

Advisor references: [RLS disabled](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public),
[intentional no-policy RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[function search paths](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
