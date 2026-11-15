import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { changePasswordOnServer } from '../../services/apiClient';
import { accountInput, accountButton } from './SecurityDialog';

/**
 * Change password. `forced` is the restored-account flow (no current password, Sign Out offered). In My Account the
 * form opens on demand and can be cancelled; the server still checks the current password.
 */
export function PasswordForm({ forced, onCancel, onSaved, firstField }: { forced: boolean; onCancel?: () => void; onSaved?: () => void; firstField?: React.Ref<HTMLInputElement> }) {
  const { sessionToken, replaceAuthSession, showToast, logoutUser } = useApp();
  const [currentPassword, setCurrent] = useState(''), [newPassword, setNew] = useState(''), [confirm, setConfirm] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <form className="space-y-4" onSubmit={async event => {
    event.preventDefault(); setError('');
    if (newPassword !== confirm) { setError('The new passwords do not match.'); return; }
    setBusy(true);
    try {
      const result = await changePasswordOnServer(sessionToken!, { newPassword, ...(forced ? {} : { currentPassword }) });
      setCurrent(''); setNew(''); setConfirm(''); replaceAuthSession(result.user, result.token); showToast('Your new password is saved. Other devices have been signed out.', 'success'); onSaved?.();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not change password.'); }
    finally { setBusy(false); }
  }}>
    {forced && <p className="text-sm text-slate-300">Your account was restored using a temporary password. Choose a new password before continuing.</p>}
    {!forced && <label className="block space-y-1 text-sm">Current password<input ref={firstField} type="password" autoComplete="current-password" required maxLength={128} className={accountInput} value={currentPassword} onChange={e => setCurrent(e.target.value)} /></label>}
    <label className="block space-y-1 text-sm">New password<input ref={forced ? firstField : undefined} type="password" autoComplete="new-password" required minLength={8} maxLength={128} className={accountInput} value={newPassword} onChange={e => setNew(e.target.value)} /></label>
    <label className="block space-y-1 text-sm">Confirm new password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} className={accountInput} value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
    <p className="text-xs text-slate-400">Use 8–128 characters and a password you have not used for this account. Saving signs out your other devices.</p>
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    <div className={onCancel ? 'grid grid-cols-2 gap-2' : ''}>
      {onCancel && <button type="button" disabled={busy} className={`${accountButton} w-full`} onClick={onCancel}>Cancel</button>}
      <button disabled={busy} className={`${accountButton} w-full !bg-[#00c365] !text-black`}>{busy ? 'Saving…' : 'Save new password'}</button>
    </div>
    {forced && <button type="button" className={`${accountButton} w-full`} onClick={logoutUser}>Sign Out</button>}
  </form>;
}
