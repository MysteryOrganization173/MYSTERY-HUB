/** Read-only evidence labels. These are never order/payment state transitions. */
export const RECONCILIATION_GROUPS = {
 completed:'Payment + delivery recorded', awaiting_confirmation:'Awaiting confirmation', unpaid_closed:'Closed without confirmed payment',
 monitoring:'Monitoring progress', needs_review:'Needs investigation', evidence_unavailable:'Evidence unavailable',
 resolved:'Resolved / other recorded outcomes', not_applicable:'Not a verified purchase',
} as const;
export type ReconciliationGroup=keyof typeof RECONCILIATION_GROUPS;
type Definition={group:ReconciliationGroup;label:string;explanation:string};
export const RECONCILIATION_REASONS:Record<string,Definition>={
 completed:{group:'completed',label:'Payment and delivery recorded',explanation:'Stored payment confirmation and dated delivery agree. This report does not re-query Paystack or the supplier.'},
 awaiting:{group:'awaiting_confirmation',label:'Payment not yet confirmed',explanation:'Checkout initialization is not payment. Closing a browser or a missing callback does not prove the external payment failed.'},
 unpaid_closed:{group:'unpaid_closed',label:'Closed without recorded payment',explanation:'No payment, supplier acceptance or delivery is recorded. Late payment confirmation may still arrive; no claim is made about the customer’s external account.'},
 progressing:{group:'monitoring',label:'Paid; fulfillment progressing',explanation:'Payment is recorded. The order is still progressing; this is not evidence of delivery or a refund obligation.'},
 mtn_review_due:{group:'needs_review',label:'MTN processing window exceeded',explanation:'Recorded paid MTN Data progress exceeds the documented exceptional 48-hour window. Review the existing order; elapsed time does not prove failure or justify a refund.'},
 finance_conflict:{group:'needs_review',label:'Financial evidence disagrees',explanation:'Linked operation identities, amounts, currency, price snapshots or ledger entries disagree. Investigate the original records; this report cannot establish a customer remedy.'},
 payment_conflict:{group:'needs_review',label:'Payment and order facts disagree',explanation:'Payment is not confirmed but payment, supplier or fulfillment facts are present, or the recorded payment and order lifecycle conflict.'},
 payment_incomplete:{group:'evidence_unavailable',label:'Payment evidence incomplete',explanation:'Success is labelled but its recorded payment timestamp, reference, currency or amount is insufficient. No verified payment/delivery claim is made.'},
 uncertain_submission:{group:'needs_review',label:'Supplier acceptance uncertain',explanation:'A possibly accepted supplier submission needs the existing reconciliation workflow. Never repeat the supplier submission because of this report.'},
 review_flag:{group:'needs_review',label:'Existing review remains open',explanation:'The order is flagged for review. A flag is operational evidence, not proof that customer money is owed.'},
 remedy_open:{group:'needs_review',label:'Paid outcome needs evidence',explanation:'A stopped paid order has no complete customer resolution. Supplier reimbursement or a failure status alone does not prove a customer refund or debt.'},
 delivery_incomplete:{group:'evidence_unavailable',label:'Delivery timestamp unavailable',explanation:'The stored status says delivered, but a delivery timestamp is absent. The report will not invent one or count this as dated completed delivery.'},
 resolution_incomplete:{group:'evidence_unavailable',label:'Resolution evidence incomplete',explanation:'Resolution facts or their matching history are incomplete or inconsistent. A resolved label alone is not proof of delivery, compensation or refund.'},
 manual_fulfillment:{group:'resolved',label:'Operator-attested service completed',explanation:'Structured operator evidence and matching history close the customer case. The original supplier status and delivery timestamp are unchanged.'},
 external_compensation:{group:'resolved',label:'Operator-attested external remedy',explanation:'A documented external remedy closes the case. This is not a provider-verified refund or supplier delivery.'},
 paystack_refund:{group:'resolved',label:'Processed Paystack refund recorded',explanation:'Exact original-payment refund evidence and matching history are recorded as processed. This does not prove funds are already visible in the customer’s bank or MoMo account.'},
 wallet_refund:{group:'resolved',label:'Original Wallet refund recorded',explanation:'Resolution history and the exact original purchase debit and refund credit agree. No new credit is made.'},
 wallet_refund_unreconciled:{group:'evidence_unavailable',label:'Wallet credit exists; resolution incomplete',explanation:'A matching original Wallet refund credit exists, but formal order resolution is incomplete. Inspect that credit and the existing workflow; do not issue another refund based on this report.'},
 refund_progress:{group:'monitoring',label:'Customer refund verification in progress',explanation:'Matching customer-refund evidence is pending or processing. It is not a completed refund. Review its timestamps in the existing order workflow.'},
 earnings_pending:{group:'monitoring',label:'Delivery recorded; earnings sync pending',explanation:'Recorded delivery exists, but the seller earning is not yet available. Existing reconciliation owns any change; this report cannot credit earnings.'},
 earning_unbacked:{group:'needs_review',label:'Available seller earning needs review',explanation:'An available seller earning lacks matching paid, non-review delivery or its expected ledger/snapshot. Seller earnings are a separate liability, not platform profit.'},
 reversal_open:{group:'needs_review',label:'Financial reversal needs review',explanation:'An existing restricted or incomplete reversal requires the established finance workflow. No balance is changed by reporting.'},
 missing_order:{group:'needs_review',label:'Required linked order missing',explanation:'A finance operation has no valid expected order link. Neither payment collection nor delivery can be inferred from the operation alone.'},
 missing_funding:{group:'needs_review',label:'Required linked funding record missing',explanation:'A recorded reversal has no original funding operation. Inspect the existing finance history; no customer credit, refund or debt is inferred.'},
 funding_credit:{group:'resolved',label:'Verified Wallet funding credit recorded',explanation:'The saved funding verification and exact Wallet credit agree. This is wallet funding, not purchase revenue.'},
 funding_reversed:{group:'resolved',label:'Wallet funding reversal recorded',explanation:'The original funding credit and matching compensating debit agree. This does not initiate a provider refund.'},
 funding_uncertain:{group:'evidence_unavailable',label:'Wallet funding outcome unconfirmed',explanation:'Initialization or verification evidence is insufficient. Use the existing funding workflow; no credit or failure is assumed.'},
 funding_failed:{group:'unpaid_closed',label:'Funding closed without Wallet credit',explanation:'A stored negative funding verification and no Wallet credit are recorded. No live provider verification was performed by this report.'},
 resolved_review:{group:'resolved',label:'Finance review closure recorded',explanation:'The existing finance workflow recorded this review as resolved. Inspect its finance history for the underlying evidence.'},
 non_payment:{group:'not_applicable',label:'Complimentary / operator-recorded activity',explanation:'This is not a server-verified Paystack or Wallet purchase and is excluded from completed-purchase counts.'},
 test_record:{group:'not_applicable',label:'Registered synthetic history',explanation:'Explicitly registered test provenance. Excluded from default counters; shown only for an exact lookup.'},
 unknown:{group:'evidence_unavailable',label:'Unsupported or incomplete evidence',explanation:'The existing record does not support a safe classification. Inspect the original authorized workflow.'},
};
export interface ReconciliationRow {
 key:string;orderReference:string|null;operationId:string|null;financeUserId:string|null;service:string;recordType:'order'|'topup'|'review'|'orphan';
 amountMinor:number;currency:string|null;paymentStatus:string|null;fulfillmentStatus:string|null;marketplaceStatus:string|null;operationState:string|null;
 createdAt:string;updatedAt:string;paidAt:string|null;deliveredAt:string|null;resolutionAt:string|null;archived:boolean;
 code:string;group:ReconciliationGroup;label:string;explanation:string;requiresInvestigation:boolean;
}
export interface ReconciliationReport {
 generatedAt:string;scope:string;counts:Record<ReconciliationGroup,number>;total:number;filteredTotal:number;
 rows:ReconciliationRow[];limit:number;offset:number;
}
