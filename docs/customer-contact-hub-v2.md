# Customer Contact Hub V2 — Direct platform scope

## Audit and boundaries

Starts at main bba5c7e5533a2458b9f8cf97ee08a871238a145c. Reuses PR120's Contact
Hub, existing Admin/session checks, financial qualifyingSale predicate, Ghana phone
normalization, scoped suppression/preferences and private export audit. No new
schema, startup migration, external dependency, sending service or financial change.
Held PR69 remains untouched. PR118 and notification consent work already in main
are preserved; their Web Push permission is not reinterpreted as SMS permission.

V1 grouped qualifying orders by user_id or guest recipient without excluding
storefront orders, and missed recipients of signed-in purchases. V2 uses a single
direct scope for every contact metric, history, recognition and export:

- store_context must be SQL NULL (absent/null in application data); every non-null
  malformed snapshot is excluded as well as valid snapshots.
- payment_reference must not start with MH_STORE_.
- no store_checkout/store_sale finance operation may link through payload.orderId.

Managed checkout writes these markers and does not create customer accounts.
Account creation has no acquisition-source field. Conservative account gate:
customer-role accounts with storefront evidence require independent non-synthetic
direct-order evidence (any persisted state); no-order accounts remain available.
A cancelled/pending direct order supports relationship scope, never a completed
purchase or recipient delivery. Reseller-only accounts remain in existing global
Accounts & Security, not this direct CRM. Mixed buyers retain only direct metrics.
If every historical source marker was lost, this release cannot reconstruct it;
no name/phone inference or record backfill is attempted. Archive status does not
remove authoritative evidence. Source counters expose only aggregate withheld
order counts, never storefront identities/history.

Read-only production aggregate observation (time-sensitive): 847 stored orders,
73 with non-null store_context, zero missing snapshots with MH_STORE_ references,
zero recorded guest-payer evidence rows. No personal data or contact lists read.
These numbers are diagnostic evidence, never UI constants.

## Sources and identity

API filter source values:
- all (default): unique normalized direct numbers, returned source directory.
- registered: separate eligible customer accounts, keyed by user_id.
- recipient: every qualifying direct recipient, including signed-in purchases.
- guest: qualifying direct guest recipients only.
- payer: existing immutable guest purchaser evidence joined only to qualifying
  direct guest orders. This does not modify ownership or registered metrics.

Directory provenance preserves registered_account, guest_recipient,
registered_order_recipient and verified_guest_payer labels. Account identities stay
separate; two people sharing a phone never share spending or buyer stars. Directory
activity counts each direct recipient delivery once, not sum of account and guest
records. Directory spending/VIP remain zero/empty; buyer purchase metrics belong
to registered profiles. A payer record uses buyer_key plus canonical evidenced
phone, preserving different historic phones for one evidenced account key. Payer
activity is evidenced purchases, not proof the payer phone received the delivery.
Underlying account/payer/recipient profiles are separately navigable; relationship
links are capped at100 (source search remains available).

Recipient numbers are extracted only from qualifying completed direct deliveries,
not unpaid attempts. Account contacts with no purchases remain discoverable under
the account gate above. Invalid/missing numbers remain visible in account analysis;
number-only directories/exports contain valid Ghana numbers only. First/last and
recency use delivered_at, with existing paid/delivered/refund/review/fixture safeguards.
Full source evidence is retained while refunded purchases are excluded from metrics.

Buyer cohorts: zero, exactly1, repeat2+, frequent5+, recent<14d, at-risk14–<30d,
inactive>=selected interval (14/30/60/90 or positive custom through3650d). Previously
active is repeat plus30d inactivity. High value is at/above90th direct-buyer spending
percentile, including ties; no reward or discount entitlement. Missing purchases
never imply inactive buyer. Date labels use Ghana calendar days; numerical inactivity
uses completed elapsed24h periods. Spending is customer-paid pesewas, not profit.

## Existing API extensions and exports

Existing Admin-only POST /api/admin/contacts/{query,profile,preview,export} retained.
Profile accepts registered/guest/recipient/payer/directory with bounded identifiers;
number profiles require canonical +233 syntax. Payer ID shape:
`guest:<evidence-key>|+233XXXXXXXXX` or `user:<account-id>|+233XXXXXXXXX`.
Search matches related account names/emails without changing directory identity.
Sort and filter values remain server validated and applied before pagination.
Private no-store and existing throttles/query deadlines remain. No public directory.

Administrative exports are explicitly contact recovery, not marketing approval.
All source selections support administrative CSV/TXT/newline/comma exports over the
full filtered audience, independent of marketing eligibility. CSV preserves narrow
source metadata and separate identities; number-only output deduplicates. Preview
shows matches, invalid/missing, unique/duplicate numbers, purpose exclusions and
aggregate storefront orders withheld. The10000-record limit fails explicitly,
never returns a silently partial file. Audit failure returns no file.

Preview revision binds issuance time, filters, purpose and current rows. Valid for
15minutes; future, expired or changed-evidence revisions are rejected. It may be
reused within that interval for another format; each export is audited. It is a
freshness check, not a bearer authorization token. Nothing is stored in process
memory for revision validation. Audit metadata never contains searches, contact
lists, CSV content, aliases, payer narratives or revision hashes.

Marketing exports remain empty without verified SMS-specific opt-in. Administrative
exports preserve opt-out evidence instead of hiding existing contacts. Operational
service-notice audiences retain the narrow established active account rule, scoped
SMS opt-outs and disabled transactional preferences; matching suppressed accounts
sharing a phone cannot be bypassed by selecting another identity. Directory inherits
user-ID-only unsubscribe evidence from its account relationship. Recipient/payer
contacts are not automatically approved for outreach. Existing notification and
waitlist settings are read, never rewritten.

## Manual messages and UI

Prominent export, compact statistics, search-first filters, labeled source/sort
selectors, horizontally scrollable buyer chips, advanced ranges and short contact
cards. Separate profiles expose detailed activity and recognition definitions.
Eight editable presets: support change, verified channel invitation, interruption,
delivery investigation, order assistance, return reminder, availability and custom.
Operational templates containing bracket placeholders require editing before copy.
Channel destination requires explicit valid URL and Admin confirmation. Support
uses central BUSINESS_CONFIG /help; no support number/channel is changed or invented.

Native sms: composer is preparation only, restricted to reviewed suitable account
service notices. Invalid Ghana numbers are rejected; message edits reset review.
Promotional/custom drafts have copy fallback, not an approved recipient action.
No Arkesel calls, sending queue, message history or delivery claim exists. Auth/session
changes and stale requests clear/withhold private content. No contact localStorage.

## Validation and rollback

Focused contactHub*.test.ts; disposable contactHubPostgres.test.ts; full npm test;
npx tsc --noEmit; npm run build; git diff --check. Browser script
scripts/reviewContactHub.py uses actual React/Admin APIs with isolated synthetic
stores at360/390/430/768/1280px; screenshots /tmp/contact-hub-v2-browser. No real
Android device, native keyboard or SMS delivery is claimed. Native SQL/memory parity,
source isolation, full exports, immutable economic triggers and anon denial tested
against PostgreSQL17. Performance observations use actual feature EXPLAIN ANALYZE
on10000 extra synthetic orders, not a production benchmark. Rate limits remain
per-process, as in V1. No production schema installation required. Rollback is a
normal code revert; preserve historical export audit evidence.

## Phase 2: Arkesel SMS & Gemini Communications (not implemented)

1. Obtain current official Arkesel API docs, exact authentication/sending/balance/
   status/report contracts, error/rate/idempotency guarantees and callback signing
   or authenticated verification. No guessed endpoints. Store approved credentials
   and registered sender ID server-side only, separately authorized activation.
2. Install separately reviewed private queue/message/suppression schema. Atomic
   outbox after authoritative events; unique event+purpose+destination key, bounded
   workers, retries only with verified provider acceptance semantics. A crash after
   provider acceptance must not silently duplicate a paid message.
3. Transactional payment-confirmed/delivered/attention templates reflect actual
   persisted transitions, not frontend success or supplier credit. Select verified
   buyer contact separately from recipient; a recipient must not receive payer
   financial details, and buyer delivery reports must not disclose unrelated data.
4. Manual campaign audience uses this direct scope, current SMS opt-in/withdrawal,
   canonical-number dedup and suppressions. Administrative export is not campaign
   consent. Snapshot preview, exclusions, content/cost review and explicit authorized
   human confirmation required before enqueuing. No automatic reseller audience.
5. Capture provider acceptance, verified delivery report, failure and unknown as
   separate states. Verify callback authenticity/replay handling, correlate exact
   message reference, bound report payloads and redact message/contact logs. Track
   credits, segment estimates, actual costs and limits; unavailable balance fails
   controlled sending. Private Admin history reports attempts truthfully.
6. Reuse existing Gemini integration only for editable drafts. Current main uses gemini-3.1-flash-lite with a gemini-3.8-flash fallback in
   mysteryAiReliability.ts. Recheck actual configuration/provider availability before
   reuse; no model upgrade is authorized by this release. Send no customer phone/order/financial data for drafting. AI
   cannot approve an audience, send a message or assert transaction truth.
7. Keep activation gated; run synthetic provider tests, then separately authorized
   low-volume consenting real-device tests before general sending. Retain manual
   templates/copy and core checkout even when SMS/AI are unavailable.

## Recorded verification

Unchanged starting main:3511 tests,3458 passed,0 failed,53 skipped. V2 full
regression:3521 tests,3468 passed,0 failed,53 skipped. Focused unit/API suite28
passed,0 failed/skipped; independent reviewer separately executed the same28 (not
additional cases). Native PostgreSQL17 suite9 passed,0 failed/skipped. TypeScript,
production build and whitespace checks passed; existing large-chunk build advisory
remains. Actual component/API browser acceptance passed every requested viewport.
No physical Android/native SMS delivery or authenticated production UI claim.

Independent review corrected refund/source evidence loss in memory, missing
combined-profile relationships, account-only suppression propagation and historical
payer-phone loss. SQL/memory parity and changed-phone/suppression tests cover the
repairs. Actual feature query timings under concurrent local test load were about
457ms filtered and395ms export on10000 added synthetic orders, below the existing
5s statement timeout; these are not production latency guarantees.

## Current-main compatibility follow-up (17 November 2026)

The core Phase 1 release was already merged in PR #124 (feature 0c7ec00, merge
cd9a4f1). Subsequent separately authorized SMS releases installed consent and
purpose-evidence tables. Contact recovery now reads their latest explicit withdrawals
when present. It adds no schema dependency, grant, sender activation or provider call.

`ContactRow.smsRestrictions` lists transactional, operational and/or marketing
withdrawals independently of the legacy waitlist classification. Account withdrawals
follow a changed contact number and every direct relationship sharing that number.
Latest phone/user/purpose consent and latest phone/purpose attestation retain their
separate authority; a grant in one source cannot erase another source's denial.
Only transactional/operational restrictions block manual support preparation; a
marketing-only restriction remains visible without relabeling service communication.
Administrative records, profiles and exports retain all otherwise eligible contacts.
Suppressed filters include purpose restrictions; CSV and profiles show their purpose.
Changed evidence invalidates an export preview. Optional-table absence is supported;
unexpected permission/query errors fail the request rather than returning unchecked
contacts. SQL and synthetic derivation share the same restrictions contract.

The manual composer describes preparation accurately without asserting that the
separate SMS provider is disconnected. This Contact Hub tool approves no marketing
audience; purpose registration and existing provider capabilities remain in their
separate workspace. No existing SMS state, environment, credentials, campaigns,
customer/financial record or reseller ownership is changed by this follow-up.

Current-main follow-up verification: focused unit/API31 passed, native PostgreSQL17
10 passed (including SQL/memory/source/export/privacy and optional SMS withdrawal
compatibility), full regression3563 passed/0 failed/59 optional skips (3622 total).
TypeScript/build/diff checks passed. Real Chromium interactions and independently
reviewed screenshots passed at360/390/430/768/1280px, synthetic records only.
Independent reviewer also ran32 supplemental assertions and13 named V2/withdrawal
tests, with overlap; these are not additive totals. Review caught phone-specific
withdrawal propagation and narrow selector clipping, both corrected and rechecked.
No unresolved critical/high finding. Actual synthetic feature query plans with10000
extra orders were204ms filtered/221ms export; no production performance claim.

Read-only aggregate observation at2026-11-17 22:40:53 UTC:888 stored orders,83
non-null storefront snapshots,0 missing-snapshot store payment references,0
guest-payer evidence rows. Existing SMS consent/permission tables are installed.
Counts are diagnostic only, never constants or exported customer data.
