# AFA Registration: commercial quote and the December price

**Status: built, switched off.** Merging this changes no AFA price. While the promotion is off, AFA customers pay exactly the `AFA_RETAIL_PRICE_MINOR` server setting, as before. The GH₵19.99 December price applies only after an Admin records a contractual supplier cost and enables it with a typed confirmation.

## Price authority

- **Standard price:** the existing `AFA_RETAIL_PRICE_MINOR` server setting. There is no second standard price. If the setting differs from the approved GH₵29.99, Admin shows both.
- **Promotional price:** `afa-pricing` in the existing commercial settings (`finance_config`), read through `CommercialService`. It only ever lowers the price, and only when **all** of these hold:
  - the AFA promotion is enabled in Admin;
  - today's Accra date (server clock) is within its dates;
  - the price is below the standard price;
  - an Admin-confirmed contractual supplier cost exists and the price covers it.
- **Fail closed:** if anything is missing, malformed, or the cost is later re-confirmed above the price, customers pay the standard price.
- **Shipped draft:** off; 1 December 2026 to 4 January 2027; GH₵19.99; no cost.

## Quote and review

`GET /api/afa/quote` returns:
- the existing availability fields;
- `standardMinor`, `totalMinor` and `pricingRevision`;
- `campaign` and `savingMinor`, only while the promotion applies;
- `welcomeApplies: false`.

The pricing revision includes the standard price, so a changed server setting is a changed quote. `/api/afa/config` is unchanged.

The registration page shows:
- **Off:** the one-time fee, as before.
- **Promotion applies:** Regular price ~~GH₵29.99~~, December Special GH₵19.99, Total GH₵19.99, You save GH₵10.00.
- **Always:** a short line saying the registration fee is one-time, MTN AFA packages are bought separately from MTN, and data welcome benefits don't apply.

## Payment protection

Both payment paths send the reviewed `expectedTotalMinor` and `pricingRevision`.

- **Paystack:** the quote is checked before the order is written. It is checked **again after** the order is written and before Paystack is called. If it changed in between, the unpaid order is cancelled (releasing the number's duplicate block) and nothing is sent to Paystack.
- **Wallet:** the price is re-read inside the Wallet transaction, under the commercial policy lock that Admin saves take exclusively. A change throws before any debit, order or registration row is written. Idempotent retries return the same order and debit once.
- **On a mismatch:** the response is `409 AFA_REVIEW_REQUIRED` with the current quote. The page shows "The registration fee changed from X to Y. Nothing was charged." above the Pay button, which now names the new amount.
- **Pages from before this release** (no expected fields) can still pay, but **only the standard price**. A promotional price must always have been reviewed.
- **Deploy order is safe either way.** The page and API deploy separately:
  - A new page against an older API (where `/quote` returns 404) falls back to `/config` and pays the standard price with no revision.
  - An old page against the new API pays the standard price as before.
- **Paid orders:** promotional sales store an immutable snapshot (standard price, promotional price, revision) that reconciliation accepts. Orders at the standard price are written exactly as before.
- **Unchanged:** Ghana Card encryption, the supplier payload, the submission latch, status reconciliation, duplicate registration blocking, and Paystack metadata.

## Supplier cost: why it is Admin-confirmed

The integrated Success Biz Hub AFA contract exposes no pre-purchase cost:
- `GET /services` returns availability and permission only;
- the cost (`priceMinor`) arrives in the `POST /afa` response, **after** the customer has paid.

No undocumented endpoint was called, and the live supplier was not contacted. A post-submission cost is not used as proof.

So enabling requires an **Admin-confirmed contractual cost**:
- the cost in pesewas;
- written evidence (agreement, written quote or invoice; 10–300 characters);
- the typed `confirm-afa-cost`.

The record is stored with the Admin and time and is audited (`commercial_afa_cost_confirmed`). The historical GH₵12.00 is shown only as a reference and never counts as confirmed. A confirmation older than **30 days** cannot be used to enable the promotion.

## Admin controls (Commercial Pricing → AFA Registration pricing)

The panel shows:
- the standard price;
- the December price and discount percentage;
- what customers pay now;
- the state (off, scheduled, within dates, ended);
- the dates;
- supplier availability;
- the confirmed cost with its evidence and age;
- estimated contribution;
- the blockers.

Enabling requires the typed `afa-december-specials-2026` and all of these:
- complete dates that have not passed;
- a price below the standard price that covers a fresh confirmed cost;
- AFA currently available from the supplier.

Every change is audited (`commercial_afa_campaign_changed`). Turning it off restores the standard price immediately. Changing a date or deploying never enables it.

## "Up to 33% off"

- **When it appears:** the public catalogue headline includes AFA's saving only while the AFA December price **applies and AFA can be bought**. GH₵10 off GH₵29.99 is 33.34%, shown as **33%** (never rounded up).
- **Otherwise:** the headline stays the Data figure (14%) or doesn't appear at all.
- **No dormant claims:** a dormant proposal or a confirmed cost alone never produces it.
- **Christmas homepage:** the composition is unchanged; only the existing server-driven eyebrow line uses the figure.

## Before the AFA December price can be enabled

1. Obtain a current written AFA cost from the supplier and record it in Admin, within 30 days of enabling.
2. Confirm `AFA_RETAIL_PRICE_MINOR` is the intended standard price (approved GH₵29.99).
3. Confirm AFA is available from the supplier in Admin.
4. Enable in Admin with the typed confirmation.

## Verification

**Tests:**
- `afaCommercial.test.ts`: 23 tests, covering:
  - ordinary AFA unchanged;
  - shipped off;
  - scheduled, first second, last second, expired;
  - active GH₵19.99 with exact Paystack amount and snapshot;
  - unknown, insufficient or malformed cost;
  - supplier unavailable;
  - stale and unreviewed quotes, including old pages;
  - a change after the order is written (cancelled before Paystack, number released);
  - Wallet exact debit, a change inside the transaction (no debit), and idempotent retry;
  - duplicate registration, verified dispatch once, uncertainty latched;
  - wrong Paystack amount never dispatches;
  - paid orders unchanged after the promotion ends;
  - no welcome benefit on AFA;
  - the 33% headline rules;
  - Admin RBAC, typed confirmations, evidence, cost freshness, cost changing before activation, enable/disable, audit;
  - malformed settings;
  - the deploy-order fallback.
- The 137 existing AFA tests pass. Two source pins were updated to the new call shape.
- One finance fixture now sets `AFA_RETAIL_PRICE_MINOR` next to its `publicConfig` mock, as production always does.

**Native PostgreSQL 16** (`afaCommercialPostgres.test.ts`, also added to the database CI workflow):
- off-state parity;
- audited cost confirmation and activation;
- a reviewed 1999 Paystack order with an immutable snapshot and no reconciliation conflict;
- stale or unreviewed fees writing no order, registration, debit or Paystack call;
- a Wallet debit of exactly −1999, once.

**Browser checks (local):** 11 of 11 at 320, 360 and 390 px, covering the off and promotional states, a real strike-through with a spoken label, no horizontal overflow, the reviewed values sent on submit, and the changed-fee notice. Quotes were generated by the real service with a mocked supplier; payment initialisation was intercepted.
