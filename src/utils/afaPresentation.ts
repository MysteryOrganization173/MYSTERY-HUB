import type { AfaPackageInfo } from '../config/afa';

/**
 * What the AFA page leads with. Every figure is derived from the package examples in config/afa, so the highlights
 * can never say more than the comparison table does. SMS is left out until its amount is confirmed (see config).
 */
export interface AfaHighlight { key: 'cug' | 'onNet' | 'offNet' | 'data'; value: string; label: string; short: string; detail: string }

const most = (packages: AfaPackageInfo[], pick: (p: AfaPackageInfo) => number | undefined) =>
  Math.max(0, ...packages.map(p => pick(p) || 0));

export function afaHighlights(packages: AfaPackageInfo[]): AfaHighlight[] {
  const monthly = packages.filter(p => p.period === 'monthly');
  const highlights: AfaHighlight[] = [];
  const cug = most(monthly, p => p.cugMins), onNet = most(monthly, p => p.onNetMins), offNet = most(monthly, p => p.offNetMins), data = most(monthly, p => p.dataMb);
  if (cug) highlights.push({ key: 'cug', value: `${cug}`, label: 'CUG minutes', short: 'CUG mins', detail: 'Calls within your AFA group' });
  if (onNet) highlights.push({ key: 'onNet', value: `${onNet}`, label: 'MTN minutes', short: 'MTN mins', detail: 'Calls to MTN numbers' });
  if (offNet) highlights.push({ key: 'offNet', value: `${offNet}`, label: 'Other networks', short: 'Other networks', detail: 'Minutes to Telecel and AT' });
  if (data) highlights.push({ key: 'data', value: data >= 1024 ? `${+(data / 1024).toFixed(1)}GB` : `${data}MB`, label: 'Data option', short: 'Data option', detail: 'On the with-data package' });
  return highlights;
}

/** "GH₵10 monthly · GH₵3 weekly": the cheapest package of each period, from the same examples. */
export function afaPackagePrices(packages: AfaPackageInfo[]) {
  const cheapest = (period: AfaPackageInfo['period']) => {
    const prices = packages.filter(p => p.period === period).map(p => p.priceGhc);
    return prices.length ? Math.min(...prices) : null;
  };
  return { monthly: cheapest('monthly'), weekly: cheapest('weekly') };
}

/** Table cell text. A null SMS amount is included in the package but not yet confirmed, so no number is shown. */
export function afaPackageCell(pkg: AfaPackageInfo, key: 'onNetMins' | 'offNetMins' | 'cugMins' | 'sms' | 'dataMb'): string | null {
  const value = pkg[key];
  if (key === 'sms' && value === null) return 'Included';
  if (!value) return null;
  return key === 'dataMb' ? `${value}MB` : String(value);
}
