import { useEffect, useRef } from 'react';
import { countdownParts, useNewYearCountdown } from './countdown';

/**
 * A quiet card under a New Year greeting (shown only after the reveal, so it never interrupts it). Server time, no
 * drift, stops at zero. It is a timer for sighted readers; screen readers get one summary that changes each minute.
 * It shares its engine with the standalone Mystery Countdown (/countdown), which it links to while counting.
 */
export function NewYearCountdown({ onShown }: { onShown?: () => void }) {
  const view = useNewYearCountdown(true);
  const shown = useRef(false);
  useEffect(() => { if (!shown.current && (view.state === 'running' || view.state === 'arrived')) { shown.current = true; onShown?.(); } }, [view.state, onShown]);
  if (view.state === 'unavailable' || view.state === 'over') return null;
  if (view.state === 'arrived') return <section className="mg-countdown" aria-label="New Year in Accra"><p className="mg-countdown-title">It’s 2027 in Accra. Happy New Year!</p></section>;
  if (view.state === 'syncing') return <section className="mg-countdown" aria-hidden="true"><p className="mg-countdown-title">Counting down to 2027…</p></section>;
  const p = countdownParts(view.remainingMs);
  const cells: [number, string][] = [[p.days, p.days === 1 ? 'day' : 'days'], [p.hours, p.hours === 1 ? 'hour' : 'hours'], [p.minutes, p.minutes === 1 ? 'minute' : 'minutes'], [p.seconds, p.seconds === 1 ? 'second' : 'seconds']];
  return (
    <section className="mg-countdown" aria-labelledby="mg-countdown-title">
      <p className="mg-countdown-title" id="mg-countdown-title">Until 2027 in Accra</p>
      <div className="mg-countdown-grid" role="timer" aria-hidden="true">
        {cells.map(([value, label]) => <span key={label} className="mg-countdown-cell"><b>{String(value).padStart(2, '0')}</b><span>{label}</span></span>)}
      </div>
      <p className="mg-sr">{p.days} days, {p.hours} hours and {p.minutes} minutes until midnight on 1 January 2027 in Accra.</p>
      {/* 3.7.1: the full Mystery Countdown, a plain link (its own small page), offered only while there is a countdown. */}
      <a className="mg-countdown-link" href="/countdown">Watch the full countdown<span aria-hidden="true">→</span></a>
    </section>
  );
}
