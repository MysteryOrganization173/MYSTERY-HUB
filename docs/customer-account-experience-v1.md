# Customer Account Experience V1

## Scope and integration

This branch starts at Customer Copy P0 commit `4eee48626296d8fec804f72eff65d3fb75fba6fc`. It changes account presentation and feedback, Member Home, and narrowly scoped shared navigation/assistant behavior. Backend authentication, financial operations, prices, rewards, referral attribution, Website Builder templates and public homepage composition are unchanged.

Implementation was isolated in `work/customer-account-experience`, on `feat/customer-account-experience-v1`. The original P0 checkout, finance-main worktree and reseller worktrees were preserved. No Homepage Visual P1 files were imported. The available P1 report identified shared Navbar/MobileNav/assistant/CSS work, but its reported commit was not accessible through a remote ref during inspection. Reconcile Navbar, HomePage's member branch and MysteryAiAssistant deliberately when integrating P1; this branch does not replace P1's public homepage work. Current main contains separate hotfix work and is not this branch's base; integration with main is a separate approval step.

## Authentication

The previous signup nested two headings and extra padding, repeated benefit chips, and an always-visible optional email. The new dialog has one heading, a concise benefit sentence, name/business name, Ghana phone, password and Remember this device. Optional email expands on request and remains optional. Previously entered name/contact/email survive switching modes, while passwords and stale errors are cleared. The truthful disclosure that phone ownership is not verified by SMS remains in a compact disclosure.

`AuthFields` is controlled presentation, with explicit labels, password-manager autocomplete, phone/email keyboard hints, native required/length/email validation and error associations. The existing API retains authoritative canonical-phone, uniqueness, password, referral and session validation. Pending submissions disable form controls and use a synchronous submission latch; closing the dialog remains available and does not cancel a server request already in flight. Errors stay inline, with correction/retry and duplicate-account sign-in/support paths.

Duplicate admin welcomes came from two event owners: `AppContext.loginUser` emitted a welcome, and `AdminLoginCard` emitted a second welcome. Login feedback now has one owner in AppContext. Interactive token transitions emit one compact `Signed in.` message; replay of the same transition is suppressed. Related auth feedback replaces itself without suppressing independent security/payment warnings. Security-session replacement is silent. Restoration still validates `/me` in the background, without replaying a welcome. Logout clears the same storage/session state and replaces related feedback with `Signed out.`.

Auth feedback lasts 2.2 seconds, sits above mobile navigation and does not capture pointer events except on its dismiss control. Its visual presentation is suppressed during account, auth, checkout, order-status and forced-password dialogs. Screen-reader status announcements remain available without an invisible dismiss button.

Switching Sign In/Sign Up previously called `openAuth`, replacing a protected action's pending continuation. `switchAuthMode` now changes only mode. Closing auth still cancels the pending continuation. Existing forced-password gating remains in place. Assisted Forgot Password retains the configured WhatsApp and email support links, with no fake OTP or automated password-reset claim.

## Member Home

The previous greeting/artwork, Wallet and latest order occupied separate panels; recent orders repeated the hero order, excluded payment-pending orders and silently treated request errors as empty history. The new composition combines greeting, real Wallet balance and an order to follow in one hero. It removes large decorative account artwork and duplicated public marketing sections from the member branch only.

The account order request still uses the authenticated account endpoint with a limit of five. The newest relevant active/manual-review order is prioritized; otherwise the newest order is shown. An older prioritized order is labelled `Order to follow`. Up to three additional orders appear in Recent activity, excluding the hero reference. Pending, failed and refund states remain visible and never become false delivery. Existing shared Data/AFA presentation supplies status labels. Tracking retains authoritative reference/status, service type, recipient visibility, manual-review and commercial-pricing context.

Wallet has distinct loading, genuine zero, nonzero and unavailable/retry states. It does not invent a balance, combine earnings with Wallet, or imply withdrawability. Top Up and Wallet activity keep their existing destinations. Invalid/malformed balance data displays unavailable. There is one Wallet request and one account-order request per dashboard mount, with explicit retry only; no new background polling or website-discovery requests were added. Late responses after unmount are ignored, and changing session token creates a fresh dashboard.

Six Quick Services lead to Data, Airtime, Website Builder, Mystery Earn, Orders and Marketplace. Secondary Builder/Earn panels provide a dashboard/referral discovery route without recreating either feature. AFA availability and coming-soon services remain accessible. Empty history offers real service actions; request failure offers Retry instead of claiming no purchases.

The shared header keeps the wordmark on one line and moves redundant mobile Wallet/rewards icons into accessible account navigation. Desktop links remain. Touch targets, menu expansion semantics, viewport-limited dropdowns and account-menu Escape focus return were improved. Mobile Search is viewport-anchored: the initial implementation's popup clipped at 320px, and that was fixed and retested. Search still navigates through existing handling.

Member Home has an in-flow Ask Mystery AI action instead of a floating launcher over account content. Open chat remains available; assistant UI is hidden during account/forced-password overlays as well as existing critical modals. No AI request, model, transcript or intelligence behavior changed.

## Verification performed

- Final focused auth/account/Wallet/order/payment-integrity suite: **285/285 passed**, including **31 new account-experience tests**. New tests cover notification transitions/deduplication, required and optional form semantics, autocomplete/error associations, disabled/retry fields, deterministic greetings, order selection/status mapping, service/manual-review context and rendered member loading/error/empty/deduplication states.
- TypeScript: `npx tsc --noEmit` passed on the final source.
- Production build: passed on the final source. Existing large-chunk warning remains; no dependency or bundle-splitting changes were made.
- `git diff --check`: passed.
- One full isolated regression: **1306/1311 passed**. The unchanged P0 baseline independently completed **1279/1284**. Four brittle old presentation assertions were replaced by behavioral/semantic coverage; one of those was already failing on P0.
- Four final failures reproduce unchanged baseline failures: Mobile Bundle Card delivery-copy expectation; two Mystery Earn Coming Soon/member-copy expectations; Website Builder fixture expecting `QuickByte Data` instead of `Ghana Data Express`.
- One additional environment-sensitive failure: `websiteFreeV1` compares an LF-normalized SQL mirror with an unnormalized schema template. Fresh Windows worktree checkout gives that template CRLF; the original P0 checkout has LF. Raw comparison fails here, while normalizing both strings passes. Git confirms the SQL, schema template and test are unchanged. No unrelated schema/test fix was included.

The existing isolated runner removes inherited `DATABASE_URL` and external test opt-in and uses `NODE_ENV=test`. Database regression cases use memory/mocked connections. No external database was used or mutated.

## Synthetic browser journeys and visual evidence

Actual account/header/home/Wallet/tracking/assistant components were rendered locally with intercepted synthetic API responses and no application environment loading or backend. Before captures used the unchanged P0 source. Temporary fixture files and screenshots were kept outside the committed repository after review.

Observed journeys:

1. Signup without email and signup with optional email; required-field validation; duplicate-phone recovery; contact/email retention across mode switches.
2. Invalid login, correction/retry, successful customer login, exactly one success message and a double-click resulting in one request.
3. Protected Wallet continuation through login, and through switching login to signup.
4. Remembered and session-scoped restoration without welcome replay; cached identity with delayed `/me`; expired-session clearing; mandatory forced-password dialog. No password-change request was submitted.
5. Wallet/order loading, genuine zero/empty, nonzero/history, unavailable states and independent retries; logout removes private home content.
6. Data/Airtime/Builder/Earn/Orders/Marketplace/AFA/services/Wallet navigation; Top Up retains its query flag; real order-status dialog displays authoritative synthetic processing and unconfirmed delivery.
7. Admin login card with one success announcement; baseline duplicate admin welcomes captured. The operational Admin page was not redesigned or exercised as a full live backend journey.
8. Keyboard dialog trap, Escape/focus return, mobile account navigation, search submission, in-flow AI access and hiding the assistant during account controls.

Visually inspected widths: **320, 360, 390, 430, 768, 1024, 1280px**, including **360x640** and **390x780**. Signup is internally scrollable at the short height, with its primary action reachable. Brand, hero, balance, status and actions remain readable; no horizontal page overflow was observed. Recent activity was additionally checked at 320px so the long pending-payment label wraps within its allocated width. Screenshots include the twelve requested categories: signin, signup, validation, success, first viewport, scrolled home, Wallet/hero, latest-order tracking, empty state, mobile account navigation, admin success and desktop home.

Evidence directory: `C:\Users\AB\Documents\ChatGPT\MYSTERY HUB\account-experience-evidence`.

Text contrast was visually reviewed using existing light slate/emerald/sky text on dark surfaces and dark text on green primary actions; this is not a formal WCAG certification. Existing global reduced-motion rules remain, and new account sections introduce no continuous animation, new font or large dependency. No realistic mobile virtual keyboard or physical-device/screen-reader run was available. Route changes were verified with synthetic destination screens; downstream Builder/Wallet/Admin operations were covered by existing focused tests rather than live transactions.

## Delivery safety

No backend authentication or finance implementation, pricing, referral economy, database schema, production account, environment variable, Render setting, Paystack transaction, supplier order or reseller transaction was changed. Screenshots, logs, generated build output, temporary review fixtures, credentials and environment files are excluded from the commit. No PR, merge, deployment or force-push is part of this delivery.

Remaining limitations are the four inherited failures, the unrelated Windows newline-sensitive schema test, unavailable P1 source for an exact integration diff, and the explicitly limited browser/device coverage above. No new account-experience blocker was found in the verified journeys.
