import React from 'react';
import { accountInput } from './SecurityDialog';

export interface AuthFieldValues {
  name: string;
  identifier: string;
  email: string;
  password: string;
  rememberMe: boolean;
}

type FieldChanges = { [K in keyof AuthFieldValues]: (value: AuthFieldValues[K]) => void };

/** Controlled presentation only. Authentication and validation remain server-authoritative. */
export function AuthFields({ signup, values, changes, busy, error, emailOpen, revealEmail, recover }: {
  signup: boolean;
  values: AuthFieldValues;
  changes: FieldChanges;
  busy: boolean;
  error: string;
  emailOpen: boolean;
  revealEmail: () => void;
  recover: () => void;
}) {
  const description = error ? 'auth-error' : undefined;
  const invalid = error ? true : undefined;
  const inputClass = `${accountInput} mt-1 min-h-11`;
  return <fieldset disabled={busy} className="space-y-3 min-w-0">
    {signup && <label className="block text-sm font-medium" htmlFor="auth-name">
      Name or business name
      <input id="auth-name" className={inputClass} autoComplete="name" required minLength={2} maxLength={128}
        value={values.name} onChange={e => changes.name(e.target.value)} placeholder="Kwame Asante"
        aria-invalid={invalid} aria-describedby={description} />
    </label>}
    <label className="block text-sm font-medium" htmlFor="auth-identifier">
      {signup ? 'Ghana phone number' : 'Phone number or email'}
      <input id="auth-identifier" className={inputClass} type={signup ? 'tel' : 'text'} inputMode={signup ? 'tel' : 'text'}
        autoComplete={signup ? 'tel' : 'username'} autoCapitalize="none" spellCheck={false} required maxLength={128}
        value={values.identifier} onChange={e => changes.identifier(e.target.value)}
        placeholder={signup ? '024 123 4567' : 'Phone number or email'} aria-invalid={invalid} aria-describedby={description} />
    </label>
    {signup && <div>
      {!emailOpen && !values.email
        ? <button type="button" aria-expanded={false} aria-controls="auth-email" onClick={revealEmail}
            className="min-h-11 text-sm text-emerald-300 underline underline-offset-4">Add email (optional)</button>
        : <label className="block text-sm font-medium" htmlFor="auth-email">
            Email (optional)
            <input id="auth-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={128}
              className={inputClass} value={values.email} onChange={e => changes.email(e.target.value)}
              aria-invalid={invalid} aria-describedby={description} placeholder="you@example.com" />
          </label>}
    </div>}
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium" htmlFor="auth-password">Password</label>
        {!signup && <button type="button" onClick={recover} className="min-h-11 text-sm text-emerald-300">Forgot password?</button>}
      </div>
      <input id="auth-password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={8} maxLength={128}
        className={inputClass} value={values.password} onChange={e => changes.password(e.target.value)} aria-invalid={invalid}
        aria-describedby={signup ? 'auth-password-help' + (error ? ' auth-error' : '') : description} />
      {signup && <p id="auth-password-help" className="text-xs text-slate-400 mt-1">At least 8 characters.</p>}
    </div>
    <label className="flex items-center gap-3 min-h-11 text-sm text-slate-300">
      <input type="checkbox" checked={values.rememberMe} onChange={e => changes.rememberMe(e.target.checked)} className="size-4 accent-[#00c365]" />
      Remember this device
    </label>
  </fieldset>;
}
