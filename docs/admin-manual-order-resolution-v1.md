# Admin Manual Order Resolution V1

Extends the existing Admin Orders resolution endpoint with `resolve_manual` and three typed outcomes:

- `manual_fulfillment`: operator confirms service completed through another legitimate channel; resolves the customer case without claiming the original supplier delivered.
- `external_compensation`: operator confirms an actual external remedy with method and transaction/reference evidence; resolves the case as operator-attested, never `refund_confirmed` or Paystack-verified.
- `supplier_failed_pending_remedy`: records failure evidence, keeps the paid customer case under review and in Needs Attention, even if its review flag is removed.

All require verified payment, an eligible stopped order, an operational reason, evidence, explicit confirmation and the existing revision/request-ID contract. Actor/time are server recorded. Existing or attempted customer refund evidence, delivered/refunded orders, active/unknown supplier responses and uncertain supplier acceptance block closure. A nested supplier failure is read from the provider response data envelope before its API transport status.

Order/payment/supplier facts remain unchanged. Only resolution JSON, its timestamp/review flag, append-only history and administrative audit are written together under the existing row lock. No Wallet, Paystack, supplier, rewards, Welcome Offer, Store Earnings or pricing operation is initiated. There is intentionally no reopen action: this pass does not overturn completed remedies. Incompatible cases require evidence reconciliation through the existing workflow, not an override.

Admin sees the outcome, actor, date, reason and evidence. Public/account DTOs expose only a fixed safe resolution code; customer text distinguishes manual service and external remedy from verified refunds. No private evidence, method, reference or actor enters public tracking. Needs Attention filtering/counts exclude resolved cases in both PostgreSQL and memory while retaining unresolved paid failures. Ordinary status filters still show the original supplier state. Existing recipient duplicate-order protections are unchanged.

Uses existing JSONB/history schema and permissions; no migration or environment variable is added. Deploy backend before frontend if coordinating deployments. Both versions retain the same endpoint; an older backend rejects the new action without mutation. Do not use the controls operationally until both services are confirmed at the release SHA.

Verification: focused manual/refund/admin/financial/privacy boundary tests; standalone disposable PostgreSQL test with independent connections, queue/count parity, unchanged financial ledger and post-write order/audit/history rollback; TypeScript; production build; diff check. Compiled synthetic Admin at 360/390/430px confirms each outcome, readable forms without horizontal overflow, retained supplier state and the unresolved queue. Private screenshots/logs stay outside Git.

Production smoke is read-only: inspect controls and authorization, never submit a resolution against a real customer case. Founder operational reconciliation remains a separate decision. Rollback is a normal Git revert/redeploy; never delete history or rewrite resolution/financial records. Before rollback, account for any manual outcomes already recorded: the old frontend does not understand the new labels.
