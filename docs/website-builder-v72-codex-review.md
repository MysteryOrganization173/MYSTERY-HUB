# Website Builder V7.2 Phase 1 — engineering review

Reviewed 3 November 2026. Claude source: `5d7b9b031d9d937a92d3826274fb531d94bfc6c3`. Starting main: `8a31aedf2029e4d24bca056dea8bb4ffa0cd8887`. Source was based on `ae96447`; main contained the two financial reconciliation commits. A normal merge into isolated `codex/builder-v72-review` integrated main cleanly at `5a2cb45`. No existing worktree was reset or switched. Checkout and additions use LF.

## Review and corrections

Read the complete feature diff, implementation documentation and integrated runtime boundaries: workspace navigation/marker lifecycle, editor controls/draft state/Undo, extracted visual field, seven style registry entries, scoped renderer CSS, twenty palettes and analytics/server definitions. Claude's design direction is preserved.

Confirmed analytics presentation defects and narrow corrections:

1. Consecutive equal activity labels were collapsed before grouping by day, incorrectly attributing yesterday's event to today. Collapse now happens within each Ghana calendar day. Dates/times do not depend on the owner's device timezone.
2. Long all-time trends silently stopped after 400 calendar days, dropping recent observed views. Long spans retain all server-reported days without allocating years of invented zero entries; short spans still fill internal gaps.
3. Empty activity history could say there was no customer activity even when the separate server totals recorded visits. Its copy now explains that visits/contact actions are in the totals above. The implementation notes also incorrectly treated the server count helper as using unprefixed events; source review confirmed that both Views and Visitors use the public-site event, respectively event count and distinct visitor IDs.

Four meaningful regression tests cover long-history totals/latest day/immutability, cross-day repeat preservation, Ghana dates with a non-Ghana device timezone, and empty history with nonzero server totals. The three initial behavior probes failed against the original feature implementation and passed after correction.

No backend analytics rewrite, financial behavior, schema, authentication, supplier or payment change. PR #76 runtime paths are identical to current main. Supplier draft PR #69 remains excluded. Checkout eligibility recovery is recorded separately in `data-store-checkout-ux-eligibility-recovery-v1-handoff.md`; it is not implemented here.

## Final automated evidence

- Focused Builder/workspace/V7.1/V7.2/publication/legacy/reseller lifecycle/financial reconciliation API: **266 passed, 0 failed, 0 skipped**.
- Full isolated regression: **2,894 total; 2,856 passed, 0 failed, 38 skipped**. No inherited failure is being waived. Optional/environment-dependent skips remain visible in the full log.
- Fresh native PostgreSQL 17.6, loopback-only, disposable databases, non-superuser non-BYPASSRLS application owner: **108 passed, 0 failed**. RLS 10, sales reliability 7, Admin website 6, read-only financial reconciliation 85. Runner strips inherited database settings, creates new test databases and stops its cluster afterward. No production credentials used.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

Private evidence, compiled browser harness and screenshots remain outside Git at `MYSTERY HUB 3/work/v72-review-evidence/`. No dependencies, lockfile, generated output, environment files, screenshots or synthetic customer records were added to the PR.

## Compiled browser verification

Edge browser checks used the actual production build, real local API and memory stores, synthetic customer sessions and a synthetic configured catalogue. Financial/provider operations were blocked and no production DB settings were available.

- Workspace checked at **320/360/390/430/768/1024/1280px**: one mobile business dock, consumer dock hidden, 44px+ mobile dock targets, desktop sidebar, no horizontal overflow. Back, reload, deep-link selection, More/Analytics/Settings, non-Data areas and exit/consumer-navigation restoration observed.
- Design at all seven widths: compact panel sits below a visible live draft on mobile/tablet and beside it on desktop; actual measured width equals requested viewport. More room/Less states work. All seven styles rendered, all twenty palettes selected and propagated to the iframe, custom purple accent worked and Undo restored the previous palette. Long synthetic name, absent logo/initials and custom banner rendered through the shared template.
- Saved Signature/purple draft survived reload while public snapshot stayed Classic/blue. Explicit Update Live published it; Unpublish made the synthetic public API return 404; Publish restored Signature. Public page had no edit markers. Non-Data restaurant palette edit saved on leaving while its public snapshot kept its original colour.
- Owner Preview showed payments/tracking disabled; clicking a preview Buy control did not open checkout. Existing automated tests cover no initialization, stale iframe messages, foreign origins, ownership, save failures and publication concurrency/rollback.
- One initial local iframe was blank during concurrent resource-intensive checks. Reload recovered it; subsequent real-frame style/palette, reload and non-Data journeys succeeded. No change was made to the unchanged iframe handshake implementation based on this transient observation.
- Physical Android touchscreen, software keyboard and gesture-area acceptance were not observed. CSS safe-area handling and desktop responsive simulation do not establish hardware acceptance.

## Release and recovery

Both existing Render services were read-only verified on starting main with automatic commit deployment enabled. No new backend endpoint, database migration, production setting or credential is required. The primary domain serves frontend and API from the web service; the retained static service also deploys main. Old/new UI uses existing endpoints and drafts fail validation rather than bypass server checks. Verify exact revisions of both services after normal merge; GitHub checks or local builds do not prove Render deployment success.

Adversarial self-review checked registry validation, unsafe CSS values, immutable/public legacy appearance, shared authoritative catalogue/checkout, owner preview guards, session cleanup, authorization/message validation and PR #76 preservation. No unresolved release blocker found. Required GitHub checks must pass on the final PR head before merging; branch protections must not be bypassed.

Rollback is a normal application revert/redeploy after reviewing concurrent main changes. There is no schema or data rollback, and customer websites must not be rewritten. Keep feature branches and the original worktree intact. Final main/deployment identifiers and production smoke evidence are recorded in the private release report after release.
