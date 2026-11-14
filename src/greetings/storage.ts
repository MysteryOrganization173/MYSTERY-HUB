import { greetingLink, isOccasion, isVariant, SHARE_ID, type Draft, type Occasion, type Variant } from './model';

/**
 * What this browser keeps for Mystery Greetings, and for how long.
 *
 * - The creator secret (32 random bytes, base64url) lets this browser remove the greetings it made. It lives only in
 *   this browser's storage, is sent only in a create body or a remove request's Authorization header, and never
 *   appears in a link, an analytics event or a log. Losing it means losing management: there is no recovery.
 * - "Sent from this browser": share ID, occasion, recipient name and dates, so the creator can find and remove a
 *   greeting. Never the message. Entries are dropped when the greeting expires; the creator can remove any entry.
 * - A draft (and an unconfirmed create attempt) lives in this tab only (sessionStorage) and is ignored after two hours.
 *   It is deleted as soon as the greeting is created.
 * Storage that is blocked (some private modes) falls back to this page's memory; the page says so.
 */
export interface KeyValue { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export function memoryStorage(): KeyValue {
  const map = new Map<string, string>();
  return { getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: k => { map.delete(k); } };
}
/** The browser storage when it actually works, otherwise null. */
export function usableStorage(get: () => Storage): KeyValue | null {
  try { const s = get(); const probe = '__mh_greetings_probe__'; s.setItem(probe, '1'); s.removeItem(probe); return s; } catch { return null; }
}

const CREATOR = 'mh_greetings_creator_v1', SENT = 'mh_greetings_sent_v1', DRAFT = 'mh_greetings_draft_v1', LAST = 'mh_greetings_last_v1', PARENT = 'mh_greetings_parent_v1';
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const DRAFT_TTL = 2 * 3600_000, PARENT_TTL = 30 * 60_000, MAX_SENT = 40;

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const newCreatorToken = (random: (b: Uint8Array<ArrayBuffer>) => Uint8Array = b => crypto.getRandomValues(b)) => base64url(random(new Uint8Array(32)));
export const newIdempotencyKey = () => crypto.randomUUID();
const parse = (raw: string | null): unknown => { try { return raw ? JSON.parse(raw) : null; } catch { return null; } };

export interface SentGreeting { shareId: string; occasion: Occasion; recipientName: string; createdAt: string; expiresAt: string; removed?: boolean }
export interface PendingAttempt { key: string; fingerprint: string; startedAt: number }
export interface SavedDraft { draft: Draft; stage: 'design' | 'message' | 'preview'; pending: PendingAttempt | null }
export interface LastCreated { shareId: string; url: string; occasion: Occasion; variant: Variant; recipientName: string; expiresAt: string; savedAt: number }

export interface GreetingsStore {
  /** 'device': kept in this browser. 'tab': only until this tab closes. 'page': only until this page closes. */
  persistence: 'device' | 'tab' | 'page';
  creatorToken(): string;
  sent(now?: number): SentGreeting[];
  remember(entry: SentGreeting): void;
  markRemoved(shareId: string): void;
  forget(shareId: string): void;
  loadDraft(now?: number): SavedDraft | null;
  saveDraft(saved: SavedDraft, now?: number): void;
  clearDraft(): void;
  loadLast(now?: number): LastCreated | null;
  saveLast(last: LastCreated): void;
  clearLast(): void;
  takeParent(now?: number): { shareId: string; occasion: Occasion } | null;
}

export function validDraft(value: unknown): Draft | null {
  const d = value as Partial<Draft> | null;
  if (!d || typeof d !== 'object' || !isOccasion(d.occasion) || !isVariant(d.variant) || typeof d.recipientName !== 'string' || typeof d.senderName !== 'string'
    || typeof d.showSender !== 'boolean' || (d.mode !== 'template' && d.mode !== 'custom') || (d.templateId !== null && typeof d.templateId !== 'string') || typeof d.message !== 'string') return null;
  // Bounded: a damaged or hostile value can never grow the page.
  if (d.recipientName.length > 240 || d.senderName.length > 240 || d.message.length > 2400 || (d.templateId && d.templateId.length > 64)) return null;
  return { occasion: d.occasion, variant: d.variant, recipientName: d.recipientName, senderName: d.senderName, showSender: d.showSender, mode: d.mode, templateId: d.templateId ?? null, message: d.message };
}

export function createGreetingsStore(device: KeyValue | null, tab: KeyValue | null): GreetingsStore {
  const page = memoryStorage();
  const local = device || tab || page, session = tab || page;
  const persistence = device ? 'device' : tab ? 'tab' : 'page';
  const write = (s: KeyValue, k: string, v: unknown) => { try { s.setItem(k, JSON.stringify(v)); } catch { /* full or blocked: the page keeps working */ } };
  const readSent = (now: number) => {
    const list = parse(local.getItem(SENT));
    return (Array.isArray(list) ? list : []).filter((e: any): e is SentGreeting => e && typeof e === 'object' && typeof e.shareId === 'string' && SHARE_ID.test(e.shareId)
      && isOccasion(e.occasion) && typeof e.recipientName === 'string' && e.recipientName.length <= 240 && typeof e.createdAt === 'string' && typeof e.expiresAt === 'string'
      && Date.parse(e.expiresAt) > now).slice(0, MAX_SENT);
  };
  let token: string | null = null;
  return {
    persistence,
    creatorToken() {
      if (token) return token;
      const saved = parse(local.getItem(CREATOR)) as { token?: unknown } | null;
      token = typeof saved?.token === 'string' && TOKEN.test(saved.token) ? saved.token : null;
      if (!token) { token = newCreatorToken(); write(local, CREATOR, { token, createdAt: new Date().toISOString() }); }
      return token;
    },
    sent: (now = Date.now()) => readSent(now),
    remember(entry) { write(local, SENT, [entry, ...readSent(Date.now()).filter(e => e.shareId !== entry.shareId)].slice(0, MAX_SENT)); },
    markRemoved(shareId) { write(local, SENT, readSent(Date.now()).map(e => e.shareId === shareId ? { ...e, removed: true } : e)); },
    forget(shareId) { write(local, SENT, readSent(Date.now()).filter(e => e.shareId !== shareId)); },
    loadDraft(now = Date.now()) {
      const saved = parse(session.getItem(DRAFT)) as { savedAt?: unknown; draft?: unknown; stage?: unknown; pending?: any } | null;
      if (!saved || typeof saved.savedAt !== 'number' || now - saved.savedAt > DRAFT_TTL || now < saved.savedAt - 60_000) { session.removeItem(DRAFT); return null; }
      const draft = validDraft(saved.draft);
      if (!draft) { session.removeItem(DRAFT); return null; }
      const stage = saved.stage === 'message' || saved.stage === 'preview' ? saved.stage : 'design';
      const p = saved.pending;
      const pending = p && typeof p === 'object' && typeof p.key === 'string' && UUID.test(p.key) && typeof p.fingerprint === 'string' && p.fingerprint.length < 4000 && typeof p.startedAt === 'number' ? { key: p.key, fingerprint: p.fingerprint, startedAt: p.startedAt } : null;
      return { draft, stage, pending };
    },
    saveDraft(saved, now = Date.now()) { write(session, DRAFT, { savedAt: now, ...saved }); },
    clearDraft() { session.removeItem(DRAFT); },
    loadLast(now = Date.now()) {
      const v = parse(session.getItem(LAST)) as Partial<LastCreated> | null;
      if (!v || typeof v.savedAt !== 'number' || now - v.savedAt > DRAFT_TTL || typeof v.shareId !== 'string' || !SHARE_ID.test(v.shareId) || v.url !== greetingLink(v.shareId)
        || !isOccasion(v.occasion) || !isVariant(v.variant) || typeof v.recipientName !== 'string' || v.recipientName.length > 240 || typeof v.expiresAt !== 'string') { session.removeItem(LAST); return null; }
      return v as LastCreated;
    },
    saveLast(last) { write(session, LAST, last); },
    clearLast() { session.removeItem(LAST); },
    takeParent(now = Date.now()) {
      const v = parse(session.getItem(PARENT)) as { shareId?: unknown; occasion?: unknown; at?: unknown } | null;
      session.removeItem(PARENT);
      return v && typeof v.shareId === 'string' && SHARE_ID.test(v.shareId) && isOccasion(v.occasion) && typeof v.at === 'number' && now - v.at < PARENT_TTL && v.at <= now + 60_000 ? { shareId: v.shareId, occasion: v.occasion } : null;
    },
  };
}

/** Set by a recipient's "Create your own" in the same tab. The received link's ID is never put in the creator's URL. */
export function rememberParent(shareId: string, occasion: Occasion, now = Date.now()) {
  const tab = usableStorage(() => sessionStorage);
  try { tab?.setItem(PARENT, JSON.stringify({ shareId, occasion, at: now })); } catch { /* optional context only */ }
}

export const browserGreetingsStore = () => createGreetingsStore(usableStorage(() => localStorage), usableStorage(() => sessionStorage));
