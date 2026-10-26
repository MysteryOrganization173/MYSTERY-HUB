/**
 * Admin order record keeping: archive, restore, permanent deletion of server-authorised test records, and the
 * action history behind them. Frontend side only. Codex owns every rule and route.
 *
 * Contract status (checked 2026-10-25 on main and every remote branch): Codex has not published these routes.
 * `pendingOrderRecordClient` therefore reports `available: false`, calls nothing, and the Admin shows that the
 * controls are waiting for the server. When Codex's contract lands, add an HTTP client that maps its real
 * responses onto these types and pass it to the Orders section; the UI does not need to change. Nothing here
 * names an endpoint, because none has been agreed.
 *
 * Everything the UI decides comes from the server's answer: eligibility, the reason an action is blocked, the
 * record version used for concurrency checks, and the result of each action. The frontend never marks an order
 * archived or deleted on its own.
 */

/** The server's current view of one order's record-keeping state. */
export interface OrderRecordState {
  reference: string;
  /** Opaque concurrency token. Every action sends back the version the operator reviewed. */
  version: string;
  archived: boolean;
  archivedAt: string | null;
  archivedBy: string | null;
  archiveReason: string | null;
  canArchive: boolean;
  archiveBlockedReason: string | null;
  canRestore: boolean;
  restoreBlockedReason: string | null;
  /** True only when the server has classified the order as a deletable test record. */
  canDeleteTest: boolean;
  deleteBlockedReason: string | null;
  /** Server classification: a real paid customer purchase is never deletable and stays easy to find. */
  paidCustomerPurchase: boolean;
}

export interface OrderRecordAuditEntry {
  id: string;
  action: 'archived' | 'restored' | 'test_deleted' | (string & {});
  actor: string | null;
  at: string;
  reason: string | null;
}

export interface ArchivedOrderSummary {
  reference: string;
  product: string;
  amountMinor: number | null;
  customer: string | null;
  status: string;
  archivedAt: string;
  archivedBy: string | null;
  reason: string | null;
}

export interface ArchivedOrderPage { items: ArchivedOrderSummary[]; page: number; totalPages: number; total: number }

export type RecordActionFailure = { ok: false; code: 'version_conflict' | 'not_eligible' | 'forbidden' | 'unavailable' | 'error'; message: string };
export type RecordActionResult = { ok: true; state: OrderRecordState } | RecordActionFailure;
export type RecordDeleteResult = { ok: true } | RecordActionFailure;

export interface OrderRecordClient {
  /** False until a verified backend contract is wired. The UI then shows a waiting state and calls nothing. */
  readonly available: boolean;
  getState(token: string, reference: string): Promise<OrderRecordState>;
  /** null when the server does not provide history for this order. */
  history(token: string, reference: string): Promise<OrderRecordAuditEntry[] | null>;
  archive(token: string, reference: string, input: { expectedVersion: string; reason: string }): Promise<RecordActionResult>;
  restore(token: string, reference: string, input: { expectedVersion: string; reason: string }): Promise<RecordActionResult>;
  deleteTest(token: string, reference: string, input: { expectedVersion: string; confirmReference: string; reason: string }): Promise<RecordDeleteResult>;
  listArchived(token: string, query: { q?: string; page: number; limit: number }): Promise<ArchivedOrderPage>;
}

export const RECORD_KEEPING_UNAVAILABLE = 'Archive and test deletion are waiting for the server. No order can be archived or deleted here yet.';

const unavailable = (): Promise<never> => Promise.reject(new Error(RECORD_KEEPING_UNAVAILABLE));
export const pendingOrderRecordClient: OrderRecordClient = {
  available: false,
  getState: unavailable,
  history: unavailable,
  archive: unavailable,
  restore: unavailable,
  deleteTest: unavailable,
  listArchived: unavailable,
};
