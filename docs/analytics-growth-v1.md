# Analytics & Growth Center V1

## Audit and design (before implementation)

Base: `5de77c9927b3a1b452f20b4c97eff389bf156939`, including Claude's reseller/AFA PR64. Existing `analytics_events`, WebsiteAnalyticsStore and Builder tracking remain authoritative for their existing observed events. Production audit found only website-prefixed events: no historical platform page, campaign or installation funnel data exists. Owner-site events must never be counted as Mystery Hub platform traffic.

Use the same table for a strict `growth_` event allowlist. No parallel analytics vendor/table, fingerprint, raw URL, contact, account ID supplied by callers, private content or payment data. Browser UUIDs are approximate browsers, not people. A visit expires after 30 minutes idle; account logout/switch rotates its session and clears campaign attribution. Visitor identifiers rotate after 90 days. Denied storage/network/DNT is respected without blocking product actions.

New events: platform page view (including /app), account/session linkage, checkout opening, Marketplace detail/inquiry opening, install action, actual browser prompt shown, prompt accepted/dismissed, browser appinstalled, and standalone session launch. Only browser appinstalled means an observed installation event; manual Samsung/iOS installation is not exactly measurable. Standalone launches are visits, not installs. Deduplication is server-side, with bounded client suppression; staff, isolated previews and published sites are excluded.

UTM source/medium are coarse allowlists; campaign is a bounded slug, never a full URL. External referrers become coarse known-source categories, never stored host/path/query. Attribution persists within a visit across navigation and legitimate registration, but does not change Mystery Earn ownership. Campaign conversions are only authenticated account-linked observations after a touch; guest/cross-device conversions are unavailable. No overall sales/visitor ratio compares unrelated historical populations.

Date windows are 7/30/90 Accra calendar dates including today's partial day, ending at report generation. Server queries aggregate and limit results, not download raw histories. Short caching coalesces requests; read-only transactions, statement timeouts and existing five-connection pool are preserved. Partial domains return null plus an explicit warning, never fictional zeroes.

Business sources: customer users.created_at; verified Paystack/Wallet orders paid_at (GHS, success); authoritative delivered_at/status; verified customer refund resolution (not supplier-refunded labels); website_sites creation/current publication plus distinct server publication events; Ultra enquiry records; referral attribution/reward order records. Test-fixture orders are excluded. Complimentary/operator-recorded activity and Wallet topups are not paid sales. Gross sales include original paid orders before refunds; refunds have their own verified completion period. They are not automatically netted across unrelated cohorts. Snapshot supplier costs are labelled recorded costs, not final settlements. Actual processing fees, platform net profit and unreconciled platform earnings remain unavailable. Seller sale earnings are separate, never platform revenue or Wallet balance.

Schema is additive: three focused analytics indexes and explicit backend-only access/RLS. No existing data migration, backfill, financial mutation, reseller UI change or notification activation. Raw-event retention is not silently changed: V1 bounds reports to 90 days and identifiers to 90 days; a reviewed scheduled archival/retention operation is a follow-up before material traffic growth. Ingestion is rate/concurrency limited.

Short campaign aliases are deferred: approved first-party /app or service URLs with sanitized UTM parameters provide useful attribution without introducing redirects, an alias registry or open-redirect risk. Never put contacts or references into campaign slugs.

## Release and rollback

Test schema twice on disposable PostgreSQL, aggregation fixtures, authorizations, concurrency/dedupe, browser lifecycle, stale session/range results and mobile layouts. Reconcile latest main before normal PR merge. Startup applies only reviewed additive indexes/access hardening. Older clients/backends remain compatible; tracking failure is nonblocking during rolling deploys. Verify both actual Render revisions and public/Admin checks. No live financial tests or fake production events/backfill.

A normal corrective/revert release can remove the UI/collector while leaving additive indexes and retained evidence in place. Do not restore financial data or disable database protections as rollback.

## Preserved follow-ups

Claude reseller work; consenting-device notification acceptance; November SMS data-ordering pilot; Marketplace lead tracking; Builder creator contact capture; individual templates; AI memory/voice; developer API; custom domains/Builder monetization; financial/operational maintenance. None are implemented here.

## Final independent verification (29 October 2026)

- Native disposable PostgreSQL 17.6: 10/10 checks, including repeat initialization, exact synthetic aggregates, malformed refund evidence, separate-connection deduplication, public-role restrictions and anonymous/customer/admin HTTP authorization. No production test writes.
- Full isolated regression: 2,706 passed, 2 failed, 33 skipped (2,741 total). Both failures independently reproduced on unchanged current main `5de77c9`: the V5.2 Signal checkout source assertion and compact gallery source assertion expect LF in Windows CRLF files. No related implementation was changed.
- TypeScript, production build and diff check passed. No new dependencies. Client event delivery is serialized, bounded and best effort, separate from financial operations.
- Compiled synthetic HTTP/browser verification: Overview, Acquisition, App adoption and Business at 360/390/430/1280px, with no horizontal overflow. Empty, partial, error/retry and delayed staff-session/range transitions checked. Screenshots and test logs are kept privately outside Git.
- Existing production analytics table audit: approximately 1,027 website events / 568 KiB before rollout; owned by postgres, public roles already denied access, deployment role bypasses RLS. New indexes/access hardening introduce no row updates/deletions or backfill.
- The public Help FAQ explains the new first-party tracking. Tracking excludes sensitive fields and full URLs; signed-in observations are used only in staff aggregate reports. Raw-event retention/archival remains a documented follow-up, not a claimed automatic deletion policy.
- Production release evidence (final merged revision, both Render deploy IDs and live smoke checks) must be recorded after deployment; local tests do not prove production release.
