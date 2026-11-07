# Admin V6: service readiness and commercial operations

Open **Admin → Commercial Pricing**. Service readiness sits above the existing direct pricing/Welcome Offer and reseller wholesale controls. Refresh is read-only; there is no activation switch, pricing engine or background worker.

## Evidence and interpretation

- A snapshot sends fresh authenticated GET `/services`, plus at most one shared `/catalog` for Data/Airtime, one `/instant-bundles` and one `/vouchers`. Catalogues are requested only when both canonical permission flags explicitly grant the capability. No wallet, beneficiary, purchase or payment request is sent.
- Diagnostic GETs use strict `success:true` validation, no legacy checkout cache, no redirects/retries and an eight-second maximum deadline including the body. Ordinary supplier requests, deadlines and eligibility interpretation are unchanged. Held PR #69 remains separate.
- One credential/base-scoped snapshot is shared for 60 seconds per backend process, including failures. Concurrent requests share one promise. The authenticated endpoint permits six reads/minute/IP. There is no polling; one local timer labels expired evidence stale.
- Rows show `keyPermissions[id]`, `keyGranted`, supplier `available` and `productCount` separately. Missing/duplicate capabilities or conflicting flags are unverified. Product count is informational, including zero for dynamic Airtime; no undocumented precedence or checkout gate is introduced.
- **Supplier checks passed** means configuration, permission, availability and relevant catalogue checks in this snapshot passed. It does not prove beneficiary eligibility, supplier wallet sufficiency, Paystack connectivity, stock at purchase time or delivery. The live-payment configuration presence indicator is separate and is not a connection test.
- AFA has no documented read-only cost catalogue. Its configured retail/encryption/flag are reported without inventing supplier costs. Airtime uses the authoritative backend fee (currently zero), rather than frontend marketing configuration.
- Catalogues exclude explicitly disabled/unavailable offers/packages and malformed rows. Instant fixed rows require product identity/name/network and a valid price; Flexi rows require dynamic amount/ratio evidence. Only the first 20 rows/service are transmitted. Catalogue entry counts are not customer sales or guaranteed stock.
- Results Checkers show validated mapping state, current supplier cost and stock, fixed retail and **gross spread before fees/rewards/other expenses**. They remain disabled until the separate activation procedure is satisfied. Displaying an authenticated catalogue does not establish an undocumented purchase/lookup contract.

## Security and failure behavior

`GET /api/admin/commercial/readiness` uses existing active-Admin authorization, bounded output and `Cache-Control: no-store`. It returns no credentials, raw account IDs, PINs, customers, orders, payment references or supplier error bodies. A short account fingerprint supports private account consistency checks. Errors use controlled categories. Raw supplier replies never reach the browser.

Pricing/storage failures are isolated and represented as blockers/unknowns. Readiness renders even if the existing pricing request fails. Malformed HTTP200 snapshots are rejected before rendering. Request cancellation, session changes and generation guards reject stale responses. Existing prices, supplier orders, financial records and customer notification settings are untouched.

## Operations and release

Use Refresh readiness when investigating availability or before planning activation. A disabled checker can still display authorized supplier catalogue facts. Resolve actual permission/mapping/stock/configuration blockers; do not enable a service merely to turn its indicator green. For checkout-specific failures use the existing System sales monitor and order investigation tools.

Cloud can verify the code with mocks and isolated databases but cannot execute authenticated supplier requests inside Render. An authorized founder can open this panel after deployment to obtain fresh evidence with the backend's existing environment. If permission flags conflict or supplier purchase/lookup shapes remain undocumented, obtain supplier clarification rather than guessing.

Rollback is a normal code revert; there is no migration, production secret change or stored financial-data change.

Production metadata check (7 November2026, approximately23:29UTC): the optional checker purchase table is not installed. This is a confirmed activation blocker; no production migration was applied. Current public-schema RLS-disabled count is zero. Existing backend-only no-policy informational notices and mutable-search-path warnings are separate categories and were not modified by this release.
