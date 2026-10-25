# Backend P0 contract v1 — frontend handoff

Status: implementation in progress, not deployed. Do not infer these capabilities from current production. Three independent PRs target main: B1 `codex/backend-order-integrity-b1`, B2 `codex/mystery-ai-reliability-b2`, B3 `codex/notification-delivery-b3`. Claude owns UI. Check each PR's final report before integration.

All private endpoints use the existing Bearer session authorization and `Cache-Control: no-store`. A stale/expired credential never downgrades to guest access. Errors use `{error:string,code?:string}`; 400 invalid input, 401 signed out, 403 forbidden/password change required, 404 unavailable resource, 409 stale state/eligibility/idempotency conflict, 429 throttled, 503 dependency/configuration unavailable. Never display a provider acceptance as confirmed device display.

## B1 Order integrity

- `GET /api/admin/order-management/:reference` returns `{success:true,order,eligibility:{archive:boolean,restore:boolean,deleteTest:boolean,denials:string[]},history}`. Admin only. `order` retains authoritative raw status/payment information; customer classification is explicitly separate.
- `POST /api/admin/order-management/:reference` body `{action:'archive'|'restore'|'delete_test',confirmed:true,reason:string,expectedUpdatedAt:string,requestId:string}`. Reason 5–500 characters; requestId 8–64 safe characters. Returns `{success:true,action,orderId,archivedAt:string|null,deleted:boolean}`. Fetch details immediately before action; never offer deletion unless `deleteTest` is true. Deletion is for server-registered synthetic fixtures only, not a way to erase customer history. No Admin API marks a customer order as synthetic.
- Existing `GET /api/admin/orders` accepts `archived=exclude|only|include` (default exclude). Financial reporting and customer-owned paid history retain archived records. Archive does not resolve/refund an order.
- Public/account projections identify old unpaid failed attempts as payment attempts rather than delivery failures. Original stored payment and fulfilment facts remain unchanged.

## B2 Mystery AI

Existing `POST /api/mystery-ai/chat` request remains `{message,history?,activePage?,editorContext?}`. Existing `reply` success field remains. New additive diagnostics use `code`, `retryable`, `retryAfterSeconds`, `source` and `fallback`. A deterministic supported-service answer uses `source:'guide',fallback:true`; never present it as an AI-generated/provider answer. Cancel obsolete frontend requests with AbortController. Respect 429/Retry-After and do not spin automatic retries. No memory/transcript persistence or account/transaction tools.

## B3 Notifications

- `GET /api/notifications/config`: public `{enabled:boolean,publicKey:string|null,workerPath:'/push-sw.js'}`. Never request notification permission automatically. If disabled, explain configuration is pending, not that notifications are working.
- `GET /api/notifications/preferences` and `PUT` body `{transactional:boolean,marketing:boolean}`: authenticated. Marketing is false by default and requires explicit customer choice.
- `PUT /api/notifications/subscriptions` body `{subscription:{endpoint,expirationTime?,keys:{p256dh,auth}}}`: authenticated, tied to the actual current session; returns a device ID. Re-register when the account/session changes. No caller-provided userId. `DELETE /api/notifications/subscriptions/:id` revokes only the current account's device.
- `GET /api/notifications/inbox?offset=0` lists safe account-owned notification summaries. `GET /api/notifications/inbox/:id` returns owned details and a validated first-party destination. Push carries no personal order information; its click goes through authenticated inbox lookup. Logout, expiry, session revocation or account switch makes the old session's device ineligible.
- `GET /api/admin/notifications/templates`; `POST` to create; `PUT /:id` to edit/disable. Body `{id?,title,body,category:'transactional'|'marketing',enabled:boolean,expectedVersion?:number}`. Template changes are versioned/audited. Built-in transactional facts remain deterministic and cannot be converted into arbitrary automatic marketing claims.
- `POST /api/admin/notifications/preview` body `{templateId}` renders safe server-side sample data. No customer PII in preview or Gemini drafting.
- `POST /api/admin/notifications/audiences/preview` body `{templateId,userId?:string}` returns an expiring audience preview ID and eligible counts. No endpoint/key leakage. No arbitrary recipient endpoints.
- `POST /api/admin/notifications/campaigns` body `{previewId,requestId,confirmed:true}` sends only the prepared, still-eligible opted-in audience, with an idempotent request ID and explicit confirmation. A changed template/audience requires another preview. Marketing opt-in is enforced even for one specifically selected customer. No draft operation sends anything.
- `GET /api/admin/notifications/deliveries?offset=0` and `/health`: bounded safe delivery history and subscription/outbox health, never endpoint credentials. States distinguish queued, retry, provider_accepted, expired/invalid/revoked, failed and skipped; no unobserved delivered/read claim.
- `GET/PUT /api/admin/notifications/settings` controls the operational pause only, never secrets. Mutations require confirmation/reason and audit.
- `POST /api/admin/notifications/draft` body `{mode:'shorten'|'clarify'|'grammar'|'professional'|'friendly'|'titles'|'variation',templateId}`. Drafts use approved template text and safe placeholders only; no free-form customer data or recipient list. Returns draft only; unavailable Gemini never disables ordinary notifications.

Default templates: payment_confirmed, order_processing, order_delivered, delivery_attention, refund_update (transactional); maintenance, new_service, special_offer (marketing). Supported placeholders are allowlisted and rendered from authoritative server data or safe preview samples. Routine push text deliberately omits customer name, phone, email, amount and full order reference. Follow the final shared TypeScript contracts and template definitions; do not invent placeholders, discounts, delivery promises or statuses.

VAPID/public-key names, encryption key requirements, enable flag, migrations and worker operation will be documented in B3's final operational notes. Real delivery stays disabled without verified configuration. No production configuration is changed in this development session. The worker must not cache application/API pages or handle checkout requests. Existing PWA installation/manifest identity stays intact.
