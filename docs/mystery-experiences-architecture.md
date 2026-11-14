# Mystery Experiences Core V1 — architecture and ownership

Base: remote main7de758510d1fcc797f35a4e1e1a1526e3d575d52, 8 November2026. Visible open PR: held draft69 only. Claude seasonal branch was not visible; no branch imported.

## Inventory and plan

Existing: PostgreSQL shared pool/test guards; active Admin sessions; transactional AdminAuditStore; publicHtml/social-head escaping/canonical origin; campaign privacy/bot filters and analytics_events; campaign links/touches and frozen order attribution. Reuse these. No new payment/referral/conversion attribution mechanism.

Missing: seasonal durable control and evaluator, anonymous persistent greetings, management/idempotency protections, greeting metadata and event contracts. Add one optional private schema installed explicitly, never from initDatabase. No memory production fallback. Test via disposable PostgreSQL with non-superuser owner.

Stages: shared schedule/content contracts; optional schema and bounded transactional store; gated public/Admin APIs and atomic audit; metadata integration; extend existing growth vocabulary; native/HTTP/security regression; independent review and review-ready PR. Do not merge/deploy/install/activate.

Ownership: new shared/mysteryExperiences.ts, server/db/mysteryExperiences.sql and experienceStore.ts, server/services/experienceService.ts, server/routes/experienceApi.ts, tests and docs. Minimal integration only in server/routes/api.ts, server.ts (API mount if needed), publicSocialMetadata/publicHtml, shared growth vocabulary and campaign destination validation. Do not edit src/App.tsx, homepage/navigation/auth/checkout/customer CSS/Creative Studio/artwork.

## Decisions

One supported calendar pack christmas-2026, Africa/Accra (UTC; no DST), start-inclusive/end-exclusive phases. Calendar code is versioned; durable config separates approval, enablement and bounded override. Global deployment gate defaults off. Public queries cannot preview; Admin-only stateless preview never writes configuration. Public state has no unapproved pack details. No cron needed for transitions; no stale config cache is used.

Greetings use random144-bit public IDs and an independent256-bit client-created management secret (hash only at rest). Client persists secret + UUID idempotency key before create, so a lost-response retry recovers exactly the same share URL without a lost server-generated secret. Same key/different content conflicts. No accounts required. Revocation never accepts public share ID alone.

Retention proposal (requires launch review): greetings expire365days after creation; revoked/expired content purge after30days, analytics90days, quota hashes48hours. Bounded Admin maintenance; no new worker. Content never enters audit/analytics/OG. No per-view image generation. Initial approved brand image is an explicitly interim preview, not final festive artwork.

Durable write budgets use HMAC socket-peer identity and global limits, with no trust of arbitrary X-Forwarded-For. Render may aggregate peers: launch must verify/tune trusted edge behavior before anonymous public creation is enabled. Read limits are process-local plus bounded concurrent DB work; no per-read quota writes. Growth events use existing infrastructure and eligibility filters; estimated human events are client claims, never sales/WhatsApp delivery proof.

Canonical share path /g/:opaqueID is implemented in backend raw HTML/API metadata. Static hosting forwarding and Claude recipient/creator screens are explicit separate launch requirements; metadata alone does not make a recipient frontend. New features default disabled and require installed schema + abuse secret + separately approved routing/content/frontend acceptance.
