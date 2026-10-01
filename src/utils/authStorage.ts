/**
 * Safe Session Token Storage Resolver
 *
 * Discovers active authentication tokens across persistent (rememberMe=true -> localStorage)
 * and session-scoped (rememberMe=false -> sessionStorage) storage layers.
 */

export const SESSION_TOKEN_STORAGE_KEY = 'mystery_hub_session_token';
export const USER_PROFILE_STORAGE_KEY = 'mystery_hub_user';

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
