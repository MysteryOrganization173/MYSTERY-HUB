# Builder V1.2 production integration

Release branch `release/builder-v1-2-production` starts at verified production main `7feb26b9a7f1c111d069549b3338b40a7b459a38`. Original candidate `67c4c7d4c0e23d2355f137fe5917c4894724916e` was integrated in dependency order with provenance retained:

- b4cafc35445ff59400676faae70280ac368557a7 → 7064347: renderer/iframe parity.
- ac6c14d5fdacc5427bfd7b79f0c25f3edcdef1a2 → 0d3cb06: inherited-theme contrast.
- 67c4c7d4c0e23d2355f137fe5917c4894724916e → 2c054cd: draft/published snapshots.

The only conflicted file was connection.ts (import and initialization list). Both the current order-resolution schema and website-publishing schema are retained. The automatically merged schema mirror, API contracts, types and Ultra database tests were reviewed. Website rendering files match the original candidate exactly. Payment, fulfilment, finance, order-resolution and Welcome Price code match starting main; no pending reseller payment branch is imported.

## Narrow release correction

Deep legacy inspection found the registered Data template's own plain numeric comparison statistic in one published and one draft site. Generic text validation rejected its less-than sign. Statistic **values only** now accept a bounded numeric comparison grammar, preserving the existing value exactly. Labels and other text keep their existing validation. Tests reject markup, event attributes, arbitrary comparison text, invalid types and oversized values. No customer data is normalized or rewritten.

## Data gates

Read-only production inventory: seven sites; five published (four Data, one construction), two Data drafts; all template IDs recognized; six image references. Every approved content/settings structure, nested composition and owned managed-image reference was checked against the restored copy. Unknown/private keys stay out of snapshots; original draft JSON remains untouched.

A fresh native pg_dump custom archive was captured on 14 October 2026 at 18:34 UTC over verify-full TLS, encrypted with AES-256-GCM and a DPAPI-protected key outside Git. Restoration to isolated PostgreSQL 17.6 matched all 26 application-table counts/fingerprints and ownership/RLS/ACL/policies. Roles are exported without passwords. This verifies application recovery, not recreation of the entire hosted Supabase platform or external media storage.

The restored staging environment used the production-equivalent postgres owner role (non-superuser, BYPASSRLS). Exact migration and mirror agree. Exactly five snapshots were captured; all seven IDs/owners/slugs/statuses/timestamps/draft JSON/settings remained identical. Deliberately failing the migration transaction rolled back column and backfill. Two complete application initializations then preserved snapshots and all other application rows. Two independent PostgreSQL connections rejected stale saves and conflicting publish/save; injected post-publication-write failure rolled back. Unpublish/republish and ownership checks passed. Original legacy rows plus financial/order/reward history remained unchanged after synthetic journeys.

Private inventory/baseline storage uses encrypted identity metadata and hashes of private fields; raw customer drafts/contacts are not placed in release reports or Git.

## Verification

Today's unchanged-main baseline: 1,674 total; 1,668 pass, three inherited failures, three optional skips. Integrated final suite with embedded PostgreSQL enabled: 1,729 total; 1,724 pass, the same three failures, two unrelated optional skips. This is 55 additional tests, 56 additional passes and one fewer skip. Inherited failures are obsolete Direct SIM copy, obsolete Builder template-name expectation and raw Free schema-mirror assertion. No important assertion is weakened. Native staging checks are additional; skipped optional tests are not claimed as migration evidence.

Builder-focused run: 312/313; its single failure is the baseline schema assertion. Three legacy compatibility tests pass. Actual embedded publication SQL test passes with 9/9 subchecks. TypeScript, production build and diff check pass; existing Vite warnings remain.

Compiled synthetic Free and managed owner/editor/public checks cover 320/360/390/430/768/1280px, without measured horizontal overflow. Real preview frame widths are 375/768/1280. Current draft autosave keeps old public headings; explicit publication exposes the acknowledged revision. Managed preview rejects Buy, with zero financial requests; public Buy opens the unchanged authoritative-price review dialog without Pay. Images/owner colors/text remain present. Light/dark and Restaurant views were inspected. Earlier unchanged-code evidence for new Free creation, template migration, unpublish/republish, inherited-dark Restaurant and bright/partial themes is retained; automated tests and standalone SQL additionally cover these contracts. This is not universal accessibility certification.

All five current public production URLs were opened before release. Real owner writes, payments, supplier orders, refunds and media deletion are excluded from production smoke tests.

## Rollout and recovery

Require explicit production migration/rollout authorization. Temporarily pause frontend On Commit, push only the approved release, verify backend startup/backfill/public API first, then deploy the exact frontend revision and restore On Commit. Existing old clients missing revision expectations receive a safe reload error; no unacknowledged revision is published. During rollout, avoid owner editing and verify both revisions before operational acceptance.

Before main push, re-fetch expected main, verify the release diff, recheck current encrypted website manifest and backup. After rollout verify the five public URLs/content/media, private owner endpoint authorization, snapshot counts/hashes and both Render revisions. Real owner draft-save acceptance remains separate unless explicitly available/authorized; never edit customer sites just to claim completion.

Do not drop published_snapshot_json or restore an old backend that serves mutable drafts. If deployment fails, stop further rollout, retain snapshots/backups and use a reviewed forward-compatible fix or scoped presentation rollback. Destructive restoration is not automatic recovery.

No tap-to-edit, new editor, template, commercial policy, overlay repair, provider configuration or financial behavior change is included.
