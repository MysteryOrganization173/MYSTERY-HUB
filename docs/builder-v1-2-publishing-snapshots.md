# Website Builder V1.2 — publication boundary design

Dependent branch feat/builder-v1-2-publishing-snapshots starts from pushed renderer commit b4cafc35445ff59400676faae70280ac368557a7, based on production main d2d27a61db771bb3a66bf1e512b95c89cc82bd20. Main must not change during this implementation.

Chosen smallest persistence change: one nullable JSONB published_snapshot_json column on website_sites. Existing content_json/settings_json/template_id/name remain the editable draft. Snapshot version 1 captures only allowlisted public template/name/content/settings, the acknowledged draft updated_at revision and publication timestamp. Ownership, slug and site ID remain on the existing row. No new CMS/history table.

Explicit Publish validates content/assets under the existing cross-process owner advisory transaction, compares the acknowledged revision, and atomically writes status/timestamp/snapshot. Retries return the existing result when no newer draft intervened; otherwise they report a conflict without publishing or acknowledging unseen edits. New/draft sites are never publicly returned before explicit publication. Public reads project the snapshot; owner reads retain the draft. Unpublish hides the site and retains both states. Assets referenced by the retained published snapshot cannot be deleted.

Additive repeatable migration backfills only currently published rows without snapshots from their actual current public fields; it does not alter IDs, owner, slug, status, timestamps or draft content/settings. Drafts and archived sites are not published. Unknown/private fields are excluded at every supported JSON level. A legacy published record also freezes its pre-edit public state before any draft/template/unpublish mutation, covering the memory fallback and transitional legacy records. Snapshots are never refreshed by ordinary saves or repeated initialization.

Managed public catalog/checkout site-identity reads must use the published projection so an unpublished draft template change cannot deactivate the live reseller. Only the site-state accessor changes; catalog/pricing/payment/order/supplier/earnings logic is unchanged. Pending reseller Paystack overlay repair is excluded.

Current frontend sends its last observed revision for save/publish/unpublish. Public API publication rejects missing/stale revisions; the editor waits for in-flight save, stops on failure/conflict, locks editing during publication and preserves newer dirty edits. Legacy internal/test store callers may omit the revision and act on current server state; this is not exposed as an unrestricted public publication contract.

Migration tests use isolated representative legacy fixtures and actual embedded PostgreSQL SQL execution where available, plus standard memory and mocked pg boundary coverage. No production schema/data action is performed. A full external PostgreSQL server is not installed; embedded PGlite results must be distinguished from production-server/staging verification.

Production release requires founder review of both commits/integration, read-only legacy shape/count prechecks, backup and deployment compatibility approval. Rollback must retain the snapshot boundary/column: blindly deploying the old backend would resume serving mutable drafts. Preserve both draft and snapshot records; use a forward compatibility fix or revert only affected presentation. Any schema rollback requires a separate verified backup/restoration plan. No destructive rollback SQL is executed here.


## Isolated migration evidence

Actual embedded PostgreSQL/PGlite execution passed 9/9 checks: empty initialization; complete canonical legacy state/IDs/URLs/status/timestamp preservation; root/nested private-field exclusion; repeat startup without snapshot overwrite; actual WebsiteStore SQL draft isolation; rollback after an injected post-write publication failure; publish/retry and unpublish/republish; unchanged finance/balance/ledger/order sentinel. This is real PostgreSQL SQL execution in WASM, not a mocked SQL result and not a separate PostgreSQL server. Cross-process concurrency still needs staging PostgreSQL verification.

The same regression is committed as websitePublishingPostgres.test.ts. It runs when MYSTERY_TEST_PGLITE_PATH explicitly points to a locally installed @electric-sql/pglite package; otherwise it is clearly skipped. No application dependency is added. Tests use a fresh in-memory engine, do not inherit DATABASE_URL, and bind pg queries/connect directly to that engine under the reserved fixture.invalid URL. No socket/provider is used.

## Continuation findings and final verification

Recovered the existing renderer checkpoint and all 20 pending publication files without resetting a worktree. Main remained d2d27a61db771bb3a66bf1e512b95c89cc82bd20. Renderer follow-up ac6c14d5fdacc5427bfd7b79f0c25f3edcdef1a2 fixes the browser-reproduced inherited dark Restaurant contrast defect; Workstream B includes that commit without importing another pending release branch.

The initial combined full run exposed two new regressions: missing publication revision returned 400 before cross-owner authorization (now ownership is checked first), and a PostgreSQL test assumed ID/owner were the final parameters (now asserts their exact positions and the additional null snapshot parameter). Both are covered and pass. The embedded PostgreSQL test now additionally proves first-save capture of a transitional published row with no snapshot.

Final focused Builder/renderer/contrast/media/reseller/publication/database checks: 386 total, 385 pass, 1 inherited schema assertion failure, 0 skipped. Dedicated publication/foundation/PostgreSQL checks: 58/58 passed. Actual embedded PostgreSQL migration subchecks: 9/9 passed. Independent renderer checkpoint: 80/80 passed; contrast follow-up focused checks: 53/53 passed.

Fresh unchanged-main baseline: 1517 total, 1513 passed, 3 failed, 1 skipped. Final combined isolated regression: 1569 total, 1565 passed, the same 3 failed, 1 skipped. This adds 52 passing tests and no new failures. Inherited failures are bundleCardCompression's obsolete direct-SIM copy assertion, websiteBuilderV1's obsolete template-name expectation (file-level failure), and websiteFreeV1's pre-existing raw schema mirror assertion. They are not changed to make this release green. TypeScript, production build and diff check passed. Existing non-blocking Vite configuration/chunk warnings remain.

## Compiled browser evidence

Local Express fixture servers serve the actual compiled app, real auth/website APIs and memory-only website stores. Financial, provider, asset and external API mutations are blocked. Catalog rows and users are synthetic. No payment button was executed. Fixture dashboard business summaries are unavailable because financial-account setup is intentionally excluded; this is a harness limitation, not a claimed dashboard verification.

Observed journeys:
- New Free owner: Start Blank -> edit -> Save Draft -> real iframe preview -> public URL unavailable -> Publish -> matching public content.
- Existing Free site: edited text saved/autosaved privately; refreshed public page kept the previous published headline; explicit Publish exposed the new headline. Unpublish returned Website Not Found; republish restored the saved draft.
- Template change: Free dark -> Restaurant retained site ID/URL and owner colors; public retained the old Free template before Publish; explicit Publish exposed Restaurant. Its formerly dark-on-dark menu heading is now white on the inherited dark surface.
- Managed owner: edit headline -> save -> preview blocked Buy with a preview-only notice -> public retained old headline -> Publish -> new headline. Published Buy still opens the existing authoritative-price order-review dialog. No Pay action executed. Automated operational tests additionally prove a draft template change does not deactivate the published reseller/catalog or alter ledger/withdrawal access.
- Partial #f input rendered safely; bright #ffcc00 CTA used black foreground; non-green #7c3aed owner accent propagated. Synthetic cover/logo and contact links were present in preview/public views.
- Actual owner/public browser widths 1280, 390 and 320 were checked for representative light/dark Free and managed sites. Public pages and settled owner layouts had scrollWidth == clientWidth. Editor desktop iframe is 1280; mobile iframe is genuinely 375, scaled to fit the owner panel. It is a real responsive viewport, not a fake narrow desktop container, but 375 is deliberately distinct from public-page checks at 390/320. During viewport resizing, measurements/captures were accepted only after layout settled.

Screenshots/logs reside outside Git in C:/Users/AB/Documents/ChatGPT/MYSTERY HUB/builder-v1-2-evidence. Representative inspected captures: before-reseller-sections-editor-1280.jpg; b-light-editor-1280.jpg; b-light-mobile-preview-390-final.jpg; b-light-mobile-preview-320.jpg; b-light-matching-public-320.jpg; b-dark-editor-final-1280.jpg; b-dark-editor-390.jpg; b-dark-editor-320-final.jpg; b-dark-public-1280.jpg; b-dark-public-390.jpg; b-dark-public-320.jpg; b-managed-preview-payments-disabled-1280.jpg; b-managed-owner-preview-true-390.jpg; b-managed-owner-preview-true-320.jpg; b-managed-public-390.jpg; b-managed-public-320.jpg; b-managed-public-checkout-review-1280.jpg; b-inherited-dark-restaurant-public-1280.jpg. Earlier screenshots marked only with b-managed-editor-390/320 were actually desktop simulated views and are excluded from the genuine mobile evidence.

Visual limitations: existing mobile editing uses an editing-area selector rather than tap-to-edit. Legacy image/gradient artwork retains template-owned foregrounds; automated solid-surface contrast correction is not a formal all-image WCAG certification. Browser evidence uses synthetic sites, not customer production records. Existing UI/layout is preserved.

## Security and release gate

Public DTOs exclude owner IDs, raw snapshots and draft fields. Public content is allowlisted at supported nested JSON levels; publication validates the content/composition and owned ready image references. Saved settings remain sanitized by existing store paths. Owner/session authorization remains mandatory. Cross-owner edits, publication, unpublication and media operations remain protected. Public revisions are stored atomically under the existing PostgreSQL owner transaction/advisory lock. Duplicate/stale/timeout publication tests pass; a newer draft after an old publication retry returns a conflict. The editor waits for pending saves, prevents duplicate publishing and only shows success after the server confirms it. Same-origin preview messages also require the correct frame window. Preview rejects payment, tracking, form and external navigation actions. No arbitrary HTML/JavaScript editing is added.

GO for founder integration review; NO-GO for production deployment until separate founder release approval and the staging/legacy checks below. No known new relevant regression remains. Embedded PostgreSQL verifies actual SQL execution/rollback but does not prove contention between separate PostgreSQL client processes.

Before production release, the operator must obtain a backup and read-only legacy inventory: counts by status/template, public IDs/slugs/owners/timestamps, content/settings JSON shapes and approved image references. Verify all published template IDs exist in the current registry; all scalar public fields and feature entries have documented string types; social/items/stats/composition/section/data objects and arrays satisfy the current schema. Stop if malformed/unsupported legacy state appears; do not normalize customer history by guessing. Unknown/private keys are omitted from snapshots but original draft JSON is retained.

Illustrative READ-ONLY prechecks (do not execute through this sprint):
```sql
SELECT status,template_id,count(*) FROM website_sites GROUP BY status,template_id ORDER BY status,template_id;
SELECT count(*) AS malformed_roots FROM website_sites WHERE status='published'
 AND (jsonb_typeof(content_json) IS DISTINCT FROM 'object' OR jsonb_typeof(settings_json) IS DISTINCT FROM 'object');
SELECT id,slug,template_id FROM website_sites WHERE status='published'
 AND ((content_json ? 'items' AND jsonb_typeof(content_json->'items') IS DISTINCT FROM 'array')
 OR (content_json ? 'stats' AND jsonb_typeof(content_json->'stats') IS DISTINCT FROM 'array')
 OR (content_json ? 'features' AND jsonb_typeof(content_json->'features') IS DISTINCT FROM 'array')
 OR (content_json ? 'composition' AND jsonb_typeof(content_json->'composition') IS DISTINCT FROM 'object'));
```
The shape inventory must also inspect nested documented fields; these illustrative aggregate queries alone are not approval. Before the column exists, do not query it. After approved staging migration, verify backfill count equals prior eligible published rows, drafts/archived remain null, prior existing snapshots are unchanged, and hashes of ID/owner/slug/status/draft content/settings/timestamps remain identical. Run initialization again and confirm no additional writes. Test two real PostgreSQL clients publishing/saving the same owner concurrently and injected rollback on staging. Compare representative staged public sites before/after. Align frontend and backend rollout: old clients without expectedUpdatedAt now receive a safe reload error for draft saving/publishing.

Rollback: retain published_snapshot_json and both draft/live content. Do not drop the column or roll back to an old backend that serves mutable drafts. Disable further release steps, preserve a backup, and use a reviewed forward-compatible fix or presentation-only rollback. A destructive restoration is a separate approved operation.

Next improvements, outside this sprint: visual tap-to-edit; more compact mobile controls; improved images/hero editing; professional site addresses/sharing; per-tenant SEO/social metadata; the separate managed reseller Paystack readiness release. None is imported here.

## Combined changed-file inventory
- docs/builder-v1-2-publishing-snapshots.md
- docs/builder-v1-2-renderer-contrast.md
- server/db/connection.ts
- server/db/schema.sql
- server/db/websiteAssetStore.ts
- server/db/websitePublishingSchema.ts
- server/db/websiteStore.ts
- server/routes/websiteApi.ts
- server/services/websiteBusinessService.ts
- server/services/websitePublication.ts
- server/suppliers/__tests__/builderRendererV12.test.ts
- server/suppliers/__tests__/resellerContrast.test.ts
- server/suppliers/__tests__/websiteBuilderFoundationDatabase.test.ts
- server/suppliers/__tests__/websiteBusinessV1.test.ts
- server/suppliers/__tests__/websiteFreeDatabase.test.ts
- server/suppliers/__tests__/websiteFreeV1.test.ts
- server/suppliers/__tests__/websitePublishingPostgres.test.ts
- server/suppliers/__tests__/websitePublishingV12.test.ts
- server/types/website.ts
- src/components/website/DynamicTemplateRenderer.tsx
- src/components/website/IsolatedTemplatePreview.tsx
- src/components/website/ManagedDataStorefront.tsx
- src/components/website/PublicPublishedSite.tsx
- src/components/website/SectionSiteRenderer.tsx
- src/components/website/SiteContactDetails.tsx
- src/components/website/TemplatePreviewModal.tsx
- src/components/website/WebsiteBuilderPage.tsx
- src/components/website/WebsiteContrastBoundary.tsx
- src/components/website/WebsitePreviewFrame.tsx
- src/components/website/WebsiteSettingsControls.tsx
- src/components/website/WebsiteSiteRenderer.tsx
- src/components/website/editor/WebsiteEditor.tsx
- src/components/website/editor/WebsiteSectionsControl.tsx
- src/components/website/templates/DataResellerTemplateView.tsx
- src/components/website/templates/RestaurantTemplateView.tsx
- src/components/website/websitePresentation.css
- src/services/apiClient.ts
- src/types/index.ts
- src/utils/templateRendererUtils.tsx
- src/utils/websiteBrand.ts
