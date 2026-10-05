# Data purchase journey polish

Branch: `feat/data-purchase-ux-polish`. Base: `e4c01d1148ae4740f468f81b9cf4f90dd62ff7ca`.

The existing Data catalogue opens `CheckoutModal`, which uses the existing server initialization endpoint and official Paystack Inline V2 access-code handoff. Its completion callback opens `OrderStatusModal`; Orders also opens that same receipt after a reference lookup. This pass reuses those surfaces rather than adding a separate success route or payment flow.

## Customer changes

- Both catalogue views retain the original bundle prices and network identities. Prices have stronger hierarchy, validity comes from the selected bundle, and delivery information comes from existing `serviceNotices`. Buttons and recipient inputs have larger touch targets; decorative card glows are removed.
- Regular Data checkout first reviews the recipient, then displays one final network/bundle/recipient/total confirmation. Customers can edit the recipient or return to the catalogue to change package. Wallet and Paystack remain the existing payment choices; no accounting or price calculation is changed.
- Short inline guidance covers recipient verification, potentially irreversible fulfilled wrong-number orders, network delays and Track Order. It adds no legal modal or backend acknowledgement, so no session acknowledgement/storage is necessary.
- Connecting/opening/Wallet states are visible, submissions are disabled while busy and a synchronous frontend guard prevents repeated submit events. Initialization errors stay in one persistent accessible callout with retry, correction and tracking guidance instead of duplicated warning toasts.
- Data receipts use authoritative server status to display payment confirmation, processing and delivery. A popup callback, local status or mere payment reference does not mark payment confirmed. Queued, processing, delivered, failed, manual review, pending/refunded and cancelled/expired states have distinct next steps. No invented percentage progress is shown for Data.
- References and product details wrap on narrow screens. Recipients are masked in receipts and tracking; existing public masks are preserved. Tracking rows support keyboard activation, show next steps and explain the distinction between reference-based server lookup and phone-based filtering of displayed orders.
- Data orders opened directly from server lookup now update the active receipt even when absent from the legacy local order array. This extends the existing AFA frontend status-update pattern; backend fulfilment and verification are unchanged.

## Verification

190/190 relevant tests passed, including new authoritative-status/masking tests and rendered catalogue price/validity/delivery assertions, existing Data/card/checkout/order/Instant tests and shared Wallet/AFA/auth-bootstrap regressions. TypeScript, production build and diff check passed. The large unrelated regression suite was not rerun.

An isolated local preview used synthetic payment initialization, errors, callbacks and order responses without database access, supplier dispatch or real Paystack transactions. Catalogue card/compact modes, recipient entry, confirmation, connecting/error states, processing receipt and tracking were checked at 360, 390, 430, 768, 1024, 1280 and 1440 pixels with no horizontal overflow. Recipient correction and reference lookup were exercised. Terminal/refund/cancelled/manual-review messaging is covered by tests; this is not a claim of a live telecom/payment test.

## Paystack branding handoff

Existing initialization already carries public order reference, recipient, network, service type, product ID and bundle name. These fields and the official access-code handoff remain unchanged. No unsupported title/logo options, credentials or client-controlled financial metadata were added.

Before release, an authorized operator should check the Paystack business logo in Settings → Preferences, confirm the customer-facing trading name and receipt support contact, and verify the hosted checkout appearance using an approved test transaction. The logo appears on checkout according to [Paystack preferences documentation](https://support.paystack.com/en/articles/2131010). Trading-name changes use the dashboard review process described in [Paystack business-name documentation](https://support.paystack.com/en/articles/10264642). No dashboard settings were changed by this pass.

## Scope

Files: `src/components/data/BundleCard.tsx`, `CompactBundleRow.tsx`, `DataPage.tsx`; `src/components/checkout/CheckoutModal.tsx`, `OrderStatusModal.tsx`; `src/components/orders/OrdersPage.tsx`; `src/context/AppContext.tsx`; `src/utils/dataPurchasePresentation.ts`; `server/suppliers/__tests__/dataPurchaseJourney.test.ts`, `bundleCardCompression.test.ts`; this report.

No database schema, Wallet/Earn accounting, Paystack verification, supplier API, fulfilment, Website Builder, Admin controls, bundle prices or environment files were changed. Commit/push only the feature branch; no merge or deployment is authorized by this pass.
