# Multi-supplier routing foundation V1

## Audit and scope

Started from main `12c05f5ba4c1b60628f503758cee5afd99b15b21` (2026-11-10).
The generic `SupplierProvider` interface existed, but production telecom preflight,
dispatch and status lookup used the concrete Success Biz Hub provider. Submission
saves overwrote supplier identity; the SBH webhook matched references without a
provider namespace. Existing order fields already support a supplier snapshot.
No new database table, migration, startup initialization, environment variable,
activation switch or draft persistence is needed for this release.

Reused: existing provider methods and catalog resolver, retail pricing, payment
verification, atomic dispatch claims, MTN duplicate protection, uncertain
submission handling, reconciliation, service readiness, Admin authorization and
shared Admin UI. PRs #69 and #104 and the seasonal frontend are untouched.

## Decisions and execution

`SupplierRegistry` stores immutable registration metadata independently of the
provider implementation: implemented services/networks, planned services,
configuration presence, qualification, and permission to accept new orders.
Duplicate/mismatched identities fail. There is no mutable global active supplier.

The immutable default route matrix maps Standard Data, Airtime and Instant Bundles
on MTN, Telecel and AirtelTigo to `success_biz_hub`. It is routing configuration,
not a claim of current supplier key authorization, stock or product availability.
The existing service-specific preflight/catalog checks remain mandatory. Product
IDs and costs continue to come from server-authoritative catalogues. The pure
resolver supports explicit product-specific mappings and rejects missing or
ambiguous mappings; no client payload can supply routing configuration.

TELCOGH is registered with no executable provider, no qualified networks or
implemented services, and no new-order permission. Data/Airtime are planned only.
Even a proposed TELCOGH route fails closed. It has no credentials, HTTP adapter,
webhook, activation endpoint or supplier traffic in this release.

New direct Data (Paystack/Wallet), Airtime, Instant, managed-store and assisted
orders resolve server-owned routing before payment and persist
`supplier_provider`. Data/Airtime select before their existing preflight. Instant
first reads its SBH catalogue to establish the actual package/network, then
validates the matching SBH route before payment; it cannot select another adapter. There is no request-time editable route source. Payment
confirmation does not resolve a new default. Dispatch, customer/Admin/scheduled
refresh and Admin recovery validate the original order namespace. Unsupported or
inactive identities are held for review without switching providers; forced
status lookup returns a safe error. Submission and uncertainty writes preserve
the original provider, including null legacy values, with SQL compare guards.

New regular Data checkouts also save the resolved offer reference/cost in the
existing columns. A mismatch before POST holds the paid order for review with an
operational explanation, without submission or an automatic refund. Rows lacking
an offer snapshot retain the established checks. Assisted authorizations and
managed-store economic checks remain in place. Instant packages keep their own
supplier package IDs and Airtime keeps its existing face-value contract.

The concrete SBH compatibility bridge is deliberate: the generic interface does
not represent beneficiary eligibility or Instant/Flexi contracts. Future adapters
must implement and qualify equivalent service-specific preflight, dispatch and
status capabilities before any routing activation is designed. Registering a
generic provider alone cannot activate it or bypass those checks. No failover or
retry system is implemented.

## Legacy orders and webhook namespaces

An explicit provider is authoritative. Unknown, empty, inactive or manual-provider
identities never become SBH. Null historical telecom rows on the three known
networks are interpreted as SBH because all historical telecom execution used SBH.
Legacy `airtime-` and `instant-` product prefixes retain their existing meaning.
No historical identities are rewritten or backfilled.

AFA and Results Checkers retain dedicated integrations, with SBH identity checks
at the fulfillment entry point. Marketplace/manual routes remain separate.
Authenticated SBH webhook lookup matches only explicit SBH or the documented null
legacy namespace, locks at most two matches and rejects ambiguity. A reference
collision with another provider cannot update that provider's order. Signature
verification, current event IDs, deduplication and transaction boundaries remain
unchanged. A future TELCOGH callback must independently qualify authentication,
event namespaces and status transitions; none is supplied here.

## Admin integration

`GET /api/admin/commercial/supplier-routing` uses existing `requireAdmin` and
`Cache-Control: no-store`. It returns bounded configuration metadata and the nine
effective routes, without secrets, costs, account identity or customer records.
The Supplier Routing panel is in the existing Commercial section. Refresh is a
configuration read with no supplier requests, polling or side effects. Loading,
failed/malformed response, session changes and stale requests are handled.

There are no mutation endpoints, so no draft is represented as durable and no
new audit event is needed. Existing administrative order actions retain their
audits. Persistent drafts and any future activation mechanism require separately
authorized design, concurrency control, auditing and schema installation.

## Verification and operation

Run `npm test`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`.
Focused tests include registry validation, all nine defaults, missing capability,
disabled/unconfigured providers, product mappings, legacy lookup, wrong-provider
dispatch/status rejection, duplicate paid signals, snapshot mismatch holds,
webhook isolation, and Admin authorization. Checkout tests assert actual durable
provider/offer/cost snapshots and temporary-unavailable/recovery semantics.

For native database tests, create an empty loopback database ending `_test`, owned
by a non-superuser/non-BYPASSRLS application role with the existing test API roles:

```sh
env -u DATABASE_URL NODE_ENV=test \
  MYSTERY_ROUTING_POSTGRES_URL=postgresql://app_owner:LOCAL_TEST_PASSWORD@127.0.0.1:5432/mystery_routing_test \
  node --import tsx --test server/suppliers/__tests__/supplierRoutingPostgres.test.ts
```

The test refuses external application databases, installs the existing schema
only in that disposable database and verifies concurrent persistence, namespace
lookup, webhook rollback and unchanged ledger counts. CI runs the same test.
`python scripts/reviewSupplierRouting.py` tests the actual component with a
synthetic API at 360px, 390px and desktop after a production build. It makes no
external requests and saves screenshots to `/tmp/supplier-routing-browser`.

Rollback is the normal application-code revert. There is no schema rollback,
provider reassignment or data backfill. Existing SBH identity and optional offer
columns remain readable by the preceding release.

## Qualification gates and deferred findings

Before TELCOGH PR2: obtain verified product/submission/status schemas, recipient
and product semantics, reference/idempotency support, ambiguous-acceptance
recovery, authenticated callbacks, low-wallet/key-revocation behavior, and status
transitions. No inference from website prices qualifies an API contract. Require
synthetic and isolated integration tests plus separate live-routing authorization.

Baseline limitation found during review: direct telecom orders have narrower
pre-POST durable uncertainty marking than assisted/store orders. A process crash,
missing response identifier or certain non-timeout errors requires a separately
scoped financial-execution safety review. This foundation adds no automatic
retries, failover or refunds, and preserves claims that prevent routine duplicate
dispatch. It does not claim to repair those pre-existing acceptance windows or
the supplier-contract issues held in PR #69.
