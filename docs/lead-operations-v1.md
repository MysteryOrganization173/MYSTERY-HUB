# Lead Operations V1

Base: `3ccbf4a55602507e14e4c0753a6f731f486ff52d`. Supplier draft PR69 and Claude's Builder V7.1 are excluded.

## Existing capabilities and minimum design

Ultra already stores the complete immutable customer brief, original status `new`, reference and contact information. Marketplace already supports new/contacted/resolved/closed, notes and first-contact time. Reuse both existing tables and the private admin audit log; no CRM tables or financial posting.

Ultra gains separate lead_status/new/contacted/quoted/closed, optional private note, closure outcome and follow-up calendar date. Original brief, creation timestamp, attribution and original submission status are untouched. Marketplace retains its original status/note/contact fields and gains the same optional date and concurrency version. Accepted is an operator-reported lead outcome, never evidence of payment.

Existing admin routes keep strict staff authorization/no-store. The new versioned Marketplace path fails closed against an older backend during rolling deployment; the old Marketplace PATCH path also requires expectedVersion after release. An older Admin page must reload before saving, rather than silently dropping new fields. Ultra's new PATCH is unavailable on an older backend. Normal customer enquiry submission remains compatible.

## Contracts and concurrency

- GET `/api/admin/leads`: source-specific authoritative new/due/overdue counts, latest five new references and recent five updates. No customer names, contacts or private notes in alerts.
- PATCH `/api/admin/websites/ultra-enquiries/:reference` and `/api/admin/leads/marketplace/:id`: expectedVersion (required), status, adminNote (max 1000), followUpOn (null or YYYY-MM-DD, years 2000–2099), optional Ultra outcome. Unknown fields rejected.
- Existing lists accept bounded status/follow-up/search/pagination filters; literal searches escape LIKE wildcards. GET `/api/admin/leads/:source/:id/history` returns up to 20 private audit entries.
- SELECT FOR UPDATE + version comparison prevents lost edits across connections. A repeated/no-op request does not create duplicate history. A conflict returns 409 and preserves unsaved UI text for explicit reload. Note/status/date updates and sanitized audit insert commit or roll back together. Audit history stores actor, time, status/outcome transition, changed-note boolean and date/version, never note contents or contact details.
- Due is today's Africa/Accra calendar date, overdue is earlier; closed/resolved records are excluded. Closing does not delete the stored due date or brief. Reopening clears the closure outcome and makes any stored due date active again.

## Admin experience and alerts

Overview has a compact source-separated summary with links to exact filtered destinations. Ultra appears on Website Builder's existing badge and enquiry tab; Marketplace keeps its own badge and inbox. No new top-level CRM destination. Private workflow editor reuses the Admin visual system. WhatsApp opens the saved customer's validated number; opening it never changes status.

Admin checks lead counts every 60 seconds only while visible, refreshes on visibility return and successful edits, bounds each fetch to ten seconds, avoids overlapping polls and clears stale session responses. Initial historical new leads populate outstanding counts but do not announce fresh submissions. Later genuinely new references can show one dismissible in-app alert. This cannot notify a locked phone or a closed Admin app. There is no isolated external Admin delivery channel in the existing implementation; customer worker remains paused and unchanged. No outbound messaging or new notification events are generated.

## Schema and rollout

Version-controlled repeatable additive columns and two indexes, mirrored in schema.sql. Existing RLS hardening remains applied after initialization, no public grants or new policies. Existing original Ultra status CHECK remains unchanged, so rollback to an older binary cannot invalidate original records. Prior application versions ignore additive fields; retain them and the audit history during rollback. Never restore or erase customer/financial data to roll back UI.

Tests use a native disposable PostgreSQL 17.6 cluster on loopback, with a non-superuser, non-BYPASSRLS table owner. Production is inspected read-only before/after normal deployment; do not create or edit production leads as smoke fixtures. Original checkout and all unrelated worktrees are preserved.

## Verification checkpoint

Focused: 167/167 passed. Native PostgreSQL: 11/11 passed (repeat initialization, populated historical preservation, separate-connection conflict, fresh-connection persistence, audit-failure rollback, Marketplace regressions, source-specific counts, RLS and HTTP authorization). TypeScript and production build passed. Final browser/full-suite/adversarial release evidence is recorded with the release PR after completion; this checkpoint alone is not release approval.

Follow-ups: physical Android keyboard acceptance and separately gated external Admin push/email/WhatsApp delivery. No automatic outreach, customer campaign, pricing, Wallet, supplier, payment, website renderer/editor or Store Earnings work belongs to this release.
