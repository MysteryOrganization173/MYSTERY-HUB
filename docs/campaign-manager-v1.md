# Campaign Manager V1

## Pre-implementation audit — 4 November 2026

Base main: `04b95af1cd882cb7fa893228245a554ac67d36e5`. Clean-main isolated
regression: 2,962 passed, zero failed, 39 skipped (3,001 total).

Existing Growth Analytics uses `analytics_events`, bounded UUID/browser sessions,
coarse source/medium/campaign classifications, DNT and staff/preview exclusions,
rate-limited ingestion and private read-only aggregate reports. Website events
use the same table but remain a distinct website namespace. Current campaign
reports infer an earliest authenticated account touch within the reporting window;
they neither implement last-touch order attribution nor cover guest/store orders.
The existing checkout-open events measure opening a sheet, not submitting it.
There is no campaign/link/spend registry or immutable campaign order snapshot.

Paid truth already lives in Orders: successful GHS Paystack/Wallet payment with
`paid_at`, excluding explicitly marked test fixtures. Delivery requires separate
authoritative status/time. Refund truth requires provider-verified resolution or
matched original Wallet debit/refund ledger credit, not a refunded-looking label.
Manual compensation and manual fulfilment must remain separate.

There are two order INSERT implementations: the ordinary `createOrder` and the
atomic MTN duplicate-check insertion. Direct, Wallet, Marketplace and AFA orders
also use different route/service entry points. Capturing attribution in analytics
events or a payment callback would be too late and could reassign an existing order.

The static Blueprint has an SPA catch-all, but production's canonical apex was
previously moved to the existing API Web Service, which serves HTML and API routes
together. This must be re-verified against actual Render state before release.
Use an Express short-link redirect before SPA routing, plus a lightweight static
SPA fallback that calls the same resolver. Do not assume external rewrite syntax
or change hosting/DNS. Preview crawlers must not mint conversion attribution.

## Implementation contract

- Private, backend-owned campaign, immutable link, manual spend and expiring touch
  records. Reuse `analytics_events` for bounded daily request counters and distinct
  observed visit/submission events; no external analytics vendor.
- Six random URL-safe characters, database uniqueness and bounded collision retry.
  Codes grant no account access. Destination paths are explicitly allowlisted and
  published website destinations are validated server-side.
- Temporary, non-cacheable redirects. Unknown codes fail safely; paused/archived
  campaigns create no new eligible touches and preserve historical evidence.
- Opaque server-issued attribution token, hashed at rest, bound on an observed
  landing to the existing browser/session identity. Last eligible touch within
  seven days, cleared on account switch/logout and subject to existing privacy
  exclusions. Cross-device and unavailable-storage attribution are unsupported.
- Resolve optional attribution before a financial transaction. Carry only a
  validated bounded snapshot into the initial order INSERT, including guest MTN
  insertion. Freeze original null as well as non-null attribution. Replays, later
  adverts, callbacks and analytics requests cannot modify it.
- Runtime tracking failure is best effort and must not reject a purchase. No
  payment verification, supplier, pricing, earnings or referral ownership changes.
- Admin registry/detail, links, audited budgets/spend, daily trends, distinct
  funnels and campaign/channel/link/destination/service/date filters. GHS amounts
  are integer minor units. Gross ROAS is not profit; absent/zero spend gives no
  ROAS/CPA, and actual net profit remains unavailable.
- Campaign conversions use frozen order snapshots. Existing broad UTM acquisition
  observations retain their history and are explicitly labelled as a different
  measure. Public customer-site traffic is never added to platform traffic.

## Ordered verification and release plan

1. Validate the data model, access restrictions and destination/token rules.
2. Implement redirect/landing/submission and initial-order attribution boundaries.
3. Build bounded aggregate reports from authoritative Orders/refund evidence.
4. Deliver Admin management and responsive reporting; preserve Promotion Kit.
5. Test disposable PostgreSQL initialization twice, role restrictions, immutable
   snapshots, separate-connection races, guest/store checkout and refund evidence.
6. Run focused/full isolated regression, TypeScript, production build, six-width
   synthetic browser checks and separate independent review. Preserve held PR #69
   and Claude's unrelated branches.
7. Reconcile current main, require GitHub checks, merge normally only when gates
   pass, then verify both actual Render revisions, routes and protected analytics.
   No fake production clicks/sales or live financial tests. Record actual release
   evidence after deployment rather than inferring it from local tests.

## Delivered behavior and operational definitions

Admin → Analytics & Growth → Campaigns contains the registry, campaign settings,
immutable tracking links, copy actions, pause/reactivation/archive, actual-spend
entry and audited corrections, filters, activity funnel, daily traffic/paid trend,
and campaign/link/channel/destination/service comparisons. Budget is a plan;
spend is entered separately. No synthetic data or examples populate production.
An explicit zero expense can record known zero spend. Unknown or zero spend has
no ROAS/CPA. Partial link/channel/destination/service filters never invent a share
of campaign-wide spend. Net profit stays unavailable. Supplier cost is labelled
as a recorded order snapshot, not a reconciled settlement.

Campaigns, links, spend and touches use four private growth_* tables. A nullable
orders.campaign_context JSONB column and an UPDATE trigger freeze attribution,
including original SQL NULL. There is no historical attribution backfill. Existing
orders, payments, ledger, customer sites and published snapshots are not rewritten.
Both order INSERT paths persist the snapshot. Old application versions remain
compatible with the additive schema. Startup executes CAMPAIGN_SCHEMA after its
required tables exist and before final backend RLS initialization. No manual
production migration script is needed.

API: /api/admin/campaigns (registry/create), /:id (detail/update), /:id/links,
/:id/spend and /report. Staff bearer sessions remain authoritative. Revision UUIDs
prevent overwriting changed settings/spend. New expense requests require a stable
requestId UUID: identical retries return the original entry; altered retries are
rejected. Corrections retain before/after evidence in the existing Admin audit.
Links are immutable in the API and database. A maximum of 50 links per campaign,
5,000 campaigns, 100-row registry pages, 1,000 selected report links and 100-row
breakdowns bound the V1 manager. Narrow filters when the reporting limit is reached.

Public /c/:code resolves six random URL-safe characters using a uniqueness
constraint and up to eight collision retries. Only exact existing routes /, /app,
/data, /afa, /marketplace, /website-builder, /earn, /services and published
/sites/<slug> paths are accepted. There are no arbitrary URLs, query strings,
fragments or redirects to account/admin routes. Data modes without a separate
canonical page are not invented as landing routes.

The canonical Render Web Service serves the SPA and API together, and handles /c
before the SPA fallback. A separately built Static Site has a small /c SPA resolver
using its existing API base URL; no rewrite syntax, DNS or hosting change is
required. Active links use a non-cacheable 302. Unknown links give a safe 404;
inactive links show a 410 and an untracked approved continuation (home if the
website is unavailable). A two-second bounded catalog cache can briefly lag a
pause or unpublication across processes. Current checkout publication checks
remain authoritative. Known-destination redirects wait at most 500 ms for optional
tracking; saturated telemetry skips attribution rather than blocking navigation.
Catalog unavailability still returns an honest safe error, not an invented target.

## Attribution and report policy

A server-created 32-byte opaque token is hashed at rest and expires seven days
after the link request. Landing capture strips only campaign_touch from the URL,
retaining referral, UTM, deep-link and fragment data. Browser IDs and sessions reuse
the existing growth identity. The server binds a touch to that browser and, when
known, its authenticated user. A rapid checkout can bind the issued touch before
an optional visit arrives, without fabricating a visit. Tokens bound to another
browser/account cannot be transferred.

The last unexpired bound touch eligible for the checkout scope wins: platform
checkouts use platform touches; a reseller checkout uses touches for its exact
server-selected site. A newer unrelated storefront touch does not hide a valid
direct/site touch. This is browser-local attribution, not cross-device or lifetime
referral ownership. Guest→sign-in retains the journey; logout/account switching
clears the browser token and invalidates queued observations. Staff, DNT and GPC
observations are excluded. Preview routes cannot initiate measurement/commerce.
Storage blocking, expiry, tracking failures and insufficient evidence result in
an unattributed order, never a rejected financial operation.

Middleware resolves optional evidence before any payment/Wallet transaction,
with two concurrent optional reads and a 600 ms checkout deadline. Lingering DB
work retains its slot. The order constructor ignores arbitrary submitted campaign
names/snapshots. Attribution is written once at creation. Payment verification,
callbacks, webhook, supplier, earnings and referral logic are unchanged. Guest,
authenticated, Wallet, AFA, Marketplace and published-store orders share this
boundary; a replay cannot reassign an existing order, including one born untracked.

Total requests include repeat/crawler requests. Likely-human requests exclude
known crawlers, preview bots, HEAD, prefetch and privacy opt-outs, but are estimates,
not unique verified people. Server-only short-link GETs cannot identify a staff
account held solely in browser storage; authenticated staff landing/checkout events
and staff orders are excluded. Observed visits deduplicate by touch/session;
checkout submissions deduplicate by touch/attempt UUID and are emitted at the
validated initialization request, never at bundle viewing. Events cannot claim a
payment. Bounded rate/concurrency limits may undercount abusive or saturated traffic.
No raw IP or full User-Agent is stored in analytics.

Verified sales require server-successful GHS Paystack/Wallet orders with paid_at,
excluding marked synthetic fixtures, operator-recorded and complimentary orders.
Delivered counts additionally require current delivered status and delivered_at.
Provider refunds require an exact processed/refund/reference/amount resolution
with matching private resolution history. Automatic Wallet refunds require the
completed original purchase debit and exact completed matching refund credit.
A supplier refund, manual compensation or refunded-looking status is not proof of
a customer refund. Refund timestamps are reconciliation/verification dates, not
proof funds are already visible at the customer's bank.

Paid, delivered and refund totals use their own event dates. Funnel bars show
period activity, not a single cohort. The conversion denominator is distinct
touches first observed in the visit period; numerator counts those touches with a
verified purchase after their first visit and before the exclusive report end.
Multiple purchases from a touch count once in conversion. Service filters restrict
financial outcomes, not generic traffic. Gross revenue includes reseller customer
retail sales and is not platform income/profit. Legacy UTM acquisition retains its
older first-authenticated-account cohort and is explicitly labelled separately.

Raw campaign observations older than 90 days and expired touch identifiers more
than 90 days past expiry are cleaned opportunistically in bounded batches of 500,
at most hourly when links are used. This is best-effort retention, not a guaranteed
deletion deadline; a quiet site or backlog can delay it. Daily aggregates, link
history, manual spend, audit, original order attribution and all financial evidence
are retained. Existing growth/website namespaces are never pruned by this feature.

## Verification evidence — 4 November 2026

- Clean main: 2,962 pass / 0 fail / 39 skip / 3,001 total.
- Full isolated candidate regression: 3,001 pass / 0 fail / 40 skip / 3,041 total.
  No inherited failures were used to waive a gate. The added native suite is opt-in.
- Focused Campaign Manager + Growth: 69/69 pass.
- Native PostgreSQL 17.6, fresh loopback cluster, non-superuser owner without
  BYPASSRLS: Campaign Manager 19/19, financial reconciliation 85/85, private-table
  access 10/10. No production DB configuration or external financial calls.
- Native coverage includes repeat initialization, matching SQL mirror, role grants,
  collision retry, concurrent deduplication/revisions, stalled analytics redirects,
  DNT/GPC, guest/auth binding, direct/store separation, seven-day expiry, both order
  INSERTs, immutable original NULL, no referral mutation, idempotent spend, verified
  payment/delivery/refund evidence and unchanged financial rows on repeat startup.
- TypeScript and production build pass; diff check passes. Existing chunk-size
  advisory remains non-blocking.
- Compiled synthetic Admin browser checks at 320/360/390/430/768/1280: no overflowing
  controls, responsive settings, scroll-contained comparison tables. Campaign
  create, spend, link creation, copy, pause/reactivation and error/retry observed.
  Screenshots and logs are private local evidence, not production sales.
- Independent read-only source review found and drove fixes for redirect blocking,
  duplicate spend on response loss, combined DNT/GPC and cross-store touch selection.
  Final review found no remaining critical financial/security blocker. The cache and
  best-effort retention limits above remain documented.

## Release and recovery

Keep PR #69 and pending Claude artwork branches separate. No new environment
variables or secrets are required. Both existing Render services auto-deploy main;
the canonical Web Service deploys its API and built SPA together. The separate
Static Site can temporarily show an unavailable Campaigns report until the API
revision is live; collection is optional and cannot fabricate financial success.
Normal startup performs only the additive schema. Verify successful startup, exact
live revisions, unknown-code 404, public/service/site routes, unauthorized 401 and
authorized empty/real aggregate reads. Do not seed production campaigns or fabricate
clicks/sales for screenshots. Do not invoke real payment/supplier/refund tests.

If release health fails, leave financial operations untouched and use the retained
previous application artifact via the supported Render rollback procedure. The old
code ignores these additive fields/tables. Do not drop schema, delete campaign or
financial evidence, reset the database, force-push or alter DNS to recover.
