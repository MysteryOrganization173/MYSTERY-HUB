import React, { useId, useState } from 'react';
import { BellRing, BellOff, CheckCircle2, X } from 'lucide-react';
import { requestNotificationPermission, type NotificationPermissionState } from '../../pwa/notifications';
import { recordDismissal, STORAGE_KEYS } from '../../pwa/launchPolicy';
import './pwa.css';

type Step = 'ask' | 'asking' | NotificationPermissionState;

/**
 * Mystery Hub's own explanation, shown before the browser's permission dialog and only opened by a tap.
 * The copy says plainly that alerts are not being sent yet: permission is collected, delivery comes later.
 */
export const NotificationOptIn: React.FC<{ onDone: () => void; variant?: 'floating' | 'inline' }> = ({ onDone, variant = 'floating' }) => {
  const [step, setStep] = useState<Step>('ask');
  const titleId = useId();
  const later = () => { recordDismissal(STORAGE_KEYS.notificationOptIn); onDone(); };
  const enable = async () => {
    setStep('asking');
    const result = await requestNotificationPermission();
    // Closing the browser dialog without answering counts as "not now", so the card rests like any dismissal.
    if (result === 'default') recordDismissal(STORAGE_KEYS.notificationOptIn);
    setStep(result);
  };

  const frame = (children: React.ReactNode, close: () => void, label: string) =>
    <section aria-labelledby={titleId} className={`mh-notify-card mh-notify-card-${variant}`} data-overlay-exempt>
      <button type="button" className="mh-app-sheet-close mh-compact-control" onClick={close} aria-label={label}><X className="size-4" aria-hidden="true" /></button>
      {children}
    </section>;

  if (step === 'granted') return frame(<div role="status" className="mh-notify-body">
    <CheckCircle2 className="mh-notify-icon text-emerald-300" aria-hidden="true" />
    <div><h2 id={titleId}>Notifications allowed</h2><p>Nothing is sent yet. When Mystery Hub alerts start, they can reach this phone.</p></div>
  </div>, onDone, 'Close');

  if (step === 'denied' || step === 'default' || step === 'unsupported' || step === 'unavailable') return frame(<div role="status" className="mh-notify-body">
    <BellOff className="mh-notify-icon text-slate-300" aria-hidden="true" />
    <div><h2 id={titleId}>{step === 'denied' ? 'Notifications are off' : 'No change made'}</h2>
      <p>{step === 'denied' ? 'That is fine. You can allow them later for Mystery Hub in your phone settings.' : 'This phone did not allow notifications right now. Everything else works as usual.'}</p></div>
  </div>, onDone, 'Close');

  return frame(<>
    <div className="mh-notify-body">
      <BellRing className="mh-notify-icon text-emerald-300" aria-hidden="true" />
      <div>
        <h2 id={titleId}>Be ready for Mystery Hub alerts</h2>
        <p>Alerts are not switched on yet. Allow notifications now so future order and account updates can reach this phone.</p>
      </div>
    </div>
    <div className="mh-notify-actions">
      <button type="button" className="mh-button" disabled={step === 'asking'} onClick={() => { void enable(); }}>{step === 'asking' ? 'Waiting for your phone…' : 'Enable notifications'}</button>
      <button type="button" className="mh-install-later" onClick={later}>Not now</button>
    </div>
  </>, later, 'Not now');
};
