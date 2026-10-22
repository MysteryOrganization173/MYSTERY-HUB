import { ORDER_LENSES, type OrderLensId } from './adminOrderCase';

export interface AdminOrderView {
  search: string;
  lens: OrderLensId;
  service: string;
  network: string;
  review: string;
  from: string;
  to: string;
  page: number;
  filtersOpen: boolean;
}

/** Searching the default lens includes cancelled/expired attempts; explicit filters still apply. */
export function adminOrderSearchParams(lens: OrderLensId, query: string): Record<string, string> {
  const params = ORDER_LENSES.find(item => item.id === lens)?.params || {};
  return lens === 'active' && query.trim() ? { status: 'all' } : params;
}

export function orderEventAge(iso: string | null | undefined, now = Date.now()) {
  const elapsed = now - Date.parse(iso || '');
  if (!Number.isFinite(elapsed)) return 'Time not recorded';
  const minutes = Math.max(0, Math.floor(elapsed / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr ago`;
  return `${Math.floor(minutes / 1440)} days ago`;
}
