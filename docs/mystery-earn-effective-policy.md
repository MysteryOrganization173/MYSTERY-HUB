# Mystery Earn V2.2: effective-policy integration

## Scope and inspected state

Prepared for founder review only; do not merge or deploy automatically.

- Current production main inspected: `870c1f5f0b7757cc80e595feedcc31d133dd8909`.
- PR #29 starting head: `7731c09d7a7cf0e78ff7d8461018cd4a7e832307`.
- Existing branch: `claude/mystery-earn-v2-footer-p6lzvv`. Current main merged normally into it, preserving the approved V2.2 experience and PRs #30–#33. No rebasing or force-push.
- A narrow read-only production query on 20 October 2026 confirmed `finance_config['economics:data']`: enabled, `stage_margin_percent`, acquisition 4500 bps, recurring 2000 bps. The two active general Data rules remain fixed 50/10 pesewas, with acquisition/recurring stages and no network/product/date restriction. No customer records or private economic values were requested.

## Actual policy path

Admin economics configuration is persisted by `saveEconomicsPolicy()` in `server/services/referralEconomics.ts` through `FinanceStore` under `economics:data`. `economicsPolicy('data')` reads that record and, where configured, the existing direct-pricing reserve. Admin stored rule management is separate: `ReferralStore.findMatchingRule()` selects a currently enabled, date-valid service/wildcard rule with product, network and stage precedence.

`ReferralService.processOrderReward()` excludes reseller storefronts, requires successful GHS payment and confirmed delivery, validates attribution/referrer eligibility, checks prior qualifying purchases under the existing transaction/relationship lock, and resolves a matching rule. `computeEconomicReward()` then replaces the rule's requested amount with the configured stage percentage for eligible direct Data orders. More-specific Data rules still gate eligibility but do not override these stage percentages. Existing ledger entries are returned without recalculation.

The acquisition basis uses normal retail before the Welcome Offer discount, authoritative supplier cost and normal processing reserve; recurring uses actual paid revenue, supplier cost and actual reserve. Missing economics needed for a monetary calculation fails closed in the existing engine. The eligible margin is floored at zero before applying the basis-point percentage; acquisition subsidy can make actual contribution negative. No calculation, rounding, reserve, qualification, ledger, reversal, Wallet, withdrawal, payment or supplier implementation is changed here.

The old public rules endpoint exposed only the active stored rules. Thus its GH₵0.50/GH₵0.10 values were eligibility/request records, not the effective dynamic Data reward. They are retained for backward compatibility, never silently used as the V2.2 Data payout explanation.

## Additive public contract

`GET /api/referrals/rules` keeps `success` and the exact existing public `rules` objects, adding `dataPolicy`. The endpoint is non-cacheable so refresh can retrieve changed configuration.

```json
{
  "success": true,
  "rules": ["existing public rule objects, unchanged"],
  "dataPolicy": {
    "service": "data",
    "journey": "direct",
    "status": "active",
    "basis": "eligible_margin",
    "acquisitionBps": 4500,
    "recurringBps": 2000,
    "eligibleStages": ["acquisition", "recurring"]
  }
}
```

The `rules` array above is abbreviated only for documentation. Its real objects are still produced by `publicReferralRule()`.

`server/services/publicReferralPolicy.ts` reads the same persisted economics record through `FinanceStore.readConfig()`. It projects an explicit allowlist; it does not return or spread the private policy. No costs, reserve configuration, profitability, customer/order details, ledger internals, credentials or private version identifiers enter `dataPolicy`.

Status values are `active`, `disabled`, `unconfigured`, `unsupported`, `ineligible` and `unavailable`. Only a valid enabled stage-margin policy plus at least one matching active Data/wildcard stage publishes basis-point values. Other statuses have null basis/rates and no eligible stages. Disabled percentage economics is not described as disabling all possible legacy rewards. Economics-read failure preserves the old rules response with an unavailable policy; rules-read failure preserves the endpoint's error behavior. No configuration is seeded or saved.

## Customer presentation

The existing guest/member EarnRules components receive the additive policy. Rates derive from bps divided by 100, with no hardcoded production rates or calculations from purchase totals:

- **First qualifying Data purchase:** “Earn 45% of Mystery Hub’s eligible margin.”
- **Later qualifying Data purchases:** “Earn 20% of Mystery Hub’s eligible margin.”
- “Actual earnings depend on the qualifying order and applicable policy, not the price your friend pays. Only eligible products and networks count. Reseller storefront orders are excluded.”

One Data card replaces overlapping Data rule cards. It spans the existing mobile grid to keep the two stage explanations readable. The existing date-boundary refresh filters remove expired eligibility; a rules retry clears stale policy values while loading. Older servers lacking `dataPolicy`, disabled/missing/unsupported/unavailable policy and absent eligible stages never fall back to 50/10 or expected percentages. Loading, empty and retry states remain explicit.

Airtime/AFA and wildcard records keep cautious service-policy explanations, without importing Data percentages or treating requested fixed amounts as guaranteed effective payouts. Instant Bundle, Marketplace and other explicit public rules retain their own rule descriptions. AFA still requires its separately enabled economics policy; Marketplace product overrides and reseller earnings are unchanged. The inspected live rules contain only Data, so other services receive no newly invented active rate.

## Invitation and retained experience

Approved Cloudinary hero, guest demo, member sharing studio, real summary/finance sources, money-first milestones, badge states and global footer remain. The post-purchase invitation remains limited to recent first-party confirmed deliveries; recovered/reference/account journeys, uncertain/refunded/manual/complimentary states and unrelated services are excluded. It promises only possible qualifying rewards and makes no payment/supplier calls.

Review found a brief account-switch render window before effect cleanup. The invitation's resolved URL is now tied to both user ID and session token and checked synchronously before rendering; stale account links cannot be displayed while the next summary loads. Existing cancellation, disabled-profile and dismissal protection remains.

## Verification and evidence

- Focused policy/finance/attribution/Admin/payment integrity group: **356/356 passed**.
- Additional Earn presentation/contracts group: **85/85 passed** (overlaps the policy tests above).
- Full isolated regression: **2256 total; 2229 passed; zero failed; 27 existing optional PostgreSQL skips**. Current-main baseline was 2208 total / 2181 passed / zero failed / 27 skips. The combined branch adds 48 passing tests; no inherited failure remains. One obsolete presentation assertion was updated for the new consolidated policy contract.
- TypeScript, production build and diff check passed. Existing nonblocking Vite warnings remain unchanged.
- Compiled real Earn components with synthetic accounts at **360×640, 390×844, 430×932, 768×1024, 1280×800**, both guest/member: real approved Cloudinary art/logo loaded, no horizontal overflow, correct 45%/20% text and one Data card. Alternate synthetic 3250/1250 bps renders 32.5%/12.5%. Disabled/missing/unavailable states hide rates; retry recovers. Loading/empty/error/restricted states checked. Synthetic available GH₵12.50 and pending GH₵1.50 remain distinct, with pending marked unusable.
- Copy link/message, attributed WhatsApp URL, keyboard radio selection/visible focus, synthetic signup handoff and footer navigation handler checked. No WhatsApp message sent. Invitation account switch changed attribution to the new synthetic account; dismissal and disabled sharing passed. No console errors observed. The harness blocks all mutation requests and never uses a database. It is evidence, not a claim of real authenticated production or physical Android acceptance.
- Screenshots, fixture sources, geometry and logs are private outside Git at `C:\Users\AB\Documents\Codex\earn-v2-2-policy-evidence`.

PRs #31–#33 and social metadata/customer-branding files remain unchanged relative to current main. Pool maximum stays five. No production configuration, reward/financial data or customer account was modified; no transaction, merge or deployment was performed.

**READY TO MERGE** after the integration commit is pushed to PR #29. Founder review/approval is required before any merge or deployment; physical Android and native OS sharing acceptance remain pending.
