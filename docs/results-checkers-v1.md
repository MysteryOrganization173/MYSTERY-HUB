# Results Checkers V1

WASSCE and BECE checker vouchers, at `/results-checkers`. Mystery Hub sells vouchers. It doesn't issue results and isn't affiliated with WAEC.

**Status when merged: dormant.** The code is deployed, but nothing can be bought until every step under "Activation" is done. Until then the page says checkers aren't on sale, and purchase requests are refused.

## How a purchase works

1. A signed-in customer chooses a product and quantity (1 to 5). Signing in is required, because the PIN is tied to the account.
2. The server sets the price and checks the live supplier catalogue. Any amount sent by the browser is ignored.
3. The order and its purchase record are created together. The customer pays on Paystack through the existing payment service.
4. The existing verification (webhook or return page) confirms payment and claims the order for dispatch.
5. The catalogue is checked again. If cost or stock changed, nothing is bought and the order goes to review.
6. One atomic claim allows at most one supplier purchase per order, whatever happens afterwards.
7. PINs are encrypted and stored first. Only then can the order become delivered.
8. The customer's receipt shows the PINs and can be reopened from Orders.

## Why purchases are never retried

The supplier documents no idempotency key for `POST /vouchers/purchase`, and a timeout says nothing about whether a voucher was bought or the wallet debited.

| Supplier result | What happens |
| --- | --- |
| PINs for the full quantity | Stored, order delivered |
| Fewer PINs, or unreadable ones | What arrived is kept, order goes to review |
| A reference but no PINs | Reference kept. A status refresh reads `GET /vouchers/purchases/:id`, which never buys |
| Timeout, 5xx, unreadable reply | Marked uncertain, review. Never repeated |
| 400, 401, 403, 404, 429 | Refund pending and review. Staff check the supplier statement first, because a refusal isn't proof of no debit |
| Stock or cost changed before buying | No purchase, review |
| PINs returned but the save fails | Retried, then saved without the reference. If it still fails: uncertain, review, recover from the supplier's own delivery |

Staff can end a stuck paid order with **Move to refund review** on the order page. It needs a written note, is audited, starts the existing refund workflow and never buys anything. "Close test order" is refused for these orders.

The shape of `data.pins` entries and of the purchase lookup isn't documented. The parser accepts plain strings and `{ pin, serial }` style objects, and counts anything else as malformed. Check this against the first real response.

## PIN security

- AES-256-GCM with its own key, `RESULTS_CHECKER_PIN_KEY`. Each envelope is bound to its order id.
- PINs are in `results_checker_purchases`, never in `orders`, `supplier_response`, logs or analytics.
- Only `GET /api/results-checkers/orders/:reference/receipt` returns them, only to the order's own signed-in customer, with `no-store`. Any other order or user gets the same 404.
- Admin sees purchase facts and PIN counts, not PINs. If a customer loses account access, there is no staff PIN view yet.
- The supplier's documentation says that when no phone or email is sent, the voucher pack also goes to the supplier account's own contacts by SMS, email and WhatsApp. Mystery Hub sends none, so expect customer PINs to reach those contacts. Check this on the first purchase. It is also the recovery route if a save ever fails.

Keep the key safe. Losing it makes stored PINs unreadable, and changing it needs a planned migration.

## Activation

These are operational prerequisites, not evidence of completed production setup. Verify each against the actual backend before activation. This release does not apply the schema, set secrets or enable sales.

1. Confirm that the supplier key has the `vouchers` permission, using read-only `GET /services` and `GET /vouchers`.
2. Note the real `id`, `name`, `priceMinor` and `available` for BECE and WASSCE. Compare the cost with GH₵18.00. A higher cost keeps that product unavailable (`maxCostMinor` in `shared/resultsCheckers.ts`).
3. With approval, apply `server/db/resultsCheckers.sql` to production once. It only adds one table.
4. On the API service, set:
   - `RESULTS_CHECKER_PIN_KEY`: 64 hex characters, generated fresh
   - `RESULTS_CHECKER_TYPE_ID_BECE`, `RESULTS_CHECKER_TYPE_ID_WASSCE`: the supplier ids
   - `RESULTS_CHECKER_ENABLED=true`, last
5. Obtain supplier-confirmed purchase/lookup response shapes and verify the parser against sanitized fixtures. A controlled real acceptance purchase requires separate explicit authorization; it is not part of engineering tests or this release. If authorized later, check the private receipt, Orders, Admin and supplier statement.
6. Then make it discoverable: set `srv-results` in `src/data/services.ts` to active with `targetPage: 'checkers'`, add a footer link, and add `/results-checkers` to the public page metadata.

To stop sales at any time, remove `RESULTS_CHECKER_ENABLED`. Receipts keep working. Checkouts already paid when it is switched off go to review without buying anything.

## GH₵2 referral reward

Built on the existing Mystery Earn rules and off by default. It needs both:

- an economics policy for `results_checker` (Paystack's fee can be set as the reserve), and
- an explicit Mystery Earn rule: service `results_checker`, fixed GH₵2.00.

A wildcard rule can't enable it. It pays once per order, only after delivery, not for self-referrals, and is capped by real margin. Existing Data, Airtime and AFA rewards aren't changed.

Rough margin at GH₵18.00 cost, assuming Paystack's 1.95% fee: BECE GH₵23.99 leaves about GH₵5.52 before the reward. WASSCE GH₵24.99 leaves about GH₵6.50. Confirm both against real statements.

## Not in V1

Guest purchases, Wallet payment, a second supplier or failover, Admin price management, automatic refunds, and sending PINs by SMS or email.


## V3.1 completion and remaining activation gates (7 November 2026)

The dormant implementation now preserves saved vouchers across repeated/concurrent responses, deduplicates identical PIN/serial pairs, rechecks the current paid/queued/non-review order at its atomic supplier claim, and binds private receipts to the authenticated session. Crash recovery can deliver only from readable PINs plus durable clean response/charge facts. PIN count and quoted cost alone are not delivery evidence. A missing key, malformed reply or incomplete persistence goes to review; no second purchase is submitted.

Regression reproductions on original main: four backend safety cases failed (overwrite, duplicate quantity, missing-validation crash, stale dispatch); the browser logout case retained the previous PIN. Repairs are covered by synthetic APIs and a disposable PostgreSQL database; no customer PIN or paid supplier response was inspected.

### Production evidence still needed

- Fresh authenticated `/services`: account identity, `vouchers` scope and service permission/availability. Conflicting or missing flags require supplier clarification; PR #69 remains held.
- Authenticated `/vouchers`: exact BECE/WASSCE identifiers and variants, `priceMinor`, numeric stock. Dashboard screenshots are not API evidence. Costs above the existing approved GH₵18.00 ceiling remain blocked; retail stays BECE GH₵23.99 / WASSCE GH₵24.99.
- Approved installation of the existing optional RLS schema by the established workflow; verify backend role access and denied client grants. No production DDL is included in this release.
- Dedicated encryption key configured and preserved securely, mapped product IDs and live payment/fulfilment prerequisites. Never send secrets to chat.
- Supplier-confirmed `data.pins` entry shape, purchase identifier, charge semantics and GET lookup contract. The October 31 document does not fully specify these; synthetic fixtures prove code behavior, not the live supplier contract.

The existing sanitized Render Shell procedure is attached to [PR #69](https://github.com/MysteryOrganization173/MYSTERY-HUB/pull/69#issuecomment-6711476631). Run it once in the existing backend service Shell, using only its existing environment; it sends allowlisted GETs, prints no key/customer information and never submits or reconciles orders. Return only the sanitized JSON. Do not rotate keys or redeploy for this check. The Admin commercial-readiness workspace can provide fresh permission/catalogue evidence once deployed, but cannot establish an undocumented purchase contract or authorize activation.

Use `npm test -- server/suppliers/__tests__/resultsCheckers.test.ts`, the opt-in `resultsCheckersPostgres.test.ts` against an empty loopback `_test` database, and `npm run build && python scripts/reviewResultsCheckers.py`. Browser fixtures contain synthetic PINs only. `CHECKER_REVIEW_BASE_SHA` reproduces the original logout defect. Rollback is a normal code revert while the commercial flag remains off; no data migration is required or authorized.
