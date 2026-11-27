import './serviceUpdate.css';
import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Info, PackageSearch, Wrench, X, Zap } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NetworkBrandBadge } from '../common/NetworkBrandBadge';
import { useServiceStatus, serviceControl } from '../../hooks/useServiceStatus';
import { useOverlayLock } from '../../utils/overlayStack';
import { restorationLine, type PublicServiceControl } from '../../../shared/serviceControls';
import { ANNOUNCEMENT_CTAS, announcementsFor, type PublicAnnouncement } from '../../../shared/announcements';
import type { NetworkId } from '../../types';

/**
 * Mystery Hub 3.6.3 · how service updates reach customers. Everything comes from the shared service status (the
 * Service Control Center); the server enforces the same pauses whatever this page shows.
 * - AnnouncementBar: the most important live bar announcement for this page and visitor (one at a time, with the
 *   others one tap away). A dismissible one hides for its current revision only; a material edit shows it again.
 * - AnnouncementModal: an exceptional announcement, shown once per revision on this device.
 * - ServiceMaintenanceState: what a customer sees after choosing a paused network or service.
 * - ServiceInlineNotice: one line beside lists, in checkout and on receipts; never dismissible.
 * Dismissing anything never makes a paused service purchasable. No supplier is named and no refund is promised here.
 */

const DISMISS_KEY = 'mh_service_update_dismissed';
const MODAL_KEY = 'mh_service_modal_seen';
const keyOf = (a: { id: string; revision: number }) => `${a.id}:${a.revision}`;
function readKeys(storageKey: string): string[] {
  try { const v = JSON.parse(localStorage.getItem(storageKey) || '[]'); return Array.isArray(v) ? v.filter((k) => typeof k === 'string').slice(-40) : []; } catch { return []; }
}
function addKey(storageKey: string, key: string): string[] {
  const next = [...readKeys(storageKey).filter((k) => k !== key), key];
  try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* hides for this visit only */ }
  return next;
}

const NETWORK_NAME: Record<string, string> = { mtn: 'MTN', telecel: 'Telecel', airteltigo: 'AirtelTigo' };
const SERVICE_NAME: Record<string, string> = { data: 'Data', instant_bundle: 'Instant Bundles', airtime: 'Airtime' };
export const stateChip = (state: PublicServiceControl['state']) => state === 'delayed' ? 'Delays' : state === 'suspended' ? 'Paused' : 'Maintenance';

/**
 * The restoration line for an announcement: its own date, else its service's, against the server's date. It speaks of
 * purchases staying paused only while a pause is actually in force, never from an announcement alone.
 */
function restorationFor(a: Pick<PublicAnnouncement, 'expectedRestoration' | 'scope'>, controls: PublicServiceControl[], serverDate: string) {
  const control = a.scope === 'global' ? null : controls.find((c) => c.scope === a.scope) ?? null;
  return restorationLine(a.expectedRestoration ?? control?.expectedRestoration ?? null, serverDate, Boolean(control?.blocksPurchases));
}

/** The bar itself, also used by the Admin preview with a draft. */
export function AnnouncementBarView({ announcement, controls, serverDate, more = 0, onMore, onDismiss, onCta, preview = false }: {
  announcement: PublicAnnouncement; controls: PublicServiceControl[]; serverDate: string; more?: number; onMore?: () => void; onDismiss?: () => void; onCta?: () => void; preview?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const restoration = restorationFor(announcement, controls, serverDate);
  const control = announcement.scope === 'global' ? null : controls.find((c) => c.scope === announcement.scope) ?? null;
  const Icon = announcement.severity === 'info' ? Info : announcement.severity === 'critical' ? AlertTriangle : Wrench;
  const cta = announcement.cta ? ANNOUNCEMENT_CTAS[announcement.cta] : null;
  return (
    <section className="mh-svc-bar" aria-label={preview ? 'Announcement preview' : 'Service update'} data-svc-severity={announcement.severity}>
      <div className="mh-svc-bar-inner">
        <span className="mh-svc-bar-icon" aria-hidden="true"><Icon /></span>
        <div className="mh-svc-bar-copy">
          <p className="mh-svc-bar-title"><strong>{announcement.title}</strong>{control && <span className="mh-svc-chip">{stateChip(control.state)}</span>}</p>
          <p className="mh-svc-bar-line">{announcement.summary}{restoration ? ` ${restoration.label}` : ''}</p>
          {open && (
            <div id={detailsId} className="mh-svc-bar-details">
              {announcement.details && <p>{announcement.details}</p>}
              {cta && <button type="button" className="mh-svc-link" onClick={onCta}><PackageSearch aria-hidden="true" />{cta.label}</button>}
            </div>
          )}
          {more > 0 && <button type="button" className="mh-svc-more-updates" onClick={onMore}>{more === 1 ? '1 more update' : `${more} more updates`}</button>}
        </div>
        <div className="mh-svc-bar-actions">
          {(announcement.details || cta) && (
            <button type="button" className="mh-svc-more" aria-expanded={open} aria-controls={open ? detailsId : undefined} onClick={() => setOpen((v) => !v)}>
              <span>{open ? 'Less' : 'Details'}</span><ChevronDown aria-hidden="true" />
            </button>
          )}
          {announcement.dismissible && onDismiss && <button type="button" className="mh-svc-close" aria-label="Hide this service update" onClick={onDismiss}><X aria-hidden="true" /></button>}
        </div>
      </div>
    </section>
  );
}

function useCtaNavigation() {
  const { setActivePage, openDataPage } = useApp();
  return (a: PublicAnnouncement) => {
    const cta = a.cta ? ANNOUNCEMENT_CTAS[a.cta] : null;
    if (!cta) return;
    if ('mode' in cta) openDataPage(cta.mode); else setActivePage(cta.page as never);
  };
}

export function AnnouncementBar({ page }: { page: string }) {
  const { user } = useApp();
  const status = useServiceStatus();
  const [dismissed, setDismissed] = useState<string[]>(() => readKeys(DISMISS_KEY));
  const [index, setIndex] = useState(0);
  const go = useCtaNavigation();
  const list = announcementsFor(status.announcements, page, Boolean(user), 'bar').filter((a) => !(a.dismissible && dismissed.includes(keyOf(a))));
  if (!list.length) return null;
  const shown = list[index % list.length];
  return <AnnouncementBarView key={keyOf(shown)} announcement={shown} controls={status.controls} serverDate={status.serverDate}
    more={list.length - 1} onMore={() => setIndex((i) => i + 1)} onDismiss={() => { setDismissed(addKey(DISMISS_KEY, keyOf(shown))); setIndex(0); }} onCta={() => go(shown)} />;
}

/**
 * An exceptional announcement: once per revision on this device, never on top of checkout, a receipt or sign-in.
 * A native modal dialog, so focus stays inside, the page behind is inert, Escape closes it from anywhere and focus
 * returns to where it was.
 */
export function AnnouncementModal({ page, blocked }: { page: string; blocked: boolean }) {
  const { user } = useApp();
  const status = useServiceStatus();
  const [seen, setSeen] = useState<string[]>(() => readKeys(MODAL_KEY));
  const go = useCtaNavigation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const shown = blocked ? undefined : announcementsFor(status.announcements, page, Boolean(user), 'modal').find((a) => !seen.includes(keyOf(a)));
  const shownKey = shown ? keyOf(shown) : null;
  // 3.6.4: one shared overlay system: while the pop-up is open the page is held still and invitations (install,
  // notifications, channel) wait, exactly as for every other dialog.
  useOverlayLock(Boolean(shownKey), dialogRef);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !shownKey) return;
    if (!dialog.open) { try { dialog.showModal(); } catch { dialog.setAttribute('open', ''); } }
    closeRef.current?.focus();
    return () => { if (dialog.open) dialog.close(); };
  }, [shownKey]);
  if (!shown) return null;
  // Close the native dialog before it leaves the page, so focus returns to where the customer was (3.6.4).
  const close = () => { if (dialogRef.current?.open) dialogRef.current.close(); setSeen(addKey(MODAL_KEY, keyOf(shown))); };
  const restoration = restorationFor(shown, status.controls, status.serverDate);
  const cta = shown.cta ? ANNOUNCEMENT_CTAS[shown.cta] : null;
  return (
    <dialog ref={dialogRef} className="mh-svc-modal-dialog" aria-labelledby="mh-svc-modal-title" onCancel={(e) => { e.preventDefault(); close(); }}>
      <div className="mh-svc-modal" data-svc-severity={shown.severity}>
        <span className="mh-svc-bar-icon" aria-hidden="true">{shown.severity === 'info' ? <Info /> : <AlertTriangle />}</span>
        <h2 id="mh-svc-modal-title" className="mh-svc-state-title">{shown.title}</h2>
        <p className="mh-svc-state-text">{shown.summary}</p>
        {shown.details && <p className="mh-svc-state-text">{shown.details}</p>}
        {restoration && <p className="mh-svc-state-when">{restoration.label}</p>}
        <div className="mh-svc-state-actions">
          {cta && <button type="button" className="mh-svc-alt" onClick={() => { close(); go(shown); }}><PackageSearch aria-hidden="true" className="mh-svc-alt-icon" /><span>{cta.label}</span></button>}
          <button ref={closeRef} type="button" className="mh-button" onClick={close}>OK</button>
        </div>
      </div>
    </dialog>
  );
}

/** The state a customer sees after choosing a paused network: what, until when, and what they can do instead. */
export function ServiceMaintenanceState({ control, onNetwork, onInstant }: { control: PublicServiceControl; onNetwork: (network: NetworkId | 'all') => void; onInstant?: () => void }) {
  const { setActivePage } = useApp();
  const status = useServiceStatus();
  const restoration = restorationLine(control.expectedRestoration, status.serverDate, control.blocksPurchases);
  const others = (['airteltigo', 'telecel', 'mtn'] as NetworkId[]).filter((n) => n !== control.network && !serviceControl(control.service, n, status)?.blocksPurchases);
  return (
    <section className="mh-svc-state" aria-labelledby="mh-svc-state-title" data-svc-state={control.state}>
      <div className="mh-svc-state-art" aria-hidden="true">
        <NetworkBrandBadge network={control.network} size="lg" />
        <span className="mh-svc-state-badge"><Wrench /></span>
      </div>
      <p className="mh-svc-kicker"><span className="mh-svc-chip">{stateChip(control.state)}</span>{NETWORK_NAME[control.network]} {SERVICE_NAME[control.service]}</p>
      <h2 id="mh-svc-state-title" className="mh-svc-state-title">{control.title}</h2>
      {control.message && <p className="mh-svc-state-text">{control.message}</p>}
      {restoration && <p className={`mh-svc-state-when${restoration.overdue ? ' is-overdue' : ''}`}>{restoration.label}</p>}
      {control.existingOrders && <p className="mh-svc-state-text">{control.existingOrders}</p>}
      <div className="mh-svc-state-actions">
        {others.map((network) => (
          <button key={network} type="button" className="mh-svc-alt" onClick={() => onNetwork(network)}>
            <NetworkBrandBadge network={network} size="xs" /><span>{NETWORK_NAME[network]} {control.service === 'data' ? 'bundles' : SERVICE_NAME[control.service]}</span>
          </button>
        ))}
        {onInstant && <button type="button" className="mh-svc-alt" onClick={onInstant}><Zap aria-hidden="true" className="mh-svc-alt-icon" /><span>Instant Bundles</span></button>}
        <button type="button" className="mh-svc-alt" onClick={() => setActivePage('orders')}><PackageSearch aria-hidden="true" className="mh-svc-alt-icon" /><span>Track an order</span></button>
      </div>
    </section>
  );
}

/** One line for lists, checkout and receipts. Not dismissible: it stays wherever the state matters. */
export function ServiceInlineNotice({ control, children }: { control: PublicServiceControl; children?: React.ReactNode }) {
  const status = useServiceStatus();
  const restoration = restorationLine(control.expectedRestoration, status.serverDate, control.blocksPurchases);
  const short = control.blocksPurchases ? `${NETWORK_NAME[control.network]} ${SERVICE_NAME[control.service]} purchases are paused${control.state === 'maintenance' ? ' for maintenance' : ''}.` : `${NETWORK_NAME[control.network]} ${SERVICE_NAME[control.service]} may be slower than usual.`;
  return (
    <div className="mh-svc-inline" role="note" data-svc-state={control.state}>
      <span className="mh-svc-inline-icon" aria-hidden="true">{control.blocksPurchases ? <Wrench /> : <Info />}</span>
      <p><strong>{short}</strong> {control.blocksPurchases ? '' : `${control.message} `}{restoration ? restoration.label : ''}{children}</p>
    </div>
  );
}
