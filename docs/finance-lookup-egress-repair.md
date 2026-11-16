# Targeted finance lookup egress repair

Base main: `1be54e00867fde327e15e646b0cdcbfdd27167bf`.
This PR requires founder approval before merge or deployment.

## Scope and semantics

`FinanceTx.find(key)` previously downloaded an owner's entire operation history
and searched it in JavaScript. PostgreSQL now receives exactly:

```sql
SELECT * FROM finance_operations WHERE user_id=$1 AND idempotency_key=$2 LIMIT 1
```

Both values are bound parameters on the existing transaction client. A matching
row passes through the existing `normalizeOperation`; no match remains
`undefined`. The memory branch retains its original lookup and object behavior.
The existing `UNIQUE(user_id,idempotency_key)` supports this query and ensures
there is no ordering ambiguity. No index, migration, cache, lock or transaction
change is required. Database errors still propagate to the caller for rollback.

No payment, supplier, pricing, notification, reconciliation interval, recovery
selection, settlement or financial state-transition behavior is changed.
Three existing SQL fakes now implement the additional bound predicate instead
of incorrectly returning all owner rows for a single-key request.

## Expected impact, not a measured production result

The preceding read-only audit observed 50 full-history lookups returning 4097
finance rows per recovery pass. Its aggregate JSON-equivalent estimate was
3468362 bytes, versus 46221 bytes for the 50 required rows: roughly 98.7% less
finance-result content for that sampled workload. PostgreSQL wire encoding,
other queries and subsequent traffic differ; this is not a promised reduction
in total Supabase billed egress. This PR has not been deployed or measured live.

## Verification and security review

Focused tests verify bound parameters, row normalization, zero amounts, payloads,
dates, missing keys, same keys owned by different users, foreign-only keys,
unchanged memory state/object identity and propagated database failures.
Repeated create-or-find flows retain one credit, operation and ledger entry.

The optional native test uses a guarded empty loopback `*_test` database and
the existing finance schema inside a rolled-back transaction. It checks SQL
parity, user isolation, repeated financial effects and an EXPLAIN plan using
the existing owner/key index. CI runs it on its isolated PostgreSQL17 service.
No hosted database, external payment service or production fixture is used.

Review conclusion: the only application change is a scoped SELECT, using the
same client and normalization. No new authorization or mutation path exists.
Existing transaction/advisory locks and idempotency constraints remain intact.
This is an implementation self-review, not a separate human review.

## Post-approval measurement plan

After explicit merge/deployment approval, confirm the deployed SHA, then take
two bounded read-only `pg_stat_statements` snapshots over comparable windows
covering several three-minute recovery passes. Do not reset statistics.
Compare deltas for the old owner-history query and the new owner/key query:

- New lookup rows must be no greater than calls.
- Recovery should no longer add the old approximately 50 history calls per pass.
- Other legitimate `operations()` callers still use history queries; zero total
  history traffic is not an acceptance requirement.
- Compare Supabase daily Shared Pooler Egress before/after, accounting for traffic
  and deployments. Avoid assigning all changes to this one optimization.

Preserve payment/recovery outcomes and monitor errors; no live purchases are
needed for measurement. Rollback is a normal code revert, without data repair.

## Separate follow-up work, intentionally excluded

- Recovery selection repeatedly includes delivered, available store sales.
- Some development/browser scripts need stronger database destination guards.
- Finance summaries repeatedly retrieve full histories before display slicing.
- Idle polling and other database queries can be reviewed independently.
