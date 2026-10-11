# Premium trust presentation and Help & FAQs

Frontend-only change based on verified main `a4b8ef0e94f695b252aacac88ba713253092b571`.

## Customer experience

The public homepage keeps the existing hero, artwork and service discovery. `HomeTrustAnalytics` replaces the previous `WhyMysteryHub` placement rather than duplicating it. Coming Soon content remains distinct. A four-question FAQ preview follows the lower homepage sections.

The public `/help` route contains 18 answers across seven categories. `/faq` resolves to the same page. Guest and member navigation, the member account menu, Footer and About expose Help & FAQs. The five mobile destinations remain Home, Data, Website, Earn and Orders. Mystery AI remains a separate guidance option.

`FaqAccordion` uses native details/summary disclosures with visible focus, keyboard expansion, safe React text rendering and reduced-motion handling. Shared `helpFaqs.ts` content powers Help, the homepage preview and About. Existing service-specific FAQs remain in place.

Answers describe released main: standard Data checkout currently requires a receipt email, guest tracking uses the purchase reference, account history requires authentication, and payment confirmation is separate from delivery. Pending optional-email and phone-search work is not included. Rewards, refunds and service availability are described conditionally without guarantees.

## Static statistics approval

`src/config/trustAnalytics.ts` separates sample statistics, truthful service indicators and `APPROVED_TRUST_STATISTICS`.

The approval list is intentionally empty. Production therefore presents Paystack checkout, order-reference tracking, Mobile Money support and Ghana-focused digital services. No performance totals or uptime promises are published.

To publish an actual statistic later:

1. Verify its value and precise meaning against authentic source records, including period and denominator where relevant.
2. Obtain founder approval. Store only a public-safe evidence description, reviewer and verification date; never put customer records or private source documents in the browser bundle.
3. Add the approved value/label/detail to `APPROVED_TRUST_STATISTICS` with `status: 'verified'`, nonempty `evidence`, `approvedBy`, and an ISO `verifiedOn` date.
4. Review the resulting claim and responsive layout before release. A draft or incomplete approval record falls back to truthful capability content. Four positions are retained; verified figures use the large-number treatment.

This is manual editorial approval, not automated verification of records. There is no analytics service, polling or database counter.

`HomeTrustAnalytics designPreview` renders exactly 12K+ Orders Delivered, 99.9% Payment Reliability, 5K+ Active Customers and 24/7 Platform Access, alongside a conspicuous Sample figures / Design preview only disclosure. Production never enables this prop. No public sample route, query switch or environment flag is added; the isolated preview harness is outside Git.

## Adjacent integration impact

- `ActivePage`, routing, App and SEOHead gain only the Help destination and metadata.
- Navbar gains Help links and a Help search shortcut. Desktop link spacing/font size is adjusted to keep the existing header within 1280px, including for members.
- Footer gains one Help link.
- About replaces duplicated FAQ copy with the shared preview and adds View All FAQs; its other content and artwork are unchanged.
- Two existing homepage composition assertions are updated for the approved trust component replacement; member/auth/overlay assertions remain intact.

No backend routes, providers, payments, auth/session handling, pricing, ledgers, referral economics, order processing, Builder operations, AI routing, dependencies or environment configuration are changed.

## Verification — 11 October 2026

- Focused frontend/navigation tests: **42/42 passed**, including **19 new regression tests**.
- Full isolated suite: **1521 total; 1517 passed, 3 failed, 1 skipped**.
- Unchanged main baseline: **1502 total; 1498 passed, the same 3 failed, 1 skipped**. Result: 19 additional passes and no new failures.
- Existing failures: bundle-card legacy Direct SIM copy assertion; Builder V1 expecting QuickByte Data instead of Ghana Data Express; Free V1 literal SQL/schema mirror assertion on Windows line endings. These systems were not modified.
- TypeScript (`npx tsc --noEmit`), production build and `git diff --check`: passed. Existing large-chunk build warning remains non-blocking.
- Compiled trust/capability and Help views inspected at **320, 360, 390, 430, 768, 1024 and 1280px**. Labelled sample figures also inspected at every width. No horizontal or metric overflow; mobile cards remain 2×2; badges wrap; summary controls are at least 56px tall.
- Short viewport **360×480**: menu scroll, Help entry and expanded answer checked.
- Enter and Space expand/collapse the homepage FAQ. Pointer activation and expanded tracking answer checked on mobile. Homepage, About, guest menu and signed-in shortcuts reach `/help`; menu closes after navigation.
- Synthetic member dashboard inspected at 390px and 1280px: existing Wallet/order/activity/service layout preserved, without guest marketing. AI opens and closes as a distinct Help action without submitting a message.
- Existing approved artwork renders; existing font stylesheet and computed font families remain intact. No new images, dependencies, animations or counters are introduced. Built JS gzip increases from 319.26kB to 322.39kB; CSS gzip from 30.10kB to 31.19kB.

Evidence is outside the repository at `C:/Users/AB/Documents/ChatGPT/MYSTERY HUB/premium-trust-faq-evidence`: before/after homepage, trust cards/badges, collapsed/expanded FAQs, Help at all widths, guest/member/account menus, member dashboard and labelled samples; focused/full logs and build/typecheck logs. Baseline log: `C:/Users/AB/Documents/ChatGPT/MYSTERY HUB/checkout-tracking-v1-evidence/main-baseline.log`.

The preview serves compiled static files and synthetic GET responses only. Application mutations and external API requests are blocked; no application backend or database is started, and no real payment, supplier call, Wallet debit or account mutation is performed. Screenshots, preview helpers and build output are excluded from the commit.

## Release status

Ready for founder review on the dedicated feature branch, with the three disclosed inherited test failures. No new implementation blocker identified. Browser evidence is local emulation, not physical Android/network or production verification. No merge or deployment is authorized by this checkpoint. Next action: review the production capability panel and Help copy, then explicitly approve a release. Publishing numeric claims separately requires authentic verified records and founder approval.

## Committed file inventory

Created (8):

- `docs/premium-trust-faq-facelift.md`
- `server/suppliers/__tests__/premiumTrustFaq.test.ts`
- `src/components/common/FaqAccordion.tsx`
- `src/components/help/HelpPage.tsx`
- `src/components/home/HomeFaqPreview.tsx`
- `src/components/home/HomeTrustAnalytics.tsx`
- `src/config/trustAnalytics.ts`
- `src/data/helpFaqs.ts`

Modified (11):

- `server/suppliers/__tests__/customerReleaseIntegration.test.ts`
- `server/suppliers/__tests__/memberHomeAuth.test.ts`
- `src/App.tsx`
- `src/components/about/AboutPage.tsx`
- `src/components/common/Footer.tsx`
- `src/components/common/Navbar.tsx`
- `src/components/common/SEOHead.tsx`
- `src/components/home/HomePage.tsx`
- `src/components/home/homepage.css`
- `src/types/index.ts`
- `src/utils/routing.ts`

Removed: none.
