import React, { useEffect, useId, useRef, useState } from 'react';
import { Bell, ChevronDown, Copy, Gift, KeyRound, LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { updateProfileOnServer, revokeOwnSessionsOnServer, getMyReferralSummary, saveReceiptEmailOnServer } from '../../services/apiClient';
import { SecurityDialog, accountInput, accountButton } from './SecurityDialog';
import { PasswordForm } from './PasswordForm';
import { formatGhanaPhone } from '../../utils/checkoutRecovery';
import { useOverlayHistory } from '../../utils/overlayHistory';

/**
 * 3.4.1 My Account: one calm place for the customer's own details. Every section starts as a short summary, and each
 * change opens one focused form in place (never a second dialog). The server keeps every rule: the current password
 * for sign-in changes, password changes signing out other devices, and the forced-password flow outside this sheet.
 */
const primary = `${accountButton} !border-[#00c365] !bg-[#00c365] !text-black`;
const quiet = 'min-h-11 rounded-xl px-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50';
const memberSince = (iso: string) => { const date = new Date(iso); return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : ''; };

/**
 * A save answered after the customer signed out (or switched account) must not put the old profile back on screen:
 * apply it only while the same session is still signed in.
 */
function useSameSession() {
  const { sessionToken } = useApp();
  const current = useRef(sessionToken);
  current.current = sessionToken;
  return (asked: string | null) => current.current === asked;
}

/** Opens a form in place: focus goes into it when it opens and back to its button when it closes. */
function useInlineForm() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null), field = useRef<HTMLInputElement>(null), wasOpen = useRef(false);
  useEffect(() => {
    if (open) field.current?.focus();
    else if (wasOpen.current) toggle.current?.focus();
    wasOpen.current = open;
  }, [open]);
  return { open, setOpen, toggle, field };
}

function Section({ id, title, Icon, children }: { id: string; title: string; Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; children: React.ReactNode }) {
  return <section id={`account-${id}`} aria-labelledby={`account-${id}-title`} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5">
    <h3 id={`account-${id}-title`} className="mb-3 flex items-center gap-2 text-base font-bold text-white"><Icon className="size-4 text-emerald-300" aria-hidden />{title}</h3>
    {children}
  </section>;
}

function Row({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return <div className="min-w-0 py-2.5 first:pt-0">
    <dt className="text-xs text-slate-400">{label}</dt>
    <dd className="mt-0.5 break-words text-sm text-slate-100">{value}</dd>
    {note && <dd className="mt-0.5 text-xs text-slate-400">{note}</dd>}
  </div>;
}

function PersonalDetails() {
  const { user, sessionToken, updateUserProfile } = useApp();
  const form = useInlineForm(), sameSession = useSameSession();
  const [name, setName] = useState(user!.name), [email, setEmail] = useState(user!.email ?? ''), [phone, setPhone] = useState(user!.phone ?? '');
  const [currentPassword, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState('');
  const identifiersChanged = email.trim().toLowerCase() !== (user!.email ?? '') || phone.trim() !== (user!.phone ?? '');
  const reset = () => { setName(user!.name); setEmail(user!.email ?? ''); setPhone(user!.phone ?? ''); setPassword(''); setError(''); };
  const formId = useId();
  return <>
    {!form.open && <dl className="divide-y divide-slate-800">
      <Row label="Name" value={user!.name} />
      <Row label="Phone (sign-in)" value={user!.phone ? formatGhanaPhone(user!.phone) : <span className="text-slate-400">Not added</span>} />
      <Row label="Email (sign-in)" value={user!.email || <span className="text-slate-400">Not added</span>} />
    </dl>}
    {done && !form.open && <p role="status" className="mt-2 text-sm text-emerald-300">{done}</p>}
    {!form.open && <button ref={form.toggle} type="button" aria-expanded={false} aria-controls={formId} className={`${accountButton} mt-3 w-full sm:w-auto`} onClick={() => { reset(); setDone(''); form.setOpen(true); }}>Edit details</button>}
    {form.open && <form id={formId} className="space-y-4" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('');
      const asked = sessionToken;
      try {
        const result = await updateProfileOnServer(asked!, { name, email, phone, ...(identifiersChanged ? { currentPassword } : {}) });
        if (!sameSession(asked)) return;
        updateUserProfile(result.user); setPassword(''); setDone('Your details are saved.'); form.setOpen(false);
      } catch (err) { if (sameSession(asked)) setError(err instanceof Error ? err.message : 'Could not save your details.'); } finally { setBusy(false); }
    }}>
      <label className="block space-y-1 text-sm">Name<input ref={form.field} required minLength={2} maxLength={128} className={accountInput} value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
      <label className="block space-y-1 text-sm">Phone (sign-in)<input type="tel" inputMode="tel" maxLength={32} className={accountInput} value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" /></label>
      <label className="block space-y-1 text-sm">Email (sign-in)<input type="email" inputMode="email" maxLength={128} className={accountInput} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
      <p className="text-xs text-slate-400">You can sign in with either. Keep at least one. These have not been verified by email or SMS.</p>
      {identifiersChanged && <label className="block space-y-1 text-sm">Current password<span className="block text-xs text-slate-400">Needed to change how you sign in.</span><input type="password" required maxLength={128} autoComplete="current-password" className={accountInput} value={currentPassword} onChange={e => setPassword(e.target.value)} /></label>}
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} className={`${accountButton} w-full`} onClick={() => { reset(); form.setOpen(false); }}>Cancel</button>
        <button disabled={busy} className={`${primary} w-full`}>{busy ? 'Saving…' : 'Save details'}</button>
      </div>
    </form>}
    <ReceiptEmail />
  </>;
}

/** A remembered receipt contact, separate from sign-in: no password, and it never changes how the customer signs in. */
function ReceiptEmail() {
  const { user, sessionToken, updateUserProfile } = useApp();
  const form = useInlineForm(), sameSession = useSameSession();
  const [value, setValue] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState('');
  const formId = useId();
  const saved = user!.receiptEmail;
  const save = async (email: string | null) => {
    setBusy(true); setError('');
    const asked = sessionToken;
    try {
      const result = await saveReceiptEmailOnServer(asked!, email);
      if (!sameSession(asked)) return;
      updateUserProfile(result.user); setDone(email ? 'Receipts will go to this email.' : 'Removed. Receipts go to your sign-in email, or the one you enter at checkout.');
      if (form.open) form.setOpen(false);
      // Remove leaves no button where focus was: keep it on the receipt email's own button.
      else window.setTimeout(() => form.toggle.current?.focus(), 0);
    }
    catch (err) { if (sameSession(asked)) setError(err instanceof Error ? err.message : 'Could not save the receipt email.'); }
    finally { setBusy(false); }
  };
  return <div className="mt-4 rounded-xl border border-slate-800 bg-[#0b1116] p-3">
    <div className="flex items-start gap-2.5">
      <Mail className="mt-0.5 size-4 shrink-0 text-slate-300" aria-hidden />
      <dl className="min-w-0 flex-1">
        <dt className="text-sm font-semibold text-white">Receipt email</dt>
        <dd className="mt-0.5 break-words text-sm text-slate-200">{saved || (user!.email ? <>Your sign-in email</> : <span className="text-slate-400">Not set. You can add one at checkout.</span>)}</dd>
        <dd className="mt-0.5 text-xs text-slate-400">Payment receipts go here. It isn’t used to sign in.</dd>
      </dl>
    </div>
    {done && !form.open && <p role="status" className="mt-2 text-sm text-emerald-300">{done}</p>}
    {!form.open && <div className="mt-2 flex flex-wrap gap-1">
      <button ref={form.toggle} type="button" aria-expanded={false} aria-controls={formId} className={quiet} onClick={() => { setValue(saved ?? ''); setError(''); setDone(''); form.setOpen(true); }}>{saved ? 'Change' : 'Add a receipt email'}</button>
      {/* aria-disabled, not disabled: a disabled button would drop focus to the page while it saves. */}
      {saved && <button type="button" aria-disabled={busy || undefined} className={quiet} onClick={() => { if (!busy) void save(null); }}>Remove</button>}
    </div>}
    {error && !form.open && <p role="alert" className="mt-2 text-sm text-rose-300">{error}</p>}
    {form.open && <form id={formId} className="mt-3 space-y-3" onSubmit={event => { event.preventDefault(); void save(value.trim() || null); }}>
      <label className="block space-y-1 text-sm">Email for receipts<input ref={form.field} type="email" inputMode="email" required maxLength={128} autoComplete="email" className={accountInput} value={value} onChange={e => setValue(e.target.value)} placeholder="you@example.com" /></label>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} className={`${accountButton} w-full`} onClick={() => { setError(''); form.setOpen(false); }}>Cancel</button>
        <button disabled={busy} className={`${primary} w-full`}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>}
  </div>;
}

function Security() {
  const { sessionToken, logoutUser } = useApp();
  const form = useInlineForm();
  const [confirmAll, setConfirmAll] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState('');
  const formId = useId();
  return <div className="space-y-4">
    <div>
      <p className="flex items-center gap-2 text-sm font-semibold text-white"><KeyRound className="size-4 text-slate-300" aria-hidden />Password</p>
      {done && !form.open && <p role="status" className="mt-1 text-sm text-emerald-300">{done}</p>}
      {!form.open
        ? <button ref={form.toggle} type="button" aria-expanded={false} aria-controls={formId} className={`${accountButton} mt-2 w-full sm:w-auto`} onClick={() => { setDone(''); form.setOpen(true); }}>Change password</button>
        : <div id={formId} className="mt-3"><PasswordForm forced={false} firstField={form.field} onCancel={() => form.setOpen(false)} onSaved={() => { setDone('Password changed. Your other devices are signed out.'); form.setOpen(false); }} /></div>}
    </div>
    <div className="border-t border-slate-800 pt-4">
      <p className="text-sm font-semibold text-white">Devices</p>
      <p className="mt-0.5 text-xs text-slate-400">Signing out everywhere ends every session, including this one.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={logoutUser} className={`${accountButton} flex w-full items-center justify-center gap-2`}><LogOut className="size-4" aria-hidden />Sign out</button>
        {!confirmAll && <button type="button" onClick={() => setConfirmAll(true)} className={`${accountButton} w-full`}>Sign out of all devices</button>}
      </div>
      {confirmAll && <div role="group" aria-label="Confirm sign out of all devices" className="mt-3 space-y-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-3">
        <p className="text-sm text-slate-100">Sign out of all devices? This signs out this device too.</p>
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={`${accountButton} w-full`} onClick={() => { setConfirmAll(false); setError(''); }}>Cancel</button>
          <button type="button" disabled={busy} className={`${accountButton} w-full !text-rose-300`} onClick={async () => { setBusy(true); setError(''); try { await revokeOwnSessionsOnServer(sessionToken!); logoutUser(); } catch (err) { setError(err instanceof Error ? err.message : 'Could not sign out devices.'); } finally { setBusy(false); } }}>{busy ? 'Signing out…' : 'Sign out everywhere'}</button>
        </div>
      </div>}
    </div>
  </div>;
}

function Notifications({ children, startOpen }: { children: React.ReactNode; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const panel = useId(), ref = useRef<HTMLDivElement>(null);
  // Arriving from a Notifications link: show the settings straight away.
  useEffect(() => { if (startOpen) ref.current?.scrollIntoView({ block: 'start' }); }, [startOpen]);
  return <div ref={ref}>
    <p className="text-sm text-slate-300">Order updates, Mystery Hub news and offers, and whether this device can receive them.</p>
    <button type="button" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(o => !o)} className={`${accountButton} mt-3 flex w-full items-center justify-between gap-2 sm:w-auto`}>
      {open ? 'Hide notification settings' : 'Notification settings'}<ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
    </button>
    {open && <div id={panel}>{children}</div>}
  </div>;
}

function Rewards() {
  const { user, sessionToken, closeAccount, setActivePage, showToast } = useApp();
  const [code, setCode] = useState<string | null | undefined>(undefined);
  useEffect(() => { let active = true; getMyReferralSummary(sessionToken!).then(result => { if (active) setCode(result.summary?.code ?? null); }).catch(() => { if (active) setCode(null); }); return () => { active = false; }; }, [sessionToken]);
  const copy = async () => {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); showToast('Referral code copied.', 'success'); }
    catch { showToast(`Your referral code is ${code}.`, 'info'); }
  };
  return <>
    <dl className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-slate-800 bg-[#0b1116] p-3">
        <dt className="text-xs text-slate-400">Referral code</dt>
        <dd className="mt-1 flex items-center justify-between gap-2">
          <span className="font-mono text-base text-white">{code === undefined ? 'Loading…' : code ?? 'Unavailable'}</span>
          {code && <button type="button" onClick={() => { void copy(); }} className={`${quiet} inline-flex items-center gap-1.5`} aria-label={`Copy referral code ${code}`}><Copy className="size-4" aria-hidden />Copy</button>}
        </dd>
      </div>
      <div className="rounded-xl border border-slate-800 bg-[#0b1116] p-3">
        <dt className="text-xs text-slate-400">Member since</dt>
        <dd className="mt-1 text-base text-white">{memberSince(user!.createdAt)}</dd>
      </div>
    </dl>
    <button type="button" className={`${accountButton} mt-3 w-full sm:w-auto`} onClick={() => { closeAccount(); setActivePage('earn'); }}>Open Mystery Earn</button>
  </>;
}

export function MyAccountHub({ notifications }: { notifications: React.ReactNode }) {
  const { user, closeAccount, accountSection } = useApp();
  // The phone's Back closes the sheet and only the sheet (its own history entry; see overlayHistory).
  useOverlayHistory('mhAccount', closeAccount);
  const initial = user!.name.trim().charAt(0).toUpperCase() || 'M';
  const secondary = user!.phone ? formatGhanaPhone(user!.phone) : user!.email || '';
  return <SecurityDialog title="My Account" onClose={closeAccount} layout="sheet">
    <div className="space-y-4">
      <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-500/20 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(0,195,101,0.14),transparent_60%)] p-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#00c365]/20 text-lg font-bold text-[#00c365]" aria-hidden="true">{initial}</span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-white">{user!.name}</p>
          {secondary && <p className="truncate text-sm text-slate-300">{secondary}</p>}
          <p className="text-xs text-slate-400">Member since {memberSince(user!.createdAt)}</p>
        </div>
      </div>
      <Section id="details" title="Personal details" Icon={UserRound}><PersonalDetails /></Section>
      <Section id="security" title="Security" Icon={ShieldCheck}><Security /></Section>
      <Section id="notifications" title="Notifications" Icon={Bell}><Notifications startOpen={accountSection === 'notifications'}>{notifications}</Notifications></Section>
      <Section id="rewards" title="Rewards" Icon={Gift}><Rewards /></Section>
    </div>
  </SecurityDialog>;
}
