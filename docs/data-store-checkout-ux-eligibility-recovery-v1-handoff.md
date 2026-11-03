# Data Store Checkout UX & Eligibility Recovery V1 — follow-up only

Recorded during the V7.2 review. No checkout/payment/provider code was changed in this release. Supplier-contract PR #69 remains excluded and must not be imported as part of this follow-up without its own review.

## Confirmed source findings

- `src/components/website/ManagedDataStorefront.tsx`: the managed checkout catches failures into a generic error presentation. Owner preview has independent guards in both bundle selection and checkout and must remain nontransactional.
- `server/services/websiteBusinessService.ts`, `initialize`: preflight denial or missing authoritative supplier cost becomes the same HTTP 503 "Bundle is temporarily unavailable for managed checkout." This occurs before order creation and Paystack initialization, but loses the useful preflight distinction.
- `server/services/fulfilmentService.ts`, `preflightData`: beneficiary denial becomes `BENEFICIARY_NOT_ELIGIBLE`; its existing customer text claims the number was submitted for verification. That claim is not established by this call graph.
- `server/suppliers/successBizHub/provider.ts`, `checkBeneficiaryEligibility`: calls the beneficiary check, requires an explicit eligibility result and returns `eligible:false` both for confirmed denial and missing results/exceptions. An HTTP timeout or malformed response therefore needs a different customer explanation from confirmed ineligibility. The reviewed method does not provide explicit evidence of a separate verification-submission action.
- `src/components/checkout/CheckoutModal.tsx`: main checkout maps that denial to "We've submitted this number for verification" and alternatives. Reuse the recovery presentation where sound, but do not copy an unsupported submission claim into reseller checkout.

## Small ordered next assignment

1. Verify the supplier's documented beneficiary-check versus verification-submission semantics. Do not assume checking automatically submits a number.
2. Define narrow safe error codes separating confirmed ineligibility, missing eligibility evidence, upstream failures and temporarily unavailable offers. Preserve fail-closed checks, cost validation, price authority, idempotency and no-payment-before-preflight behavior.
3. Propagate safe structured errors through the existing managed checkout API; no raw provider bodies or private phone data in messages/logs.
4. Explain what is known, whether verification was actually submitted, whether payment initialization occurred, and appropriate options: correct/use another number, retry a temporary failure, or inspect suitable alternative products. Never promise next-day verification or eligibility for a product whose rules differ.
5. Test confirmed denial, timeout, malformed/missing result, explicit submission success/failure if supported, safe alternatives, duplicate submission/recovery and phone/network changes. Assert zero order/payment creation for denied preflight and zero transactions in all owner previews.
6. Check main and reseller checkout at narrow mobile widths, accessible error focus, clear retry and no ambiguous "payment failed" claim when payment never started.

This is a separately scoped engineering/UX task, not an unfinished V7.2 feature or authorization to execute live supplier checks/payments.
