# Admin reseller bulk pricing

This release adds engineering controls only. It does not seed, migrate, or change live wholesale, activation, reserve, seller retail, historical order snapshots, or ledgers.

## Workflow

In Admin Reseller Settings, choose one configured network and optionally individual plans. Enter a per-GB wholesale rate in GHS. Optionally choose a larger-bundle threshold and discount (0–50%); the discount applies to the whole qualifying bundle and may create a price step at the threshold. Start with no discount unless the supplier’s actual per-plan costs support it. A blank rate preserves existing wholesale prices. All networks can be selected for activation/deactivation with prices preserved. The existing global managed-payments policy and per-plan manual editor remain available.

Preview is read-only. It fetches one uncached supplier catalogue and resolves exact packages through the existing supplier resolver. Each row shows current and proposed wholesale, current supplier cost (minimum permitted wholesale), minimum customer retail including the configured reserve, reserve at that minimum, gross platform spread, proposed activation and validation errors. Missing or ambiguous supplier costs block pricing/activation; status-only deactivation remains possible during supplier outages. Unconfigured disabled plans remain unconfigured.

After confirmation, apply obtains the existing exclusive store-config transaction lock and recalculates using another fresh supplier catalogue. An actor-bound SHA-256 revision covers the proposal, policy, previous selected plan versions and resolved economics. Changed supplier costs, selected prices, policy or actor invalidate the preview (409). Apply uses a single wholesale configuration write and an audit insert in the same PostgreSQL transaction. Any failure rolls back all changes. No partial apply. Duplicate apply cannot reapply changed selected rows. No database migration is required.

The audit includes actor/time, proposal, policy revision and per-plan before/after values. Recent reseller audit records are available in the reseller panel. Both endpoints use the existing requireAdmin boundary and sensitive-action rate limiter. Checkout still independently checks supplier affordability, recipient eligibility and pricing; a preview does not reserve supplier funds or guarantee future supplier availability. External supplier prices can change after apply.

## Economics

Wholesale spread = wholesale minus supplier cost. The processing reserve is separately deducted from the customer’s retail payment; seller earning = retail minus wholesale minus reserve. Do not subtract the same reserve from wholesale twice.

Example only, not a production change: supplier cost GH₵4.00 and wholesale GH₵4.10 produce GH₵0.10 platform gross spread. At 2% reserve with no fixed reserve, the existing half-up pesewa rounding permits GH₵4.18 customer retail: reserve GH₵0.08 and seller earning GH₵0.00. GH₵4.10 customer retail is below the permitted floor for GH₵4.10 wholesale. Other expenses (supplier funding, payouts, refunds, support and infrastructure) are not represented by gross spread and may consume it. The actual merchant agreement determines processing fees; the configured reserve is not a guarantee of fee coverage. No new fee assumptions or financial policy defaults are introduced.

## Validation and release

Regression coverage includes nonlinear supplier costs, fresh snapshot resolution, outage deactivation, all-network selection, discounts/rounding, malformed inputs, admin-only APIs, confirmation, stale costs/prices/policy, actor-bound revisions, concurrent apply, preserved seller prices and historical paid-order snapshots, exclusive PostgreSQL config locking, before/after audit and rollback on config/audit failure. Database boundary tests mock PostgreSQL; they do not contact a database. Full regression, type checking and production build are release gates. Merge can trigger Render auto-deploy; no manual deployment or production settings action is part of this release.

## Current release blocker

On unchanged main `13493d3b992e42ef04911a2e04552f7de498f5ab`, `websiteBuilderV1.test.ts:93` fails: expected template business name `QuickByte Data`, actual `Ghana Data Express`. This is outside reseller bulk pricing and is reproduced in a separate untouched checkout. Do not merge this PR while the required full-regression gate fails. Three additional initial failures were Windows CRLF-sensitive comparisons in unchanged files; using original LF file contents resolves those without a Git diff. Focused reseller/transaction tests: 125 pass. Type checking and production build pass. PostgreSQL tests mock the SQL boundary; no live database smoke test or production browser acceptance test was performed.
