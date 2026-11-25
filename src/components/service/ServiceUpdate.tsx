import './serviceUpdate.css';
import React, { useId, useState } from 'react';
import { ChevronDown, PackageSearch, Wrench, X, Zap } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NetworkBrandBadge } from '../common/NetworkBrandBadge';
import { activeServiceIncidents, purchaseIncident, restorationLine, type ServiceIncident } from '../../../shared/serviceIncidents';
import type { NetworkId } from '../../types';

/**
 * Mystery Hub 3.6.3 · service updates for customers, from shared/serviceIncidents (the same record the server uses to
 * refuse paused purchases). Three forms:
 * - ServiceUpdateBar: a compact, dismissible bar under the header on the homepage, Orders and Help. Dismissing it
 *   hides the bar only (for that announcement's revision); the pause and every contextual notice stay.
 * - ServiceMaintenanceState: the full state when a customer picks a paused network on the Data page.
 * - ServiceInlineNotice: one line beside lists and in checkout, never dismissible.
 * No supplier is named, no refund is promised, and the restoration date is an expectation, never a countdown.
 */

const DISMISS_KEY = 'mh_service_update_dismissed';
const dismissKey = (incident: ServiceIncident) => `${incident.id}:${incident.revision}`;
function readDismissed(): string[] {
  try { const value = JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]'); return Array.isArray(value) ? value.filter((v) => typeof v === 'string').slice(-20) : []; } catch { return []; }
}

const NETWORK_NAME: Record<string, string> = { mtn: 'MTN', telecel: 'Telecel', airteltigo: 'AirtelTigo' };

export function ServiceUpdateBar({ page }: { page: string }) {
  const { setActivePage } = useApp();
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  if (!['home', 'orders', 'help'].includes(page)) return null;
  const incident = activeServiceIncidents().find((item) => !dismissed.includes(dismissKey(item)));
  if (!incident) return null;
  const restoration = restorationLine(incident);
  const dismiss = () => {
    const next = [...readDismissed().filter((k) => k !== dismissKey(incident)), dismissKey(incident)];
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch { /* the bar hides for this visit only */ }
    setDismissed(next);
  };
  return (
    <section className="mh-svc-bar" aria-label="Service update" data-svc-state={incident.state}>
      <div className="mh-svc-bar-inner">
        <span className="mh-svc-bar-icon" aria-hidden="true"><Wrench /></span>
        <div className="mh-svc-bar-copy">
          <p className="mh-svc-bar-title"><strong>{incident.title}</strong><span className="mh-svc-chip">Maintenance</span></p>
          <p className="mh-svc-bar-line">{incident.short} {restoration.label}</p>
          {open && (
            <div id={detailsId} className="mh-svc-bar-details">
              <p>{incident.message}</p>
              <p>{incident.existingOrders}</p>
              <p>{incident.apology} {incident.followUp}</p>
              {page !== 'orders' && <button type="button" className="mh-svc-link" onClick={() => setActivePage('orders')}><PackageSearch aria-hidden="true" />Track an order</button>}
            </div>
          )}
        </div>
        <div className="mh-svc-bar-actions">
          <button type="button" className="mh-svc-more" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((v) => !v)}>
            <span>{open ? 'Less' : 'Details'}</span><ChevronDown aria-hidden="true" />
          </button>
          <button type="button" className="mh-svc-close" aria-label="Hide this service update" onClick={dismiss}><X aria-hidden="true" /></button>
        </div>
      </div>
    </section>
  );
}

/** The state a customer sees after choosing a paused network: what, until when, and what they can do instead. */
export function ServiceMaintenanceState({ incident, onNetwork, onInstant }: { incident: ServiceIncident; onNetwork: (network: NetworkId | 'all') => void; onInstant?: () => void }) {
  const { setActivePage } = useApp();
  const restoration = restorationLine(incident);
  const others = (['airteltigo', 'telecel', 'mtn'] as NetworkId[]).filter((n) => n !== incident.network && !purchaseIncident(incident.service, n));
  return (
    <section className="mh-svc-state" aria-labelledby="mh-svc-state-title" data-svc-state={incident.state}>
      <div className="mh-svc-state-art" aria-hidden="true">
        <NetworkBrandBadge network={incident.network} size="lg" />
        <span className="mh-svc-state-badge"><Wrench /></span>
      </div>
      <p className="mh-svc-kicker"><span className="mh-svc-chip">Maintenance</span>{NETWORK_NAME[incident.network]} Data</p>
      <h2 id="mh-svc-state-title" className="mh-svc-state-title">{incident.title}</h2>
      <p className="mh-svc-state-text">{incident.message}</p>
      <p className={`mh-svc-state-when${restoration.overdue ? ' is-overdue' : ''}`}>{restoration.label}</p>
      <p className="mh-svc-state-text">{incident.existingOrders} {incident.apology}</p>
      <p className="mh-svc-state-muted">{incident.followUp}</p>
      <div className="mh-svc-state-actions">
        {others.map((network) => (
          <button key={network} type="button" className="mh-svc-alt" onClick={() => onNetwork(network)}>
            <NetworkBrandBadge network={network} size="xs" /><span>{NETWORK_NAME[network]} bundles</span>
          </button>
        ))}
        {onInstant && <button type="button" className="mh-svc-alt" onClick={onInstant}><Zap aria-hidden="true" className="mh-svc-alt-icon" /><span>Instant Bundles</span></button>}
        <button type="button" className="mh-svc-alt" onClick={() => setActivePage('orders')}><PackageSearch aria-hidden="true" className="mh-svc-alt-icon" /><span>Track an order</span></button>
      </div>
    </section>
  );
}

/** One line for lists and checkout. Not dismissible: it stays wherever the pause matters. */
export function ServiceInlineNotice({ incident, children }: { incident: ServiceIncident; children?: React.ReactNode }) {
  const restoration = restorationLine(incident);
  return (
    <div className="mh-svc-inline" role="note" data-svc-state={incident.state}>
      <span className="mh-svc-inline-icon" aria-hidden="true"><Wrench /></span>
      <p><strong>{incident.short}</strong> {restoration.label}{children}</p>
    </div>
  );
}
