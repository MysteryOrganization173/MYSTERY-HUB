# Mystery Experiences V1 verification record

Base remote main:7de758510d1fcc797f35a4e1e1a1526e3d575d52. All examples/data are synthetic. No production database connection, schema installation, financial transaction, activation, merge or deployment occurred.

| Check | Executed result |
| --- | --- |
| Baseline full `npm test` |3,224passed /0failed /46optional skips (3,270total) |
| Focused `mysteryExperiences.test.ts` |16passed /0failed /0skipped |
| Final full `npm test` |3,240passed /0failed /47optional skips (3,287total) |
| Isolated native PostgreSQL/HTTP/raw HTML suite |18passed /0failed /0skipped |
| `npx tsc --noEmit` |Passed |
| `npm run build` |Passed; existing large-chunk advisory remains |
| `git diff --check` |Passed |

The extra full-suite skip is the new opt-in native PostgreSQL suite, executed separately against a disposable loopback database. Native tests used PostgreSQL17, non-superuser/nobypassrls app_owner and synthetic client roles; no Supabase production SQL was run. CI is extended to run the same suite in its own disposable database; final CI status is recorded on the PR.

## Demonstrated behavior

- Each Accra phase boundary, start/end exclusivity, default-off/approval/enablement separation, unsupported definition fail-closed, override expiry and countdown midnight behavior.
- Actual authenticated Admin HTTP configuration/preview succeeds, while guest/customer mutation is rejected. Preview does not change persisted state. Concurrent revisions have one winner; injected audit failure rolls the edit back.
- Anonymous HTTP creation commits a random canonical link. A second independent HTTP request retrieves the stored content with no creator localStorage. Hidden sender is absent in storage and retrieval.
- Lost-response replay and concurrent retries return the same link; conflicting payloads and repeated identical changed-key content are rejected. Share collision retries are tested.
- Fresh Node process reads persisted state/content. A separate process observes the exhausted global read budget. Injected COMMIT failure cannot leave usable read credits.
- SQL schema installation failure rolls back, installation is repeatable, startup does not install it, RLS is enabled and client roles cannot SELECT/INSERT/UPDATE/DELETE. Service-role schema access is denied.
- Real local Express HTML responses contain generic OG/Twitter/canonical/noindex metadata without names, custom message, management secret or query injection. Crawler GET does not increase engagement counts. Unknown/revoked404 and storage503 are tested.
- Creator revocation requires the independent secret, repeats safely and removes API/HTML access. Valid greetings remain after Jan6; expiry is separate from global presentation.
- Bot/DNT/GPC/prefetch event exclusion, event deduplication, rejected PII/financial event claims, opt-out parent suppression and optional analytics failure are tested.
- Wrong management credentials consume durable budget; reports deduplicate and respect limits; moderation/retention are audited. Retention blocks new creation when overdue; no order or finance-ledger records were created by these flows.
- Invalid/oversized personal JSON produces sanitized400/413 without echoing body/stack.

Independent read-only review agent audited architecture and final code, independently ran focused16/16 and diff checks, and found no remaining high/critical issue after fixes. Review caught durable admission, privacy opt-out parent links, parent index, read single-flight, scalar validation and pre-COMMIT credit issues; these were fixed before PR creation. The reviewer did not independently run PostgreSQL; those18tests were executed by the implementation agent.

## Limits of the evidence

No new visual frontend or Admin panel was authored; no visual/Android acceptance is claimed. Raw HTML tests used the real backend responder with a local index shell, not an invented greeting UI. A static SPA and the current frontend router alone cannot complete the recipient journey. Canonical production routing, Claude's creator/recipient/countdown/artwork integration, proxy identity/tuning, retention operations, schema/role installation and explicit activation remain separate launch gates.

Existing approved app-preview image was checked via safe public GET:HTTP200,image/jpeg. It is an interim branded asset, not final festive artwork. No actual WhatsApp send/crawler cache refresh or production load test was performed. Indexed point reads, batch quota leases, bounded two-transaction workload and timeout behavior are verified structurally/in fixtures, not a production capacity certification.
