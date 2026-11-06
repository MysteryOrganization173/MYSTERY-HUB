import { useCallback, useEffect, useRef, useState } from 'react';
import { freshLeadLinks, type LeadSummary } from '../../../shared/leadOperations';
import type { PaidOrderAlerts } from '../../../shared/adminAlerts';
import { AdminReadError, getLeadSummary, getPaidOrderAlerts } from '../../services/leadOperations';

const POLL_MS = 60000;
type FreshLeads = ReturnType<typeof freshLeadLinks>;

export function updateFreshLeads(previous: LeadSummary | null, current: LeadSummary, pending: FreshLeads): FreshLeads {
  return [...pending, ...freshLeadLinks(previous, current)].filter((row, index, list) =>
    list.findIndex(item => item.source === row.source && item.id === row.id) === index &&
    current[row.source].latestNew.some(item => item.id === row.id),
  );
}

function initialState(token: string) {
  return {
    token, data: null as LeadSummary | null, orders: null as PaidOrderAlerts | null,
    error: '', orderError: '', loading: true, refreshing: false, denied: false, fresh: [] as FreshLeads,
  };
}

export function useLeadAlerts(token: string) {
  const [state, setState] = useState(() => initialState(token));
  const refresh = useRef(() => {});
  const refreshAlerts = useCallback(() => refresh.current(), []);
  useEffect(() => {
    let active = true;
    let busy = false;
    let again = false;
    let denied = false;
    let lastStarted = -Infinity;
    let previous: LeadSummary | null = null;
    const c = new AbortController();
    setState(initialState(token));

    const load = async (manual = false) => {
      if (!active || denied || document.visibilityState === 'hidden') return;
      if (busy) {
        again ||= manual;
        return;
      }
      if (!manual && Date.now() - lastStarted < POLL_MS) return;
      busy = true;
      lastStarted = Date.now();
      setState(s => ({ ...s, refreshing: true }));
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);
      const [leads, paid] = await Promise.allSettled([
        getLeadSummary(token, signal),
        getPaidOrderAlerts(token, signal),
      ]);
      if (!active) return;
      denied = [leads, paid].some(result => result.status === 'rejected' &&
        result.reason instanceof AdminReadError && [401, 403].includes(result.reason.status));
      if (denied) {
        setState({ ...initialState(token), loading: false, denied: true });
        return;
      }
      const data = leads.status === 'fulfilled' && leads.value?.ultra && leads.value.marketplace ? leads.value : null;
      const orders = paid.status === 'fulfilled' && Array.isArray(paid.value?.orders) ? paid.value : null;
      const last = previous;
      if (data) previous = data;
      setState(s => ({
        token, data: data ?? s.data, orders: orders ?? s.orders,
        loading: false, refreshing: false, denied: false,
        error: data ? '' : 'Enquiry check failed.',
        orderError: orders ? '' : 'Paid-order check failed.',
        fresh: data ? updateFreshLeads(last, data, s.fresh) : [],
      }));
      busy = false;
      if (again) {
        again = false;
        void load(true);
      }
    };
    const manual = () => { void load(true); };
    const passive = () => { void load(); };
    refresh.current = manual;
    passive();
    const interval = setInterval(passive, POLL_MS);
    document.addEventListener('visibilitychange', passive);
    window.addEventListener('mh-leads-changed', manual);
    return () => {
      active = false;
      c.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', passive);
      window.removeEventListener('mh-leads-changed', manual);
      refresh.current = () => {};
    };
  }, [token]);

  const safe = state.token === token ? state : initialState(token);
  return { ...safe, refresh: refreshAlerts, dismiss: () => setState(s => ({ ...s, fresh: [] })) };
}
