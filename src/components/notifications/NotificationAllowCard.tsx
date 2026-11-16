import React, { useEffect, useRef, useState } from 'react';
import { BellOff, BellRing, CheckCircle2, Loader2 } from 'lucide-react';
import { activateNotificationInvite, memberInvite } from '../../pwa/notificationOnboarding';
import { NOTIFICATION_ACTIONS, NOTIFICATION_RESULT, notificationCopy } from '../../pwa/invitationCopy';
import { httpCustomerNotificationsClient, httpGuestNotificationsClient, type CustomerNotificationsClient, type GuestNotificationsClient, type NotificationPreferences } from '../../services/customerNotifications';
import { PAUSED_NOTE } from '../../pwa/push';

/** Shown under the card while the operator has paused sending: honest, and promises nothing about timing. */
export const PAUSED_ALLOW_NOTE = 'Mystery Hub isn’t sending notifications right now. If you turn them on, this device gets them once sending resumes.';

/**
 * 3.4.1: the one "Allow Notifications" experience, inline (My Account and the Notification Center). Same words, same
 * consent and the same registration as the invitation: one tap asks the browser, registers this device with the
 * server and records consent for exactly the purposes the sentence names. A member who turned news and offers off
 * before is offered order updates only; this card never turns offers back on. "On" appears only once the server
 * confirms the device.
 */
export function NotificationAllowCard({ token, accountId, preferences, paused, onRegistered, onNotNow, client = httpCustomerNotificationsClient, guest = httpGuestNotificationsClient }: {
  token: string; accountId: string; preferences: Pick<NotificationPreferences, 'promotional' | 'marketingOptedOut'> | null; paused: boolean;
  onRegistered?: () => void; onNotNow?: () => void; client?: CustomerNotificationsClient; guest?: GuestNotificationsClient;
}) {
  // Until the account's choices are known, nothing is offered beyond order updates.
  const invite = preferences ? memberInvite(preferences, accountId) : { audience: 'member' as const, offers: false };
  const [step, setStep] = useState<'invite' | 'working' | 'registered' | 'denied' | 'error'>('invite');
  const [reason, setReason] = useState<string | null>(null);
  const [offersOff, setOffersOff] = useState<'no' | 'saving' | 'off' | 'failed'>('no');
  const request = useRef<AbortController | null>(null);
  useEffect(() => { request.current = new AbortController(); return () => request.current?.abort(); }, []);
  // The Allow button is replaced by the result: move focus to the result so it is announced and not lost.
  const resultBox = useRef<HTMLDivElement>(null), inviteBox = useRef<HTMLDivElement>(null);
  useEffect(() => { if (step === 'registered' || step === 'denied' || step === 'error') resultBox.current?.focus(); }, [step]);

  const allow = async () => {
    const signal = request.current?.signal;
    if (step === 'working' || !signal || signal.aborted) return;
    setStep('working'); setReason(null);
    try {
      const result = await activateNotificationInvite(client, guest, invite, { token, signal });
      if (signal.aborted) return;
      if (result.step === 'registered') { setStep('registered'); onRegistered?.(); }
      // Dismissing the browser's own question changes nothing: the card simply stays.
      else if (result.step === 'dismissed') setStep('invite');
      else { setReason(result.message ?? null); setStep(result.step); }
    } catch { if (!signal.aborted) setStep('error'); }
  };
  // Right where the choice was made, offers can be dropped in one tap (order updates stay on).
  const ordersOnly = async () => {
    if (offersOff === 'saving') return;
    setOffersOff('saving');
    const saved = await client.savePreferences(token, { transactional: true, promotional: false, expectedVersion: '', source: 'notification_invitation' }).catch(() => ({ ok: false as const, message: '' }));
    if (!request.current?.signal.aborted) setOffersOff(saved.ok && !saved.value.promotional ? 'off' : 'failed');
  };

  if (step === 'registered' || step === 'denied' || step === 'error') {
    const result = NOTIFICATION_RESULT[step];
    return <div ref={resultBox} tabIndex={-1} role="status" className={`rounded-2xl border p-4 outline-none ${step === 'registered' ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-amber-500/30 bg-amber-500/[0.05]'}`}>
      <div className="flex gap-3">
        {step === 'registered' ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" aria-hidden /> : <BellOff className="mt-0.5 size-5 shrink-0 text-amber-200" aria-hidden />}
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-white">{result.title}</p>
          <p className="text-sm text-slate-300">{offersOff === 'off' ? `${result.text} Offers are off.` : result.text}</p>
          {step === 'error' && reason && <p className="text-sm text-slate-300">{reason}</p>}
          {step === 'registered' && paused && <p className="text-sm text-amber-200">{PAUSED_NOTE}</p>}
        </div>
      </div>
      {step === 'error' && <button type="button" className="mh-button mt-3 w-full" onClick={() => { void allow(); window.setTimeout(() => inviteBox.current?.focus(), 0); }}>Try again</button>}
      {step === 'registered' && invite.offers && offersOff !== 'off' && <button type="button" className="mt-2 min-h-11 w-full rounded-xl text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10" disabled={offersOff === 'saving'} onClick={() => { void ordersOnly(); }}>{offersOff === 'saving' ? 'Saving…' : NOTIFICATION_ACTIONS.ordersOnly}</button>}
      {offersOff === 'failed' && <p className="mt-2 text-sm text-rose-300" role="alert">That didn’t save. You can turn offers off with the News and offers switch.</p>}
    </div>;
  }

  const copy = notificationCopy(invite);
  return <div ref={inviteBox} tabIndex={-1} role="group" aria-label="Turn on notifications" className="outline-none rounded-2xl border border-emerald-500/25 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(0,195,101,0.12),transparent_60%)] p-4">
    <div className="flex gap-3">
      <BellRing className="mt-0.5 size-5 shrink-0 text-[#44df95]" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p className="font-bold text-white">{copy.title}</p>
        <p className="text-sm text-slate-200">{copy.text}</p>
        {paused && <p className="text-sm text-amber-200">{PAUSED_ALLOW_NOTE}</p>}
      </div>
    </div>
    <div className={`mt-3 grid gap-2 ${onNotNow ? 'grid-cols-[1fr_auto]' : ''}`}>
      <button type="button" className="mh-button w-full" disabled={step === 'working'} aria-busy={step === 'working' || undefined} onClick={() => { void allow(); }}>
        {step === 'working' ? <><Loader2 className="size-4 animate-spin" aria-hidden />Allowing…</> : NOTIFICATION_ACTIONS.allow}
      </button>
      {onNotNow && <button type="button" className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-300 hover:bg-white/5" disabled={step === 'working'} onClick={onNotNow}>{NOTIFICATION_ACTIONS.later}</button>}
    </div>
    <p className="mt-2 text-xs text-slate-400">{NOTIFICATION_ACTIONS.note}</p>
  </div>;
}
