# Recipient verification Phase 1

Baseline: 143d54e9dc3cd4bce17eec1f020bd0a9ff8750d7. PR69 and PR104 stay held.

The beneficiary check is a non-purchasing POST /beneficiary-check, never /orders.
It does not enroll a recipient in a separately acknowledged verification queue.
No documented queue acknowledgment or verified policy establishes that generic
eligible:false means SIM-registration failure. Therefore customer copy says the
number **may** need additional verification, suggests tomorrow without a promised
approval date, and explicitly says enrollment cannot be confirmed. Technical
unknowns have different copy. verificationSubmitted stays false.

The server-only recipientVerification result associates recipient, selected
network/offer, provider, safe outcome/reason and observation time. It is not
persisted or logged. Only consistent, explicit SBH eligible evidence permits the
existing preflight. TELCOGH is unsupported. An explicitly mismatched returned
selector is unknown. Missing optional legacy echo fields remain compatible.
Phone format, prefix-based network hints (portability is possible), eligibility,
product availability and supplier wallet are separate evidence. There is no new
cross-provider qualification or requirement for other service types.

Regular checkout disables Pay and guards form submission while blocked. Changing
recipient invalidates denial; merely focusing/selecting the number cannot unlock
Pay. A fresh modal checks again. Existing request IDs, payment references,
uncertain initialization and tracking locks take precedence over rejection copy.
Wallet transports the same finite checkout error contract and ignores stale
callbacks. Neither client path is the server enforcement point.

Instant browsing appears only for same-network products with recipientAlternative
set by the catalogue API: canonical success:true, explicit available:true and a
recognized explicit network. Missing fields/defaulted availability cannot qualify
an alternative. This uses existing bounded supplier catalogue caches, not proof
of live stock or recipient eligibility. It adds one optional catalogue read after
a denial, no extra request on successful checkout and no purchase/auto-substitution.
Failure hides the suggestion. Existing Instant pricing, catalogue, preflight and
purchase contracts are unchanged; PR69 defects are not silently repaired.

Admin: reuse Sales Reliability and Service readiness/Supplier Routing. Confirmed
recipient denials currently aggregate with ordinary validation, not an outage;
unknown beneficiary responses/transport errors are operational failures. Wallet
low, catalogue, supplier service and successful preflight have existing separate
signals. No exact historical denial count or verification queue count can be
claimed. No fake order is created for preflight rejection. Dedicated durable
per-attempt verification history would be a separate scope/migration.

Admin-assisted Data orders already support complimentary/external collection
with durable audited authorization and mandatory preflight. They execute SBH
fulfillment; they are not a general recorder for independently fulfilled TELCOGH
purchases. Existing resolution evidence must distinguish supplier completion,
recipient delivery, external collection and customer refund. No new manual order
or dispatch action is introduced.

No schema, production SQL, pricing, campaign, payment verification, dispatch or
supplier credentials change. The separate direct-telecom crash-window repair has
not merged. This work blocks earlier and adds no supplier POST/retry/financial
transition, so it does not depend on or claim to resolve that separate limitation.

## Future phases

2. Disabled TELCOGH adapter: obtain real products/balance/data/airtime/status JSON,
map exact IDs and validity, validate response/error schemas, wallet float/402 key
behavior and rate budget. Keep purchase operations disabled and test with mocks.
3. Cross-supplier qualification: verify SBH permission and product-specific
semantics, explicit offer mappings, deny/unknown/recovery policy and portability;
SBH approval cannot guarantee TELCOGH delivery. Controlled recipient tests require
separate authorization and evidence of actual delivery.
4. Operations/activation: separately authorize persistent versioned/audited routes,
manual recording vs dispatch, dispute/delivery evidence, idempotency and ambiguous
acceptance recovery, low-value live tests and founder-approved activation. No
production migration or activation is part of Phase 1.

Validation: npm test, npx tsc --noEmit, npm run build, git diff --check;
python scripts/reviewRecipientVerification.py uses real components and synthetic
APIs at360/390/430/768/1280px. Screenshots are /tmp/recipient-verification-browser.
No real Android keyboard or live purchase is claimed. Existing native database CI
checks remain required; there are no schema changes to install or roll back.
