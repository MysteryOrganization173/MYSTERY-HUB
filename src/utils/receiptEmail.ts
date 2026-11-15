/**
 * 3.4.1 receipt email. A receipt contact is separate from the sign-in email: remembering one never changes how the
 * customer signs in, and the server stores it only when the customer explicitly chooses "Remember".
 */
export const RECEIPT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ReceiptContacts { email?: string | null; receiptEmail?: string | null }

/** The address checkout starts with: a remembered receipt email first, then the sign-in email, else nothing. */
export function defaultReceiptEmail(user: ReceiptContacts | null | undefined): string {
  return user?.receiptEmail || user?.email || '';
}

/** "Remember" is offered to a signed-in customer only for a valid address that differs from the one already used. */
export function canRememberReceiptEmail(user: ReceiptContacts | null | undefined, typed: string): boolean {
  if (!user) return false;
  const email = typed.trim().toLowerCase();
  return email.length <= 128 && RECEIPT_EMAIL_PATTERN.test(email) && email !== defaultReceiptEmail(user).trim().toLowerCase();
}
