# Arkesel SMS Communications V1

SMS V2 supersedes permission/push coupling, Admin prior-consent registration and
report-poll ordering below. See [SMS V2 repair](sms-communications-v2.md).

## Release scope and current state

Starts from main cd9a4f1c3cfb43f6b35e4cd3903c185e4da51acb; integrates subsequent
main4001d850754628840e377a0f03ef21aa5967756f (Notification Center PR125/126)
without changing its delivery or consent behavior. Reuses Contact Hub V2,
Admin/session authentication, private audit, the existing Gemini client/model,
notification outbox conventions and shared Admin design. Held PR69 is untouched.
No supplier, pricing, wallet, payment verification, reseller ownership/earnings,
campaign attribution or paused Web Push delivery policy is changed.

Code availability is separate from sending activation. Default sending, automatic
SMS and worker switches are OFF. Default provider mode is sandbox and default
scope is one explicitly configured test number. No credentials are needed to
start Mystery Hub. The new schema is MANUAL INSTALL ONLY; connection.ts never
imports or applies it. Missing/partial schema returns readiness/migration-pending
states and cannot send. My Account shows SMS setup pending instead of inventing
saved choices. No live provider, paid message or production migration was used
in implementation. A production read-only metadata check found no SMS settings
table, while existing order events/guest evidence tables were present.

## Official contract evidence

Fetched 15 November2026: https://developers.arkesel.com/spec/api_spec.v2.4.0.yaml
SHA256:89c35f61b42412b6fc3731a0100fb839a45da0b7d361adf9afbd4f0db0258d2d.
Developer portal: https://developers.arkesel.com/ . Base:https://sms.arkesel.com .
V2 authentication is api-key in a request header, never in URLs or frontend code.

Implemented adapter operations:
- POST /api/v2/sms/send: ordinary JSON sender/message/recipients/sandbox/callback_url.
- POST /api/v2/sms/template/send: personalized map using documented <%variable%>
  substitution. This path is blocked in sandbox and requires separate operator
  qualification (ARKESEL_TEMPLATE_QUALIFIED); its sandbox field is commented out
  in the official template schema. The worker uses ordinary sends, not this path.
- GET /api/v2/clients/balance-details: strict sms_balance numeric parsing and
  separate main_balance GHS label. No credit-to-GHS conversion is invented.
- GET /api/v2/sms/<UUID>: all four official language examples use this dynamic
  path, although the OpenAPI path key says /api/v2/sms without a path parameter.
  Batch reporting is the normal reconciliation path; record this spec discrepancy
  when obtaining live provider qualification.
- POST /api/v2/sms/message-reports with msg_ids: known statuses/recipient validation.
- GET /api/v2/webhooks/secret: safe configuration comparison only. Secret is never
  returned to Admin; only matching/configuration/time metadata is exposed.
- POST /api/v2/webhooks/secret/rotate is NOT invoked by application code/startup.
  Generation/rotation is a separately authorized operator action.

HTTP200 is not delivery. IDs must be valid unique UUIDs and match each recipient.
Partial success is handled individually. Generic success without IDs, malformed
JSON, transport reset, timeout or an ambiguous server failure is uncertain. No
uncertain POST is retried. Explicit401/402/403/422/429 responses are classified;
there is no automatic paid-send retry policy. Responses are capped at128KB,
requests at8seconds, redirects rejected, adapter concurrency2 and30requests/min
per client. Worker submission claims are also globally limited to10/min in SQL.
The official sandbox promise applies to ordinary sends only. Real sandbox access
and account/sender authorization still require founder-controlled verification.

## Durable model, migration and isolation

server/db/smsCommunicationsV1.sql is versioned V1, additive and transactional,
protected by a schema installation advisory lock. It supports exact-version rerun.
Tables in private mysteryhub_sms schema:
- settings: pause, activation cutoff, event policy, revision, credit/signing checks,
  worker heartbeat and optional guest capture failure timestamp.
- templates/template_versions: locked factual presets and versioned editable copy.
- consents: append-only SMS-specific own-account choices, separate from Web Push.
- previews: actor-bound10minute review and one bounded sending-audience snapshot.
- campaigns: request/preview uniqueness, approval session, purpose/mode/content.
- messages: individual recipient snapshot, event dedup key, sender/mode, local/provider
  states, lease/start marker and estimated/reported segment evidence.
- attempts: one permitted submission attempt per message.
- delivery_events: verified callback/report history and replay uniqueness.
- consumed_events: independent SMS consumption; never touches push expanded_at.
- guest_events: optional guest-only durable order source.

RLS enabled; PUBLIC, anon and authenticated schema/table privileges revoked. No
public policies or FORCE RLS. Use the established backend table-owner access model;
new tables are not browser-readable. Appropriate unique, queue, recipient/date,
credit-reservation, campaign, consent and guest-event indexes are included.
No change is made to existing production schema initialization or pool size.

Registered order observations consume existing mysteryhub_notifications.events
read-only, including while Web Push delivery is paused. The manually installed
guest trigger is inactive unless the SMS automatic policy is enabled. It emits
no network traffic, uses fixed search_path, and isolates errors so optional SMS
storage cannot roll back an order. It records capture_error_at where possible;
a bounded current-state repair query recovers eligible post-cutoff guest evidence.
The worker rechecks direct source/payment/fulfillment facts before intent creation
and again before submission. It never changes an order or financial record.

Manual campaign input is stored once in its preview, not copied into every message.
Message context contains its own role/template reference. Queued messages expire
from review after24hours instead of being silently sent much later.

Retention: expired unused previews are removed after1day; used preview input and
recipient arrays are cleared after1day once no queued/in-flight messages need them.
Message bodies/phones/account-order links and campaign copy are redacted after
180days in bounded batches. Minimal idempotency, attempt/status and cost evidence
remains; SMS opt-out evidence is retained to honor withdrawals. Automatic pruning
runs hourly only with an enabled worker; authenticated Admin can invoke the bounded
retention operation while sending is dormant. Generic reusable template versions
remain; do not put personal customer details into reusable templates.

## Sending and uncertainty safety

Uniqueness protects each business event/type/intended phone, including repeated
payment/delivery signals and guest-to-account changes. Number matches never rewrite
buyer identity. Campaign request and preview uniqueness protect repeated approval.
Approval re-reads current audience, template version, purpose, actor and settings;
permissions/deduplication are not trusted to the browser. Manual jobs require the
approving Admin session to remain active at dispatch. Logout/revocation, cancellation,
changed permissions, source scope or sender/mode can stop an unsubmitted message.
Already in-flight provider requests cannot be recalled.

Claims use transactions, FOR UPDATE SKIP LOCKED and a global budget advisory lock.
A submission-start marker and attempt are committed BEFORE the external boundary.
Lease expiry after a crash yields uncertain, not queued. A lost commit acknowledgement
cannot overwrite stronger accepted/terminal callback evidence. A message without
provider ID requires operator investigation; never submit it again automatically.
Known provider IDs reconcile via read-only reports/callbacks without resending.

Daily and automatic credit ceilings count conservative estimated reservations,
including uncertain sends. The low-credit floor additionally reserves unresolved
prior-day submissions across midnight. This can underuse credits when billing
proof is unavailable; it prevents inventing spare credit. Provider-reported segments
are observations, not an audited GHS expense. No unit price is assumed. Queued
messages wait/cancel safely if credit, quota or configuration is inadequate.

## Recipient and communication policy

Contact Hub V2 is authoritative: no store_context, MH_STORE_ references or linked
store finance evidence; registered identity stays user_id; direct recipients and
verified guest payer evidence stay separate. Customer source qualification, archived
history and refund exclusions are unchanged. SMS adds purpose selection, not a
second customer database. Audience permissions are fetched in two batched reads,
with indexed consent scope and maps for account lookup, rather than per-contact SQL.

Operational notices require a suitable established direct account relationship
(or the separately configured controlled-test number). Promotional copy cannot be
misclassified as generic operational copy. Marketing requires explicit SMS opt-in;
purchases, directory presence and Web Push permission never grant it. Recorded
SMS unsubscribe/transactional restrictions remain effective. Shared-phone users'
withdrawals cannot be bypassed by a different matching account's grant.

My Account → Notifications → SMS choices is an explicit, SMS-only first-party
control bound to the signed-in customer's current account phone and direct scope.
Both choices start off; a stored transactional withdrawal also suppresses generic
operational service notices. Automatic purchaser SMS requires explicit SMS order
opt-in. A genuine manually reviewed order-support message uses its own order
context and existing suppression rules. Sender approval does not manufacture consent.

Automatic templates: payment verified, supplier processing (optional), recorded
delivery, attention, and distinct initiated/completed refund evidence. Timestamp,
payment source/amount/currency and applicable fulfillment evidence are checked.
Delivery copy says marked delivered, not personally acknowledged. Refund copy
never turns a request or supplier credit into customer reimbursement.

Buyer contacts come only from account ownership or immutable guest-payer evidence.
Unknown guest payer means no invented buyer phone. Optional separately approved
recipient policy permits delivery/attention copy only, without payer financial
details. Same-number roles deduplicate. No reseller-origin SMS policy is enabled.
Historical orders before rollout cutoff are never backfilled. Inactive→active
policy transitions advance cutoff and cancel old automatic queue entries. A
server-disabled deployment also deactivates stored automatic policy; ordinary
restarts of a continuously approved worker retain durable state safely.

## Signed callback contract

GET https://mysteryhub-api.onrender.com/api/sms/arkesel/callback
Query: sms_id=<UUID>&status=<provider-state>; optional recipient must match.
Headers: X-Arkesel-Webhook-Timestamp, X-Arkesel-Webhook-Signature, X-Arkesel-Webhook-Id.
Canonical payload recursively sorts object keys, preserves arrays, JSON-encodes
without slash escaping and with PHP-compatible non-ASCII UTF16 escaping. HMAC-SHA256
covers timestamp + '.' + canonical JSON. Accept only valid64hex v1= candidates
with constant-time comparison and timestamps within±300seconds. Previous secret
is accepted only within its explicitly configured24hour rotation grace.

The header webhook ID is not signed. Both that ID and a stable canonical payload
digest deduplicate callbacks, including a replay using a different unsigned ID
or secret rotation. Known statuses normalize to submitted/queued, delivered,
not-delivered, expired/prohibited. Unknown states require investigation; stale
observations cannot replace newer evidence. Contradictory terminal reports are
retained and flagged without silently demoting stronger delivery evidence.
Callbacks mutate SMS records only, never orders, Paystack or supplier status.

## Admin workflow and APIs

Admin → Notifications retains Web Push & In-App, adding SMS Center in the same
workspace. Contact Hub statistics are actionable and keyboard accessible; a clicked
metric selects its server filter and resets pagination. Inactivity supports7/14/
30/60/90/custom days, with clearly separate cumulative and exclusive interval groups.
Contact Hub individual/filtered audience actions import into the SMS composer in
session memory, never private query strings or localStorage.

SMS Center: Overview, Compose, Audiences, Templates, Campaign History, Delivery
Reports and Settings/Readiness. Manual composition/copy works without the migration;
saved drafts/templates/history require it. Locked transactional presets resolve
actual order facts server-side. Editable presets have enable/category/version
controls. Review binds actor, audience, content and permission evidence; preparation
is not sending. Campaign history separates accepted/delivered/failed/unknown per
recipient. Filters are server-side, private, paginated, scoped against stale responses
and debounced. Credit age/mode and estimated versus reported units remain explicit.

All /api/admin/sms routes require active Admin authorization and private/no-store:
- GET readiness; POST balance; POST verify-signing (safe metadata, no secret output).
- PUT settings with expectedRevision and confirmed:true.
- POST preview with filters/selected/numbers, purpose, body, templateId/version and
  an order reference/ID for locked transactional templates. Test numbers must match
  the server allowlist. Limit1000hard recipients; default100; selected IDs<=100.
- POST campaigns with previewId/requestId UUIDs, confirmed:true, queue:false for
  prepared draft or queue:true only behind all server gates. Preview TTL10minutes.
- GET campaigns?page; POST campaigns/:id/cancel.
- POST history with page/date/recipient/provider/message/campaign/order/purpose/
  state/origin/mode filters; GET messages/:id; POST messages/:id/reconcile.
- POST templates; GET templates/:id/history; POST draft; POST retention confirmed:true.
- GET/PUT /api/sms/preferences requires the customer's own authenticated session.

Errors use {error: safeMessage}, appropriate4xx for access/validation/conflicts and
503 for unavailable storage/provider/drafting. No raw provider errors, credentials,
contact lists or SMS contents appear in broad audit/log metadata. Reads/operations
reuse existing per-process throttles; submissions/budgets are also database-serialized.

## Gemini writing assistance

Existing getGeminiClient and gemini-3.1-flash-lite, one bounded request, no retries.
Modes: grammar, professional, friendly, urgent, shorten, clarity, alternatives,
brief, CTA and segment explanation. Recognizable names, email/phone/reference and
numeric identifiers are redacted; OTP/PIN/financial credentials/secrets are blocked
before inference. Remove any other personal information before requesting AI.
Only approved supplied links and preserved placeholders are allowed; invented
financial/delivery/discount claims and malformed output are rejected. Locked order
facts cannot be rewritten. A segment explanation never replaces message copy.
Every proposal needs deliberate acceptance and a fresh review. AI never chooses
recipients, changes permissions, creates campaigns or sends. Manual copy/templates
remain available if Gemini is missing or fails. No new AI provider/model upgrade.

## Test/deployment limits

Automated tests use injected HTTP and empty loopback PostgreSQL17 databases.
Default provider transport is blocked in NODE_ENV=test. No provider credentials or
real sandbox/paid request is used. Native tests install/reinstall SQL explicitly,
prove private RLS/access and crash/concurrency/report/refund/source isolation.
Browser script reviewSms.py runs real React and real Admin/customer APIs with
synthetic PostgreSQL records at360/390/430/768/1280px, with outbound browser traffic
blocked and Gemini injected. No physical Android, native SMS delivery or production
customer-data testing is claimed. See the PR for exact final verification totals.

Rollback: pause in Admin and disable server switches first. Code revert stops the
worker without deleting evidence. Optional separately authorized manual
smsCommunicationsV1.pause.sql pauses/cancels unsent messages and removes only the
new guest trigger, retaining private history. Never drop evidence or retry uncertain
messages to make counts smaller. No rollback command is run against production.
