/**
 * Mystery Hub 3.6.3 Release B · customer announcements, managed in the Admin Service Control Center.
 *
 * Bounded, plain-text records (no HTML, no free links: a call to action is one of a few internal destinations),
 * stored with the existing commercial settings (finance_config key `service-announcements`, versioned, audited).
 * An announcement only informs: it never pauses or reopens a service (that is the service control), never changes an
 * order, and its end time never lifts a pause. Customers see only published records inside their time window.
 *
 * Until the founder saves the first change, the shipped default applies: the Release A MTN Data announcement.
 */
import { SERVICE_SCOPES, isAccraDate, isPlainText, namesSupplier, type ScopeId } from './serviceControls.js';

export const ANNOUNCEMENT_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type AnnouncementSeverity = typeof ANNOUNCEMENT_SEVERITIES[number];
export const ANNOUNCEMENT_PLACEMENTS = ['bar', 'modal'] as const;
export type AnnouncementPlacement = typeof ANNOUNCEMENT_PLACEMENTS[number];
/** Pages a bar may appear on (customer pages only; never Admin, the editor or published customer websites). */
export const ANNOUNCEMENT_PAGES = ['home', 'data', 'orders', 'help', 'all'] as const;
export type AnnouncementPage = typeof ANNOUNCEMENT_PAGES[number];
export const ANNOUNCEMENT_AUDIENCES = ['everyone', 'guests', 'members'] as const;
export type AnnouncementAudience = typeof ANNOUNCEMENT_AUDIENCES[number];
export const ANNOUNCEMENT_STATUSES = ['draft', 'published', 'archived'] as const;
export type AnnouncementStatus = typeof ANNOUNCEMENT_STATUSES[number];
/** The only calls to action: safe internal destinations, never typed links. */
export const ANNOUNCEMENT_CTAS = {
  track_order: { label: 'Track an order', page: 'orders' },
  browse_data: { label: 'Browse bundles', page: 'data' },
  instant: { label: 'Instant Bundles', page: 'data', mode: 'instant' },
  help: { label: 'Get help', page: 'help' },
} as const;
export type AnnouncementCta = keyof typeof ANNOUNCEMENT_CTAS;
/** Own keys only: names such as "toString" or "__proto__" are not destinations. */
export const isAnnouncementCta = (value: unknown): value is AnnouncementCta => typeof value === 'string' && Object.prototype.hasOwnProperty.call(ANNOUNCEMENT_CTAS, value);

export interface Announcement {
  id: string;
  /** Admin only, never shown to customers. */
  name: string;
  title: string;
  summary: string;
  details: string;
  severity: AnnouncementSeverity;
  scope: 'global' | ScopeId;
  placement: AnnouncementPlacement;
  pages: AnnouncementPage[];
  audience: AnnouncementAudience;
  dismissible: boolean;
  startsAt: string | null;
  endsAt: string | null;
  expectedRestoration: string | null;
  cta: AnnouncementCta | null;
  status: AnnouncementStatus;
  revision: number;
  updatedAt: string | null;
  actorId: string | null;
}
export interface AnnouncementsDoc { version: string; source: 'saved' | 'shipped-default'; items: Announcement[] }

export const ANNOUNCEMENT_LIMITS = { name: 80, title: 80, summary: 180, details: 600, items: 30 } as const;

export const SHIPPED_ANNOUNCEMENTS_VERSION = 'release-a-mtn-data-2026-11';
export const SHIPPED_ANNOUNCEMENTS: readonly Announcement[] = Object.freeze([Object.freeze({
  id: 'mtn-data-maintenance-2026-11',
  name: 'MTN Data maintenance (Release A)',
  title: 'MTN Data service update',
  summary: 'MTN Data purchases are paused for maintenance.',
  details: 'MTN Data bundle purchases are temporarily suspended due to ongoing maintenance and system upgrades. Existing orders remain trackable. Affected transactions will be reviewed accordingly. We apologize for the inconvenience and appreciate your patience. We will announce once MTN Data services are restored.',
  severity: 'warning' as AnnouncementSeverity,
  scope: 'data:mtn' as ScopeId,
  placement: 'bar' as AnnouncementPlacement,
  pages: ['home', 'orders', 'help'] as AnnouncementPage[],
  audience: 'everyone' as AnnouncementAudience,
  dismissible: true,
  startsAt: null,
  endsAt: null,
  expectedRestoration: '2026-12-01',
  cta: 'track_order' as AnnouncementCta,
  status: 'published' as AnnouncementStatus,
  revision: 1,
  updatedAt: '2026-11-25T09:35:00.000Z',
  actorId: null,
})]);

const iso = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}T/.test(value);

/** Validates one announcement's editable fields. Returns the problems (empty when valid). */
export function announcementProblems(a: Partial<Announcement>): string[] {
  const out: string[] = [];
  if (!isPlainText(a.name, ANNOUNCEMENT_LIMITS.name)) out.push(`Give it an internal name (up to ${ANNOUNCEMENT_LIMITS.name} characters, plain text).`);
  if (!isPlainText(a.title, ANNOUNCEMENT_LIMITS.title)) out.push(`Write a public title (up to ${ANNOUNCEMENT_LIMITS.title} characters, plain text).`);
  if (!isPlainText(a.summary, ANNOUNCEMENT_LIMITS.summary)) out.push(`Write a short public line (up to ${ANNOUNCEMENT_LIMITS.summary} characters, plain text).`);
  if (!isPlainText(a.details ?? '', ANNOUNCEMENT_LIMITS.details, false)) out.push(`Details can be up to ${ANNOUNCEMENT_LIMITS.details} characters of plain text.`);
  if (!ANNOUNCEMENT_SEVERITIES.includes(a.severity as AnnouncementSeverity)) out.push('Choose a severity.');
  if (a.scope !== 'global' && !SERVICE_SCOPES.some((s) => s.id === a.scope)) out.push('Choose where it applies.');
  if (!ANNOUNCEMENT_PLACEMENTS.includes(a.placement as AnnouncementPlacement)) out.push('Choose a placement.');
  if (!Array.isArray(a.pages) || a.pages.length === 0 || a.pages.length > ANNOUNCEMENT_PAGES.length || a.pages.some((p) => !ANNOUNCEMENT_PAGES.includes(p)) || new Set(a.pages).size !== a.pages.length) out.push('Choose at least one page.');
  if (!ANNOUNCEMENT_AUDIENCES.includes(a.audience as AnnouncementAudience)) out.push('Choose who sees it.');
  if (typeof a.dismissible !== 'boolean') out.push('Choose whether customers can hide it.');
  if (a.startsAt !== null && a.startsAt !== undefined && !iso(a.startsAt)) out.push('The start time is not valid.');
  if (a.endsAt !== null && a.endsAt !== undefined && !iso(a.endsAt)) out.push('The end time is not valid.');
  if (iso(a.startsAt) && iso(a.endsAt) && Date.parse(a.endsAt) <= Date.parse(a.startsAt)) out.push('The end time must be after the start time.');
  if (a.expectedRestoration !== null && a.expectedRestoration !== undefined && !isAccraDate(a.expectedRestoration)) out.push('The expected restoration date is not valid.');
  if (a.cta !== null && a.cta !== undefined && !isAnnouncementCta(a.cta)) out.push('Choose a supported action.');
  if ([a.title, a.summary, a.details].some(namesSupplier)) out.push('Customer words must not name a supplier or reseller arrangement.');
  return out;
}

export function normalizeAnnouncements(stored: unknown): AnnouncementsDoc {
  const doc = stored as Partial<AnnouncementsDoc> | null | undefined;
  // A saved list that cannot be read shows nothing (announcements never change what can be bought); saving replaces it.
  if (doc !== null && doc !== undefined && (typeof doc !== 'object' || typeof doc.version !== 'string' || !Array.isArray(doc.items))) return { version: 'unreadable-saved-record', source: 'saved', items: [] };
  if (!doc) return { version: SHIPPED_ANNOUNCEMENTS_VERSION, source: 'shipped-default', items: SHIPPED_ANNOUNCEMENTS.map((a) => ({ ...a, pages: [...a.pages] })) };
  const items = (doc.items as Announcement[]).filter((a) => a && typeof a.id === 'string' && ANNOUNCEMENT_STATUSES.includes(a.status) && announcementProblems(a).length === 0).slice(0, ANNOUNCEMENT_LIMITS.items);
  return { version: doc.version as string, source: 'saved', items };
}

/** Published and inside its window right now. An ended announcement simply stops showing; it never touches a pause. */
export const isLiveAnnouncement = (a: Announcement, now = Date.now()) =>
  a.status === 'published' && (!a.startsAt || Date.parse(a.startsAt) <= now) && (!a.endsAt || now < Date.parse(a.endsAt));

const SEVERITY_RANK: Record<AnnouncementSeverity, number> = { critical: 0, warning: 1, info: 2 };
export interface PublicAnnouncement { id: string; revision: number; title: string; summary: string; details: string; severity: AnnouncementSeverity; scope: 'global' | ScopeId; placement: AnnouncementPlacement; pages: AnnouncementPage[]; audience: AnnouncementAudience; dismissible: boolean; expectedRestoration: string | null; cta: AnnouncementCta | null }
/** Customer projection: live records only, most important first, without internal names or actors. */
export function publicAnnouncements(doc: AnnouncementsDoc, now = Date.now()): PublicAnnouncement[] {
  return doc.items.filter((a) => isLiveAnnouncement(a, now))
    .sort((x, y) => SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity] || Date.parse(y.updatedAt || '0') - Date.parse(x.updatedAt || '0'))
    .map(({ id, revision, title, summary, details, severity, scope, placement, pages, audience, dismissible, expectedRestoration, cta }) => ({ id, revision, title, summary, details, severity, scope, placement, pages: [...pages], audience, dismissible, expectedRestoration, cta }));
}
/** The announcements for one page and visitor, highest priority first. */
export function announcementsFor(list: PublicAnnouncement[], page: string, signedIn: boolean, placement: AnnouncementPlacement): PublicAnnouncement[] {
  // Most severe first whatever order arrived (a stable sort keeps the server's newest-first order within a severity).
  return list.filter((a) => a.placement === placement && (a.pages.includes('all') || a.pages.includes(page as AnnouncementPage)) && (a.audience === 'everyone' || (a.audience === 'members') === signedIn))
    .sort((x, y) => (SEVERITY_RANK[x.severity] ?? 9) - (SEVERITY_RANK[y.severity] ?? 9));
}
