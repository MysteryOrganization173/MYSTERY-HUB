# Mystery Earn reward economics — Pass #3

## Scope and accounting

Only direct (level 1) rewards are issued. Existing multi-level columns are retained, and the admin endpoint rejects attempts to configure them in this pass. No wallet, withdrawals, achievements, leaderboard or historical reward recalculation is introduced.

A qualifying order has `payment_status=success`, `status=delivered`, currency GHS, and additionally `marketplace_status=completed` for Marketplace. A paid timestamp alone does not qualify. Unpaid, failed, cancelled, refunded and other nonterminal orders cannot consume acquisition before a reward.

Stages are scoped to the authentic referral relationship **and service type**. A Marketplace, Airtime or Instant Bundle order does not consume the first standard Data purchase. Prefer a real canonical `referral_attribution_id`; a guest upgraded at signup keeps that identity. An authenticated order with a persisted direct referrer can fall back to its user ID. Email and phone are never used for identity. Guests lacking a real attribution can only match legacy `any` rules.

Acquisition is the first qualifying purchase in this scope. Earlier paid/delivered qualifying order history, existing standard rewards, or an existing acquisition reward make later purchases recurring. Earlier order history is ordered by delivered timestamp (updated/created timestamp fallback), then order ID. This ordering lets several already-delivered orders process newest first while retaining acquisition eligibility for the earliest. A recurring ledger entry alone is not proof the earliest order has received its acquisition reward. Historical orders without rewards still count as qualifying history; no backfill is performed by this pass.

A previously awarded acquisition remains consumed even if reversed. Its original amount, stage, relationship key, and rule snapshot remain auditable. Future orders stay recurring; old recurring rewards are never promoted or recalculated. Repeating an already rewarded order returns its existing direct ledger entry, even after rule edits or reversal.

## PostgreSQL protection

The reward transaction takes the existing reward-ledger table lock (cooperating with historical recovery), a transaction advisory lock for the relationship/service, and the existing order reward advisory lock. It rereads the persisted order `FOR UPDATE`, rechecks qualification and identity, reads history and rules, and inserts the ledger within the same transaction. Commit precedes audit logging. Insert failures roll back the transaction.

A partial unique index on `(reward_relationship_key, service_type)` for direct acquisition entries prevents a second acquisition insert, including after reversal. In-memory development uses keyed promise serialization; it is not production persistence.

## Rule precedence and time

Only enabled rules whose date window includes the order's delivery time are eligible. Bounds are inclusive. Missing delivery timestamps use current time. Within eligible matching scopes:

1. Product-specific before global product.
2. Network-specific before global network.
3. Exact service before `all`.
4. Explicit acquisition/recurring before equivalent `any`.
5. Newest `created_at`, then ascending rule ID.

Product/network overrides retain priority even if their stage is `any`. Marketplace's positive product `referral_reward_minor` continues to win over reward rules. Standard Data configuration never falls back into other service types.

## Schema and deployment

The existing `initDatabase()` migration path adds:

- `referral_reward_rules.purchase_stage`: any/acquisition/recurring, NOT NULL, default any, CHECK constraint.
- `reward_ledger.reward_stage`: standard/acquisition/recurring, NOT NULL, default standard, CHECK constraint.
- `reward_ledger.reward_relationship_key`: nullable VARCHAR(256).
- `idx_reward_acquisition_relationship`: unique partial index described above.

Existing rule amounts remain unchanged and default to any. Existing ledger amounts/statuses/metadata remain unchanged and classify as standard. No attribution or reward reconciliation runs automatically.

Deploy schema before using the stage-aware paths; verify the columns, constraints and unique index exist. Coordinate backend rollout before activating staged rules, so legacy writers do not bypass relationship locking. Existing startup migrations log some failures rather than universally aborting: successful application must be verified. No production database or environment variable was changed during development.

The policy is prepared in `server/config/dataReferralRewardPolicy.ts`:

- `standard_data_acquisition_v1`: data, acquisition, fixed 50 pesewas.
- `standard_data_recurring_v1`: data, recurring, fixed 10 pesewas.

It is **not seeded on startup** and no fulfilment code contains these amounts. Inspect existing product/network overrides before explicit activation. Deployment uses the already-installed tsx runtime:

```powershell
npx tsx server/scripts/configureDataReferralPolicy.ts
# After schema verification and configuration review, on the target environment:
npx tsx server/scripts/configureDataReferralPolicy.ts --apply
```

Default mode is a dry run with no database writes. Apply requires DATABASE_URL and creates only missing policy IDs with the activation time as `starts_at`; existing IDs are preserved so an operator's later edits are not overwritten. It does not modify existing rules or run historical recovery. If interrupted between the two saves, inspect the rules before retrying; the preserved-ID behavior supports recovery. No new environment variables are required. The admin API is an alternative for creating or editing these rules explicitly.

## Admin and customer contract

POST `/api/admin/referrals/rules` merges updates with the existing rule, validates on the server and returns HTTP 400 for invalid configuration. Stages, service/network/product scopes, fixed nonnegative integer pesewas, percent integer basis points from 0 through 10000, boolean enabled state, ISO timezone timestamps and increasing date ranges are checked. Contradictory fixed/percent fields are rejected. To switch reward type, explicitly clear the other amount field with null. Client creation/update timestamps are ignored. Existing dormant multi-level fields survive edits.

The save response contains fixed-reward charge warnings and warnings for overlapping equivalent enabled scopes/windows. No supplier-cost calculation is introduced. At fulfilment, a configured reward above the order charge is rejected with a visible server warning; no reduced payout or silent configuration change occurs. A paid/delivered order can still form qualifying history even if its payout is blocked by an invalid economic configuration; correcting rules does not rewrite earlier ledger entries.

GET `/api/referrals/rules` returns only currently active public rule fields, including purchase_stage, without internal multi-level configuration. Mystery Earn's two existing rule lists use these values for first/repeat/any purchase copy. Amounts remain server-provided. Product/network labels and a precedence note clarify overrides. Public ledger items expose reward_stage without exposing relationship IDs.

## Validation

New suites: `rewardEconomics.test.ts` (30 scenarios) and `rewardEconomicsDatabase.test.ts` (4 database-path scenarios). They cover the requested 20 cases plus newest-first concurrency, guest-to-user continuity, absence of phone/email matching, prior qualifying history, service isolation, percentage calculation, margin rejection, deterministic ties and preservation of dormant fields. Database-path tests exercise transactions, advisory locking, persisted-order rechecks, rollback and stage snapshots using a mocked pg driver. A live PostgreSQL concurrency/migration check remains a deployment verification requirement.

All selected regression suites passed: productionIntegrity (25), productionIntegrityDatabase (4), referralTrackingTruth (22), referralTrackingFrontend (9), referralTrackingDatabase (3), referralRecoveryDatabase (3), mysteryEarnV1 (12), mysteryEarnFrontendContract (5), marketplaceV1 (8), successBizHub (19), airtimeFulfilment (7), instantBundlesIntegration (7). Together with the new suites: 158 tests/scenarios.

`npm run lint` and `git diff --check` pass. `npm run build` was attempted but failed while loading Vite configuration with the known sandbox `spawn EPERM` and native Tailwind oxide dependency errors. Vite configuration was not changed. Manual Windows production build verification is still required for Pass #3.
