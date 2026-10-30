/**
 * Builder V6: a visitor who chooses a design and fills in "Make it yours" before having an account keeps that
 * choice through sign-up or login, even if the page reloads in between. It lives in this tab only, expires after
 * 30 minutes, is removed when the visitor closes sign-in, and is taken exactly once, so it can never create a
 * second website (the server's one-website rule still applies on top). Kept free of the template data so the
 * app shell can clear it without downloading the designs; the server rejects an unknown design.
 */
export interface WebsiteStartIntent {
  templateId: string;
  businessName: string;
  whatsapp: string;
  location: string;
  at: number;
}

const KEY = 'mh_website_start_intent';
export const WEBSITE_START_INTENT_TTL_MS = 30 * 60_000;

const storage = (): Storage | null => {
  try { return typeof window === 'undefined' ? null : window.sessionStorage; } catch { return null; }
};
const text = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : '';

export function saveWebsiteStartIntent(input: Omit<WebsiteStartIntent, 'at'>, now = Date.now()): void {
  try { storage()?.setItem(KEY, JSON.stringify({ ...input, at: now })); } catch { /* Private mode: the in-page callback still resumes. */ }
}

export function clearWebsiteStartIntent(): void {
  try { storage()?.removeItem(KEY); } catch { /* Storage unavailable. */ }
}

/** Reads and removes the saved choice. Anything stale, malformed or not naming a design is discarded. */
export function takeWebsiteStartIntent(now = Date.now()): WebsiteStartIntent | null {
  const store = storage();
  if (!store) return null;
  let raw: string | null = null;
  try { raw = store.getItem(KEY); store.removeItem(KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    const intent: WebsiteStartIntent = {
      templateId: text(value?.templateId, 80), businessName: text(value?.businessName, 100).trim(),
      whatsapp: text(value?.whatsapp, 30), location: text(value?.location, 150), at: Number(value?.at),
    };
    if (!Number.isFinite(intent.at) || now - intent.at > WEBSITE_START_INTENT_TTL_MS || intent.at > now + 60_000) return null;
    if (intent.businessName.length < 2 || !/^tmpl-[a-z0-9-]{1,60}$/.test(intent.templateId)) return null;
    return intent;
  } catch { return null; }
}
