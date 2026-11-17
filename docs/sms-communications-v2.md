# SMS V2 customer communications repair

Base: main `6a3613574e7fc927747f9e6a5a95058acf134545` (PR127 reused).
No SMS, provider call, production migration, credential change or manual deployment
is performed by this implementation. Automatic order SMS remains separately gated.

## Confirmed blockers and repair

V1 mixed Web Push transactional withdrawals into SMS suppression, directly in
`suppressed()` and indirectly via Contact Hub's support-review eligibility flag.
SMS now uses its own evidence and withdrawals. Existing Contact Hub reporting and
Web Push preferences are unchanged. The legacy `service_notice_review` audience
filter is explicitly rejected in SMS with instructions to use SMS permission
review, rather than silently widening the operator's selection.

Admin → Notifications → SMS Center → SMS Permissions records permission already
obtained through another channel. The Admin selects a direct-contact audience,
purpose, source, actual collection date, concise evidence and grant/withdrawal.
Preview deduplicates phones and excludes SMS opt-outs; confirmation re-reads the
full server audience and writes the batch plus audit atomically. Reviews last
10minutes and are actor-bound; retries cannot create duplicate records.

This is an Admin attestation, not independently verified consent or a new website
opt-in. There is no arbitrary phone import or reseller-only audience bypass.
Single-contact selection uses the same workflow. At most1000 unique numbers may
be registered per reviewed batch; free-entered sending/test numbers cannot be
used to manufacture a permission relationship.

## Permission precedence

- SMS waitlist unsubscribes and latest customer SMS withdrawals win over grants.
- Shared numbers retain conservative withdrawal handling across related accounts.
- Account-bound withdrawals survive account phone changes until customer
  reconsent; a historic Admin grant cannot silently clear that withdrawal.
- Admin-recorded withdrawals also block sending and cannot be overwritten by
  another historical attestation. Correction/reconsent handling for those records
  requires a separately reviewed process; it is not an unrestricted override.
- Marketing needs explicit permission for marketing. Automatic buyer order SMS
  needs transactional permission. Dedicated channel-relocation notices require
  service/operational permission or the customer's own SMS service-update choice.
- Manual generic support notices retain the established direct active-buyer
  relationship rule; Admin-recorded operational permission also supports direct
  recipients and other appropriately authorized direct contact records.
- Recipient permission never establishes purchaser identity, account ownership,
  personal spending or access to another customer's financial information.

The customer's account screen displays prior permission sources. Updating one
checkbox writes only that purpose. Legacy clients retain explicit two-choice
behavior. Permission evidence, source and withdrawals remain separately stored.

## Manual-only migration and compatibility

`server/db/smsPermissionsV2.sql` must be separately reviewed and installed through
the authorized production database process, with existing backup/recovery gates
satisfied. It is NOT imported by startup initialization and is NOT applied here.

It adds one private RLS table, `mysteryhub_sms.permission_records`, with actor,
phone, purpose, source, evidence, collection/recording dates, review/request IDs,
input digest, uniqueness and an indexed phone/purpose history. It revokes browser
roles' privileges and adds the distinct `channel_notice` preset without changing
existing templates or customers' choices. V1's source CHECK remains unchanged.
It does not update activation settings or touch orders/financial records.

Without this migration, existing SMS routes continue to work, while Admin prior-
permission registration and the new preset honestly remain migration-pending.
No in-memory substitute claims successful permission registration.

Permission records retain minimal evidence needed to honor grants/withdrawals;
do not enter private message text or secrets in reusable evidence. Expired review
payloads follow the existing preview retention policy. Durable review IDs remain
as identifiers without a foreign key that would prevent review-payload pruning.

## Implemented API additions

All routes below require existing active Admin auth and private/no-store responses:

- POST `/api/admin/sms/permissions/preview`: `{filters, selected?, purpose,
  source:'previously_obtained'|'admin_recorded', evidence, obtainedAt, granted}`.
- POST `/api/admin/sms/permissions/confirm`: `{reviewId,requestId,confirmed:true}`.
- GET `/api/admin/sms/permissions?page=1`: latest25 permission evidence records.

GET readiness adds `permissionManagementInstalled` and a bounded-age API check
status bound to current private configuration. No key, secret or fingerprint is
returned. Provider authentication errors are reported as safe provider failures,
not confused with the Admin's own session being unauthorized.

PUT own SMS preferences accepts optional `changedPurpose`, preserving untouched
permissions. No Admin can use that customer route to alter another account.

## Official channel relocation

Choose Official WhatsApp Channel Announcement. Enter and explicitly confirm the
real `https://whatsapp.com/channel/<identifier>` destination. There is no invented
or prefilled channel link. Preview and queue bind the URL and exact message; missing
confirmation, credentials, tracking parameters and conflicting links are rejected.
AI may propose wording but cannot change recipients or send. Discounts/advertising
remain marketing; selecting a relocation template does not authorize arbitrary
financial or promotional claims as service notices.

Review recipients, real exclusion reasons and segment/credit estimates, check
provider credits, confirm, then Send approved SMS. The durable worker submits;
copying remains an optional fallback. Queueing requires a current credit check
covering the estimate and reserve, and dispatch checks fresh credits again.
Sender approval is operator-confirmed unless independently established with
Arkesel. Sandbox never proves handset delivery.

## Delivery and automated orders

V1's bounded adapter, pre-submit marker, single attempt, uncertainty, HMAC,
timestamp, replay, recipient matching and order truth protections are retained.
No uncertain request is resent. Acceptance, submitted/queued provider states,
delivery, failure, expiry and investigation remain distinct in Admin.

Status reconciliation rotates a bounded20-message selection before its read-only
provider request, using existing `updated_at` as an operational-touch timestamp.
Unchanged statuses or a provider failure can no longer keep the same first20
messages ahead of later messages forever. No order state is changed. Manual
refresh/status checks update the displayed report list.

Automatic events recognize prior transactional permission and do not consult push
permission. Event deduplication and the activation cutoff remain unchanged. No
historic-order backfill, automatic activation or paid test is authorized by merge.

## Qualification and rollback

Mock HTTP, disposable PostgreSQL and real-browser tests are not real Arkesel
qualification. If Codex lacks a provider credential binding or authenticated Admin
session, balances/signing/runtime mode cannot be independently queried through
Render MCP. Admin's Check provider credits and Verify provider signing perform
safe checks using backend-only credentials. Never paste credentials into chat.

Before any paid test, obtain explicit founder approval for exactly one allowlisted
number. Keep automatic SMS off, verify sender/signing, run the ordinary sandbox
contract check, then separately approve live mode. Confirm handset receipt and
signed/provider status evidence; do not equate acceptance with delivery.

Rollback: pause SMS through existing controls and revert the code if necessary.
Keep permission and message evidence; never erase opt-outs or retry uncertain
messages. No destructive schema rollback or financial correction is needed.
