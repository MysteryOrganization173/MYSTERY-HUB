import type { PublicGreeting } from '../../shared/mysteryExperiences';
import { greetingsEntry } from '../../shared/seasonal';
import { canonicalGreetingUrl, isOccasion, isVariant, SHARE_ID, type CreateContent, type TemplateOption } from './model';

/**
 * The public Mystery Greetings contract (/api/experiences), with every failure mapped to a small set of honest states.
 * A greeting is only ever reported as created when the server confirmed it; nothing is reconstructed in the browser.
 */
const BASE = ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL || '').replace(/\/$/, '');

export type Failure = 'offline' | 'unavailable' | 'busy' | 'paused' | 'invalid' | 'conflict' | 'duplicate' | 'parent';
export type Result<T> = { ok: true; status: number; data: T } | { ok: false; failure: Failure; status: number; code: string | null };

export function classify(status: number, code: string | null): Failure {
  if (status === 0) return 'offline';
  if (status === 404) return 'unavailable';
  if (status === 429) return 'busy';
  if (status === 409) return code === 'DUPLICATE_CONTENT' ? 'duplicate' : 'conflict';
  if (status === 400 && code === 'INVALID_PARENT') return 'parent';
  if (status === 400 || status === 413) return 'invalid';
  return 'paused'; // 503 and anything unexpected: the service is not taking requests right now
}

/** Short, jittered retries are safe here: every call is a read, idempotent (same key) or deduplicated by the server. */
export const BUSY_RETRIES = 2;
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
/**
 * The server serves at most two greeting database transactions per process and answers a third at once with
 * 429 BUSY (not a rate limit). That is momentary contention, so it is retried twice after a short random pause before
 * anyone is told to wait; a real rate limit (RATE_LIMITED) is never retried.
 */
async function call<T>(path: string, init: RequestInit = {}, timeoutMs = 12_000, read: (body: unknown) => T | null = body => body as T): Promise<Result<T>> {
  for (let attempt = 0; ; attempt++) {
    const result = await once(path, init, timeoutMs, read);
    if (result.ok || result.code !== 'BUSY' || attempt >= BUSY_RETRIES) return result;
    await pause(400 + Math.random() * 700 * (attempt + 1));
  }
}
async function once<T>(path: string, init: RequestInit, timeoutMs: number, read: (body: unknown) => T | null): Promise<Result<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(BASE + path, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', ...init, signal: controller.signal });
    let body: unknown = null;
    try { body = await response.json(); } catch { body = null; }
    if (response.ok) {
      const data = read(body);
      // A malformed success is never treated as one.
      return data === null ? { ok: false, failure: 'paused', status: response.status, code: 'MALFORMED_RESPONSE' } : { ok: true, status: response.status, data };
    }
    const code = typeof (body as { error?: { code?: unknown } } | null)?.error?.code === 'string' ? (body as { error: { code: string } }).error.code : null;
    return { ok: false, failure: classify(response.status, code), status: response.status, code };
  } catch {
    return { ok: false, failure: 'offline', status: 0, code: null };
  } finally { clearTimeout(timer); }
}

const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

export function readGreeting(body: unknown): PublicGreeting | null {
  const g = body as Partial<PublicGreeting> | null;
  if (!g || g.schemaVersion !== 1 || typeof g.shareId !== 'string' || !SHARE_ID.test(g.shareId) || !isOccasion(g.occasion) || !isVariant(g.variant)
    || typeof g.recipientName !== 'string' || typeof g.message !== 'string' || (g.senderName !== null && typeof g.senderName !== 'string') || typeof g.expiresAt !== 'string') return null;
  return { schemaVersion: 1, shareId: g.shareId, occasion: g.occasion, recipientName: g.recipientName, senderName: g.senderName ?? null, message: g.message, variant: g.variant, expiresAt: g.expiresAt };
}

/** Whether the creator is open: the same public season status both seasonal homepages read (briefly cacheable). */
export const fetchCreationOpen = () => call<boolean>('/api/seasonal/status', { cache: 'default' }, 8_000, body => body && typeof body === 'object' ? greetingsEntry((body as { greetings?: unknown }).greetings).state === 'open' : null);

export const fetchGreeting = (shareId: string) => call(`/api/experiences/greetings/${encodeURIComponent(shareId)}`, {}, 10_000, readGreeting);

export interface TemplatesAnswer { templates: TemplateOption[]; open: boolean }
export const fetchTemplates = () => call<TemplatesAnswer>('/api/experiences/templates', {}, 10_000, body => {
  const b = body as { schemaVersion?: unknown; templates?: unknown; creationConfigured?: unknown } | null;
  if (!b || b.schemaVersion !== 1 || !Array.isArray(b.templates) || typeof b.creationConfigured !== 'boolean') return null;
  const templates = b.templates.filter((t: any): t is TemplateOption => t && typeof t.id === 'string' && isOccasion(t.occasion) && typeof t.category === 'string' && typeof t.message === 'string');
  return { templates, open: b.creationConfigured };
});

export interface Created { shareId: string; url: string; expiresAt: string; duplicate: boolean }
export const createGreeting = (content: CreateContent, creatorToken: string, idempotencyKey: string, parentShareId: string | null) =>
  call<Created>('/api/experiences/greetings', json({ ...content, ...(parentShareId ? { parentShareId } : {}), creatorToken, idempotencyKey }), 15_000, body => {
    const b = body as { schemaVersion?: unknown; shareId?: unknown; url?: unknown; expiresAt?: unknown; duplicate?: unknown } | null;
    const url = canonicalGreetingUrl(b?.url, b?.shareId);
    return b && b.schemaVersion === 1 && url && typeof b.expiresAt === 'string' && typeof b.duplicate === 'boolean' ? { shareId: b.shareId as string, url, expiresAt: b.expiresAt, duplicate: b.duplicate } : null;
  });

/** The creator secret travels only in this header, never in a URL. */
export const revokeGreeting = (shareId: string, creatorToken: string) =>
  call<{ revoked: true }>(`/api/experiences/greetings/${encodeURIComponent(shareId)}/revoke`, json({}, { Authorization: `Greeting ${creatorToken}` }), 10_000, body => (body as { revoked?: unknown } | null)?.revoked === true ? { revoked: true } : null);

export type ReportReason = 'abuse' | 'spam' | 'privacy';
export const reportGreeting = (shareId: string, reason: ReportReason) =>
  call<{ accepted: true }>(`/api/experiences/greetings/${encodeURIComponent(shareId)}/report`, json({ reason }), 10_000, body => (body as { accepted?: unknown } | null)?.accepted === true ? { accepted: true } : null);

export interface CountdownAnswer { remainingMs: number; serverTime: string; passed: boolean }
export const fetchCountdown = () => call<CountdownAnswer>('/api/experiences/countdown', {}, 8_000, body => {
  const b = body as { schemaVersion?: unknown; remainingMs?: unknown; serverTime?: unknown; passed?: unknown; target?: unknown } | null;
  return b && b.schemaVersion === 1 && b.target === '2027-01-01T00:00:00.000Z' && typeof b.remainingMs === 'number' && Number.isFinite(b.remainingMs) && b.remainingMs >= 0 && typeof b.serverTime === 'string' && typeof b.passed === 'boolean'
    ? { remainingMs: b.remainingMs, serverTime: b.serverTime, passed: b.passed } : null;
});

/** Interaction events only: consent and bot filtering are enforced in analytics.ts and again by the server. */
export const postExperienceEvent = (body: { event: string; shareId?: string; visitorId: string; sessionId: string }) =>
  fetch(BASE + '/api/experiences/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' }).then(() => undefined, () => undefined);
