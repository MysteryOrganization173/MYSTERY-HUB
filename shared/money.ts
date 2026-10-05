/** GHS amounts are integer pesewas. Basis-point fees round half up, using bigint. */
export const MAX_MONEY_MINOR = 100_000_000;
export class MoneyValidationError extends Error {}
export function moneyMinor(value: unknown, allowZero = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > MAX_MONEY_MINOR) throw new MoneyValidationError('Enter a valid amount in pesewas.');
  return value;
}
export function percentMinor(amount: number, bps: number): number {
  moneyMinor(amount, true);
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) throw new MoneyValidationError('Percentage must be between 0 and 100%.');
  return Number((BigInt(amount) * BigInt(bps) + 5000n) / 10000n);
}
export function parseGhs(value: string): number {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value.trim())) throw new MoneyValidationError('Use a positive amount with at most two decimal places.');
  const [whole, fraction = ''] = value.trim().split('.');
  return moneyMinor(Number(whole) * 100 + Number(fraction.padEnd(2, '0')));
}
export const formatGhs = (minor: number) => `GH₵${(minor / 100).toFixed(2)}`;
