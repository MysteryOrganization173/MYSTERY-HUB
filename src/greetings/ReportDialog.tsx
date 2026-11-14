import { useState } from 'react';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { reportGreeting, type ReportReason, type Result } from './api';

const REASONS: [ReportReason, string][] = [
  ['abuse', 'It’s abusive, threatening or hateful'],
  ['spam', 'It’s spam or a scam'],
  ['privacy', 'It shares someone’s private information'],
];

/** What a report attempt may say: thanks only when the server stored it; any other answer asks to try again. */
export const reportOutcome = (result: Result<{ accepted: true }>) => result.ok ? 'sent' as const : result.failure === 'offline' ? 'offline' as const : result.failure === 'busy' ? 'busy' as const : 'unavailable' as const;

/** Reports go to Mystery Hub for review. They never remove a greeting by themselves, and the sender is never told. */
export function ReportDialog({ shareId, onClose }: { shareId: string; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'busy' | 'offline' | 'unavailable'>('idle');
  const ref = useDialogFocus(true, onClose);
  const send = async () => {
    if (!reason || state === 'sending') return;
    setState('sending');
    const result = await reportGreeting(shareId, reason);
    setState(reportOutcome(result));
  };
  const done = state === 'sent';
  return (
    <div className="mg-dialog-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={ref} className="mg-dialog" role="dialog" aria-modal="true" aria-labelledby="mg-report-title" tabIndex={-1}>
        <h2 id="mg-report-title">Report this greeting</h2>
        {done ? (
          <p role="status">Thank you. Mystery Hub will review this greeting.</p>
        ) : (
          <>
            <p>Tell us what’s wrong. Mystery Hub reviews every report, and the person who sent it isn’t told who reported it.</p>
            <fieldset className="mg-report-options" disabled={state === 'sending'}>
              <legend className="mg-sr">Reason</legend>
              {REASONS.map(([value, label]) => (
                <label key={value} className="mg-radio-row">
                  <input type="radio" name="mg-report-reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            {state === 'offline' && <p role="alert" className="mg-dialog-error">We couldn’t send it. Check your connection and try again.</p>}
            {state === 'busy' && <p role="alert" className="mg-dialog-error">We couldn’t send your report just now. Please try again in a little while.</p>}
            {state === 'unavailable' && <p role="alert" className="mg-dialog-error">Reporting isn’t available right now. Please try again later.</p>}
          </>
        )}
        <div className="mg-dialog-actions">
          {!done && <button type="button" className="mg-btn mg-btn-primary" disabled={!reason || state === 'sending'} onClick={() => void send()}>{state === 'sending' ? 'Sending…' : 'Send report'}</button>}
          <button type="button" className="mg-btn mg-btn-ghost" onClick={onClose} data-autofocus={done || undefined}>{done ? 'Close' : 'Cancel'}</button>
        </div>
      </div>
    </div>
  );
}
