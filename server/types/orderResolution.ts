export type ManualResolutionOutcome = 'manual_fulfillment'|'external_compensation'|'supplier_failed_pending_remedy';
export type CustomerResolution = 'review'|'refund_pending'|'refund_confirmed'|'manual_fulfillment'|'external_compensation';
export interface OrderResolution {
  version:number; stage:'under_review'|'refund_pending'|'resolved';
  outcome?:'paystack_refund'|'wallet_refund'|'manual_fulfillment'|'external_compensation'; amountMinor?:number; paymentReference?:string;
  manual?:{outcome:ManualResolutionOutcome;reason:string;evidence:string;method?:string;reference?:string;actor:string;at:string};
  refundId?:string; providerStatus?:string; verifiedAt?:string; lastAttemptAt?:string;
  lastError?:string; lastActor:string; updatedAt:string;
  supplierEvidence?:{status:'failed'|'refund_pending'|'refunded'|'uncertain';note:string;actor:string;at:string};
}
export interface OrderResolutionEvent {id:string;order_id:string;request_id:string;input_hash:string;action:string;actor_id:string;created_at:string;result:OrderResolution}
