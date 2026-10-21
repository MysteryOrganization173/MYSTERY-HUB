# Website Builder V5 independent audit — 21 October 2026

Disposition: corrected candidate is ready for founder review. No merge, deployment, production migration, financial action or customer-record mutation was performed.

## Reviewed candidate and boundaries

- Production/main: `870c1f5f0b7757cc80e595feedcc31d133dd8909`.
- PR #34: `claude/website-builder-v5-complete`, `107038c5d74a9bfd5358e59610f695bc3a4bdee8`; all 11 original commits and the 82-file implementation are preserved.
- Corrections: `codex/builder-v5-audit-corrections`, based directly on that source head.
- Earn PR #29 remains at `b5c106121834b49d77241662220edba0fa6e57a0`; no Earn changes were imported.
- The founder confirmed that Claude's REPORT.md and CODEX-HANDOFF.md are unavailable locally and explicitly directed this audit to proceed against the actual implementation and the six supplied requirements. Their reported results were not accepted as proof.

## Six handoff dispositions

### A. Earnings definitions — verified, copy corrected

`server/db/financeStore.ts: FinanceTx.storeEarnings()` remains authoritative and unchanged. Available is the nonnegative store-ledger sum; Pending sums pending store sales. Reserved includes both `pending_review` and `approved` store withdrawals. Withdrawn sums the gross requested amount of paid withdrawals, including the fee, rather than the net MoMo payout. Lifetime sums sales with `availableAt`, including later reversals and withdrawals; it is a historical figure, not spendable money.

`src/utils/websiteOwnerOrders.ts` and the dashboard now explain those distinctions. Tests construct the actual ledger/operations and check every total. Payment received is based on the server's `paid` flag; delivery status alone cannot substitute for it.

### B. Deletion and money retention — verified defects corrected

The approved lifecycle is archival, not physical deletion. IDs, slugs, snapshots, media, checkpoints, orders and financial history remain. Archived addresses cannot be reassigned; buyers retain reference-based masked tracking, and staff retain history access. Recreating a site creates a new ID/address and fresh content. Store Earnings are account-wide, including for an owner who later chooses a non-Data design.

Two defects were corrected in `server/services/websiteDeletion.ts`:

1. Age alone no longer dismisses a pending payment after 24 hours. A pending attempt still blocks archival until an authoritative state change; unresolved cases go to support.
2. The financial check now runs inside the archive's database transaction using the existing owner finance advisory lock. A separate-connection settlement cannot slip between the check and archival. This passive check creates no finance account or ledger entry.

The deletion sheet now opens Orders/Store Earnings, offers a recheck and links to existing support. Owners can use existing unpublishing to stop new checkout while retaining access to settle outstanding work. Available/pending/reserved money and reconciliation still block deletion. A below-minimum balance explicitly directs the owner to support; this pass does not waive withdrawal minimums, forfeit funds, move money into Wallet or create an automatic payout. Manual low-balance closure is an operational support case, not a new financial mechanism.

Order pagination is reset when dashboard areas change, preventing a later Orders page from hiding the earnings/withdrawal history. Browser cleanup tolerates blocked storage and clears design-specific recoveries while retaining buyer checkout recovery.

### C. Owner last-four search — implemented and verified

`GET /api/websites/:id/business?lastFour=1234&offset=0` accepts exactly four ASCII digits, or no filter. Authentication and site ownership are checked before orders are read. Search is parameterized and site-bound, with 25 rows/page, an integer offset capped at 100,000, a stable created-at/ID order and a 60-request/minute owner/IP limiter. Output continues through `safeStoreOrder()` and masks the number. It does not expose a public phone-search endpoint.

The dashboard has explicit Search/Clear actions, resets pagination for a new query, and guards delayed results with the existing site/session/query identity. Both actual HTTP tests and native PostgreSQL tests cover malformed filters, foreign ownership, pagination, masking and finding an order beyond the first page.

### D. Ghana reporting periods — verified correct, wording clarified

`WebsiteAnalyticsStore.ownerAnalytics()` uses a rolling `Date.now() - N * 86400000` window. The owner control now says **Last 24 hours**. It does not claim calendar-day "Today". Daily trend buckets use UTC dates, matching Africa/Accra's current UTC calendar. Owner opening-hours helpers also use UTC/Accra, including overnight hours. No reporting/economic calculation was changed.

### E. Social metadata and brand identity — verified correct

The existing server `resolvePublicSocialMetadata()` → `websiteSocialHead()` → `injectSocialHead()` pipeline already supports Boutique and Night Kitchen through their registered template IDs. It reads the published projection, selects the owner's hero/identity, strips platform structured identity from customer sites and emits the canonical `/sites/:slug` URL. New tests publish an owner hero, save a different private draft, and verify the server HTML still uses the published hero/name. No alternate metadata pipeline was introduced.

Actual read-only QuickByte public data confirmed `Quickbyte data`, its existing logo, an empty saved hero and its `#0161fd` brand settings. Existing V5 compatibility tests preserve its legacy artwork fallback and independent identity when Signal becomes its renderer. No QuickByte record was changed.

Real Unsplash/Cloudinary imagery loaded in the browser. The generated Cloudinary social rendition was opened and decoded at exactly **1200 × 630**. Boutique and Night Kitchen metadata matched their actual rendered hero URLs and owner names at both tested widths.

### F. Featured bundles — verified defect corrected

Pins were marked but the default six-smallest display could hide the owner's large pinned bundles. Eligible pins now lead the default list in owner order. Missing/unavailable IDs cannot create offers: the adapter still starts only with the server's available retail catalogue, filters pins against it and scopes them to the selected network. Size/price filters retain their meanings. Pricing, reserve, payment initialization and supplier-cost checks are unchanged.

The publication summary now includes featured bundles, optional features/facts, font and corner style. Previously these edits could incorrectly leave the toolbar saying the live website was up to date. Publishing remains explicit and server-authoritative.

## Additional confirmed V5 corrections

- Focus selection now accounts for the letterboxing around a contained photo. Stored coordinates and the marker refer to the actual image, including portrait/wide images, with keyboard nudging retained.
- Large WebP logos are re-encoded as WebP, preserving transparency instead of becoming opaque JPEGs. PNG also retains alpha; JPEG remains JPEG.
- Unsaved browser recovery is scoped by website **and design**. Switching templates cannot restore another design's unsaved content or clear that design's recovery. The legacy single-key format remains readable, and deleting the website clears all of its recovery keys.

## Wider implementation review

Verified through source, focused tests, native PostgreSQL and compiled-browser checks as appropriate:

- Owner-authorized editing, optimistic revision checks and iframe origin/window/channel/site/template validation remain intact.
- New site collisions and concurrent creation retain unique constraints and owner locking. Rename does not change the published address.
- Cross-industry switching preserves identity, colours, contact/media ownership and a recoverable draft checkpoint. Compatible Kitchen/Night Kitchen and Shop/Boutique content families preserve editable items. Published snapshots do not change until publication.
- Existing/non-Data sites with Data history retain Orders and account-wide Store Earnings access; accounting records are not migrated or relabeled.
- Managed previews use the public presentation with payment/tracking disabled. The local browser server additionally refused financial POSTs; none were attempted.
- WhatsApp order lists use synthetic owner items/options/quantities and truthful message totals. They explicitly require the business to confirm availability, payment and delivery; no WhatsApp message was sent.
- Media ownership/reference checks cover hero/logo/items/extra images/gallery, published snapshots and checkpoints. Real PostgreSQL tests serialize the final Free image reservation at 60; archival retains assets.
- The public entry skips the Admin/editor application bundle. Final build public JS components are approximately 581 KB raw / 161 KB gzip in aggregate; global CSS is approximately 189 KB / 28 KB gzip. The approximately 1,093 KB main-app JS chunk is separate. These are build sizes, not a measured mobile-network/Lighthouse score.
- No new dependency, migration, financial calculation, referral policy, Paystack/supplier contract, Render/DNS setting or production secret was introduced.

## Verification evidence

Final isolated full suite: **2,323 tests; 2,295 passed; 0 failed; 0 cancelled; 28 optional skips**.

Focused Builder/reseller/financial run before the last editor corrections: **824 passed, 0 failed, 11 optional skips**. The later corrections are included in the final full suite. TypeScript, production build and `git diff --check` pass. The existing nonblocking large main-app chunk warning remains.

Opt-in standalone PostgreSQL 17.6 runs, with fresh synthetic-only loopback databases:

- Existing Builder B1 + reseller pricing: **16/16**.
- New V5 archive/search/media suite: **6/6**.
- Additional Admin media/operations/manual-resolution and finance-migration suites: **25/25** (including three static finance-schema checks).
- Total across those opt-in runs: **47/47**, no failures/cancellations/skips. These are separate runs, not added to the full-suite total.

They cover separate connections, final-slot quota races, settlement/archive serialization, post-write rollback, private-role/public-role permissions, unique-slug collisions, snapshot/checkpoint retention, repeated schema startup, all 13 finance kinds and unchanged financial sentinels. No production credentials, restored customer backup, production database or real provider transaction was used.

The earlier six cancelled pool tests were not reproduced: the socket-free pool file passed **13/13**, and both full runs had zero cancellations. A minimal no-socket timeout reproduction also passed. The original failing log/environment is unavailable, so its historical root cause remains **unverified**; it is not described as a database-access limitation or claimed fixed by speculation. Two optional PGlite-specific suites were not run with PGlite; equivalent publication/retention/rollback paths were exercised with standalone PostgreSQL, alongside the other native suites.

Compiled visual evidence is stored privately outside Git in `C:/Users/AB/Documents/Codex/builder-v5-audit-evidence/`:

- `visual-facts.json` records actual 390/1280 viewport widths, all three flagship identities/canonicals/hero URLs, loaded images, no horizontal overflow and no public editing controls.
- `quickbyte-final-390.png`, `quickbyte-final-1280.png`, `night-kitchen-final-390.png`, `night-kitchen-final-1280.png`, `boutique-final-390.png`, `boutique-final-1280.png`.
- Gallery, owner dashboard, pricing/minimum rejection, masked order search, pagination, earnings, deletion blockers, editor, focal control, publication summary, preview isolation and WhatsApp-list screenshots.
- The synthetic browser journey verified autosave/public isolation, Undo and explicit publication. Test imagery was real, not labelled stand-in blocks.
- `compression-browser.json`: 9.10 MB PNG → 1.30 MB WebP with alpha; 7.38 MB WebP → 1.30 MB WebP with alpha; 11.12 MB JPEG → 1.17 MB JPEG. Outputs were 2000 × 1333; the 1.2 MB compression target is best effort, not the configured hard upload maximum.

## Remaining limits and release conditions

- **Founder review required. No release authorization is inferred.** Merge the correction branch into the V5 candidate and recheck the final candidate/main relationship before any later production release; do not deploy the uncorrected PR #34 head.
- Physical Android touch, software-keyboard, low-memory behaviour and slow/mobile-network acceptance remain unverified. Desktop browser resizing is not real-device acceptance.
- Live Cloudinary upload/finalization/deletion and actual Paystack/supplier transactions were not performed. Provider mutations were mocked; real public images and actual PostgreSQL were verified. A later controlled staging media upload can verify account-specific provider configuration.
- Before release, confirm no intentional `WEBSITE_FREE_MAX_ASSETS` override lowers the advertised 60-image default. No production environment value was read or changed in this audit.
- Preserve the existing backup/rollback process and coordinate backend support for new templates/fields/search before exposing a new frontend. V5 adds no database schema migration; existing normal initialization was verified repeatedly in isolation.
- Archival intentionally retains media and records. Repeated delete/recreate cycles retain storage; no retention purge policy was invented here.
- Pending payments and below-minimum/reconciliation balances can require support before deletion. This is explicit, preserves access and money, and must not be bypassed to make the delete button succeed.

**Verdict: GO for founder review of the corrected candidate; production remains NOT RELEASED.** No known failing regression or demonstrated authorization/data-loss defect remains in the reviewed correction. The limitations above are not represented as completed live-provider or real-device acceptance.
