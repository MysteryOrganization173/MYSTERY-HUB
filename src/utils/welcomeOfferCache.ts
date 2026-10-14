import { welcomeOfferFromQuote, type WelcomeOffer } from './welcomeOfferPresentation';

export interface WelcomeRead { key: string; token: string | null; productIds: string[] }
type Load = (productId: string, token: string | null, signal: AbortSignal) => Promise<unknown>;

/** One account-scoped read shared across direct-storefront mounts, never across identities. */
export function createWelcomeOfferCache(load: Load, now = Date.now) {
  let key = '', value: WelcomeOffer | null = null, checkedAt = 0, generation = 0;
  let controller: AbortController | null = null, pending: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of listeners) listener(); };
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    read(owner: string) { return owner === key ? value : null; },
    refresh(context: WelcomeRead, force = false): Promise<void> {
      if (key !== context.key || force) {
        key = context.key; generation++; controller?.abort(); pending = null; value = null; checkedAt = 0; notify();
      }
      if (pending) return pending;
      if (checkedAt && now() - checkedAt < 30_000) return Promise.resolve();
      if (!context.productIds.length) return Promise.resolve();
      const revision = ++generation;
      controller = new AbortController(); const signal = controller.signal;
      pending = (async () => {
        let result: WelcomeOffer | null = null;
        try {
          for (const [index, productId] of context.productIds.slice(0, 2).entries()) {
            try { result = welcomeOfferFromQuote(await load(productId, context.token, signal)); break; }
            catch (error) {
              // A disabled/missing anchor or invalid anchor total can use one other catalog product.
              // Network/auth/service failures fail closed instead of querying every bundle.
              if (signal.aborted || index === 1 || ![404, 409].includes((error as { status?: number }).status || 0)) throw error;
            }
          }
        } catch { result = null; }
        if (generation === revision && key === context.key) { value = result; checkedAt = now(); pending = null; notify(); }
      })();
      return pending;
    },
  };
}
