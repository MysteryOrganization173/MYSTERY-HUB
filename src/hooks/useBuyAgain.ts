import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getReorderOnServer } from '../services/apiClient';
import { refreshDirectCatalog } from './useDirectCatalog';
import { DATA_BUNDLES } from '../data/bundles';
import { reorderAction } from '../utils/reorderPresentation';
import type { NetworkId } from '../types';

export interface BuyAgainOptions {
  /** Runs just before the checkout or catalogue opens (for example, to close the sheet the button is in). */
  beforeOpen?: () => void;
  /** Checked again when the answer arrives: if it returns false (the sheet closed, or shows another order), nothing opens. */
  stillWanted?: () => boolean;
  /**
   * Where to go, quietly, when the server does not know the order as this account's (a purchase made before signing
   * in, or one tracked by reference): the catalogue for that service and network, as Buy again always did.
   */
  notMine?: { mode: 'data' | 'instant' | 'airtime'; network?: NetworkId | 'all' };
}

/**
 * 3.4.1 Smart Buy Again. Asks the server what the customer's own order can be bought as today, then opens the checkout
 * review with it (never a payment), or explains briefly and opens the right catalogue. One request at a time; it can
 * be cancelled, and an answer that arrives after a sign-out, account switch or cancel opens nothing.
 */
export function useBuyAgain() {
  const { sessionToken, openCheckout, openDataPage, showToast } = useApp();
  const [pending, setPending] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const token = useRef(sessionToken);
  token.current = sessionToken;
  const cancel = useCallback(() => { active.current?.abort(); }, []);
  // A sign-out or account switch abandons the lookup: its answer belongs to the previous account.
  useEffect(() => () => active.current?.abort(), [sessionToken]);

  const buyAgain = useCallback(async (reference: string, options: BuyAgainOptions = {}) => {
    if (active.current || !sessionToken) return;
    const asked = sessionToken, controller = new AbortController();
    active.current = controller; setPending(reference);
    const current = () => !controller.signal.aborted && token.current === asked && (options.stillWanted?.() ?? true);
    try {
      const answer = await getReorderOnServer(asked, reference, controller.signal);
      // Today's Data presentation; the checkout still fetches its own quote before Pay is offered.
      if (answer.available && answer.kind === 'data') await refreshDirectCatalog().catch(() => {});
      if (!current()) return;
      const action = reorderAction(answer, DATA_BUNDLES);
      options.beforeOpen?.();
      if (action.type === 'checkout') openCheckout(action.bundle, { recipientPhone: action.recipientPhone });
      else { showToast(action.message, 'info'); openDataPage(action.mode, action.network); }
    } catch (error) {
      if (!current()) return;
      const status = (error as { status?: number }).status;
      if (status === 404) {
        options.beforeOpen?.();
        if (options.notMine) openDataPage(options.notMine.mode, options.notMine.network ?? 'all');
        else { showToast('We couldn’t find that order in your account. Choose what you need here.', 'info'); openDataPage('data'); }
      } else if (status !== 401) showToast('We couldn’t check this order right now. Please try again.', 'warning');
    } finally {
      if (active.current === controller) { active.current = null; setPending(null); }
    }
  }, [sessionToken, openCheckout, openDataPage, showToast]);

  return { buyAgain, pending, cancel };
}
