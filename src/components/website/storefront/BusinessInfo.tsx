import React, { useEffect, useState } from 'react';
import type { SiteContent } from '../../../types';
import { WEBSITE_POLICY_KEYS, WEBSITE_POLICY_LABELS, websiteDirectionsUrl, websiteHoursRows, websiteOpenState, type WebsiteHours } from '../../../config/websiteContentV5';

/** "Open now" from the owner's own hours, in Ghana time, refreshed every minute. Hidden without hours. */
export function useOpenState(hours?: WebsiteHours) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  return websiteOpenState(hours, now);
}

export function OpenBadge({ hours, className = '' }: { hours?: WebsiteHours; className?: string }) {
  const state = useOpenState(hours);
  if (!state) return null;
  return <p className={className} data-open={state.open}><span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99, background: state.open ? '#22c55e' : '#f59e0b', marginRight: 8 }} />{state.label}</p>;
}

export function HoursList({ hours, className = '' }: { hours?: WebsiteHours; className?: string }) {
  const rows = websiteHoursRows(hours);
  if (!rows.length) return null;
  return <dl className={className}>
    {rows.map(r => <div key={r.days} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '6px 0' }}><dt>{r.days}</dt><dd style={{ margin: 0, textAlign: 'right' }}>{r.time}</dd></div>)}
    {hours?.note && <p style={{ marginTop: 6, fontSize: 13, opacity: .75 }}>{hours.note}</p>}
  </dl>;
}

export const directionsHref = (content?: Partial<SiteContent>, location?: string) => websiteDirectionsUrl(content ? content.location : location);

/** Delivery, payment and returns, each shown only if the owner wrote it. */
export function PolicyList({ policies, itemClassName = '', headingClassName = '' }: { policies?: SiteContent['policies']; itemClassName?: string; headingClassName?: string }) {
  const filled = WEBSITE_POLICY_KEYS.filter(key => policies?.[key]?.trim());
  if (!filled.length) return null;
  return <>{filled.map(key => <div key={key} className={itemClassName}><h3 className={headingClassName}>{WEBSITE_POLICY_LABELS[key]}</h3><p style={{ whiteSpace: 'pre-line' }}>{policies![key]}</p></div>)}</>;
}
export const hasPolicies = (policies?: SiteContent['policies']) => WEBSITE_POLICY_KEYS.some(key => policies?.[key]?.trim());
