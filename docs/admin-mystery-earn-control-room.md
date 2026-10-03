# Admin Mystery Earn control room

Review branch: `feat/admin-mystery-earn-control-room`, based on main commit
`3cb4d099d2b4f553a58aa4cae2c703f12540c2d8`. This pass adds operational
inspection and explicit admin controls. It does not activate any reward policy.

## Files

New backend:
- `server/types/adminEarn.ts`: explicit response contracts.
- `server/services/adminEarnQuery.ts`: strict UTC period/filter/pagination parsing.
- `server/db/adminEarnStore.ts`: independent SQL aggregates, paginated inspection,
  and development-memory equivalents.
- `server/services/adminEarnControls.ts`: rule validation, confirmation, policy
  status, safe descriptions, transactional audits.
- `server/routes/adminEarnApi.ts`: authenticated admin endpoints.

Modified backend:
- `server/db/connection.ts`: suspension history and durable skipped-reward tables.
- `server/db/referralStore.ts`: suspension transactions and capture/binding/reward
  guards, transactional rule helpers, internal development snapshots.
- `server/db/adminAuditStore.ts`: optional transaction client; audit failures abort
  the enclosing admin mutation.
- `server/db/authStore.ts`, `server/db/ordersStore.ts`: internal development-only
  enumeration helpers, never serialized by the API.
- `server/services/referralService.ts`: reward suspension enforcement, including
  lifetime attribution, and preservation of suspended guest first touch.
- `server/routes/adminApi.ts`: router integration, rule controls, customer summary.

Frontend:
- New `src/components/admin/sections/AdminMysteryEarnSection.tsx`,
  `AdminEarnRules.tsx`, `AdminEarnUi.tsx`, `AdminEarnPulse.tsx`.
- Modified `src/components/admin/AdminPage.tsx`,
  `src/components/admin/sections/AdminCustomersSection.tsx`,
  `src/components/admin/sections/AdminOverviewSection.tsx`,
  `src/services/apiClient.ts`.

New tests:
- `server/suppliers/__tests__/adminEarnControlRoom.test.ts`.
- `server/suppliers/__tests__/adminEarnApi.test.ts`.
- `server/suppliers/__tests__/adminEarnDatabase.test.ts`.

## API

All endpoints use existing bearer-session admin authentication. Customer tokens
receive 403; missing sessions receive 401. Query values are strictly validated;
invalid filters receive 400. Unexpected failures return a generic safe error.

New endpoints under `/api/admin/referrals`:
- `GET /overview`: lifetime profile counts and selected-period metrics.
- `GET /leaderboard`: search, safe sort, exclusions, ranked page and total.
- `GET /referrers/:id`: scoped metrics, recent ledger and paginated customers.
- `GET /ledger`: read-only paginated ledger inspection.
- `GET /policy`: read-only recommended policy comparison.
- `PATCH /referrers/:id/status`: `{enabled: boolean, confirm: true}`.

Existing endpoints enhanced:
- `GET /rules`: safe rules, effective status and server warnings.
- `POST /rules`: existing server validation, atomic audits; every enabled save
  requires `confirmEnable: true`, including edits to active rules.
- `GET /api/admin/users/:id`: adds a compact safe `earn` summary, or null.

No policy apply endpoint or script execution is exposed. Review Policy opens the
normal editor. Missing recommendations default to disabled and remain unsaved
until an admin explicitly saves. Enabled changes require a second confirmation
showing service, scope, stage, value and activation dates.

## Metric definitions

All money is integer GHS minor units; SQL numeric results are checked for safe
integer representation. The client only formats amounts and displays server totals.

- Profile totals/enabled counts and relationship lifetime totals are lifetime.
- Raw capture events count persisted click rows by creation date; unique visitors
  count distinct stable visitor keys, excluding blanks/transient keys. These are
  stored capture events, not every possible browser click. Overview deduplicates
  keys across all profiles; individual profile visitor counts are not additive.
- People referred in the period count bound registered relationships by bound date.
- Qualifying conversions require successful payment, delivered status and GHS;
  Marketplace also requires completed status. Conversion dates use delivered time,
  falling back to updated/created time for historical records.
- First/repeat classification uses lifetime qualifying purchase history per direct
  relationship and service, before applying the selected period. It describes
  purchases, not whether a reward rule existed or issued a credit at that time.
- Converted relationships are distinct registered/attribution identities with a
  qualifying purchase in the period. Stable guest attributions are included;
  unidentified guest orders can contribute revenue/qualifying order counts without
  inventing an acquisition identity.
- Paid revenue uses paid time (created fallback) and current successful payment
  state; cancelled, refunded, refund-pending, failed and expired orders are excluded.
- Delivered revenue uses qualifying delivery time. These two revenue metrics may
  differ because payment and fulfilment can fall in different periods.
- Pending/approved/reversed reward totals use ledger creation date and current
  status, direct network level, GHS, and original entries only. Reversal companion
  rows are excluded to avoid double counting. Reward expense is current approved
  liability, not a withdrawal/payment metric. Changing status can change a prior
  period's displayed totals; this is not an immutable accounting snapshot.
- Estimated gross margin sums order charge minus recorded supplier cost only on
  qualifying orders with known cost. It does not deduct rewards. Cost-known order
  coverage is displayed; unknown cost is never assumed to be zero.
- Conversion rate is converted relationships / distinct visitors in the selected
  period, with zero for a zero denominator. This activity ratio may exceed 100%
  because historical relationships can buy during a period without new visits;
  it is explicitly not a cohort conversion funnel.

Referral ownership uses stored order ownership, matching lifetime attribution or
linked guest attribution. Self-referrals and conflicting owner/customer links are
excluded. Pre-attribution non-referred orders are excluded from referral history.
Independent traffic, relationship, order and reward aggregates prevent join fanout.

UTC today, 7-day and 30-day windows include today and end at server request time.
Custom dates are inclusive calendar dates, implemented with an exclusive next-day
end. All time has no date boundaries. Recent referred-customer lists and their
first/latest qualifying orders remain explicitly lifetime.

## Inspection and controls

Leaderboard search is literal, case-insensitive name/email/phone/code search.
Sort columns are allowlisted; deterministic ties use user ID. Default pages contain
20 rows; the server caps requests at 100. Empty/out-of-range pages retain total.
Detail uses a fixed number of bounded queries, not per-customer queries.

Giveaway Ranking enables disabled-account, suspended-profile and zero-conversion
exclusions, with configurable rankings. Copy shortlist copies the current page as
plain text after stripping control characters. It neither selects a random winner
nor awards prizes. There is no CSV export or bulk credit endpoint.

Ledger filters: current status, service, reward stage, referrer ID, period and
literal partial public order reference. Responses expose only identity, safe order
reference, stage/service, amount, status, reason and timestamps; no raw metadata,
credentials or mutation controls.

Referrer detail exposes safe identity, account/profile status, traffic, commerce,
reward totals, ten recent period ledger rows and paginated lifetime customers.
Customer profile and full ledger shortcuts preserve the existing admin views.
The Customer drawer shows lifetime code/status/visitors/people/approved rewards
without creating a referral profile; absent profiles display no activity.
Overview has a small 30-day pulse and lifetime enabled profile count.

Signals are informational: suspended profile; at least 100 raw capture events and
raw/unique ratio at least 10; at least 100 visitors with zero qualifying conversions.
No fraud decision or automatic suspension occurs.

## Suspension integrity and audits

Suspension retains the permanent code, attribution history and existing ledger.
New captures and new explicit bindings reject a disabled profile. Existing lifetime
relationships still resolve to their original owner, but new reward insertion is
blocked. A captured suspended guest first touch cannot be replaced by a competing
checkout code; cycle/self-referral binding failures do not receive that exception.

Every real status transition stores an interval and audit in one transaction.
Reward evaluation takes a shared profile row lock; status mutation takes an
exclusive row lock, serializing the decision against suspension. Existing ledger
entries return unchanged before suspension checks.

Resume allows future qualifying purchases only. Historical suspension intervals
block orders delivered while suspended, even if processed for the first time after
resume. Durable per-order suppression receipts also prevent retry backpay when an
older delivered order was first evaluated while the profile was suspended. Neither
resume nor editing a rule triggers reward recovery or historical credits.

Legacy disabled profiles without interval history use their known profile update
timestamp when resumed. Earlier undocumented suspension periods cannot be inferred.
Missing profiles remain compatible with legacy attributed orders; public capture
still requires a real enabled profile.

Rule created/changed/enabled/disabled and profile suspended/resumed actions use
AdminAuditStore with safe metadata. Production rule updates serialize through a
configuration advisory lock and commit alongside audits. An audit insert failure
rolls back the mutation. Repeated identical profile status requests are idempotent
and do not generate duplicate transition records. No recommended-policy-applied
audit is needed because applying is not implemented.

## Validation and deployment

New coverage: 46 scenarios (32 store/service, 7 HTTP/auth, 7 PostgreSQL-driver
transaction/query mocks), including ranking, period history, safe response shape,
rules, policies, cycles, Marketplace regressions and complete suspension behavior.
Selected existing Pass 1/2/3, frontend contract, database, Marketplace and supplier
regressions passed; 210 total selected tests/scenarios across the validation runs.
Affected suites were rerun after the final behavior changes. TypeScript/lint passed.
Desktop and 390px mobile previews were checked with an isolated seeded in-memory
backend, including navigation, totals, ranking, referrer/customer shortcuts and
disabled policy review. No production data was used.

`npm run build` was attempted and failed in this environment at Vite/native
dependency loading with native encoding/config-load and `spawn EPERM` errors.
Vite was not changed. A local Windows production build remains necessary for this
new pass; previous-pass build approvals do not validate this diff.

Schema initialization adds:
- `referral_profile_suspensions`: profile FK, start/end interval with end check.
- `referral_reward_suppressions`: user/order FKs, durable composite unique receipt.
- Open-interval unique index and history lookup index.

The repository's existing startup initializer creates these tables; no production
migration or policy script was run. Test schema initialization and the aggregate
queries against a real staging PostgreSQL database before deployment; driver mocks
do not establish live SQL execution or real lock concurrency. Verify both indexes
exist because the existing initializer logs index failures as warnings. Verify
database DDL permissions, query plans on realistic volumes and audit writes before
enabling the admin controls in production. No environment-variable additions or
changes are required; existing session/admin and DATABASE_URL configuration apply.

Deploy backend/schema support before the new frontend, perform staging admin and
non-admin endpoint checks plus suspend/resume/retry checks, and verify the current
reward rules remain unchanged. There is no automatic recommended-policy activation.
This pass is left uncommitted, unpushed and unmerged for review.
