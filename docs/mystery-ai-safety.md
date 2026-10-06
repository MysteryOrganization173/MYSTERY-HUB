# Mystery AI safety and truth baseline

Mystery AI remains an informational guide: no account/order tools, payments, site edits or publishing actions. Conversations stay in component memory; this pass adds no persistence, account-linked history or Admin transcripts.

## Request and usage limits

`POST /api/mystery-ai/chat` accepts a nonempty string question up to 2,000 characters, at most eight prior turns, each with role `user` or `assistant` and nonempty string content up to 4,000 characters. Oversized/malformed requests return 400 before Gemini; content is not silently truncated. The client explicitly sends only the most recent eight prior turns. The current question is sent separately and appended once by the server. Page context is an optional string of at most 64 characters; editor context retains the existing allowlist/bounds.

The existing in-memory sliding-window limiter permits 12 requests per 60 seconds per socket network address, equally for anonymous and authenticated visitors. This public endpoint has no validated account identity, so bearer tokens and caller-supplied forwarded headers are not trusted for quota identity. Invalid requests also consume quota. The existing limiter holds at most 10,000 keys, then rejects new keys until cleanup. Limits are per process, reset on restart and are not bot-proof. Shared networks/reverse proxies can share the quota; a trusted proxy-aware identity policy would require a separate deployment decision. No private quota identity is returned to callers.

At most four Gemini calls may be outstanding per process; excess requests receive a friendly 429. Each reply has a 1,024-token output limit. Existing model routing, two-attempt maximum and 3.5/7-second deadlines remain. A timed-out provider call keeps its capacity slot until the SDK promise settles, preventing timeouts from bypassing the concurrency cap. Client abort does not guarantee cancellation of upstream Gemini usage. A permanently hung SDK call retains its slot until process restart; this deliberately fails closed for cost protection. These controls bound casual usage rather than impose a monetary billing quota.

## Responses and safety

Successful provider responses are marked `gemini`; known local help is marked `scripted` and displayed as Help guide. No-key/provider failures return friendly 503 without raw errors. Unmatched questions show a failure and Retry; 429 and malformed requests never become scripted successes. Retry reuses the failed question without duplicating its history turn.

Closing, resetting, opening another critical modal or unmounting aborts the client request and invalidates its identity. Late results cannot change a newer conversation or its typing state. The neutral Guide badge makes no provider-health claim. Operational logs contain failure category/model only, never raw provider errors or conversations.

## Repository-grounded guidance

Wallet is live, with funding conditional on payment configuration and valid profile email. Airtime instructions import the authoritative `AIRTIME_SERVICE_FEE_PERCENT` (currently 0%). Builder media guidance uses Upload Image / Media Library when configured. Managed Data Reseller checkout and automatic fulfilment are described as conditional on configuration/enablement, without exposing provider identity. During outages, price questions point to the live Data page instead of claiming seed prices are current. AI cannot inspect private balances/orders or transact; navigation suggestions remain informational.

## Verification

Safety tests use dependency-injected Gemini/catalog mocks and loopback HTTP only. The isolated test runner removes inherited database settings; no live provider, payment, supplier or database operations are needed.
