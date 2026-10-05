# Wallet, Mystery Earn and Rewards V1

Implementation checkpoint notes. This branch is for founder review; these notes do not authorize deployment, production transactions or reward-policy activation. The commit SHA and push verification are reported with the checkpoint.

## Checkpoint and financial storage

1. **Branch:** `feat/wallet-earn-rewards-v1`.
2. **Base:** `cc600bd166c5f950ea40fde3f7f6ac0c972f291c`.
3. **Commit:** one checkpoint, `feat: add wallet earn and rewards economy v1`; obtain its SHA from `git log -1` or the accompanying checkpoint report.
4. **Files:** 51 scoped files; the complete implementation manifest is appended below. Preview helpers, test logs, baseline archives, build output, environment files and screenshots are excluded.
5. **Schema:** additive financial tables, indexes, ownership/uniqueness constraints and an append-only ledger trigger. Existing users, referral attribution and reward amounts are not reseeded or migrated destructively.
6. **Entities:** `finance_accounts`, `finance_operations`, `finance_ledger`, `finance_config`. Existing `orders` and `reward_ledger` remain authoritative for purchases and earned referral credits.
7. **Ledger:** immutable integer-pesewa Wallet/Earn movements linked to durable operations. Refunds, transfer reservations/releases, adjustments and payment reversals append compensating movements. PostgreSQL rejects UPDATE/DELETE of financial ledger entries.
8. **Balance authority:** each Wallet projection update and its journal entry commit in the same owner-locked transaction. Journal history can reconstruct the projection. Production financial writes fail closed without PostgreSQL.
9. **Sources:** independently verified deposits, irreversible Earn transfers, configured achievement credits, definitive refunds and audited Admin credits/debits. There is no arbitrary customer credit endpoint or promotional cash-out mechanism.

## Funding and purchases

10. **Top-ups:** persist the owner, integer amount, GHS currency, server-owned reference and purpose before initializing Paystack. Track initialization uncertainty, pending, verified failure, credited, reversal review and reversed states plus timestamps. Initialization retries reuse the record and do not issue a second Paystack initialization.
11. **Verification:** callback, authenticated Verify funding, signed webhook and confirmed Admin reconciliation independently call Paystack verification. Credit requires success, matching reference/amount/currency and exact owner/top-up/purpose metadata. Simulated payments and real Paystack test-mode transactions cannot create spendable money; production funding initialization requires a live key. Matched failure remains recoverable if a later independent verification confirms success.
12. **Funding fee:** 0%; GH₵50 paid means GH₵50 credited. External processing cost is borne by Mystery Hub. Wallet funding restricts Paystack to its documented `mobile_money` channel; normal service Paystack channels are preserved.
13. **Limits:** default funding GH₵1–GH₵1,000. Admin configures future limits centrally. Integer movements and Wallet balance are bounded to 100,000,000 pesewas (GH₵1,000,000). New funding checks existing balance and open funding against that ceiling before external initialization.
14. **Idempotency:** unique owner/request keys, unique Paystack top-up references and unique operation/bucket ledger entries; user advisory/account-row locks serialize callback/webhook/manual races. Existing credit/reversal states cannot be credited again.
15. **Wallet UI:** `/wallet`, Member Home, More Services and Footer expose the real Wallet. Balance, Add Money, Go to Earn, empty states, pending verification and restrictions are visible. A callback does not imply success.
16. **History:** dated friendly credit/debit descriptions, amount, resulting Wallet balance and committed status; customer pages use 25-row pagination. Pending/failed funding appears separately with Verify funding. Customers only read their own records.
17. **Services:** signed-in Data, Airtime and AFA. Marketplace, Instant Bundles and Website Builder are not integrated with Wallet in this pass.
18. **Checkout:** choose existing Paystack or sufficient Wallet. Insufficient balance shows the exact shortfall and Add Money/Paystack alternatives. No split payment. Backend uses the same catalogue/Airtime calculation/AFA discovery price as normal checkout; client price/user identity cannot authorize the debit.
19. **Double spending:** an owner lock encloses sufficient-balance check, idempotency operation, debit/journal and Wallet-paid order creation. AFA encrypted registration shares that transaction. MTN recipient locks and canonical phone variants preserve duplicate protection. Dispatch happens after commit.
20. **Refunds:** only an authoritative `refunded` Wallet order without unresolved manual review credits a new immutable refund once, matching its original purchase amount. `refund_pending`, failed, queued, processing and timeout states do not credit. Scheduled recovery reconciles a crash between terminal status and credit.
21. **AFA uncertainty:** existing durable submission latch, publicId recovery/polling, masking and encrypted-payload purge remain intact. Recover only unclaimed paid orders; queued/ambiguous AFA requests never automatically POST again or receive a speculative refund.

## Earn, withdrawals and transfers

22. **Compatibility:** use the existing referral profile, lifetime first-touch attribution, unique visitor tracking, rule matching and reward ledger. No historical reward recalculation, attribution repair or production reconciliation script is run.
23. **Balances:** available = approved unreversed rewards minus net Earn consumption; pending rewards are separate. Reserved withdrawals and gross completed withdrawals are shown separately. Lifetime reflects rewards that were actually approved, including subsequently reversed historical amounts. Deficits require reconciliation rather than a fabricated balance.
24. **Minimum:** default GH₵5.00, centrally configurable. Withdraw Earnings stays visible below minimum with the amount still needed.
25. **Fee:** default 300 basis points (3%). GH₵20 request → GH₵0.60 fee → GH₵19.40 manual MoMo payout.
26. **Rounding:** shared `money.ts` uses integer pesewas and bigint basis-point calculations, rounding half up to the nearest pesewa; GH₵5.50 × 3% → GH₵0.17 fee.
27. **Snapshots:** requested amount, fee basis points, fee/net amounts, normalized MoMo destination, selected provider and recipient name are fixed at request creation. Future settings and Admin action request bodies cannot replace them.
28. **Lifecycle:** pending_review → approved → paid, or pending_review/approved → rejected. Request reserves the full gross amount through an Earn debit; rejection adds a full reservation-release credit. Paid is final and records Admin/time/reference. Approval sends no money.
29. **Customer history:** date, gross request, snapshotted fee/net, masked destination/provider, status, rejection reason and paid date. No full payout phone in generic history.
30. **Admin queue:** customer, timestamp, fee/net, operational MoMo number/name/provider, available Earn, restriction indicator and prior-request count. Queue/financial records and customer history have pagination. Customer inspection also shows original Earn ledger activity.
31. **Security:** server Admin RBAC, explicit confirmation, stale expected-state rejection, reason/reference requirements, owner locks and atomic audit records. Restricted/reconciliation accounts cannot be approved or marked paid; rejection can safely release an unpaid reservation. No automatic payout API is introduced.
32. **Earn → Wallet:** explicit confirmation, 0% fee, exact paired Earn debit/Wallet credit, one durable operation, irreversible. Transferred money becomes spendable and cannot be withdrawn back to MoMo.
33. **Transfer races:** transfer, withdrawal reservation, Admin adjustment and reward reversal share owner serialization and locked reward rows. Concurrent requests cannot consume the same pesewa twice. A failed Wallet credit rolls back its Earn debit.

## Referral economics and achievements

34. **Qualification:** successful payment plus authoritative delivered/registered completion, valid existing attribution and active eligible rule. Payment/form submission alone, unsuccessful/ambiguous delivery, self-referral or a duplicate order cannot create another reward.
35. **Margin:** retail − known supplier cost − configured fixed/basis-point operations reserve. Fixed rewards are capped to nonnegative margin; explicitly enabled margin-percentage rules use that margin. Unknown cost fails closed for new Data/Airtime/AFA rewards; rewards above customer charge are rejected.
36. **Cost authority:** Data catalogue/fulfilment and Airtime supplier order charge/amount snapshots. AFA uses actual supplier registration cost, with an optional explicitly verified Admin flat AFA cost when necessary. Data/Airtime cannot use invented Admin fallback cost.
37. **Reserve:** per-service central configuration supports fixed pesewas plus basis points. An absent/disabled new margin policy has no newly invented reserve; operator must choose actual operating/payment allowance before enabling the margin-percentage policy.
38. **Snapshots:** retail, cost and source, reserve, rewardable margin, economic/rule version and ID, rule/stage inputs, mode and final amount persist on each new earned reward. Later configuration changes do not alter the original ledger fact.
39. **50/10 compatibility:** existing GH₵0.50 acquisition/GH₵0.10 recurring rules and their enabled state remain in the existing rule store. Known-margin safety can cap future qualifications; historical records remain unchanged. No production rules are automatically activated.
40. **Data:** existing catalogue, acquisition/recurring relationship locks and delivery qualification remain. New reward is subject to the known-cost cap.
41. **Airtime:** existing qualification and supplier cost authority remain; no invented supplier discount or positive margin. At retail equal to supplier cost, a reward is zero rather than creating a loss.
42. **AFA:** requires a separately enabled AFA economic policy AND an AFA-specific enabled reward rule. A wildcard cannot activate it. Reward qualifies only after authoritative registration success, never during uncertain supplier acceptance. Both Paystack and Wallet orders can qualify.
43. **Wallet referrals:** payment provider does not disqualify an otherwise valid delivered purchase. The same economic snapshot and order-level uniqueness apply.
44. **Reversals:** keep original reward/history, record auditable reversal and reduce unconsumed available Earn. Already transferred/reserved/withdrawn value enters durable manual review and restricts spending/cash-out. Confirmed Admin settlement requires enough recovered available Earn; it never creates negative balances. Other outstanding cases retain restriction.
45. **Achievements:** server-authoritative definitions/progress, unique owner/achievement claim operations, optional configured Wallet credit and original reward snapshot. No client-supplied progress/value or cash-withdrawable achievement rewards.
46. **Initial types:** first successful referral, ten qualified visitors and first successful AFA referral. Lifetime qualifying earnings is also a supported configurable metric. Unsupported generated-site/purchase metrics are not invented.
47. **Values:** defaults are enabled zero-value badges. Admin can configure monetary values/thresholds/enablement. Claimed IDs cannot award again when edited. Disabled achievements are hidden and unclaimable.
48. **Traffic:** reuse existing distinct persistent visitor keys; empty/transient keys and repeated browser events do not multiply progress. This remains the repository's existing qualified/deduplicated browser metric, not a new claim that humans are identity-verified.

## Administration and security review

49. **Wallet controls:** customer balance/history inspection, confirmed reasoned credits/debits, funding verification, external reversal review and definitive refund reconciliation; each monetary action remains idempotent/nonnegative.
50. **Earn controls:** original approved/pending/reversed ledger inspection plus truthful available/reserved/withdrawn summaries and manual withdrawal queue. Existing Mystery Earn management remains available.
51. **Reward controls:** existing fixed/percent rules, stage/scope/enablement and added AFA selection; Financial Control Room adds per-service margin/reserve/cost configuration. Policies are operator actions, not deployment side effects.
52. **Achievement controls:** threshold, Wallet value and enable/disable configuration with confirmation and audit. No invented giveaway values or repeated claim resets.
53. **Audit:** withdrawal approval/rejection/payment, Admin Wallet adjustment, settings/economics/achievement changes, funding/reversal/refund and recovered-reward reconciliation. Production Admin mutation and audit commit together. Automatic financial operations have durable operation/journal evidence. No tokens, payment keys, Ghana Card/DOB or full MoMo destination fields are added to unrelated audit metadata.
54. **Limits:** reuse current limiter infrastructure: sensitive finance actions and Wallet Data/Airtime checkout default to 10/minute; AFA preserves its 10/10-minute limiter. Locks/uniqueness remain the financial protection; rate limiting is supplemental.
55. **Analytics:** no new analytics event system. Money is controlled only by durable financial/order/reward records. No financial credentials or payout PII added to analytics.
56. **Review findings fixed:** paid-order crash recovery; compensating refund recovery; unknown/invalid supplier-cost fail-closed behavior; explicit AFA rule requirement; stable Admin adjustment retries; spent reward/payment reversal restriction; recoverable audited reward settlement; transaction-client reuse to avoid secondary-connection starvation; ledger immutability/owner constraints; account-change balance/form clearing; pre-initialization overflow checks. Existing auth/forced-password/RBAC contracts are retained.
57. **Concurrency findings:** tests cover concurrent top-up credit/webhook/callback, paired transfers, withdrawals vs transfer, purchases, dispatch recovery, achievements and Admin retries. PostgreSQL uses owner advisory locks, account/reward row locks and unique constraints. No network supplier/payment request runs inside the purchase transaction.

## Verification and operating requirements

58. **Wallet tests:** money validation/rounding, purpose/amount/currency/ownership verification, simulation rejection, concurrent credits, failure recovery, server pricing, balance guards, purchases, refunds, external reversal and crash recovery.
59. **Withdrawal tests:** minimum, fee snapshots, destination validation, reservation accounting, tampering, concurrent consumption, allowed/stale transitions, rejection release, final payout and masked/non-PII audit output.
60. **Transfer tests:** zero fee, exact paired journal entries, retries, withdrawal race, over-consumption and transactional rollback.
61. **Referral tests:** first/recurring compatibility, existing snapshots/attribution, known-cost cap, below-cost/unknown-cost rejection, AFA-specific rule/policy and Wallet-qualified completion, historical stability and spent-reward reconciliation. Existing synthetic stage fixtures now include a known cost; actual business expectations remain intact.
62. **Achievement tests:** server qualification, missing/disabled eligibility, badge defaults, configured exact credit, cross-user rejection and concurrent duplicate claim prevention.
63. **Totals:** 124/124 new financial cases; 323/323 relevant finance/referral/AFA/supplier/payment cases passed. PostgreSQL coverage is mocked transaction/SQL coverage, not a claim that real PostgreSQL was contacted.
64. **Regression:** 927/931 passed in the full isolated suite; all new relevant cases pass, with only the four independently reproduced base failures below.
65. **Inherited:** Member Home Coming Soon expectation; Mystery Earn Coming Soon expectation; old guest/member Earn copy expectation; Website Builder aggregate expects `QuickByte Data` but current template says `Ghana Data Express`. Reproduced independently from an unchanged archive of `cc600bd` (13/17 passed). Unrelated tests/features are not repaired here.
66. **TypeScript:** `npx tsc --noEmit` passed.
67. **Build:** `npm run build` passed. Existing native-config/__dirname and large-chunk warnings are unchanged in scope and not repaired.
68. **Diff:** `git diff --check` and staged-file scope inspection must pass. No generated output, credentials, environment files, preview helpers or unrelated source changes enter the checkpoint.
69. **Responsive:** actual isolated browser checks at 360/390/430/768/1024/1280/1440 cover Wallet/history, Add Money, pending payment verification, sufficient/insufficient checkout, AFA choice, withdrawal/fee, irreversible transfer, achievements and Admin queue/inspection. No horizontal overflow observed; GH₵20/0.60/19.40 withdrawal example verified. No live money moved.
70. **Prices:** Data uses existing `productCatalog.ts` integer prices (currently MTN 1GB 499 pesewas, AT 1GB 479 pesewas). Airtime advertised face value equals checkout price, replacing the former 2% surcharge with zero in the shared server/UI calculation. AFA uses existing server discovery/configuration, not a new client price. Proposed MTN 599/AT 499 launch prices are not activated here. Instant/Marketplace pricing is preserved.
71. **Configuration:** no new environment variables. Existing PostgreSQL, Paystack secret/signature, HTTPS allowed `APP_URL`/`FRONTEND_URL`, supplier enablement and AFA encryption configuration remain necessary. Financial settings/policies/achievements are stored in `finance_config`; `AIRTIME_SERVICE_FEE_PERCENT` no longer overrides the approved zero checkout surcharge.
72. **Setup still required:** founder review and separate deployment approval; verify additive initialization on isolated/staging PostgreSQL, required existing credentials/callback origin, manual payout procedure, actual AFA supplier cost, operating reserve and explicitly chosen reward/achievement policy. No environment changes or schema scripts have been run against production by this pass.
73. **Controlled smoke tests:** operator-approved live small MoMo funding with duplicate callback/webhook verification; one Wallet purchase per eligible service; AFA publicId/status/purge; interruption recovery; one confirmed Earn transfer/manual withdrawal and fee reconciliation; Admin reconciliation/audit; actual PostgreSQL trigger/constraints. These live/staging checks are not executed here. If a paid top-up cannot credit because later activity filled the maximum balance, retain its durable reference and reconcile it; never issue a second credit.
74. **Deferred:** automated MoMo payout, Wallet cash-out, split payment, P2P, merchant wallets, bank/crypto/lending, commercial loss leaders, generated-site/Website Builder finance/analytics and broad catalogue repricing. High-volume SQL aggregation/retention tuning is not represented as tested production capacity.
75. **Push:** push only this feature branch without force; no PR/merge/deployment or policy activation. Verify remote HEAD equals the checkpoint commit.
76. **Status:** final branch/commit/remote/clean-working-tree evidence is reported after checkpoint. No real supplier registration, Paystack payment, external database mutation or Render/Cloudinary/environment change was performed during implementation/testing.

## Implementation manifest

### Local Admin preview loading incident

The previously running isolated preview on port 4201 retained its pre-Wallet backend router while Vite served the updated frontend. Authenticated GET requests to `/api/admin/finance/control`, `/withdrawals`, `/operations` and `/customers/:id` fell through to the storefront fallback and returned status 200 with `text/html`. Parsing that document as JSON caused the observed `Unexpected token '<'` error. The committed API mounts and frontend paths were already correct; restarting that isolated preview loads the current routes. No financial architecture or Website Builder source changes are required. A regression test places the real Admin router before an HTML fallback and verifies JSON responses and the settings, queue, operations and customer payloads. Restart local backend processes after adding server routes; frontend hot reload alone does not refresh their imported routers.

The checkpoint includes the scoped paths listed by its commit. Financial core lives in `shared/money.ts`, `server/db/financeSchema.ts`, `server/db/financeStore.ts`, `server/services/financeService.ts`, `server/services/referralEconomics.ts`, and `server/routes/financeApi.ts`; frontend financial surfaces and regression fixtures are included alongside the existing order/referral/AFA integration points.

- `docs/wallet-earn-rewards-v1.md`
- `server/data/airtimePricing.ts`
- `server/db/afaStore.ts`
- `server/db/connection.ts`
- `server/db/financeSchema.ts`
- `server/db/financeStore.ts`
- `server/db/ordersStore.ts`
- `server/db/referralStore.ts`
- `server/db/schema.sql`
- `server/routes/adminApi.ts`
- `server/routes/afaApi.ts`
- `server/routes/api.ts`
- `server/routes/financeApi.ts`
- `server/services/financeService.ts`
- `server/services/fulfilmentService.ts`
- `server/services/paymentValidation.ts`
- `server/services/paystackService.ts`
- `server/services/referralEconomics.ts`
- `server/services/referralRulePolicy.ts`
- `server/services/referralService.ts`
- `server/suppliers/__tests__/afaRegistration.test.ts`
- `server/suppliers/__tests__/airtimeFulfilment.test.ts`
- `server/suppliers/__tests__/checkoutPerformanceAndStatus.test.ts`
- `server/suppliers/__tests__/financeApi.test.ts`
- `server/suppliers/__tests__/financeDatabase.test.ts`
- `server/suppliers/__tests__/financeV1.test.ts`
- `server/suppliers/__tests__/rewardEconomics.test.ts`
- `server/suppliers/__tests__/rewardEconomicsDatabase.test.ts`
- `server/types/orders.ts`
- `shared/money.ts`
- `src/App.tsx`
- `src/components/admin/AdminPage.tsx`
- `src/components/admin/sections/AdminEarnRules.tsx`
- `src/components/admin/sections/AdminFinanceSection.tsx`
- `src/components/admin/sections/AdminMysteryEarnSection.tsx`
- `src/components/checkout/CheckoutModal.tsx`
- `src/components/common/Footer.tsx`
- `src/components/data/DataPage.tsx`
- `src/components/earn/MysteryEarnPage.tsx`
- `src/components/finance/FinancialPanel.tsx`
- `src/components/finance/WalletPaymentChoice.tsx`
- `src/components/home/MemberHome.tsx`
- `src/components/services/AfaRegistrationPage.tsx`
- `src/components/services/MoreServicesPage.tsx`
- `src/config/afa.ts`
- `src/data/services.ts`
- `src/services/afaApi.ts`
- `src/services/financeApi.ts`
- `src/services/mysteryAiService.ts`
- `src/types/index.ts`
- `src/utils/routing.ts`
