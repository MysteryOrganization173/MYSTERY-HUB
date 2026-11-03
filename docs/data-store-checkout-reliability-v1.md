# Data Store checkout reliability V1

## Scope and starting state

Implemented in the isolated `fix/data-store-checkout-reliability-v1` branch from
main `84ec60482a8d5341e4538f4aa6e4fe8dd4482f56` (November 3, 2026).
Both Render services were Live at that baseline before release review.
PR #69 remains held; none of its changes or undocumented discovery policies were
imported. Claude's separate `claude/v73-functional-templates` work was preserved.
This pass changes Data preflight interpretation, checkout errors and request
recovery. It adds no schema, environment setting, supplier submission or payment
method, and does not change the Website Builder presentation or catalogue design.

## Confirmed causes and supplier evidence

- The beneficiary provider collapsed explicit denial, missing/malformed results
  and transport failures into `eligible:false`. The fulfilment layer consequently
  described inconclusive checks as recipient ineligibility.
- Main checkout claimed the number had been submitted for verification and
  recommended Instant Bundles as a bypass. The actual call graph established
  neither assertion. The supplied October 4 v2 HTML documents checking eligibility
  and proceeding only when eligible is true; it does not establish automatic
  verification enrolment. No verification submission endpoint was added or called.
  A newer authoritative supplier contract was not independently established.
- Managed checkout discarded error codes, then permanently locked the form for
  every error, including confirmed rejection before order creation.
- Existing request lookup happened after supplier checks. A later outage could
  conceal an earlier initialized or uncertain payment.
- Direct guest checkout lacked durable request-key uniqueness; browser timeout
  copy incorrectly established that nothing had been charged.

## Backend contract

`shared/checkoutFailure.ts` defines bounded customer-safe meanings used by both
interfaces. `server/services/checkoutFailure.ts` serializes them on the existing
direct and managed initialization endpoints. Errors contain a safe code and:

```json
{"version":1,"code":"BENEFICIARY_NOT_ELIGIBLE","paymentState":"not_started","retryAllowed":true,"verificationSubmitted":false}
```

The `checkout` object is nested in the existing error response. No raw provider
reason, payload, supplier balance, credential or recipient is included.

- `BENEFICIARY_NOT_ELIGIBLE`: explicit matching boolean denial for this bundle.
- `BENEFICIARY_CHECK_UNAVAILABLE`: insufficient evidence, malformed/conflicting
  result, missing recipient or unsuccessful beneficiary lookup; never approval.
- `SERVICE_TEMPORARILY_UNAVAILABLE`, `PACKAGE_UNAVAILABLE`, `SUPPLIER_WALLET_LOW`:
  existing service/catalogue/funding restrictions with safe customer wording.
- `CHECKOUT_REVIEW_REQUIRED`: a proven pre-order pricing/details rejection.
- `ACTIVE_MTN_ORDER`: fresh attempt stopped before creation by the existing
  duplicate gate. An owned tracking reference is separate from this attempt.
- `PAYMENT_INITIALIZATION_UNCERTAIN`: an existing/possibly initialized attempt;
  `paymentState:unconfirmed`, `retryAllowed:false`, optionally its matched reference.

`not_started` describes the rejected attempt, not all other concurrent purchases
or a customer's bank balance. An existing request takes precedence over a fresh
denial. Transport failure alone never establishes `not_started`.

The beneficiary parser preserves established direct, array and `data.results`
shapes, requires an explicit boolean, checks supplied recipient identities and
rejects contradictory results/wrappers. It does not interpret provider prose as
eligibility evidence. Beneficiary calls retain their deadline through body reading,
reject late approval and redirects, and do not retain private upstream error bodies.

## Checkout and recovery

Both checkout screens use the same error meanings with their own branding.
Known pre-init rejection keeps the bundle/details, unlocks correction and allows
only an explicit customer retry through mandatory checks. The error is announced
and focused. Package/service problems do not instruct changing the recipient.
No verification-submitted or guaranteed Instant-bypass claim remains.

Unknown initialization keeps the request identity and any reference, locks a fresh
payment, and offers tracking/support. Browser reload does not erase uncertainty.
Late callbacks cannot unlock another attempt or account. Manual status lookups
capture their generation, account scope and request before awaiting a response.
Popup success does not clear durable recovery: server-confirmed payment is needed.

Pending authenticated/direct and managed authorizations can resume only after
fresh product/supplier checks and a final order-state read. A failed fresh check
returns recovery-only with the original reference, never another initialization
or a false no-start denial. Paid/uncertain rows remain tracking-only.

New direct guest UUIDs map to a 53-character, SHA-256-based order primary key.
PostgreSQL uniqueness prevents concurrent duplicate creation. Recovery requires
the original unpredictable UUID and matching service, product, recipient, email
and guest identity; mismatches expose neither access code nor reference.
Guest access codes were not durably stored by the existing architecture, so guest
replays are tracking-only rather than creating a new Paystack authorization.
Legacy requests without a UUID retain their existing behavior; this pass does not
claim durable recovery for those clients. Current Data checkout sends a UUID.

Browser recovery records contain only request/product identity and public order
reference, never phone, email, access code or session token. Disabled browser
storage limits recovery after navigation; in-memory guards still protect the page.

## Financial and privacy boundaries

Payment verification, webhook signatures, settlement, referral calculations,
Wallet ledger operations, supplier dispatch and Store Earnings algorithms are
unchanged. Retail/wholesale floors, reserves and immutable order snapshots remain
authoritative. No denied preflight creates an order or calls Paystack/supplier
submission. MTN duplicate protection remains in place, including its atomic gate.
An unowned active-order reference is no longer disclosed by knowing its phone.

Owner Edit/Preview remains nontransactional. No live Paystack initialization,
beneficiary request, supplier order, financial action, production database write,
environment change or customer-site edit was used for verification.

## Monitoring

The existing bounded, asynchronous Sales Reliability collector is reused.
Authoritative denial is customer validation, not an outage or outage recovery.
Missing/conflicting eligibility is supplier-response evidence. Existing transport
timeout/connection/authorization evidence takes precedence. Only parsed eligible
evidence marks beneficiary success; raw HTTP 200 does not. Monitoring failure
still cannot reject checkout. No worker or synchronous telemetry write was added.
Data preflight diagnostics use bounded messages instead of recipient/provider
reasons and balance details.

## Verification and review

- Focused classification/recovery/UI/monitoring suite: 218 passed, zero failed.
- Final fresh-authorization direct/store/database regression: 254 passed, zero failed.
- Full isolated regression: 2,944 passed, zero failed, 39 skipped (2,983 total).
  Skipped optional PostgreSQL suites are not counted as executed tests.
- Native PostgreSQL 17 disposable databases: checkout uniqueness/recovery 3/3,
  financial reconciliation 85/85, backend role isolation 10/10. No external
  database configuration was inherited. The PostgreSQL instances were stopped.
- TypeScript, production build and `git diff --check`: passed.
- Compiled actual checkout components checked at 320, 360, 390, 430, 768 and
  1280 pixels: both error panels fit without horizontal overflow; safe retry and
  recipient editing remained available; alert focus was observed.
- Synthetic browser checks covered denial, explicit retry, one popup, modal
  closure before the popup, cancellation, uncertainty/reload/Back recovery and
  preview Buy isolation. No real SDK transaction or supplier denial was tested.
- Physical Android keyboard/touch acceptance remains a founder check, not an
  observed result from desktop viewport testing.

An independent reviewer participated separately from self-review. Findings fixed:
conflicting nested eligibility; popup success clearing unverified recovery; stale
session/manual lookup replies; permanent lock after pricing rejection; concurrent
guest pricing denial hiding initialization; active-order references being adopted
as a new payment; and preserving fresh checks before resuming authorization.
Native PostgreSQL testing also found and corrected the initial guest key length.
No remaining critical blocker was reported in the reviewed focused fixes.

The first full run exposed 13 changed-contract test failures: old no-charge copy,
source-string assertions, a missing VM import and an unimplemented read-only mock
transaction. These were updated for the actual contract and meaningful behavioral
regressions added; they were not waived as inherited failures.

## Release and operator procedure

Before merge, re-fetch main, verify the exact PR head and scope, require GitHub
checks, and retain this branch. Do not merge PR #69 or V7.3. Both existing Render
services auto-deploy main. The apex domain is served by the API web service's own
compiled frontend; no new endpoint, schema or environment variable is required.
The optional typed contract is additive; old/unclassified replies remain cautious.

After normal merge, verify both actual Render deployment revisions and startup,
public health, direct catalogue, published Data Store and protected-route denial.
Read Sales Reliability using an existing authorized Admin session where available.
Record deployment IDs and read-only smoke results in the release evidence. GitHub
or preview success alone is not proof of a live Render release.

For a sustained deployment defect, stop checkout testing and use a normal reviewed
revert or supported Render rollback to the recorded baseline. Do not reset data,
alter DNS, resubmit orders or create financial remedies as a release check.

Founder acceptance: on Android check long error scrolling, recipient correction,
keyboard dismissal, reachable action buttons and tracking/reopening behavior.
Do not make a diagnostic payment solely to provoke an error. Supplier verification
enrolment semantics remain a separate documentation question; no automatic
enrolment is promised or enabled by this release.
