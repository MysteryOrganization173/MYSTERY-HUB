# Homepage experience and visual polish P1

## Delivery and integration

Working branch: `feat/homepage-visual-p1`.
Base: `feat/customer-copy-conversion-p0` at `4eee48626296d8fec804f72eff65d3fb75fba6fc`.
At inspection, main was `482eddfd312636325f2963c88b2850b36c8497da`; P0 was exactly one commit ahead with no divergence. Both older polish branches and `fix/data-checkout-rescue-v1` were already ancestors of main. No homepage-polish branch existed remotely. No laptop-only checkout work was available or integrated.

Review against the customer-copy P0 branch. Merge P0 first, then retarget this branch to main once main contains P0 and review its resulting diff. No main merge, production deployment or Render change is part of this delivery.

## Inspected system

- `HomePage` selects the guest hero or existing member home, followed by shared bundle, Builder and Marketplace sections. Authentication and member-home logic were retained.
- Global styles use Tailwind 4, Outfit/Plus Jakarta Sans, established green/dark tokens, shared `mh-button` controls and geometry tokens. P1 uses a homepage stylesheet and those existing controls; no fonts or dependencies were added.
- `Navbar` and `MobileNav` use existing AppContext route handlers and route maps. Website Builder maps to `/website-builder`, Data/Airtime to `/data`. The menu retains More Services and the Earn shortcut.
- `useDirectCatalog`, `BundleCard`, the commercial quote and `WelcomeOfferNotice` remain responsible for prices, recipient entry, order review and welcome-offer eligibility. Their business logic was not changed.
- `orderedWebsiteTemplates` and `TemplateCardPreview` provide genuine existing template designs. Builder configuration declares FREE available and PLUS/PRO unavailable. The homepage promotes only the Free experience and uses the existing preview/entry handlers.
- Marketplace products come from the existing public featured-products API. The original enquiry handler remains; no inventory is manufactured.
- The assistant already yields to checkout and other critical modals. Its public launch controls now live in navigation. The editor-specific assistant and its functionality remain in place; the assistant also yields to account dialogs.
- Existing breakpoints are 640/768/1024/1280px. P1 adds a narrow 480px homepage composition breakpoint, without changing shared Tailwind breakpoints.
- No repository AGENTS.md was present. No production environment files or credentials were copied into the preview.

## Implemented design

- More prominent two-line brand headline, intentional artwork crop, stronger mobile contrast and compact hero spacing. Website Builder remains primary; Buy Data is immediately adjacent on desktop and directly below on narrow phones.
- Four themed everyday utility tiles replace seven repetitive tiny cards. Data, Airtime, conditional AFA status and Earn stay easy to scan. Website Builder and Marketplace receive their own more substantial presentations. All Services remains visible.
- Popular bundle purchasing keeps the existing catalogue and cards. Network choices have larger touch targets and pressed-state semantics, with a clear empty state.
- The existing conditional welcome offer has a more visible presentation. Source defaults are enabled/GH₵1, but the attempted public live quote returned a non-JSON response, so live activation could not be verified independently. Nothing is hardcoded into the homepage: the existing quote must confirm enabled guest/eligible status and supplies the displayed discount.
- Builder gets a distinct split feature with an authentic reseller-template preview, an explicit sample-content disclosure and a three-step explanation. No paid-tier availability claims.
- Marketplace gets approved artwork, catalogue-driven product images and typography, or compact category rows when no products are featured. Loading, error, retry and empty states are explicit. Enquiry wording remains truthful.
- Trust information becomes three readable editorial columns/rows, with direct order tracking and real configured WhatsApp support access.
- Future services use compact launch-list rows backed by existing `coming_soon` data rather than another artwork card grid. No availability claims changed.

## Mobile and shared UI fixes

- Public assistant launcher no longer floats above purchase actions: Help is a sixth mobile-nav item, and desktop/tablet uses a header control. Existing AI modal behavior remains; mobile nav hides during checkout, previews and assistant use. Mobile Shop retains the Marketplace accessible name and route.
- Header search opens in a viewport-bounded panel instead of squeezing the logo and actions. Search, Earn and menu touch targets are 44px; signup and wordmark spacing prevent wrapping at 360px. Wallet stays accessible in the member menu on narrow phones and remains a header shortcut on larger screens.
- Existing bottom-nav safe-area padding and footer clearance remain. Added scroll padding/margins keep focused controls clear of sticky UI.
- All key homepage controls retain visible focus, readable contrast and reduced-motion support. No new animation or heavy effects.

## Assets

Reused and rendered successfully in review:

- Official approved Mystery Hub Cloudinary mark.
- Existing Accra connectivity hero: `ChatGPT_Image_Sep_30_2026_02_14_20_PM_baowst.png`.
- Existing reseller-template artwork: `ChatGPT_Image_Oct_3_2026_06_58_33_PM_jr9ait.png`, rendered through the real template component.
- Configured Marketplace banner: `Futuristic_Ghana_Tech_Marketplace_Banner_uvziku.png`.
- Real featured-product image URLs when returned by the API, with existing image fallback handling and responsive Cloudinary widths.

No new binary artwork, fabricated screenshots, third-party homepage image hosts or invented Cloudinary URLs. Hero artwork is high-priority; lower images are lazy-loaded in stable aspect-ratio containers. No critical missing asset remains. Marketplace inventory and its real product photography require a live API; the review deliberately uses an empty response plus an explicitly synthetic fixture to verify that rendering path. The decorative banner is not inventory.

## Verification executed

- `npm run lint` passed; this repository's lint script is TypeScript `tsc --noEmit`, not a separate ESLint check.
- `npm run build` passed. Existing Vite `__dirname` native-loader and large-chunk warnings remain. No dependency or bundling configuration changes.
- `git diff --check` passed.
- Full isolated P0 baseline: **1279/1284 passed, five failures**. Full P1 run: **1279/1284 passed, the same five failures**. Both used the existing memory-only runner, which strips inherited database configuration. Final navigation refinements were then covered by targeted tests and rendered review.
- Final targeted selection: **126/126 passed** across customer-copy protection, mobile geometry, systemwide polish, Marketplace UI, data checkout rescue, checkout performance/status and auth refresh/bootstrap.
- `python scripts/reviewHomepage.py` passed against a frontend-only Vite preview with synthetic API responses, blocked POST/mutation requests and disabled Paystack loading. No backend, payment, registration, supplier call, order submission or database mutation occurred.
- Browser review tested **360, 390, 430, 768, 1024 and 1280px**. Assertions cover root and child horizontal bounds, single-line brand wordmark, image loading, viewport-bounded search, route destinations, template preview, assistant open/Escape close, nav/modal exclusions, and Buy-button hit testing at multiple scroll offsets. Disabled offer hides; Marketplace empty/error/retry/featured/enquiry paths work. No page errors or approved-asset failures.
- Rendered before/after pages and representative mobile/desktop screenshots were personally inspected. The review corrected the narrow search panel and 360px wordmark wrapping before completion.

The five inherited failures remain unchanged: obsolete BundleCard Direct SIM Credit assertion; member-home Earn Coming Soon assertion; Earn-page Coming Soon assertion; outdated member acknowledgement assertion; Website Builder Ghana Data Express vs QuickByte Data expectation. They were reproduced on the exact P0 base, not inferred from previous reports.

## Review artifacts and limits

Before/after screenshots are outside Git under `/workspace/homepage-p1-review/`, including full pages and first-screen captures at mobile and desktop widths. The browser runner also writes per-width screenshots and `results.json` to `/tmp/mystery-homepage-review/` by default.

The browser uses actual image bytes fetched through the environment proxy, with synthetic API fixtures. It verifies presentation and local interactions; it does not establish live financial fulfillment, production offer activation, real inventory availability, conversion uplift or physical low-end Android performance. Safe-area behavior is implemented with existing environment insets; physical device/keyboard and screen-reader review remains advisable. Shared catalogue loading/pricing fallback behavior remains unchanged.

Files: eight homepage components, `homepage.css`, `Navbar`, `MobileNav`, the assistant's presentation/modal exclusions, narrow scroll-clearance rules in `src/index.css`, `scripts/reviewHomepage.py`, and this report. No backend, API contract, payment, auth, wallet, referral, order, database, production configuration or secret changes.
