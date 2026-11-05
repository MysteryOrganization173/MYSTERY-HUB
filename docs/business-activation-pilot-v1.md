# Business activation & first-ten pilot V1

## Audit before implementation — November 5, 2026

Base/current remote main: `27550a0f480486d90b78be2afe6d3563629b0f0d`, including V7.5, Mystery AI V2 and gated Shield infrastructure. Only open PR at audit: held supplier draft #69. Creative Studio is separate and untouched.

Already implemented and reused: WebsiteStore owns authenticated creation, draft saving, publish checks/snapshots, Update Live, unpublish and archive. My Business already supplies resume/edit, preview, Publish/Update Live, share/copy and management actions. Admin Website Builder provides authoritative project counts, creation-date filters/search/template/status/pagination/refresh, recent rows, and protected on-demand owner/contact inspection with public links and audited force-unpublish. Growth Center and Campaign Manager retain their existing scopes. No new owner onboarding UI, CRM, campaign system or tracking platform is needed.

Confirmed gap: projects and publication events are not distinct business owners. A Draft list can include an owner with another published site, including an older site outside a chosen creation-date range. There is no owner-level current snapshot/filter for draft-only owners. Inspect Site has contacts but no narrow public engagement evidence; the existing business endpoint mixes analytics with financial/store summaries and is unnecessary for this task.

Important existing semantics: published_at is overwritten by every successful Publish/Update Live and retained on unpublish; it is not first publication. updated_at includes publish/unpublish/template changes, not proof of real content completion or active operation. Earliest stored publication event is only first observed because analytics writes can fail safely. The existing Growth Center already labels this correctly.

PublicPublishedSite records public-page views/contact events; preview/editor renderers do not call that tracking path. Anonymous browser/session UUIDs are client claims, not verified people; owners/staff can open public pages, identifiers reset, collection can be blocked/fabricated, and server dedupe suppresses repeated views per visitor/session/site for24h and contacts for60s. WhatsApp clicks are handoff attempts, not sent messages or orders. Shares, ordinary business enquiry receipt, genuine-business verification and real-content completion are not authoritatively recorded. Do not invent conversion, sales, operating-business or onboarding percentages.

Read-only production snapshot at2026-11-05T21:10:22Z: 23 nonarchived projects (17 published/6 draft), including one staff-owned published project; one archived customer project separately. Historical events included43 publication events,297 public view events and17 WhatsApp events across their full history. These time-sensitive counts are audit evidence, never hardcoded application metrics. Role/status groups alone do not prove how many genuine businesses operate or whether the pilot is complete. Baseline regression:3099 passed,0 failed,41 skipped.

## Focused implementation plan

Extend the current Admin project report with an all-time distinct active-customer-owner snapshot and owner-stage filters, derived from all nonarchived projects before list filters. Exclude staff/disabled/missing owner accounts from the candidate snapshot without hiding them from the ordinary project list. Keep existing project metrics/date rules. Owner metric actions explicitly switch the list to all-time, clear conflicting filters and reveal results. Multiple projects remain multiple rows, never multiple owners.

Reuse Inspect Site contacts/public links. Add a lazy Admin-only engagement aggregate over the existing site's last30days of public view and WhatsApp/call/email events, with no raw identities or financial queries. No event collection or customer-flow changes. Missing records, no observations and query failure are separate states. Contacts stay usable if engagement reporting fails. Label latest publication and last project change honestly.

No production DDL, migrations, backfills, financial changes, customer records, Shield activation, messages, public-site rendering changes or Creative Studio edits. Test with synthetic memory fixtures, native disposable PostgreSQL/CI, authorization boundaries and actual component screenshots at320/360/390/430/768/desktop. Independent review plus normal GitHub checks gates merge. Rollback is an application revert; no database rollback is necessary.

## Metric definitions and operational scope

| Metric | Authoritative evidence | Limits |
| --- | --- | --- |
| Customer owners | Distinct user_id on nonarchived website_sites joined to users role=customer/status=active | Account candidates, not verified genuine businesses; staff/disabled/missing accounts excluded. |
| Owners with a published site | Same owners with at least one current status=published site, anywhere in their current projects | One owner counts once, including multiple sites; publication does not prove ongoing operation. |
| Draft-only owners | Same owners with no current published project | An older published site prevents misclassification even when outside the list's date range. Unpublished sites return here if no other published site exists. |
| Project counts/status/template distribution | Current website records, with the existing creation-date scope | Rows are sites, not owners; archived projects are excluded. Staff projects stay in ordinary All owner accounts. |
| Latest successful publication | website_sites.published_at | Retained after unpublish and overwritten on Publish/Update Live; not first publication. |
| Last project change | website_sites.updated_at | Includes content, template and state changes; not proof of real content or customer/owner activity. |
| Public view events / approximate browsers | Last30days of existing website_public_site_view events / distinct nonnull browser UUIDs | Not verified people. Preview/editor paths are separate, but owner/staff opening a public link may count. |
| WhatsApp handoff / phone / email link clicks | Existing last30day public contact event types | Visitor+session dedupe windows; not message delivery, received enquiries, orders or sales. |
| Pilot completion, sharing, real-content completion, ordinary-business enquiry receipt | Not authoritatively recorded | Shown/described as not measured; manual verification is required. No fictional rates/zeros. |

Owner cards switch results to All time, reset conflicting search/template/status/owner filters and pagination as appropriate, then reveal/focus the existing list. Published-owner card shows their published sites; the owner filter can also show drafts belonging to an owner who already has a published site. Other project metrics retain their existing selected-range semantics and clear the owner filter. One owner can produce multiple matching project rows, explicitly explained.

Engagement loads only when Admin requests it in Inspect Site. The new endpoint uses existing requireAdmin/no-store and validates the site ID; no public serializer changes or new bulk contacts. It returns fixed aggregate fields, not browser IDs, content, contacts or payment data. A read-only transaction with2s statement/500ms lock timeouts bounds the aggregate using existing entity indexing. Invalid/missing response fields and reporting errors are unavailable, not zero. Contacts remain accessible. Key/abort/sequence guards discard stale site/session results. No polling or new tracking writes.

## Founder operating procedure

1. Open Admin → Website Builder → Websites. Use the all-time owner snapshot for candidate recruitment; do not interpret the event funnel or total project count as business owners.
2. Tap Draft-only owners, Inspect Site and contact each owner individually through the existing legitimate contact options. Ask whether they need help replacing starter details/photos, checking contacts, previewing and publishing. No automated messages are sent.
3. Tap Owners with a published site. Inspect and open each actual public URL for manual review. Confirm it represents a genuine participating business, real content, correct contacts and an owner who can resume editing/Update Live. Opening a public URL can itself record a view.
4. Agree a practical use case with the owner and ask them to share the public link. Use on-demand last30day engagement as supporting observations only. Ask the owner whether actual customer interest arrived; a WhatsApp click alone does not establish this.
5. Count the first ten only after that manual business/owner/use validation, keeping any pilot follow-up notes through your existing working process. This release intentionally does not create a verification registry, CRM, completion percentage or sales attribution system.

The read-only production aggregate at2026-11-05T21:23:07Z returned22 active customer owners,16 with a published site and6 draft-only. These are time-sensitive candidate counts, not16 verified pilot successes. No production contact details were retrieved for this audit, and no production customer/site/financial records were changed.

## Verification and independent review

- Unchanged-main baseline:3099 passed /0 failed /41 skipped. The first4 new reproduction cases all failed before repair (missing snapshot/filter/engagement endpoint), then all passed.
- New activation regression suite:10 tests. Covers distinct/multiple/mixed owners, current transitions/retained publication evidence, empty/archived/missing accounts, bounded filters/pagination, Admin-only/no-store/private-data boundaries, preview/contact definitions, dedupe, malformed/unavailable reporting, and analytics failure preserving publication/contacts.
- Native PostgreSQL17 disposable database, non-superuser/non-BYPASSRLS owner:8 passed /0 failed /0 skipped. Includes current-row counts versus publication events, old publication outside a list date range, multiple projects, staff/disabled/archived exclusions, concurrent dedupe, old/future event exclusion, private projection, untouched financial/RLS state and audited unpublish. Existing GitHub database-security workflow runs the expanded suite.
- EXPLAIN ANALYZE on the disposable fixture report: planning0.441ms / execution0.652ms. One project aggregate, no per-row owner queries; engagement is one on-demand site aggregate. These small-fixture timings are not a production-scale benchmark. No new index/schema is needed for the observed dataset.
- Full regression:3109 passed /0 failed /41 skipped (3150 tests,12 suites). Optional integration skips are reported separately from native execution.
- TypeScript, production build and git diff checks passed. Existing build chunk-size warning is not introduced by this feature.
- Actual Chromium/component tests at320/360/390/430/768/1440px passed: cards/scope/filter reset and reveal, pagination, mixed-owner selection, precise dates, private contact/public-link inspection, lazy engagement, empty/error/malformed responses, contacts surviving analytics failure, reduced viewport/keyboard focus, stale responses after site/session changes, rolling-old-backend unavailable state and zero writes. External requests were blocked. Physical Android testing is not claimed. Reproduce with `python3 scripts/reviewBusinessActivation.py`; all screenshots/results go to `/tmp/mystery-business-activation-review`.
- Self-review and a separate independent agent reviewed metric definitions, SQL, privacy, authorization, races, scope and frontend/backend compatibility. Findings corrected: malformed HTTP200 evidence now fails visibly; delayed site/session responses explicitly tested. Final release/CI/deployment evidence is recorded in the PR.

### Actual application screenshots — synthetic fixtures only

These screenshots are the real components in Chromium with clearly synthetic local APIs, not production adoption counts or generated mockups.

- [360px owner snapshot](screenshots/business-activation-pilot-v1/synthetic-360-owner-snapshot.png)
- [390px inspection/engagement](screenshots/business-activation-pilot-v1/synthetic-390-engagement.png)

## Deferred gaps and rollback

Genuine-business validation, real content quality, successful sharing, message receipt, confirmed non-store enquiries and sustained business use require human evidence or a separately justified future integration. Existing Growth/Campaign attribution and managed Data Store order reporting keep their current independent meanings; no new sales rate is inferred here. Broader analytics retention/query architecture is unchanged and can be reviewed when traffic scale justifies it.

Recovery is a normal application revert/redeploy. There is no schema, financial state, public content or RLS rollback. The optional owner fields and omitted empty filter preserve ordinary project reporting during rolling backend deployment; engagement failure remains isolated from contacts and public operations.
