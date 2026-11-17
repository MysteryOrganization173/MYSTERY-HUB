# Transactional SMS experience V2

P0 reuses the installed private V1 outbox and V2 permissions schema. No new DDL or startup migration is required. Automatic activation remains a separate, audited production operation after merged-code, runtime and provider checks.

## Customer experience

Defaults are received/processing, delivered and delivery attention. Separate payment confirmation is excluded. Verified refund updates remain optional and OFF. Marketing, retention reminders and registered beneficiary updates stay OFF.

Registered customers receive routine updates only on the active owning account's valid phone. Guests receive neutral status copy only on the existing bundle recipient phone, without inferred payer identity or an extra checkout field. Guest recipients cannot receive payment/refund financial copy. A missing transactional permission grant does not block a current transaction; explicit SMS withdrawals in account choices, prior permission records and SMS suppressions still win, including account withdrawals across number changes. Push preferences/subscriptions do not qualify or block SMS.

The reviewed bundle renderer supports MTN, Telecel and AirtelTigo data orders with valid server-side bundle size and destination facts. Other services require their own approved factual copy and are conservatively excluded from these bundle templates. Default copy uses a masked destination, GSM-7, and one segment. A reviewed concise variant handles unusually long facts; unsupported facts fail closed without silent truncation. Examples appear in Admin using synthetic data. No AI is used to render transaction messages.

## Discovery and submission

The worker discovers current-state direct orders created at/after the rollout cutoff, independently of push events. It reuses the private `guest_events` table as an SMS candidate outbox for both registered and guest orders, with `v2:` keys; the table imposes no guest-only constraint. Legacy trigger/push candidates cannot dispatch duplicate V2 stages. Discovery and dispatch both apply direct-platform/reseller exclusion, verified payment and current lifecycle evidence.

Processing requires submitted/processing state, supplier order ID, valid acceptance time after payment, and no uncertain/manual/refund outcome. Delivery requires delivered state, valid delivery time and fulfillment evidence, without review or contradictory refund/compensation. Attention matches the existing paid-order actionable Admin queue, excludes resolved/recovered orders, and promises only that the case is in that queue. Refund completion requires verified resolution evidence and is not a normal-stage default.

Unique order/type/canonical-recipient message keys, candidate consumption, atomic claims, persisted submission markers, credit limits and uncertainty handling remain. Processing is cancelled before its submission marker if delivery overtakes it. Every message is revalidated immediately before provider submission; withdrawn permission, changed phone, stale evidence, disabled event or changed copy prevents the old intent from sending. Already in-flight requests cannot be recalled. Uncertain submissions never automatically retry.

Adding an automatic event while active advances the global cutoff and cancels older queued automatic messages in the same locked settings transaction. This intentionally starts a fresh rollout rather than creating an unexpected backlog. Removing stages preserves the cutoff and prevents those queued stages from dispatching.

## Admin and copy publishing

Automatic Messages shows exactly the selected events and submits that same selection. It rejects separate payment events and registered recipient updates during activation. The reviewed rollout selection is processing, delivered and attention, without refunds.

Admins compare Standard/Concise approved wording, realistic account/guest examples, costs and version information. Publishing accepts only source-reviewed catalog choices through the authenticated Admin API with optimistic version checks and an audit row. Prior and new copy snapshots remain in template_versions. Sent message bodies stay immutable; queued messages are rechecked. Arbitrary transactional text/facts cannot be edited. Unpublished legacy rows use the new reviewed built-in default and are visibly distinguished from published versions.

## Runtime evidence and activation

The backend records a whitelisted private runtime observation in settings.balance._runtime at startup and every30seconds, even when sending is disabled. It contains effective booleans, sender, budgets, commit, instance/boot ID and signing-match metadata, never credentials or test phone numbers. Balance updates merge existing metadata. This is runtime observation, not independent proof of every running instance. Correlate it with the current LIVE Render deploy and instance count; require fresh heartbeat, successful current-key credit check and matching provider signing configuration.

Preferred activation is the authenticated settings API. A connected DBA operation is permitted only under founder authorization, with an explicit before/after audit, expected revision, exact approved event list, current-runtime/provider predicates, a fresh database cutoff and narrow transaction. Do not fabricate an Admin user/session. Retain the database role and actual authorization provenance in the audit. No historical order, customer, payment or supplier data is changed.

No checkout purchase or supplier submission is needed to qualify this release. If no genuine post-cutoff qualifying order occurs, report automatic eligibility and activation separately from observed real customer delivery. A controlled founder test requires an existing verified allowlisted founder device; never invent a number or send a bulk test.

## Verification

Native V2 tests cover account/guest/gifting, push independence, explicit opt-out at dispatch and phone changes, supplier ambiguity, stale processing, recovery/attention, reseller finance evidence, exact policy, cutoff expansion, approved-copy versions and one-segment facts. Existing suites retain concurrency/crash/uncertain-send/budget/callback/reconciliation coverage. Database-security CI runs V2 permissions and transactional experience in separate disposable databases. scripts/reviewSms.py exercises real React/API flows and captures all required viewport widths with external browser requests blocked.
