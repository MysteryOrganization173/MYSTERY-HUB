import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { changePasswordOnServer, updateProfileOnServer, revokeOwnSessionsOnServer, getMyReferralSummary } from '../../services/apiClient';
import { SecurityDialog, accountInput, accountButton } from './SecurityDialog';

function PasswordForm({ forced }: { forced: boolean }) {
  const { sessionToken, replaceAuthSession, showToast, logoutUser } = useApp();
  const [currentPassword, setCurrent] = useState(''), [newPassword, setNew] = useState(''), [confirm, setConfirm] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <form className="space-y-4" onSubmit={async event => {
    event.preventDefault(); setError('');
    if (newPassword !== confirm) { setError('The new passwords do not match.'); return; }
    setBusy(true);
    try {
      const result = await changePasswordOnServer(sessionToken!, { newPassword, ...(forced ? {} : { currentPassword }) });
      setCurrent(''); setNew(''); setConfirm(''); replaceAuthSession(result.user, result.token); showToast('Your new password is saved. Other devices have been signed out.', 'success');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not change password.'); }
    finally { setBusy(false); }
  }}>
    {forced && <p className="text-sm text-slate-300">Your account was restored using a temporary password. Choose a new password before continuing.</p>}
    {!forced && <label className="block space-y-1 text-sm">Current Password<input type="password" autoComplete="current-password" required maxLength={128} className={accountInput} value={currentPassword} onChange={e => setCurrent(e.target.value)} /></label>}
    <label className="block space-y-1 text-sm">New Password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} className={accountInput} value={newPassword} onChange={e => setNew(e.target.value)} /></label>
    <label className="block space-y-1 text-sm">Confirm New Password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} className={accountInput} value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
    <p className="text-xs text-slate-400">Use 8–128 characters and a password you have not used for this account.</p>
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    <button disabled={busy} className={`${accountButton} w-full !bg-[#00c365] !text-black`}>{busy ? 'Saving…' : 'Save new password'}</button>
    {forced && <button type="button" className={`${accountButton} w-full`} onClick={logoutUser}>Sign Out</button>}
  </form>;
}

function MyAccount() {
  const { user, sessionToken, updateUserProfile, closeAccount, logoutUser, showToast } = useApp();
  const [name, setName] = useState(user!.name), [email, setEmail] = useState(user!.email ?? ''), [phone, setPhone] = useState(user!.phone ?? '');
  const [currentPassword, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null), [confirmSignOut, setConfirmSignOut] = useState(false);
  useEffect(() => { let active = true; getMyReferralSummary(sessionToken!).then(result => { if (active) setCode(result.summary?.code ?? null); }).catch(() => {}); return () => { active = false; }; }, [sessionToken]);
  const identifiersChanged = email.trim().toLowerCase() !== (user!.email ?? '') || phone.trim() !== (user!.phone ?? '');
  return <SecurityDialog title="My Account" onClose={closeAccount}>
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('');
      try { const result = await updateProfileOnServer(sessionToken!, { name, email, phone, ...(identifiersChanged ? { currentPassword } : {}) }); updateUserProfile(result.user); setName(result.user.name); setEmail(result.user.email ?? ''); setPhone(result.user.phone ?? ''); setPassword(''); showToast('Account details saved.', 'success'); }
      catch (err) { setError(err instanceof Error ? err.message : 'Could not save account.'); } finally { setBusy(false); }
    }}>
      <h3 className="font-bold">Profile</h3>
      <label className="block text-sm">Full Name<input required minLength={2} maxLength={128} className={accountInput} value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
      <label className="block text-sm">Account email<input type="email" maxLength={128} className={accountInput} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
      <label className="block text-sm">Account phone<input type="tel" maxLength={32} className={accountInput} value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" /></label>
      <p className="text-xs text-slate-400">Keep at least one sign-in detail. Email is useful for receipts and Wallet top-ups; adding it does not replace your phone sign-in. These contacts have not been verified by email or SMS.</p>
      {identifiersChanged && <label className="block text-sm">Confirm current password<input type="password" required maxLength={128} autoComplete="current-password" className={accountInput} value={currentPassword} onChange={e => setPassword(e.target.value)} /></label>}
      <p className="break-words text-sm">Referral Code: <span className="font-mono">{code ?? 'Unavailable'}</span></p>
      <p className="text-sm">Member Since: {new Date(user!.createdAt).toLocaleDateString()}</p>
      {error && <p role="alert" className="text-rose-300 text-sm">{error}</p>}
      <button disabled={busy} className={accountButton}>{busy ? 'Saving…' : 'Save profile'}</button>
    </form>
    <section className="mt-6 border-t border-slate-700 pt-4 space-y-4"><h3 className="font-bold">Security · Change Password</h3><PasswordForm forced={false} />
      <button onClick={logoutUser} className={`${accountButton} w-full`}>Sign Out</button>
      {!confirmSignOut ? <button onClick={() => setConfirmSignOut(true)} className={`${accountButton} w-full`}>Sign out of all devices</button> : <div className="space-y-2"><p className="text-sm">This signs out this device too.</p><button disabled={busy} className={`${accountButton} w-full !text-rose-300`} onClick={async () => { setBusy(true); try { await revokeOwnSessionsOnServer(sessionToken!); logoutUser(); } catch (err) { setError(err instanceof Error ? err.message : 'Could not sign out devices.'); } finally { setBusy(false); } }}>Confirm sign out of all devices</button><button className={accountButton} onClick={() => setConfirmSignOut(false)}>Cancel</button></div>}
    </section>
  </SecurityDialog>;
}

export function AccountControls() {
  const { user, isAccountOpen, isAuthChecking } = useApp();
  if (user?.mustChangePassword) return <SecurityDialog title="Create a new password" mandatory><PasswordForm forced /></SecurityDialog>;
  if (isAuthChecking) return <SecurityDialog title="Checking your session" mandatory><p>Please wait…</p></SecurityDialog>;
  return user && isAccountOpen ? <MyAccount key={user.id} /> : null;
}
