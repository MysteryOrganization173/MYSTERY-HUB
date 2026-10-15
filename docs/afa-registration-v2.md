# AFA Registration V2

Branch `claude/afa-registration-v2`, stacked on `claude/data-buying-v2-s6j5qn` (PR #12). It reuses PR #12's `Money` price treatment and tap feedback.

## What changed for the customer

| Area | Before | After |
| --- | --- | --- |
| Hero | Badge "MTN Special Offers", title, three trust lines, a fee line, then a separate "How it works" panel in 10px text. | "Register your MTN line for AFA", the server fee in a card ("Paid to Mystery Hub once. AFA call and data packages are bought from MTN afterwards."), and four steps. On phones the steps show titles only, so the form starts sooner. |
| Form | The payment choice came first, above the personal details. Three panels, 12px inputs, required asterisks, and help text in 10px. | Four numbered groups in the order people think: your MTN line, Ghana Card, where you live, then receipt and payment. Inputs are 16px and 48px tall, each with one hint or error line. The payment choice and consent sit at the end, beside the privacy commitment. |
| Field help | Errors appeared only after submit, and focus jumped on every error change. | The Ghana Card field adds `GHA-` and the dashes as digits are typed. The MTN number formats as `024 123 4567`. Card, number and email are checked on blur with the same shared rules the submit uses. Focus moves to the first error only after a submit. |
| Payment | "Pay for registration · GH₵ 15.00" with "Processing Registration...". | "Continue to payment · GH₵15.00", or "Sign in to continue" when signed out. While starting it shows "Opening secure payment…" and stays locked. Underneath: "Registration starts only after the payment is confirmed." Connection failures say that no payment was started. |
| Packages | Green-on-dark cards with prices in a checkout style, hidden behind "View Sample AFA Tariffs" on phones. | "MTN AFA packages, after you register" with a "Bought on MTN, not here" tag. A Monthly/Weekly switch shows a two-column comparison (calls and SMS vs with data): price "on MTN", validity, on-net, off-net and CUG minutes, SMS and data. It has no buy action and keeps the existing disclaimer. Values are the existing `AFA_PACKAGES` config, unchanged. |
| Return from Paystack | The form showed "Processing Registration..." while the payment was verified. | A "Checking your payment" state, then a receipt with a three-step timeline (Payment confirmed, Submitted for registration, Registered) built only from the server status. Needs-attention states are marked where they stopped. The reference has a copy button, and the `*1848#` instruction appears only once the order is Registered. |

## Unchanged on purpose

`validateAfaPayload`, `normalizeGhanaCard`, eligibility, the `initializeAfaPayment(payload, consent, customerEmail, sessionToken)` call, the wallet `requestId`, the `checkout.paystack.com` host check, server verification on return, and memory-only identity (cleared on account change). Nothing here touches browser storage, URLs, logs or analytics. Card number and date of birth now also opt out of browser autofill.

## Verification

- `tsc --noEmit`, `vite build` and `npm test` pass (one inherited failure in `websiteBuilderV1.test.ts`, the same as on `main`).
- `afaRegistrationV2.test.ts` covers card formatting against the shared validator, the timeline mapping, packages that never become a purchase, the storage and URL boundaries, and the submit lock.
- `scripts/reviewConnectivity.py` covers signed-out and signed-in journeys at 360, 390 and 1280px: an empty submit, a bad card on blur, a server field rejection, the locked submitting state, the handoff to a local Paystack stand-in, a paused service, and returns at queued, processing and delivered. It asserts the card number and date of birth appear only in the initialize POST body, never in a URL or browser storage.

## For Codex

No backend change is needed for this page. If a customer leaves Paystack without paying, they come back to an empty form, because identity is deliberately not stored. Their unpaid order is visible in Orders. A server-side "resume unpaid AFA order" link would be a better path; it is not attempted here.
