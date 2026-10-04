import type { PoolClient } from 'pg';
import { AuthStore } from '../db/authStore.js';
import { AdminAuditStore } from '../db/adminAuditStore.js';
import { UserRecord, toSafeUserProfile } from '../types/auth.js';
import { generateSessionToken, generateTemporaryPassword, hashPassword, hashSessionToken, verifyPassword } from '../utils/crypto.js';
import { normalizeEmail, normalizeGhanaPhoneIdentifier, validatePassword } from '../utils/authValidation.js';

export class AccountError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

export function identifierConflict(error: unknown): AccountError | null {
  const value = error as { code?: string; constraint?: string };
  if (value?.code !== '23505') return null;
  const field = value.constraint?.includes('phone') ? 'phone number' : value.constraint?.includes('email') ? 'email address' : 'sign-in detail';
  return new AccountError(409, `This ${field} is already linked to another Mystery Hub account.`, 'IDENTIFIER_CONFLICT');
}

function customerTarget(user: UserRecord | null, adminId: string): UserRecord {
  if (!user) throw new AccountError(404, 'Customer account not found.');
  if (user.role !== 'customer' || user.id === adminId) throw new AccountError(403, 'This control is only available for customer accounts.');
  return { ...user };
}

async function activeSession(user: UserRecord | null, token: string, client?: PoolClient): Promise<UserRecord> {
  if (!user) throw new AccountError(401, 'Please log in again.');
  if (user.status !== 'active') throw new AccountError(403, 'Your account has been disabled. Please contact support.');
  // Recheck inside the row lock: a reset/revoke may have won the race after middleware.
  const valid = client
    ? (await client.query('SELECT id FROM sessions WHERE user_id=$1 AND token_hash=$2 AND expires_at > NOW();', [user.id, hashSessionToken(token)])).rows.length > 0
    : Boolean(await AuthStore.findSessionByToken(token));
  if (!valid) throw new AccountError(401, 'Your session ended. Please log in again.');
  return { ...user };
}

export async function loginAccount(identifier: string, password: string, rememberMe: boolean) {
  const candidate = await AuthStore.findUserByIdentifier(identifier);
  if (!candidate) throw new AccountError(401, 'Invalid credentials. Please check your phone/email and password.');
  return AuthStore.withLockedUser(candidate.id, async (record, client) => {
    if (!record || !(await verifyPassword(password, record.password_hash))) throw new AccountError(401, 'Invalid credentials. Please check your phone/email and password.');
    if (record.status !== 'active') throw new AccountError(403, 'Your account has been disabled. Please contact support.');
    const user = { ...record, last_login_at: new Date().toISOString() };
    if (client) await client.query('UPDATE users SET last_login_at=$2, updated_at=$2 WHERE id=$1;', [user.id, user.last_login_at]);
    else await AuthStore.updateUserLastLogin(user.id);
    const token = generateSessionToken();
    const session = await AuthStore.createSession(user.id, token, rememberMe, client);
    return { success: true, user: toSafeUserProfile(user), token, expiresAt: session.expires_at };
  });
}

export async function resetCustomerPassword(adminId: string, id: string) {
  return AuthStore.withLockedUser(id, async (record, client) => {
    const user = customerTarget(record, adminId);
    const temporaryPassword = generateTemporaryPassword();
    user.password_hash = await hashPassword(temporaryPassword);
    user.must_change_password = true;
    user.password_changed_at = new Date().toISOString();
    const updated = await AuthStore.saveAccount(user, client);
    await AuthStore.revokeAllUserSessions(id, client);
    await AdminAuditStore.record({ adminUserId: adminId, action: 'customer_password_reset', entityType: 'user', entityId: id, metadata: { sessionsRevoked: true } }, client);
    return { success: true, temporaryPassword, mustChangePassword: true, user: toSafeUserProfile(updated), message: 'Temporary password created. Existing sessions were revoked.' };
  });
}

export async function changeAccountPassword(id: string, token: string, body: Record<string, unknown>) {
  const validation = validatePassword(body.newPassword);
  if (!validation.isValid) throw new AccountError(400, validation.error!);
  return AuthStore.withLockedUser(id, async (record, client) => {
    const user = await activeSession(record, token, client);
    if (!user.must_change_password && (typeof body.currentPassword !== 'string' || body.currentPassword.length > 128 || !(await verifyPassword(body.currentPassword, user.password_hash)))) {
      throw new AccountError(400, 'Your current password is incorrect.');
    }
    if (await verifyPassword(body.newPassword as string, user.password_hash)) throw new AccountError(400, 'Choose a different new password.');
    user.password_hash = await hashPassword(body.newPassword as string);
    user.must_change_password = false;
    user.password_changed_at = new Date().toISOString();
    const updated = await AuthStore.saveAccount(user, client);
    await AuthStore.revokeAllUserSessions(id, client);
    // A replacement session has a conservative 24-hour lifetime; storage choice remains unchanged.
    const newToken = generateSessionToken();
    const session = await AuthStore.createSession(id, newToken, false, client);
    return { success: true, user: toSafeUserProfile(updated), token: newToken, expiresAt: session.expires_at };
  });
}

function parseProfile(user: UserRecord, body: Record<string, unknown>) {
  const updated = { ...user };
  if (!['name', 'email', 'phone'].some(field => Object.hasOwn(body, field))) throw new AccountError(400, 'Provide a profile field to update.');
  if (Object.hasOwn(body, 'name')) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 128) throw new AccountError(400, 'Name must be between 2 and 128 characters.');
    updated.name = body.name.trim();
  }
  for (const field of ['email', 'phone'] as const) {
    if (!Object.hasOwn(body, field)) continue;
    const raw = body[field];
    if (raw !== null && typeof raw !== 'string') throw new AccountError(400, `Invalid account ${field}.`);
    const empty = raw === null || (raw as string).trim() === '';
    const normalized = empty ? null : field === 'email' ? normalizeEmail(raw) : normalizeGhanaPhoneIdentifier(raw);
    if (!empty && !normalized) throw new AccountError(400, field === 'phone' ? 'Enter a valid Ghana phone number.' : 'Enter a valid email address.');
    updated[field] = normalized;
  }
  if (!updated.email && !updated.phone) throw new AccountError(400, 'Keep at least one account email or phone for sign-in.');
  const changedFields = (['name', 'email', 'phone'] as const).filter(field => updated[field] !== user[field]);
  return { updated, changedFields };
}

export async function updateAccountProfile(id: string, body: Record<string, unknown>, access: { token: string } | { adminId: string }) {
  try {
    return await AuthStore.withLockedUser(id, async (record, client) => {
      const user = 'adminId' in access ? customerTarget(record, access.adminId) : await activeSession(record, access.token, client);
      if (!('adminId' in access) && user.must_change_password) throw new AccountError(403, 'Create a new password before continuing.', 'PASSWORD_CHANGE_REQUIRED');
      const { updated, changedFields } = parseProfile(user, body);
      const sensitive = changedFields.some(field => field === 'email' || field === 'phone');
      if (!('adminId' in access) && sensitive && (typeof body.currentPassword !== 'string' || body.currentPassword.length > 128 || !(await verifyPassword(body.currentPassword, user.password_hash)))) {
        throw new AccountError(400, 'Confirm your current password to change sign-in details.');
      }
      // Include legacy Ghana variants in the friendly precheck; SQL unique indexes remain authoritative.
      for (const field of ['email', 'phone'] as const) {
        if (!updated[field] || !changedFields.includes(field)) continue;
        const other = await AuthStore.findUserByIdentifier(updated[field]!);
        if (other && other.id !== id) throw new AccountError(409, `This ${field === 'phone' ? 'phone number' : 'email address'} is already linked to another Mystery Hub account.`, 'IDENTIFIER_CONFLICT');
      }
      const saved = await AuthStore.saveAccount(updated, client);
      if ('adminId' in access) {
        // Correcting sign-in details invalidates customer devices; admin must authenticate ownership out of band.
        if (sensitive) await AuthStore.revokeAllUserSessions(id, client);
        await AdminAuditStore.record({ adminUserId: access.adminId, action: 'customer_profile_updated', entityType: 'user', entityId: id, metadata: { changedFields, sessionsRevoked: sensitive } }, client);
      }
      return { success: true, user: toSafeUserProfile(saved) };
    });
  } catch (error) { throw identifierConflict(error) ?? error; }
}

export async function revokeAccountSessions(id: string, access: { token: string } | { adminId: string }) {
  return AuthStore.withLockedUser(id, async (record, client) => {
    if ('adminId' in access) customerTarget(record, access.adminId);
    else await activeSession(record, access.token, client);
    await AuthStore.revokeAllUserSessions(id, client);
    if ('adminId' in access) await AdminAuditStore.record({ adminUserId: access.adminId, action: 'customer_sessions_revoked', entityType: 'user', entityId: id }, client);
    return { success: true, message: 'All devices have been signed out.' };
  });
}
