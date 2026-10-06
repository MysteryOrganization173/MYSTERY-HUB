# Commercial pricing, Welcome Offer and customer identity V1

Base: `8080a05cdd89eb4ffecf7a4c716822151ac53c10`.
Branch: `feat/commercial-pricing-welcome-offer`.
This checkpoint does not activate production pricing or deploy anything.

## Authority and price review

`shared/directPricing.ts` contains approved launch retail seeds for the 26 existing unambiguously supported products. `CommercialService.catalog()` applies future Admin overrides in the existing `finance_config` table (`direct-pricing`). `GET /api/commercial/products` supplies Home/Data cards; checkout calls `GET /api/commercial/quote/:productId`. Both Wallet and Paystack recompute under the financial transaction. Mystery AI receives that same live catalog; its empty-network fallback no longer invents old prices. Alias product identifiers resolve to the canonical product.

19 retail values change and seven stay unchanged. The largest increase is MTN 1GB, 10.02%; there is no blanket 20% increase. Selected larger bundles decrease. Charm endings .49/.99 preserve the approved value ladder; price per GB generally decreases as size increases.

`commercial-pricing-review.csv` contains every old/new seed, change, percentage, per-GB value, founder-reference supplier cost, gross spread and gross spread percentage (spread divided by retail revenue). It deliberately distinguishes a founder reference estimate from authoritative runtime cost. Supplier costs are resolved from the existing Success Biz Hub provider at preflight/Admin inspection; no supplier cost is inferred from retail, seeded, overwritten or fetched live during this pass. Live cost discrepancies therefore cannot be confirmed here. Regular checkout refuses a known supplier cost above retail; Admin requires a known cost before enabling/saving an enabled product. Unknown costs/contribution stay marked unknown.

The direct processing reserve reuses an already enabled `economics:data` reserve until explicitly set in Commercial Pricing. Otherwise it is unconfigured, not an assumed zero payment cost. Reserve = fixed pesewas + rounded basis-point percentage of actual customer revenue. The direct setting is independent of the existing managed-store reserve. No actual production finance settings were queried. Authoritative contribution = actual paid revenue - authoritative supplier cost - configured reserve. Consequently the CSV cannot truthfully state actual post-reserve contribution; it provides labeled reference spreads before reserve. Admin calculates post-reserve estimates at runtime. For reference MTN 1GB cost GH₵4.00, regular spread is GH₵1.49 and welcome spread GH₵0.49 before payment/operations reserve.

### MTN (old -> new GH₵; retail change; GH₵/GB)

- 1GB: 4.99 -> 5.49; 10.02%; 5.4900/GB.
- 2GB: 9.99 -> 10.49; 5.01%; 5.2450/GB.
- 3GB: 14.99 -> 14.99; 0.00%; 4.9967/GB.
- 4GB: 19.49 -> 19.49; 0.00%; 4.8725/GB.
- 5GB: 23.99 -> 23.99; 0.00%; 4.7980/GB.
- 6GB: 28.49 -> 28.49; 0.00%; 4.7483/GB.
- 8GB: 37.99 -> 36.99; -2.63%; 4.6238/GB.
- 10GB: 46.99 -> 44.99; -4.26%; 4.4990/GB.
- 15GB: 69.99 -> 66.99; -4.29%; 4.4660/GB.
- 20GB: 92.99 -> 88.99; -4.30%; 4.4495/GB.
- 25GB: 114.99 -> 110.99; -3.48%; 4.4396/GB.
- 30GB: 137.99 -> 132.99; -3.62%; 4.4330/GB.
- 40GB: 182.99 -> 176.99; -3.28%; 4.4248/GB.

### AirtelTigo (old -> new GH₵; retail change; GH₵/GB)

- 1GB: 4.79 -> 4.99; 4.18%; 4.9900/GB.
- 2GB: 8.99 -> 9.49; 5.56%; 4.7450/GB.
- 3GB: 13.49 -> 13.99; 3.71%; 4.6633/GB.
- 4GB: 17.99 -> 18.49; 2.78%; 4.6225/GB.
- 5GB: 22.49 -> 22.99; 2.22%; 4.5980/GB.

### Telecel (old -> new GH₵; retail change; GH₵/GB)

- 10GB: 44.99 -> 44.99; 0.00%; 4.4990/GB.
- 15GB: 63.99 -> 66.99; 4.69%; 4.4660/GB.
- 20GB: 83.99 -> 88.99; 5.95%; 4.4495/GB.
- 25GB: 103.99 -> 110.99; 6.73%; 4.4396/GB.
- 30GB: 123.99 -> 122.99; -0.81%; 4.0997/GB.
- 40GB: 164.99 -> 163.99; -0.61%; 4.0998/GB.
- 50GB: 203.99 -> 203.99; 0.00%; 4.0798/GB.
- 100GB: 399.99 -> 399.99; 0.00%; 3.9999/GB.

## Unsupported catalog combinations

MTN 50GB (approved future retail GH₵220.99) is absent. AirtelTigo 6,7,8,9,10,12,15,20,25,30,40,50,100GB are absent; their approved future prices are respectively GH₵27.49,31.99,36.49,40.99,45.49,54.49,67.99,89.99,111.99,133.99,177.99,221.99,439.99. None was created or enabled without an unambiguous authoritative product/provider mapping. Existing supported metadata/validity remain unchanged.

## Operator workflow

Open Admin -> Commercial Pricing. Review real supplier cost, current retail, spread, reserve, direct contribution, per-GB value, wholesale, safe reseller floor and welcome contribution. Set an explicit reserve if needed; change future retail, availability and optional reseller recommendation in the package form. Confirm the change. Each save checks the prior configuration revision, serializes against checkout policy reads and records actor/time/previous/new values atomically. The Welcome Offer form controls enabled state and fixed discount for direct Data; typed MTN examples and negative-contribution warnings are visible before confirmation. Invalid/non-positive transaction amounts are rejected, while an intentional valid acquisition subsidy is allowed. V1 eligibility is unique account phone and eligible scope is direct Data only; other services/OTP/schedules require a later deliberate implementation, not unsupported controls.

The existing reseller wholesale/reserve control is embedded rather than rebuilt. Direct retail never overwrites a reseller owner's retail or wholesale. A recommendation is only a suggestion, clamped to the owner's current safe floor. Store checkout, snapshots and Store Earnings remain separate. Wholesale/store-policy audits now preserve previous and next values. Commercial audit detail displays understandable changes instead of an editable JSON configuration.

Cards refresh on mount, focus and periodically. Checkout always quotes again on opening; stale totals/revisions/eligibility return a review-required conflict before payment. Production requires the reviewed expected total. The frontend checks Paystack's initialized amount before opening checkout. No separate direct Mystery Hub fee is added. The final total and Wallet choice use the discounted quote consistently. Guest/direct phone-only checkout asks for a real receipt email; no placeholder email is generated.

## Identity and offer rules

New signup requires a Ghana phone, optionally an email. Local, international, +233 and supported spaced/bracketed formats canonicalize to +233. Phone+password and existing email+password logins remain supported. The database has a nullable canonical identity key, unique index and insert/phone-change trigger with a phone advisory lock and historical-equivalent duplicate check. Initialization backfills only unambiguous historical identities. It never merges/deletes users, changes passwords, generates new Earn identities or fabricates phone verification. Existing accounts without phone still work and can add a unique phone via existing password-confirmed My Account controls. Unchanged historical phones remain untouched during security/profile saves. Ambiguous historical phone login fails safely; existing email access remains available. Duplicate errors reveal no other user's profile or identifiers; existing duplicate-account UX remains.

No real approved OTP provider exists. **Unique phone is not verified phone ownership.** No SMS provider, test code or ownership claim was introduced. Optional email is supported for registration/session/login/assisted recovery. Paystack requires a real checkout email; Wallet top-up still requires a profile email under its existing contract. A phone-only customer can add an email in My Account to fund Wallet. Assisted Forgot Password continues through the existing support flow, not SMS/email magic recovery.

Launch offer defaults centrally to enabled, fixed 100 pesewas, direct Data only, unique-phone requirement. MTN 1GB is 549 - 100 = 449 pesewas. Authenticated active buyer with a canonical unique account phone, no previous qualifying paid direct Data order and no active/redeemed welcome benefit is eligible, regardless of account age. Historical refunded orders with unresolved manual review still block eligibility. Guests pay regular retail. A buyer may purchase for anybody; recipient identity never owns/consumes the buyer's offer. A recipient can later qualify independently. Data Reseller storefronts, Airtime, Instant Bundles, AFA and Marketplace are excluded.

## Financial integrity and lifecycle

Existing owner financial transaction/advisory lock, policy shared/exclusive lock, phone claim and one-active-welcome unique index protect two tabs/devices and simultaneous Wallet/Paystack attempts. The snapshot, reservation and order commit together; authenticated Paystack initialization additionally has an idempotency latch. Wallet debit, purchase ledger, reservation and order use one transaction. An insufficient/failed debit rolls back without consuming the offer. A browser can supply expected values for stale detection but cannot choose actual price, discount or buyer identity.

The lifecycle is eligible -> reserved -> redeemed or released. Redemption occurs only on paid, delivered, non-review direct orders. Duplicate callbacks/webhooks/effects are idempotent. Existing payment validation checks exact discounted pesewas/reference/GHS against the persisted order. Browser cancellation alone cannot prove failure. Explicit Paystack validation/authorization rejection releases; timeout/conflict/rate-limit/server/network ambiguity holds. Verified failed/abandoned references release only after re-reading/locking the current unpaid, supplier-inactive order. A stale failure cannot release a payment that has since succeeded.

A definitive complete-refund order without manual review releases once, preserving old operations/reasons/timestamps and snapshots. Supplier ambiguity/manual review holds the benefit. A phone claim remains bound to its original buyer even after release to resist phone recycling; that same buyer can requalify after definite failure/refund. Release is not a grant to another account. A released reference paid late is held for Admin review and cannot dispatch automatically. Existing scheduled fulfilment reconciliation recovers delayed redemption/refund effects, verifies uncertain pending payments, and resumes paid-but-unclaimed welcome dispatch. It never blind-retries ambiguous supplier submissions; the existing supplier safety latch remains authoritative.

New order JSON snapshots include regular retail, discount, paid total, pricing and promotion revision/type, private buyer claim, supplier cost, reserve and contribution. PostgreSQL rejects snapshot updates. Customer/Admin safe presentation exposes regular/discount/paid totals without buyer identity or supplier economics to the public. Orders show paid amount plus stored saving. Mystery Earn uses actual discounted `order.amount` and the stored processing reserve where known, caps rewards to real margin and keeps existing reward deduplication. Existing persisted rewards, orders, payments, Wallet history and Store Earnings are never revalued.

## Security review and verification

Reviewed tampering, cross-user eligibility, guest confusion, recipient independence, duplicate phones, admin RBAC, reservation races, exact Paystack amount, Wallet debit, cost validation, historical immutability, reseller separation, stale quotes and safe public fields. Concrete findings corrected: stale failed verification releasing an already-paid order; ambiguous-refund eligibility; unpersisted recovery effects; checkout reopening/request reuse and final-total mismatch; ambiguous initialization classification; canonical legacy lookup. No secret/environment/provider/database mutation was performed. Tests use the existing isolated runner; PostgreSQL boundary tests replace pool query/connect and block external requests. These validate SQL bindings/locks/rollback, not a real PostgreSQL engine execution. A staging database exercise is still required before deployment.

Final verification: 437/437 targeted tests; 87/87 new commercial/identity/promotion and mocked PostgreSQL tests; full isolated regression 1121/1125, with only the four inherited failures reproduced as 13/17 passing in the selected unchanged-base suites. TypeScript, production build and diff check passed. Existing non-blocking Vite configuration/chunk warnings were left unchanged. Targeted commercial tests include all 26 seeds, phone formats, guest/older/prior-buyer eligibility, independent recipients, concurrent tabs/Wallet+Paystack, exact debit, failed/ambiguous initialization, failure/refund/recovery, duplicate callback/webhook, historical snapshot, Admin future price/audit and public privacy. Regression coverage includes Wallet, payment integrity, account recovery, reseller, Marketplace boundaries and Earn. The four inherited failures were reproduced on an untouched archive of base 8080a05: MemberHome Coming Soon; MobileNav Earn Coming Soon; MobileNav member status; Website Builder template aggregate. Three are UI expectations across the two Earn-related test files and one aggregate covers Website Builder template expectations. They remain unchanged. No dependencies added.

## Production readiness and controlled smoke tests (not executed)

After founder review and separate merge/deployment approval, run normal repeatable initialization on an isolated staging PostgreSQL first. Inspect historical canonical-phone conflicts read-only; resolve only with verified support evidence. Do not merge accounts automatically. Confirm provider costs for all enabled packages and investigate differences from the founder-reference CSV. Check the direct reserve/reward economics policy and a real receipt email workflow. Review defaults: deployment would introduce the requested enabled GH₵1 direct offer and retail seeds where no override exists. Confirm existing overrides intentionally before production activation; no Render/env edits are required by this code pass. Do not change reseller policy/wholesale without its own approval.

1. In staging verify all Home/Data network prices and Admin estimates; disable a product and ensure its shortcut cannot buy another package. Re-enable only after known cost review.
2. As guest check MTN 1GB 5.49, no offer; as unused unique-phone buyer check 5.49 minus1.00 equals4.49. Use a different recipient. Verify a phone-only signup, email login and phone login, and equivalent-format duplicate rejection.
3. Exercise Admin change with an already-open checkout: require refresh/review before payment; restore reviewed pricing through Admin with audit. Check negative-subsidy warnings and reseller retail independence.
4. Only after explicit founder authorization for controlled live transactions: perform one 4.49 Wallet purchase and one separate eligible account's 4.49 Paystack purchase, on controlled valid recipients. Check exact debit/verification, single supplier submission, delivered redemption and Orders snapshot.
5. Replay only authorized callback/webhook verification, confirm no duplicate debit/reward/redemption. Use staging for simultaneous tabs, abandonment, ambiguous supplier responses, late payment and full-refund restoration; never force a live production failure/refund just to test.
6. On approved staging reseller checkout verify no direct welcome discount, unchanged owner retail/wholesale and separate Store Earnings. Check Airtime/AFA/Marketplace unchanged through isolated fixtures.

Deferred: real OTP ownership verification, expanded supplier bundle mappings, additional promo services/schedules/campaign engine, Product Polish and real production smoke transactions. Live supplier costs, production reserve and phone conflicts were not queried here.

## Checkpoint file manifest

43 scoped files: 31 modified and 12 new. No dependencies, environment files, generated output, logs, screenshots or unrelated features are included.

- `docs/commercial-pricing-review.csv` (new)
- `docs/commercial-pricing-welcome-offer.md` (new)
- `server.ts`
- `server/data/productCatalog.ts`
- `server/db/authStore.ts`
- `server/db/commercialSchema.ts` (new)
- `server/db/connection.ts`
- `server/db/ordersStore.ts`
- `server/db/schema.sql`
- `server/routes/adminApi.ts`
- `server/routes/api.ts`
- `server/routes/commercialApi.ts` (new)
- `server/services/commercialService.ts` (new)
- `server/services/financeService.ts`
- `server/services/fulfilmentService.ts`
- `server/services/mysteryAiContext.ts`
- `server/services/paystackService.ts`
- `server/services/referralEconomics.ts`
- `server/services/websiteBusinessService.ts`
- `server/suppliers/__tests__/accountRecovery.test.ts`
- `server/suppliers/__tests__/adminEarnControlRoom.test.ts`
- `server/suppliers/__tests__/commercialDatabase.test.ts` (new)
- `server/suppliers/__tests__/commercialV1.test.ts` (new)
- `server/suppliers/__tests__/dataStorefrontLaunch.test.ts`
- `server/suppliers/__tests__/marketplaceFlexibilityDatabase.test.ts`
- `server/suppliers/__tests__/mysteryAiProduction.test.ts`
- `server/suppliers/__tests__/websiteBusinessDatabase.test.ts`
- `server/types/orders.ts`
- `shared/directPricing.ts` (new)
- `src/components/admin/AdminPage.tsx`
- `src/components/admin/sections/AdminCommercialSection.tsx` (new)
- `src/components/auth/AuthModal.tsx`
- `src/components/checkout/CheckoutModal.tsx`
- `src/components/data/DataPage.tsx`
- `src/components/data/WelcomeOfferNotice.tsx` (new)
- `src/components/home/HomeFeaturedData.tsx`
- `src/components/orders/OrdersPage.tsx`
- `src/data/bundles.ts`
- `src/hooks/useDirectCatalog.ts` (new)
- `src/hooks/usePaystack.ts`
- `src/services/apiClient.ts`
- `src/services/commercialApi.ts` (new)
- `src/types/index.ts`

## Welcome acquisition plus referral subsidy

The standard Data referral policy remains an explicit operator configuration: 50 pesewas for acquisition and 10 for recurring. It is not an automatic startup seed or fallback payout. Active persisted reward rules and service economics policies remain authoritative; no production policy was inspected or changed during this follow-up.

Ordinary reward calculation uses actual paid revenue, known supplier cost, and the checkout-snapshotted reserve (otherwise the enabled service reserve, otherwise the existing zero-reserve fallback). Rewardable margin is max(0, paid revenue - cost - reserve). A fixed/revenue-percentage rule is capped to that margin; enabled margin-percentage economics instead pays the configured percentage of margin, also capped to margin. There is no automatic nonzero margin percentage. Half-up integer-pesewa rounding remains unchanged.

The first qualifying referred direct Data purchase with an immutable server-created Welcome Offer snapshot now pays its selected active rule's full nominal reward without a margin cap. This deliberately overrides margin-percentage economics only for that acquisition expense. A configured revenue-percentage rule still uses actual discounted paid revenue. Known supplier cost, referrer eligibility, paid delivery, acquisition-stage qualification, valid snapshot arithmetic, the existing customer-charge ceiling, relationship locking and ledger idempotency still apply. Missing cost still fails closed. Guests, reseller orders, other services, normal first orders without Welcome Offer, and recurring purchases do not receive this exception.

For AirtelTigo 1GB with synthetic/reference cost 390, paid revenue 399, explicitly configured reserve 20 and first reward 50 pesewas, post-reward contribution is -61 pesewas. The signed value and acquisition-subsidy calculation mode are recorded in the reward metadata. Unknown reserve produces an unknown contribution estimate, not a claimed profit. Admin shows the estimated eligible first reward and contribution after that reward, warns on negative contribution, and does not block a valid acquisition transaction.

Existing historical ledger amounts remain unchanged. A refund uses existing reward reversal/manual-review protections; a reversed acquisition remains in relationship history, so restoring the Welcome Offer does not authorize another first-referral subsidy. Recurring purchases retain ordinary margin-aware behavior.

## Dynamic direct Data policy finalization

An additional explicit `economics:data` mode, `stage_margin_percent`, supersedes the fixed payout calculation only after Admin enables/saves it. The centrally defined launch recommendation is acquisition 5000 bps (50%) and recurring 2000 bps (20%); both are editable as percentages in the existing Financial Control Room. Startup never seeds, enables or replaces a saved policy. Existing fixed 50/10 rules and other explicitly saved modes keep their existing behavior until deliberate activation. The normal active referral rule and eligibility still gate payout; in dynamic mode its fixed amount does not cap the percentage reward. There is no separate new acquisition override feature.

Acquisition reward = half-up(50% × max(0, regular direct retail - authoritative supplier cost - reserve calculated on regular retail)). Recurring reward = half-up(20% × max(0, actual paid revenue - authoritative supplier cost - reserve calculated on actual revenue)). These rates are saved configuration, not checkout constants. Zero/negative normal margin earns zero; unknown cost or required reserve earns zero, without blocking customer purchases. Welcome discount does not reduce the acquisition basis or cap its reward to post-discount margin. Legitimate acquisition rewards may exceed actual customer payment when a deliberately configured subsidy is unusually large; they remain derived only from positive normal contribution.

New checkout snapshots include `normalReserveMinor` as well as actual `reserveMinor`. Snapshot reserve takes precedence for its respective basis; otherwise an explicitly configured direct commercial reserve takes precedence over a configured enabled Data reserve. Dynamic fallback requires explicit `reserveConfigured`, so unapproved zero cannot silently become a known reserve. A deliberately approved zero is supported. Existing reward snapshots are returned unchanged and never recalculated. No schema migration or historical snapshot rewrite is needed.

Admin Commercial controls show supplier/reserve status, first/recurring reward estimates, and retained contribution, with negative acquisition warnings. Financial controls show human-readable percentages and reserve approval status. Neither view treats unknown costs/reserves as profit. Other services and reseller orders do not enter the new calculation.

Illustrative engine-tested figures in pesewas, using founder-reference/synthetic costs and an explicitly synthetic fixed reserve of 20 (not a production reserve): MTN 1GB regular 549 / cost 400 / normal margin 129 / first reward 65 / Welcome payment 449 / retained acquisition -36 / recurring reward 26 / retained recurring 103. AT 1GB: 499 / 390 / 89 / 45 / 399 / -56 / 18 / 71. MTN 10GB: 4499 / 4000 / 479 / 240 / 4399 / 139 / 96 / 383. MTN 40GB: 17699 / 16000 / 1679 / 840 / 17599 / 739 / 336 / 1343. Production examples remain incomplete until authoritative live costs and approved reserves are known; the reference figures are not deployed cost overrides.
