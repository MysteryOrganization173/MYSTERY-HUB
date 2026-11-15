# Founder/operator setup — NOT executed by Codex

Code deployment does not activate paid SMS. Keep all sending switches false until
reviewed migration/configuration and explicit test approval are complete. Use only
the existing mysteryhub-api backend Render service (srv-daud2auk1f9s73bc5ph0), not
the frontend. Never put keys into VITE_ variables, browser code, screenshots or chat.

## 1. Install the reviewed schema, separately authorized

Keep ARKESEL_SMS_ENABLED=false, ARKESEL_AUTO_SMS_ENABLED=false,
ARKESEL_WORKER_ENABLED=false and ARKESEL_LIVE_APPROVED=false.
Have the DBA confirm the actual backend role/owner model, review
server/db/smsCommunicationsV1.sql, and run it once as the correct owner in the
approved PostgreSQL workflow. It is transactional and exact-version repeatable.
It is deliberately absent from startup migrations. Verify settings are paused,
auto_enabled=false, schema_version=1, all11 private tables have RLS and restricted
anon/authenticated privileges, and ordinary checkout remains healthy.
Do not paste a connection string into chat. No historical orders are backfilled.

## 2. Configure private backend environment values

| Variable | Value/source | Default |
|---|---|---|
| ARKESEL_API_KEY | Arkesel account API key; use a restricted application key if the provider supports it | missing |
| ARKESEL_SENDER_ID | Sender approved/registered on this account, max11 supported characters | missing |
| ARKESEL_SENDER_APPROVED | true only after checking provider approval | false |
| ARKESEL_WEBHOOK_SECRET | Provider-generated raw messaging signing secret, copied directly into Render secret storage | missing |
| ARKESEL_SMS_ENABLED | Master gate; false until controlled sandbox approval | false |
| ARKESEL_AUTO_SMS_ENABLED | Separate automatic-order gate; leave false during manual testing | false |
| ARKESEL_WORKER_ENABLED | Explicit background processing gate | false |
| ARKESEL_SANDBOX_MODE | true for documented ordinary non-billed sandbox | true |
| ARKESEL_LIVE_APPROVED | Separate explicit authorization for a paid test/live use | false |
| ARKESEL_TEST_ONLY | Keep true for one approved test recipient. false is separate general-audience authorization | true |
| ARKESEL_TEST_NUMBERS | Exactly one founder-controlled Ghana number during test-only mode | missing |
| ARKESEL_DAILY_CREDITS | Conservative daily estimated-credit ceiling, max10000 | 200 |
| ARKESEL_AUTO_DAILY_CREDITS | Automatic subset ceiling, max5000 | 100 |
| ARKESEL_CAMPAIGN_LIMIT | Recipient ceiling, max1000 | 100 |
| ARKESEL_CAMPAIGN_CREDITS | Estimated campaign-credit ceiling, max10000 | 200 |
| ARKESEL_LOW_CREDITS | Retained low-credit floor | 10 |
| ARKESEL_PREVIOUS_WEBHOOK_SECRET | Old raw signing secret during an authorized rotation only | missing |
| ARKESEL_PREVIOUS_SECRET_UNTIL | ISO time of rotation+24h, not an unlimited grace | missing |
| ARKESEL_TEMPLATE_QUALIFIED | Leave false. Personalized/template sends need separate live qualification; sandbox non-billing is not documented there | false |

API authentication: api-key header, JSON bodies. No V1 query-string key API.
Approval is not inferred from a configured sender string. If the account UI cannot
register/approve the sender, contact Arkesel support before proceeding.

## 3. Set up signed delivery callbacks

Arkesel's GET /api/v2/webhooks/secret retrieves configuration without creating one.
If not configured, generating/rotating through the provider dashboard or documented
POST /api/v2/webhooks/secret/rotate requires a separately authorized operator action.
Put returned data.secret directly into private backend ARKESEL_WEBHOOK_SECRET.
Never expose that response in public logs or paste it into Codex. The app never
rotates it automatically and the Admin verification endpoint never returns it.

The server-controlled callback URL is:
https://mysteryhub-api.onrender.com/api/sms/arkesel/callback

Ordinary send requests include this callback_url. Confirm Arkesel includes signed
X-Arkesel-Webhook-Timestamp/Signature/Id headers, with sms_id/status query fields.
Admin → Notifications → SMS Center → Settings → Verify provider signing compares
provider configuration privately and records a fingerprint bound to the current
API key AND local signing secret. A changed key/secret requires another check.
Signed status acceptance is independent of customer/Admin login.

## 4. Controlled non-billed sandbox acceptance

After schema/private configuration is reviewed, explicitly authorize sandbox only:
ARKESEL_SMS_ENABLED=true, ARKESEL_WORKER_ENABLED=true, ARKESEL_SANDBOX_MODE=true,
ARKESEL_TEST_ONLY=true and exactly one approved ARKESEL_TEST_NUMBERS value. Keep
ARKESEL_AUTO_SMS_ENABLED=false and ARKESEL_LIVE_APPROVED=false.
Use the established Render environment-change procedure; Codex does not manually
deploy. Verify Admin readiness, sender, credits and signing check. Resume only
this authorized sandbox mode in Admin. Enter the allowlisted number explicitly,
use Operational Service Notice, review one recipient/content/estimated credits,
and queue a single sandbox message.

Verify the actual provider response and account SMS history, no handset delivery,
no charge, message IDs, balance units and report behavior. Do not assume sandbox
callbacks prove real network delivery. Missing IDs remain uncertain; do not retry
blindly. The personalized/template endpoint is not part of this sandbox test.
Pause again if any contract/account behavior differs from the reviewed evidence.

## 5. One separately authorized paid SMS to the founder

Do not perform this from the current implementation task. After explicit approval:
keep test-only mode and the single allowlisted recipient; keep automatic SMS OFF.
Set ARKESEL_SANDBOX_MODE=false and ARKESEL_LIVE_APPROVED=true only for that approval,
with approved sender and verified signing fingerprint. Use a new, reviewed preview
and small budget. Queue exactly one message. Check handset receipt, authenticated
provider delivery report, recorded message ID and credit change. Provider accepted
is not delivered; delivered is not read. Investigate uncertainty instead of resending.

## 6. General or automatic activation is another explicit decision

Only after the controlled test, policies and SMS-specific choices are reviewed may
the founder separately authorize ARKESEL_TEST_ONLY=false for appropriate audiences.
Marketing requires explicit SMS opt-in and current suppression checks; a Contact
Hub export never grants consent. Automatic order SMS also requires explicit buyer
SMS order opt-in. Unknown guest payers are not invented. Recipient delivery/attention
updates require separate policy confirmation and carry no payer financial details.

To approve automatic service, set ARKESEL_AUTO_SMS_ENABLED=true, then enable the
chosen event policy in Admin. A fresh rollout cutoff excludes older orders. Keep
optional processing off to control cost. Reconcile credits and delivery outcomes
before expanding. Existing Web Push/in-app settings and paused worker are unchanged.

## Emergency stop and recovery

Pause SMS in Admin and set ARKESEL_SMS_ENABLED=false (and automatic/worker flags
false) through the normal authorized environment workflow. No frontend toggle
can bypass these gates. Already in-flight submissions cannot be recalled. Uncertain
messages are never automatically retried, even across restarts. Key/sender changes
require rechecking and fresh review. Preserve provider IDs, attempts and status
history for investigation. The manual pause SQL artifact is a separately approved
fallback; it does not delete order or SMS evidence. Run bounded retention manually
while the worker is dormant if installed data has reached its documented lifetime.
