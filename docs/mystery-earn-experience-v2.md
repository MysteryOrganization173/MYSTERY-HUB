# Mystery Earn Experience V2 — founder review

This is a customer presentation and client-side sharing release. No commissions, eligibility, ledger accounting, payout processing, migrations or production configuration were changed.

## Verified starting state and delivery

- Remote main: `5233879079413b6422f829631676b16c3ea81597`.
- Customer Experience Release V1: `77887d3a5a6261b225ead164a33b2321926275bc`, on `integrate/customer-experience-release-v1`.
- Protected, excluded reseller overlay: `b0e85b33fd804cc654cdc2d38fe13e2d7ed027cf`.
- Feature: `feat/mystery-earn-experience-v2`, isolated in `work/mystery-earn-v2`, based exactly on the verified customer release.

All six existing worktrees were clean before work and were preserved. Main contains the finance migration and reseller contrast fixes and is an ancestor of the customer release. It does not yet contain that release. No automatic integration or main merge is performed by this task. The original integration release remains a stable review candidate. The final feature SHA, push verification and clean status are recorded in the delivery response/Git history.

## Focused audit and implementation plan

The existing page combined a large member hero, repeated promotional explanations, sharing cards, metrics and history in one component. Available earnings were separated from sharing by a long page. It could offer a generic homepage URL before the authorized referral summary loaded, and legacy clipboard copy could claim success without checking browser rejection. Missing optional network counts and the unloaded approved total could look like zero. Wallet/earn balances, achievement claims and financial operations already had functioning server contracts.

The bounded plan was to preserve the finance behavior, replace the repeated presentation with focused sharing/details components, gate links using the current authorized identity, distinguish unavailable/stale/zero datasets, and verify real customer journeys with intercepted synthetic responses. No new API, dependency, image asset or financial feature was needed.

## Customer experience

Guest: one clear introduction, existing approved Cloudinary artwork, Create a Free Account, How It Works, current rules and concise help. Clicks alone do not earn rewards. No guaranteed commissions, fixed promotional incentives, recruitment payouts, paid Builder promises or Marketplace enquiry rewards are invented. The existing auth dialog handles signup/signin.

Member: a compact personalized heading, referral link and sharing actions, followed immediately by the authoritative financial panel. At 390px the first viewport includes the personal sharing controls and available amount; at short 360x640 the earnings anchor remains reachable and the balance is accessible by scrolling. Desktop shows sharing and finances side by side. Referral metrics, reward activity, current opportunities, real achievements and additional service links remain accessible without repeated promotional panels.

Presentation is separated into `MysteryEarnPage`, `EarnSharing` and `EarnDetails`, with scoped CSS and small pure utilities. Financial history and achievements use native expandable controls to reduce initial clutter. Earn-mode achievement progress uses actual API progress/thresholds, distinguishes badge-only and configured Wallet credits, and preserves explicit claiming. No achievement is automatically claimed.

## Sharing and session safety

- A personal link requires an enabled current-session summary and a valid `MH-` referral code, or a tracked authorized URL supplying that code. It is built through the existing `buildReferralUrl` and canonical router destinations. A bare homepage is never substituted.
- Loading, missing identity, summary verification errors and disabled profiles disable sharing. A failed summary refresh retains last-known statistics with a warning but disables sharing until verification succeeds. A ledger-only failure does not disable a successfully verified link.
- Copy reports success only after `clipboard.writeText` resolves. Missing/rejected clipboard access reveals a selectable input. No `execCommand` fallback remains.
- Native share success, cancellation and fallback are distinct. Cancellation produces no success or copy side effect. Unsupported/failed native sharing falls back to verified copying/manual selection. Related share feedback replaces itself through the existing toast key mechanism.
- WhatsApp uses an encoded message and attributed link in a normal safe anchor. Personal and service controls have accessible names and comfortable touch targets.
- Data, Marketplace, Free Website Builder, Earn and Home destinations use existing canonical paths. The Website Builder destination is `/website-builder`; enquiries/free websites are explicitly distinguished from qualifying purchases.
- The member component is keyed by both account ID and session token, so account-owned state/forms are remounted before another account renders. The existing refresh controller disposes late responses. Sharing also rejects late feedback after identity changes/unmount. No referral data is persisted in browser storage by this implementation.

## Metrics and financial truth

- **Referral visits** uses `rawClicksCount`: stored referral capture rows, including recorded repeat visits, not every browser navigation.
- **Distinct browsers** uses `uniqueVisitorsCount`: distinct nonempty visitor keys, excluding `vk_transient_` keys in the existing store. This is not a verified count of individual people; cleared storage/multiple browsers can change identity.
- **People who joined** uses directly linked registered-account counts. It does not count qualified paying customers.
- Three-level figures come only from the optional API counts. Missing values are unavailable, not zero. There are no invented member lists, personal details or conversion rates.
- Pending and approved referral totals use integer minor units from the referral summary. Approved records are not presented as withdrawals or current spendable balance.
- Available, pending, reserved, lifetime and withdrawn account values come from `/api/finance`. No available balance is calculated from referral counters. Loading and initial errors do not display a fabricated zero. An Earn financial refresh failure marks retained values as last available and disables financial actions until refreshed successfully.
- Reward activity shows the existing latest 50 records, all four statuses, amounts from `amount_minor`, dates, reasons and useful stage/level context. Rejected/reversed records have no positive-success styling. The bounded history region can be focused and scrolled with the keyboard.

Public `/api/referrals/rules` exposes active rule records, not the separate effective Data margin policy. The page therefore describes those published records with a visible qualification that Data's policy can produce a different final amount; recorded reward activity is authoritative. It does not guess margin percentages or claim GH₵0.50/GH₵0.10 are the effective policy. Disabled/future/expired rules are hidden; failed/empty rule requests have honest states. Local date-boundary timers update visibility without API polling. Percentage descriptions retain exact basis-point precision, and AFA has a readable service label.

## Finance, Wallet and backend preservation

The original finance request handler, request-ID reuse, amount parsing, fee calculation, endpoints, recipient fields, confirmation checkbox and irreversible-transfer warning are unchanged. UI enablement respects current available funds, configured minimum, restriction and refresh-error state. Minimums/fees are not hardcoded. Withdrawals remain subject to review; Earn-to-Wallet remains irreversible and does not make Wallet withdrawable.

Wallet mode retains its top-up, callback, verification, activity, navigation and form behavior. Browser verification checked its loaded balance and existing top-up disclosures without submitting a top-up. All changes to the shared panel are Earn presentation/enablement or equivalent markup/accessibility; its action implementation is unchanged.

Server routes/services/database/middleware, shared money/economics, auth context and storage, API clients, checkout, supplier processing, reseller code, admin code, dependencies and deployment files match the base. No new commission path or backend authorization change exists. The finance migration and reseller contrast fixes remain in ancestry unchanged. The separate overlay branch was not merged or modified.

## Tests and baseline comparison

- Initial focused selection: **63 passed, 0 failed**.
- Relevant Earn/referral/economics/finance/auth/customer-integration selection: **279 passed, 0 failed, 1 skipped** (280 total).
- One full isolated regression pass: **1,346 passed, 3 failed, 1 skipped** (1,350 total), no cancellations.
- Baseline reproduction on exact unchanged customer release: **154 passed, 5 failed** across the four relevant test files (159 total).
- Remaining inherited failures: BundleCard's old Direct SIM Credit expectation; Website Builder's QuickByte Data/Ghana Data Express expectation; Windows CRLF-sensitive schema-mirror comparison. All three match the unchanged release.
- Two old Earn assertions were explicitly updated because this task supersedes their obsolete Coming Soon/member acknowledgement requirements. P0 copy checks now inspect the extracted presentation files. They were not removed to conceal a defect.
- Fifteen new tests cover identity gating, attribution, safe sharing outcomes, active dates, exact displayed percentages, privacy, missing/zero metrics, financial distinctions, all ledger states, partial refresh, account disposal and retained finance safeguards.
- After the full suite, final keyboard-history focus markup and referral-only error wording received focused verification: **54 passed, 0 failed**; the final new-test-only run is recorded in the test log.
- TypeScript/lint and production build passed. Existing native-loader/__dirname and large-chunk warnings remain. Diff checks passed.
- The real disposable PostgreSQL test remains explicitly skipped. Tests ran through the existing isolated runner that removes inherited external database settings. No external database was used or mutated.

The change adds fifteen tests and resolves two stale Earn assertions: relative to the release's 1,329 pass / 5 fail / 1 skip baseline, the full run has seventeen more passes and two fewer failures. No new regression failure was found.

## Synthetic browser and visual evidence

Evidence and review scripts are outside Git at:

`C:\Users\AB\Documents\ChatGPT\MYSTERY HUB\earn-v2-evidence`

Actual integrated React UI was exercised in headless Chrome with responsive emulation and intercepted synthetic API responses. The application backend was not started; previews used no application environment file. Only approved artwork/fonts were allowed externally. Paystack was stubbed and all financial/claim operations were synthetic intercepts. No real payout, transfer, claim, registration or payment was sent.

Guest/member screenshots and overflow checks passed at **320, 360, 390, 430, 768, 1024 and 1280px**, with 360x640 short-screen checks. All viewport compositions were visually inspected. Main, edge and accessibility journeys passed, including:

- Correct personal/service copy links, WhatsApp hrefs, native success/cancellation/fallback, manual selection, disabled identity and long code at 320px.
- Signup entry and sign-in/account switching; delayed account-A response arriving after account B cannot replace B's identity.
- Loading versus confirmed zero, initial errors, partial refresh, retry, unknown network figures and absent/error rule states.
- Mocked withdrawal and transfer confirmation, exact displayed configured fee, recipient fields and existing request IDs; achievement claim, claimed/in-progress controls and masked withdrawal history.
- Financial stale/restricted controls; recovery after refresh; preserved Wallet balance/top-up view.
- Keyboard network disclosure/focus ring, keyboard scrolling through 50 reward rows, and reachable short-screen withdrawal confirmation without submitting it.

Required evidence:

1. Guest mobile: `guest-390.png`; before: `before-guest-390.png`.
2. Guest desktop: `guest-1280.png`; before: `before-guest-1280.png`.
3. Member mobile: `member-390.png`; before: `before-member-390.png`.
4. Sharing: `sharing-390.png`, `clipboard-fallback-390.png`, `manual-copy-selected-390.png`, `service-sharing-390.png`.
5. Earnings: `earnings-390.png`.
6. Referral statistics: `statistics-390.png`.
7. Network: `network-390.png`, `unknown-network-390.png`.
8. Activity: `reward-activity-390.png`, `active-rules-390.png` (also rejected/reversed rows), `keyboard-reward-history-390.png`.
9. Rules: `active-rules-390.png`, `no-rules-390.png`.
10. Achievements: `achievements-390.png`.
11. Withdrawal: `withdrawal-390.png`, `withdrawal-confirmation-short-360.png`.
12. Transfer: `transfer-390.png`.
13. Loading: `loading-390.png`.
14. Zero/empty: `zero-390.png`, `zero-earnings-390.png`.
15. Error/retry: `error-390.png`, `partial-refresh-390.png`, `stale-finance-390.png`.
16. Member desktop: `member-1280.png`; before: `before-member-1280.png`.

`results.json`, `edge-results.json`, `accessibility-results.json` and their logs record actual observed checks. Two earlier browser attempts stopped on an error-state implementation omission and an incorrect sign-in selector respectively. The error state was corrected in source; the selector was corrected only in the review script. Final affected journeys passed. Initial composition and font-size issues found visually were also corrected. Evidence capture dismisses transient share toasts before clean section screenshots; it does not alter the underlying UI or hide financial warnings.

## Limitations, future opportunities and rollback

No physical Android keyboard, device safe-area hardware, screen-reader certification, real WhatsApp app handoff, OS share sheet, real reward claim/payment/payout, live fulfillment or production PostgreSQL was tested. Browser share/clipboard behaviors were deterministically mocked. Backend economic correctness relies on the unchanged implementation/regression coverage, not on a live transaction. Synthetic screenshots are not evidence of production earnings. No new critical release blocker was found.

The existing admin control room already ranks first/repeat conversions, converted relationships, delivered revenue, rewards, referrals and visitors, and supports ledger detail/status inspection. Useful future improvements are clearer visitor-key wording, customer-facing explanation of the effective Data economics, and reconciliation of public published rules with the currently selected effective policy. Campaign reporting would need a separately approved data contract; no tracking was added. Any new incentive, percentage, milestone cash reward or giveaway requires founder financial approval. No extra admin actions or reward configuration were introduced here.

Main does not contain the approved customer release, so the production automatic-merge conditions are not satisfied. No branch was automatically merged. The feature is pushed separately for review. There is no production deployment action or new deployment workflow. The appropriate future review target is the customer-release integration lineage, after verifying its exact HEAD again.

Rollback is a normal revert of the single Earn V2 implementation commit on any branch that later accepts it. It restores the prior customer-release presentation without changing financial records, configuration or schema. Do not reset shared history or force-push. Production rollout and any outstanding payment-overlay approval remain separate founder decisions.
