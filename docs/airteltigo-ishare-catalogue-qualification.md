# AirtelTigo iShare catalogue qualification

The November 27, 2026 authenticated production SBH diagnostic (13:07 UTC) confirmed permission to create data orders, standard Data service availability and one exact package for every requested AirtelTigo size under `ishare_data_bundle`. All 18 supplier costs matched the dealer catalogue. The founder approved the additional 13 prices after that comparison.

The API did not report package or offer availability or validity for these plans. It likewise omits those fields for the five existing AirtelTigo sizes and the current Telecel sizes. Catalogue inclusion proves account-specific package mapping. Checkout requires current orders permission, service availability, exact offer and size, recipient eligibility, and enough available SBH wallet funds for the current cost. Explicitly unavailable or disabled offers and packages are rejected. This preflight does not reserve supplier funds. At dispatch, the existing checks retain the supplier, offer and cost snapshot.

## Approved prices

The table records costs observed on November 27. Checkout obtains the current cost from SBH and the server sets the customer price. Gross spreads exclude fees, reserve, Welcome and referral expense.

| Size | Dealer cost (GH₵) | Retail (GH₵) | Gross spread (GH₵) | Gross % | Status |
|---:|---:|---:|---:|---:|---|
| 1 GB | 3.90 | 4.99 | 1.09 | 21.8% | Existing |
| 2 GB | 7.80 | 9.49 | 1.69 | 17.8% | Existing |
| 3 GB | 11.70 | 13.99 | 2.29 | 16.4% | Existing |
| 4 GB | 15.60 | 18.49 | 2.89 | 15.6% | Existing |
| 5 GB | 19.50 | 22.99 | 3.49 | 15.2% | Existing |
| 6 GB | 23.40 | 27.49 | 4.09 | 14.9% | Approved |
| 7 GB | 27.30 | 31.99 | 4.69 | 14.7% | Approved |
| 8 GB | 31.20 | 36.49 | 5.29 | 14.5% | Approved |
| 9 GB | 35.10 | 40.99 | 5.89 | 14.4% | Approved |
| 10 GB | 39.00 | 45.49 | 6.49 | 14.3% | Approved |
| 12 GB | 46.80 | 54.49 | 7.69 | 14.1% | Approved |
| 15 GB | 58.50 | 67.99 | 9.49 | 14.0% | Approved |
| 20 GB | 78.00 | 90.49 | 12.49 | 13.8% | Approved |
| 25 GB | 97.50 | 112.99 | 15.49 | 13.7% | Approved |
| 30 GB | 117.00 | 135.49 | 18.49 | 13.6% | Approved |
| 40 GB | 156.00 | 180.49 | 24.49 | 13.6% | Approved |
| 50 GB | 195.00 | 225.49 | 30.49 | 13.5% | Approved |
| 100 GB | 390.00 | 450.49 | 60.49 | 13.4% | Approved |

## Economics and validity

The production check on November 27 found no direct price overrides. The Welcome discount is GH₵1.00 for an eligible customer. Data economics uses a configured zero processing reserve, a 45% acquisition reward based on the regular margin, and a 20% recurring reward for eligible referrals. At Paystack’s published Ghana rate of 1.95%, the estimated Welcome-plus-acquisition contribution on 6 GB is GH₵0.73, rising to GH₵11.39 for 50 GB and GH₵22.50 for 100 GB. These are estimates using the observed costs and the published fee. The account’s actual fees may differ. [Paystack Ghana pricing](https://paystack.com/gh/pricing)

The 50 GB and 100 GB orders need at least GH₵195.00 and GH₵390.00 respectively in available SBH funds at the observed costs. The authenticated catalogue diagnostic did not measure wallet funds. Both Paystack and Wallet paths enforce the preflight before accepting a new payment.

The portal says 60 days and legacy app metadata says 30 days for 1–5 GB. The API confirms neither. The 13 additions omit expiry wording and the existing five keep their prior behavior. Verify the supplier’s expiry contract before presenting an expiry for the new sizes.

## Recheck the supplier catalogue

From the authorized Render backend shell, run the existing read-only probe using the configured supplier credentials.

```bash
node --import tsx scripts/sbh-data-catalogue-readonly.ts
```

The probe uses signed-in account readiness and catalogue reads only. It reports warning-level evidence gaps for absent optional availability and validity, even when it can verify exact size and price. A nonzero exit should be reviewed alongside its reason codes. Share only its sanitized JSON.

## Rollout scope

- Ordinary and Christmas storefronts use the same server catalogue. The 13 additions appear through that catalogue. The browser fallback still contains the original five AirtelTigo sizes.
- Direct quotes and Admin Commercial Pricing use the approved prices. Historical order, receipt, offer, cost and payment snapshots are preserved. The current December campaign never auto-selects a new product.
- Managed reseller checkout stays disabled. The release installs no reseller wholesale or storefront prices and requires no production migration or environment change.

## Other networks

MTN Express has 13 canonical sizes in main: 1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30 and 40 GB. The live retail response omitted all MTN products while the network is paused, including the December draft products. Telecel has eight active canonical sizes: 10, 15, 20, 25, 30, 40, 50 and 100 GB. Definitions remain unchanged. The read-only authenticated probe compares each network's app definitions against exact supplier sizes and identifies additional supplier entries for a separate review. There is no live API evidence for an MTN or Telecel addition in this assignment.
