# Optional standard Data receipt email

Scope: direct standard Data only, including Wallet. AFA, Airtime, Instant Bundles, Marketplace, reseller checkout, pricing, promotion eligibility, payment verification, signatures, reconciliation and supplier dispatch contracts are unchanged.

## Contact and provider email

`dataReceiptEmail` rejects invalid nonempty input, then resolves a valid explicit receipt address, a valid session-derived account email, or the empty string. Clearing a field means no explicit address; a valid account address still takes precedence over a provider alias.

Only real email is persisted in `orders.customer_email`. Empty string fits the existing NOT NULL VARCHAR(128) column. No account field, cached profile, recovery contact, marketing contact or public projection is written with an alias. Admin contact display continues showing None for an empty contact. Existing AFA/store/payment consumers retain their own policies.

`dataPaymentEmail` supplies Paystack with the real stored address or `order-<40 hex characters>@mysterybundlehub.com`, deterministically derived from the persisted opaque order ID. The backend never includes phone digits or account identity in the alias. Hashes are namespace identifiers, not credentials. Per-order aliases intentionally avoid correlating unrelated guest purchases; Paystack may create separate customer records. They must not be treated as customer identity or mail consent.

The founder owns mysterybundlehub.com. Read-only DNS inspection on 2026-10-11 found registrar forwarding MX records. This does **not** verify wildcard/alias routing, receipt delivery or mailbox ownership. No mail infrastructure/configuration was changed. Without a real address, customers track their purchase using the Mystery Hub order reference; no email delivery is promised.

## Retry and session safety

Signed-in checkout retains its existing user-bound finance operation latch. Guest standard Data requests use a UUID v4 request ID and a backend-generated SHA-256-derived order ID (58 characters, within the existing 64-character column). The persisted pending order is the initialization latch. A PostgreSQL transaction locks the request and any MTN recipient before inserting the complete existing order snapshot. Memory fixtures use equivalent locks.

A repeated guest request returns 409 with the original reference, never another Paystack POST. This applies after successful initialization, cancellation, definitive failure or uncertain/throwing initialization. Changed recipient/product/contact cannot retrieve that reference. To resume, track/reconcile the existing order; the client must not silently create a new request after uncertainty. No automatic provider retry is introduced.

Data popup callbacks are settled once and gated by the initiating session, including before and after verification. Late signed-out/switched-account responses cannot add a purchase to the current customer's view. Wallet responses have the same session boundary. Verification remains backend authoritative.

## Release gate and rollback

Mocks and compiled synthetic journeys do not prove official Paystack alias acceptance. Production payment-path merge requires a safely configured **isolated official test key**, provider initialization acceptance/record inspection, the remaining payment/privacy gates, and founder review. Never use live keys to check aliases. No new environment variables are required by this implementation.

Deploy backend before frontend (old clients sending real email remain compatible). If a future authorized release needs rollback, revert the reviewed feature commit normally and redeploy the previous compatible frontend/backend pair. Do not rewrite main or modify existing orders/ledger entries. This pass changes no schema and performs no production migration.
