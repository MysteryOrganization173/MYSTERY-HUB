/**
 * TEST AND QA FIXTURES ONLY. Never imported by application code (a regression test enforces this).
 *
 * An in-memory stand-in for Codex's future order record-keeping backend, used to exercise the Admin UI before the
 * real contract exists. Its rules are assumptions for UI testing, not the server's rules: every decision in
 * production comes from Codex's API.
 */
import type { ArchivedOrderSummary, OrderRecordAuditEntry, OrderRecordClient, OrderRecordState } from '../services/orderRecordKeeping';

export interface FixtureOrder { reference: string; product: string; amountMinor: number; customer: string; status: string; paid: boolean; test: boolean }

export function createFixtureOrderRecordClient(orders: FixtureOrder[], options: { delayMs?: number; failNext?: 'version_conflict' | 'error' } = {}) {
  const states = new Map<string, OrderRecordState>();
  const history = new Map<string, OrderRecordAuditEntry[]>();
  const meta = new Map(orders.map(o => [o.reference, o]));
  let failNext = options.failNext;
  const wait = () => new Promise(resolve => setTimeout(resolve, options.delayMs ?? 0));
  const state = (reference: string): OrderRecordState => {
    const known = states.get(reference);
    if (known) return known;
    const o = meta.get(reference);
    const fresh: OrderRecordState = {
      reference, version: 'v1', archived: false, archivedAt: null, archivedBy: null, archiveReason: null,
      canArchive: true, archiveBlockedReason: null, canRestore: false, restoreBlockedReason: null,
      canDeleteTest: Boolean(o?.test && !o.paid),
      deleteBlockedReason: o?.paid ? null : o?.test ? null : 'Not classified as a test order by the server.',
      paidCustomerPurchase: Boolean(o?.paid && !o.test),
    };
    states.set(reference, fresh);
    return fresh;
  };
  const bump = (s: OrderRecordState, patch: Partial<OrderRecordState>) => {
    const next = { ...s, ...patch, version: `v${Number(s.version.slice(1)) + 1}` };
    states.set(s.reference, next);
    return next;
  };
  const log = (reference: string, action: OrderRecordAuditEntry['action'], reason: string) => {
    history.set(reference, [{ id: `${reference}-${Date.now()}`, action, actor: 'founder@example.test', at: new Date().toISOString(), reason }, ...(history.get(reference) || [])]);
  };
  const calls: string[] = [];
  const client: OrderRecordClient & { calls: string[]; touch: (reference: string) => void } = {
    available: true,
    calls,
    /** Simulates another admin changing the record. */
    touch: reference => { bump(state(reference), {}); },
    async getState(_t, reference) { calls.push(`state ${reference}`); await wait(); return state(reference); },
    async history(_t, reference) { await wait(); return history.get(reference) || []; },
    async archive(_t, reference, input) {
      calls.push(`archive ${reference} ${input.expectedVersion}`); await wait();
      const s = state(reference);
      if (failNext) { const code = failNext; failNext = undefined; return { ok: false, code, message: code === 'error' ? 'The server could not archive this order.' : 'Version changed.' }; }
      if (s.version !== input.expectedVersion) return { ok: false, code: 'version_conflict', message: 'Version changed.' };
      log(reference, 'archived', input.reason);
      return { ok: true, state: bump(s, { archived: true, archivedAt: new Date().toISOString(), archivedBy: 'founder@example.test', archiveReason: input.reason, canArchive: false, canRestore: true }) };
    },
    async restore(_t, reference, input) {
      calls.push(`restore ${reference} ${input.expectedVersion}`); await wait();
      const s = state(reference);
      if (s.version !== input.expectedVersion) return { ok: false, code: 'version_conflict', message: 'Version changed.' };
      log(reference, 'restored', input.reason);
      return { ok: true, state: bump(s, { archived: false, archivedAt: null, archivedBy: null, archiveReason: null, canArchive: true, canRestore: false }) };
    },
    async deleteTest(_t, reference, input) {
      calls.push(`delete ${reference} ${input.expectedVersion}`); await wait();
      const s = state(reference);
      if (s.version !== input.expectedVersion) return { ok: false, code: 'version_conflict', message: 'Version changed.' };
      if (!s.canDeleteTest || input.confirmReference !== reference) return { ok: false, code: 'not_eligible', message: 'This order cannot be deleted.' };
      states.delete(reference); meta.delete(reference);
      return { ok: true };
    },
    async listArchived(_t, query) {
      await wait();
      const q = (query.q || '').toLowerCase();
      const items: ArchivedOrderSummary[] = [...states.values()].filter(s => s.archived && meta.has(s.reference))
        .map(s => { const o = meta.get(s.reference)!; return { reference: s.reference, product: o.product, amountMinor: o.amountMinor, customer: o.customer, status: o.status, archivedAt: s.archivedAt!, archivedBy: s.archivedBy, reason: s.archiveReason }; })
        .filter(i => !q || i.reference.toLowerCase().includes(q) || (i.customer || '').toLowerCase().includes(q));
      const totalPages = Math.max(1, Math.ceil(items.length / query.limit));
      return { items: items.slice((query.page - 1) * query.limit, query.page * query.limit), page: query.page, totalPages, total: items.length };
    },
  };
  return client;
}
