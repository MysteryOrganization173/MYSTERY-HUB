# Managed data storefront checkout restoration

## What was disconnected

[PR #143](https://github.com/MysteryOrganization173/MYSTERY-HUB/pull/143) left catalogues and tracking available and disconnected new managed storefront payments. The React storefront tested the main shared-merchant allowlist, the public checkout route and service rejected the storefront purpose, and the Paystack adapter rejected persisted storefront context and `purpose` metadata. All of these boundaries applied even to a fully configured and published store.

## Merchant and settlement evidence

The existing transaction is initialized through Mystery Hub’s server-held Paystack credentials in GHS. The purchase preserves the `MH_STORE_` payment reference, `website_store_order` purpose, site, product and order identifiers. Mystery Hub verifies the Paystack payment and fulfills the bundle through its supplier account. The storefront owner configures their managed retail price against the platform’s wholesale and processing policy. The durable order records the site, owner, retail, wholesale, supplier cost, fee reserve and reseller earning. The reseller’s earnings are recorded in a separate ledger, become available after confirmed delivery and use the existing reviewed withdrawal and reversal flows. Mystery Hub retains payment recovery, supplier uncertainty, refund review and customer order evidence.

This is technically a Mystery Hub collection and fulfillment flow with retailer branding and reseller compensation. There is no separate Paystack account or provider-side split for each storefront in the path. The software cannot establish who is legally authorized to be merchant of record or whether Paystack permits the arrangement. Obtain written scope confirmation covering branded storefronts, the settlement and reseller compensation model, and any conditions of the settlement restriction. Account acceptance, prior successful charges and the fact that the products are data bundles do not establish approval.

## Scope and safeguards

- The explicit server-only setting `MANAGED_DATA_STOREFRONT_CHECKOUT_ENABLED` must equal `true`. Unset or false returns the established unavailable response before supplier, order, finance or Paystack work. Production also requires a live merchant key and configured, enabled supplier fulfillment. There is no Admin or client-side activation switch.
- A published Data Reseller snapshot, active supported plan, enabled store policy, wholesale and retailer prices, processing reserve and valid Ghana recipient are required. Product, network, amounts and supplier offer are resolved server-side. The display price is an expected integer-pesewa value, validated before a payment attempt is created. The product’s network must be open in Service Control. Beneficiary, service, offer/cost and supplier-wallet preflight run before payment initialization.
- An order and versioned checkout intent commit in the same database transaction. The site and its unchanged owner are checked through that transaction’s connection. Only the newly created intent can call the dedicated adapter path. The adapter derives exact provider metadata, reference and amount from matching committed records. Main checkout still rejects storefront context and references. A gateway response with a different reference or no access code is held for recovery.
- An idempotent retry can recover the same access code only while price, availability, supplier offer and cost still agree, and the original order remains pending and unpaid. Older attempts remain available in tracking and reconciliation. Changing the new checkout switch does not revoke payment URLs already issued by Paystack.
- The existing Paystack verification, webhook signatures, supplier submission claims, refund/reversal handling, earnings and order tracking are used. This change does not create a migration, a second merchant account or any new funding obligation or ledger entry type.

## Approval and activation

1. Obtain written merchant-scope approval for the actual reseller model. If approval covers a smaller set of storefronts or products than the current publication and catalogue policy, keep the flag off until enforcement matches that scope.
2. Obtain founder approval and confirm settlement access and enough working capital to cover current paid work, expected overlapping checkouts, and refunds. Confirm supplier balance and service/recipient readiness, current Admin wholesale and processing policy, and publication/pricing for each participating storefront. Balance preflight is a point-in-time check. It does not reserve supplier float across concurrent buyers or protect against later supplier failure.
3. Verify the intended backend and frontend revisions are live. After approval, explicitly set `MANAGED_DATA_STOREFRONT_CHECKOUT_ENABLED=true` on the Render backend through the existing authorized configuration workflow. Refresh the public storefront and verify that only eligible managed catalogues offer purchase. Verify restricted services still show their existing disabled state.
4. Any real payment or supplier test requires its own approval and funded maintenance window. Observe payment verification, order dispatch, tracking, and earnings for the controlled order before opening normal traffic. Monitor supplier float, pending paid orders, and reversals during rollout.
5. On insufficient capital, loss of scope authorization, or operational problems, set the flag false and verify the storefront reports checkout unavailable. Continue tracking and reconciling previously issued payment links through existing workflows.

The code release is dormant. It changes no production environment setting, credential, settlement state or records.
