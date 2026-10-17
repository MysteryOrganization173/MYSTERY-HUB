# Website Builder B1 engineering contracts

Base: `95c4fc0d427a7631c52ff7716a81e5dcf1295c16`. This is an engineering foundation, not the final owner interface. No production migration or rollout has been performed.

## Starter content and owner review

`src/config/websiteStarters.ts` is the shared versioned factory. All 12 registered non-Data dedicated templates receive three industry-appropriate editable example structures, using supported item fields and existing illustrative imagery. No example prices, contacts, ratings, testimonials, certifications, achievements or statistics are copied from the demonstration. `content.starterVersion: 1` records the generation in the draft and published representation, survives template migration, and cannot be changed by ordinary saves. B1 shop content suppresses the renderer's fixed demonstration review stars/count. Legacy snapshots without this generation marker retain their previous rendering. Start Blank retains its existing sections structure; managed Data starts with no fictional product catalogue.

New B1 clients call `GET /api/websites/starter-preview?templateId=...`, render the returned content/settings through the existing renderer, and collect one real business name. Then call the existing authenticated creation endpoint with `{templateId, businessName, starterVersion: 1}`. The server repeats the same factory, rather than trusting a client-generated starter. Owner-supplied content overrides may be provided using the existing validated content fields. Explicit `items: []` remains empty. Stale starter versions return 409. The server uses businessName for both project identity and displayed business name. Legacy creation requests remain usable and do not receive new examples; an automatically passed demonstration name becomes “My Business”. Neither existing drafts nor existing public URLs are renamed or seeded.

Example items have a stable ID and `isExample: true`. Ordinary item edits, including adding a price or omitting metadata in an older client, retain that status. Owners can edit ordinary items without enabling Custom Sections. Explicitly confirming a selected example keeps its data and marks it owner-confirmed; explicitly removing it deletes it. Confirmation acknowledges the content as supplied/approved by the owner; it is not external verification of a business claim.

`GET /:id/publication-readiness` returns `{revision, layoutMode, canPublish, review}`. This readiness flag describes the example-review gate, not a replacement for existing publish validation. `review` contains required/count/items/code. **All retained example items require review, including items in the inactive representation.** Publishing returns HTTP 409 with `code: EXAMPLE_REVIEW_REQUIRED` and the same review detail until the owner confirms or removes them. It does not silently publish or strip an unreviewed starter. Public projection removes example flags and excludes unconfirmed examples defensively. No example price is invented; an explicitly entered price must also pass review while its item remains an example.

All paths below are relative to `/api/websites` and require the existing Bearer session except starter-preview:

- `POST /:id/review-examples`: `{itemIds, action: "confirm" | "remove", expectedUpdatedAt, confirmed: true}`.
- Existing `PATCH /:id`: ordinary content/settings edits and autosave; include expectedUpdatedAt. Save the server-returned site/revision.
- Existing `POST /:id/publish`: `{expectedUpdatedAt}`; `publishWebsiteB1` preserves structured error details without changing the endpoint.

Use `WebsiteB1Error.status/code/review` for errors; no second draft store is introduced.

## Active layout and recovery

`SiteContent.layoutMode` is `template` or `sections`. Missing metadata retains legacy composition-presence behavior. Start Blank always uses sections. The shared renderer selects the active mode. Inactive composition/items remain in the owner draft. Public snapshots omit the inactive composition, unused fallback collections and disabled sections for explicit sections mode. Existing snapshots lacking the field retain their prior projection behavior.

- `POST /:id/layout`: `{mode, expectedUpdatedAt, confirmed: true}`. Returning to template mode preserves the previous composition. Entering sections creates a validated default composition only when absent. Every actual transition captures the prior draft. Generic PATCH cannot create Custom Sections or change layout mode; legacy sites can continue saving an already-present composition. Claude must wire the current Enable Custom Sections control to this confirmed action and provide the reversible template action before owner UX rollout.
- `GET /:id/template-plan?targetTemplateId=...`: current revision, shared migration summary, resulting content/settings, published template, matching recovery metadata and remaining history slots. Cross-industry migration still resets incompatible semantic content; it now checkpoints the previous draft first. Returning to an earlier design does **not** silently restore an older draft: offer an explicit restore choice.
- Existing `POST /:id/change-template`: `{targetTemplateId, expectedUpdatedAt, confirmed: true}`. Preserve current published snapshot and slug. It uses the existing migration algorithm, not a new content conversion system.
- `GET /:id/checkpoints`: metadata and limit; document payloads are omitted.
- `GET /:id/checkpoints/:checkpointId`: owner-only saved document and metadata for inspection.
- `POST /:id/restore-draft`: `{checkpointId, expectedUpdatedAt, confirmed: true}`. No client document is accepted. Captures the current draft, then restores the selected server-owned template/name/content/settings. Owner/site/URL/status/publication are never restored from history.
- `DELETE /:id/checkpoints/:checkpointId`: `{expectedUpdatedAt, confirmed: true}`. Explicit irreversible removal of this recovery point only; it does not delete an image or modify the draft/live site.

Retention is ten checkpoints per site, with a 500,000-byte serialized document guard and a 524,288-byte JSONB database guard. Full history returns 409 **before** a layout/template change or restore; no automatic eviction. The owner must explicitly discard a chosen checkpoint to free space. Media referenced by any retained checkpoint, either representation of the current draft, or the published snapshot cannot be deleted. Discarding history only makes an otherwise-unused image eligible for the existing explicit deletion action.

All mutations use the existing owner advisory transaction lock and revision checks. Checkpoint insertion and draft changes commit or roll back together. Concurrent same-name creations use the actual unique slug constraint plus bounded savepoint retries. Archived slugs remain reserved. Renaming display content does not change the public URL.

## Historical Data activity

The existing business summary adds `capabilities`:

- `draftManaged` and `liveManaged` distinguish selected draft from published commerce.
- `hasStoreHistory` checks site-specific orders and operations, including zero-value/unpaid history.
- `hasStoreFundsOrWithdrawals` checks owner-level store ledger/operations, including pending/zero/reversed activity.
- `ordersScope: "site"`, `earningsScope: "owner"` explicitly state the boundary.

The dashboard retains Orders/Store Earnings access using these flags; pricing remains available only for the current Data draft. No balance calculation, order snapshot, supplier/payment operation, withdrawal rule or finance mutation was added. Existing summary reconciliation behavior is unchanged. Claude should label historical Data activity separately from the current site's capabilities and explain owner-wide earnings.

## Persistence, permissions and rollout

`WEBSITE_CHECKPOINT_SCHEMA` and its exact `schema.sql` mirror add only `mysteryhub_builder_private.website_draft_checkpoints` and its owner/site index. Initialization runs after website_sites and published snapshots exist. The table has a website FK, UUID key, constrained transition reason, JSONB size bound and RLS. PUBLIC/anon/authenticated have schema and table privileges revoked. There are no public policies, grants or Supabase Auth assumptions. Backend requests enforce the app's existing session ownership; qualified SQL runs as the backend role that creates/owns the private objects. Do not expose this schema through Supabase's Data API.

Isolated native PostgreSQL verification uses a non-superuser/non-bypass backend owner and synthetic anon/authenticated roles. **This does not establish the actual production role's permissions.** Before any release, use read-only catalog checks to confirm the deployment role can create this schema, owns or has the necessary rights on an existing schema/table, has normal website_sites access, and public roles have no inherited access. Stop on an incompatible owner/grant configuration; do not compensate with public grants. No production schema operation belongs in this implementation task.

Safe staged order:

1. Deploy compatible shared/public/editor readers (layout mode, public projection and structured review handling) without enabling the new owner workflow. Old documents remain valid. Do not enable new-field writers against an old validator.
2. Release the backend contracts and additive initialization using the verified backend role, with a fresh recoverable backup under the release procedure. Verify repeat initialization and private privileges before enabling the new workflow. No backfill/rewrite of websites or published snapshots is required.
3. Ship Claude's owner UI using these contracts. Enable B1 creation, example review, explicit layout actions and checkpoint controls together. Test a safe owner fixture; no live payments are needed. Managed previews retain existing nontransactional mode and use real configured availability only.
4. Roll back the UI first if needed; preserve the additive private table and snapshots. Keep read-compatible code while any draft has explicit layout metadata. Do not blindly roll back to a composition-only renderer: it would show an inactive layout incorrectly. Never perform a destructive history rollback.

This branch must not be presented as a fully finished owner experience: the final creation/review/layout/recovery interface is Claude's next step. Claude can immediately use `src/services/websiteB1Api.ts`, the starter factory, shared renderer and capability flags. No dashboard, template imagery, editor styling, pricing or billing redesign is required from Codex.

## Verification and reproduction

`websiteB1.test.ts` covers every dedicated non-Data template, Start Blank/Data exceptions, creation/preview/reload, explicit review, price edits, deletion/empty lists, publishing errors, legacy/live isolation, layout round-trips, restoration, HTTP ownership/allowlists/revisions, history cap, slug uniqueness, validation, public projection and historical activity without new finance changes.

`websiteB1Postgres.test.ts` is opt-in. Point `MYSTERY_B1_POSTGRES_URL` only to a **new empty** loopback database ending `_test`, owned by a synthetic non-superuser backend role. The disposable cluster should contain synthetic anon/authenticated roles. Run it through the existing test runner. The harness rejects external hosts and a reused website database, never loads .env, exercises real separate pool connections, and leaves its synthetic evidence for inspection. Stop the disposable server afterward. Ordinary full regression skips it and always removes inherited application DATABASE_URL. No production credentials are needed.

Native checks cover exact additive SQL twice and after populated history, private privileges, real connection races, unique-constraint collision retries, post-write rollback, immutable live snapshot/identity, checkpoint-only media protection and bounded retention. Full regression, focused Builder/managed preview checks, TypeScript and production build results are recorded in the implementation delivery report.

Final engineering evidence (15 October 2026): native PostgreSQL 17.6 **8/8 passed**; focused Builder contracts/business/publishing/managed preview **139/139 passed**, plus visual editor/migration/SQL-boundary focused run **96/96 passed** before the final additional disabled-section case. The final full isolated run covers that case and all latest source changes: **1,850 total; 1,842 passed; 3 inherited failures; 5 skipped**. Compared with the verified unchanged-main baseline (1,818 total; 1,811 passed; 3 failed; 4 skipped), there are 31 additional passing tests and one additional opt-in PostgreSQL test skipped by default. That PostgreSQL test was also run separately and passed all seven subchecks plus its parent (eight reported passes). No new unresolved failure remains.

The inherited failures are the obsolete Direct SIM card expectation, the stale websiteBuilderV1 test-file/template expectation, and the existing websiteFreeV1 schema-mirror assertion. Main's existing release evidence independently reproduces the same three. The new checkpoint SQL mirror has its own passing normalized comparison and native SQL execution. TypeScript, production build and diff-check pass; existing Vite configuration/chunk-size warnings remain. No dependencies were added. Native tests used only new local synthetic data; no public site was changed and no provider request was performed. Production backend-role permissions and the final Claude owner UI remain release gates, not completed production checks.

## Release train (17 October 2026)

- Merged with main. The only conflict was `schema.sql`, where the marketplace assets block and the draft-recovery block were both kept.
- **Native PostgreSQL 16** ran on a disposable loopback cluster as a non-superuser, non-bypass role.
  - `websiteB1Postgres.test.ts`: 8/8 passed.
  - Full `initDatabase()` ran twice on an empty database without errors.
  - It also ran on a database first initialised by main's code (the upgrade path), with existing tables and rows kept.
- **The schema can fail without taking the backend down.** If the deployment role cannot create `mysteryhub_builder_private`:
  - Startup logs a CRITICAL line and continues, so orders and payments stay online.
  - Template, layout and restore actions then fail closed, and the draft is unchanged. This was proven against a role with no CREATE on the database.
- The full recovery history now returns `code: "HISTORY_FULL"` with a 409.
- **Owner-site polish:**
  - The hotel, restaurant and salon location ribbons are omitted on published sites when the location is empty. The editor still shows them as tap targets.
  - Designed-site menus hide in-page links whose section isn't on the page, such as the salon's "Our Stylists".
  - The dashboard Overview shows a five-row activity digest with repeats collapsed, plus "See all activity". Analytics keeps the full list.
- **Deploy order:** the backend first, then the frontend.
  - A frontend served before the backend fails closed: B1 actions get "unexpected response" and write nothing.
  - But a new website created in that window would be named after the template's demo business.
