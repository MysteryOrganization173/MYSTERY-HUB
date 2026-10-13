export interface OrderResolution {
  version:number; stage:'under_review'|'refund_pending'|'resolved';
  outcome?:'paystack_refund'|'wallet_refund'; amountMinor?:number; paymentReference?:string;
  refundId?:string; providerStatus?:string; verifiedAt?:string; lastAttemptAt?:string;
  lastError?:string; lastActor:string; updatedAt:string;
  supplierEvidence?:{status:'failed'|'refund_pending'|'refunded'|'uncertain';note:string;actor:string;at:string};
}
export interface OrderResolutionEvent {id:string;order_id:string;request_id:string;input_hash:string;action:string;actor_id:string;created_at:string;result:OrderResolution}
