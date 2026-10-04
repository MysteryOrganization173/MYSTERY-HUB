import React, { useEffect, useRef, useState } from 'react';
import type { SafeUserProfile } from '../../../../server/types/auth';
import { resetAdminCustomerPassword, revokeAdminCustomerSessions, updateAdminCustomerProfile } from '../../../services/apiClient';
import { SecurityDialog, accountButton, accountInput } from '../../auth/SecurityDialog';

type Action = 'reset' | 'revoke' | 'edit';
function CustomerAction({ action, user, token, onClose, onUpdate }: {
  action: Action; user: SafeUserProfile; token: string; onClose: () => void; onUpdate: (user: SafeUserProfile) => void;
}) {
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [name, setName] = useState(user.name), [email, setEmail] = useState(user.email ?? ''), [phone, setPhone] = useState(user.phone ?? '');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const close = () => { alive.current = false; setTemporaryPassword(null); onClose(); };
  const submit = async () => {
    setBusy(true); setError('');
    try {
      if (action === 'reset') {
        const result = await resetAdminCustomerPassword(token, user.id);
        if (alive.current) { setTemporaryPassword(result.temporaryPassword); onUpdate(result.user); }
      } else if (action === 'revoke') {
        await revokeAdminCustomerSessions(token, user.id); if (alive.current) close();
      } else {
        const result = await updateAdminCustomerProfile(token, user.id, { name, email, phone });
        if (alive.current) { onUpdate(result.user); close(); }
      }
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'Could not complete the action.'); }
    finally { if (alive.current) setBusy(false); }
  };
  return <SecurityDialog title={action === 'reset' ? 'Reset Customer Password' : action === 'revoke' ? 'Revoke Customer Sessions' : 'Edit Account Details'} onClose={close}>
    {temporaryPassword ? <div className="space-y-4">
      <label className="block text-sm">Temporary Password<input readOnly autoComplete="off" className={`${accountInput} font-mono`} value={temporaryPassword} /></label>
      <button className={accountButton} onClick={async () => { try { await navigator.clipboard.writeText(temporaryPassword); if (alive.current) setCopied(true); } catch { if (alive.current) setError('Copy is unavailable. Select the password and copy it manually.'); } }}>{copied ? 'Copied' : 'Copy temporary password'}</button>
      <p className="text-sm text-amber-200">This password is shown once. Send it securely to the customer. Mystery Hub does not store the readable password.</p>
      <p className="text-sm text-slate-300">All sessions were revoked. The customer must create a new password after login.</p>
      <button className={accountButton} onClick={close}>Done</button>
    </div> : <form className="space-y-4" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <p className="break-words text-sm text-slate-400">Customer: {user.name} · {user.id}</p>
      {action === 'reset' ? <><p className="text-sm">The current password will stop working. All active sessions will be signed out. A temporary password will be generated, and the customer must change it after login.</p><p className="text-sm text-amber-200">Confirm the customer's identity through your support process before restoring access. A matching name alone is not proof of ownership.</p></> : action === 'revoke' ? <p className="text-sm">Sign out all customer devices. Orders, websites and Mystery Earn records will remain intact.</p> : <>
        <label className="block text-sm">Full Name<input required minLength={2} maxLength={128} value={name} onChange={e => setName(e.target.value)} className={accountInput} /></label>
        <label className="block text-sm">Account email<input type="email" maxLength={128} value={email} onChange={e => setEmail(e.target.value)} className={accountInput} /></label>
        <label className="block text-sm">Account phone<input type="tel" maxLength={32} value={phone} onChange={e => setPhone(e.target.value)} className={accountInput} /></label>
        <p className="text-xs text-slate-400">Keep at least one sign-in detail. Confirm identity before changing contacts. Contact changes sign out all customer devices.</p>
      </>}
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className={accountButton} onClick={close}>Cancel</button><button disabled={busy} className={`${accountButton} ${action === 'reset' ? '!border-amber-600 !text-amber-200' : ''}`}>{busy ? 'Working…' : action === 'reset' ? 'RESET CUSTOMER PASSWORD' : action === 'revoke' ? 'Confirm revoke sessions' : 'Save account details'}</button></div>
    </form>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
  </SecurityDialog>;
}

export function AdminCustomerSecurity({ user, token, adminId, onUpdate, onStatusToggle }: {
  user: SafeUserProfile; token: string; adminId: string; onUpdate: (user: SafeUserProfile) => void; onStatusToggle: () => void;
}) {
  const [action, setAction] = useState<Action | null>(null);
  return <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
    <h4 className="font-bold text-white">Security &amp; Access</h4>
    <p className="break-words">User ID: {user.id} · Status: {user.status}</p>
    <p>Last Login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</p>
    <p>Password Changed At: {user.passwordChangedAt ? new Date(user.passwordChangedAt).toLocaleString() : 'Not recorded'}</p>
    <p>Must Change Password: {user.mustChangePassword ? 'Yes' : 'No'}</p>
    {user.role === 'customer' && user.id !== adminId && <div className="flex flex-wrap gap-2"><button className={accountButton} onClick={() => setAction('reset')}>Reset Password</button><button className={accountButton} onClick={() => setAction('revoke')}>Revoke Sessions</button><button className={accountButton} onClick={() => setAction('edit')}>Edit Account Details</button><button className={`${accountButton} !text-amber-200`} onClick={onStatusToggle}>{user.status === 'active' ? 'Disable Account' : 'Enable Account'}</button></div>}
    {action && <CustomerAction key={`${user.id}:${action}`} action={action} user={user} token={token} onClose={() => setAction(null)} onUpdate={onUpdate} />}
  </section>;
}
