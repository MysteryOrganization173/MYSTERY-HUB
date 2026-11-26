/**
 * Mystery Hub 3.6.3 Release B · Service Control Center: the operating state of each customer service, by network.
 *
 * One record per scope (service × network), stored with the existing commercial settings (finance_config key
 * `service-controls`, versioned, audited). The manual state composes with every other restriction: a scope that is
 * "operational" here may still be refused by supplier preflight, product availability, payment rules or eligibility.
 * Nothing here says a supplier works. "maintenance" and "suspended" refuse new purchases; existing orders, payment
 * verification, webhooks, recovery and refunds never read this.
 *
 * Until the founder saves the first change, the shipped default applies: the Release A MTN Data maintenance record,
 * so the emergency pause continues unchanged through this release. A saved record is authoritative from then on; a
 * deploy never migrates it. An expected restoration date is shown to customers but never reopens anything.
 */
import { SUPPLIER_NETWORKS, SUPPLIER_SERVICES } from './supplierRouting.js';

export const CONTROL_SERVICES = SUPPLIER_SERVICES;
export const CONTROL_NETWORKS = SUPPLIER_NETWORKS;
export type ControlService = typeof CONTROL_SERVICES[number];
export type ControlNetwork = typeof CONTROL_NETWORKS[number];
export type ScopeId = `${ControlService}:${ControlNetwork}`;

const SERVICE_NAME: Record<ControlService, string> = { data: 'Data', instant_bundle: 'Instant Bundles', airtime: 'Airtime' };
const NETWORK_NAME: Record<ControlNetwork, string> = { mtn: 'MTN', telecel: 'Telecel', airteltigo: 'AirtelTigo' };
export interface ServiceScope { id: ScopeId; service: ControlService; network: ControlNetwork; label: string }
export const SERVICE_SCOPES: readonly ServiceScope[] = Object.freeze(CONTROL_NETWORKS.flatMap((network) => CONTROL_SERVICES.map((service) => Object.freeze({
  id: `${service}:${network}` as ScopeId, service, network, label: `${NETWORK_NAME[network]} ${SERVICE_NAME[service]}`,
}))));
export const scopeId = (service: string, network: string): ScopeId | null => {
  const id = `${service}:${String(network).toLowerCase()}`;
  return SERVICE_SCOPES.some((s) => s.id === id) ? id as ScopeId : null;
};
export const scopeLabel = (id: ScopeId) => SERVICE_SCOPES.find((s) => s.id === id)?.label ?? id;

export const OPERATING_STATES = ['operational', 'delayed', 'maintenance', 'suspended'] as const;
export type OperatingState = typeof OPERATING_STATES[number];
/** Only these refuse new purchases. "delayed" keeps purchases open with a customer warning. */
export const blocksPurchases = (state: OperatingState | undefined) => state === 'maintenance' || state === 'suspended';

export interface ServiceControl {
  scope: ScopeId;
  state: OperatingState;
  /** Customer-facing words (plain text). Shown wherever the scope matters: the maintenance state, lists, checkout. */
  title: string;
  message: string;
  /** Guidance for customers who already have orders of this service (never changes an order's status). */
  existingOrders: string;
  /** Accra date (YYYY-MM-DD) the service is expected back, or null. An expectation, never a switch. */
  expectedRestoration: string | null;
  revision: number;
  updatedAt: string | null;
  actorId: string | null;
}
export interface ServiceControlsDoc { version: string; source: 'saved' | 'shipped-default'; controls: ServiceControl[]; unreadable?: boolean }

export const SHIPPED_CONTROLS_VERSION = 'release-a-mtn-data-2026-11';
/** The Release A emergency record, word for word. */
export const SHIPPED_CONTROLS: readonly ServiceControl[] = Object.freeze([Object.freeze({
  scope: 'data:mtn' as ScopeId,
  state: 'maintenance' as OperatingState,
  title: 'MTN Data service update',
  message: 'MTN Data bundle purchases are temporarily suspended due to ongoing maintenance and system upgrades.',
  existingOrders: 'Existing orders remain trackable. Affected transactions will be reviewed accordingly.',
  expectedRestoration: '2026-12-01',
  revision: 1,
  updatedAt: '2026-11-25T09:35:00.000Z',
  actorId: null,
})]);

export const CONTROL_LIMITS = { title: 80, message: 400, existingOrders: 240 } as const;
const PLAIN = /^[^<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/;
export const isPlainText = (value: unknown, max: number, required = true): value is string =>
  typeof value === 'string' && value.length <= max && PLAIN.test(value) && (!required || value.trim().length > 0);
/** Customer words never name a supplier or a reseller arrangement. Checked on the server, not only in the editor. */
export const namesSupplier = (text: unknown) => typeof text === 'string' && /success\s*biz|brainiac|supplier|reseller|wholesale|upstream/i.test(text);
export const isAccraDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

/** Stored document (or nothing) → a valid document. A malformed stored record is ignored, never trusted. */
export const UNREADABLE_CONTROLS_VERSION = 'unreadable-saved-record';
export function normalizeControls(stored: unknown): ServiceControlsDoc {
  // Only "nothing saved" means the shipped default.
  if (stored === null || stored === undefined) return { version: SHIPPED_CONTROLS_VERSION, source: 'shipped-default', controls: SHIPPED_CONTROLS.map((c) => ({ ...c })) };
  const doc = stored as Partial<ServiceControlsDoc>;
  if (typeof doc !== 'object' || typeof doc.version !== 'string' || !Array.isArray(doc.controls)) {
    // A saved record that cannot be read never reopens anything: every service refuses new purchases until an Admin
    // saves again (the Admin screen says so).
    return { version: UNREADABLE_CONTROLS_VERSION, source: 'saved', unreadable: true, controls: SERVICE_SCOPES.map((s) => ({
      scope: s.id, state: 'suspended' as OperatingState, title: `${s.label} service update`, message: 'New purchases are paused for now while we check this service.',
      existingOrders: 'Existing orders remain trackable.', expectedRestoration: null, revision: 1, updatedAt: null, actorId: null })) };
  }
  const controls: ServiceControl[] = [];
  for (const raw of doc.controls as Partial<ServiceControl>[]) {
    if (!raw || !SERVICE_SCOPES.some((s) => s.id === raw.scope) || controls.some((c) => c.scope === raw.scope)) continue;
    controls.push({
      // A state this version does not know (a rollback, a manual edit) refuses purchases rather than reopening them.
      scope: raw.scope as ScopeId, state: OPERATING_STATES.includes(raw.state as OperatingState) ? raw.state as OperatingState : 'suspended',
      title: isPlainText(raw.title, CONTROL_LIMITS.title, false) ? raw.title : '',
      message: isPlainText(raw.message, CONTROL_LIMITS.message, false) ? raw.message : '',
      existingOrders: isPlainText(raw.existingOrders, CONTROL_LIMITS.existingOrders, false) ? raw.existingOrders : '',
      expectedRestoration: isAccraDate(raw.expectedRestoration) ? raw.expectedRestoration : null,
      revision: Number.isSafeInteger(raw.revision) ? raw.revision as number : 1,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
      actorId: typeof raw.actorId === 'string' ? raw.actorId : null,
    });
  }
  return { version: doc.version, source: 'saved', controls };
}

const OPERATIONAL = (scope: ScopeId): ServiceControl => ({ scope, state: 'operational', title: '', message: '', existingOrders: '', expectedRestoration: null, revision: 0, updatedAt: null, actorId: null });
export function controlFor(doc: Pick<ServiceControlsDoc, 'controls'>, service: string | undefined, network: string | undefined): ServiceControl | null {
  const id = service && network ? scopeId(service, network) : null;
  if (!id) return null;
  return doc.controls.find((c) => c.scope === id) ?? OPERATIONAL(id);
}

/** Customer projection: only scopes that are not operational, and only customer words. */
export interface PublicServiceControl { scope: ScopeId; service: ControlService; network: ControlNetwork; state: Exclude<OperatingState, 'operational'>; blocksPurchases: boolean; title: string; message: string; existingOrders: string; expectedRestoration: string | null; revision: number }
export function publicControls(doc: ServiceControlsDoc): PublicServiceControl[] {
  return doc.controls.filter((c) => c.state !== 'operational').map((c) => {
    const scope = SERVICE_SCOPES.find((s) => s.id === c.scope)!;
    return { scope: c.scope, service: scope.service, network: scope.network, state: c.state as Exclude<OperatingState, 'operational'>, blocksPurchases: blocksPurchases(c.state),
      title: c.title || `${scope.label} service update`, message: c.message, existingOrders: c.existingOrders, expectedRestoration: c.expectedRestoration, revision: c.revision };
  });
}

/** Today's date in Accra (Ghana keeps GMT all year). */
export const accraDate = (now: Date = new Date()) => now.toISOString().slice(0, 10);
const LONG_DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
/** "Tuesday, December 1, 2026", the approved wording order. */
export function restorationDateLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return date;
  const parts = Object.fromEntries(LONG_DATE.formatToParts(parsed).map((p) => [p.type, p.value]));
  return `${parts.weekday}, ${parts.month} ${parts.day}, ${parts.year}`;
}
/**
 * The restoration line for a date ("today" should come from the server when known). After the expected date, while
 * the scope is still paused, it says restoration is awaiting confirmation: never a countdown, never "back now".
 */
export function restorationLine(expected: string | null, today: string = accraDate(), paused = true): { label: string; overdue: boolean } | null {
  if (!expected) return null;
  const when = restorationDateLabel(expected);
  if (today > expected) return { label: paused
    ? `Expected resumption was ${when}. Restoration is awaiting confirmation; purchases stay paused until we confirm the service is back.`
    : `We expected normal service by ${when}. We will update this notice as soon as we can confirm it.`, overdue: true };
  return { label: paused ? `Expected resumption: ${when}.` : `Expected back to normal: ${when}.`, overdue: false };
}
