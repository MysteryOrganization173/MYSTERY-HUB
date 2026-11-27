# AirtelTigo iShare catalogue qualification

The November 27 public catalogue on main `6f0c67126235961841e2823a6acc92a462760003` returned 1–5 GB at GH₵4.99, 9.49, 13.99, 18.49 and 22.99. The server sends 30 days for those rows. The current bundled buyer cards say Direct Credit, a routing label that the validity presenter hides. The founder's SBH dealer portal says 60 days. There was no authenticated API response or written supplier confirmation to resolve the discrepancy. Preserve those five prices and existing validity behavior. The 13 proposed IDs stay off sale and carry no validity claim. SBH remains the only executable supplier.

## Price approval

Portal cost reflects the founder's November 27 dealer evidence. Live costs remain the exact authenticated supplier quote used by the existing checkout and economics paths. These illustrative gross spreads exclude fees, the processing reserve, Welcome discount and referral expense. Gross percentage uses retail as the denominator. Check approved economics and float per offer before activation, particularly for the largest plans.

| Size | Dealer cost (GH₵) | Retail (GH₵) | Gross spread (GH₵) | Gross % | Status |
|---:|---:|---:|---:|---:|---|
| 1 GB | 3.90 | 4.99 | 1.09 | 21.8% | Existing |
| 2 GB | 7.80 | 9.49 | 1.69 | 17.8% | Existing |
| 3 GB | 11.70 | 13.99 | 2.29 | 16.4% | Existing |
| 4 GB | 15.60 | 18.49 | 2.89 | 15.6% | Existing |
| 5 GB | 19.50 | 22.99 | 3.49 | 15.2% | Existing |
| 6 GB | 23.40 | 27.49 | 4.09 | 14.9% | Proposed |
| 7 GB | 27.30 | 31.99 | 4.69 | 14.7% | Proposed |
| 8 GB | 31.20 | 36.49 | 5.29 | 14.5% | Proposed |
| 9 GB | 35.10 | 40.99 | 5.89 | 14.4% | Proposed |
| 10 GB | 39.00 | 45.49 | 6.49 | 14.3% | Proposed |
| 12 GB | 46.80 | 54.49 | 7.69 | 14.1% | Proposed |
| 15 GB | 58.50 | 67.99 | 9.49 | 14.0% | Proposed |
| 20 GB | 78.00 | 90.49 | 12.49 | 13.8% | Proposed |
| 25 GB | 97.50 | 112.99 | 15.49 | 13.7% | Proposed |
| 30 GB | 117.00 | 135.49 | 18.49 | 13.6% | Proposed |
| 40 GB | 156.00 | 180.49 | 24.49 | 13.6% | Proposed |
| 50 GB | 195.00 | 225.49 | 30.49 | 13.5% | Proposed |
| 100 GB | 390.00 | 450.49 | 60.49 | 13.4% | Proposed |

## Supplier evidence to collect

In the authorized Render backend shell, use the existing backend's configured SBH key. Check out this exact candidate or run the reviewed script from this branch. The script uses the existing pinned HTTPS readiness transport for only `GET /services` and `GET /catalog`, with no redirects or retries. It halts before catalogue retrieval when the `orders` permission, entitlement or explicit service availability is absent. It outputs only size, offer selector, package identifier if present, positive cost, structured validity and status evidence. Do not paste or export an API key, raw response, client identity or unrelated environment variables.

```bash
node --import tsx scripts/sbh-data-catalogue-readonly.ts
```

The cloud runner had no authorized supplier credential or Render shell. Treat ambiguous offers, repeated normalized sizes, disabled packages, missing selectors, absent validity, conflicting flags and an unclear iShare family as a review requirement. Record the exact account-specific offer identifier (slug or ID), every exact package identification, its priceMinor and availability, and authoritative validity before making a claim. If the supplier does not provide validity in the API, obtain explicit confirmation for that same offer, including how pack expiry works for sizes 1–5 GB. Portal wording alone is insufficient.

## Dependencies and rollout

- Canonical definitions for at-6gb, at-7gb, at-8gb, at-9gb, at-10gb, at-12gb, at-15gb, at-20gb, at-25gb, at-30gb, at-40gb, at-50gb and at-100gb have isActive false. They are excluded from public catalogue, lookup, checkout and reorder targets, reseller pricing and December inputs. Stock Commercial Pricing shows a read-only proposed list. Static browser fallback remains the five current plans.
- The normal and Christmas Data Store share the server catalogue. A server-only plan receives exact size filter metadata and only the server's supplied validity. Historical order size, payment, offer/cost and receipt snapshots remain authoritative. Neither the existing Welcome rule nor the MTN-only December draft changes. Even a later approved AirtelTigo sale will require separate campaign selection and economics review before a December discount.
- Site catalogue and reseller wholesale/retail remain separate. When qualifying direct sales, review whether reseller inclusion is intended. Keep `MANAGED_DATA_STOREFRONT_CHECKOUT_ENABLED` off and keep unrelated payment controls and Service Control restrictions in place.
- After evidence and founder approval, make a small reviewed release with only the qualified sizes active, prices explicitly promoted from proposal to approved seed, verified validity, and per-product verification of the SBH route. Check Service Control, current processing reserve, Welcome/referral exposure and supplier float. Any real provider test requires separate approval.

## Other networks

MTN Express has 13 canonical sizes in main: 1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30 and 40 GB. The live retail response omitted all MTN products while the network is paused, including the December draft products. Telecel has eight active canonical sizes: 10, 15, 20, 25, 30, 40, 50 and 100 GB. Definitions remain unchanged. The read-only authenticated probe compares each network's app definitions against exact supplier sizes and identifies additional supplier entries for a separate review. There is no live API evidence for an MTN or Telecel addition in this assignment.
