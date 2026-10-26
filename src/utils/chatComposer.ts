import type { MysteryAiFailureKind } from '../services/mysteryAiService';

/** Server limit for one Mystery AI question (POST /api/mystery-ai/chat rejects longer messages with 400). */
export const CHAT_MAX_CHARS = 2000;
/** The counter stays out of the way until a question is long enough for the limit to matter. */
export const CHAT_COUNT_FROM = 1600;

/**
 * Enter sends and Shift+Enter starts a new line. Android and other IME keyboards report Enter while a word is
 * still being composed (isComposing, or keyCode 229); that Enter only confirms the word and must never send.
 */
export function shouldSendOnEnter(event: { key: string; shiftKey: boolean; isComposing?: boolean; keyCode?: number }) {
  return event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229;
}

/** True when the reader is at (or close to) the newest message, so new replies may scroll into view. */
export function isNearBottom(box: { scrollTop: number; scrollHeight: number; clientHeight: number }, threshold = 96) {
  return box.scrollHeight - box.scrollTop - box.clientHeight <= threshold;
}

export function composerCountLabel(length: number): string | null {
  if (length < CHAT_COUNT_FROM) return null;
  const left = CHAT_MAX_CHARS - length;
  return left <= 0 ? 'Character limit reached' : `${left} characters left`;
}

export type ChatFailureKind = MysteryAiFailureKind | 'stopped';

/** A short heading for the failure card; the service supplies the full sentence. */
export function failureHeading(kind: ChatFailureKind): string {
  switch (kind) {
    case 'stopped': return 'Stopped';
    case 'busy': return 'Mystery AI is busy';
    case 'limits': return 'Message too long';
    case 'timeout': return 'No answer yet';
    case 'offline': return 'You are offline';
    default: return 'No answer this time';
  }
}

/** Retrying an over-limit question cannot succeed, so the card offers editing instead. */
export function canRetry(kind: ChatFailureKind) { return kind !== 'limits'; }
