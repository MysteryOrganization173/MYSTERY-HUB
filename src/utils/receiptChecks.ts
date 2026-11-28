/**
 * 3.7.3 · When an open receipt asks the server about its order. Pure scheduling (the receipt supplies the request and
 * the page state), so it runs and is tested without a browser; timers are the global ones.
 *
 * - While the order can still move: a check every 3 s, as before (3.6.2), never two at once.
 * - A cancelled or expired payment: nothing is on its way, but a late Mobile Money approval can still turn it into a
 *   paid order, so it keeps being checked on a gentler schedule: 6, 12, 24, then every 30 s.
 * - In the background (another app, the screen off, a Mobile Money prompt): no checks. Coming back checks at once and
 *   starts the schedule again, so a payment approved elsewhere shows as soon as the customer returns.
 * Terminal orders (delivered, failed with nothing pending) are not checked at all; the receipt decides that.
 */
export interface ReceiptCheckDeps {
  /** One status request. The schedule waits for it, so checks never overlap. */
  check: () => Promise<void>;
  /** The order's latest server status, as the receipt currently knows it. */
  serverStatus: () => string | null | undefined;
  isHidden: () => boolean;
  /** Registers a listener for the page becoming visible or hidden; returns its removal. */
  onVisibility: (listener: () => void) => () => void;
}

export const OPEN_ORDER_CHECK_MS = 3000;
export const CLOSED_PAYMENT_MAX_MS = 30_000;
/** A payment the customer closed, or that timed out. */
export const isClosedPayment = (serverStatus: string | null | undefined) => serverStatus === 'cancelled' || serverStatus === 'expired';
/** The wait before the next check of a closed payment, after `checks` checks of it in a row (from 1). */
export const closedPaymentDelay = (checks: number) => Math.min(CLOSED_PAYMENT_MAX_MS, OPEN_ORDER_CHECK_MS * 2 ** Math.max(1, Math.min(checks, 4)));

export function startReceiptChecks(d: ReceiptCheckDeps): () => void {
  let alive = true, running = false, closedChecks = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const nextDelay = () => {
    if (!isClosedPayment(d.serverStatus())) { closedChecks = 0; return OPEN_ORDER_CHECK_MS; }
    closedChecks += 1;
    return closedPaymentDelay(closedChecks);
  };
  const tick = async () => {
    timer = undefined;
    if (!alive || d.isHidden()) return;
    running = true;
    try { await d.check(); } catch { /* the receipt shows its own "could not check" state */ }
    running = false;
    if (!alive || d.isHidden()) return;
    timer = setTimeout(tick, nextDelay());
  };
  const unlisten = d.onVisibility(() => {
    if (!alive) return;
    // Hidden: the armed check is dropped, so nothing is asked in the background (not even the one already waiting).
    if (d.isHidden()) { clearTimeout(timer); timer = undefined; return; }
    if (running) return;
    clearTimeout(timer); closedChecks = 0;
    void tick();
  });
  void tick();
  return () => { alive = false; clearTimeout(timer); unlisten(); };
}
