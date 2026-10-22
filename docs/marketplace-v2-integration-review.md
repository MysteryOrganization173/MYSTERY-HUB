# Marketplace V2 production integration review

22 October 2026. PR #37, original head `50320ed437392ef3779c49a08d6ed4add38d4460`; verified integration base `a1b690be7fa5bff30c1ab0b1e541cf274c28e850`.

## Integration and boundaries

Current main was merged normally into the existing `claude/project-thread-2e2j1o` branch, preserving the original three commits and all 14 newer main commits. No conflict resolution or history rewrite was needed. The effective application diff remains Claude's 20 Marketplace discovery, image, Admin framing and schema files. Codex adds this report and focused HTTP/native regression coverage. No payment, supplier, pricing, financial, authentication, Builder or global-overlay code was changed by Codex.

The V5.2 `useMarketplaceDialog` continues to call the global `acquireOverlay` stack. Detail → checkout → Escape returns to detail with the lock held; closing detail releases the final lock. No inert ancestor covers the active dialog. Paystack's external iframe remains outside the stack's #root-only inert boundary. No real payment or provider SDK session was initiated.

## Data and authorization

The only added database column is nullable `marketplace_products.image_framing VARCHAR(32)`, in both `marketplaceFlexibilitySchema.ts` and `schema.sql`. Startup awaits the existing initialization before listening. Existing SELECT * reads tolerate a missing/null field; writes of the new column require successful initialization. A missing migration is not silently worked around by discarding a framing edit.

The exact schema mirror without the new ALTER seeded an older disposable PostgreSQL schema. Candidate initialization then ran twice, preserving every pre-existing legacy-product field and adding a null framing field. Repeated startup also preserved nonempty synthetic orders, account balances, operations, immutable ledger entries and audit records. Native tests used a new loopback database and a non-superuser table-owning role; a separate SELECT-only role and a read-only transaction rejected migration predictably. Production checks are read-only; the approved additive ALTER is left to normal deployment startup.

Framing accepts null/automatic or strict bounded x/y 0–100 and zoom 1–2. Values normalize to whole positions and 0.05 zoom steps. SQL uses bound parameters. Framing cannot inject URLs or arbitrary transformation syntax. Admin routes retain existing RBAC; denied customer/anonymous edits do not mutate products. Create, edit, read, duplicate, publish, archive and main-image replacement are covered. Duplicate remains draft; replacement resets old framing unless the same edit explicitly supplies new framing. Original media is not changed or deleted.

Public lists, lookup and social metadata still require published, non-archived products. Brand discovery operates only on that returned public catalogue. Private drafts and archived fixtures are absent from lists, detail lookup and metadata.

## Discovery, images and metadata

Department and relevant brand rows render together. Laptop names use known whole-word/model inference; explicit Brand/Make/Manufacturer specs take precedence. Digital/service names do not automatically produce hardware brands. Explicit owner-maintained brand specs remain respected. Unbranded items get an Other group where useful; categories without a meaningful choice have no brand row. All-department landing shows a brand row only when one department has a meaningful brand layer. Counts represent the public department catalogue; search/sort/refinements narrow results.

Department/brand choices push history; typed search/sort/refinements replace it. Incompatible brands clear on department changes. Product/ref attribution parameters are retained by URL serialization; existing public deep links remain supported.

Cards/tiles use responsive Cloudinary srcsets, aspect-aware contain/cover treatment and small blurred backdrops. Product detail keeps the entire photograph. Optional framing pans/zooms only at delivery/render time. Invalid photos use icon fallback. External images retain their existing delivery behavior; no server fetch of owner URLs was introduced.

Generated plain and framed Cloudinary sharing URLs were fetched from real public Mystery Hub assets: both returned HTTP 200 image/jpeg at 1200×630, approximately 67 KB and 71 KB. URLs are deterministic/versioned. Non-composable originals retain the padded fallback; HTTPS external images remain exact, unsafe social-image URLs are rejected. Canonical URLs and unpublished-product noindex behavior remain unchanged. Actual WhatsApp cache/Status rendering is not certified.

## Verification

- Full final isolated regression: 2,453 total; 2,421 passed; 2 failed; 0 cancelled; 30 skipped.
- The two failures are the V5.2 Signal source-contract and compact-gallery CSS source assertions. Both reproduce unchanged on main (3/5 pass, same 2 failures); the relevant assertions contain literal LF boundaries while Windows checkout uses CRLF. These source files are identical to main. No assertions were weakened or unrelated files changed.
- Initial focused Marketplace/social/payment/finance/Earn/V5.2: 572 total; 564 passed; same 2 inherited failures; 0 cancelled; 6 skips.
- Additional focused discovery + real-HTTP framing/RBAC/privacy: 19/19 passed.
- Native PostgreSQL 17.6: 6/6 passed (outer test plus five subtests), no skips/cancellations. The initial legacy-row comparison incorrectly expected no other historical initialization columns; corrected comparison preserves all actual pre-existing fields and explicitly verifies the new column. Final run uses a fresh database.
- TypeScript, production build and diff checks passed. No dependency changes.
- Compiled real-app browser QA uses a loopback in-memory server with seeded synthetic accounts/products, production-built assets and financial/provider writes blocked. Live product records were never used as test fixtures.
- Browser sizes: 360, 390, 430, 768, 1024, 1280 and 1600. Catalogue and Admin framing have zero horizontal overflow at each size. Department → Dell → HP, Back/Forward, Digital without brands, search/sort/empty states, product modal, checkout opening/Escape, and Admin framing save/reload/replacement/automatic reset were exercised. Real public Cloudinary photographs loaded; local labelled fixtures cover unusual shapes and external-image handling.
- Native tests require `MYSTERY_MARKETPLACE_POSTGRES_URL` naming a NEW loopback *_test database, owned by a restricted test role, with a companion `marketplace_v2_reader` LOGIN role for permission checks. The suite enforces existing test database isolation and never loads production .env.

## Rollout and recovery

Before merge, last-known-good main is a1b690b; web deploy `dep-dbd3cd3ncjis73bh32u0`, static deploy `dep-dbd3cd3ncjis73bh339g`. Existing Render On Commit auto-deploys should run once. The public domain's paid Web Service serves frontend/backend from one revision and initializes before receiving traffic. No new endpoint is required; the fallback static site's brief rollout overlap cannot bypass existing backend authorization/payment checks.

Verify both exact Live revisions, startup/schema success, new column metadata, old product fields unchanged (excluding only the new field), website hashes, safe health/auth/public routes, product-specific metadata and recent errors. If serious failure occurs, use the retained build rollback or normal revert after checking source/data compatibility. Leave image_framing in place; never drop it or delete saved product preferences as automatic recovery.

Final merge/deploy IDs, production verification and founder Android/WhatsApp acceptance are recorded in the private release report. Physical-device acceptance remains separate; no real financial transaction, customer edit, DNS/configuration change or unrelated feature work is authorized by this verification.
