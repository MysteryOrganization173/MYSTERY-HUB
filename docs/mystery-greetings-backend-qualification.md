# Mystery Greetings backend qualification

The public launch target is December 1, 2026. The baseline is `fedca0ab59bfa69bed2c133a44b1a6025ecb5193` after PR #145. This qualification adds a Greetings-only visitor resolver, database installation checks and reverse-migration coverage. The creator and recipient UI, share URLs, merchant restrictions and payment execution remain intact.

## Ingress qualification

The canonical site serves the Express greeting head and status at `https://mysterybundlehub.com/g/:shareId`. A read-only browser run on the canonical site called the same-origin `/api/experiences/templates` endpoint. The separate Render static build at `https://mystery-hub.onrender.com` embeds `https://mysteryhub-api.onrender.com` in its [apiClient](../src/services/apiClient.ts) bundle, confirming a direct API-origin path. Its SPA fallback has no authority to read greetings. Public responses on the canonical host and Render origins carry edge identifiers. That evidence shows an edge is present. It does not identify the socket peer observed by Express or establish the integrity of the forwarded address at every boundary. [Render's edge architecture](https://render.com/articles/how-render-handles-ddos-attacks) · [Render's forwarding guidance](https://render.com/articles/how-to-proxy-analytics-through-your-own-domain) · [Cloudflare's headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/)

Set `EXPERIENCES_TRUSTED_PROXY_CIDRS` only from verified infrastructure evidence. Each configured range must be exclusive to proxy hops with a confirmed X-Forwarded-For append or replacement contract for this service. Start with the real TCP peer. The resolver consumes a single X-Forwarded-For header of at most 512 characters and eight values from right to left. It uses the first globally routable address outside the attested proxy suffix. Client-supplied prefixes, `CF-Connecting-IP` and `Forwarded` never establish identity. Reject a missing or untrusted socket, a malformed candidate, duplicate field lines, and a header with no external visitor. Avoid blanket private networks, global Express proxy trust, inferred Cloudflare-only access and positional trust based on a fixed hop count. Cloudflare's visitor headers require an independently verified network boundary. [Cloudflare origin trust guidance](https://developers.cloudflare.com/support/troubleshooting/restoring-visitor-ips/restoring-original-visitor-ips/)

An unqualified request receives one shared, bounded local key. Creation, reporting, visitor analytics and creator revocation return a retriable 503 for that path. Link reads retain both local admission and the existing durable global read quota. Admin moderation still requires Admin auth. The readiness field `trustedVisitor` confirms that a mode is configured, while `/api/experiences/templates` also checks the current request. The global seasonal discovery response is a coarse signal and can be cached for 60 seconds when creation is configured or 300 seconds otherwise. The server independently enforces readiness before writes. An explicit non-Render development or test process can use a real loopback socket without forwarded headers.

The same request resolution supplies the local limiter key and the existing secret-keyed, UTC-day HMAC for durable operations. IPv4-mapped IPv6 shares the IPv4 budget. Normalized IPv6 shares a budget inside one /64 to limit evasion by privacy-address rotation. Mobile carrier NAT can still combine visitors and a changing routed prefix can change a quota key. The UTC day boundary renews report deduplication and fixed-window boundaries allow adjacent-window bursts. Raw IPs remain transient process data. Responses and persistence contain no raw addresses.

### Evidence required before production configuration

1. Obtain Render-confirmed app-facing proxy ranges and rules for header handling, including whether a hop replaces X-Forwarded-For or appends a peer. Verify all upstream trusted hops and their network provenance. Record the source and owner of the evidence and review again after routing changes.
2. With separate approval, test an identically routed, credential-restricted diagnostic or use an attested Render trace. From two controlled networks, test the canonical domain, direct API origin and requests initiated from the Render frontend. Send limited synthetic spoofed prefixes and CF headers on each path. Confirm the actual observed socket belongs to the attested ranges and that the resolver chooses the known visitor egress address in every case. Compare ephemeral in-memory HMACs or allowlisted booleans for candidate matching, same-budget behavior, and verified suffix length. Collect no raw IPs or header strings and remove temporary instrumentation after the test.
3. Keep the variable unset if any path is ambiguous. If Render cannot provide an exclusive, verifiable forwarding boundary, qualify a separately authenticated ingress before enabling visitor-budgeted operations. Production header diagnostics and configuration require founder authorization.

## PostgreSQL 17 installation rehearsal

The November 24 read-only catalog confirmed the authoritative Neon database `mysteryhub_standby_cutover_20261123` in project `patient-term-85828320`, branch `br-wild-boat-bji8j9fu`. The application role `mysteryhub_staging_owner` owns `public.analytics_events`, has database CREATE, and had active connections. The Experiences schema and all three named analytics indexes were absent. The required analytics columns and types matched, no applicable create or engagement event records existed, and Supabase client roles were absent. Recheck before installation.

On isolated PostgreSQL 17, the installation requires an application owner and rolls back atomically on conflicting index definitions, duplicates or a concurrent write blocking index creation. Three-second lock timeout bounds acquisition time. Once acquired, index creation can still block analytics writes while it runs. The DDL asserts the exact table, index keys and predicates, uniqueness and validity, and verifies owner-only private ACLs with RLS enabled and no policies. The migration does not run on application startup.

### Stage B installation commands, after separate approval

Use WSL Ubuntu or another trusted Linux host with PostgreSQL 17 `psql`, `pg_dump` and `pg_restore`. In the Render backend dashboard separately verify `MYSTERY_GREETING_LINKS_ENABLED`, `MYSTERY_GREETINGS_ENABLED`, and `MYSTERY_EXPERIENCES_ENABLED` are disabled and `SEASONAL_EXPERIENCE` is unset or off. Confirm `/ready` before scheduling a low-traffic window. Get the **direct** host for the existing project and branch from Neon Connect. Keep shell tracing disabled. Password prompts are interactive. A vetted 0600 password file can be used for repeat operations.

```bash
cd /path/to/current/verified/MYSTERY-HUB
umask 077
unset DATABASE_URL PGPASSWORD PGSERVICE PGOPTIONS PGHOSTADDR
export PGDATABASE=mysteryhub_standby_cutover_20261123
export PGUSER=mysteryhub_staging_owner PGPORT=5432 PGSSLMODE=verify-full
export PGSSLROOTCERT=/etc/ssl/certs/ca-certificates.crt
read -r -p 'Verified Neon direct hostname: ' PGHOST
export PGHOST
psql --version
pg_dump --version
psql -X -W -v ON_ERROR_STOP=1 <<'SQL'
SELECT current_database(), current_user, current_setting('server_version_num'),
       pg_get_userbyid(c.relowner) AS analytics_owner,
       has_database_privilege(current_database(),'CREATE') AS may_create_schema
FROM pg_class c WHERE c.oid='public.analytics_events'::regclass;
SELECT ssl,version FROM pg_stat_ssl WHERE pid=pg_backend_pid();
SELECT to_regnamespace('mysteryhub_experiences') AS existing_schema;
SELECT column_name,data_type,character_maximum_length,is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='analytics_events' ORDER BY ordinal_position;
SELECT schemaname,indexname,indexdef FROM pg_indexes
WHERE indexname IN ('experience_events_period','experience_event_once','experience_created_once');
SELECT count(*) AS duplicate_created_groups FROM (
 SELECT entity_id FROM public.analytics_events
 WHERE event_name='experience_greeting_created' AND entity_id IS NOT NULL
 GROUP BY entity_id HAVING count(*)>1
) groups;
SELECT count(*) AS duplicate_event_groups FROM (
 SELECT event_name,entity_id,visitor_id,session_id FROM public.analytics_events
 WHERE event_name IN ('experience_greeting_open','experience_greeting_reveal',
                      'experience_greeting_remix_started','experience_countdown_open',
                      'experience_discovery_open','experience_platform_navigation')
   AND entity_id IS NOT NULL AND visitor_id IS NOT NULL AND session_id IS NOT NULL
 GROUP BY event_name,entity_id,visitor_id,session_id HAVING count(*)>1
) groups;
SELECT mode,granted,count(*) FROM pg_locks
WHERE locktype='relation' AND relation='public.analytics_events'::regclass
GROUP BY mode,granted ORDER BY mode,granted;
SQL
```

Confirm the exact database name, role, PostgreSQL major, valid TLS, analytics ownership and compatible columns. Both duplicate counts must be zero. Stop on an unexpected schema, an index conflict or persistent write contention. Preserve all existing analytics records.

Take a fresh custom-format application archive to a protected, encrypted local directory. Use the seven app schemas in the [database runbook](./neon-temporary-cutover.md), plus Experiences if a reviewed earlier install already exists. A verified checksum and archive list are required. Verify a restore into a disposable empty PostgreSQL 17 instance and compare contents/structure with the archived snapshot and financial anchors before production installation. Keep the dump and all restore logs out of Git and shared terminals.

```bash
private_dir=$(mktemp -d /path/to/encrypted/local/volume/mh-greetings.XXXXXX)
archive="$private_dir/pre-greetings.dump"
pg_dump -W --format=custom --no-owner --no-acl --lock-wait-timeout=5s \
  -n public -n mysteryhub_ai_feedback_private -n mysteryhub_ai_private \
  -n mysteryhub_builder_private -n mysteryhub_notifications -n mysteryhub_operations \
  -n mysteryhub_sms --file="$archive" &&
sha256sum "$archive" > "$archive.sha256" &&
sha256sum -c "$archive.sha256" &&
pg_restore --list "$archive" > "$private_dir/archive-list.txt"
# Set the verified local test port/owner and a new empty disposable database.
read -r -p 'Local PostgreSQL 17 test port: ' disposable_port
PGSSLMODE=disable pg_restore -W -h 127.0.0.1 -p "$disposable_port" -U app_owner \
  -d mh_greetings_restore_test --exit-on-error --single-transaction --no-owner --no-acl "$archive"
```

Use explicit authorization for the optional DDL only after checking the restore, confirming the low-traffic window and rechecking the output above. Keep TLS strict for the Neon step. The file runs in one transaction and asserts private permissions.

```bash
psql -X -W -v ON_ERROR_STOP=1 -f server/db/mysteryExperiences.sql
psql -X -W -v ON_ERROR_STOP=1 <<'SQL'
SELECT c.relname,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='mysteryhub_experiences' AND c.relkind='r' ORDER BY c.relname;
SELECT count(*) AS policies FROM pg_policies WHERE schemaname='mysteryhub_experiences';
SELECT count(*) AS non_owner_acl FROM (
 SELECT acl.grantee FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) acl
 WHERE n.nspname='mysteryhub_experiences' AND acl.grantee<>n.nspowner
 UNION ALL
 SELECT acl.grantee FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN LATERAL aclexplode(c.relacl) acl
 WHERE n.nspname='mysteryhub_experiences' AND acl.grantee<>c.relowner
) grants;
SELECT id,lifecycle,enabled,preview_enabled FROM mysteryhub_experiences.configuration;
SQL
```

Require four tables owned by the runtime role, RLS enabled, zero policies and zero non-owner grants, plus the disabled draft row. Confirm Admin readiness says storage installed and public creation remains unavailable. A timeout or assertion failure is a rollback. Inspect sanitized diagnostics and repeat only after the cause is understood.

## Capacity and retention

The shared PostgreSQL pool has five slots with a two-slot per-process cap for Experiences, with 2s statement, 500ms lock and 5s idle transaction timeouts. Each statement counted below includes transaction overhead where applicable. Valid creation costs approximately 20 statements, plus three for optional creation analytics and one for an optional parent. Each recipient route lookup sends six statements, with about eight for a global lease refresh shared by up to 100 reads within 30 seconds or the end of the minute. The raw HTML link and subsequent JSON each require a lookup. A report costs approximately nine statements, including the budget writes. An accepted recipient analytics event takes ten, including its lookup and budget writes. An empty creator readiness check takes six or seven, shared across callers. These counts are a code-path model and exclude retries, timeouts, low-traffic lease wastage and external image bytes.

The optimistic delivery scenario below assumes three opens per greeting, each with both link HTML and greeting JSON, and two client analytics events per open. That gives roughly 119 SQL statements per greeting with analytics, plus lease refreshes, optional parent processing and exceptional paths. The storage model assumes about 8.25 KiB per greeting, including table/index data, amortized budget rows and seven analytics events. The database transfer range is a planning estimate of 24–60 KiB per greeting for queries, results and protocol overhead. WAL, page growth, Neon billing and internet asset traffic need separate observation.

| Created across the release | Opens | Extra SQL statements, approximate | Incremental stored MiB | Estimated application DB transfer MiB |
|---:|---:|---:|---:|---:|
| 100 | 300 | 11,900 | 0.8 | 2.3–5.9 |
| 1,000 | 3,000 | 119,000 | 8.1 | 23–59 |
| 5,000 | 15,000 | 595,000 | 40.3 | 117–293 |
| 10,000 | 30,000 | 1,190,000 | 80.6 | 234–586 |

The 1,000/day durable successful-creation cap means 5,000–10,000 greetings are multi-day scenarios. Existing caps include 20 successful creates and 240 creation requests per visitor hour, ten reports per visitor day, 60 management requests per visitor hour, 15 local create requests and 240 general local requests per minute per key. The store caps optional analytics at 180 per visitor hour and 10,000/day. The native synthetic run measured creation at 7.64 ms p50 and 10.47 ms p95 over eight samples, with a largest recipient JSON of 256 bytes. These figures include the local store workload and exclude WAN latency. Production region, cold compute, real traffic and checkout p95 are still unmeasured for this workload.

Before enabling creation, open Neon Console → project → Usage and record current and available compute, storage and public network transfer for the current allowance period. Check the production branch's endpoint metrics for concurrent connections, active/suspended compute, CPU and read/write latency and compare with comparable serving periods. Monitor Render's separate checkout/tracking p95, error rates, pool acquisition failures and Experiences 429/503 rates without logging visitor addresses. Check baselines before, during and after the controlled test. Pause creation if margin is inadequate, checkout is affected or expected per-visitor isolation fails. The estimates cannot establish free-plan headroom. [Neon plans and billing](https://neon.com/docs/introduction/plans)

Appoint a named Admin before activation. Check Greetings readiness and run the existing confirmed, audited maintenance daily during the initial launch, after a material traffic change and weekly once stable. Each run can remove up to 500 greetings expired or revoked more than 30 days ago, 5,000 abuse budgets older than 48 hours and 5,000 Experiences-only analytics records older than 90 days. Recheck readiness after each batch and repeat if overdue rows remain. Greeting lifetime stays 365 days across the seasonal rollover. Maintenance is isolated from finance and unrelated analytics. No new periodic worker was added.

## Activation and rollback

1. Verify the ingress evidence above. Under separate approval complete the backup qualification and schema installation with the public gates disabled. Set the reviewed proxy configuration. In a protected local directory use `umask 077; openssl rand -hex 32 > "$private_dir/greetings-abuse-secret"` to generate 64 hex characters. Transfer the value to the Render backend's approved secret storage without printing it and securely remove the local working copy when the recovery copy is secured. Preserve that same secret across a database move to keep active durable quotas and report deduplication coherent.
2. With separate links-only approval set `MYSTERY_GREETING_LINKS_ENABLED=true` and leave `MYSTERY_GREETINGS_ENABLED=false`. Verify Admin "Links only", the canonical unknown link 404/no-store/noindex, the JPEG asset and direct-origin behavior. Only links are qualified by this step.
3. Obtain approval for a tightly monitored real-domain test. If no access-controlled test location is proven equivalent, an expressly approved window on the actual public site of at most five minutes is required. Keep the seasonal switch off. Enabling `MYSTERY_GREETINGS_ENABLED=true` exposes the route to the public even without promotion. Monitor error rates, DB headroom and checkout p95. Use synthetic text only. Check a server-confirmed canonical link, independent-device retrieval, generic raw OG metadata and its JPEG, WhatsApp share preview, Android/iPhone where available, reporting and Admin moderation. Revoke the synthetic record and verify 404/no-store. Turn creation off at the end or immediately on an anomaly. Admin readiness indicates configured service capability. The request-specific templates response verifies the current visitor path.
4. Enable public creation only after founder approval and acceptance of the test evidence. Coordinate Christmas presentation separately with 3.6. `SEASONAL_EXPERIENCE` controls the legacy live presentation setting. `MYSTERY_EXPERIENCES_ENABLED` separately gates the persisted configuration API and its disabled seed. Neither grants permission to create a greeting.

For ordinary incident rollback, set creation off first and preserve existing links. Turn links off only when access itself must stop. Disable seasonal presentation independently. Public API and recipient HTML are no-store. The cached discovery signal can lag while the write endpoint enforces the gates. During quota, commerce or availability incidents, keep creation off and collect bounded diagnostics. Reports and creator actions on an unqualified path are unavailable. Use the authorized Admin moderation route for urgent cases. Do not drop the schema or switch databases as a Greetings rollback.

When returning from Neon to Supabase, use a fresh frozen snapshot and the reviewed isolated destination. Preflight accepts the seven required schemas plus the optional Experiences schema only when all four required tables are present. The clone copies that scope and compares content, indexes, constraints, RLS and target ownership including analytics. Preserve original share IDs, creator hashes, idempotency, budgets, reports and configuration. Keep the abuse secret out of archives and parity logs. A previous Supabase snapshot cannot replace the newer authoritative data.
