import {validateAndNormalizeGhanaPhone} from '../utils/phone.js';
import type {BeneficiaryEligibility} from './successBizHub/beneficiary.js';

/** Server-only context: never log, persist as analytics, or return the recipient in public errors. */
export interface RecipientVerificationContext {
  recipient: string;
  network: string;
  offer: string;
  provider: 'success_biz_hub' | 'telcogh';
}
export function recipientVerification(context: RecipientVerificationContext, evidence: BeneficiaryEligibility, observedAt = new Date().toISOString()) {
  const valid = validateAndNormalizeGhanaPhone(context.recipient);
  const supported = context.provider === 'success_biz_hub';
  const consistent = valid.isValid && ['mtn','telecel','airteltigo'].includes(context.network) && !!context.offer;
  const outcome = !supported ? 'unsupported' : !consistent ? 'unknown' : evidence.outcome === 'eligible' && evidence.eligible ? 'eligible' : evidence.outcome === 'ineligible' && !evidence.eligible ? 'ineligible' : 'unknown';
  return {context: {...context, recipient: valid.normalized || ''}, outcome, observedAt, reason: outcome === 'ineligible' ? 'generic_restriction' : outcome === 'eligible' ? 'confirmed_eligibility' : 'evidence_unavailable', verificationSubmitted: false as const};
}
