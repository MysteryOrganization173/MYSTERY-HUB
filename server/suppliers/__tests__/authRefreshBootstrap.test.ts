import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { AppProvider, useApp } from '../../../src/context/AppContext';
import { AccountControls } from '../../../src/components/auth/AccountControls';
import { readAuthBootstrap, SESSION_TOKEN_STORAGE_KEY as tokenKey, USER_PROFILE_STORAGE_KEY as userKey } from '../../../src/utils/authStorage';

const profile = { id: 'customer', name: 'Cached Customer', email: 'customer@example.com', phone: null, role: 'customer', status: 'active', createdAt: '2026-01-01T00:00:00Z', lastLoginAt: null, mustChangePassword: false, passwordChangedAt: null };
const original = Object.fromEntries(['window', 'localStorage', 'sessionStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
function storage() { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }; }
let persistent: ReturnType<typeof storage>, session: ReturnType<typeof storage>;
beforeEach(() => {
  persistent = storage(); session = storage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: persistent });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { pathname: '/' } } });
});
after(() => { for (const [key, descriptor] of Object.entries(original)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as any)[key]; } });
function save(value: unknown = profile, target = persistent) { target.setItem(tokenKey, 'stored-token'); target.setItem(userKey, JSON.stringify(value)); }
function Identity() { const { user, isAuthChecking } = useApp(); return React.createElement('span', null, user?.name ?? 'Guest', isAuthChecking ? ':loading' : ':ready'); }
function render() { return renderToStaticMarkup(React.createElement(AppProvider, null, React.createElement(Identity), React.createElement(AccountControls))); }

test('saved identity renders immediately without Checking Session dialog', () => { save(); const html = render(); assert.match(html, /Cached Customer:ready/); assert.doesNotMatch(html, /Checking your session|Please wait/); });
test('repeated refresh bootstrap never flashes a dialog for a cached customer', () => { save(); for (let i = 0; i < 4; i++) assert.doesNotMatch(render(), /role="dialog"/); });
test('session-scoped login has the same non-blocking refresh behavior', () => { save(profile, session); assert.match(render(), /Cached Customer:ready/); });
test('token without profile renders no member identity and uses safe loading', () => { persistent.setItem(tokenKey, 'stored-token'); const html = render(); assert.match(html, /Guest:loading/); assert.match(html, /Checking your session/); });
test('corrupt JSON uses safe loading', () => { save(); persistent.setItem(userKey, '{broken'); assert.match(render(), /Guest:loading/); });
test('structurally invalid cache cannot establish identity', () => { for (const value of [[], {}, { ...profile, mustChangePassword: 'false' }, { ...profile, status: 'disabled' }]) { save(value); assert.equal(readAuthBootstrap().user, null); } });
test('cached forced change immediately shows mandatory password flow', () => { save({ ...profile, mustChangePassword: true }); const html = render(); assert.match(html, /Create a new password/); assert.match(html, /temporary password/); assert.doesNotMatch(html, /Checking your session/); });
test('server-refreshed forced-change profile opens the mandatory flow on next render', () => { save(); assert.doesNotMatch(render(), /Create a new password/); save({ ...profile, mustChangePassword: true }); assert.match(render(), /Create a new password/); });
test('guest sees no session modal; orphan cached profile is ignored', () => { persistent.setItem(userKey, JSON.stringify(profile)); assert.match(render(), /Guest:ready/); assert.doesNotMatch(render(), /role="dialog"/); });
test('profiles cannot be mixed between persistent and session token layers', () => { save(profile, session); persistent.setItem(tokenKey, 'other-token'); assert.equal(readAuthBootstrap().user, null); });
test('cache profile allowlist excludes password hashes and tokens', () => { save({ ...profile, password_hash: 'forbidden', token: 'forbidden' }); assert.deepEqual(readAuthBootstrap().user, profile); });
test('refresh validation, revocation handling and periodic/focus checks remain wired', () => {
  const code = readFileSync('src/context/AppContext.tsx', 'utf8');
  assert.match(code, /await getMeOnServer\(sessionToken\)/);
  assert.match(code, /if \(active\) updateUserProfile\(result.user\)/);
  assert.match(code, /\[401, 403\].includes[\s\S]*?clearLocalAuth\(\)/);
  assert.match(code, /setUser\(null\); setSessionToken\(null\)/);
  assert.match(code, /setInterval\(refresh, 30_000\)/);
  assert.match(code, /addEventListener\('focus', refresh\)/);
  assert.match(code, /mystery-auth-invalid/);
  assert.doesNotMatch(code, /setIsAuthChecking\(true\)/);
});
