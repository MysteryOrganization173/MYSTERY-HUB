# Mystery Experiences Core V1 — implemented integration contract

**Review branch only. Not merged, deployed, migrated or activated.** This is a backend/control-plane release. It does not include a visual Admin panel, creator/recipient screens, festive UI or countdown animation. Claude owns those interfaces. Base main: `7de758510d1fcc797f35a4e1e1a1526e3d575d52`.

## Ownership and reuse

Use `shared/mysteryExperiences.ts` for seasonal state, phases, countdown, greeting/template/variant/event vocabulary. New store/service/routers are isolated. Minimal integration is in `server.ts`, server social metadata, and existing growth reporting. No App/homepage/navigation/auth/checkout/CSS/Creative Studio files changed. No visible Claude seasonal PR/branch was available during audit; adapt the frontend to this contract at integration rather than merging an unfinished branch.

Existing active-Admin authentication, transactional AdminAuditStore, PostgreSQL pool/test guards, social-head escaping, canonical business origin, campaign bot/privacy filtering and analytics_events are reused. Campaign/referral/order/price/payment/financial code is unchanged. Optional request work is capped at two simultaneous transactions per process; existing checkout retains other pool capacity.

## Gates and installation — separately authorized later

All three environment gates default false (only exact `true` enables):

| Gate | Meaning |
| --- | --- |
| `MYSTERY_EXPERIENCES_ENABLED` | Allows approved/enabled seasonal configuration to affect public state |
| `MYSTERY_GREETING_LINKS_ENABLED` | Allows public retrieval/metadata and engagement endpoints |
| `MYSTERY_GREETINGS_ENABLED` | Allows creation, only when links gate is also true |

`EXPERIENCES_ABUSE_SECRET`: separate64hex-character secret for daily HMAC peer identities. Never send it to browsers/chat/logs. No existing secrets are changed. Secret absence fails write admission safely; presentation/configuration still has its separate safe state behavior.

`server/db/mysteryExperiences.sql` is an **explicit optional installation**, not imported by initDatabase or any startup path. Four tables in private `mysteryhub_experiences`: configuration, greetings, budgets, reports. RLS enabled; schema/table rights revoked from PUBLIC/anon/authenticated/service_role; no public policies or FORCE RLS. Use the established installer/backend owner identity, verifying actual production role compatibility beforehand. Do not assume the backend bypasses RLS.

Installation sequence after approval: keep all gates off → verify backup/actual owner role and existing analytics_events/Admin audit dependencies → apply SQL transaction with lock timeout → rerun safely → verify role/grants/constraints and disabled seed → configure abuse secret securely → integrate frontend/routing/artwork and exercise controlled nonproduction acceptance → obtain separate approval to enable appropriate gates/configuration. No production steps were executed by this assignment.

The schema has version-pinned start/end/timezone and code calendar version1, revisioned approval and enablement, bounded override, random unique share IDs, creator/idempotency uniqueness, content bounds, expiry/revocation indexes, parent FK/index, report deduplication and quota windows. New analytics indexes apply only to the experience namespace. Schema failure rolls back the namespace. Reapplication does not reset an approved configuration. Future packs require an explicitly reviewed definition/installation; no future celebration packs are fabricated here.

Rollback: keep gates off and revert application code; preserve installed data/schema. Do not automatically drop personal records or disable RLS. Physical removal after real data exists requires separate retention/backup authorization.

## API conventions

Routes below are implemented. JSON bodies are limited8KB before the general parser; JSON object input rejects unknown fields and has further5,000-character bound. Errors are sanitized, e.g. `{ "error": { "code": "INVALID_INPUT" } }`. No provider/SQL errors, messages or secrets are echoed. Responses use `Cache-Control: no-store, private`; HTML also has noindex/nofollow and no-store. Dates are ISO UTC; Africa/Accra has UTC boundaries/no DST.

Statuses:400 invalid input/template/phase/override/query/event;401 missing/invalid Admin session;403 non-Admin;404 uniformly unavailable greeting/wrong creator;409 revision/idempotency/duplicate-content conflicts or preview disabled;413 oversized body;429 limits/busy (Retry-After60);503 missing configuration/storage/creation gate/retention prerequisite (Retry-After30). Existing requireAdmin auth error formatting remains its established format.

### Public endpoints (no login)

| Method/path | Input | Output |
| --- | --- | --- |
| GET `/api/experiences/state` | No inputs; a preview/date query never changes authority | SeasonalState |
| GET `/api/experiences/countdown` | None | Authoritative target, serverTime, remainingMs, passed |
| GET `/api/experiences/templates` | Optional scalar occasion=`christmas-2026`/`new-year-2027`, random=`true`/`false` | schemaVersion1, curated templates, creationConfigured (gate presence, not DB-health proof) |
| POST `/api/experiences/greetings` | Creation body below |201 created /200 idempotent replay; shareId, canonical URL, expiresAt, duplicate |
| GET `/api/experiences/greetings/:shareId` |24-character opaque ID | PublicGreeting;404 invalid/expired/revoked/unknown |
| POST `/api/experiences/greetings/:shareId/revoke` | `Authorization: Greeting <creatorToken>`; no token in URL | `{revoked:true}`; repeated legitimate revoke is safe |
| POST `/api/experiences/greetings/:shareId/report` | `{reason:"abuse"|"spam"|"privacy"}` | `{accepted:true}` even for unknown valid-format ID; reports do not auto-revoke |
| POST `/api/experiences/events` | Event body below | `{accepted:true,duplicate:boolean}` or `{accepted:false}` for excluded privacy/bot/prefetch requests |

### Seasonal semantics

Example normal state (illustrative):

```json
{"schemaVersion":1,"active":false,"appearance":"normal","experienceId":null,"themeVersion":null,"phase":null,"timeZone":"Africa/Accra","serverTime":"2026-11-08T12:00:00.000Z","nextTransitionAt":null,"availability":"disabled","preview":false}
```

Only an approved+enabled config matching the persisted definition version/start/end/timezone AND deployment gate can produce seasonal state. Unknown version or read failure returns normal/unavailable; no stale-active fallback. In-flight config reads are coalesced; nothing is cached past the read. Multiple instances read the same persisted authority. Definition publication is independent of the clock and of preview.

| Inclusive start (Accra) | Phase | Exclusive end |
| --- | --- | --- |
| Dec1,2026 | christmas_season | Dec25 |
| Dec25 | christmas_day | Dec26 |
| Dec26 | boxing_day | Dec27 |
| Dec27 | new_year_transition | Dec31 |
| Dec31 | new_year_eve | Jan1,2027 |
| Jan1,2027 | new_year_day | Jan2 |
| Jan2 | new_year_celebration | Jan6 |

At Jan6 appearance is normal. An authorized manual override can intentionally select a phase for at most24hours; at its end, schedule resumes instantly from server time. No cron or persistent browser tab is needed. Public state does not expose unpublished definitions, revisions or Admin history.

### Admin APIs — existing active Admin Bearer session required

All paths start `/api/admin/experiences`.

| Method/path | Contract |
| --- | --- |
| GET `/` | Supported pack identity/version/calendar/end, persisted config, effective public state, countdown, deployment/integration blockers and latest30 safe audit entries |
| PUT `/configuration` | Full mutation object below; optimistic expectedRevision; same-transaction audit; revision increments on accepted change |
| POST `/preview` | `{phase:"christmas_day"}`; requires preview_enabled; returns preview:true scoped state valid15min, no DB mutation or public activation |
| GET `/reports` | Top50 aggregated report counts/share IDs/timestamps; no personal message or identity |
| POST `/greetings/:shareId/revoke` | `{confirmed:true}`; audit and revoke atomic |
| GET `/metrics?days=30` | Scalar7/30/90 only; valid/created/remix-context records, aggregate estimated engagement and explicit conversion:null |
| POST `/maintenance` | `{confirmed:true}`; bounded retention and same-transaction aggregate audit; not called automatically by startup |

Example full configuration body (illustrative; use current revision):

```json
{"expectedRevision":1,"lifecycle":"approved","enabled":true,"previewEnabled":true,"override":null}
```

Lifecycle is draft/approved/archived. Enabled requires approved. Override is null (restore schedule) or `{phase:"new_year_eve",until:"2026-12-31T23:30:00.000Z"}`; until must be future and at most24hours from server time, and enabled must be true. Expired revision409 means refresh/review; never silently overwrite another Admin. Audit records actor, time, previous/next safe config and revision, no personal content/tokens. Audit failure aborts the edit.

**Preview consumption:** fetch only using Admin auth, display in an isolated Admin preview context/frame; discard on logout, expiry and leaving preview. Never set global state/localStorage from a public `?preview=`. Published customer sites, editor, business owner and checkout must not consume this presentation state. This release supplies APIs/specification, not a completed visual Admin panel.

### Greeting creation and management

Before first request the frontend creates and persists `creatorToken` with32cryptographically random bytes/base64url(43characters), and UUIDv4 idempotencyKey. These are separate from the public144-bit share ID. Management secret stays only in creator private storage; never put it in WhatsApp/canonical links, analytics, referrers or logs. Lost secret has no unauthenticated recovery. Recipient possession of share ID grants no mutation privilege.

Example custom request, synthetic and not usable credentials:

```json
{"occasion":"christmas-2026","recipientName":"Ama","senderName":"Kojo","showSender":true,"message":"Wishing you a joyful Christmas!","variant":"gift-classic-v1","creatorToken":"<43-character crypto base64url secret>","idempotencyKey":"<UUIDv4>"}
```

For curated content omit message and send templateId (e.g. christmas-warm-v1). Template occasion must match. Random suggestion is server crypto selection from the curated catalogue, not AI generation. Variant IDs gift-classic-v1/gift-starlight-v1 are logical frontend references, not invented Cloudinary artwork IDs.

Text is NFC normalized, trimmed, code-point bounded: recipient/sender1–60; custom message4–600. It must contain letters/numbers. Markup delimiters, control/bidi characters except newline, and URL/protocol injection are rejected. Plain text only: frontend uses text nodes/React escaping, never dangerouslySetInnerHTML. This is validation, not comprehensive moderation or a guarantee of appropriate content. Reporting and authorized moderation remain necessary.

Hidden sender identity is not persisted and public response has senderName:null. No phone/email/contacts collected. The stored rendered template message is a snapshot; changing code templates cannot rewrite existing greetings. No editing endpoint exists in V1; creator can revoke. Greeting expiry is365days after creation, independent of the global theme/calendar. Stopping creation does not disable existing links; the separate link gate is an explicit emergency/launch gate, not a Jan6 switch.

Same creator secret+idempotency key+content returns the same durable link. Different content with same key409. Concurrent requests serialize. A changed-key identical payload within10min409 avoids accidental repeated records. Parent acquisition context is excluded from the content hash so a retry with changed consent does not manufacture another greeting. DB confirmation precedes any success; no memory records or client reconstruction. Optional analytics failure is isolated with a savepoint and cannot abort a durable greeting.

Example public response fields: schemaVersion, shareId, occasion, recipientName, senderName|null, message, variant, expiresAt. Internal ID, creator hash/secret, idempotency key, moderation flags and parent tracking never appear.

## Social preview and serving architecture

`GET /g/:shareId` in the Express public HTML responder validates live existence/expiry/revocation, then uses existing social-head injection/escaping and fixed `https://mysterybundlehub.com`. It never trusts Host, Forwarded, query message/name/image or user image URLs. Both people and crawlers receive the same HTML head. Unknown/revoked/expired404; storage failure503 with no-store/Retry-After30. No metadata GET records engagement.

Head: generic gift title, curiosity description, canonical and og:url without query/secret, existing approved app-preview image1200x630 JPEG, Twitter card, noindex/nofollow. Recipient, sender and private message are never in metadata. Existing approved image availability was verified HTTP200/image/jpeg; it is an **interim branded app card**, not final festive artwork. Claude must supply/approve the final fixed gift art; no dynamic per-person image rendering.

**Routing launch dependency:** Render read-only inspection confirms separate Node web and static frontend services, both tracking main. render.yaml still contains a static SPA catch-all; no infrastructure was changed. A static fallback cannot generate per-greeting existence/status metadata. Before launch verify the actual canonical `/g/*` route reaches this Express responder (through the existing canonical web origin or separately approved forwarding/domain rules), and that frontend assets load from it. Claude must also implement the recipient route; the current SPA does not render a greeting screen. The local native HTTP test proves backend HTML and cross-client API retrieval, not an already deployed customer screen or actual WhatsApp crawler cache refresh. Do not launch with generic homepage previews. Crawlers can retain old cards after revocation; generic private metadata limits harm, while live retrieval still refuses the greeting.

## Time/countdown integration

Countdown target is `2027-01-01T00:00:00.000Z`. Response includes serverTime, remainingMs and passed. Measure request/response elapsed time and estimate clock offset using midpoint; calculate remaining from target and corrected current time on every render, not repeated decrement. A monotonic elapsed timer from a synchronized sample avoids wall-clock edits. Re-sync on foreground/reconnect and scheduled transition, not every second. After target remaining=0/passed=true; use the same seasonal state for the New Year phase. No DB ticks, WebSocket or per-second jobs.

## Growth, attribution and privacy

Example event (synthetic):

```json
{"event":"greeting_open","shareId":"<24-character opaque ID>","visitorId":"<UUIDv4>","sessionId":"<UUIDv4>"}
```

Allowed: greeting_open, greeting_reveal, greeting_remix_started (require valid shareId), countdown_open, discovery_open, platform_navigation (optional share context). No arbitrary metadata, names/messages, payment claims or URLs accepted. Trigger after actual visible interaction/reveal/navigation, never from metadata GET/prefetch or URL generation. UserAgent bot/prefetch filtering and DNT/Sec-GPC reuse existing campaign eligibility. Respect the app's local analytics opt-out by not sending events; no permanent identity/fingerprinting. No event proves WhatsApp delivery, verified human identity, sale or installation. Use existing growth/PWA install events only when browser actually reports them.

Optional parentShareId at creation measures self-reported remix context, not a verified relationship; omitted entirely on DNT/GPC/bot exclusions. Server creation records are authoritative for operational totals, with best-effort creation analytics. Other engagement records deduplicate event+browser+session+greeting context using DB unique constraints. Existing Admin Growth report gets an optional experiences aggregate; dedicated Admin metrics joins no personal content. No signed-in user/account identity is added to these events.

**Campaign Manager:** reuse existing approved campaign short links for discovery/navigation to already supported platform destinations; let the existing landing/token/checkout flow validate attribution. Greeting events do not mint campaign touches or change order snapshots/referrals/rewards. Per-greeting campaign destinations and conversion claims are not invented; recipient frontend integration should preserve legitimate existing campaign flow. Existing financial reports remain authoritative. Cross-device identity/conversion is unknown; conversion:null is deliberate.

## Admission, capacity and retention

- Local public admission240requests/min/socket peer/process; create15/min; Admin60/min/peer before auth, then30/min/Admin. No raw X-Forwarded-For trust.
- Durable creation request admission240/hour/hashed peer +20,000/day global, charged before expensive replay/conflict checks. Successful creates separately20/hour/peer +1,000/day globally; limits are transactional across instances.
- Durable management60/hour/peer +3,000/day global includes failed valid-format credentials. Reports10/day/peer +1,000/day global, unique reporter/greeting; no auto-revocation from malicious reports.
- Accepted new events180/hour/peer +10,000/day global; duplicates do not create more records. All optional DB work capped at two concurrent transactions/process with2s statement/500ms lock timeouts and bounded responses.
- Public greeting/API/metadata reads use durable global60,000/minute credit reservations in batches100/process, expiring within30s and at minute boundary. Credits are published only after COMMIT; this avoids quota writes on every view. Local limits and DB concurrency still apply. Reservations are conservative under restart (unused credits are lost, never manufactured).
- No raw address is stored: daily HMAC from socket peer. Render can aggregate peer addresses; validate the proxy topology and tune initial limits with founder approval before launch. Do not silently trust visitor headers to evade limits.
- Personal content expires365days; revoked/expired content is eligible for deletion after30days. Bounded authorized maintenance deletes up to500greetings and5,000old quota/event rows per call. Events90days; quotas48hours with opportunistic indexed cleanup during admission/lease/new events/reports. Schedule approved daily maintenance through existing operations later; no worker is activated here.
- Creation refuses with RETENTION_REQUIRED when eligible old personal records remain, preventing unbounded accumulation if maintenance is forgotten. Revocation and retrieval continue; restore creation only after audited cleanup. Quotas/retention are conservative V1 launch policies requiring review before public activation.

## Verification and integration order

Run `npm test -- server/suppliers/__tests__/mysteryExperiences.test.ts`, `npx tsc --noEmit`, `npm run build`, full `npm test`, diff checks. Native opt-in test requires empty loopback database name ending `_test`, non-superuser owner and synthetic anon/authenticated/service_role roles: set only `MYSTERY_EXPERIENCES_POSTGRES_URL`, then `env -u DATABASE_URL NODE_ENV=test node --import tsx --test --test-force-exit server/suppliers/__tests__/mysteryExperiencesPostgres.test.ts`. Existing test safety rejects external DBs. CI creates its own database. Never use production credentials.

Claude order: consume shared seasonal/countdown contracts in preview-only context → build isolated Admin controls using current revision → implement creator secret/idempotency lifecycle and text rendering → recipient/reveal route+post-season display → fixed gift artwork → interaction-only analytics with existing consent/PWA/campaign flow → controlled integrated acceptance → separately authorize schema/routing/gates. No visual panel or final screen is claimed complete by this backend PR.
