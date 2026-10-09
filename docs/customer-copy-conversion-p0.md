# Customer copy and conversion clarity — P0 review

Branch: `feat/customer-copy-conversion-p0`
Verified base: `482eddfd312636325f2963c88b2850b36c8497da`
Delivery: one normal feature-branch commit and push; no merge or deployment. The delivery commit SHA is recorded in the accompanying final response and Git history.

## Scope and outcome

35 files: 33 existing files updated, one focused test file and this report. The changes are customer-facing strings and directly associated presentation, plus an accessible About FAQ using native details/summary elements. No new dependencies, fonts or design system. No production configuration or data changes.

Reviewed public and member Home, service discovery/navigation/footer, Data and bundle presentation, Airtime, AFA, checkout and payment/order states, Wallet, Orders, Mystery Earn/referral sharing/statistics/achievements, authentication/recovery, Website Builder discovery/plans/template guidance/dashboard labels, owner bundle pricing, Marketplace listing/detail/enquiry, About/support/FAQ and metadata. The existing Builder editor/dashboard/template-selection wording and account/security controls were inspected and retained where already clear; customer-created templates and branding were untouched. Admin-only wording and Mystery AI intelligence were outside scope.

Modified surfaces: Home (public/member), services catalogue, Data/Airtime, AFA privacy/education, checkout/status messages, Wallet/Earn presentation, Orders, auth modal, Builder marketing and owner pricing instructions, Marketplace/detail/enquiry, About/FAQ, footer and metadata.

The main problems were administrative language, vague action labels, delivery/support guarantees unsupported by the code, generic sourcing assurances, and wording that blurred payment confirmation with delivery or implied unconditional lifetime referral rewards.

## Before and after examples

| Surface | Before | After | Reason |
| --- | --- | --- | --- |
| Hero badge | Ghana’s Digital Utility Platform | Digital services for everyday life in Ghana | Familiar service language |
| Hero primary action | Create Your Website | Create a Free Website | Clarifies current Free plan; same destination and priority |
| Hero secondary action | Buy Data Bundles | Buy Data | Shorter action; same destination |
| Services heading | Platform Services & Discovery | Explore Mystery Hub | Customer-facing navigation |
| Airtime shortcut | Instant SIM recharge | Top up your number | Removes unverified timing promise |
| AFA shortcut | MTN agent & member ID / Live | Check availability / Check Status | Availability remains conditional |
| Trust card | Reliable Automated Delivery | Track Your Order | Concrete supported benefit |
| Trust card | Competitive Bundle Pricing | Clear Prices Before You Pay | Avoids unsupported competitive comparison |
| Trust card | Always-On Availability | Help When You Need It | Replaces availability claim with support access |
| Upcoming heading | Expanding Ecosystem | More Services Are Coming | Clearly future availability |
| Upcoming action | View All Future Utilities | See What’s Coming | Clear destination |
| Website promotion action | Explore All Templates | Browse Templates | Familiar action |
| Builder action | START BUILDING FREE | Create My Free Website | Describes next step |
| Builder benefit | Direct WhatsApp Ordering | Customer Enquiries on WhatsApp | Does not imply every template has commerce |
| Member Home | Refer & Earn Dashboard | My Referrals & Rewards | Customer perspective |
| Earn sharing | Share Hub · Targeted Referral Links | Share a Service | Removes internal terminology |
| Earn total | Approved lifetime rewards | Total approved rewards | Accurate cumulative approved amount |
| Earn guest badge | MYSTERY EARN · LIFETIME REFERRALS | Mystery Earn | Removes unconditional lifetime framing |
| Wallet history | Transaction History | Wallet Activity | Familiar terminology |
| Withdrawal breakdown | Net | You receive | Explains payout amount |
| Airtime breakdown | Airtime Face Value (Credited to SIM) | Airtime to Your Number | Familiar language; amount unchanged |
| Marketplace detail | Inquire & Request Sourcing Quote | Ask About This Item | Enquiry action is explicit |
| Marketplace retry | Retry Sourcing Catalogue | Try Again | Clear recovery action |
| Marketplace badge | Verified Mystery Hub Supplier | Mystery Hub Marketplace | Removes unsubstantiated verification claim |
| Marketplace delivery | Nationwide Delivery | Delivery Options | Does not guarantee coverage |
| Order empty state | You haven’t placed any orders yet… | No orders to show yet… | Does not assume history from an empty filtered result |
| Auth benefit | Website Builder identity | Create your business website | Explains customer benefit |
| Owner pricing | Sell (GH₵) / Earn | Selling Price (GH₵) / Estimated Earnings | Clear labels without implying guaranteed profit |
| Search title | Mystery Hub — Your Digital World. One Hub. (Ghana) | Mystery Hub — Digital Services Marketplace in Ghana | Accurately represents broader platform |

## Journey and content decisions

- Homepage retains “Everything digital. One trusted place.”, dark/green identity, current composition, Website Builder primary action and Data secondary action. Supporting copy names available services and qualifying referrals. No experiment or CTA hierarchy change.
- Navigation/service cards use available/coming-soon language. AFA entry points say Check Status rather than promising availability. Planned utility descriptions explicitly say unavailable. Waitlist handlers/destinations remain unchanged; no promised notification channel.
- Data/Airtime explain product → recipient → total → payment → tracking. Removed blanket instant-delivery, 24/7-support and immediate-resolution claims. MTN 15–45-minute guidance, possible 48-hour delays and duplicate-order warning remain. “Instant Bundles” remains the existing product-category name, without an immediate-delivery guarantee.
- Checkout preserves bundle summary, recipient, receipt email, Wallet choice, network notice, confirmation, total, payment action, wrong-number warning, security and WhatsApp help. Status copy distinguishes confirmed payment from delivered order. Refund pending/completed distinctions remain.
- Wallet now foregrounds that funds cannot be withdrawn. Existing top-up limits, zero-customer-fee display, balances, irreversible transfers, cashout confirmation and fee calculations are unchanged. Existing customer status-label helper is reused for visible top-up statuses.
- Mystery Earn explains eligible purchases under active rules, future-purchase qualifications and approved versus pending rewards. “Distinct browsers” remains accurate; it was not relabeled as people. No new reward, eligibility or achievement promise. Badge/non-cash-value disclosure and configured reward display remain.
- Builder marketing describes choosing a design, adding details/photos and publishing free. Removed guaranteed completion-in-minutes and universal ordering implications. Plan restrictions remain. Owner pricing still shows minimum prices and estimates after costs/processing; no formula changes. Customer websites retain independent fonts/colors/copy.
- Marketplace enquiry buttons describe enquiries. Dialog explains no order or payment is created by an enquiry. Removed authorized-distributor, verified-supplier, nationwide-delivery and guaranteed-quality implications. Saved-enquiry copy no longer guarantees a new WhatsApp tab opened. Existing purchase-capable product checkout is retained.
- About introduces actual available services and adds seven short questions covering ordering, payment, tracking/delays/support, Wallet, Earn, free websites and upcoming services. Recovery copy keeps ownership verification and password-sharing prohibition. AFA keeps registration-only fee scope, encryption, provider disclosure, terminal deletion, unresolved-case retention and PIN/password/photo prohibitions.
- Fallback errors explain retry; empty states suggest the next action. Existing server error handling/security contracts remain unchanged.

## Metadata and search

Updated HTML title/description, Open Graph and Organization description plus existing per-route metadata. They describe actual Ghana-focused services, with utilities explicitly upcoming. Brand/domain/canonical/indexing infrastructure unchanged.

After a separately approved deployment, the operator can use Google Search Console URL Inspection to request recrawling of public `/`, `/data`, `/website-builder`, `/marketplace`, `/services`, `/about` and `/afa` as appropriate. Do not submit private account surfaces for indexing. Historical search snippets cannot be directly edited from this repository; recrawl timing and displayed snippets remain controlled by Google. No Search Console action was performed.

## Responsive and synthetic journey review

Used a frontend-only local preview with synthetic responses, no production environment file, no backend/database connection, blocked mutation requests and a disabled payment stub. Temporary preview files were removed before checkpointing. Screenshots/logs remain outside the repository.

- 360px: homepage, Airtime form and final wording, Earn financial area and lower referral sharing, expanded About Wallet FAQ.
- 390px: homepage/services, Data entry, checkout with warnings/confirmation/receipt/total, Wallet, Earn, Builder discovery, Marketplace enquiry journey, About and More Services.
- 430px: homepage, Marketplace, Orders empty state and signup dialog.
- 768px: homepage, Wallet and Earn.
- 1280px: homepage and Builder discovery.

Observed no page-level horizontal overflow, overlapping actions or clipped revised CTA labels on these representative screens. Existing long input placeholders scroll/clip inside their input; no form layout change was needed. Not every route was checked at every width. Homepage Create a Free Website and Buy Data were clicked and their destinations verified. Marketplace enquiry-only detail opened the enquiry dialog. No enquiry submission, registration, payment, top-up, supplier request or financial transaction was performed.

Screenshots (outside repository): `customer-copy-home-390.png`, `customer-copy-home-1280.png`, `customer-copy-builder-390.png`, `customer-copy-checkout-390.png`, `customer-copy-wallet-390.png`, `customer-copy-enquiry-390.png` under `C:/Users/AB/Documents/ChatGPT/MYSTERY HUB/`.

## Verification

- Final relevant customer-facing regression selection: **137/137 passed** across copy protection, mobile layout, product polish, Marketplace, checkout and auth bootstrap tests. Nine new focused tests preserve important disclosures, availability labels, CTA destinations, reward qualification, metadata and AFA/recovery protections. Three existing assertions were updated only for deliberately revised copy; behavioral assertions remain.
- One full isolated regression run: **1279/1284 passed; five failures**. All five reproduced independently on exact unchanged base main, using an isolated baseline checkout. They concern: bundle-card Direct SIM Credit expectation; member-home Earn Coming Soon expectation; Earn-page Coming Soon expectation; obsolete member acknowledgement expectation; Website Builder Ghana Data Express versus QuickByte Data expectation. No new failure was classified as inherited without reproduction. The full run preceded the last copy refinements; final targeted verification covers the modified surfaces, without another large suite run.
- TypeScript: `npx tsc --noEmit` passed.
- Production build: `npm run build` passed. Existing non-blocking Vite native-loader/__dirname and large-chunk warnings were left alone.
- `git diff --check`: passed.
- Tests used the existing isolated runner, which removes inherited database configuration; no external database mutation.

## Limits and next phases

P0 copy scope is complete. Conversion uplift, customer trust and “premium” perception have not been measured. A later approved A/B test could compare the current Website Builder-first hero with Data-first priority, measuring completed purchases, website creation and abandonment; no experiment is implemented here. P1 can address composition and navigation based on observed user friction. P2 can evaluate typography/readability and the five inherited test expectations as separate work. Existing small secondary labels, imagery text and dense owner-pricing layouts were not globally redesigned. End-to-end live payment/delivery performance is outside this copy pass.

Final scope review found no unrelated source edits, secrets, environment files, screenshots, logs, temporary preview helpers, generated output or dependency changes in the staged work. No pricing, Welcome Offer/referral economics, balances, supplier/Paystack/webhooks, order transitions, AFA validation, authentication/security, Builder migration/media/publishing, reseller economics, Marketplace inventory or Admin controls changed. Nothing merged, deployed or activated.

## Files included

- `index.html`
- `server/suppliers/__tests__/marketplaceFlexibilityUi.test.ts`
- `server/suppliers/__tests__/memberHomeAuth.test.ts`
- `server/suppliers/__tests__/mobileLayoutPolish.test.ts`
- `src/components/about/AboutPage.tsx`
- `src/components/auth/AuthModal.tsx`
- `src/components/checkout/CheckoutModal.tsx`
- `src/components/checkout/OrderStatusModal.tsx`
- `src/components/common/Footer.tsx`
- `src/components/common/SEOHead.tsx`
- `src/components/data/CompactBundleRow.tsx`
- `src/components/data/DataPage.tsx`
- `src/components/data/InstantBundlesCatalog.tsx`
- `src/components/earn/MysteryEarnPage.tsx`
- `src/components/finance/FinancialPanel.tsx`
- `src/components/home/Hero.tsx`
- `src/components/home/HomeComingSoonSection.tsx`
- `src/components/home/HomeFeaturedData.tsx`
- `src/components/home/HomeMarketplaceSection.tsx`
- `src/components/home/HomeWebsiteSection.tsx`
- `src/components/home/MemberHome.tsx`
- `src/components/home/QuickServicesBar.tsx`
- `src/components/home/WhyMysteryHub.tsx`
- `src/components/marketplace/MarketplaceInquiryModal.tsx`
- `src/components/marketplace/MarketplacePage.tsx`
- `src/components/marketplace/MarketplaceProductDetailModal.tsx`
- `src/components/orders/OrdersPage.tsx`
- `src/components/services/AfaRegistrationPage.tsx`
- `src/components/services/MoreServicesPage.tsx`
- `src/components/website/WebsiteBuilderPage.tsx`
- `src/components/website/WebsiteBundlePricing.tsx`
- `src/config/serviceNotices.ts`
- `src/data/services.ts`
- `server/suppliers/__tests__/customerCopyP0.test.ts`
- `docs/customer-copy-conversion-p0.md`
