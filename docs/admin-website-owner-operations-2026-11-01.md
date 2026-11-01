# Admin Website Builder owner operations

Baseline: `f3976fff20ae88b3388a49c9225c9af74ce54e37` (fresh remote main, November 1, 2026). PR #69 remains a separate draft and is not included.

## Demonstrated problems

- Inspect Site rendered a cached summary row and never called the existing private detail endpoint. It could not display account or business contact information.
- Summary used full site/content and asset reads plus one account lookup per site. Listing only needs bounded operational metadata and owner names.
- Published/Draft/Total cards retained conflicting search/template filters and did not reveal the list. A browser run against the original component reproduced the retained-search failure. While implementing, browser testing found that scrolling before filtered results arrived could stop above the results; revealing now waits for the matching list.
- Existing project counts already used current site rows/statuses and creation dates; publication and preview events were explicitly separate. No count-inflation defect was demonstrated. This distinction is preserved and tested in native PostgreSQL.

The initial read-only production aggregate was 20 nonarchived projects, 14 published, 6 drafts and 20 owners. Counts are time-sensitive evidence, never application constants.

## Implementation and access model

`AdminWebsiteStore` uses a metadata-only aggregate query for paginated lists, current project/status/template counts, recent records and asset totals. The existing event query/conversion calculations remain. A summary makes two database queries independent of the number of sites; an inspection makes one parameterized join to the site's authoritative account. No private contacts or arbitrary customer content enter the bulk response.

The existing `GET /api/admin/website-builder/:id` now returns a whitelisted projection with separate `owner` and `businessContact` objects. It uses the existing server-side `requireAdmin` role/session checks and `Cache-Control: no-store`, including authorization errors. IDs and filter inputs are validated. Public and owner website serializers are unchanged. No schema, RLS, grants, credentials or privileged frontend clients are introduced.

Business contacts come from the saved `content_json` settings. The Inspector explicitly warns that unpublished edits may differ from the public snapshot. Account contacts are separately labelled private account details. Missing values are null/“Not provided”. Phone formatting does not establish WhatsApp membership; the optional account link says “Try owner phone on WhatsApp” and includes this limitation. Business WhatsApp is presented first. Links contain only the requested recipient, without automatic message text. Mailto addresses are validated and encoded to prevent header injection. Public links use the primary configured domain and authoritative slug, only for published sites.

Inspection loads on demand, supports refresh/retry and suppresses stale results after site/session changes. Copy success/failure is visible. The existing shared Admin sheet supplies scroll/focus/escape behavior; force-unpublish retains exact slug confirmation, the existing locked owner transaction and audit, with a client-side duplicate-action guard. No admin content editing is added.

Metric cards clear search/template filters and pagination, preserve and explain the selected creation-date range, then focus/reveal matching results. Search/filter updates are atomic and debounced; obsolete requests are aborted and ignored even if a transport disregards cancellation. Refresh reports success/errors and returns to page one if a previously valid page disappears. Free Sites stays informational. Existing dark/green UI, sections and shared components are retained.

## Verification

- Original main regression: 2,766 passed, 35 skipped, no failures.
- New API tests against unchanged application code: 6 passed / 4 failed, demonstrating missing contacts, absent validated-ID behavior and stale-detail limitations. The original-component browser failed the Published-card search reset assertion.
- Repaired contact/API tests: 30 passed. Contacts, operations and existing Website Builder V1 together: 181 passed.
- Native PostgreSQL 17, isolated empty databases, non-superuser/non-BYPASSRLS owner: Admin 6 passed; existing RLS 10 passed; monitoring 7 passed. Tests verify current rows vs repeated events, dates, SQL wildcard/search/pagination, one narrow inspection/two summary queries, no bulk contacts, client denial and untouched financial rows, content and unpublish safeguards. The existing database-security CI runs all three suites.
- Browser harness: `python scripts/reviewAdminWebsites.py`, using Chromium, actual components/build CSS and synthetic APIs. Widths 320, 360, 390, 430, 768, 1440; filters/reveal/pagination/date ranges, private inspection, missing values, contact links/copy, errors/retry/refresh, reduced viewport keyboard focus, session and slow-response races, and duplicate unpublish prevention. No real accounts, messages or production mutations are used.
- TypeScript, production build and diff checks passed. Complete regression: 2,796 passed, 36 skipped, no failures. Native opt-in tests are separately executed; their normal full-suite skips are not counted as executed integration tests. Browser: 18 scenario groups passed across the six widths; the harness includes sticky-header clearance. Final CI results are recorded in the PR/release report.

Adversarial self-review checked private-data isolation, joins and query count, authorization before lookup, stale responses, URL encoding, malformed filters, current statuses, preserved publishing and transaction behavior. Review corrected premature result scrolling, sticky-header clearance and stale “Refreshing” feedback after an error. No release-blocking issue remains. This is self-review, not a second-person review.

## Release and recovery

No migration or production database write is required. Normal main auto-deploy updates both Render services. Verify both live commit IDs, runtime/startup logs, health, public website and anonymous denial of the private endpoint. Authenticated production owner inspection requires an existing Admin browser session; automated authenticated interaction is synthetic, not a claim of production acceptance.

Recovery is an ordinary application revert through the established release workflow; there is no schema/security rollback. Physical Android clipboard permission behavior and software keyboard require device acceptance if desired; headless Chromium checks cover width/scroll/focus but cannot establish all device behavior.

Ultra enquiry follow-up and external alerts remain P1. No notification worker, supplier logic, payment flow, financial records or customer website content is changed.
