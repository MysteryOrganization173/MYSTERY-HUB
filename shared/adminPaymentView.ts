/** Read-only reporting predicates; never establish or mutate payment verification. */
export type AdminPaymentView = 'confirmed' | 'not_completed';
export function matchesAdminPaymentView(order:{payment_status:string;payment_provider:string;paid_at?:string|null},view:AdminPaymentView) {
 const customer=['paystack','wallet'].includes(order.payment_provider);
 return customer && (view==='confirmed' ? order.payment_status==='success' && Boolean(order.paid_at) : order.payment_status!=='success');
}
export const ADMIN_PAYMENT_VIEW_SQL:Record<AdminPaymentView,string>={
 confirmed:"payment_provider IN ('paystack','wallet') AND payment_status='success' AND paid_at IS NOT NULL",
 not_completed:"payment_provider IN ('paystack','wallet') AND payment_status<>'success'",
};
