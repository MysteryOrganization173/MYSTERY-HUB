/**
 * Mystery Hub 3.6.3 Release A · emergency service incidents.
 *
 * The one source of truth, read by the server and by the browser, for a service that is paused for new purchases.
 * Server: the direct Data catalogue leaves paused products out, so a quote, a payment start (card or Wallet), a
 * reorder and the assistant cannot use them; existing orders, payment verification, webhooks, recovery and refunds
 * are untouched. Browser: the same record shapes the announcement and the maintenance states, so a customer learns
 * about the pause before choosing a bundle instead of after entering their details.
 *
 * An incident never ends by itself. Its expected restoration date is shown to customers, and once it passes the copy
 * says restoration is awaiting confirmation; purchases stay paused until the incident is removed by an authorised
 * release (Release B moves this to the Admin Service Control Center).
 *
 * Customer copy never names suppliers and never promises refunds or a restoration date.
 */

export type IncidentService = 'data' | 'instant_bundle' | 'airtime';
export type IncidentNetwork = 'mtn' | 'telecel' | 'airteltigo';

export interface ServiceIncident {
  /** Stable identity; with `revision`, a dismissal applies only to the announcement the customer actually saw. */
  id: string;
  revision: number;
  service: IncidentService;
  network: IncidentNetwork;
  state: 'maintenance';
  /** New purchases of this service on this network are refused. */
  blocksPurchases: true;
  title: string;
  /** One sentence for compact places (network chips, rows). */
  short: string;
  message: string;
  /** Accra calendar date (YYYY-MM-DD) the service is expected back. An expectation, never a switch. */
  expectedRestoration: string;
  existingOrders: string;
  apology: string;
  followUp: string;
}

export const SERVICE_INCIDENTS: readonly ServiceIncident[] = Object.freeze([
  Object.freeze({
    id: 'mtn-data-maintenance-2026-11',
    revision: 1,
    service: 'data',
    network: 'mtn',
    state: 'maintenance',
    blocksPurchases: true,
    title: 'MTN Data service update',
    short: 'MTN Data purchases are paused for maintenance.',
    message: 'MTN Data bundle purchases are temporarily suspended due to ongoing maintenance and system upgrades.',
    expectedRestoration: '2026-12-01',
    existingOrders: 'Existing orders remain trackable. Affected transactions will be reviewed accordingly.',
    apology: 'We apologize for the inconvenience and appreciate your patience.',
    followUp: 'We will announce once MTN Data services are restored.',
  }),
]);

/**
 * The incidents in force. In production (and in the browser) this is always SERVICE_INCIDENTS. Under the Node test
 * runner the regression suite starts with none, so suites about prices and checkout keep testing those, and a test
 * that is about incidents opts in explicitly with `setServiceIncidentsForTests`.
 */
const underTest = typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT || process.env?.NODE_ENV === 'test');
let inForce: readonly ServiceIncident[] = underTest ? [] : SERVICE_INCIDENTS;
export const activeServiceIncidents = () => inForce;
/** Tests only (refuses outside the test runner). */
export function setServiceIncidentsForTests(list: readonly ServiceIncident[]): void {
  if (!underTest) throw new Error('Service incidents can only be replaced in tests.');
  inForce = list;
}

/** Today's date in Accra (Ghana keeps GMT all year). */
export function accraDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** The incident pausing new purchases of this service on this network, if any. */
export function purchaseIncident(service: string | undefined, network: string | undefined, incidents: readonly ServiceIncident[] = activeServiceIncidents()): ServiceIncident | null {
  if (!service || !network) return null;
  return incidents.find((incident) => incident.blocksPurchases && incident.service === service && incident.network === network.toLowerCase()) || null;
}

/** Whether a standard Data bundle on this network may be offered for a new purchase. */
export const dataPurchasePaused = (network: string | undefined, incidents: readonly ServiceIncident[] = activeServiceIncidents()) => purchaseIncident('data', network, incidents) !== null;

const LONG_DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
/** "Tuesday, December 1, 2026" in the approved wording order. */
export function restorationDateLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return date;
  const parts = Object.fromEntries(LONG_DATE.formatToParts(parsed).map((p) => [p.type, p.value]));
  return `${parts.weekday}, ${parts.month} ${parts.day}, ${parts.year}`;
}

/**
 * The restoration line for today. Before or on the expected date: "Expected resumption: …". After it, while the
 * incident is still in force: restoration is awaiting confirmation (never a countdown, never "back now").
 */
export function restorationLine(incident: Pick<ServiceIncident, 'expectedRestoration'>, today: string = accraDate()): { label: string; overdue: boolean } {
  const when = restorationDateLabel(incident.expectedRestoration);
  if (today > incident.expectedRestoration) return { label: `Expected resumption was ${when}. Restoration is awaiting confirmation; purchases stay paused until we confirm the service is back.`, overdue: true };
  return { label: `Expected resumption: ${when}.`, overdue: false };
}
