import assert from 'node:assert/strict';
import { test, before, beforeEach, after } from 'node:test';
import pg from 'pg';
import { AuthStore } from '../../db/authStore.js';
import { initDatabase } from '../../db/connection.js';
import { resetCustomerPassword, changeAccountPassword, updateAccountProfile, loginAccount } from '../../services/accountSecurity.js';
import { hashPassword, hashSessionToken, verifyPassword } from '../../utils/crypto.js';
import { toSafeUserProfile, UserRecord } from '../../types/auth.js';

const originalConnect = pg.Pool.prototype.connect, originalQuery = pg.Pool.prototype.query;
let user: UserRecord, sessions: Map<string, string>, audits: unknown[][], statements: string[], oldHash: string;
let failAudit = false, conflict = false, lockTail = Promise.resolve();
async function query(sql: string, args: any[] = []) {
  statements.push(sql);
  if (sql === 'SELECT * FROM users WHERE id = $1 FOR UPDATE;') return { rows: [structuredClone(user)] };
  if (sql.includes('SELECT * FROM users')) return { rows: sql.includes('LOWER(email)') && args[0] !== user.email ? [] : [structuredClone(user)] };
  if (sql.startsWith('UPDATE users SET name=')) {
    if (conflict) throw Object.assign(new Error('PostgreSQL internal detail'), { code: '23505', constraint: 'idx_users_email_unique' });
    [user.name, user.email, user.phone, user.password_hash, user.must_change_password, user.password_changed_at, user.updated_at] = args.slice(1);
    return { rows: [structuredClone(user)] };
  }
  if (sql.startsWith('UPDATE users SET last_login')) return { rows: [] };
  if (sql.includes('SELECT id FROM sessions')) return { rows: sessions.has(args[1]) ? [{ id: 'valid' }] : [] };
  if (sql.includes('DELETE FROM sessions')) { sessions.clear(); return { rows: [] }; }
  if (sql.includes('INSERT INTO sessions')) { sessions.set(args[2], args[1]); return { rows: [{ id: args[0], user_id: args[1], token_hash: args[2], created_at: args[3], expires_at: args[4], last_seen_at: args[5] }] }; }
  if (sql.includes('INSERT INTO admin_audit_log')) { if (failAudit) throw new Error('Audit write failed'); audits.push(args); return { rows: [{ id: args[0] }] }; }
  if (sql.includes('FROM sessions s')) {
    if (!sessions.has(args[0])) return { rows: [] };
    return { rows: [{ id: 'session', user_id: user.id, token_hash: args[0], expires_at: new Date(Date.now() + 10000).toISOString(), u_id: user.id, u_name: user.name, u_email: user.email, u_phone: user.phone, u_password_hash: user.password_hash, u_role: user.role, u_status: user.status, u_created_at: user.created_at, u_updated_at: user.updated_at, u_last_login_at: user.last_login_at, u_must_change_password: user.must_change_password, u_password_changed_at: user.password_changed_at }] };
  }
  return { rows: [], rowCount: 0 };
}
before(async () => {
  process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = 'postgresql://fixture.invalid/never-contacted'; oldHash = await hashPassword('OriginalPassword123');
  pg.Pool.prototype.query = query as any;
  pg.Pool.prototype.connect = (async () => {
    let releaseLock: (() => void) | undefined, snapshot: { user: UserRecord; sessions: Map<string, string>; audits: unknown[][] } | undefined;
    return { release() {}, async query(sql: string, args: any[] = []) {
      if (sql.includes('FOR UPDATE')) { const previous = lockTail; lockTail = new Promise<void>(resolve => { releaseLock = resolve; }); await previous; snapshot = { user: structuredClone(user), sessions: new Map(sessions), audits: [...audits] }; }
      if (sql === 'ROLLBACK' && snapshot) { user = snapshot.user; sessions = snapshot.sessions; audits = snapshot.audits; }
      const result = await query(sql, args);
      if (sql === 'COMMIT' || sql === 'ROLLBACK') releaseLock?.();
      return result;
    } };
  }) as any;
});
beforeEach(() => {
  const at = new Date().toISOString();
  user = { id: 'customer', name: 'Customer', email: 'customer@example.com', phone: null, role: 'customer', status: 'active', password_hash: oldHash, must_change_password: false, password_changed_at: null, created_at: at, updated_at: at, last_login_at: null };
  sessions = new Map([[hashSessionToken('old-token'), user.id]]); audits = []; statements = []; failAudit = false; conflict = false; lockTail = Promise.resolve();
});
after(() => { pg.Pool.prototype.connect = originalConnect; pg.Pool.prototype.query = originalQuery; delete process.env.DATABASE_URL; });
test('reset SQL transaction writes only hash, revokes sessions and audits before committing', async () => {
  const result = await resetCustomerPassword('admin', user.id);
  assert.ok(await verifyPassword(result.temporaryPassword, user.password_hash)); assert.equal(user.must_change_password, true); assert.equal(sessions.size, 0);
  assert.ok(statements.indexOf('COMMIT') > statements.findIndex(sql => sql.includes('INSERT INTO admin_audit_log')));
  assert.ok(!JSON.stringify(audits).includes(result.temporaryPassword)); assert.ok(statements.some(sql => sql.includes('FOR UPDATE')));
});
test('audit failure rolls back password and session revocation', async () => {
  failAudit = true; await assert.rejects(resetCustomerPassword('admin', user.id));
  assert.equal(user.password_hash, oldHash); assert.equal(user.must_change_password, false); assert.equal(sessions.size, 1); assert.ok(statements.includes('ROLLBACK')); assert.ok(!statements.includes('COMMIT'));
});
test('normal password change atomically rotates session and timestamp', async () => {
  const result = await changeAccountPassword(user.id, 'old-token', { currentPassword: 'OriginalPassword123', newPassword: 'PermanentPassword123' });
  assert.ok(await verifyPassword('PermanentPassword123', user.password_hash)); assert.ok(user.password_changed_at); assert.equal(sessions.has(hashSessionToken('old-token')), false); assert.equal(sessions.has(hashSessionToken(result.token)), true); assert.equal(sessions.size, 1);
});
test('SQL concurrency rejects a second change from the revoked session', async () => {
  const results = await Promise.allSettled([changeAccountPassword(user.id, 'old-token', { currentPassword: 'OriginalPassword123', newPassword: 'PermanentPassword123' }), changeAccountPassword(user.id, 'old-token', { currentPassword: 'OriginalPassword123', newPassword: 'AnotherPassword123' })]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1); assert.equal(sessions.size, 1);
});
test('SQL uniqueness conflict returns safe 409 and rolls back contacts', async () => {
  conflict = true; await assert.rejects(updateAccountProfile(user.id, { email: 'other@example.com' }, { adminId: 'admin' }), (error: any) => error.status === 409 && !error.message.includes('PostgreSQL'));
  assert.equal(user.email, 'customer@example.com'); assert.ok(statements.includes('ROLLBACK')); assert.equal(audits.length, 0);
});
test('admin identifier correction revokes sessions and commits safe changed-fields audit', async () => {
  await updateAccountProfile(user.id, { email: 'other@example.com' }, { adminId: 'admin' }); assert.equal(user.email, 'other@example.com'); assert.equal(sessions.size, 0); assert.deepEqual(JSON.parse(audits[0][5] as string).changedFields, ['email']);
});
test('PostgreSQL session join maps required-change flag into explicit safe profile', async () => {
  user.must_change_password = true; const resolved = await AuthStore.findSessionByToken('old-token'); assert.equal(toSafeUserProfile(resolved!.user).mustChangePassword, true); assert.equal((toSafeUserProfile(resolved!.user) as any).password_hash, undefined);
});
test('concurrent login/reset never leaves an old-password session alive', async () => {
  const [auth, reset] = await Promise.allSettled([loginAccount(user.email!, 'OriginalPassword123', false), resetCustomerPassword('admin', user.id)]);
  assert.equal(reset.status, 'fulfilled');
  if (auth.status === 'fulfilled') assert.equal(sessions.has(hashSessionToken(auth.value.token)), false);
  else assert.equal(auth.reason.status, 401);
  assert.equal(user.must_change_password, true); assert.equal(sessions.size, 0);
});
test('schema initialization includes repeatable non-destructive account columns', async () => {
  await initDatabase(); await initDatabase();
  assert.equal(statements.filter(sql => sql.includes('ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE')).length, 2);
  assert.equal(statements.filter(sql => sql.includes('ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NULL')).length, 2);
  assert.ok(!statements.some(sql => /UPDATE users SET password_hash/.test(sql)));
});
