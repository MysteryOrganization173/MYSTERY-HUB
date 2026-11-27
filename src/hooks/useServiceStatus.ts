import { useEffect, useState, useSyncExternalStore } from 'react';
import { API_BASE_URL } from '../services/apiClient';
import { CONTROL_SERVICES, OPERATING_STATES, SERVICE_SCOPES, accraDate, normalizeControls, publicControls, type PublicServiceControl } from '../../shared/serviceControls';
import { ANNOUNCEMENT_PAGES, ANNOUNCEMENT_PLACEMENTS, isAnnouncementCta, normalizeAnnouncements, publicAnnouncements, type PublicAnnouncement } from '../../shared/announcements';
import { underNodeTest } from '../../shared/testRuntime';

/**
 * Mystery Hub 3.6.3 Release B · one shared service-status snapshot for every customer page.
 *
 * One request (`/api/service-status`), shared by every component, refreshed when the tab returns to the foreground
 * (at most every 30 s) and every 5 minutes while a page that uses it is open; never per card or per product. Until the
 * first answer it uses the last answer this tab saw, else the shipped default (the Release A record), so a slow or
 * failed request never reopens a paused service on screen. The server remains the authority: it refuses paused
 * purchases however stale this page is.
 */
export interface ServiceStatus { version: string; serverDate: string; controls: PublicServiceControl[]; announcements: PublicAnnouncement[]; confirmed: boolean }

const STORAGE_KEY = 'mh_service_status_v1';
const shipped = (): ServiceStatus => underNodeTest
  ? { version: 'test-empty', serverDate: accraDate(), controls: [], announcements: [], confirmed: false }
  : { version: 'shipped', serverDate: accraDate(), controls: publicControls(normalizeControls(undefined)), announcements: publicAnnouncements(normalizeAnnouncements(undefined)), confirmed: false };

/** Accepts only well-formed answers; anything else keeps the current snapshot. */
export function parseServiceStatus(raw: any): ServiceStatus | null {
  if (!raw || typeof raw.version !== 'string' || !Array.isArray(raw.controls) || !Array.isArray(raw.announcements)) return null;
  const controls = raw.controls.filter((c: any) => c && SERVICE_SCOPES.some((s) => s.id === c.scope) && CONTROL_SERVICES.includes(c.service) && OPERATING_STATES.includes(c.state) && c.state !== 'operational' && typeof c.blocksPurchases === 'boolean' && typeof c.title === 'string' && typeof c.message === 'string');
  const announcements = raw.announcements.filter((a: any) => a && typeof a.id === 'string' && Number.isSafeInteger(a.revision) && typeof a.title === 'string' && typeof a.summary === 'string' && ANNOUNCEMENT_PLACEMENTS.includes(a.placement) && Array.isArray(a.pages) && a.pages.every((p: any) => ANNOUNCEMENT_PAGES.includes(p)))
    .map((a: any) => ({ ...a, cta: isAnnouncementCta(a.cta) ? a.cta : null }));
  return { version: raw.version, serverDate: /^\d{4}-\d{2}-\d{2}$/.test(raw.serverDate) ? raw.serverDate : accraDate(), controls, announcements, confirmed: true };
}
function readStored(): ServiceStatus | null {
  if (underNodeTest) return null;
  try { const parsed = parseServiceStatus(JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')); return parsed ? { ...parsed, confirmed: false } : null; } catch { return null; }
}

let current: ServiceStatus = readStored() ?? shipped();
const listeners = new Set<() => void>(), watchers = new Set<() => void>();
let request: Promise<void> | null = null, lastAttempt = 0, timer: ReturnType<typeof setInterval> | null = null;
const notify = () => { for (const fn of [...listeners, ...watchers]) fn(); };
/** For other stores (the Data catalogue) to re-derive when the status changes, without starting any refresh. */
export function onServiceStatusChange(fn: () => void): () => void { watchers.add(fn); return () => { watchers.delete(fn); }; }

export function getServiceStatus(): ServiceStatus { return current; }
/** Tests only. */
export function setServiceStatusForTests(next: ServiceStatus) { if (!underNodeTest) throw new Error('Only tests can replace the service status.'); current = next; notify(); }

export function refreshServiceStatus(force = false): Promise<void> {
  if (request) return request;
  if (!force && Date.now() - lastAttempt < 30_000) return Promise.resolve();
  lastAttempt = Date.now();
  request = fetch(`${API_BASE_URL}/api/service-status`, { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      const next = parseServiceStatus(json);
      if (!next) return;
      const changed = next.version !== current.version || !current.confirmed;
      current = next;
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage is optional */ }
      if (changed) notify();
    })
    .catch(() => { /* keep the snapshot we have */ })
    .finally(() => { request = null; });
  return request;
}

const onFocus = () => { if (document.visibilityState !== 'hidden') void refreshServiceStatus(); };
export function subscribeServiceStatus(fn: () => void): () => void {
  listeners.add(fn);
  if (listeners.size === 1 && typeof window !== 'undefined' && !timer) {
    timer = setInterval(() => void refreshServiceStatus(), 5 * 60_000);
    window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onFocus);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && timer) { clearInterval(timer); timer = null; window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); }
  };
}

export function useServiceStatus(): ServiceStatus {
  const status = useSyncExternalStore(subscribeServiceStatus, getServiceStatus, getServiceStatus);
  useEffect(() => { void refreshServiceStatus(!current.confirmed); }, []);
  return status;
}

/** The customer-facing control for this service on this network, or null when it is operational. */
export function serviceControl(service: string | undefined, network: string | undefined, status: ServiceStatus = current): PublicServiceControl | null {
  if (!service || !network) return null;
  return status.controls.find((c) => c.service === service && c.network === String(network).toLowerCase()) ?? null;
}
/** Whether new purchases of this service on this network are paused (maintenance or suspended). */
export const purchasePaused = (service: string | undefined, network: string | undefined, status: ServiceStatus = current) => Boolean(serviceControl(service, network, status)?.blocksPurchases);

/**
 * A network picker for one service: it starts on the first network open for purchases and, until the customer picks
 * one, moves off a network that becomes paused when a newer status arrives. A network the customer picked stays picked
 * and explains itself. Derived on render, so it never shows a paused network as the default for a moment.
 */
export function useOpenNetworkChoice<N extends string>(service: string, networks: readonly N[], status: ServiceStatus): [N, (network: N) => void] {
  const firstOpen = () => networks.find((n) => !purchasePaused(service, n, status)) ?? networks[0];
  const [chosen, setChosen] = useState<{ network: N; byCustomer: boolean }>(() => ({ network: firstOpen(), byCustomer: false }));
  const network = !chosen.byCustomer && purchasePaused(service, chosen.network, status) ? firstOpen() : chosen.network;
  return [network, (next: N) => setChosen({ network: next, byCustomer: true })];
}

const NETWORK_LABELS: [string, string][] = [['mtn', 'MTN'], ['telecel', 'Telecel'], ['airteltigo', 'AirtelTigo']];
/**
 * 3.6.4: the networks currently open for new purchases of a service, for short copy such as "MTN, Telecel & AirtelTigo"
 * on service cards. A paused network is left out, so no card advertises it; null when every network is paused.
 */
export function openNetworksLabel(service: string, status: ServiceStatus = current): string | null {
  const open = NETWORK_LABELS.filter(([id]) => !purchasePaused(service, id, status)).map(([, name]) => name);
  if (!open.length) return null;
  return open.length === 1 ? open[0] : `${open.slice(0, -1).join(', ')} & ${open[open.length - 1]}`;
}
