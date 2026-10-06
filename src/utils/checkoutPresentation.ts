/** Presentation choice only. The server still checks balance and authorizes every payment. */
export function preferredPaymentMethod(authenticated: boolean, balance: number | null, total: number, restricted = false): 'wallet' | 'paystack' {
  return authenticated && balance !== null && Number.isSafeInteger(balance) && Number.isSafeInteger(total) && !restricted && total > 0 && balance >= total ? 'wallet' : 'paystack';
}
