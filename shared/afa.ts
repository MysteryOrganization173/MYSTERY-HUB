import { validateAndNormalizeGhanaPhone } from '../server/utils/phone';

export const GHANA_REGIONS = ['Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West', 'Volta', 'Western', 'Western North'] as const;
export interface AfaPayload { name: string; phone: string; idNumber: string; occupation?: string; location: string; region: string; dateOfBirth: string }
export class AfaValidationError extends Error { constructor(public field: string, message: string) { super(message); } }
export function normalizeGhanaCard(value: unknown): string {
  const card = typeof value === 'string' ? value.trim().toUpperCase().replace(/\s/g, '') : '';
  const match = card.match(/^GHA-?(\d{9})-?(\d)$/);
  if (!match) throw new AfaValidationError('idNumber', 'Enter a valid Ghana Card number: GHA-#########-#.');
  return `GHA-${match[1]}-${match[2]}`;
}
export function validateAfaPayload(input: Record<string, unknown>, today = new Date().toISOString().slice(0, 10)): AfaPayload {
  const text = (field: string, limit: number, required = true) => {
    const value = input[field];
    if (!required && (value === undefined || value === '')) return '';
    if (typeof value !== 'string' || !value.trim() || value.length > limit || /[<>\x00-\x1f]/.test(value)) throw new AfaValidationError(field, `Please check ${field === 'name' ? 'your full legal name' : field}. Maximum ${limit} characters.`);
    return value.trim();
  };
  const name = text('name', 128), location = text('location', 128), region = text('region', 32), occupation = text('occupation', 128, false);
  if (!(GHANA_REGIONS as readonly string[]).includes(region)) throw new AfaValidationError('region', 'Select a Ghana region.');
  const rawPhone = text('phone', 32), phone = validateAndNormalizeGhanaPhone(rawPhone);
  if (!phone.isValid) throw new AfaValidationError('phone', 'Enter a valid Ghana mobile number.');
  const dateOfBirth = text('dateOfBirth', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || !Number.isFinite(Date.parse(dateOfBirth)) || new Date(dateOfBirth).toISOString().slice(0, 10) !== dateOfBirth || dateOfBirth > today || dateOfBirth.startsWith('0000')) throw new AfaValidationError('dateOfBirth', 'Enter a valid date of birth that is not in the future.');
  return { name, phone: phone.formattedLocal!, idNumber: normalizeGhanaCard(input.idNumber), location, region, dateOfBirth, ...(occupation ? { occupation } : {}) };
}
export function afaStatusLabel(status?: string, manualReview = false): string {
  if (manualReview && ['paid','queued','submitted','processing','failed'].includes(status || '')) return 'Needs Attention';
  return ({ pending_payment: 'Awaiting Payment', paid: 'Payment Confirmed', queued: 'Payment Confirmed', submitted: 'Submitted for Registration', processing: 'Registration Processing', delivered: 'Registered', failed: 'Needs Attention', refund_pending: 'Refund Pending', refunded: 'Refunded', cancelled: 'Cancelled', expired: 'Payment Expired' } as Record<string, string>)[status || ''] || 'Registration Processing';
}
