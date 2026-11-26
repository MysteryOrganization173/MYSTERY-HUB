import { randomUUID } from 'node:crypto';
import { FinanceStore, FinanceError, type FinanceTx } from '../db/financeStore.js';
import { AdminAuditStore } from '../db/adminAuditStore.js';
import { AUTHORITATIVE_PRODUCTS } from '../data/productCatalog.js';
import { FulfilmentService } from './fulfilmentService.js';
import { sharedMerchantCheckoutAvailable } from '../../shared/paymentAvailability.js';
import { underNodeTest } from '../../shared/testRuntime.js';
import {
  CONTROL_LIMITS, OPERATING_STATES, SERVICE_SCOPES, accraDate, blocksPurchases, controlFor, isAccraDate, isPlainText,
  normalizeControls, publicControls, type ControlService, type OperatingState, type ServiceControl, type ServiceControlsDoc,
} from '../../shared/serviceControls.js';
import {
  ANNOUNCEMENT_LIMITS, announcementProblems, normalizeAnnouncements, publicAnnouncements, type Announcement, type AnnouncementsDoc,
} from '../../shared/announcements.js';

/**
 * Mystery Hub 3.6.3 Release B · the Service Control Center on the server.
 *
 * Storage: the existing commercial settings table (finance_config), keys `service-controls` and
 * `service-announcements`, written only inside a FinanceStore transaction under an advisory lock, compared against the
 * version the Admin reviewed (409 on a conflict) and recorded in the Admin audit log. No new table, no migration.
 *
 * Reads: one shared snapshot per process, cached for 15 s and refreshed by any save in this process, so public pages
 * and the catalogue cost at most two small reads per 15 s. If a refresh fails, the last good snapshot keeps applying;
 * with none, the read fails and so does the catalogue (purchases are never opened by an error).
 */
const CONTROLS_KEY = 'service-controls', ANNOUNCEMENTS_KEY = 'service-announcements';
const CACHE_MS = 15_000;
interface Snapshot { at: number; controls: ServiceControlsDoc; announcements: AnnouncementsDoc }
let cache: Snapshot | null = null, flight: Promise<Snapshot> | null = null;
// Under the test runner only: the regression suite starts with nothing paused unless a test opts in.
let shippedInTests = false;

const readControls = (stored: unknown) => underNodeTest && !shippedInTests && !stored ? { version: 'test-empty', source: 'saved' as const, controls: [] } : normalizeControls(stored);
const readAnnouncements = (stored: unknown) => underNodeTest && !shippedInTests && !stored ? { version: 'test-empty', source: 'saved' as const, items: [] } : normalizeAnnouncements(stored);

const lock = async (tx: FinanceTx) => { if (tx.client) await tx.client.query("SELECT pg_advisory_xact_lock(hashtextextended('service-control', 0))"); };

export class ServiceControlService {
  static now = () => new Date();

  /** Tests only: use the shipped defaults (the Release A record) when nothing is saved, and drop the cache. */
  static useShippedDefaultsForTests(on: boolean) {
    if (!underNodeTest) throw new Error('Only tests can change service control defaults.');
    shippedInTests = on; cache = null; flight = null;
  }
  static invalidate() { cache = null; }

  static async snapshot(): Promise<Snapshot> {
    const now = Date.now();
    if (cache && now - cache.at < CACHE_MS) return cache;
    if (!flight) {
      const previous = cache;
      flight = Promise.all([FinanceStore.readConfig(CONTROLS_KEY), FinanceStore.readConfig(ANNOUNCEMENTS_KEY)])
        .then(([c, a]) => (cache = { at: Date.now(), controls: readControls(c), announcements: readAnnouncements(a) }))
        .catch((error) => { if (previous) return previous; throw error; })
        .finally(() => { flight = null; });
    }
    return flight;
  }

  /** The control refusing new purchases of this service on this network, or null. */
  static async purchaseBlock(service: ControlService, network: string): Promise<ServiceControl | null> {
    const control = controlFor((await this.snapshot()).controls, service, network);
    return control && blocksPurchases(control.state) ? control : null;
  }
  /** Networks whose purchases of this service are refused right now. */
  static async blockedNetworks(service: ControlService): Promise<Set<string>> {
    const { controls } = await this.snapshot();
    return new Set(controls.controls.filter((c) => blocksPurchases(c.state) && c.scope.startsWith(`${service}:`)).map((c) => c.scope.split(':')[1]));
  }

  /** What every customer page reads: non-operational scopes and live announcements, customer words only. */
  static async publicStatus() {
    const snap = await this.snapshot();
    return { version: `${snap.controls.version}~${snap.announcements.version}`, serverDate: accraDate(this.now()), controls: publicControls(snap.controls), announcements: publicAnnouncements(snap.announcements, this.now().getTime()) };
  }

  /** The Admin view: every scope with its manual state and the other restrictions that still apply, plus history. */
  static async admin() {
    const [storedControls, storedAnnouncements, prices] = await Promise.all([FinanceStore.readConfig(CONTROLS_KEY), FinanceStore.readConfig(ANNOUNCEMENTS_KEY), FinanceStore.readConfig('direct-pricing')]);
    const controls = readControls(storedControls), announcements = readAnnouncements(storedAnnouncements);
    const scopes = SERVICE_SCOPES.map((scope) => {
      const control = controlFor(controls, scope.service, scope.network)!;
      const dataProducts = scope.service === 'data' ? Object.values(AUTHORITATIVE_PRODUCTS).filter((p) => p.network === scope.network) : null;
      const enabled = dataProducts ? dataProducts.filter((p) => p.isActive && ((prices as any)?.products?.[p.id]?.enabled ?? true)).length : null;
      // Route configuration only (no supplier request): whether a qualified route accepts new orders here.
      let route: 'configured' | 'unavailable' = 'configured';
      try { FulfilmentService.resolveRoute({ service: scope.service, network: scope.network }); } catch { route = 'unavailable'; }
      return { ...scope, control, blocksPurchases: blocksPurchases(control.state), products: dataProducts ? { enabled, total: dataProducts.length } : null, paymentPermitted: sharedMerchantCheckoutAvailable(scope.service), route };
    });
    const audit = (await AdminAuditStore.findRecent(300)).filter((a) => a.action.startsWith('service_control_') || a.action.startsWith('service_announcement_')).slice(0, 30);
    return { serverDate: accraDate(this.now()), controls: { version: controls.version, source: controls.source }, announcements: { version: announcements.version, source: announcements.source, items: announcements.items }, scopes, audit };
  }

  static async saveControl(adminId: string, input: any) {
    if (input?.confirmed !== true) throw new FinanceError('Confirm this change.');
    const scope = SERVICE_SCOPES.find((s) => s.id === input.scope);
    if (!scope) throw new FinanceError('Choose a service.');
    const state = input.state as OperatingState;
    if (!OPERATING_STATES.includes(state)) throw new FinanceError('Choose an operating state.');
    const title = typeof input.title === 'string' ? input.title.trim() : '', message = typeof input.message === 'string' ? input.message.trim() : '', existingOrders = typeof input.existingOrders === 'string' ? input.existingOrders.trim() : '';
    if (!isPlainText(title, CONTROL_LIMITS.title, false) || !isPlainText(message, CONTROL_LIMITS.message, false) || !isPlainText(existingOrders, CONTROL_LIMITS.existingOrders, false)) throw new FinanceError('Customer words must be plain text within the length limits.');
    if (state !== 'operational' && (!title || !message)) throw new FinanceError('Write the customer title and message for this state.');
    // An operational service has nothing to restore: any date sent with it is dropped, so no stale expectation lingers.
    const expectedRestoration = state === 'operational' || input.expectedRestoration === null || input.expectedRestoration === '' || input.expectedRestoration === undefined ? null : input.expectedRestoration;
    if (expectedRestoration !== null && !isAccraDate(expectedRestoration)) throw new FinanceError('The expected restoration date is not valid.');
    if (typeof input.expectedVersion !== 'string') throw new FinanceError('Refresh before saving.', 409);
    const result = await FinanceStore.transaction(adminId, async (tx) => {
      await lock(tx);
      const current = readControls(await tx.config(CONTROLS_KEY));
      if (current.version !== input.expectedVersion) throw new FinanceError('Someone else changed the service controls. Refresh, review, then save again.', 409);
      const previous = controlFor(current, scope.service, scope.network)!;
      const next: ServiceControl = { scope: scope.id, state, title, message, existingOrders, expectedRestoration, revision: previous.revision + 1, updatedAt: this.now().toISOString(), actorId: adminId };
      const doc = { version: randomUUID(), controls: [...current.controls.filter((c) => c.scope !== scope.id), next], updatedAt: next.updatedAt, actorId: adminId };
      await tx.saveConfig(CONTROLS_KEY, doc);
      await tx.audit(adminId, 'service_control_changed', scope.id, {
        previous: { state: previous.state, title: previous.title, expectedRestoration: previous.expectedRestoration },
        next: { state, title, expectedRestoration },
        effect: blocksPurchases(state) ? 'new_purchases_refused' : blocksPurchases(previous.state) ? 'manual_pause_lifted' : 'no_purchase_change',
      });
      return doc;
    });
    this.invalidate();
    return { saved: result.version, view: await this.admin() };
  }

  /** create | update | publish | unpublish | archive one announcement. */
  static async saveAnnouncement(adminId: string, input: any) {
    if (input?.confirmed !== true) throw new FinanceError('Confirm this change.');
    const action = input.action;
    if (!['create', 'update', 'publish', 'unpublish', 'archive'].includes(action)) throw new FinanceError('Unknown announcement action.');
    if (typeof input.expectedVersion !== 'string') throw new FinanceError('Refresh before saving.', 409);
    const fields = (raw: any): Omit<Announcement, 'id' | 'status' | 'revision' | 'updatedAt' | 'actorId'> => {
      const a = raw || {};
      const picked = {
        name: String(a.name ?? '').trim(), title: String(a.title ?? '').trim(), summary: String(a.summary ?? '').trim(), details: String(a.details ?? '').trim(),
        severity: a.severity, scope: a.scope, placement: a.placement, pages: Array.isArray(a.pages) ? a.pages : [], audience: a.audience, dismissible: a.dismissible,
        startsAt: a.startsAt || null, endsAt: a.endsAt || null, expectedRestoration: a.expectedRestoration || null, cta: a.cta || null,
      };
      const problems = announcementProblems(picked as Partial<Announcement>);
      if (problems.length) throw new FinanceError(problems.join(' '));
      return picked as any;
    };
    const result = await FinanceStore.transaction(adminId, async (tx) => {
      await lock(tx);
      const current = readAnnouncements(await tx.config(ANNOUNCEMENTS_KEY));
      if (current.version !== input.expectedVersion) throw new FinanceError('Someone else changed the announcements. Refresh, review, then save again.', 409);
      const now = this.now().toISOString();
      let items = current.items.map((a) => ({ ...a, pages: [...a.pages] }));
      let target: Announcement;
      if (action === 'create') {
        if (items.filter((a) => a.status !== 'archived').length >= ANNOUNCEMENT_LIMITS.items) throw new FinanceError('Archive an old announcement first.');
        target = { id: randomUUID(), ...fields(input.announcement), status: 'draft', revision: 1, updatedAt: now, actorId: adminId };
        items = [target, ...items].slice(0, ANNOUNCEMENT_LIMITS.items);
      } else {
        const index = items.findIndex((a) => a.id === input.id);
        if (index < 0) throw new FinanceError('That announcement no longer exists. Refresh.', 409);
        const before = items[index];
        if (action === 'update') {
          if (before.status === 'archived') throw new FinanceError('Archived announcements cannot be edited.');
          const next = fields(input.announcement);
          // A material change (words, scope, placement) shows again to customers who hid the previous revision.
          const material = ['title', 'summary', 'details', 'severity', 'scope', 'placement', 'expectedRestoration'].some((k) => JSON.stringify((before as any)[k]) !== JSON.stringify((next as any)[k]));
          target = { ...before, ...next, revision: material ? before.revision + 1 : before.revision, updatedAt: now, actorId: adminId };
        } else {
          if (before.status === 'archived' && action !== 'archive') throw new FinanceError('Archived announcements stay archived.');
          target = { ...before, status: action === 'publish' ? 'published' : action === 'unpublish' ? 'draft' : 'archived', updatedAt: now, actorId: adminId };
        }
        items[index] = target;
      }
      const doc = { version: randomUUID(), items, updatedAt: now, actorId: adminId };
      await tx.saveConfig(ANNOUNCEMENTS_KEY, doc);
      await tx.audit(adminId, `service_announcement_${action}`, target.id, { title: target.title, status: target.status, scope: target.scope, placement: target.placement, revision: target.revision });
      return { doc, id: target.id };
    });
    this.invalidate();
    return { saved: result.doc.version, id: result.id, view: await this.admin() };
  }
}
