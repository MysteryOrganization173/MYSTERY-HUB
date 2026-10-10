import { formatGhs } from '../../shared/money';
export function commercialCash(value: unknown) {
  return Number.isSafeInteger(value) ? formatGhs(value as number) : 'Unknown / not configured';
}
// Each session owns its requests. Invalidation also makes pending work stale.
export function createAdminReadGate() {
  let generation = 0, pending = false;
  return {
    start() { if (pending) return null; pending = true; const id = ++generation; return id; },
    current(id: number) { return id === generation; },
    finish(id: number) { if (id === generation) pending = false; },
    invalidate() { generation++; pending = false; },
  };
}
export function adminReadMessage(error: unknown) {
  const status = (error as { status?: number })?.status;
  return status === 401 || status === 403 ? 'Your administrator session is unavailable. Sign in again to continue.'
    : 'Commercial settings could not load. This does not confirm that customer purchases are unavailable. Try again shortly.';
}
