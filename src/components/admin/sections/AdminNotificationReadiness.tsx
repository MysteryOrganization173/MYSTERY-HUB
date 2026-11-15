import React, { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Clock3, PauseCircle, PlayCircle, Smartphone, XCircle } from 'lucide-react';
import type { AdminNotificationsClient, NotificationOverview } from '../../../services/adminNotifications';
import { AdminButton, AdminPanel, ConfirmAction, StatusPill } from '../ui/AdminUi';

type Tone = 'ok' | 'wait' | 'off' | 'blocked';
const ICONS: Record<Tone, React.ReactNode> = {
  ok: <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden />,
  wait: <Clock3 className="h-5 w-5 text-amber-200" aria-hidden />,
  off: <Circle className="h-5 w-5 text-slate-500" aria-hidden />,
  blocked: <XCircle className="h-5 w-5 text-rose-300" aria-hidden />,
};
const TONE_LABEL: Record<Tone, string> = { ok: 'Ready', wait: 'Waiting', off: 'Off', blocked: 'Blocked' };
const time = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function Check({ tone, title, children }: { tone: Tone; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span className="mt-0.5 shrink-0">{ICONS[tone]}<span className="sr-only">{TONE_LABEL[tone]}: </span></span>
      <span className="min-w-0 space-y-0.5">
        <span className="block font-semibold text-white">{title}</span>
        {children && <span className="block text-sm text-slate-400">{children}</span>}
      </span>
    </li>
  );
}

/**
 * What the server says about notification readiness, in plain words, with the two operator actions that matter
 * before activation: a test to the operator's own devices (works while paused) and pause/resume. Resuming stays
 * unavailable until a test was opened on a real phone; the server enforces the same rule.
 */
export function AdminNotificationReadiness({ token, client, overview, onChanged }: {
  token: string; client: AdminNotificationsClient; overview: NotificationOverview; onChanged: () => void;
}) {
  const r = overview.readiness;
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirm, setConfirm] = useState<'pause' | 'resume' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const testKey = useRef<string | null>(null);
  if (!r) return null;

  const paused = overview.paused !== false;
  const configured = r.keysValid && r.switchOn && overview.sendingEnabled === true;
  const verified = Boolean(r.lastTest?.openedAt);
  const worker = overview.worker;
  const workerFailing = Boolean(worker?.lastErrorAt && (!worker.lastCompletedAt || worker.lastErrorAt > worker.lastCompletedAt));
  const last7 = r.last7Days, problems = (last7.failed ?? 0) + (last7.invalid ?? 0);
  const testBlocked = !configured ? 'Web Push is not configured on the server, so no test can be sent.'
    : r.ownDevices === 0 ? 'No phone is registered to your account yet. On your phone, sign in to Mystery Hub, open My Account and turn on notifications.'
    : null;

  const sendTest = async () => {
    if (!client.testSelf || testing || testBlocked) return;
    setTesting(true); setTestResult(null);
    // One key per click; a retry after an unknown outcome reuses it, so the test cannot be queued twice.
    testKey.current ??= newKey();
    const res = await client.testSelf(token, { requestId: testKey.current });
    setTesting(false);
    if (res.ok) {
      testKey.current = null;
      setTestResult({ ok: true, message: res.duplicate ? 'That test was already sent. Check your phone.' : `Test sent to your ${plural(res.devices, 'device')}. On your phone, tap the notification, then refresh this page.` });
      onChanged();
    } else setTestResult({ ok: false, message: res.message });
  };
  const changePause = async (values: Record<string, string>) => {
    if (!client.setPaused || !confirm) return;
    setBusy(true); setError(null);
    const res = await client.setPaused(token, confirm === 'pause', values.reason);
    setBusy(false);
    if (res.ok) { setConfirm(null); onChanged(); } else setError(res.message);
  };

  const states = [['accepted', 'accepted'], ['retrying', 'retrying'], ['failed', 'failed'], ['invalid', 'expired'], ['skipped', 'not sent']] as const;
  const week = states.filter(([k]) => (last7[k] ?? 0) > 0).map(([k, label]) => `${(last7[k] ?? 0).toLocaleString()} ${label}`).join(' · ');

  return (
    <AdminPanel title="Status" description="What the server reports right now. Keys and phone addresses are never shown."
      actions={<StatusPill tone={!configured ? 'danger' : paused ? 'warning' : 'success'}>{!configured ? 'Not configured' : paused ? 'Paused' : 'Live'}</StatusPill>}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <ul className="divide-y divide-slate-800/80">
          <Check tone={r.keysValid ? 'ok' : 'blocked'} title={r.keysValid ? 'Push keys are set up' : 'Push keys are missing or invalid'}>
            {r.keysValid ? 'Valid keys are configured on the server.' : 'Delivery cannot start until valid keys are configured on the server.'}
          </Check>
          <Check tone={r.switchOn ? 'ok' : 'blocked'} title={r.switchOn ? 'The sending switch is on' : 'The sending switch is off'}>
            {r.switchOn ? 'WEB_PUSH_ENABLED is set on the server.' : 'Set WEB_PUSH_ENABLED=true on the server to allow delivery.'}
          </Check>
          <Check tone={!configured ? 'off' : paused ? 'wait' : 'ok'} title={paused ? 'Sending is paused' : 'Sending is live'}>
            {paused ? 'Nothing goes to customers or visitors. Your own tests still work.' : 'Order updates and confirmed announcements are being sent.'}
          </Check>
          {configured && <Check tone={!worker?.running ? 'blocked' : workerFailing ? 'wait' : 'ok'} title={!worker?.running ? 'The background sender is not running' : workerFailing ? 'The background sender hit a problem' : 'The background sender is running'}>
            {!worker?.running ? 'This server process has not started it. Restart the server after configuring keys.'
              : workerFailing ? `Its last check failed at ${time(worker.lastErrorAt)}. It keeps trying every 10 seconds.`
              : worker.lastCompletedAt ? `Last check ${time(worker.lastCompletedAt)}.` : 'Waiting for its first check.'}
          </Check>}
          <Check tone={r.liveDevices > 0 ? 'ok' : 'off'} title={r.liveDevices > 0 ? `${plural(r.liveDevices, 'device')} on ${plural(r.liveAccounts, 'account')} can receive` : 'No signed-in devices are registered yet'}>
            {r.signedOutDevices > 0 ? `${plural(r.signedOutDevices, 'more device is', 'more devices are')} registered but signed out; they receive again after the person signs in.` : 'Each device counts once; one person may have several.'}
          </Check>
          <Check tone={r.announcementCustomers > 0 ? 'ok' : 'off'} title={`${plural(r.announcementCustomers, 'customer')} chose news and offers`}>
            {`${plural(r.announcementDevices, 'device')} registered in all. Only these customers can receive announcements.`}
          </Check>
          <Check tone={r.guestNews ? (r.guestBrowsers > 0 ? 'ok' : 'off') : 'off'} title={r.guestNews ? `${plural(r.guestBrowsers, 'visitor browser')} chose news` : 'News for visitors without an account is off'}>
            {r.guestNews ? 'Browsers without an account that turned on news and offers.' : 'Visitors cannot sign up for news until WEB_PUSH_GUEST_NEWS is turned on.'}
          </Check>
          {paused && r.waitingEvents > 0 && <Check tone="wait" title={`${plural(r.waitingEvents, 'order update is', 'order updates are')} waiting`}>
            Saved in the last 24 hours while paused. They are sent when you resume; anything older never is.
          </Check>}
          <Check tone={problems > 0 ? 'wait' : week ? 'ok' : 'off'} title={week ? `Last 7 days: ${week}` : 'Nothing sent in the last 7 days'}>
            {r.commonProblem ? `Most common problem: ${r.commonProblem}` : '“Accepted” means the push service took it, not that a person saw it.'}
          </Check>
        </ul>

        <div className="space-y-3 self-start rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="flex items-center gap-2 font-semibold text-white"><Smartphone className="h-4 w-4 text-[#00c365]" aria-hidden />Check it on your phone</p>
          {!r.lastTest ? <p className="text-sm text-slate-300">Not checked on a phone yet. Send a test to your own devices, then tap it on your phone.</p>
            : verified ? <p className="text-sm text-emerald-200">Checked on your phone. You opened the test from its notification at {time(r.lastTest.openedAt)}.</p>
            : <p className="text-sm text-amber-100">Test sent {time(r.lastTest.createdAt)}{r.lastTest.states.accepted ? `, accepted by the push service for ${plural(r.lastTest.states.accepted, 'device')}` : ''}. Waiting for you to tap it on your phone.</p>}
          <p className="text-xs text-slate-400">Only your own signed-in devices receive it: “Test notification” after you sign in, with generic text on the lock screen, like an order update.</p>
          <AdminButton variant={verified ? 'secondary' : 'primary'} className="w-full" disabled={Boolean(testBlocked) || testing || !client.testSelf} busy={testing} onClick={() => void sendTest()}>
            <Smartphone className="h-4 w-4" />Send a test to my devices
          </AdminButton>
          {testBlocked && <p className="text-xs text-slate-400">{testBlocked}</p>}
          {testResult && <p role={testResult.ok ? 'status' : 'alert'} className={`text-sm ${testResult.ok ? 'text-emerald-200' : 'text-rose-300'}`}>{testResult.message}</p>}
          {configured && client.setPaused && <div className="border-t border-slate-800 pt-3">
            {paused ? <>
              <AdminButton className="w-full" disabled={!verified} onClick={() => { setError(null); setConfirm('resume'); }}><PlayCircle className="h-4 w-4" />Resume sending</AdminButton>
              {!verified && <p className="mt-1.5 text-xs text-slate-400">Available after you check a test on your phone.</p>}
            </> : <AdminButton className="w-full" onClick={() => { setError(null); setConfirm('pause'); }}><PauseCircle className="h-4 w-4" />Pause sending</AdminButton>}
          </div>}
        </div>
      </div>

      {confirm && <ConfirmAction title={confirm === 'resume' ? 'Resume sending to customers?' : 'Pause all sending?'}
        summary={confirm === 'resume'
          ? <>Order updates start going to customers’ registered devices, and you can send announcements to people who chose news.{r.waitingEvents > 0 ? ` ${plural(r.waitingEvents, 'waiting order update')} from the last 24 hours will be sent.` : ''}</>
          : <>Customers and visitors stop receiving order updates and announcements until someone resumes. Your own tests keep working.</>}
        warning={confirm === 'resume' ? <span className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />This turns on live delivery for real customers.</span> : undefined}
        fields={[{ key: 'reason', label: 'Reason, for the audit log', minLength: 5, maxLength: 200, placeholder: confirm === 'resume' ? 'Phone checked; approved for live sending' : 'Maintenance' }]}
        acknowledgement={confirm === 'resume' ? 'I checked notifications on a real phone and I approve live sending to customers.' : 'I understand customers will not receive notifications while paused.'}
        confirmLabel={confirm === 'resume' ? 'Resume sending' : 'Pause sending'} tone={confirm === 'resume' ? 'primary' : 'danger'}
        busy={busy} error={error} onConfirm={values => void changePause(values)} onClose={() => { if (!busy) setConfirm(null); }} />}
    </AdminPanel>
  );
}
