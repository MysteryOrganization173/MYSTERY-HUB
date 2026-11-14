import { GREETING_SHARE_ID, GREETING_VARIANTS } from '../../shared/mysteryExperiences';
import { BUSINESS_CONFIG } from '../config/business';

/**
 * Mystery Greetings: words, themes and the client-side mirror of the server's text rules. Pure and testable.
 * The server (server/services/experienceValidation.ts) stays the authority; this mirror only lets people fix a
 * field before anything is sent. Personal text is always rendered as React text, never as HTML.
 */
export type Occasion = 'christmas-2026' | 'new-year-2027';
export type Variant = typeof GREETING_VARIANTS[number];
export const OCCASIONS: readonly Occasion[] = ['christmas-2026', 'new-year-2027'];
export const VARIANTS: readonly Variant[] = GREETING_VARIANTS;
export const isOccasion = (value: unknown): value is Occasion => typeof value === 'string' && (OCCASIONS as readonly string[]).includes(value);
export const isVariant = (value: unknown): value is Variant => typeof value === 'string' && (VARIANTS as readonly string[]).includes(value);

export const SHARE_ID = GREETING_SHARE_ID;
/** The canonical public origin the server builds greeting links from (never the request host). */
export const GREETINGS_ORIGIN = `https://${BUSINESS_CONFIG.domain}`;
export const greetingLink = (shareId: string) => `${GREETINGS_ORIGIN}/g/${shareId}`;
export const LIMITS = { name: 60, messageMin: 4, message: 600 } as const;

export interface OccasionCopy {
  label: string; year: string; short: string; greeting: string; noun: string; sealedKicker: string; open: string; teaser: string;
}
export const OCCASION_COPY: Record<Occasion, OccasionCopy> = {
  'christmas-2026': {
    label: 'Christmas', year: '2026', short: 'Christmas 2026', greeting: 'Merry Christmas', noun: 'gift',
    sealedKicker: 'A Christmas gift for', open: 'Open your gift',
    teaser: 'I wrapped a little Christmas surprise for you 🎁 Tap to open it:',
  },
  'new-year-2027': {
    label: 'New Year', year: '2027', short: 'New Year 2027', greeting: 'Happy New Year', noun: 'surprise',
    sealedKicker: 'A New Year surprise for', open: 'Open your surprise',
    teaser: 'I wrapped a little New Year surprise for you ✨ Tap to open it:',
  },
};

export const VARIANT_COPY: Record<Variant, { name: string; detail: Record<Occasion, string> }> = {
  'gift-classic-v1': { name: 'Classic ribbon', detail: { 'christmas-2026': 'Berry velvet with a gold satin bow', 'new-year-2027': 'Midnight blue with a champagne bow' } },
  'gift-starlight-v1': { name: 'Starlight', detail: { 'christmas-2026': 'Evergreen wrap scattered with gold stars', 'new-year-2027': 'Night-sky wrap that bursts into sparks' } },
};

export const TEMPLATE_CATEGORY: Record<string, string> = {
  heartwarming: 'Heartwarming', romantic: 'Romantic', friendship: 'Friendship', family: 'Family', funny: 'Funny',
  playful: 'Playful', elegant: 'Elegant', inspirational: 'Inspirational', ghanaian: 'Ghanaian',
};

/** The sender line the recipient sees. A hidden sender is never sent to the server at all. */
export const MYSTERY_SENDER = 'a mystery sender';

/**
 * The occasion a creator starts with: an explicit, valid choice (a homepage link or a received greeting), otherwise
 * the real Accra calendar day. Founder preview dates are never consulted: they must not shape anything real.
 */
export function defaultOccasion(requested: unknown, now: Date = new Date()): Occasion {
  if (isOccasion(requested)) return requested;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Accra', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return day >= '2026-12-27' ? 'new-year-2027' : 'christmas-2026';
}

/** Characters people cannot see or type on purpose: tabs become spaces, line endings become \n, invisible format and
 *  control characters are removed (combined emoji such as families fall apart into their separate emoji). */
export function cleanText(value: string): { text: string; split: boolean } {
  const unified = value.replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
  const split = /‍/.test(unified);
  return { text: unified.replace(/[^\P{C}\n]/gu, '').normalize('NFC'), split };
}

export type TextProblem = 'empty' | 'short' | 'long' | 'markup' | 'link' | 'letters';
export interface TextCheck { ok: boolean; text: string; length: number; problem: TextProblem | null }

/** Mirrors personalText(): NFC, trimmed, counted in code points, no <, >, control characters or links, needs a letter or number. */
export function checkText(value: string, max: number, min = 1): TextCheck {
  const text = cleanText(value).text.trim();
  const length = Array.from(text).length;
  const problem: TextProblem | null =
    length === 0 ? 'empty'
      : length < min ? 'short'
        : length > max ? 'long'
          : /[<>]/.test(text) ? 'markup'
            : /(?:https?:|www\.|javascript:|data:|mailto:)/i.test(text) ? 'link'
              : !/[\p{L}\p{N}]/u.test(text) ? 'letters' : null;
  return { ok: problem === null, text, length, problem };
}

export function problemMessage(problem: TextProblem, field: 'recipient' | 'sender' | 'message'): string {
  const what = field === 'message' ? 'your message' : field === 'recipient' ? 'their name' : 'your name';
  switch (problem) {
    case 'empty': return field === 'recipient' ? 'Add the name of the person this greeting is for.' : field === 'message' ? 'Write a message or pick one above.' : 'Add your name, or hide it.';
    case 'short': return `Write at least ${LIMITS.messageMin} characters.`;
    case 'long': return field === 'message' ? `Keep your message to ${LIMITS.message} characters.` : `Keep ${what} to ${LIMITS.name} characters.`;
    case 'markup': return `Remove the < and > signs from ${what}.`;
    case 'link': return `Links can’t be included in a greeting. Remove the web address from ${what}.`;
    case 'letters': return `Use at least one letter or number in ${what}.`;
  }
}

export interface Draft {
  occasion: Occasion; variant: Variant;
  recipientName: string; senderName: string; showSender: boolean;
  mode: 'template' | 'custom'; templateId: string | null; message: string;
}
/** Christmas opens on the Classic ribbon, the New Year on Starlight (its night sky and firework sparks). */
export const defaultVariant = (occasion: Occasion): Variant => occasion === 'new-year-2027' ? 'gift-starlight-v1' : 'gift-classic-v1';
export const emptyDraft = (occasion: Occasion): Draft => ({ occasion, variant: defaultVariant(occasion), recipientName: '', senderName: '', showSender: true, mode: 'template', templateId: null, message: '' });

export interface TemplateOption { id: string; occasion: string; category: string; message: string }

/** Field problems for the message step, in reading order. Empty object: ready. */
export function draftProblems(draft: Draft, templates: readonly TemplateOption[]): Partial<Record<'recipient' | 'message' | 'sender', string>> {
  const out: Partial<Record<'recipient' | 'message' | 'sender', string>> = {};
  const recipient = checkText(draft.recipientName, LIMITS.name);
  if (!recipient.ok) out.recipient = problemMessage(recipient.problem!, 'recipient');
  if (draft.mode === 'template') {
    if (!templates.some(t => t.id === draft.templateId && t.occasion === draft.occasion)) out.message = 'Pick a message, or write your own.';
  } else {
    const message = checkText(draft.message, LIMITS.message, LIMITS.messageMin);
    if (!message.ok) out.message = problemMessage(message.problem!, 'message');
  }
  if (draft.showSender) {
    const sender = checkText(draft.senderName, LIMITS.name);
    if (!sender.ok && sender.problem !== 'empty') out.sender = problemMessage(sender.problem!, 'sender');
  }
  return out;
}

/** What the greeting will say, as the recipient sees it. */
export function draftMessage(draft: Draft, templates: readonly TemplateOption[]): string {
  return draft.mode === 'template' ? templates.find(t => t.id === draft.templateId)?.message || '' : checkText(draft.message, LIMITS.message, LIMITS.messageMin).text;
}
export function draftSender(draft: Draft): string | null {
  if (!draft.showSender) return null;
  const sender = checkText(draft.senderName, LIMITS.name);
  return sender.ok ? sender.text : null;
}

export interface CreateContent {
  occasion: Occasion; recipientName: string; senderName?: string; showSender: boolean; templateId?: string; message?: string; variant: Variant;
}
/** The exact content sent to the server (no parent, secret or key). An empty sender is the same as a hidden one. */
export function createContent(draft: Draft): CreateContent {
  const sender = draftSender(draft);
  return {
    occasion: draft.occasion,
    recipientName: checkText(draft.recipientName, LIMITS.name).text,
    ...(sender ? { senderName: sender } : {}),
    showSender: Boolean(sender),
    ...(draft.mode === 'template' && draft.templateId ? { templateId: draft.templateId } : { message: checkText(draft.message, LIMITS.message, LIMITS.messageMin).text }),
    variant: draft.variant,
  };
}
/** Stable fingerprint of the content: a changed greeting never reuses an earlier attempt's idempotency key. */
export const contentFingerprint = (content: CreateContent) => JSON.stringify([content.occasion, content.recipientName, content.senderName ?? null, content.showSender, content.templateId ?? null, content.message ?? null, content.variant]);

/** Only a canonical greeting link from the server is ever shown or shared. */
export function canonicalGreetingUrl(url: unknown, shareId: unknown): string | null {
  if (typeof shareId !== 'string' || !SHARE_ID.test(shareId) || typeof url !== 'string') return null;
  return url === greetingLink(shareId) ? url : null;
}

/** A long name gets a smaller display size so it wraps gracefully. */
export const nameScale = (name: string) => { const n = Array.from(name).length; return n > 32 ? 'xs' : n > 20 ? 'sm' : n > 12 ? 'md' : 'lg'; };
