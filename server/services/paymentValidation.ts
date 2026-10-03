import type { OrderRecord } from '../types/orders.js';
import type { PaystackVerifyResult } from './paystackService.js';

/** Shared validation for server verification, signed webhooks and reconciliation. */
export function validateOrderPayment(
  order: OrderRecord,
  payment: Pick<PaystackVerifyResult, 'isVerified' | 'status' | 'amountPesewas' | 'currency' | 'reference' | 'isSimulated'>
): string | null {
  if (!payment.isVerified || payment.status !== 'success') return 'payment_not_successful';
  if (payment.reference !== order.payment_reference) return 'payment_reference_mismatch';
  if (typeof payment.currency !== 'string' || payment.currency.toUpperCase() !== order.currency) {
    return 'payment_currency_mismatch';
  }
  // Only the explicitly generated, keyless development simulation can omit an amount.
  const devSimulation = payment.isSimulated === true && process.env.NODE_ENV !== 'production'
    && !(process.env.PAYSTACK_SECRET_KEY || '').trim();
  if (!devSimulation && (!Number.isSafeInteger(payment.amountPesewas)
    || payment.amountPesewas <= 0 || payment.amountPesewas !== order.amount)) {
    return 'payment_amount_mismatch';
  }
  return null;
}
