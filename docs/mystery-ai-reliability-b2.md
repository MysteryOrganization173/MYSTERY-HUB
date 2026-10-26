# Mystery AI reliability — B2 backend handoff

Base main: `bc3f560cf296cc03eeb93d0f917cca4256951d38`. Backend only; frontend presentation is Claude's responsibility. No merge/deployment or production configuration change in this PR.

## Confirmed failure mechanism and limits of evidence

Read-only Render logs showed `provider_attempt_failed` for Gemini 3.1 Flash-Lite at 00:09:05 and 00:09:21 UTC on 25 October, followed almost exactly seven seconds later by failures for Gemini 3.8 Flash. The old code raced 3.5/7-second timers without passing cancellation to the provider, retained its capacity slot until the original promise settled and logged no error class. Requests that never settled could permanently exhaust the four-slot process limit. A catalogue read before those timers could also hang outside any deadline. The frontend currently aborts at 12 seconds, leaving little room for the two old provider deadlines plus catalogue loading.

The logs cannot distinguish latency, quota, permission or model-access causes behind those generic attempts. Do not claim a model-name typo or quota root cause without evidence. Both configured names are present in the official current model catalogue: https://ai.google.dev/gemini-api/docs/models . The existing local private configuration contains no Gemini key, so actual account-specific model listing/generation cannot be verified here. Production logs demonstrate attempted configuration, not successful generation or current entitlement. A private operator/provider check remains a release gate for claiming real AI healthy.

## Implementation

`createMysteryAiRouter` retains its request validation and endpoint, delegating execution to `mysteryAiReliability`. Catalogue loading and provider attempts have bounded deadlines. Provider calls receive SDK AbortSignal and HTTP timeout; disconnect cancels transport and avoids writing stale responses. SDK cancellation does not guarantee Google stops already-started generation or billing. Four active request slots remain bounded and recover after transport cancellation. No transcript, account identity, payment details or raw provider errors enter diagnostic logs.

Safe error classes: TIMEOUT, CANCELLED, QUOTA, CONFIGURATION, MODEL_UNAVAILABLE, PROVIDER_UNAVAILABLE, EMPTY_RESPONSE and SAFETY. Only model, elapsed milliseconds and class are logged. 429 quota opens a 60-second per-process cooldown instead of blindly trying another model under the same provider quota. Authentication/configuration/safety failures do not retry alternate models. Model-not-found, transient/empty and deadline failures may use the other existing supported model within the total request budget. Current defaults remain the existing Gemini 3.1 Flash-Lite and Gemini 3.8 Flash; no new model is invented.

Known Data, Wallet, Orders/refund, AFA, Website Builder and support questions receive a deterministic backend guide when the provider is unavailable. It does not quote unavailable live prices, claim account access, perform actions, promise delivery or confirm refunds. Unknown questions return a genuine failure. Routine assistance requires no Gemini availability.

## API contract

`POST /api/mystery-ai/chat` keeps `{message,history?,activePage?,editorContext?}` and history/content limits. Success remains `{reply,source:'gemini',fallback:false,model,routingClass,latencyMs}`. Deterministic fallback is `{reply,source:'guide',fallback:true,code,retryable,latencyMs}`. Unavailable answers return 503 `{error,source:'unavailable',code,retryable}`; quota returns 429 plus `retryAfterSeconds:60` and `Retry-After:60`. Process saturation returns 429 BUSY with a short Retry-After. Invalid input returns 400 INVALID_REQUEST. Existing network throttling remains authoritative and spoofed forwarded identity cannot bypass it.

Claude should distinguish guide replies from provider replies, respect Retry-After and cancel obsolete requests rather than retrying automatically. The existing frontend ignores backend `fallback:true` replies and uses its own scripted guide; it stays compatible, while the new contract allows Claude to display the backend guide directly. Do not label a guide as a generated AI reply. No frontend code was changed.

Admin-only `GET /api/mystery-ai/health` uses the existing live session/RBAC and returns configured presence, model names, active requests, process-local cooldown and failure counters. It explicitly reports `providerAccessVerified:false`; it is not a live model health probe. Responses use no-store. Counters reset on Render restarts and are not cross-instance quotas.

No schema additions or secrets are required for the fix. Existing `GEMINI_API_KEY` remains backend-only. No memory, voice, account tools or financial actions were added. Before release, verify the production key's permitted models and a controlled non-sensitive AI answer, then inspect the new classified logs. Do not expose credentials in that check.

Verification: focused AI reliability, safety and existing production-context tests **32/32 passed**. Full isolated regression **2,545 total / 2,513 passed / 2 inherited failures / 30 skipped**. TypeScript, production build and diff check passed. The two unchanged-main Windows CRLF source assertions are the Website Builder V5.2 Signal bundle-first contract and compact gallery layout; no new unexplained regression remains. Synthetic HTTP tests cover provider 403/404/429/503, supported-model fallback, unchanged conversation ordering, cancellation, hung upstream/capacity recovery, bounded catalogue load, cooldown, guide fallback, throttling, private diagnostics and logging privacy. No live provider generation or production financial/data mutation was performed. Actual Gemini entitlement/generation remains unverified, not successful.
