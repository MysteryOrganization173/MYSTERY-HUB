import React, {useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {customerActivityLabel, isOwnerActivity} from '../../utils/customerActivity';
import {formatGhs} from '../../../shared/money';

/**
 * V7.2 Business Analytics presentation. Display only: every figure is the server's own (views, visitors, clicks,
 * checkout starts, verified paid and delivered orders, Store Earnings). Nothing is estimated, merged or relabelled
 * as something it is not: views are not people, checkout starts are not payments, pending earnings are not cash.
 */
type Trend = Array<{day: string; views: number}>;
type Metric = {label: string; value: React.ReactNode; note?: string};

/** Days between the first and last reported day. Days without recorded views show as zero, never as estimates. */
export function dailyViewSeries(trend: Trend): Trend {
  if (!trend.length) return [];
  const sorted = [...trend].sort((a, b) => a.day.localeCompare(b.day)), byDay = new Map(sorted.map(d => [d.day, d.views]));
  const start = Date.parse(`${sorted[0].day}T00:00:00Z`), end = Date.parse(`${sorted[sorted.length - 1].day}T00:00:00Z`);
  // Long all-time histories keep every reported day rather than silently dropping the newest records.
  // Avoid allocating years of empty dates: only short ranges have their gaps filled.
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || (end - start) / 86400000 >= 400) return sorted;
  const days: Trend = [];
  for (let t = start; t <= end; t += 86400000) { const day = new Date(t).toISOString().slice(0, 10); days.push({day, views: byDay.get(day) || 0}); }
  return days;
}

const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions = {day: 'numeric', month: 'short'}) => new Intl.DateTimeFormat(undefined, {...opts, timeZone: 'UTC'}).format(new Date(`${day}T00:00:00Z`));

const activityDay = new Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Accra',year:'numeric',month:'2-digit',day:'2-digit'});
/** Ghana calendar days, with consecutive repeats collapsed only within the same day. */
export function groupActivity(entries: Array<{label: string; at: string}>, now = new Date()) {
  const today = activityDay.format(now), yesterday = activityDay.format(new Date(now.getTime() - 86400000));
  const groups: Array<{heading: string; rows: Array<{label: string; at: string; count: number}>}> = [];
  let previousDay = '';
  for (const entry of entries) {
    const date = new Date(entry.at), key = activityDay.format(date);
    const heading = key === today ? 'Today' : key === yesterday ? 'Yesterday' : new Intl.DateTimeFormat(undefined, {timeZone:'Africa/Accra',weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(date);
    if (key !== previousDay) groups.push({heading,rows:[]});
    const rows = groups[groups.length - 1].rows, last = rows[rows.length - 1];
    if (last?.label === entry.label) last.count++; else rows.push({...entry,count:1});
    previousDay = key;
  }
  return groups;
}

function MetricGroup({title, metrics, children}: {title: string; metrics: Metric[]; children?: React.ReactNode}) {
  return <section className="ba-card" aria-label={title}>
    <h3>{title}</h3>
    <dl className="ba-metrics">{metrics.map(m => <div key={m.label}><dt>{m.label}</dt><dd>{m.value}</dd>{m.note && <p>{m.note}</p>}</div>)}</dl>
    {children}
  </section>;
}

function ViewsChart({trend}: {trend: Trend}) {
  const series = dailyViewSeries(trend);
  if (!series.length) return <div className="ba-empty">No visits recorded in this period. Share your published website to reach customers.</div>;
  const max = Math.max(1, ...series.map(d => d.views)), total = series.reduce((sum, d) => sum + d.views, 0);
  const peak = series.reduce((best, d) => d.views > best.views ? d : best, series[0]);
  const width = 600, height = 160, top = 12, bottom = 22, plot = height - top - bottom;
  const step = width / series.length, bar = Math.max(2, Math.min(28, step * .62));
  const ticks = series.length <= 8 ? series.map((_, i) => i) : [0, Math.floor((series.length - 1) / 2), series.length - 1];
  const summary = `${total} ${total === 1 ? 'view' : 'views'} from ${dayLabel(series[0].day)} to ${dayLabel(series[series.length - 1].day)}. Busiest day ${dayLabel(peak.day)} with ${peak.views}.`;
  return <figure className="ba-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Views by day. ${summary}`} preserveAspectRatio="none">
      {[1, .5].map(f => <line key={f} x1="0" x2={width} y1={top + plot * (1 - f)} y2={top + plot * (1 - f)} className="ba-grid"/>)}
      <line x1="0" x2={width} y1={top + plot} y2={top + plot} className="ba-axis"/>
      {series.map((d, i) => {
        const h = d.views ? Math.max(3, plot * d.views / max) : 0;
        return <rect key={d.day} x={i * step + (step - bar) / 2} y={top + plot - h} width={bar} height={h} rx={Math.min(4, bar / 2)} className={d.day === peak.day && d.views ? 'ba-bar is-peak' : 'ba-bar'}><title>{`${dayLabel(d.day)}: ${d.views}`}</title></rect>;
      })}
      {ticks.map(i => <text key={i} x={Math.min(width - 2, Math.max(2, i * step + step / 2))} y={height - 6} textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'} className="ba-tick">{dayLabel(series[i].day)}</text>)}
    </svg>
    <figcaption><span><strong>{total}</strong> {total === 1 ? 'view' : 'views'}</span><span>Busiest: {dayLabel(peak.day)} ({peak.views})</span><span className="ba-scale">Top line = {max}</span></figcaption>
    <details className="ba-table"><summary>Daily numbers<ChevronDown size={15} aria-hidden="true"/></summary>
      <table><thead><tr><th scope="col">Day (UTC)</th><th scope="col">Views</th></tr></thead><tbody>{[...series].reverse().map(d => <tr key={d.day}><td>{dayLabel(d.day, {weekday: 'short', day: 'numeric', month: 'short'})}</td><td>{d.views}</td></tr>)}</tbody></table>
    </details>
  </figure>;
}

export function BusinessAnalytics({analytics: a, earnings: e, activity, reseller, published}: {analytics: any; earnings: any; activity: any[]; reseller: boolean; published: boolean}) {
  const [showAll, setShowAll] = useState(false);
  const customer = [...a.activity.filter((x: any) => !isOwnerActivity(x.event)).map((x: any) => ({label: customerActivityLabel(x.event), at: x.createdAt})),
    ...activity.map((x: any) => ({label: `${customerActivityLabel(x.kind)} · ${customerActivityLabel(x.state)}`, at: x.createdAt}))].sort((x, y) => y.at.localeCompare(x.at));
  // The owner's own builder visits: counted once per kind instead of a long list of "You opened the editor".
  const own = a.activity.filter((x: any) => isOwnerActivity(x.event)).reduce((map: Map<string, {count: number; at: string}>, x: any) => {
    const label = customerActivityLabel(x.event), prev = map.get(label);
    map.set(label, {count: (prev?.count || 0) + 1, at: prev && prev.at > x.createdAt ? prev.at : x.createdAt});
    return map;
  }, new Map());
  const groups = groupActivity(customer), rowCount = groups.reduce((n, g) => n + g.rows.length, 0), limit = 8;
  let shown = 0;
  const visible = showAll ? groups : groups.map(g => ({...g, rows: g.rows.filter(() => shown++ < limit)})).filter(g => g.rows.length);
  const contacts = (a.callClicks || 0) + (a.emailClicks || 0);

  return <div className="ba" data-analytics>
    <div className="ba-cards">
      <MetricGroup title="Reach" metrics={[
        {label: 'Views', value: a.views, note: 'Times your site was opened. Repeat opens within 24 hours count once.'},
        {label: 'Visitors', value: a.uniqueVisitors, note: 'Different browsers, not confirmed people.'},
      ]}/>
      <MetricGroup title="Customer actions" metrics={[
        {label: 'WhatsApp opened', value: a.whatsappClicks},
        {label: 'Call or email', value: contacts},
        {label: 'Main button', value: a.primaryCtaClicks},
      ]}/>
      {reseller && <MetricGroup title="Sales" metrics={[
        {label: 'Checkout starts', value: a.checkoutStarts, note: 'Started paying. Not a payment.'},
        {label: 'Paid orders', value: a.paidOrders, note: 'Payment verified.'},
        {label: 'Delivered orders', value: a.deliveredOrders},
        {label: 'Sales', value: formatGhs(a.salesMinor || 0), note: 'Paid orders, excluding refunds.'},
      ]}>
        {a.conversion !== null && <p className="ba-foot">Paid orders per checkout start: <strong>{a.conversion.toFixed(1)}%</strong>. Missed analytics can push this above 100%.</p>}
      </MetricGroup>}
      {reseller && e && <MetricGroup title="Store Earnings" metrics={[
        {label: 'Available', value: formatGhs(e.availableMinor || 0), note: 'Can be withdrawn.'},
        {label: 'Pending', value: formatGhs(e.pendingMinor || 0), note: 'Not withdrawable yet.'},
      ]}/>}
    </div>

    <section className="ba-card" aria-labelledby="ba-trend-title">
      <h3 id="ba-trend-title">Views by day <small>UTC</small></h3>
      <ViewsChart trend={a.trend || []}/>
    </section>

    <section className="ba-card" aria-labelledby="ba-activity-title">
      <h3 id="ba-activity-title">Customer activity <small>Ghana time</small></h3>
      {rowCount ? <>
        <ol className="ba-days">{visible.map(g => <li key={g.heading}><h4>{g.heading}</h4><ul>{g.rows.map((row, i) => <li key={i}>
          <span className="ba-row-label">{row.label}{row.count > 1 && <span className="ba-count"> ×{row.count}</span>}</span>
          <time dateTime={row.at}>{new Intl.DateTimeFormat(undefined, {timeZone:'Africa/Accra',hour:'numeric',minute:'2-digit'}).format(new Date(row.at))}</time>
        </li>)}</ul></li>)}</ol>
        {rowCount > limit && <button type="button" className="ba-more" aria-expanded={showAll} onClick={() => setShowAll(v => !v)}>{showAll ? 'Show less' : `Show all ${rowCount}`}</button>}
      </> : <p className="ba-empty">{published ? 'No customer activity recorded in this history. Site visits and contact actions are shown in the totals above.' : 'Publish and share your website to start seeing customer activity.'}</p>}
      {own.size > 0 && <details className="ba-own"><summary>Your own visits<span>{[...own.values()].reduce((n: number, v: any) => n + v.count, 0)}</span><ChevronDown size={15} aria-hidden="true"/></summary>
        <ul>{[...own.entries()].map(([label, v]: [string, any]) => <li key={label}><span>{label}</span><span>{v.count === 1 ? 'once' : `${v.count} times`} · latest {new Date(v.at).toLocaleString()}</span></li>)}</ul>
        <p>These are your own actions in the builder. They are not customer visits.</p>
      </details>}
    </section>
    <details className="ba-help"><summary>How these numbers work<ChevronDown size={15} aria-hidden="true"/></summary>
      <p>Visitors are anonymous browser identities. Repeat views in the same session are deduplicated for 24 hours. Sales and delivery come from verified order records. Conversion compares paid orders with observed checkout starts; missing analytics may affect this ratio.</p>
    </details>
  </div>;
}
