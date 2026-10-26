# P0 Notifications vertical-slice integration

## Candidate and real contracts

Combines backend #51 (`c54ca80af41f64d0c03f5f2adc22094bdd4861f5`) and frontend #48 (`7e3311828bcee4094b553d9b72546dbe8846ba9c`) on the released AI/Orders main `2314c5f220cf103ce7db9e8d969f3cfa42d88c94`. Preserve both the order-management and private-notification schema initialization, in that order. The SQL mirror contains both. No financial calculations, supplier dispatch or payment execution behavior is changed by the integration adapters.

Production defaults now use real Bearer-authenticated, non-cacheable HTTP clients. Offline pending clients are explicit injectable test fallbacks, not the deployed UI. Admin templates, customer choices, subscriptions, audience previews, campaign creation, history and safe details use `backend-p0-v1.md` / `notifications-b3.md` routes.

There are eight backend defaults, not fictional local starters. Five automatic transactional templates are locked; custom templates are marketing only. Supported tokens are `{{appName}}` and `{{eventLabel}}`. Save edits as an audited marketing template before preparing an audience; a campaign submits only its expiring, actor-bound preview ID, a stable idempotency key and explicit confirmation. One-customer announcements still require that customer's marketing opt-in. Draft edits and template changes invalidate prepared confirmations. A timeout never manufactures send success or rotates the retry key.

Provider acceptance is labeled Accepted, never Delivered/Read. Each history entry is one device delivery, with queued/retry/invalid/skipped/failed states mapped explicitly. Counts distinguish devices, consenting accounts and account-update events. The phone preview shows the actual generic push packet; personalized inbox text is shown separately and retrieved only after authentication.

Customer promotional choices map to the backend's `marketing` boolean; preference updates are atomic last-write-wins, not falsely versioned template updates. A private SHA-256 endpoint digest identifies this browser's current, unexpired session binding without returning provider endpoints or keys. Explicit activation validates configuration before permission or registration. Passive rendering never subscribes. Account/session changes invalidate stale UI work; server sessions and ownership remain authoritative. Notification UUID links resolve through authenticated ownership checks and only `/orders` or `/app` destinations. Generated sites/iframes cannot activate push, and the worker has no fetch/offline cache.

## Rollout gates and safe state

Fresh private notification settings start **paused=true**, and this release must leave production paused. `WEB_PUSH_ENABLED` plus verified backend-only VAPID and encryption configuration are separate prerequisites; no secrets/environment settings are changed by integration. Preferences, templates and history work while delivery is disabled. No provider delivery, installed-device receipt or live Gemini generation is implied by passing local tests. Gemini receives canonical built-in generic text only, never edited customer content; AI output is a reviewable draft and cannot send.

The additive migration must run under the existing application role with schema creation, orders-trigger and private-table/function permissions. Verify repeat startup and separate-connection concurrency on disposable PostgreSQL, then inspect production startup and read-only table ACL/RLS after deployment. Keep the frontend paused until the backend schema/API revision is Live, manually deploy the static service once, verify both exact revisions, and restore frontend Auto-Deploy On Commit. The apex is served by the backend web service; do not infer it from the static service alone.

Rollback: keep sending paused, return application code through a normal corrective Git release if necessary, and preserve notification tables/outbox/audit history. Do not drop schema, rewrite customer orders, replay payments, or resubmit suppliers. B1's incoming-FK deletion guard must continue to reject any fixture with notification evidence. Do not send a test campaign to customer accounts.

## Acceptance still required before enabling delivery

1. Operator privately configures/validates the documented VAPID and storage keys, subject and feature flag; no credentials in source or reports.
2. A founder explicitly opts in on a supported device; verify permission, current-account binding, one-device revoke, account switching/logout and notification click ownership.
3. Resume only for a controlled consenting-device exercise. Verify one deterministic account update and one explicitly opted-in, single-founder announcement; verify acceptance separately from observed display. Never substitute bulk sends or a real financial transaction for this check.
4. Verify Android installed-app behavior and provider failure/expiry recovery before general activation. Keep paused if any gate fails. Live Gemini drafting needs independent provider access verification and is optional for ordinary notifications.

Local evidence is recorded outside Git in `C:\Users\AB\Documents\Codex\p0-integration-evidence`; final test totals and deployed revisions belong in the release report, not an assumed deployment claim in this document.
