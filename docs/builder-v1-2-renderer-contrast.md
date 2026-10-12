# Website Builder V1.2 — renderer and contrast workstream

Base: verified main d2d27a61db771bb3a66bf1e512b95c89cc82bd20. Branch: fix/builder-v1-2-renderer-contrast. No persistence migration in this workstream. Draft/public separation is the dependent next workstream; this branch alone must not deploy.

## Confirmed causes and contract

Editor rendered shared template utilities inline; CSS media queries used the editor browser width rather than simulated canvas width. Public reseller bypassed that renderer and always rendered DataResellerTemplateView, ignoring customized composition/visibility/order. Runtime managed description replaced owner copy; public reseller bypassed shared saved contact/social details. mergeSiteWithTemplate accepted partial color values and retained inherited text colors on changed backgrounds; section hero did not resolve foreground for its own surface. Contact CTA had fixed dark text on any accent.

WebsiteSiteRenderer is the shared public/owner entry. ManagedDataStorefront remains the operational adapter with existing authoritative catalog/payment/tracking logic. It supplies the protected catalog to renderTemplateLayout. Legacy reseller layout retains its design; composed reseller pages use SectionSiteRenderer with the same catalog inserted once, including a fallback before footer when no catalog section is enabled. Managed item prices are never read from editor section cards. UI explains this controlled surface; arbitrary managed CTA destinations are disabled and the managed primary action leads to the catalog.

Supported identity, hero, logo/images, section data/order/visibility, theme and contacts/social links pass through the same merge/renderer. Existing IDs/slugs/migration rules are unchanged. Catalog availability remains operational, distinct from owner text. Template demos remain demonstrations. Owner draft previews suppress payment initialization/reference queries/checkout analytics, external link actions and form submissions; public transaction behavior is preserved. Preview catalog is read-only public data and may be unavailable before the first publication; preview copy explains the limitation.

WebsitePreviewFrame uses the existing same-origin isolated route and checks both message origin and frame source. Editor device widths are real iframe viewports (1280/768/375), scaled only visually to fit the panel; owner full preview and dashboard preview use the same presentation. This is not a new editor. A 375px device preview is explicitly different from a 320/390px physical viewport, which is reviewed separately.

Existing websiteBrand normalization/contrast helpers handle partial/invalid colors without mutating saved values. Background, card surface, primary/accent controls and contact CTA receive readable foregrounds; section hero uses its own surface foreground. Fixed artwork surfaces remain intact. Narrow scoped legacy-control CSS applies only to controls already using owner theme variables. No Mystery Hub green replaces owner branding. Template-switch inherited colors remain safe at render time.

## Checks

Registry-wide saved-content parity tests cover all 14 templates; mixed light/dark/bright theme cases, invalid inputs, composed managed catalog placement, owner description/CTA, real iframe contract, nontransactional boundaries and stable identity/migration are covered. Initial focused run: 311 passes / 312 tests; the sole failed Free V1 literal schema assertion is independently reproduced on unchanged main. Final focused checks: 80/80 passed. Compiled browser checks confirmed a shared managed owner presentation and exact iframe widths (1280 desktop / 375 mobile); evidence is recorded in the external builder-v1-2-evidence folder.

Fresh unchanged-main full baseline: 1517 total, 1513 passes, 3 failures, 1 skip. Failures: bundle-card obsolete Direct SIM assertion; Builder V1 template-name assertion; Free V1 schema mirror assertion. No unrelated failure is rewritten. TypeScript/build/diff checks pass. Existing build warnings remain.

No backend/payment service, database, commercial pricing, supplier, ledger, auth or provider configuration changes. The preview flag only adds early no-op boundaries; public mode remains false. Published catalog, payment contracts and network/WhatsApp branding are retained. Evidence uses synthetic owners, an in-memory WebsiteStore and blocked financial/provider endpoints; no live customers or production database/provider calls.

Workstream B must add a trusted saved-draft/published-state boundary and published-asset reference protection before the combined release is reviewed. Main remains untouched; no deploy is authorized.
