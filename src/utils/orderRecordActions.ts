import type { OrderRecordAuditEntry, OrderRecordState } from '../services/orderRecordKeeping';

export type RecordAction = 'archive' | 'restore' | 'delete';

/** What the drawer offers, straight from the server's eligibility answer. Hidden buttons are not a permission boundary. */
export function recordActionsFor(state: OrderRecordState) {
  return {
    archive: !state.archived && state.canArchive,
    restore: state.archived && state.canRestore,
    // A real paid purchase is never deletable here, whatever else the response says.
    delete: state.canDeleteTest && !state.paidCustomerPurchase,
    archiveNote: !state.archived && !state.canArchive ? state.archiveBlockedReason || 'The server does not allow archiving this order.' : null,
    restoreNote: state.archived && !state.canRestore ? state.restoreBlockedReason || 'The server does not allow restoring this order.' : null,
    deleteNote: state.paidCustomerPurchase
      ? 'This is a paid customer purchase. Paid purchases are kept permanently and can only be archived.'
      : !state.canDeleteTest ? state.deleteBlockedReason || 'Only records the server has confirmed as test orders can be deleted.' : null,
  };
}

/**
 * Before any action, the drawer reloads the server state and compares it with what the operator reviewed.
 * Anything that moved (another admin acted, a payment arrived, eligibility changed) stops the action.
 */
export function freshnessCheck(action: RecordAction, reviewed: OrderRecordState, fresh: OrderRecordState): { proceed: true } | { proceed: false; message: string } {
  if (fresh.version !== reviewed.version) return { proceed: false, message: 'This order changed since you opened it. Review the latest details, then try again.' };
  const allowed = recordActionsFor(fresh)[action];
  if (!allowed) return { proceed: false, message: 'The server no longer allows this action for this order. Review the latest details.' };
  return { proceed: true };
}

export function auditActionLabel(action: OrderRecordAuditEntry['action']) {
  switch (action) {
    case 'archived': return 'Archived';
    case 'restored': return 'Restored';
    case 'test_deleted': return 'Test record deleted';
    default: return String(action).replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
  }
}
