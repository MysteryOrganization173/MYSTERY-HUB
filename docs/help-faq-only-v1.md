# Help & FAQ-only release V1

Starting verified main: `a4b8ef0e94f695b252aacac88ba713253092b571`.
Extraction source: `feat/premium-trust-faq-facelift`, `7f2b8d0e67a4eb04e13ab34964c020d9fb1063ed`.
Fresh branch: `release/help-faq-only-v1`. Original source and unrelated worktrees are preserved. No combined source commit was cherry-picked.

## Scope and preservation

Public `/help`, `/help/index.html` and `/faq`; 18 shared answers in seven categories; four-question Home/About previews; native details/summary keyboard/pointer disclosures with safe React text rendering, visible focus and reduced-motion rules; guest/member desktop/menu/account/footer Help links; Help metadata; existing WhatsApp support and distinct Mystery AI action.

Home retains main's Hero, artwork, services, WhyMysteryHub, Coming Soon ordering, authentication bootstrap and member dashboard. Only the FAQ preview is appended. Original homepage CSS remains verbatim before scoped FAQ additions. Five mobile tabs remain Home, Data, Website, Earn, Orders.

Excluded: HomeTrustAnalytics, trustAnalytics configuration, sample statistics/preview, analytics CSS, mixed analytics tests and documentation. No testimonials, reviews, counters, additional dependencies, backend endpoints or protected-system changes.

Copy was checked against exact main: phone-only signup; receipt email still required for standard Data including Wallet; guest reference tracking; authenticated account history; payment separate from delivery; conditional rewards/refunds/availability; Wallet cannot cash out or earn interest; account-backed Free Builder publishing; configured/enabled reseller checkout; Marketplace enquiry is not paid; AFA availability and Coming Soon limitations; AI is general guidance, not payment investigation. Pending optional-email/phone-search work is excluded.

Payment initialization/verification/webhooks/reconciliation, pricing/promotions/referrals, Wallet/ledgers, supplier dispatch, authentication/authorization, privacy, Builder/reseller operations, migrations and production configuration are unchanged. No secrets, environment files, generated output, screenshots, logs or local helpers enter this commit.

## Verification — 12 October 2026

- Focused FAQ/routing/navigation/member/customer-copy tests: 38/38 passed, including 15 new FAQ-only tests. Existing tests are unchanged.
- Full isolated regression: 1517 total; 1513 passed, 3 failed, 1 skipped.
- Exact unchanged main baseline: 1502 total; 1498 passed, the same 3 failed, 1 skipped. Its clean detached checkout and completed full-run log were reverified; the run was not repeated unnecessarily. Difference: 15 additional passes, zero new failures.
- Inherited failures: obsolete Direct SIM bundle-card copy assertion; Builder V1 template-name expectation; Free V1 literal schema/SQL mirror assertion. These systems were not altered.
- TypeScript, production build and diff check passed. Existing Vite configuration/chunk warnings remain non-blocking.
- Real compiled Help and guest Home inspected at 320, 360, 390, 430, 768, 1024, 1280px plus 360x480 short mobile. No Help/FAQ horizontal overflow, missing assets/fonts or new navigation obstruction. Existing bundle-card density at 1024px is outside this FAQ scope; its source and original styles are unchanged.
- Original trust, collapsed/expanded preview, Enter/Space/pointer interaction, all 18 expanded answers, category anchors, alias/refresh, guest/member menus, account dropdown, Footer/About links and AI open/close verified. Member dashboard inspected at 390 and 1280px; no browser console errors recorded.
- Evidence: `C:/Users/AB/Documents/ChatGPT/MYSTERY HUB/help-faq-only-v1-evidence`, 27 screenshots plus logs/worktree inventory. Synthetic GET-only static preview; external APIs and application mutations blocked. No backend/database/provider started.
- Pre-release public frontend HTTP 200; documented backend `/api/health` HTTP 200 JSON status ok. These do not identify deployed revisions.

Local browser emulation is not physical-device or deployment verification. Public UI, Render revisions and Git push must be reported separately.

## File inventory

Created (6):
- docs/help-faq-only-v1.md
- server/suppliers/__tests__/helpFaqRelease.test.ts
- src/components/common/FaqAccordion.tsx
- src/components/help/HelpPage.tsx
- src/components/home/HomeFaqPreview.tsx
- src/data/helpFaqs.ts

Modified (9):
- src/App.tsx
- src/components/about/AboutPage.tsx
- src/components/common/Footer.tsx
- src/components/common/Navbar.tsx
- src/components/common/SEOHead.tsx
- src/components/home/HomePage.tsx
- src/components/home/homepage.css
- src/types/index.ts
- src/utils/routing.ts

## Conditional release and rollback

Local gates A-R pass, subject to fresh remote-main and final-commit checks immediately before integration. Only this FAQ branch may fast-forward main. Unexpected main movement/new failures block merge. Preserve original/release branches. Normal push only; no manual deployment or configuration/data mutation.

Pre-merge main / rollback reference: `a4b8ef0e94f695b252aacac88ba713253092b571`. Release is one new commit. If rollback is needed: fetch latest main, use a clean checkout, `git revert <FAQ_RELEASE_COMMIT>` (the commit introducing this document), inspect the inverse FAQ-only diff, run affected checks/build, push normally and verify public UI/API. Preserve later history; never reset/force-push. This is a prepared procedure, not an executed rollback.

After main push inspect public Home/Help, FAQ/navigation, artwork/service routes and documented backend health. If Render revisions/startup logs cannot be independently accessed, deployment status remains UNVERIFIED even if public observations pass.

Next priority: Website Builder V1.2 — Renderer Parity, Contrast Safety and Draft/Published Separation. No Builder work is included.
