import type { EarnPeriod } from '../types/adminEarn.js';
export class EarnInputError extends Error {}
export function parseEarnQuery(query: Record<string, unknown>, now = new Date()) {
  const text = (key: string, fallback = '') => { const value = query[key] ?? fallback; if (typeof value !== 'string') throw new EarnInputError(`Invalid ${key}.`); return value; };
  const period = text('period', '30d') as EarnPeriod['period'];
  if (!['today', '7d', '30d', 'all', 'custom'].includes(period)) throw new EarnInputError('Invalid period.');
  let start: string | null = null; let end: string | null = null;
  const date = (key: string) => { const value = text(key); if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString().slice(0, 10) !== value) throw new EarnInputError(`Invalid ${key} date.`); return new Date(`${value}T00:00:00Z`); };
  if (period === 'custom') { const from = date('start'); const to = date('end'); to.setUTCDate(to.getUTCDate() + 1); start = from.toISOString(); end = to.toISOString(); if (start >= end) throw new EarnInputError('End date must not precede start date.'); }
  else if (period !== 'all') { const from = new Date(now); from.setUTCHours(0, 0, 0, 0); from.setUTCDate(from.getUTCDate() - (period === '7d' ? 6 : period === '30d' ? 29 : 0)); start = from.toISOString(); end = now.toISOString(); }
  const integer = (key: string, fallback: number, max: number) => { const value = text(key, String(fallback)); if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) throw new EarnInputError(`Invalid ${key}.`); return Number(value); };
  const flag = (key: string) => { const value = text(key, 'false'); if (!['true', 'false'].includes(value)) throw new EarnInputError(`Invalid ${key}.`); return value === 'true'; };
  const sort = text('sort', 'conversions');
  if (!['conversions', 'firstConversions', 'convertedCustomers', 'deliveredRevenueMinor', 'approvedRewardsMinor', 'referredCustomers', 'uniqueVisitors'].includes(sort)) throw new EarnInputError('Invalid sort.');
  const status = text('status'); const service = text('service'); const stage = text('stage');
  if (status && !['pending', 'approved', 'rejected', 'reversed'].includes(status)) throw new EarnInputError('Invalid status.');
  if (service && !['data','airtime','instant_bundle','marketplace','website_builder','manual_adjustment'].includes(service)) throw new EarnInputError('Invalid service.');
  if (stage && !['standard','acquisition','recurring'].includes(stage)) throw new EarnInputError('Invalid stage.');
  const q = text('q').trim(); const referrer = text('referrer'); const order = text('order').trim();
  if (q.length > 200 || referrer.length > 64 || order.length > 128) throw new EarnInputError('Filter is too long.');
  return { range: { period, start, end, timezone: 'UTC' } as EarnPeriod, page: integer('page', 1, 100000), limit: integer('limit', 20, 100),
    q, sort, excludeDisabled: flag('excludeDisabled'), excludeSuspended: flag('excludeSuspended'), excludeZero: flag('excludeZero'), status, service, stage, referrer, order };
}
export type EarnQuery = ReturnType<typeof parseEarnQuery>;
export const inEarnPeriod = (at: string | Date | null | undefined, range: EarnPeriod) => !!at && (!range.start || new Date(at).getTime() >= Date.parse(range.start)) && (!range.end || new Date(at).getTime() < Date.parse(range.end));
export function earnSignals(raw: number, unique: number, conversions: number, enabled: boolean) {
  const result: string[] = []; if (!enabled) result.push('Suspended profile');
  if (unique > 0 && raw / unique >= 10 && raw >= 100) result.push('High capture / visitor ratio');
  if (unique >= 100 && conversions === 0) result.push('High traffic without conversions'); return result;
}
