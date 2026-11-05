import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { ShieldState, ShieldView } from '../../../shared/mysteryShield';
import { API_BASE_URL } from '../../services/apiClient';

const messages: Record<ShieldState, string> = {
  unavailable: 'Browsing support is currently unavailable for this order.',
  not_covered: 'This order falls outside the Mystery Shield programme.',
  waiting: 'Check back after nine complete hours from verified payment if delivery is still pending.',
  unverifiable: 'We can’t confirm whether this order qualifies right now. Check again later.',
  review: 'This order needs review before we can confirm browsing support.',
  completed: 'The original order has completed. Shield covers orders that are still delayed when you claim.',
  excluded: 'The current payment or order status is outside Shield coverage.',
  eligible: 'You can claim 400MB of browsing support for the original recipient.',
  budget_exhausted: 'Browsing support is unavailable because the current programme limit has been reached.',
  reserved: 'Your claim is being recorded. Check its status before trying again.',
  submitted: 'Your claim is recorded. Delivery is awaiting supplier confirmation.',
  uncertain: 'We’re checking your claim with the supplier. Please don’t submit it again.',
  delivered: 'Delivery of your 400MB browsing support is confirmed.',
  failed: 'Your browsing support claim could not be fulfilled. Contact support about the existing claim.',
};

export function ShieldStatusCard({ view, busy, onCheck, onClaim }: {
  view: ShieldView; busy: boolean; onCheck: () => void; onClaim: () => void;
}) {
  return (
    <section aria-label="Mystery Shield" className="min-w-0 rounded-2xl border border-emerald-900 bg-emerald-950/30 p-4">
      <h3 className="flex items-center gap-2 font-semibold text-emerald-200">
        <ShieldCheck aria-hidden="true" size={18} /> Mystery Shield
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-200" role="status">
        {busy ? 'Checking your Shield status…' : messages[view.state]}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-300">Your original order continues through its normal resolution.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {view.state === 'eligible' && <button className="mh-button" disabled={busy} onClick={onClaim}>Claim 400MB</button>}
        <button className="mh-button-secondary" disabled={busy} onClick={onCheck}>Check Shield status</button>
      </div>
    </section>
  );
}

export function OrderShield({ reference, token }: { reference: string; token: string }) {
  const [view, setView] = useState<ShieldView | null>(null);
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<{ id: number; claim: boolean }>({ id: 0, claim: false });

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    const endpoint = API_BASE_URL + '/api/shield/' + encodeURIComponent(reference) + (request.claim ? '/claim' : '');
    void (async () => {
      try {
        const response = await fetch(endpoint, {
          method: request.claim ? 'POST' : 'GET',
          headers: { Authorization: 'Bearer ' + token },
          cache: 'no-store',
          signal: controller.signal,
        });
        if ([401, 403, 404].includes(response.status)) {
          if (!controller.signal.aborted) setView(null);
          return;
        }
        if (!response.ok) throw new Error('Shield status unavailable');
        const result: ShieldView = await response.json();
        if (!Object.hasOwn(messages, result.state)) throw new Error('Shield status unavailable');
        if (!controller.signal.aborted) setView(result);
      } catch {
        if (!controller.signal.aborted) setView(previous => previous ? { state: 'unavailable' } : null);
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    })();
    return () => controller.abort();
  }, [reference, token, request]);

  const check = (claim: boolean) => setRequest(previous => ({ id: previous.id + 1, claim }));
  if (!view) return null;
  return <ShieldStatusCard view={view} busy={busy} onCheck={() => check(false)} onClaim={() => check(true)} />;
}
