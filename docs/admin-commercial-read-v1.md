# Commercial Pricing read reliability

Baseline: ea9ad11c46e65e9ebe1e3d1c5826e2ba3345e746. Backend review branch only; not approved for automatic production merge.

Production evidence confirms authenticated GET /api/admin/commercial returned 503 while nearby admin requests returned 200. Production dependency logs/configuration are inaccessible in this run. The exact production cause is NOT established.

Source and isolated reproduction show: critical config/rule/audit errors escape the old aggregator; null products configuration throws; supplier promise rejections were caught but synchronous supplier errors were not; indefinitely pending dependency reads had no aggregate bound. The old admin path performs two matching-rule DB reads per product. Provider discovery already caches catalog data; no invented supplier endpoint is needed.

Repair affects admin GET only. Financial configuration, reseller config, active rules and audit reads are critical with five-second deadlines and fail closed as 503. A correlation ID and allowlisted dependency/reason are logged, never raw exception strings or credentials. Product costs run with four workers and a ten-second overall budget; a timeout stops new queued lookups. Existing supplier requests retain their existing client abort timeout; this wrapper does not claim to cancel them. Costs have known/unknown/unavailable states, preserving zero versus null. Contributions remain null when costs or reserves are unknown. Configuration defaults are existing launch defaults; malformed stored values never become zero-cost estimates. Legacy enabled reserve-only economics configuration remains compatible.

Rules are fetched once and matched in memory with the existing specificity, stage, schedule and tie-breaking policy. Checkout quotes, prices, saving, supplier submission and finance migrations are unchanged.

Verification: 122/122 isolated admin-read + commercial + commercial DB tests; TypeScript passed; production build passed (existing nonblocking warnings); diff check passed. Tests cover synchronous/rejected/unknown/zero supplier costs, critical malformed config, timeout, bounded concurrency, read-only execution, rule matching, RBAC and sanitized error response.

Release follow-up: founder reviews backend diff, obtains the production failing dependency/correlation log and validates actual stored configuration. No production DB writes are needed for diagnosis. Merge/deploy only with separate approval. After deployment, authenticated GET must load real config, costs must explicitly show unknown/unavailable, and legitimate checkout quoting must remain unchanged. Do not perform live payments for this verification.
