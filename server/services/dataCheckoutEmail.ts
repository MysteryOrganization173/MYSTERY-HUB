import { createHash } from 'node:crypto';
import { normalizeEmail } from '../utils/authValidation.js';
import { FinanceError } from '../db/financeStore.js';
import type { OrderRecord } from '../types/orders.js';

/** Only real contact email is stored. A provider alias is never an identity or receipt inbox. */
export function dataReceiptEmail(supplied: unknown, accountEmail: unknown): string {
  if (supplied !== undefined && supplied !== null && supplied !== '') {
    if (typeof supplied !== 'string') throw new FinanceError('Enter a valid receipt email or leave it empty.');
    if (supplied.trim()) {
      const email = normalizeEmail(supplied);
      if (!email) throw new FinanceError('Enter a valid receipt email or leave it empty.');
      return email;
    }
  }
  return normalizeEmail(accountEmail) || '';
}

/** Stable per persisted backend order; no phone/account identifiers or contact-field writes. */
export function dataPaymentEmail(order: Pick<OrderRecord, 'id' | 'customer_email'>): string {
  return normalizeEmail(order.customer_email) ||
    `order-${createHash('sha256').update(order.id).digest('hex').slice(0, 40)}@mysterybundlehub.com`;
}
