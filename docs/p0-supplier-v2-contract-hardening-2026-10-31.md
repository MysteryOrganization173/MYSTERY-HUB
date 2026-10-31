# Supplier v2 contract hardening — release blocked pending discovery clarification

## Reference and scope

Read the complete documentation content of `success-biz-hub-api-v2-2026-10-31.html`, supplied at `/workspace/.codex-attachments/8cd2fa04-1878-4f51-9a89-bdcf14cdd1ce/01414967-6e8a-48bd-9387-58a3a2b9f9d6/success-biz-hub-api-v2-2026-10-31.html`. The snapshot identifies itself as captured October 31 at 13:06 GMT. SHA-256: `7cc4aeab4e01a9914ab7b8a5e6c7fbadd3b1bf742379c3a6b871d6c6e4c6879a`.

Starting remote main is `dc54288c7f363dbabbdc9524d3f6a18c0bc0c5ed`; both Render services were independently verified live on that revision. PR #68 remains the production baseline. This candidate corrects three application contract/payment-eligibility defects. It does not diagnose or repair the original authenticated discovery timeout.

## Extracted supplier contracts

- **Authentication:** canonical base `https://api.successbizhub.com/v2`, `x-api-key`, same live keys as v1; scopes `orders`, `airtime`, `vouchers`, `afa`, `instant_bundles`. Limit 120 requests/minute/key. No new retries or quota policy are introduced.
- **Service discovery:** GET `/services` needs no product permission. `data` has `accountId`, `keyPermissions` and `services[]`; entries identify capabilities by `id` and report `keyGranted`, `available`, `productCount`, `place`, `catalog`. The exact orders example is authorized/available with count 3. The documentation's sample code filters by `available`.
- **Envelopes/errors:** success is `{success:true,data:...}`; failure is `{success:false,error:{code,message}}`. Documented codes/statuses are UNAUTHORIZED/401, FORBIDDEN/403, BAD_REQUEST/400, NOT_FOUND/404, RATE_LIMITED/429, SERVICE_UNAVAILABLE/503. Top-level success is distinct from lifecycle `data.status`.
- **Catalogue/data:** GET `/catalog` returns `data.offers[]`, including `kind`, network, slug/id and packages with `sizeLabel`/decimal-string `priceMinor`. Data POST `/orders` sends MSISDN, human-readable GB value and offerSlug or offerId, never retail price/name. Both catalogue offerSlug and slug are documented selectors. GET `/orders/:identifier` can return one order or a bulk group; this candidate does not change status resolution.
- **Beneficiary:** POST `/beneficiary-check` accepts `phones[]` plus an offer selector, at most 2000; non-billed; proceed only on eligible true. This release does not change the separate beneficiary transport-error classification.
- **Wallet:** GET `/wallet` returns display GHS fields and exact `*Minor` pesewa strings. Existing Data/Airtime wallet checks and calculations remain unchanged.
- **Airtime:** dedicated POST `/airtime` sends network, phone and amountMajor cedis string; no data package ID. GET `/airtime/:identifier` returns owned order status and minor-unit money.
- **Instant:** dedicated GET/POST `/instant-bundles`; canonical catalogue has `data.available`, `flexiPayRatio`, packages and a numeric ID (example 12). Fixed priceMinor is pesewas. POST uses supplier packageId; Flexi also requires amountMajor. Canonical fixed rows omit per-package enabled/available flags, so absence of these optional flags remains accepted; explicit false is rejected. Numeric catalogue fixtures exercise the existing checkout path without changing ID or pricing algorithms.
- **AFA/vouchers:** AFA requires its documented identity fields and returns registration data; vouchers use typeId/qty and return secret PINs in data.pins. The shared client validation remains compatible with AFA's existing privacy behavior. No voucher feature is added.
- **Webhooks:** API-source data orders only; raw-body HMAC-SHA256 with optional sha256 prefix, event_id deduplication, flat single and grouped orders/items payloads, 2xx acknowledgement within about 8 seconds. Delivery is at least once; 4xx is permanent; network/5xx has quick retries plus a documented 1m/5m/15m/1h/4h schedule. No webhook URL, handler, secret or retry configuration changes are in this patch.
- **Idempotency:** optional reference is documented for bulk placement; it is not a documented single-order retry guarantee. Existing atomic claims/uncertain-submission recovery remain necessary and are preserved.

## Mandatory release blocker: no undocumented precedence

The snapshot does **not** establish how contradictory keyPermissions/keyGranted/available fields are resolved, or whether available:true with productCount:0 is valid for a dynamic service such as Airtime. Its single discovery example is orders with all positive fields and count 3; it provides no zero-count Airtime example or precedence table.

The candidate currently requires affirmative permission flags, an explicitly available unique service record and a positive integer productCount. Contradictory/missing/malformed information fails closed. This is a **candidate safety policy, not independently verified supplier behavior**. Zero-product tests are labelled accordingly. The policy could block a legitimate dynamic service if the supplier defines zero differently; it must not be autonomously released under the founder's gates.

Required supplier clarification: do both permission flags and available always agree; which field is authoritative on disagreement; can an authorized/available Airtime service legitimately report zero products? Obtain a written answer or independently verified sanitized authenticated response/behavior before finalizing these cases. No elapsed waiting period or ordinary founder approval substitutes for that contract evidence.

## Patch and necessary safety companion

- `client.ts`: validate ordinary and private-AFA envelopes before returning/caching; reject invalid JSON/missing success/data; retain bounded machine codes/HTTP status with controlled non-sensitive messages and no raw response body. Dispatch by `orders`, `airtime`, `instant_bundles`, preserving independent gates. Reject explicitly unavailable Instant catalogues. Cache identity/TTL architecture is unchanged.
- `provider.ts`: replace legacy kind/name heuristics with the shared supplier discovery gate; preserve uncertainty metadata through existing placement wrappers.
- `types.ts`: add the canonical discovery/enclosing catalogue fields used by the new gate. Legacy type fields remain for existing direct-method fixtures; live HTTP validation requires success:true.
- `api.ts`: reject explicitly unavailable packages for quote/payment initialization; catalogue read failures return temporary-unavailability before creating an order or payment; public availability requires an in-stock product.
- `fulfilmentService.ts`: necessary envelope-validation companion only. A successful HTTP submission with invalid JSON/envelope could already have been accepted. Its new isUncertainSubmission evidence reaches the existing uncertain-state/reconciliation path, alongside unchanged timeout evidence. No retry, resubmission, refund operation or new financial workflow is introduced.
- Tests: canonical documented fixtures, negative/positive checkout gates, envelope/error privacy, recovery, numeric fixed/Flexi eligibility, lifecycle status preservation, and one-POST uncertainty. Existing incident/performance/Instant discovery fixtures are updated to the documented envelope/service shape without weakening their original assertions.

No changes to Paystack verification, amount checks, signatures, event deduplication, atomic claims, supplier pricing/markup, wallet balances, beneficiary eligibility, databases, infrastructure, credentials or UI. The three service paths still have their separate validation and fulfillment rules.

## Reproduction and verification

- Unchanged-main full baseline: 2737 passed, 0 failed, 33 skipped.
- Initial new regression tests on unchanged application code: 16 passed, 42 failed out of 58. Three zero-count cases are policy probes rather than proof of the supplier's undocumented semantics.
- Expanded tests run in an isolated worktree at original main: 26 passed, 52 failed out of 78, including newly checked unsafe invalid-submission outcomes. The candidate's expanded suite passes within the focused regression.
- Focused supplier/checkout/incident/AFA/payment-integrity regression: 226 passed, 0 failed.
- Full candidate regression: 2804 passed, 0 failed, 33 skipped. Skipped database integration checks are not represented as executed tests.
- TypeScript, production build and diff whitespace checks pass. All network submissions and payment calls in tests use deterministic mocks; all order state is synthetic/in memory. No real payment, supplier submission or production database write is used for verification.

## Separate adversarial self-review

Reviewed the exact call graph: payment initialization to service-specific discovery/catalogue, Data beneficiary/wallet checks and Airtime wallet checks, then existing order creation/payment; verified post-payment branches use the original atomic claim/reconciliation mechanisms. Inspected all shared-client methods, including AFA and status reads, before changing the envelope guard. Reviewed code/error privacy, deadline boundaries, malformed successful POST acceptance, code propagation, no added retries, and absence of unrelated source changes. Fixed envelope uncertainty propagation and Instant catalogue exception mapping during review. No second-person review is claimed.

Unresolved discovery semantics above are a release-blocking review finding. Prepare a draft PR, preserve the tested work, and do not merge/deploy until resolved. The original authenticated `/services` timeout requires its separate production/provider investigation even after a future contract-hardening release.

Deferred outside this release: account/base-scoped caches; beneficiary transport-error classification; separate verification of the snapshot's flat single-order webhook shape against the existing handler. Do not expand this candidate to implement those projects.
