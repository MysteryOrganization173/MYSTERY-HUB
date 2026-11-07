# Mystery Hub V3.2 handoff

Prepared 7 November 2026 from verified remote main `2160b1b90311597d6cb1191af2d92d0a994bf4d8`. This document accompanies the Admin V6 readiness release; use that PR's verified merge commit/main revision as the next task baseline. Fetch current main before editing.

## Completed V3.1 releases

- [PR #101](https://github.com/MysteryOrganization173/MYSTERY-HUB/pull/101): official support and two community channels. Feature `63e10200d2c99a6270978699dfaea413ce597c0d`, merge `eaf7d8d4918b5361a84905cd2b9fcbcd1233e60b`. Both Render services independently reached LIVE on that merge.
- [PR #102](https://github.com/MysteryOrganization173/MYSTERY-HUB/pull/102): dormant Results Checkers safety completion. Feature `045ca7fa0357de3aba63a3b92198767b0a2f5569`, merge `2160b1b90311597d6cb1191af2d92d0a994bf4d8`. Both Render services independently reached LIVE. Saved PINs survive concurrent/repeated replies; identical vouchers count once; recovery requires readable PINs and durable validation/charge evidence; submission claim rechecks current eligibility; receipt state cannot cross sessions.
- Admin V6 in this release: **Admin → Commercial Pricing → Service readiness & commercial operations**. Fresh strict authenticated GET diagnostics, permission flags, catalogue facts, checker mapping/cost/stock/spread, configuration blockers, explicit unknown/stale states. Existing pricing/Welcome/reseller/finance/order/System tools reused. No activation switch, migration or financial mutation.

## Results Checkers remain dormant

Fresh production read-only evidence: Supabase project `fcvydpuuwbciuulrvizk` is ACTIVE_HEALTHY; `public.results_checker_purchases` **is not installed** (metadata query at approximately 23:29 UTC). Public checker config HTTP200/available:false/two unavailable products. No production table, key or commercial flag was changed. Public-schema tables without RLS: zero.

Activation prerequisites, in order:

1. Use Admin V6 Refresh readiness for fresh account fingerprint, canonical `vouchers` permissions and authenticated catalogue facts. If Cloud still needs raw diagnostics, the existing [sanitized Render Shell GET procedure](https://github.com/MysteryOrganization173/MYSTERY-HUB/pull/69#issuecomment-6711476631) uses the backend's existing environment without revealing credentials. Cloud has no authenticated Render command-execution path.
2. Confirm exact BECE/WASSCE supplier type IDs/variants, stock and costs. Retail remains BECE GH₵23.99 / WASSCE GH₵24.99; existing approved supplier ceiling is GH₵18.00. Historical screenshots are not current API evidence.
3. Obtain supplier-confirmed voucher purchase/lookup shapes and charge semantics; the October31 snapshot does not fully define PIN entries/lookup data. Test sanitized fixtures. No supplier purchase-idempotency guarantee exists.
4. Separately approve and apply existing `server/db/resultsCheckers.sql` through the established workflow. Verify the actual backend role and client denial. Keep the commercial flag off.
5. Configure/preserve a dedicated valid encryption key and confirmed type mappings securely; verify live-payment/fulfilment prerequisites. Never paste secrets into chat.
6. Explicitly authorize controlled commercial acceptance/activation separately. No real purchase is authorized by the engineering release. Only make customer discovery links live once operational prerequisites and acceptance pass.

See [Results Checkers procedure](results-checkers-v1.md) and [Admin V6 definitions](admin-v6-commercial-readiness.md). Code completion is not live supplier or commercial proof.

## Integration boundaries and safeguards

- Held draft [PR #69](https://github.com/MysteryOrganization173/MYSTERY-HUB/pull/69) remains unmerged; disputed discovery/productCount semantics and legacy envelope handling remain separate. New diagnostic interpretation does not change checkout gates.
- Creative Studio V2 [PR #100](https://github.com/MysteryOrganization173/MYSTERY-HUB/pull/100) was already merged before this assignment. No Creative Studio source or unfinished Claude branch was changed/imported. Further Creative Studio work remains Claude-owned.
- Preserve server payment verification, one-shot dispatch, uncertain-submission reconciliation, encrypted private receipts, authenticated ownership, RLS/backend privileges, audited Admin resolutions and financial locks. A supplier credit is not a confirmed customer refund. No production financial records/balances/prices or notification-worker state changed.
- Admin readiness is on demand, shared60s per backend process and bounded to4 supplier GETs/snapshot; no polling. Supplier-check success is not a real purchase, wallet/beneficiary approval or delivery.

## Official communications

Central source: `src/config/business.ts`.

- Support **0594521108**, international **+233594521108**, call `tel:+233594521108`, [WhatsApp support](https://wa.me/233594521108).
- Email preserved: aryeeteyemmanuel852@gmail.com.
- [WhatsApp announcements](https://whatsapp.com/channel/0029VbBt1MGC6ZvlDJ8Biz3l) and [Telegram announcements](https://t.me/mysteryhubapp) appear together in the shared footer. Telegram is not a support bot.
- Remaining old-number strings are synthetic customer fixtures/input examples, not official support links; customer and website-owner contacts were preserved.

## V3.2 sequence — future work, not implemented here

1. Finish and improve existing Website Builder templates.
2. Build premium Christmas templates.
3. Expand justified Ghanaian seasonal/celebration templates.
4. Continue Website Builder quality improvements.
5. Design Website Builder Plus around valuable features and a robust billing lifecycle.

Start with current main, check concurrent work, and preserve customer-site compatibility. No seasonal/Plus or broad Website Builder redesign belongs to the V3.1 release.
