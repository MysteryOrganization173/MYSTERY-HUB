# December Specials 2026: pricing, welcome offer and checkout

**Status: shipped switched off.** Merging this changes no live price. The December prices exist only as a disabled server setting; an Admin must type the campaign name to enable them, with confirmed dates, and only prices that cover a known supplier cost can be enabled. Baseline: `main` at `6e9d9b1` (PR #111 merged).

## What exists, and what was added

**Before this change** (`CommercialService`): Admin-managed standard retail (`direct-pricing`), a one-time GH₵1 welcome benefit (`welcome-offer`), server quotes, and revision checks before payment.
- The welcome benefit applies to direct Data only and needs a unique account phone. It goes through reserve → redeem/release.
- Each quote has `regularMinor`, `discountMinor`, `totalMinor`, `pricingRevision` and `promotionRevision`.
- Wallet and Paystack both re-quote inside the financial transaction.
- Each order stores an immutable `commercial_context` snapshot, and payment checks the exact pesewas.

**Added:** one dated layer (`shared/directCampaign.ts`, config key `direct-campaign`).
- A campaign price applies only while the campaign is enabled and today's **Accra** date (on the server clock) is between its first and last day, inclusive.
- Nothing from the browser is read: no URL, preview, client field or device time.
- Malformed or incomplete settings fail closed to the standard price. A campaign never raises a price.
- **Shipped draft (finalized 13 November 2026, still off):**
  - First day: 1 December 2026, 00:00 Accra.
  - Last day: **4 January 2027**, inclusive. Normal prices return at 00:00 Accra on 5 January, while the New Year appearance runs through 5 January.
  - MTN 1GB GH₵4.99 · 2GB GH₵8.99 · 3GB GH₵13.39 · 4GB GH₵17.79 · 5GB GH₵21.99. No other product is included.
- **While it applies:**
  - `regularMinor` keeps its meaning: the price the product sells for now, before the welcome benefit. The reconciliation and referral invariant `regularMinor − discountMinor = amount` is unchanged.
  - New fields appear only on campaign quotes and orders: `standardMinor` (price before the campaign), `campaignSavingMinor`, and `campaign`. Orders also get `priceCampaignId` and `priceCampaignRevision`.
  - The campaign revision is appended to `pricingRevision`, so a quote from before a start, end or change is refused at payment ("review the details and refresh"). Nothing is silently re-priced.
  - Inactive responses are byte-identical to before. It was verified against the live production catalogue.
- **Stacking:** `stacksWithWelcome: true` for December. A future limited deal can set it to `false` rather than stacking automatically.
- **No changes to:** schema, migrations, supplier routing, Paystack, Wallet, authentication, referral rules, reseller stores or AFA checkout.

## Finalized plan: shipped draft vs saved settings

The approved plan is `DECEMBER_2026_APPROVED_PLAN` in `shared/directCampaign.ts`. The shipped draft (`DIRECT_CAMPAIGN_DEFAULT`, revision `december-2026-inactive-v2`) equals it and is **disabled**.

- **Nothing saved in Admin yet** (Admin says "Using the shipped draft"): the deploy itself stages the approved plan. It stays off.
- **A campaign was already saved:** the saved settings stay authoritative, and a deploy never migrates them.
  - Admin lists every difference from the approved plan.
  - **Load the approved plan into the form** fills the dates and five prices. Then choose **Save as draft**; prices stay standard.
  - A saved list is never extended silently: an enabled older two-product campaign still applies only its own two products.
- **Stale Admin pages:** the new revision makes any Admin page opened before this deploy refresh before saving.
- **Before enabling:** Admin must read a known cost for each product from the supplier that would fulfil it today (the routed supplier, currently Success Biz Hub). TELCOGH is not executable and is never used for this. An unknown cost or a price below cost keeps the Enable blocker.

## Welcome benefit: verified stacking

| | Standard | December | Welcome | **First purchase** | Saving |
|---|---:|---:|---:|---:|---:|
| MTN 1GB | 5.49 | 4.99 | −1.00 | **3.99** | 1.50 |
| MTN 2GB | 10.49 | 8.99 | −1.00 | **7.99** | 2.50 |
| MTN 3GB | 14.99 | 13.39 | −1.00 | **12.39** | 2.60 |
| MTN 4GB | 19.49 | 17.79 | −1.00 | **16.79** | 2.70 |
| MTN 5GB | 23.99 | 21.99 | −1.00 | **20.99** | 3.00 |

These are examples. A customer gets the GH₵1 benefit once, on whichever qualifying bundle they buy first.

All amounts are integer pesewas. The existing lifecycle is unchanged and was re-tested under the campaign:
- The first qualifying bundle consumes the benefit. If MTN 2GB is bought first, a later MTN 1GB costs 4.99.
- Account creation alone is not a purchase.
- No phone, a duplicate phone, or a phone claimed by another account means the December price only.
- A pending payment holds the benefit. A verified failure releases it. An unverified, uncertain or browser-only outcome does not.
- Delivery redeems it. A full refund restores it once; a refund under review does not.
- Concurrent tabs and Wallet+Paystack use it once.
- The referral acquisition subsidy is recognised once. The next purchase is recurring.

## Checkout: why GH₵4.99 appeared unexplained, and the fix

This was reproduced locally (`docs/screenshots/december-specials/1-checkout-before-after.jpg`). The founder's exact account state is unknown, but each of these causes shows a price without its explanation:

1. **The largest price in checkout was not the price being paid.** The summary card showed the card's catalogue price (GH₵4.99 for AirtelTigo 1GB). The confirmed total (GH₵3.99) and its explanation were further down, often below the fold on a phone.
2. **Unconfirmed totals looked confirmed.** While the quote loaded, or after it failed, the card price showed as "Total" and "Pay GH₵…". For an eligible customer, rows then appeared and the total jumped.
3. **No reason was given for a missing saving.** A benefit held by a pending payment looked exactly like a regular price.
4. "Welcome Offer" did not say it applies once.

**Now:**
- The summary card and Total show only the server-confirmed total, with the standard price crossed out.
- Until the quote is confirmed, both read "Checking price…" (or "Not confirmed" with Retry), and Pay carries no amount.
- **Rows:**
  - Regular price, crossed out, with a spoken label.
  - December Special.
  - First-order welcome benefit.
  - Total.
  - You save.
- **Notes:**
  - Eligible: "Your GH₵1 welcome benefit applies to your first qualifying purchase only."
  - Reserved: says the benefit is held.
  - Returning customers: nothing.
- If a refreshed quote differs, checkout says "The total changed from X to Y. Review it before paying."
- Checkout now also sends `expectedStandardMinor`.
- It is one checkout for ordinary and Christmas journeys, guest and member, Wallet and Paystack. Payment authorisation is unchanged.

**Elsewhere:**
- **Catalogue rows** (Data page, homepage and Christmas tray) show one price: the first-order price for eligible accounts, otherwise the December Special with the standard price crossed out. Reseller-themed cards, Instant and Airtime never show campaign prices.
- **Orders** compute the saving from the order's own snapshot (`standardMinor ?? regularMinor` − paid), never from today's prices.

## Advertising

- **Campaign headline:** Christmas data-tray eyebrow, only while the server applies the campaign: "December Specials · Up to N% off selected digital services". N is the server's floor of the largest applied saving. Today that would be **14%** (MTN 2GB), not 33%: AFA is not applied, so no 33% claim can appear.
- **Welcome card:** the headline previously skipped any bundle above the 18% ceiling. In December (GH₵1 off GH₵4.99 is 20%) it would have collapsed to about 11%. It now caps at the approved 18%: still truthful, never above approval. Raising the ceiling, for example to "up to 27%" (combined first-order saving on MTN 1GB against GH₵5.49), is a founder decision. No worked example was reintroduced.

## Proposed December matrix (GH₵)

**Cost basis:**
- No live supplier cost could be read from this environment.
- SBH = founder reference cost from `commercial-pricing-review.csv`. TELCOGH = historical account-tier quote. Neither is confirmed.
- Fee = **estimate** at 1.95% (no fee policy is configured in code; Admin uses the configured direct reserve).
- "Net" = price − cost − fee.

| SKU | Standard | Historical Dec | Recommended Dec | Saving | GH₵/GB | Est. fee | Net repeat SBH / TELCOGH | First purchase | Net first SBH / TELCOGH | Status |
|---|---:|---:|---:|---|---:|---:|---|---:|---|---|
| MTN 1GB | 5.49 | 4.99 | **4.99** | 0.50 (9.1%) | 4.99 | 0.10 | 0.89 / 0.99 | 3.99 | −0.09 / +0.01 | Approved, configured (off) |
| MTN 2GB | 10.49 | 8.99 | **8.99** | 1.50 (14.3%) | 4.50 | 0.18 | 0.81 / 1.01 | 7.99 | −0.17 / +0.03 | Approved, configured (off) |
| MTN 3GB | 14.99 | 13.99 | **13.39** | 1.60 (10.7%) | 4.46 | 0.26 | 1.13 / 1.43 | 12.39 | 0.15 / 0.45 | Approved 13 Nov, configured (off) |
| MTN 4GB | 19.49 | — | **17.79** | 1.70 (8.7%) | 4.45 | 0.35 | 1.44 / n/a | 16.79 | 0.46 / n/a | Approved 13 Nov, configured (off) |
| MTN 5GB | 23.99 | 23.49 | **21.99** | 2.00 (8.3%) | 4.40 | 0.43 | 1.56 / 2.06 | 20.99 | 0.58 / 1.08 | Approved 13 Nov, configured (off) |
| AFA Registration | 29.99 | 19.99 | 19.99 | 10.00 (33.3%) | — | 0.39 | 7.60 vs historical 12.00 | — (excluded) | — | Blocked (below) |

**Why the provisional 3GB/5GB figures are not recommended:**
- At 13.99, 3GB (4.66/GB) costs more than 1GB + 2GB in December (13.98).
- At 23.49, 5GB (4.70/GB) costs more than 2GB + 3GB (22.98).
- The recommendations keep the price per GB falling as size grows, undercut every smaller combination, and increase net contribution with size: 1.13 → 1.44 → 1.56 on SBH reference costs.

**Under SBH costs, 2GB at 8.99 earns no more than 1GB** (0.81 vs 0.89). That is acceptable for an acquisition price, but worth knowing.

**Untouched standard sizes become poorer value than combinations of December bundles:**
- 4GB at 19.49 vs 2 × 2GB = 17.98, hence the 4GB proposal.
- With all five approved prices, **every larger standard MTN bundle** costs more than the same data in December bundles. Admin lists these live as "Worse value than smaller December bundles":

| Standard bundle | Price | Cheapest December combination |
|---|---:|---|
| 6GB | 28.49 | 2GB + 4GB = 26.78 |
| 8GB | 36.99 | 3GB + 5GB = 35.38 |
| 10GB | 44.99 | 2 × 5GB = 43.98 |
| 15GB | 66.99 | 3 × 5GB = 65.97 |
| 20GB | 88.99 | 4 × 5GB = 87.96 |
| 25GB | 110.99 | 5 × 5GB = 109.95 |
| 30GB | 132.99 | 6 × 5GB = 131.94 |
| 40GB | 176.99 | 8 × 5GB = 175.92 |

The cause is the 5GB at 4.40/GB. The gaps are small (GH₵1.01–1.71) and each extra bundle is a separate, sequential MTN order. The campaign was not extended to 6GB or larger.

MTN blocks a second active order for the same number, so combining is sequential, not simultaneous. The founder should decide whether to extend the campaign or accept this.

**First-purchase economics:**
- On the SBH reference cost (4.00), the 3.99 first purchase is about **−GH₵0.09 per new customer** after the estimated fee. With a referrer and the fixed 0.50 acquisition reward it is about **−0.59**.
- On TELCOGH's historical 3.90 it is about +0.01 / −0.49. TELCOGH is registered but cannot take orders (PR #111), so SBH costs apply in December.
- The existing guard is unchanged: checkout refuses when the **December price** is below the current supplier cost.
- The welcome benefit may take a sale below cost. That subsidy is intentional (as before), bounded to GH₵1, once per unique phone.
- Admin shows it as an acquisition subsidy. No minimum blocks the agreed 3.99.

**The founder's GH₵4.79 and GH₵8.80:**
- 4.79 matches the pre-launch AirtelTigo 1GB price (`commercial-pricing-review.csv`).
- 8.80 matches nothing in the repository history.
- Neither was assumed.

## AFA Registration: blocked (prepared only)

AFA is live at GH₵29.99. The proposed December price of GH₵19.99 (33.34% off) is recorded in `AFA_DECEMBER_PROPOSAL` and shown in Admin, but applied nowhere. Three things block it:
1. **AFA prices outside the commercial system.** The price comes from the `AFA_RETAIL_PRICE_MINOR` server setting, outside commercial quotes and revisions.
2. **No authoritative pre-purchase cost.** The supplier reports cost only after submission. The historical 12.00 is unverified.
3. **No review step.** AFA checkout has no expected-total step that would refuse a stale price.

**To unblock:** move AFA pricing into `CommercialService` with a quote, revision and expected-total check, and confirm the supplier cost. Until then the "up to 33%" headline cannot appear: it is computed only from applied prices.

## Referral and reseller interactions

- **Referral basis:** referral rewards use the snapshot's `regularMinor`, which is now the December price. December therefore lowers margin-based rewards. It cannot inflate them.
- **Acquisition subsidy:** still once per relationship. The fixed policy pays 0.50 acquisition and 0.10 recurring. The dynamic policy pays 50% of normal margin, about 0.45 on MTN 1GB at the SBH cost.
- **Data Stores:** they do not read the campaign. Owner retail, wholesale, safe floors and the "recommended reseller retail" (which reads standard `direct-pricing`) are unchanged.
- **Reseller gallery demo:** it lists Mystery Hub catalogue prices as labelled examples, so it would show December prices for MTN 1GB/2GB. This is display only, with no checkout.
- **Admin-assisted orders:** these use the effective catalogue price, so they would use December prices while the campaign is active.
- **Offer bundles (24–72 h):** no such service exists in the code. Nothing was activated, and no copy claims instant delivery.

## Before 1 December: what remains for the founder

**Decided on 13 November and staged:** dates 1 December to 4 January, the five MTN prices, and no extension to 6GB+.

**Still open:**
1. **Check Admin → Commercial Pricing → December Specials.**
   - If it says the settings differ from the approved plan, choose **Load the approved plan into the form**, then **Save as draft**.
   - If it says "Using the shipped draft", nothing is needed.
2. **Confirm live supplier costs** for the five products in Admin. Each December price must cover the routed supplier's cost, or Enable is refused. The figures in the matrix above are reference costs, not live costs.
3. **Configure the direct processing reserve** if it has not been set, so contributions are not "unknown".
4. **Accept the first-purchase economics** that Admin shows. On reference costs, 1GB and 2GB first purchases lose a few pesewas, more with a referral reward.
5. **Accept the value inversion** for 6GB–40GB (table above), or approve further prices.
6. **Enable when ready:** type `december-specials-2026` and choose **Enable December prices**.
   - It stays scheduled, with standard prices, until 00:00 Accra on 1 December.
   - It ends automatically after 4 January. An open page refreshes its prices at the boundary.
   - **Turn off December prices** restores standard prices immediately.
   - Every change is audited.

## Verification

**Unit and integration tests:**
- `decemberCampaign.test.ts`: 44 tests covering:
  - pricing at every boundary, Accra time, fail-closed settings, no price rises, disabled and unknown products, prototype keys, AFA and Instant excluded;
  - exact 549/499/399 and 1049/899/799;
  - Paystack and Wallet amounts and the snapshot;
  - the welcome lifecycle and referrals under the campaign;
  - stale quotes across start, end and change;
  - eligibility loss and below-cost refusal;
  - historical orders;
  - the Admin confirmation, dates, cost, audit and RBAC;
  - all five approved prices with their first-purchase totals and one benefit;
  - 4 January 23:59:59 versus 5 January 00:00;
  - the shipped draft versus saved settings;
  - routed-supplier costs, value warnings and referral exposure.
- `decemberPresentation.test.ts`: 15 tests, including the boundary refresh clearing every December field.
  - This test found and fixed a bug from PR #112: campaign fields outlived the campaign in the shared bundle list.
- One mocked-PostgreSQL boundary test.

**Native PostgreSQL 16** (disposable local cluster, non-superuser owner):
- `decemberCampaignPostgres.test.ts`, also added to the database CI workflow, covers:
  - the real engine prices exactly as before while off;
  - activation and its audit commit atomically, and a stale revision is refused;
  - the 399 order, snapshot and welcome reservation commit before Paystack;
  - the immutability trigger refuses snapshot edits;
  - reconciliation reports no snapshot conflict;
  - a stale quote writes nothing.
- The existing supplier routing, checkout recovery and finance reconciliation native suites pass too: 99 of 99 in total.

**Full suite:** 3415 tests, 3366 pass, 0 fail. The 49 skips are native-PostgreSQL suites with no database configured; the relevant ones were run above. TypeScript and the production build pass. The ordinary first load is unchanged (index 73.66 KB gzip).

**Browser checks** (`localhost`, new server code): 18 of 18.
- The campaign is off by default, and the catalogue and guest quotes are byte-identical to production.
- Loading and error states show no amounts.
- A real new local account gets 4.49.
- The Christmas preview does not change prices.
- December guest, eligible (360×740 and 320×568), returning and reserved states all display correctly.
- MTN 2GB first purchase is 7.99.
- A changed price is refused and reviewed.
- The Christmas tray headline reads 14%, and the welcome card reads 18%.
- The Admin panel renders, and Enable stays locked until the campaign name is typed.

The "active" checks use responses generated by the real `CommercialService` under a December clock. No payment was started and no supplier was contacted.
