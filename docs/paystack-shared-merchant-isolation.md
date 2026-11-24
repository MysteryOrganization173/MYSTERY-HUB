# Shared Paystack merchant isolation

The shared Mystery Hub Paystack integration accepts new orders for the main Data store’s standard bundles, instant bundles and airtime. Existing Wallet funds may still be used for eligible regular data and airtime purchases. Airtime is retained as part of the existing telecommunications offering while merchant scope is under review.

Marketplace and Creative Studio retain enquiry workflows. The free Website Builder retains editing, previews and publishing. Published merchant sites show their catalogues and track previous orders. New online payments for AFA, results checkers, Wallet funding, merchant storefronts and Website Builder upgrades are unavailable. Creative Studio and Website Builder paid tiers have no payment initializer. The integration has no alternate credentials or automatic fallback for any of these services.

The server blocks direct requests and saved checkout-link replays for disconnected services. The shared adapter independently looks up the persisted order and requires the main telecom service, exact reference namespace, product evidence, pending Paystack status, exact integer-pesewa amount and receipt email. It rejects storefront and Marketplace context before making a request to Paystack. Payment verification, the signed callback, existing refund and reconciliation paths, history and entitlements remain available. A checkout URL already issued by Paystack before the release may still be usable on Paystack’s site. Existing obligations remain supported if one of those payments succeeds.

## Historical transaction evidence

Use an authorized local copy of the verified application database and the founder’s original Paystack transaction CSV. This procedure requires no production writes. Keep both files on an access-controlled encrypted machine. Never attach row-level files, credentials, references, or receipt details to a PR or email. The preliminary 657 transactions and reported GH₵8,261.03 gross, GH₵163.99 fees and GH₵8,097.04 net await exact reconciliation.

1. Filter the Paystack export to the chosen date range, GHS, Mobile Money and successful transactions. Do this with the original export unchanged. Preserve the exact `Reference` as text, and take the payment amount from the gross column. Remove columns for recipient, email, phone and names from the working copy.
2. In `psql` connected to the local copy with a read-only role, run the following export to a private directory. The relative filename is on the computer running `psql`.

```sql
BEGIN READ ONLY;
\copy (SELECT payment_reference AS reference, amount AS amount_minor, payment_status AS status, CASE WHEN store_context IS NOT NULL OR payment_reference LIKE 'MH\_STORE\_%' ESCAPE '\' THEN 'storefront_' || COALESCE(service_type, 'unknown') WHEN service_type IS NULL THEN 'unknown' ELSE service_type END AS category, product_id AS product FROM orders WHERE payment_provider='paystack' UNION ALL SELECT payload->>'reference', amount_minor, state, 'wallet_funding', '' FROM finance_operations WHERE kind='topup' AND payload->>'reference' IS NOT NULL) TO 'application-payments.csv' CSV HEADER
ROLLBACK;
```

3. Import both CSV files into a local spreadsheet or use a local Python `csv` script. Group each side by exact reference before joining. Count Paystack and application duplicates separately and put those references in an exception bucket before the join so that a many-to-many match cannot inflate results. Keep blank references separate as invalid. For each remaining Paystack row, look up its reference against the application export. Report missing matches separately.
4. Convert the Paystack gross amount to integer pesewas using decimal arithmetic and compare it to `amount_minor`. For an order, compare Paystack success with `payment_status = success`. For a Wallet funding entry, use `credited` as recorded credit and flag `reversed` or `reversal_review` for historical reconciliation. Report size and status discrepancies separately. A refunded or subsequently reversed charge can still have a successful original transaction. If a service classification is missing, retain `unknown` for review. `storefront_data` stays separate from main `data`. A Wallet top-up belongs to `wallet_funding`. Subsequent Wallet-funded orders do not appear in this export.
5. Share only aggregate counts and totals per category and for duplicate, unmatched, amount and status exceptions. Compare the aggregate gross, fee and net against the original Paystack export. The standings in the payouts dashboard are separate from transaction values. Preserve original exports and unresolved exceptions for the authorized follow-up.
