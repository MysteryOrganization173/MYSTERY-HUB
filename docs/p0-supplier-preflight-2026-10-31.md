# October 31 supplier incident: verified safety mitigation

## Diagnosis and production evidence

Starting remote main and both live Render deploys: `eb44d5ebd5f788231dacfbac407876a9ab82609c` (PR #67). Fetched current main rather than relying on the historical handoff. Backend `srv-daud2auk1f9s73bc5ph0`, frontend `srv-dav1h80jo6nc73f2vro0`, workspace `tea-cu4351aj1k6c73etv2m0`. Both track main and auto-deploy on commits. Backend is Node in Frankfurt (`npm install && npm run build`, `npm run start`); its HTTP health-check path is unset. Frontend publishes `dist` after `npm run build`.

Read-only Render logs independently confirmed 26 matching services-check timeouts between 08:37:02 and 12:23:50 UTC. A read-only production `GET /api/instant-bundles` during investigation returned HTTP 200 with `available:false`, no products and a supplier timeout after 15.23 seconds. Neither the HTTP status nor a live Render deploy establishes supplier availability. Public website and `/api/health` responded successfully.

From the separate cloud executor, unauthenticated `https://api.successbizhub.com/v2/services` returned HTTP 401 with the expected missing-`x-api-key` response in 0.21 seconds. Public DNS returned A record `82.29.170.41`. These observations establish independent reachability, not authenticated availability or Render DNS/TCP/TLS health. Timings on this executor include its mandatory HTTP proxy. No authenticated external supplier request, order submission, real payment or production database write was used for testing.

The original client clears its abort timer as soon as fetch returns headers. Consequently, the recorded 15000ms failures indicate the fetch/response-headers phase did not complete within the deadline; the confirmed body-deadline bug is a separate adjacent defect and cannot explain away those production timeouts.

Underlying cause classification: **D, inconclusive** between authenticated supplier degradation, account/provider restrictions and Render-to-provider networking/configuration. Production supplier environment values, authenticated supplier response, production DNS/TCP/TLS phases and current supplier documentation could not be inspected with the available access. The configured default is `/v2` with `x-api-key`, 15000ms timeout and separate 300000ms services/catalog caches. A catalog cache hit cannot authorize checkout when services fails. No stale-service fallback is added. Non-AFA cache keys are not scoped by account/base URL; that existing issue is deferred rather than represented as this incident's cause.

History inspection found no October 28–31 changes to the supplier client/provider, fulfilment service, Paystack service/payment validation or Render Blueprint. The latest client change was October 5. Recent merged work includes service discovery, navigation, purchase presentation, business workspace, analytics and Builder. The latest Render deploy events report `envUpdated:false`; saved environment settings and external account changes remain unverified. Repository documentation was read; historical Mystery Hub chat conversations were not available.

Paystack webhook edits have no observed causal connection: this regular-data failure returns before order/payment initialization. The webhook endpoint validates signatures and uses existing verified-payment/idempotent handling; it does not configure supplier discovery. Paystack dashboard settings were not audited or changed, so an unrelated external change is not ruled out by assertion.

## Patch and boundaries

- `server/suppliers/successBizHub/client.ts`: keep the existing deadline active through response body consumption. Do not retry any supplier request or change timeout values.
- `server/suppliers/successBizHub/provider.ts`: fail closed when Airtime services discovery throws. The existing soft fallback incorrectly treated a timeout as availability and could initialize payment.
- `server/services/fulfilmentService.ts`: preserve the provider's `isTimeout` evidence when handling failed Airtime/Instant Bundle submissions. The existing wrappers discarded it. Body/header timeouts now reach existing uncertain-submission reconciliation rather than being treated as definitive failure. Regular-data services failures receive truthful availability/no-payment copy.
- `server/routes/api.ts`: temporary supplier/wallet unavailability returns 503 for Data/Airtime; actual beneficiary/package errors retain 400 and duplicates retain 409. Instant Bundle service rejection returns a safe 503/code/message instead of a raw provider reason and an unverified recommendation to buy regular Data.
- `src/components/checkout/CheckoutModal.tsx`: supplier/package/wallet errors offer a customer-initiated retry without suggesting another number or an unverified Instant Bundle fallback. Number-specific eligibility behavior remains separate.
- `server/suppliers/__tests__/supplierPreflightIncident.test.ts` and `scripts/reviewDataBuying.py`: deterministic incident regressions and synthetic mobile outage/recovery checks. The browser script also opens the current tracking panel explicitly and stubs current analytics events, correcting obsolete harness assumptions without permitting external writes.

No endpoint, credential, environment, webhook setting, infrastructure, pricing, wallet balance, beneficiary rule, payment verification/signature, order claim/idempotency or reconciliation policy is replaced. There is no supplier failover, availability bypass, stale-success fallback, automated retry or financial record repair. The new timeout propagation preserves uncertain submissions; it does not establish that they failed or authorize refunds/resubmission.

## Verification

- Original main baseline: 2726 passed, 0 failed, 33 skipped (2759 reported tests).
- New incident suite: 11 passed. Covers header timeout, exact deadline boundaries, stalled body, just-before-deadline completion/timer cleanup, recovery, cached catalog with failed services, network/permission/disabled-service failures, beneficiary/wallet gates, Airtime safety, independent Instant Bundle availability, and all three submission paths remaining uncertain with exactly one POST.
- Three selected new regressions were executed against a detached original-main worktree: all three failed as expected (missing body deadline, old 400 classification, Airtime fail-open).
- Focused supplier/checkout/financial-integrity regression command: 39 passed, 0 failed.
- Full patched regression: 2737 passed, 0 failed, 33 skipped (2770 reported tests). Existing duplicate, wallet, beneficiary, verification, webhook/replay, reseller and reconciliation suites remain included. Database-dependent skips are not represented as executed integration tests.
- `npx tsc --noEmit`, `npm run build`, `git diff --check`: pass. Existing Vite configuration/deprecation warnings remain.
- Synthetic browser review passed: 32 screens, no page errors. Checks assert correct outage copy, no provider payment window, no misleading fallback actions, and explicit recovery retry at 360px and 390px; broader journey review also covers 768px/1280px. APIs/payment SDK are intercepted and no production backend/database is used.

## Separate adversarial self-review and operational limit

Reviewed header-versus-body timing, response-before-timeout completion, cached catalog independence, 503 client handling, explicit retry guards, order submission claims, all three uncertain-submission paths and absence of changes to financial/auth/webhook validation. Review found that extending deadlines without preserving Airtime/Instant timeout metadata would incorrectly classify uncertain acceptance; this was corrected and covered by executable one-POST tests before release. No second-person review is claimed.

This is a safe incident mitigation, not proof of supplier recovery. Required operational follow-up is an authenticated read-only services check from the backend environment and supplier-side investigation of that account/Render Frankfurt request path. Verify configured supplier URL and DNS/TCP/TLS/response-header timing without printing keys, wallet information or customer data. Do not change settings, credentials, firewall rules or timeout values based solely on the independent unauthenticated 401.

Deferred: authenticated service-contract/permission validation and account/base-scoped discovery caching; bounded discovery request coalescing/circuit breaking only after observing recovery and safe invalidation behavior. Broader dashboards and supplier failover remain separate work.
