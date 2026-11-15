/**
 * Invitations: one coordinated system for Mystery Hub's own suggestions, so they never compete for attention.
 *
 * Kinds: 'install' (put Mystery Hub on the home screen), 'channel' (follow the official WhatsApp Channel) and
 * 'notifications' (allow updates). The installed app's welcome sheet is an account entry rather than an invitation,
 * but it claims the screen too, so nothing piles on top of it or follows it in the same visit.
 *
 * The rules, each a pure function below so every branch is testable:
 * - One on screen at a time, never over a dialog, sheet, menu, checkout, sign-in or a payment return.
 * - Only on calm browsing pages. Never on orders (recovery and critical status), Wallet, the AFA and Results
 *   Checker payment pages, Admin, the editor, My Business or /app (which explains installing by itself). Greetings
 *   and published business websites never load this layer at all.
 * - Only after real engagement: a second page, about half a minute of active use, or a verified purchase whose
 *   receipt has been closed.
 * - At most one unsolicited invitation per browsing session, none after any dismissal in that session, and none
 *   within 12 hours of another one in this browser (other tabs included).
 * - Each invitation keeps its own memory. Install keeps its 30-day / three-strikes rule. The Channel rests 30 days
 *   after "Maybe later", 60 after the second and stops after the third; "Already following" stops it in this
 *   browser; opening the Channel is only a click (never proof of a follow), so it rests for 90 days.
 * - Storage can fail (private modes, blocked storage). Every read falls back to "nothing remembered" and the session
 *   record falls back to memory, so the rules still hold for the life of the page.
 */
export type InvitationKind = 'install' | 'channel' | 'notifications';
type Slot = InvitationKind | 'welcome';
type Store = Pick<Storage, 'getItem' | 'setItem'>;

export const DAY = 86_400_000;
export const INVITATION_KEYS = {
  session: 'mh_invitation_session',
  seen: 'mh_invitation_seen',
  channel: 'mh_channel_invite',
} as const;

/** No two unsolicited invitations within this time in one browser, whatever the tab. */
export const INVITATION_GAP_MS = 12 * 60 * 60 * 1000;
/** After an invitation was shown and simply ignored, it rests this long before it may appear again. */
export const SEEN_REST_DAYS: Record<InvitationKind, number> = { install: 7, channel: 14, notifications: 7 };
/** "Maybe later" on the Channel: the first rests 30 days, the second 60; the third stops automatic invitations. */
export const CHANNEL_LATER_REST_DAYS = [30, 60] as const;
export const CHANNEL_MAX_LATER = 3;
export const CHANNEL_OPENED_REST_DAYS = 90;
/** Install accepted but not yet confirmed: no install invitation for 3 days, then the browser decides again. */
export const INSTALL_PENDING_DAYS = 3;
/** Installed here before (confirmed by the browser, or opened from the home screen): no automatic suggestion. */
export const INSTALL_REMEMBERED_DAYS = 90;
/** iPhone/iPad: someone read the Add to Home Screen steps. Safari cannot confirm an install, so rest without a strike. */
export const INSTALL_STEPS_REST_DAYS = 30;
export const ENGAGED_VIEWS = 2;
export const ENGAGED_ACTIVE_MS = 25_000;
/** A page must settle before an invitation appears, so a quick tap through pages never triggers one. */
export const SETTLE_MS = 2_000;
export const CALM_PAGES: readonly string[] = ['home', 'data', 'services', 'marketplace', 'creative', 'about', 'help', 'earn', 'website'];

export interface InvitationSession {
  views: number; lastPage: string | null; activeMs: number; purchase: boolean;
  shown: InvitationKind | null; dismissed: boolean; welcome: boolean;
}
export const NEW_SESSION: InvitationSession = { views: 0, lastPage: null, activeMs: 0, purchase: false, shown: null, dismissed: false, welcome: false };
export type SeenMap = Partial<Record<InvitationKind, number>>;
export interface ChannelInviteState { later: number; laterAt: number | null; following: boolean; openedAt: number | null }
export const NO_CHANNEL_STATE: ChannelInviteState = { later: 0, laterAt: null, following: false, openedAt: null };

// ── Pure rules ────────────────────────────────────────────────────────────────────────────────────────────────

/** A timestamp from storage counts only if it is a real time not far in the future (a changed clock must not lock). */
const valid = (value: unknown, now: number): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= now + DAY;

/** A browsing page where a small suggestion may appear, and not a payment return (AFA, Results Checker, Wallet). */
export function calmPage(page: string, search: string) {
  return CALM_PAGES.includes(page) && !/[?&](?:reference|trxref)=/.test(search);
}

export function engaged(session: InvitationSession) {
  return session.purchase || session.views >= ENGAGED_VIEWS || session.activeMs >= ENGAGED_ACTIVE_MS;
}

/**
 * The session and browser-wide limits for one kind. Notifications are a contextual first-use invitation with their
 * own snooze: they share the visit (one at a time, one per visit, nothing after a dismissal) but not the 12-hour gap
 * or the "seen" rests of the marketing invitations. The welcome sheet leaves room only for notifications.
 */
export function sessionAllows(kind: InvitationKind, session: InvitationSession, seen: SeenMap, now: number) {
  if (session.shown || session.dismissed) return false;
  if (session.welcome && kind !== 'notifications') return false;
  if (kind === 'notifications') return true;
  const times = [seen.install, seen.channel].filter((time): time is number => valid(time, now));
  if (times.length && now - Math.max(...times) < INVITATION_GAP_MS) return false;
  const own = seen[kind];
  return !valid(own, now) || now - own >= SEEN_REST_DAYS[kind] * DAY;
}

export function channelInviteAllowed(state: ChannelInviteState, now: number) {
  if (state.following || state.later >= CHANNEL_MAX_LATER) return false;
  if (state.later > 0 && valid(state.laterAt, now)) {
    const rest = CHANNEL_LATER_REST_DAYS[Math.min(state.later, CHANNEL_LATER_REST_DAYS.length) - 1];
    if (now - state.laterAt < rest * DAY) return false;
  }
  return !(valid(state.openedAt, now) && now - state.openedAt < CHANNEL_OPENED_REST_DAYS * DAY);
}

/** Pending (accepted, unconfirmed), remembered or iPhone-steps-read installs silence automatic install suggestions. */
export function installRemembered({ installedAt, pendingAt, stepsAt = null, now }: { installedAt: number | null; pendingAt: number | null; stepsAt?: number | null; now: number }) {
  return (valid(installedAt, now) && now - installedAt < INSTALL_REMEMBERED_DAYS * DAY)
    || (valid(pendingAt, now) && now - pendingAt < INSTALL_PENDING_DAYS * DAY)
    || (valid(stepsAt, now) && now - stepsAt < INSTALL_STEPS_REST_DAYS * DAY);
}

/** Install first when it can genuinely happen here; the Channel otherwise. */
export function invitationOrder({ install, channel }: { install: boolean; channel: boolean }): InvitationKind[] {
  return [...(install ? ['install' as const] : []), ...(channel ? ['channel' as const] : [])];
}

// ── Storage (safe failure) ───────────────────────────────────────────────────────────────────────────────────

const local = (): Store | null => { try { return window.localStorage; } catch { return null; } };
const tab = (): Store | null => { try { return window.sessionStorage; } catch { return null; } };
const readJson = (key: string, store: Store | null): unknown => { try { return JSON.parse(store?.getItem(key) || 'null'); } catch { return null; } };
const writeJson = (key: string, value: unknown, store: Store | null) => { try { store?.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
const count = (value: unknown) => (Number.isInteger(value) && (value as number) >= 0 ? value as number : 0);
const time = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null);

let memorySession: InvitationSession | null = null;
// While a store refuses writes (quota, privacy mode), what it holds may be stale: memory is the truth until it recovers.
const failingStores = new WeakSet<object>();
export function readSession(store: Store | null = tab()): InvitationSession {
  if ((!store || failingStores.has(store)) && memorySession) return { ...memorySession };
  const raw = readJson(INVITATION_KEYS.session, store) as Partial<InvitationSession> | null;
  if (!raw || typeof raw !== 'object') return memorySession ? { ...memorySession } : { ...NEW_SESSION };
  const kinds: InvitationKind[] = ['install', 'channel', 'notifications'];
  return {
    views: count(raw.views), lastPage: typeof raw.lastPage === 'string' ? raw.lastPage : null, activeMs: count(raw.activeMs),
    purchase: raw.purchase === true, shown: kinds.includes(raw.shown as InvitationKind) ? raw.shown as InvitationKind : null,
    dismissed: raw.dismissed === true, welcome: raw.welcome === true,
  };
}
export function writeSession(next: InvitationSession, store: Store | null = tab()) {
  memorySession = { ...next };
  if (!store) return;
  if (writeJson(INVITATION_KEYS.session, next, store)) failingStores.delete(store); else failingStores.add(store);
}
const updateSession = (patch: (session: InvitationSession) => Partial<InvitationSession>) => {
  const current = readSession();
  const next = { ...current, ...patch(current) };
  writeSession(next);
  return next;
};

export function readSeen(store: Store | null = local()): SeenMap {
  const raw = readJson(INVITATION_KEYS.seen, store) as Record<string, unknown> | null;
  const seen: SeenMap = {};
  if (raw && typeof raw === 'object') for (const kind of ['install', 'channel', 'notifications'] as const) { const at = time(raw[kind]); if (at) seen[kind] = at; }
  return seen;
}

export function readChannelInvite(store: Store | null = local()): ChannelInviteState {
  const raw = readJson(INVITATION_KEYS.channel, store) as Partial<ChannelInviteState> | null;
  if (!raw || typeof raw !== 'object') return { ...NO_CHANNEL_STATE };
  return { later: count(raw.later), laterAt: time(raw.laterAt), following: raw.following === true, openedAt: time(raw.openedAt) };
}
const updateChannel = (patch: (state: ChannelInviteState) => Partial<ChannelInviteState>, store: Store | null = local()) => {
  const current = readChannelInvite(store);
  const next = { ...current, ...patch(current) };
  writeJson(INVITATION_KEYS.channel, next, store);
  return next;
};
export const recordChannelLater = (now = Date.now(), store: Store | null = local()) => updateChannel(state => ({ later: state.later + 1, laterAt: now }), store);
export const recordChannelFollowing = (store: Store | null = local()) => updateChannel(() => ({ following: true }), store);
/** Opening the Channel is an outbound click, not a confirmed follow. */
export const recordChannelOpened = (now = Date.now(), store: Store | null = local()) => updateChannel(() => ({ openedAt: now }), store);

/** Reads an ISO date or a millisecond time (the browser's install confirmation is stored as ISO). */
export function readTime(key: string, store: Store | null = local()): number | null {
  try {
    const value = store?.getItem(key);
    if (!value) return null;
    const parsed = /^\d+$/.test(value) ? Number(value) : Date.parse(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch { return null; }
}

// ── Coordinator (one per page) ───────────────────────────────────────────────────────────────────────────────

let onScreen: Slot | null = null;
const inlineOffers = new Set<string>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

export function subscribeInvitations(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const invitationOnScreen = () => onScreen;
/** An install card inside the page is showing an offer: floating invitations stay away from that page. */
export const inlineOfferVisible = () => inlineOffers.size > 0;
export function registerInlineOffer(id: string) {
  inlineOffers.add(id);
  notify();
  return () => { if (inlineOffers.delete(id)) notify(); };
}

export const noteView = (page: string) => { updateSession(session => (session.lastPage === page ? {} : { views: session.views + 1, lastPage: page })); };
export const noteActive = (ms: number) => updateSession(session => ({ activeMs: Math.min(session.activeMs + Math.max(0, ms), 10 * 60_000) }));
export const notePurchase = () => { updateSession(() => ({ purchase: true })); };
/** Any "Not now", "Maybe later" or close: nothing else is suggested for the rest of this visit. */
export const noteDismissal = () => { updateSession(() => ({ dismissed: true })); };
/** Someone acted on an in-page suggestion (for example Install App on the Home card): that was this visit's one. */
export const noteInvitationAnswered = (kind: InvitationKind) => { updateSession(session => (session.shown ? {} : { shown: kind })); };

/** Claims the screen for the first kind whose rules allow it now, and remembers it was shown. */
export function claimInvitation(kinds: InvitationKind[], now = Date.now()): InvitationKind | null {
  if (onScreen) return null;
  const session = readSession(), seen = readSeen();
  const kind = kinds.find(candidate => sessionAllows(candidate, session, seen, now)) || null;
  if (!kind) return null;
  onScreen = kind;
  writeSession({ ...session, shown: kind });
  writeJson(INVITATION_KEYS.seen, { ...seen, [kind]: now }, local());
  notify();
  return kind;
}

/** The installed-app welcome sheet: shown alone, and it keeps install and Channel suggestions out of this visit. */
export function claimWelcome() {
  if (onScreen) return false;
  onScreen = 'welcome';
  updateSession(() => ({ welcome: true }));
  notify();
  return true;
}

export function releaseInvitation(slot: Slot) {
  if (onScreen !== slot) return;
  onScreen = null;
  notify();
}

/** Tests only: forget the in-memory coordinator state between cases. */
export function resetInvitationsForTest() {
  onScreen = null; inlineOffers.clear(); memorySession = null; notify();
}
