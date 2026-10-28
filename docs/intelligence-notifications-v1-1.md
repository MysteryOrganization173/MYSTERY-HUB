# Intelligence & Notifications V1.1

## Scope and evidence

Based on main `e9e4495e6f8d11365b0984b6c574852e3fc91055` (Service Discovery V2), preserving AI #52, Orders #53, Notifications #54 and onboarding #55. No new schema, keys, provider, financial behavior or notification activation.

During verification main advanced through PR #57 to `58154a224c5fb264a46d83d4bf181f103a19bf3b`. Its three mobile-navigation/CSS/test files were inspected, had no overlap and were fast-forwarded into this candidate without discarding work. Integration checks preserve the new navigation; it is not reintroduced as part of this correction's PR diff.

Before this correction, three safe production questions (greeting, platform introduction and Mystery Earn) returned 503/PROVIDER_UNAVAILABLE in under one second. Existing logs did not retain HTTP classification, so that observation alone did not establish the underlying provider cause. Both model names were confirmed in Google's current official documentation; a supported model name or configured key is not proof of inference access. No usable local Gemini key was available. Exact post-release diagnostics and real generation status belong in the release report, not a fabricated success claim.

The public directory in `src/data/services.ts` now supplies public descriptions to a shared guide and the model context. Both backend outage help and frontend network fallback use that guide. It covers the eleven requested customer questions, links to the relevant service, distinguishes Wallet spending funds from earnings withdrawals, defers rewards to the effective policy and never invents live prices or delivery estimates. The provider still receives the existing bounded authoritative catalogue result; a failed catalogue fetch supplies no invented prices. Existing editor help stays in place. Locally personalized welcome text is excluded from outgoing history. An answer without explicit model provenance cannot be labelled AI.

Google HTTP 400/401/402/403 are configuration/request prerequisite failures, not blind transient retries. A fixed allowlist of HTTP status, key/config reason and network codes supports diagnosis; upstream messages, metadata, keys, identities and question text are never logged. Invalid configuration and quota each open a sixty-second process cooldown. Existing four-request concurrency, network abuse limit, two-model maximum, 9.5-second server budget and twelve-second client budget remain. SDK hidden retries are disabled for chat and template drafting; no global SDK/provider change. Candidate safety blocks cannot be bypassed by trying another model. Admin-only AI health distinguishes successful generations observed since startup from merely having configuration.

Notification changes are read-only operational observations: saved events, queue, attempts and provider-accepted counts, plus actual process worker start/check/error state. The existing worker dispatch, consent, templates, leases and financial event meanings are unchanged. Provider acceptance remains distinct from Android display/opening. Unknown fields from an older backend render unavailable rather than fictional zero counts. No real notification has been sent by this task.

Ultra's existing validator accepts blank/whitespace optional reference websites, rejects malformed nonempty URLs and preserves the original input. Focused regressions exercise a valid email without a reference. Synthetic browser checks verify that errors retain entered progress and clearing only the reference allows submission. No existing enquiry is changed. Follow-up: Preferred Style is server-required although the existing UI does not mark it required; that separate form-label/step-validation mismatch is outside this optional-reference check.

## Notification activation gate — NO autonomous unpause

Read-only precheck observed one active **admin** device, zero marketing-consented devices, 34 events, zero attempts/deliveries/campaigns and all marketing templates off. Seventeen unexpanded events were less than 24 hours old. These counts are time-sensitive and must be refreshed. The worker excludes events older than 24 hours but can expand more recent saved events on resume. **Do not treat resume as a test-only switch or assume it cannot release backlog.**

The following is a proposed separate founder-approved operation, not work executed by this coding release:

1. Obtain explicit approval for the exact single-device test, temporary preference/template changes and brief global resume. Recheck a recoverable backup and all current delivery/event/device counts first. Keep paused until every precondition is confirmed.
2. Use a founder-owned normal customer account on the consenting installed Android device. Do not relax customer-only campaign authorization to target an admin. Register explicitly, confirm the current unexpired session binding and exactly one eligible device. Lock-screen permission alone is insufficient. Do not sign out during the test.
3. Before a global resume, inspect all queued/retry work and recent unexpanded events. If any other device or eligible historical delivery could receive a packet, STOP and establish a reviewed isolation plan. Do not delete events or financial history to manufacture a clear queue.
4. One supported isolation option, requiring explicit founder participation: the sole consenting customer device has marketing=true and temporarily transactional=false; there are no other active devices, campaigns or queued/retry deliveries. This excludes old transactional events without changing their contents. All usual marketing templates stay disabled; enable only a saved generic test template. Recheck these conditions immediately before resume and stop on drift. The original admin binding must have been removed by normal logout/account switching; do not impersonate or directly rewrite it.
5. Briefly resume through the audited operational control. Prepare the existing single-customer audience, require exactly one customer and one device, then confirm one generic test campaign with its existing idempotency key. Do not send any order, payment, refund or supplier test event. If the response is uncertain, inspect that same campaign/delivery before retrying; never create a second request ID.
6. Record provider acceptance separately, ask the founder to observe the phone in background/locked state and tap the notification. Verify the same-origin protected inbox lookup and correct account destination, no duplicate visible alert and no public order information. No provider-accepted state proves physical receipt.
7. Pause again, disable the test template, restore the founder's transactional preference with consent and preserve history. If delivery fails, leave paused and diagnose the existing attempt codes. Retries are bounded, expired endpoints are invalidated and previous-account bindings cannot consume another account's private inbox. Test logout/account switching and turn-off/re-enable before regular rollout.

If those isolation conditions cannot be met, activation remains blocked until a separate narrowly designed test facility or operational plan is approved. Do not add a production fake-order path. Marketing campaigns remain a separate decision even after transactional acceptance passes.

## Deployment and recovery

This is backward-compatible code/API presentation only: no production migration or configuration update. Older clients ignore new Admin health fields; newer clients tolerate fields absent during rollout. Both existing Render services follow main; allow one automatic deployment each, verify exact revisions and health, preserve pause/key state. On failure, keep delivery paused and use a normal corrective/revert release; preserve all private event/attempt/audit history and encrypted backups. Do not restore financial data or replay external operations.

## Memory and voice — planned, not implemented

Current chat remains component memory only, cleared on reload/new chat/account switch. No transcript persistence, microphone prompt, recording or spoken answers were added in this reliability release.

The next memory slice can use private PostgreSQL conversations owned by existing user IDs, bounded recent turns, authenticated ownership on every read/write/delete, explicit retention/clear controls and no guest persistence. Keep summaries/context bounded and invalidate client work across account/session changes. Do not add vector infrastructure without a demonstrated need. A future schema requires separate backup, permission and rollout review.

Voice should be explicit tap-to-record with a permission request only at that tap, an editable transcript before sending, cancellation/time/size limits, optional user-triggered speech output and a typed fallback. Feature-detect actual device/browser support, handle unavailable recognition and permission rejection, stop audio on close/account change and do not retain recordings by default. Android, Samsung Internet, iOS installed/browser variants and software-keyboard behavior require real-device acceptance; browser SpeechRecognition support is not universal. No always-listening mode or finished voice claim.

## Preserved follow-up roadmap

- Admin Analytics & Growth Center; Marketplace interest/conversion tracking.
- Builder creator contact capture; Sanctuary, Classic Shop and Buka Bistro improvements.
- Mobile `/app` presentation and Samsung Internet installation guidance.
- Mystery AI persistent memory and full voice experience.
- Controlled notification activation, then separately approved marketing.
- Developer/reseller API; custom domains and Builder monetization.
- Existing operational/financial maintenance issues.

Next priority: resolve the exact production Gemini access/configuration diagnostic, then complete the separately approved consenting-customer-device push acceptance. Neither requires another general feature sprint.

Official references: [Gemini Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite), [Gemini Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [SDK HTTP options](https://googleapis.github.io/js-genai/release_docs/interfaces/types.HttpOptions.html), [Google troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting).
