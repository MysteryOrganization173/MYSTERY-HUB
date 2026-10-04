/**
 * Safe Session Token Storage Resolver
 *
 * Discovers active authentication tokens across persistent (rememberMe=true -> localStorage)
 * and session-scoped (rememberMe=false -> sessionStorage) storage layers.
 */

export const SESSION_TOKEN_STORAGE_KEY = 'mystery_hub_session_token';
export const USER_PROFILE_STORAGE_KEY = 'mystery_hub_user';

/** Cached identity is presentation only; every protected API still validates the token. */
export function readAuthBootstrap(): { token: string | null; user: import('../../server/types/auth').SafeUserProfile | null } {
  if (typeof window === 'undefined') return { token: null, user: null };
  let token: string | null = null;
  try {
    // Resolve the profile from the same storage layer as its token.
    const storage = localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) ? localStorage : sessionStorage;
    token = storage.getItem(SESSION_TOKEN_STORAGE_KEY);
    if (!token) return { token: null, user: null };
    const value = JSON.parse(storage.getItem(USER_PROFILE_STORAGE_KEY) || 'null');
    const nullableString = (field: unknown) => field === null || typeof field === 'string';
    if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !value.id ||
        typeof value.name !== 'string' || !value.name ||
        !['customer', 'admin'].includes(value.role) || value.status !== 'active' ||
        typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) ||
        typeof value.mustChangePassword !== 'boolean' ||
        ![value.email, value.phone, value.lastLoginAt, value.passwordChangedAt].every(nullableString)) {
      return { token, user: null };
    }
    // Explicit allowlist prevents accidental sensitive fields from entering UI state.
    return { token, user: {
      id: value.id, name: value.name, email: value.email, phone: value.phone,
      role: value.role, status: value.status, createdAt: value.createdAt,
      lastLoginAt: value.lastLoginAt, mustChangePassword: value.mustChangePassword,
      passwordChangedAt: value.passwordChangedAt,
    } };
  } catch { return { token, user: null }; }
}

export function getActiveSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return (
      localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) ||
      sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY) ||
      null
    );
  } catch {
    return null;
  }
}
