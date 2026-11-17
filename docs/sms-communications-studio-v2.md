# SMS Communications Studio V2

P1 builds on the activated transactional release. It does not alter automatic event types, rollout cutoff, budgets, worker claims, supplier/payment rules, customer financial data or existing explicit SMS withdrawals. No new schema migration or startup writes are needed. Marketing and recurring retention remain manual and OFF for automation.

## Daily workflow

The four main sections are Send SMS, Automatic Messages, Campaigns & Audiences, and Delivery Reports. More tools contains Overview, Templates, Campaign History, SMS Permissions, Audit History and provider settings. The top summary shows available SMS credits, sending/automatic status and daily credit limit. The workflow is audience -> compose -> preview -> review credits -> send -> delivery reports.

Compose accepts any reviewed custom message without requiring a preset. Customer-facing example previews substitute official links and sample order facts; technical placeholders/version details are secondary. Cost estimates render website/channel substitutions before counting characters, GSM-7/Unicode units, segments and credits. The final server preview remains authoritative for real order facts, current recipients, exclusions, permission and total estimated credits. Preview changes invalidate prior confirmation. Existing budgets/rate limits remain enforced; the Admin cannot silently bypass them.

## Manual library

17 editable templates cover comeback, first-purchase thanks, official channel, Friday Mystery Drop, data availability, fast delivery, maintenance, outage, order delay, restoration, network disruption, important notices, new services, offers, referrals, appreciation and custom copy. They have realistic previews, cost estimates and authenticated version history. The new catalog does not append a sender-name prefix.

New built-ins are virtual version0 presets until an authenticated Admin saves their first audited version. They can be selected and reviewed immediately without a production seed write. Existing saved edits/enabled state are retained. Unchanged legacy seeded copy is shown as the new reviewed recommendation. Template/preview version checks prevent stale approvals; disabled persisted rows cannot fall back to an enabled virtual preset. Sent messages remain unchanged.

Generic notices invite readers to check current service information rather than invent a live promotion, discount, restoration or supplier capability. Fast/instant/express claims require explicit current-performance confirmation and a concise evidence note, including custom copy. Official channel links come from shared business configuration and require explicit confirmation. Case/scheme/www variants cannot bypass confirmation; noncanonical conflicting links are rejected. Any channel announcement needs positive purpose permission. Promotional offers/invitations cannot use the operational service-notice exception.

## Goal-based Gemini assistance

The brief has a goal, generic writing-audience category, service, network, verified facts, tone, one/two-segment target, CTA and approved website/channel link. It never includes actual selected contact lists. Unknown fields are rejected; recognizable names, phones, emails and references are redacted, while credentials/OTP/PIN/material are rejected before model invocation. Only official links are allowed.

The assistant returns up to3 proposals with per-recipient estimates, never a send. Factual sentences must match supplied facts verbatim after normalization. New nonfactual text is limited to reviewed generic invitations, questions and appreciation; unsupported factual declarations, status/payment/refund copy, invented numbers/price/speed, conflicting networks/links and excess length are rejected. This deliberately conservative writing contract favors safe fallback over a fabricated result. Verified offer terms are required for offer goals. Delivery-performance assertions require explicit boolean confirmation and matching supplied facts. Model errors leave manual text unchanged.

Goal proposals carry a conservative server-recommended purpose: promotional/availability/comeback/custom/thank-you goals are marketing; maintenance/restoration service notices may be operational. Acceptance and template saving carry that purpose rather than inheriting a default operational composer. Channel confirmation provenance also carries forward. All actual sending still uses a fresh reviewed audience and permission checks. The founder can choose/edit, save or discard each proposal.

AI availability uses the existing private GEMINI_API_KEY and shared server client. A safe configuration-presence boolean is included in readiness/private runtime observation; no key value is exposed. Tests use injected models and block native provider access. Successful test proposals do not claim a real production Gemini response.

## Buying-pattern suggestions

Only qualifying completed direct-platform purchases are considered, using the existing authoritative Contact Hub sale predicate. Reseller/storefront finance evidence, refunds, failed/unverified payments, unresolved review and fixtures are excluded. Registered identity remains account ID, not recipient phone.

Purchases collapse into distinct UTC buying days BEFORE taking the latest21 days. This prevents a same-day burst from hiding a customer's earlier cycle. Median interval and median absolute deviation (MAD) resist outliers. At least4 buying days/3 intervals are needed; high variation (MAD greater than75% of median) is insufficient history. A single genuine purchase is one-time; multiple purchases on one day remain insufficient to infer a repeat cycle.

For a stable cycle C and variation M: due begins at ceil(C+max(2,M)); unusually inactive at ceil(max(1.75*C,C+3*M,C+7)); long inactive at ceil(max(60,3*C,unusual+14)). Recent means within max(2,0.35*C), otherwise buying normally until the due boundary. A monthly customer therefore is not treated as overdue after7days. Each account explanation shows its actual interval, variation and thresholds.

Weekly/fortnightly planning controls do not create a schedule. Suggested audience batches explicitly identify up to100 accounts for review; larger groups require narrowing in Contact Hub. The selected buying-pattern group is recalculated during preview, approval and worker revalidation; stale or incorrect selected membership is rejected rather than silently changed. Preparing a reminder draft selects marketing purpose, and no recipient becomes eligible without the existing required marketing permission. Recurring retention jobs are not installed or activated.

## Verification

Unit/native tests cover periods, bursts, sparse/irregular history, direct/reseller isolation, grant denial after promotional AI handoff, redaction, invented claims/links, channel variants, editable virtual templates, stale/disabled versions, reviewed prepared drafts and preserved automatic/financial state. Existing P0 suites run unchanged alongside them. Database-security CI runs Studio in a separate disposable PostgreSQL database.

scripts/reviewSms.py runs real Chromium + React/API flows at360/390/430/768/1280 with synthetic identities and injected AI. External browser traffic is blocked. The flow proves default availability proposals switch to marketing and have0eligible recipients until an explicit synthetic marketing grant; it then reviews a prepared draft, never sends. It also checks custom writing, templates, personal buying-pattern planning, exact automatic selection, reports, audit, permissions, channel confirmation, logout and overflow. An independent reviewer inspects the rendered screenshots.
