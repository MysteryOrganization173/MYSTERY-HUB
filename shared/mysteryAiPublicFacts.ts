import { DIGITAL_SERVICES } from '../src/data/services.js';
import type { DigitalService } from '../src/types/index.js';
import { aiPriorQuestion, aiText, type AiGuideContext } from './mysteryAiIntent.js';

export type PublicPromotion = {
  kind: 'friday' | 'giveaway' | 'recognition';
  startsOn: string;
  endsBefore: string;
};

// Add only dates explicitly published and approved for customers, using Ghana calendar days.
// Private rounds, draft campaigns, winners, prizes and free-form campaign text are never read here.
const APPROVED_PUBLIC_ROUNDS: readonly PublicPromotion[] = [];

function validDay(value: string) {
  const date = new Date(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function promotionReply(message: string, context: AiGuideContext, at = new Date(), rounds = APPROVED_PUBLIC_ROUNDS) {
  const q = aiText(message);
  const prior = aiText(aiPriorQuestion(context));
  const subject = /^(?:what about (?:this |next )?friday|is (?:it|the round) (?:active|open)|tell me more|how|why|explain)$/.test(q) ? q + ' ' + prior : q;
  if (/\b(?:who (?:won|wins|is|was)|winners?|winner names?)\b/.test(q)) {
    return 'I can’t verify a public winner announcement from here. Please check Mystery Hub’s official announcements or ask support in Help & FAQs.';
  }
  if (/\bnext friday\b/.test(q)) return 'Which date do you mean by next Friday? Check Mystery Hub’s official announcements to confirm a round for that date.';
  const kind = /\b(?:customer of the week|customer recognition|customer champions)\b/.test(subject) ? 'recognition' :
    /\bfriday\b/.test(subject) ? 'friday' : 'giveaway';
  const title = { friday: 'Friday giveaway', recognition: 'customer recognition programme', giveaway: 'giveaway' }[kind];
  if (/\b(?:promotions?|promotional rewards?|discounts?)\b/.test(subject) && !/\b(?:giveaways?|friday|customer recognition|customer of the week)\b/.test(subject)) {
    return 'I can’t confirm a current promotion from here. Check Mystery Hub’s official announcements and the offer shown at checkout before relying on a discount.';
  }
  // Ghana (Africa/Accra) uses UTC year-round. An end date is exclusive.
  const day = at.toISOString().slice(0, 10);
  const approved = rounds.filter(row => (row.kind === kind || kind === 'giveaway' && row.kind === 'friday') &&
    validDay(row.startsOn) && validDay(row.endsBefore) && row.startsOn < row.endsBefore);
  const current = approved.find(row => row.startsOn <= day && day < row.endsBefore);
  if (current) return `The published ${title} round is active today in Ghana. Check the official announcement for eligibility and how to take part.`;
  const next = approved.filter(row => day < row.startsOn).sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0];
  if (next) return `A published ${title} round is scheduled to start on ${next.startsOn}, Ghana time. It hasn’t opened yet.`;
  if (approved.length) return `The published ${title} round has ended. I can’t confirm a new round. Check Mystery Hub’s official announcements for updates.`;
  return `I can’t confirm a current ${title} round or schedule. Check Mystery Hub’s official announcements or ask support in Help & FAQs for the latest details.`;
}

export type ServiceEvidence = { available: boolean };
export function serviceAvailability(service: DigitalService | undefined, evidence?: ServiceEvidence) {
  if (evidence?.available === true && service?.targetPage) return 'available';
  if (service?.status === 'coming_soon') return 'planned';
  if (evidence?.available === false) return 'unavailable';
  if (!service?.targetPage) return 'unknown';
  return service.status === 'beta' || ['srv-data', 'srv-airtime', 'srv-afa', 'srv-wallet', 'srv-marketplace', 'srv-results'].includes(service.id) ? 'conditional' : 'released';
}

export const resultsService = () => DIGITAL_SERVICES.find(service => service.id === 'srv-results');
export function resultsReply(message: string) {
  const q = aiText(message);
  const exams = ['wassce', 'bece', 'waec'].filter(exam => new RegExp(`\\b${exam}\\b`).test(q));
  const subject = exams.length === 1 ? `${exams[0].toUpperCase()} checker` : 'results checker';
  return serviceAvailability(resultsService()) === 'planned'
    ? `The ${subject} service is listed as planned. I can’t confirm checkout availability or a customer price. See All Services for updates.`
    : `I can’t verify current ${subject} availability or a customer price. Check the official service page before paying.`;
}

export function serviceSummary() {
  const directory = DIGITAL_SERVICES.filter(service => serviceAvailability(service) !== 'planned').map(service => service.title);
  return `Mystery Hub lists ${directory.join(', ')}. My Business manages websites and configured Data Stores. For Data, Instant Bundles, Airtime and AFA, check the service page for current options and eligibility. All Services labels planned services separately.`;
}

export const referralBasics = 'Share your Mystery Earn link. A click or registration alone doesn’t earn a reward. Eligible purchases can create a pending reward, and only available earnings can be withdrawn under the current rules. I can’t check your personal rewards in chat.';
