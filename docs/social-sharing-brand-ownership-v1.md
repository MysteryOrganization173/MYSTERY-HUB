# Social Sharing & Brand Ownership V1

## Status and verified baseline

Implementation candidate only. No merge, deployment, domain move, Render settings change or production data write is authorized in this pass.

Base main: `ada7565c799c38a1891ed6914fc61ba9ab7f4691` (fetched 19 October 2026).
PR #29 remains a separate open Mystery Earn/Footer change; none of it is included here.

On 19 October, anonymous crawler HTTP requests to the Dell product and QuickByte URLs both returned 200 HTML with the platform homepage title and platform logo. The public Dell API independently returned its saved name, GH₵4,450 and its own Cloudinary image. The public QuickByte API returned her saved logo and an empty hero. Her current renderer deliberately resolves that empty hero to her original legacy banner.

The live Render dashboard confirmed the frontend is a Static Site with one rewrite: `/*` to `/index.html`. The backend is a separate Web Service. The public domain's incoming HTML requests currently do not traverse Express. Browser-only SEO changes therefore cannot fix crawler previews.

## Architecture decision and approval boundary

The existing backend already builds the SPA and serves dist in production. It now injects route-specific metadata into that same built index, then delivers the unchanged React root and module scripts. This is head generation, not full React SSR, and uses no headless browser, remote image fetch, new framework or service.

**Recommended activation: existing Express Web Service serves the existing public custom domain (option A).** This guarantees query strings reach the resolver and that HTML and hashed assets come from the same deployment. The API's existing onrender hostname remains available. The separate Static Site remains intact as a rollback target.

This requires explicit founder approval to transfer the custom-domain association from the Static Site to the existing backend Web Service, and update DNS only if Render's actual domain instructions require it. TLS must be issued/verified before traffic is considered released. No such change has been made. DNS records and billing have not been modified. Check current API instance capacity/plan and any cold-start behavior before consolidating public traffic; do not silently upgrade.

Render documents full-URL rewrite destinations at https://render.com/docs/redirects-rewrites and custom domains for Web Services at https://render.com/docs/custom-domains . A selected-path external rewrite (option B) could retain the Static Site, but requires a disposable routing proof of query preservation, upstream response-cache behavior and release-matched asset delivery. Those properties have not been demonstrated on the live Static Site, and live rules have not been changed just to experiment. It is not the release recommendation here. Edge rendering (option C) adds unnecessary infrastructure when the existing backend can generate this small head.

`render.yaml` deliberately remains the existing Static Site blueprint. Do not change its runtime in-place or assume a YAML edit transfers a domain. Deploying this code to the API alone does NOT fix the original-domain previews.

## Data and metadata contracts

- Marketplace: one bounded public slug/legacy-ID lookup, with existing published/non-archived filters and public projection. Its existing category-label lookup may add one query. Price/from-price/quote/variant eligibility is calculated by the existing public mapper; this code does not calculate retail prices. Saved availability and specs are used; enquiry-only/coming-soon listings do not promise online checkout. Unknown/draft/archived product links get generic unavailable metadata and 404/noindex, without the hidden product's data.
- Published sites: one `findPublishedSiteBySlug` SELECT uses the existing immutable published snapshot projection. Draft content, raw snapshot JSON, user IDs and internal fields do not enter the head. Legacy published rows are projected without persisting a backfill. Unknown/unpublished sites return a neutral 404/noindex.
- Existing Data owners: empty/retired hero resolution follows the same shared resolver as the actual published renderer, including QuickByte's original banner. The original URL, content, logo, banner, template, settings and prices are never written. A read-only aggregate found one other published site inheriting the legacy banner and two with the legacy image explicitly saved. Metadata preserves that existing appearance; silently replacing those owners' public artwork is not authorized. New-site creation, migration into Data, and image removal already explicitly select the neutral starter, as covered by existing and new tests. Explicit saved owner artwork remains authoritative. Other categories use their saved hero/logo, then existing category template artwork. No template renderer/layout is changed.
- Public service metadata covers Home, Data & Airtime, Website Builder, Marketplace, Mystery Earn, AFA and More Services, including existing route aliases. Unsupported utilities remain described as unavailable. Business configuration's existing brand mark, Marketplace art and approved Builder art are reused. No rewards, fees, prices or availability flags change.
- Browser navigation and initial server HTML share the same pure metadata functions. Initial owner HTML removes the platform Organization/WebSite JSON-LD and manifest; the owner logo or neutral blank favicon replaces the platform icon. Platform attribution in the actual website remains untouched.
- An explicit marketing-route allowlist keeps public pages indexable while Admin, Wallet, Orders, account/auth/dashboard paths, editor preview URLs and unknown workspace paths receive noindex. HTML also carries X-Robots-Tag. Private routes still load the SPA without redirects; existing authentication/authorization is unchanged. No account fields or operational query/path identifiers enter metadata. Account dialogs on a public homepage do not make private data part of that homepage's server metadata.

Required title/description, canonical, OG and Twitter tags are deduplicated. Only canonical versioned Cloudinary originals get a padded 1200 x 630 JPEG rendition; this does not modify the stored source. External/already transformed HTTPS images retain their exact URL and do not receive invented dimensions or MIME. No image is fetched from the server. Local read-only HTTP image checks are separate evidence, not a runtime dependency.

## Routing and browser compatibility

The public URL is never redirected by metadata rendering. `product`, `item`, `id` and `/marketplace/<key>` remain recognized; `ref`, search and filters remain in the opened URL. Canonical tags omit tracking/private query parameters and use only the verified business domain. Metadata is identical for different visitor cookies/referrals.

The existing Marketplace sheet/history implementation remains in place. Its initial and popstate parsers now share the same legacy-key parser; checkout, enquiry and referral capture code are unchanged. Existing app shell and published-site rendering continue after JavaScript loads. Missing assets return a real 404 instead of HTML; existing mounted API/webhook handlers retain priority. Unknown `/api` URLs return JSON 404, not the SPA. `/index.html` is handled dynamically rather than bypassing metadata through static middleware.

## Security, caching and cost

Canonical origin comes from the existing business config, never Host/Forwarded/cookies. Slugs, request-target length and image URL length are bounded; metadata text is clipped and HTML-escaped. Only public HTTPS image URLs are accepted (no credentials, unsafe schemes, backslashes, loopback/private IP literals, internal hosts or custom ports). There is no redirect destination, arbitrary URL-fetch endpoint or server-side image validation, so owner image URLs do not create SSRF. No private records or tokens are embedded in HTML.

Dynamic HTML uses `Cache-Control: no-store` for success, not-found and error responses, with no app-level metadata cache. Every new request sees the current public publication state. Hashed compiled assets remain immutable; other static assets use a short cache. Database failure returns 503/noindex and Retry-After rather than stale public owner metadata. CDN overrides must not cache HTML during activation. WhatsApp/Meta may retain their own historical preview caches, which the application cannot purge; unpublishing blocks future origin requests but cannot revoke a previously cached external card.

Runtime work is reading a cached built HTML string and one indexed public lookup (plus existing category labels for a product), with no customer-specific state, network image validation or full page render. Existing slug/primary-key indexes are reused. There is no schema change, migration or new dependency.

## Controlled activation procedure — requires a separate approved release

1. Record current main, both Render Live revisions, current custom-domain associations, DNS records/TTL and rollback contact/access. Retain the current Static Site and its successful deployment.
2. Recheck this PR's scope, fresh main and PR #29 overlap; resolve integration separately if main advanced. Do not absorb #29 to release metadata.
3. After founder authorizes the release, deploy the reviewed code normally to the existing API Web Service. Do not execute manual migrations or financial operations. Existing normal application startup remains unchanged.
4. Before moving traffic, verify the API's direct public HTML URLs for a known product, two published sites and services using a crawler user agent. Verify HTML content type, one authoritative set of tags, no-store, the image MIME and asset URLs, app startup and API health. Build the SPA with the API's existing supported configuration; an empty VITE_API_BASE_URL uses same-origin /api after the domain transfer. An explicit value must be the existing HTTPS public API origin, never a private hostname. No new secret/env variable is introduced by this feature.
5. Obtain the explicit custom-domain/TLS/DNS approval. In Render, move the verified production custom-domain association(s) from Static Site `srv-dav1h80jo6nc73f2vro0` to Web Service `srv-daud2auk1f9s73bc5ph0`. Follow the actual Render DNS/TLS instructions for apex and any existing www redirect, preserving the public URL. Do not delete either service. No new paid service is needed by this design; do not change plans without approval.
6. Inspect **original-domain** raw HTML at the unchanged shared URLs, including `?product=...&ref=...`; verify no redirect strips the query. Confirm direct pages load all compiled assets and anonymous/account navigation works. Verify health and safe public endpoints. Never create test customer orders, initiate payments or publish/unpublish a real customer site as a smoke test.
7. Only after the original domain is proven dynamic report Public HTTP Rendering VERIFIED. Complete the separate actual WhatsApp and founder Android checklist below. Keep API health and error logs under observation; no financial actions are part of acceptance.

## Rollback

If domain activation fails, restore the original custom-domain association and the recorded DNS values to the retained Static Site, verify Render TLS, the original SPA fallback and API health. This restores the prior browsing experience (and prior generic crawler previews). Both service IDs and retained successful revisions must be accessible before attempting the domain move. Restore the previously verified frontend deployment if a frontend artifact also changed. Revert the metadata commit normally for a later backend deployment if required; never reset/force-push main or restore a database. This feature changes no data/schema, so no data rollback is needed.

Rollback is documented and code-independent, but the actual domain transfer/reversion has NOT been executed or rehearsed against production in this pass. Render access during investigation allowed read-only viewing of the existing rewrite configuration. Reconfirm domain permissions and DNS access at release time.

## Real-device acceptance (NOT completed by automated checks)

- WhatsApp Android and WhatsApp Web: compose, without sending, an unchanged published product link and check actual saved product title, photo, truthful price and availability. Test another product, a quote/from-priced listing if publicly available, two published owner sites and service links. Do not send customer information or messages as part of automated acceptance.
- QuickByte and existing legacy Data owners: compare the current banner/logo/name and URL with the unchanged published renderer. New Data websites must use neutral starter artwork. Replacing another existing owner's legacy artwork is a separate owner/founder decision, never an automatic migration. Do not edit customer sites during acceptance.
- Open the link: product details opens once; close returns to browsing; filters/search and `ref` survive; browser/Android Back and Forward and refresh work without a loop. Confirm service navigation and direct published-site loading.
- Repeat on a physical Android phone. Browser emulation is not evidence of physical Android acceptance.
- For an old cached preview, compare fresh crawler HTTP with the actual card, use Meta's sharing refresh tools where available, and allow platform cache refresh. Do not change customer slugs or promise instant WhatsApp cache eviction.
- A newly published product is tested only when the founder supplies a separately approved safe record. No production test publication is authorized here.

Actual WhatsApp card rendering, physical Android navigation, original-domain dynamic HTTP and production activation remain separate release gates until observed. A correct local HTML response or browser document title is not proof that WhatsApp is fixed in production.

## Initial implementation evidence (19 October 2026, c4286fe)

- Final focused metadata/routing/Marketplace/publishing pass: **108/108 passed**, zero skips.
- Full isolated regression: **2148 total, 2121 passed, 0 failed, 27 optional skips**. Unchanged parent evidence: 2093 total, 2066 passed, 0 failed, 27 skips. Net addition: 55 tests, no new failures and no inherited failure waived. The skips are existing optional database/fixture jobs, not failed metadata tests. SQL read-only projection tests use a mocked pool; no real production or disposable PostgreSQL instance was needed because no SQL schema/migration is added.
- Initial full run found two source-location/format assertions after extracting metadata. Their discovery/availability intent was retained and they pass in the final suite. These were corrected assertions, not dismissed inherited failures.
- Final TypeScript and production build passed. Existing non-blocking chunk/dynamic-import build warnings remain. Diff check passed.
- Compiled HTTP, without JavaScript: saved public Dell fixture returned its actual name, GH₵4,450, its primary image and HTTP 200; saved public QuickByte fixture returned `Quickbyte data` (the owner's content.businessName capitalization), original legacy banner and saved favicon, HTTP 200. Both responses served the final compiled JS with HTTP 200. These were local integrations using read-only public API projections, not production routing activation.
- Public image HEAD checks: Dell social rendition 200 image/jpeg, 38,593 bytes; QuickByte rendition 200 image/jpeg, 106,157 bytes. Existing QuickByte public projection was reread and remained byte-equivalent after JSON normalization. No customer content or stored artwork was written.
- Compiled synthetic browser: product opens once from a direct URL; closing retains ref/category; selecting another product, Back, Forward and refresh all work; legacy path and ID canonicalize in the existing client journey without dropping ref/search. Observed owner cafe and Data pages use independent names/images, with the empty Data catalogue truthfully unavailable. No browser error/warning in the checked final synthetic tab. 390px product and owner-site checks showed no horizontal overflow. No actual WhatsApp message, native Android test, order or payment was performed.
- PR #29 changed-file inventory was reviewed. This candidate changes none of its 22 files; its pending Earn/Footer functionality is untouched.

Evidence logs and synthetic screenshots are retained privately outside Git in `C:\Users\AB\Documents\Codex\social-sharing-evidence`. No browser fixture server, screenshot, log, environment file, generated dist output or customer data fixture is committed.

Readiness: code/build/isolated integration verified; ready for PR and infrastructure review. **Not deployed; original-domain dynamic HTML NOT activated; actual WhatsApp preview and physical Android navigation UNVERIFIED.** Approval, Render custom-domain/TLS/DNS coordination, exact rollback access, post-routing HTTP checks and real-preview acceptance are still required. No merge or production release is included in this implementation pass.

The follow-up corrections and actual Render preflight are documented in [social-sharing-render-preflight.md](social-sharing-render-preflight.md). That report supersedes the original neutral-fallback policy for existing legacy owners and records the newer test totals and migration gates.
