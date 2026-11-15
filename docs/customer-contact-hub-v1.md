# Customer Contact Hub — Release A

Historical V1 design. For current direct/reseller scope, expanded recipients and
export semantics, see [Customer Contact Hub V2](customer-contact-hub-v2.md).

## Repository inventory and isolation

Started on main bd88e1ea50b7d9877bbad249ef7a0fca3e06cb0f. PR118 is a separate
support/contact correction; PR69 remains held. Neither branch is imported or
edited. Central BUSINESS_CONFIG supplies the domain; no support number/channel
is copied or changed by this feature.

Reused: Customers & Security/account ownership; AdminSheet/UI; Admin order details;
qualifyingSale from financial reporting/Customer Champions; Ghana normalization
and its existing PostgreSQL mystery_canonical_phone counterpart; Admin session
checks; existing private audit and preference/waitlist records; CSV formula
protection (moved unchanged into a pure helper and re-exported from adminApi).
No payment, supplier, financial, pricing, referral, campaign, notification-worker,
Christmas/Greetings, or customer record mutation is added.

Working additions: Audience & Contacts tab in Customers, server aggregate/cohort
queries, separate guest recipient history, recognition badges, paginated private
profiles, reviewed exports, editable SMS drafts and native composer/copy actions.
Manual favorites/notes/tags/consent collection are deferred. Finance configuration
is not repurposed as a CRM database. No production schema installation is required.

## Identity and purchase evidence

Registered rows are customer-role users keyed by user_id only. Admin/staff accounts
are excluded; active and disabled customers are inspectable/filterable. Contact
fields come from that account's current stored record. Similar names, email/phone
matches and recipient numbers never assign orders to an account.

Guest rows group canonical recipient_phone only for qualifying guest deliveries.
They expose no purchaser name/email and carry no loyalty recognition. Their counts
are recipient-associated deliveries, not verified repeat buyers. Even separately
recorded guest payer evidence does not silently change the underlying user_id or
this recipient view; Customer Champions retains its explicit evidence workflow.
Unusable guest recipient fields cannot form contacts; their delivery count is
reported separately. Guest_reference exports are internal research/operational
references, never a verified customer/marketing audience.

Completed purchases reuse qualifyingSale: stored authoritatively confirmed success,
positive safe integer GHS amount, Paystack or Wallet, paid_at and delivered status/
time, excluding refund/compensation and Marketplace refund/cancelled outcomes.
Contact Hub additionally excludes manual_review, unresolved/malformed resolution,
invalid/future timestamps, registered synthetic fixtures and completed Wallet
refund operations linked by orderId. SQL and memory implement the same restrictions.
These are reporting predicates; no order/payment/ledger state is rewritten.
Archived purchases remain included. Repeated webhooks cannot duplicate an order ID.
First/last purchase use qualifying delivered_at. Spending is the full customer-paid
amount, including managed-store retail: not platform revenue, margin or profit.
Average rounds to the nearest pesewa. Network/service filters select identities
with matching history; counts, dates and spending remain lifetime.

Cohorts: zero completed purchases; exactly one; repeat >=2; frequent >=5; recent
(days since delivery < recentDays, default14); at-risk [recentDays,inactiveDays);
inactive >= inactiveDays (default30; configurable including14/30/60/90). Missing
purchase evidence is not an inactive buyer. Recognition is derived, not an award:
repeat>=2, frequent>=5, high_value at/above the90th spending percentile among all
registered buyers (ties/small datasets may exceed10%), formerly_active is a repeat
buyer with >=30days since qualifying delivery. None grants discounts or SMS consent.

## API, efficiency and privacy

All endpoints below are under `/api/admin/contacts`, require existing active Admin
authorization and return `Cache-Control: private, no-store`, `Pragma: no-cache` and
`nosniff`. POST reads avoid putting private searches/guest phones in request URLs.

- POST /query: ContactFilters (shared/contactHub.ts), bounded page<=100000,
  limit<=100. Returns rows, matching count/pages, all-registered summary, evidence
  timestamp, definitions and unusable guest-delivery quality count.
- POST /profile: {source,id,page?}; guest id must be a canonical Ghana number,
  account id a bounded identifier. Returns one private profile and20 qualifying
  linked history references, with existing-order navigation. It never dispatches,
  reconciles payments/suppliers or changes ownership. Existing Accounts & Security
  retains the broader linked order/account workflow.
- POST /preview: {filters,purpose}; returns current full-audience counts and revision.
- POST /export: {filters,purpose,format,confirmed:true,expectedRevision}; CSV/TXT/
  newline/comma output. It re-reads current evidence and refuses a changed revision.

Filters/sorts are allowlisted and parameters bound. Search is literal rather than
SQL wildcard syntax; full Ghana phone formats normalize consistently. Advanced
filters include source, status, phone/permission class, recognition, network/service,
count/spending/date/inactivity ranges. No frontend-page-only filtering/export.
SQL aggregates once on demand, no N+1 customer/order queries or polling/worker.
Existing indexes are reused; no production DDL. Snapshot transactions use UTC,
5s statement and1s lock deadlines, releasing the existing pool connection.

Read throttles are45requests/min/Admin; export attempts5/min/Admin using the existing
process-local limiter. Across instances these are per-instance, not a new durable
quota; bounded output and database deadlines remain enforced. No new infrastructure.

## Export and permission rules

Administrative CSV preserves separate identities and uses narrow columns. TXT and
number-copy normalize to +233..., validate and deduplicate within the selected
purpose. Sharing a phone never merges buyer profiles. Preview reports matching,
with-phone, unique numbers, duplicates, invalid/missing and purpose-excluded records.
CSV may keep an analysis row with a blank invalid phone; invalid numbers never
enter TXT/copy. Guest CSV intentionally has no buyer-name/email/spending assertion.
Formula-trigger cells are neutralized; quotes, commas, UTF8 and newlines escaped.

The limit is10000 matching records. Larger requests fail explicitly and require
narrower filters; no partial list or current-page export is presented as complete.
Preview and export use the same full filtered query. Export rechecks the revision
and records an audit in the same transaction before returning data. Audit failure
returns no file. Only actor, time, purpose, source, format, safe filter categories/
ranges and counts are retained. Searches, names, phones, emails, contents and
contact-derived revision hashes are not logged. Download filenames contain no PII.

Purposes:
- administrative: registered-account analysis/support reference, not marketing consent.
- guest_reference: recipient-only operational/research data with explicit warning.
- marketing: zero eligible recipients; no general SMS marketing-consent evidence exists.
- support_notice: reviewed narrow service notice for established active account buyers
  with valid provided account phone. Matching service-scoped SMS unsubscribes and
  disabled transactional preferences are conservatively withheld. This is not a
  claim of global SMS consent, nor a rewrite of those preferences. Waitlist signup
  and Web Push marketing=true never grant SMS marketing permission.

UI data is in memory only; token-keyed workspaces and response identity/abort guards
hide prior data on logout/filter changes. Changing export purpose or closing its
sheet invalidates and aborts pending preview/download/copy, including close/reopen
ABA. Files/system clipboard deliberately requested by the Admin remain under the
user's control outside the application; the app does not retain them as CRM data.

## Manual SMS and operational limits

No SMS/WhatsApp API, queue, delivery status or outbound message is implemented.
The editable support notice uses the current central domain's /help page. Return
and new-channel templates are promotional drafts. New channel invitation requires
an Admin-provided validated https://whatsapp.com/channel/... destination and explicit
confirmation; no old/default channel is assumed to be the new one.

The native sms: composer is offered only for a reviewed support-purpose draft and
a suitable established account contact. Reviewing is reset if the draft changes.
Other purposes/guest references have text-copy only, with identity/permission warnings.
Phone and message copying have visible success/failure and select/copy fallbacks.
Opening a composer or downloading/copying never claims sent, delivered or received.
GSM7 basic/extension and UTF16 Unicode estimates show characters, units and estimated
segments; actual provider billing/handset support remains outside Release A.

Database records cannot recover lost WhatsApp address books, establish unrecorded
payer identity/ownership, prove a phone is active, establish marketing permission,
or infer whether an SMS/WhatsApp message was delivered.

## Verification and release

`npm test`; `npx tsc --noEmit`; `npm run build`; `git diff --check`.
`python scripts/reviewContactHub.py` compiles the actual component and runs an actual
loopback Express Admin API with synthetic stored records at360/390/430/768/1280px.
It prevents outbound requests and verifies profiles, filters, SMS links/copy, full
CSV/TXT downloads, guest separation, errors, delayed profiles, obsolete exports,
logout and overflow. Screenshots: /tmp/contact-hub-browser. No real Android-device
or SMS-delivery claim is made.

Native test: create an empty loopback `_test` database owned by a non-superuser,
non-BYPASSRLS app owner with the existing test API roles. Set only
MYSTERY_CONTACT_POSTGRES_URL and NODE_ENV=test; run node --import tsx --test
server/suppliers/__tests__/contactHubPostgres.test.ts with DATABASE_URL unset.
It verifies existing schema compatibility, all tested SQL/memory filters/sorts,
legacy formats, scoped unsubscribes, full exports, audit failure/changed evidence,
financial isolation and denied anon access. Actual feature SQL is captured and
EXPLAIN ANALYZE runs with10000 additional synthetic orders; no production plan,
count or benchmark is asserted. CI runs this suite in its own disposable database.
Rollback is a normal code revert. No data/schema rollback is necessary; audit
preparation records should remain as evidence.

Release verification on the final feature source: focused unit/API tests18 passed;
full regression3447 passed,0 failed,52 skipped (3499 total). Unchanged starting
main:3429 passed,0 failed,51 skipped. Optional database tests skipped by the full
command are not counted as executed there. Separately, native PostgreSQL17 tests
ran8 passed,0 failed,0 skipped with a non-superuser/non-BYPASSRLS application owner.
TypeScript, production build and whitespace checks passed. Browser interactions
passed at360/390/430/768/1280px using synthetic data and the real component/API.
A separate review agent examined the implementation; identified export/profile
request races, legacy suppression parity and draft-review issues were corrected
and regression-tested. No unresolved critical/high finding remained.

Authorized production checks were schema-only, within an explicitly read-only
transaction: existing evidence tables/columns, canonical-phone function, private
preferences, enabled RLS and restricted anon/authenticated direct contact reads
were present. No production contacts were queried/exported and no records changed.
This establishes existing-schema compatibility, not real-device SMS delivery or
an authenticated production UI acceptance test.

## Next releases (not implemented)

B: reviewed private durable notes/tags/manual favorites, buyer-contact provenance,
explicit SMS opt-in/withdrawal/suppression evidence and retention rules; schema and
production installation separately reviewed/authorized.
C: separately authorized Arkesel sender ID/credentials, backend provider, durable
queue, per-message idempotency, credit/cost controls, delivery-report validation,
provider errors and explicit manual campaign approval. Composer opening is not
provider acceptance; provider acceptance is not delivery.
D: approved audiences, audited offers/coupons/redemption rules, margin protection,
existing Campaign Manager attribution and truthful conversion reporting. No
notification worker/campaign is unpaused or activated by this release.
