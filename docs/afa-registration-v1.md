# AFA Registration V1 operations

The `/afa` information page is public. Registration checkout requires an active customer session and completed forced-password-change requirements. The server owns the registration fee; MTN package examples in `src/config/afa.ts` are informational and are purchased separately.

## Configuration

- `AFA_SERVICE_ENABLED=true` enables consideration of checkout availability; unset/false disables it.
- `AFA_RETAIL_PRICE_MINOR` is a positive integer in pesewas, at most 100,000,000. There is no default registration fee.
- `AFA_PII_ENCRYPTION_KEY` is a dedicated secret containing exactly 64 hexadecimal characters (32 random bytes). Keep it stable while unresolved registrations retain encrypted payloads. Changing it without decrypting/migrating those records prevents their recovery. Never use the supplier API key as this key.
- Existing `SUCCESS_BIZ_HUB_API_KEY`, `SUCCESS_BIZ_HUB_BASE_URL`, and `SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED` configure the supplier. Existing live `PAYSTACK_SECRET_KEY` is required for real dispatch; test payments never dispatch.
- Set `APP_URL` (or `FRONTEND_URL`) to the public HTTPS frontend origin for the Paystack return to `/afa`. Existing allowlisted request origins can supply the fallback. Unrecognized origins without explicit configuration fail closed.

No production settings or reward rules are activated by this change. AFA does not participate in existing wildcard referral rules in V1.

## Persistence and submission

Normal repeatable application initialization adds `afa_registrations` with an order foreign key, encrypted submission payload, masked card, operational details, public supplier ID, status/timestamps, and a durable submission latch. Partial unique indexes protect active/completed phone reservations and supplier IDs. Creating the generic order and registration is one PostgreSQL transaction under a per-phone advisory lock.

AES-256-GCM uses a fresh 12-byte IV, an authentication tag and order-bound associated data. Only the server decrypts the payload. Ghana Card/DOB/ciphertext/IV/tag never enter customer or admin projections, payment metadata, audit metadata, or supplier error logs. Operational admin details include legal name, phone, masked card, location/region and optional occupation.

After authoritative Paystack reference/amount/currency validation, an atomic paid-to-queued claim and a separate durable registration latch precede the exact supplier `POST /afa`. The latch is never automatically reset. Supplier `priceMinor` is parsed strictly as integer pesewas and never changes customer retail price.

Supplier discovery uses `GET /services`, explicit AFA permission/availability, a 45-second credential-scoped cache, and concurrent-request coalescing. Status checks use only `GET /afa/:publicId`, with a persisted 30-second throttle, including forced admin refresh. Only `registered` means successful completion. AFA ignores the undocumented use of Data webhooks.

## Manual review and recovery

Timeout, dropped connection, 5xx, or malformed acceptance without a reliable public ID means **acceptance uncertain**: retain the encrypted evidence, flag manual review, and do not POST again. An interrupted latched submission is recovered into this state by reconciliation. Contact supplier support using the safe order/phone context and record the investigation in the existing admin note. Do not put the full Ghana Card or DOB into notes.

If a public ID was saved before a later local write failed, customer/Admin refresh or background reconciliation recovers it from the registration record and uses GET only. Admin cannot manually mark AFA delivered. Definitive supplier rejection uses the existing refund-pending/manual-review workflow; no automatic refund is performed.

Successful registration purges the encrypted payload and retains the phone reservation against accidental repurchase, including after a local refund or closure. Failed, refunded, cancelled or expired closure releases the reservation and purges only when no supplier submission was attempted or the supplier definitively reported failed/rejected/cancelled. Local financial closure alone cannot establish supplier rejection: uncertain or still-processing submissions retain encrypted evidence and the reservation for support reconciliation. HTTP-only rejection without a recorded supplier terminal status is conservatively retained too. Repeatable background cleanup applies the same guards after a crash. Never reset a submission latch or release an unresolved reservation to enable another POST.

Tests use isolated memory and mocked PostgreSQL/supplier/Paystack interfaces. No real registration, transaction, external database migration or supplier wallet mutation is needed to verify this pass.
