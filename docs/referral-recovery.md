# Referral tracking and historical recovery

`clicksCount` remains an alias of `rawClicksCount`: successfully stored capture events,
after browser session deduplication, persisted retry-key deduplication and a 60-second
visitor/code suppression window. `uniqueVisitorsCount` counts distinct stable,
nonempty visitor keys; null and `vk_transient_` keys are excluded. This identifies
browsers, not verified people. Clearing storage or using multiple devices changes identity.

Capture returns independent `valid`, `clickRecorded` and `attributionRecorded` facts.
`success` means the request was evaluated, not that all writes succeeded. Only
`clickRecorded` permits the frontend click marker. Attribution failures are separately
retryable. Unique visitors and clicks do not create rewards.

Historical recovery is a CLI operation, with dry-run as the default. Supply the
intended database's `DATABASE_URL` and existing `DATABASE_SSL` setting securely.
Do not put credentials in commands or reports.

```powershell
npx tsx server/scripts/reconcileReferrals.ts
```

Review the JSON report before applying:

```powershell
npx tsx server/scripts/reconcileReferrals.ts --apply
```

No production recovery is run as part of this development pass. Take a database
backup and use a maintenance window for apply: it holds table locks and scans the
persisted history in one transaction. A database conflict aborts the whole run.
Dry-run is a read-only consistent snapshot; apply recomputes the plan under locks.

Relationships can be restored from authenticated orders with persisted referral
fields, explicitly linked attribution records, direct order ledger records, or
persisted `referral_bound`/`reward_approved` audit evidence.
All user/profile identities must agree; conflicting, self or circular links are
reported for review. Existing canonical first-touch relationships are preserved.
Only a direct relationship is restored; unproven historical level-2/3 lineage is
left null. Re-running is safe, and repairs produce audit records.

Rewards are restored only when exactly one persisted `reward_approved` audit
record proves the original order, referrer, service, amount and approval time,
the order remains delivered/completed and paid, and no ledger or reversal exists.
The original ledger ID is restored. Missing or conflicting approval evidence is
reported, not calculated from today's rules. Existing rules/products are mutable;
date ranges alone do not prove their previous amounts or precedence. Orders lack
reward snapshots. Existing ledger rows, including reversed/rejected rows, prevent
automatic replacement. Both live creation and recovery prevent another direct
reward for the same order even if rule values or idempotency keys change.

Stored clicks remain usable. Attribution evidence can restore a relationship
without proving a click. Clicks that never reached storage are unrecoverable:
the script contains no click inserts, and cannot estimate their missing count.
Phone numbers, email addresses and network/IP addresses are not used to infer
historical relationships or unique visitors. Reports contain internal identifiers;
keep them restricted to authorized operators.

Schema initialization adds nullable `referral_clicks.capture_key`, its unique
index, and an index for visitor suppression queries. Existing rows are untouched.
Deploy this schema update before serving the new capture code.
