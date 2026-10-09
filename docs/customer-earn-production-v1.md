# Customer Experience V1 + Mystery Earn V2 — production integration

Release decision: **publish the verified integration candidate; do not merge main unless the separate public frontend deployment gate is confirmed.** The actual public service is identified, but its repository, tracked branch and automatic deployment settings are not accessible from this session. Backend Render confirmation alone does not establish that the customer domain will receive this release.

## A. Git inputs and integration

- Starting production main: `da36f1e874911bc92499be1762dfbacc0a3543f5`.
- Released privacy commit: `fcc82763cc7176a6e01ab4dceee83c542b47c367`, in main ancestry. Founder confirmed main's Render deployment Live.
- Customer Release V1: `77887d3a5a6261b225ead164a33b2321926275bc`.
- Combined Earn V2 source: `f731b52341bbecaef7d4ec0fb560e9b28e6f4c45`, containing the full customer release.
- Merge base: `5233879079413b6422f829631676b16c3ea81597`; source/main comparison was eight feature commits ahead, two production commits behind, as expected.
- New branch/worktree: `integrate/customer-earn-production-v1`, `work/customer-earn-production`, created from freshly fetched main.
- One normal three-way merge of the complete combined source preserves all source commits. No cherry-picking individual P0/P1/Account branches, manual tree flattening, rebase or history rewrite.
- **Conflicts: none.** Main privacy paths and source customer paths had no overlap. No conflict resolutions were required.
- Main's serializers, API client, auth/backend routes, stores, supplier/payment/finance services, shared economics, schema, deployment/dependency files and original 75-case privacy suite remain byte-identical to main.
- Three narrow type-only integrations: `MemberHome.tsx` state, `MemberHomeView.tsx` props and `memberHomePresentation.ts` owned-order tracking now explicitly use `AuthenticatedCustomerOrderDetails`. Generic status/selection helpers still accept the public base where appropriate. No `any`, private-field duplication, new API or runtime authorization workaround was added.
- Eight new regressions in `customerEarnPrivacyIntegration.test.ts` exercise the actual account API client over real isolated Express HTTP, own-order rendering, guest/valid-token public masking, other-account emptiness, revoked-session history, hidden retained orders while loading/error, and the authorized-client/session-remount boundary.
- Final changed inventory: 66 paths versus starting main: 61 exactly match the approved source, three contain the explicit type correction, one is the new test and one is this report. The exact inventory follows below. The source's existing non-runtime `scripts/reviewHomepage.py` is preserved; no new preview/debug helper is committed.
- Final integration SHA and exact remote HEAD are reported in the accompanying delivery/Git record. Original source branches and all existing worktrees are retained. Main release is strictly gated below.

## B. Product integration and compatibility

Guest Home preserves the approved P1 Cloudinary hero, utility/services hierarchy, Builder showcase, Marketplace, support/footer, approved logo/fonts, accurate availability and P0 copy. Create a Free Website, Data, Airtime, Marketplace and Earn navigation work. Broken hero imagery keeps readable copy and usable CTAs; actual Cloudinary imagery loaded during review.

Member Home preserves the compact coordinated **greeting / Wallet / latest-order overview**, followed by Quick Services, recent activity, Builder/Earn discovery and support. Guest marketing is not appended. Wallet values come from the finance endpoint, never order-derived balances; loading, true zero, unavailable and retry states are distinct. Active/recent orders retain authoritative statuses and owned recipients through the authenticated account endpoint.

Account V1 signup/login/menu feedback, optional email, validation, remembered/session-scoped bootstrap, forced-password and protected-route continuation are preserved. Backend session and recovery contracts are unchanged. Logout unmounts the keyed member state; late private orders and Wallet responses cannot populate a different account.

Earn V2 retains guest/member presentation, enabled identity-gated attributed sharing, clipboard rejection fallback, native-share cancellation, service-specific destinations, distinct visit/browser/account statistics, network levels, pending/approved activity, actual financial available balances and legitimate achievements. No fallback generic link is passed off as an attributed referral link. Finance errors disable cash-out/transfer and retain clear stale/unavailable messaging. Existing confirmation, fee and irreversible-transfer warnings survive.

Builder landing, template preview, synthetic owner dashboard/editor media navigation and representative public Restaurant/Data Reseller templates remain usable. Reseller owner accent stays purple in synthetic Buy/Pay presentation; no activation, price or reserve change. Marketplace inquiry explicitly remains distinct from order/payment. Data and Airtime checkout entry, displayed totals, guest payment presentation and funded-member Wallet selection remain intact; no payment was submitted.

Privacy is unchanged: general lookup, reseller tracking, verification and cancellation use allowlisted masked public projections; private address/contact/economic fields remain excluded. User-id-owned account history retains richer authorized details, Admin remains behind RBAC, and reseller ownership/economic boundaries remain intact. No-store, lookup validation/rate limit and generic error logging remain. Public guest tracking uses the masked recipient successfully; no reference-based ownership inference.

## C. Security and financial isolation

- Main's `usePaystack.ts`, `ManagedDataStorefront.tsx`, absent checkout-attempt helper, server routes/services/db/types and shared financial calculations are unchanged.
- Excluded checkout commits `b0e85b33fd804cc654cdc2d38fe13e2d7ed027cf`, `6535c43d4d47033ca8192ab4b173d288d2200602` and combined `9e25bd41a820b16e2074a5b074058435cb9008f3` are not imported.
- Approved FinancialPanel changes are inherited Earn-mode presentation/action gating and copy. Wallet balances, available earnings, reward rules, fees, request identifiers, ledger, webhook, payout, supplier dispatch/reconciliation and migrations are unchanged.
- Cross-account tests cover actual backend ownership/revocation and actual compiled React late-response disposal for Member Home and Earn. Auth expiration/restoration and forced-password presentation remain functional.
- Test runner sets NODE_ENV=test and deletes inherited DATABASE_URL and external-test opt-in. Synthetic/memory/provider mocks only. Optional disposable PostgreSQL coverage is skipped; production/external PostgreSQL was never used.
- Browser serves only the actual built `dist` over loopback, without the app backend or environment initialization. APIs are intercepted; financial/auth actions are synthetic responses. Paystack is stubbed, unknown mutations blocked. Fonts/Cloudinary are allowed solely for visual loading. No production customer credentials/reference, real payment, payout, achievement credit, supplier order, publish/save or live database operation.
- No secrets, environment files, logs, screenshots, generated build files or new dependencies are committed. Build artifact checks find assets present and no tested secret-key patterns, hardcoded local API endpoint, Windows user path, integration fixture or development payment simulation copy. These checks are scoped static evidence, not an exhaustive secret-scanner certification.

## D. Verification

- Broad focused selection: **863 total; 862 passed, zero failed, one skipped**, zero cancelled. Includes customer/copy/release/Earn, referral tracking/economics, auth/recovery, finance, checkout/Airtime, Marketplace, Builder/reseller, Admin and production/privacy integrity. The skip is the existing optional disposable PostgreSQL finance-kind test. The two known failing Builder files are assessed in full regression/baselines below.
- New integration tests: **8/8 passed**; unchanged privacy suite: **75/75 passed**.
- One full integrated regression: **1,433 total; 1,429 passed, three failed, one skipped**, zero cancelled.
- Exact unchanged main `da36f1e` failed-set reproduction: **152 total, 149 passed, the same three failed**. Exact Earn source `f731b52`: also **152 total, 149 passed, the same three failed**. These are focused failed-set reproductions, not additional full baseline runs.
- Failures: stale BundleCard Direct SIM delivery-copy assertion; Website Builder sample-name assertion (QuickByte Data / Ghana Data Express) causing its test-file failure; Windows CRLF-sensitive SQL-mirror string assertion in websiteFreeV1. No valid guard was deleted or weakened during integration.
- Earlier source full run was 1,346 passed / three failed / one skipped (1,350 total). Integration adds 75 privacy + eight new passing tests, giving +83 cases/passes and the identical failing set. Main's earlier full run was 1,363 passed / six failed / one skipped (1,370 total); differing approved customer test sets explain different totals. The three obsolete Earn/member failures do not persist in the approved Earn V2 tests. Totals are not treated as interchangeable.
- `npm run lint` / TypeScript: **passed**. `npm run build`: **passed**, with only inherited non-blocking native-loader/__dirname and chunk-size warnings. Working and final staged/committed `git diff --check` are checked at publication.
- Production assets: `index-iAnwAnMr.js`, `index-DKRb3Jhs.css`; actual integrated app was served for browser tests. These local filenames are not a deployed revision claim.

Browser results (synthetic data, actual compiled production frontend):

- Guest/member Home and guest/member Earn: **320, 360, 390, 430, 768, 1024, 1280px**; 360x640 included. All 28 first-viewport screenshots were inspected. Layout/width/offscreen-control checks passed. Combined account overview, guest hero and compact Earn sharing/finance composition confirmed.
- Signup, incorrect login, duplicate-submit protection, duplicate-account recovery, logout, remembered/session restore, expiration, forced password and protected Wallet continuation passed.
- Member loading, positive/zero Wallet, empty/active/recent orders, errors and independent retries passed. Old account orders/Wallet remained absent after delayed responses and second-account login.
- Earn sharing/copy/fallback/cancellation, current-session attribution, disabled/unknown/stale states, rule retry, network counts, rewards/history, achievements and guarded synthetic cash-out/transfer passed. Wallet mode and top-up entry preserved. No live financial action.
- Builder/editor/template/owner-brand preservation, Marketplace inquiry and Data/Airtime checkout entry passed. Guest public tracking retained `******0000` and authoritative processing status.
- Keyboard menu focus return, disclosure controls, 50-row reward-region keyboard scrolling, visible focus rings and short withdrawal confirmation passed. Additional 320x568 account-menu access and media-failure fallback passed.
- Two review-script issues were corrected outside application source: an old local port, and an incomplete synthetic finance fixture missing ledger/topups/achievements/settings. A lazy image screenshot was recaptured after the actual image completed loading. Final affected journeys passed; these were not application refactors.
- Physical phone keyboards/safe-area hardware, native WhatsApp/OS share handoff, screen-reader certification and real financial transactions remain unverified. Deterministic browser share/clipboard responses are explicitly synthetic.

Evidence remains outside Git under `customer-earn-production-evidence/customer` and `/earn`. It covers all requested categories: guest/member mobile/desktop, combined overview/latest order, Quick Services/recent activity, signup/menu/mobile navigation, Builder showcase, Marketplace, Earn sharing/balance/history, Wallet, masked public tracking, loading/empty/error, 320px and short viewports. Logs and JSON record observed results. Representative screenshots were compared with existing customer/Earn evidence; source design remains intact.

## E. Hosting, release gates and rollback

Read-only findings on 9 October 2026:

- Founder confirms API Render service `mysteryhub-api`, repository MysteryOrganization173/MYSTERY-HUB, branch main, repository root, `npm install && npm run build`, `npm run start`, no pre-deploy, Auto-Deploy On Commit; privacy-main `da36f1e` displayed Live with successful startup/database initialization.
- API `/health` and root respond successfully. Server can serve its Vite dist, but this alone does not identify public-domain frontend delivery.
- `www.mysterybundlehub.com` DNS CNAME points to **mystery-hub.onrender.com**. That service, www and apex serve the same frontend asset pair: `index-DeQ0wo0c.js`, `index-ByOTGINB.css`. A cache-busting apex request retained the same asset pair. API root serves a different JavaScript asset `index-B8xcrfMz.js` with the same CSS.
- Public frontend JavaScript references the expected `https://mysteryhub-api.onrender.com` API origin. Thus customer frontend and backend are separate deployment outputs; a backend-only release cannot establish customer UI rollout.
- Public HTML uses Cloudflare with `public, max-age=0, s-maxage=300`; HIT/MISS observations indicate shared-cache behavior. Five-minute shared HTML caching can delay visibility; browser HTML revalidation and content-hashed assets are distinct. No cache purge, DNS or environment changes.
- Tracked render.yaml describes a static frontend build/publish/SPArewrite, but actual frontend repository linkage, main tracking, root/build/publish settings and Auto-Deploy cannot be established solely from it. The dashboard attempt reaches Render sign-in; no authenticated Render connector is available. The founder was asked for non-secret frontend dashboard confirmation while independent work continued.

Mandatory gates:

- **A Git — PASS:** exact verified inputs/history, privacy retained, checkout excluded, concurrent checks before publication.
- **B Scope — PASS:** approved source plus three type corrections/eight integration tests/report; protected financial/server files unchanged.
- **C Privacy — PASS:** original 75 cases plus new real HTTP/client/UI chain.
- **D Authentication — PASS in isolated testing:** backend auth regressions and compiled synthetic user journeys, restoration/logout/switching/late-response checks.
- **E Finance — PASS:** server authority and unchanged economics; guarded UI and regression evidence.
- **F Functionality — PASS in synthetic compiled UI:** primary journeys/service destinations and preservation checks.
- **G Build — PASS:** TypeScript/build/diff/artifact checks; no dependency or configuration changes.
- **H Tests — PASS:** no newly introduced failures; three exact-baseline failures documented.
- **I Visual — PASS:** all requested widths, coordinated greeting/Wallet/latest order and Earn composition inspected, no critical overflow/obstruction.
- **J Deployment — UNVERIFIED / BLOCKS MAIN:** separate public frontend service identified, but its source/main/auto-deploy configuration requires credible dashboard evidence.
- **K Rollback — PASS:** previous main `da36f1e` recorded. For any later authorized customer-release merge, prepare reviewed `git revert -m 1 <customer-release-merge-sha>` on latest main, verify targeted diff and push normally. It must retain privacy commit `fcc8276` and its protections. No reset, force-push or automatic rollback.
- **L Operational readiness — PARTIAL:** current health, founder-verified backend and local journeys are good; actual customer frontend release readiness depends on J. No infrastructure change is invented.

No main merge/push or manual deployment is performed while J is unverified. Candidate publication is not production release or visible-customer-UI confirmation. Existing main remains `da36f1e`; no new deployment revision is claimed. Once the actual frontend settings are confirmed, fetch main again, recheck candidate/history/diff, and only then reassess conditional release. After any authorized push, separately verify backend and public frontend revisions/assets and safe health. Render logs/new deployment may require founder dashboard evidence; GitHub push alone proves neither deployment.

Remaining founder action: confirm the public `mystery-hub` frontend service's repository, tracked branch, root, build command, publish directory, automatic deployment and domain mapping. If it needs a separate configuration/deployment action, seek explicit approval before changing infrastructure. Pending reseller checkout official Paystack SDK verification stays separate and does not block this presentation release when its own gates pass.

## Exact changed-file inventory

Inventory is appended below from the final audited main comparison. Source commits and release SHA are retained in Git history and the accompanying delivery record.
- docs/customer-account-experience-v1.md
- docs/customer-copy-conversion-p0.md
- docs/customer-earn-production-v1.md
- docs/customer-experience-release-v1.md
- docs/homepage-visual-p1.md
- docs/mystery-earn-experience-v2.md
- index.html
- scripts/reviewHomepage.py
- server/suppliers/__tests__/customerAccountExperience.test.ts
- server/suppliers/__tests__/customerCopyP0.test.ts
- server/suppliers/__tests__/customerEarnPrivacyIntegration.test.ts
- server/suppliers/__tests__/customerReleaseIntegration.test.ts
- server/suppliers/__tests__/earnExperienceV2.test.ts
- server/suppliers/__tests__/marketplaceFlexibilityUi.test.ts
- server/suppliers/__tests__/memberHomeAuth.test.ts
- server/suppliers/__tests__/mobileLayoutPolish.test.ts
- server/suppliers/__tests__/mobileNavEarnServices.test.ts
- src/components/about/AboutPage.tsx
- src/components/admin/AdminLoginCard.tsx
- src/components/ai/MysteryAiAssistant.tsx
- src/components/auth/AuthFields.tsx
- src/components/auth/AuthModal.tsx
- src/components/checkout/CheckoutModal.tsx
- src/components/checkout/OrderStatusModal.tsx
- src/components/common/Footer.tsx
- src/components/common/MobileNav.tsx
- src/components/common/Navbar.tsx
- src/components/common/SEOHead.tsx
- src/components/common/Toast.tsx
- src/components/data/CompactBundleRow.tsx
- src/components/data/DataPage.tsx
- src/components/data/InstantBundlesCatalog.tsx
- src/components/earn/earn.css
- src/components/earn/EarnDetails.tsx
- src/components/earn/EarnSharing.tsx
- src/components/earn/MysteryEarnPage.tsx
- src/components/finance/FinancialPanel.tsx
- src/components/home/Hero.tsx
- src/components/home/HomeComingSoonSection.tsx
- src/components/home/HomeFeaturedData.tsx
- src/components/home/HomeMarketplaceSection.tsx
- src/components/home/homepage.css
- src/components/home/HomePage.tsx
- src/components/home/HomeWalletSummary.tsx
- src/components/home/HomeWebsiteSection.tsx
- src/components/home/MemberHome.tsx
- src/components/home/MemberHomeView.tsx
- src/components/home/QuickServicesBar.tsx
- src/components/home/WhyMysteryHub.tsx
- src/components/marketplace/MarketplaceInquiryModal.tsx
- src/components/marketplace/MarketplacePage.tsx
- src/components/marketplace/MarketplaceProductDetailModal.tsx
- src/components/orders/OrdersPage.tsx
- src/components/services/AfaRegistrationPage.tsx
- src/components/services/MoreServicesPage.tsx
- src/components/website/WebsiteBuilderPage.tsx
- src/components/website/WebsiteBundlePricing.tsx
- src/config/serviceNotices.ts
- src/context/AppContext.tsx
- src/data/services.ts
- src/index.css
- src/utils/authFeedback.ts
- src/utils/earnDashboardRefresh.ts
- src/utils/earnExperience.ts
- src/utils/memberHomePresentation.ts
- src/utils/referralRewardCopy.ts
