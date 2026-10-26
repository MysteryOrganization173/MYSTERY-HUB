import type { NotificationAudience, NotificationCategory, NotificationDeliveryState, NotificationLimits, NotificationPlaceholder, NotificationSendStatus } from '../services/adminNotifications';

/**
 * Pure rules for the Admin notification composer. The server stays the authority on audiences, consent, supported
 * placeholders and limits; these checks only stop the founder from sending something the server would refuse or
 * that reads badly on a phone.
 */

export interface NotificationDraft { templateId: string | null; category: NotificationCategory; title: string; body: string; destination: string | null; audienceId: string | null;userId?:string }

export interface StarterTemplate { id: string; name: string; category: NotificationCategory; title: string; body: string }

/** Production templates are loaded from the authoritative backend, never invented locally. */
export const STARTER_TEMPLATES: StarterTemplate[] = [];
export const SAMPLE_PLACEHOLDERS: NotificationPlaceholder[] = [
  {token:'{{appName}}',label:'Application name',sample:'Mystery Hub'},
  {token:'{{eventLabel}}',label:'Server event label',sample:'Service announcement'},
];
export const CATEGORY_LABELS: Record<NotificationCategory, string> = { transactional: 'Order update', service: 'Service notice', marketing: 'Promotion' };

/** Guidance, not the server's limit: Android shows about this much before cutting a title or a collapsed body. */
export const TITLE_GUIDE = 40;
export const BODY_GUIDE = 120;
export const DEFAULT_LIMITS: NotificationLimits = { titleMax: 80, bodyMax: 240 };

const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
export function placeholdersIn(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map(m => `{{${m[1].toLowerCase()}}}`))];
}
export function unsupportedPlaceholders(text: string, supported: NotificationPlaceholder[]): string[] {
  const known = new Set(supported.map(p => p.token.toLowerCase()));
  return placeholdersIn(text).filter(token => !known.has(token));
}
/** Square-bracket blanks left from a starter template, e.g. "[end date]". */
export function unfilledBlanks(text: string): string[] {
  return [...new Set([...text.matchAll(/\[[^\]\n]{1,60}\]/g)].map(m => m[0]))];
}
/** The text a phone would show, with each known placeholder replaced by its sample value. */
export function renderWithSamples(text: string, placeholders: NotificationPlaceholder[]): string {
  const samples = new Map(placeholders.map(p => [p.token.toLowerCase(), p.sample]));
  return text.replace(PLACEHOLDER, (match, name: string) => samples.get(`{{${name.toLowerCase()}}}`) ?? match);
}

export type LengthTone = 'ok' | 'long' | 'over';
export function lengthGuidance(field: 'title' | 'body', text: string, limits: NotificationLimits): { tone: LengthTone; count: number; max: number; message: string } {
  const count = [...text].length, max = field === 'title' ? limits.titleMax : limits.bodyMax, guide = field === 'title' ? TITLE_GUIDE : BODY_GUIDE;
  if (count > max) return { tone: 'over', count, max, message: `${count - max} over the ${max}-character limit` };
  if (count > guide) return { tone: 'long', count, max, message: field === 'title' ? 'Phones may cut a title this long' : 'Phones show about two lines before “more”' };
  return { tone: 'ok', count, max, message: `${max - count} left` };
}

export function audienceAllows(audience: NotificationAudience, category: NotificationCategory) {
  return audience.allowedCategories.includes(category) && (category !== 'marketing' || audience.marketingConsentOnly);
}

/** Everything that blocks a send, in the order the founder should fix it. Empty means ready to confirm. */
export function sendBlockers(draft: NotificationDraft, ctx: { audiences: NotificationAudience[]; placeholders: NotificationPlaceholder[] | null; limits: NotificationLimits }): string[] {
  const issues: string[] = [];
  if (!draft.title.trim()) issues.push('Add a title.');
  if (!draft.body.trim()) issues.push('Add a message.');
  if (lengthGuidance('title', draft.title, ctx.limits).tone === 'over') issues.push(`Shorten the title to ${ctx.limits.titleMax} characters.`);
  if (lengthGuidance('body', draft.body, ctx.limits).tone === 'over') issues.push(`Shorten the message to ${ctx.limits.bodyMax} characters.`);
  const blanks = unfilledBlanks(`${draft.title} ${draft.body}`);
  if (blanks.length) issues.push(`Replace ${blanks.join(', ')}.`);
  if (ctx.placeholders) {
    const unknown = unsupportedPlaceholders(`${draft.title} ${draft.body}`, ctx.placeholders);
    if (unknown.length) issues.push(`The server cannot fill ${unknown.join(', ')}.`);
  }
  const audience = ctx.audiences.find(a => a.id === draft.audienceId);
  if (!audience) issues.push('Choose who receives it.');
  else if (!audienceAllows(audience, draft.category)) issues.push(draft.category === 'marketing'
    ? 'Promotions can only go to people who agreed to promotional updates.'
    : `${CATEGORY_LABELS[draft.category]} messages cannot go to ${audience.label}.`);
  else if (audience.eligibleCount === 0) issues.push('Nobody in this audience can receive notifications right now.');
  return issues;
}

/** The idempotency key belongs to the exact content and audience; any edit makes a new draft with a new key. */
export function draftFingerprint(draft: NotificationDraft) {
  return JSON.stringify([draft.category, draft.title.trim(), draft.body.trim(), draft.destination, draft.audienceId,draft.userId,draft.templateId]);
}

export const DELIVERY_LABELS: Record<NotificationDeliveryState, { label: string; help: string }> = {
  pending: { label: 'Waiting', help: 'Not handed to the push service yet.' },
  sent: { label: 'Sent', help: 'Handed to the push service, which has not answered yet.' },
  accepted: { label: 'Accepted', help: 'The push service accepted it for the device. This does not mean the person saw it.' },
  retrying: { label: 'Retrying', help: 'A temporary problem; the server will try again.' },
  failed: { label: 'Failed', help: 'Could not be sent to this device.' },
  invalid: {label:'Expired or invalid',help:'The subscription is no longer usable.'},
  skipped: {label:'Not sent',help:'Account, consent, session or subscription eligibility changed.'},
};

export const SEND_STATUS_LABELS: Record<NotificationSendStatus, { label: string; tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral' }> = {
  queued: { label: 'Queued', tone: 'neutral' },
  sending: { label: 'Sending', tone: 'info' },
  completed: { label: 'Finished', tone: 'success' },
  completed_with_errors: { label: 'Finished with failures', tone: 'warning' },
  failed: { label: 'Failed', tone: 'danger' },
};

/** Inserts a placeholder at the caret, adding a space where the token would otherwise touch a word. */
export function insertAt(text: string, start: number, end: number, token: string) {
  const before = text.slice(0, start), after = text.slice(end);
  const lead = before && !/\s$/.test(before) ? ' ' : '';
  const trail = after && !/^[\s.,!?;:]/.test(after) ? ' ' : '';
  const value = `${before}${lead}${token}${trail}${after}`;
  return { value, caret: before.length + lead.length + token.length };
}
