/**
 * Global Frontend Referral URL Capture & Visitor Identification
 * Captures ?ref=CODE across any landing page, generates/persists non-invasive visitor keys,
 * deduplicates requests to prevent API spamming, and preserves referral context for checkout.
 */

import { captureReferralOnServer } from '../services/apiClient';

const STORAGE_KEY_VISITOR = 'mh_visitor_key';
const STORAGE_KEY_REF_CODE = 'mh_referral_code';
const SESSION_KEY_LAST_CAPTURED = 'mh_last_captured_ref';

/**
 * Obtains or generates a stable, non-invasive visitor key for guest attribution
 */
export function getOrGenerateVisitorKey(): string {
  if (typeof window === 'undefined') return '';

  try {
    let key = localStorage.getItem(STORAGE_KEY_VISITOR) || sessionStorage.getItem(STORAGE_KEY_VISITOR);
    if (!key) {
      key = `vk_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem(STORAGE_KEY_VISITOR, key);
      sessionStorage.setItem(STORAGE_KEY_VISITOR, key);
    }
    return key;
  } catch {
    return `vk_transient_${Date.now()}`;
  }
}

/**
 * Retrieves the currently stored referral code from previous visits or current session
 */
export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return sessionStorage.getItem(STORAGE_KEY_REF_CODE) || localStorage.getItem(STORAGE_KEY_REF_CODE) || null;
  } catch {
    return null;
  }
}

/**
 * Stores a verified referral code for future checkouts and account actions
 */
export function setStoredReferralCode(code: string): void {
  if (typeof window === 'undefined' || !code) return;

  const clean = code.trim().toUpperCase();
  try {
    sessionStorage.setItem(STORAGE_KEY_REF_CODE, clean);
    localStorage.setItem(STORAGE_KEY_REF_CODE, clean);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Inspects URL on startup, captures referral attribution, and stores context without redirecting
 */
export async function initReferralCapture(sessionToken?: string | null): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    const searchParams = new URLSearchParams(window.location.search);
    const rawRef = searchParams.get('ref') || searchParams.get('referral');

    if (!rawRef || typeof rawRef !== 'string') {
      return getStoredReferralCode();
    }

    const cleanCode = rawRef.trim().toUpperCase();
    if (cleanCode.length < 3 || cleanCode.length > 32) {
      return getStoredReferralCode();
    }

    // Always store client-side for checkout use
    setStoredReferralCode(cleanCode);

    // Deduplicate API calls within this browser session
    const lastCaptured = sessionStorage.getItem(SESSION_KEY_LAST_CAPTURED);
    if (lastCaptured === cleanCode) {
      return cleanCode;
    }

    const visitorKey = getOrGenerateVisitorKey();
    const landingPath = window.location.pathname + window.location.search;

    // Dispatch non-blocking capture to server
    const res = await captureReferralOnServer(
      {
        code: cleanCode,
        visitorKey,
        landingPath: landingPath.slice(0, 250),
      },
      sessionToken || undefined
    );

    if (res && res.valid) {
      sessionStorage.setItem(SESSION_KEY_LAST_CAPTURED, cleanCode);
    }

    return cleanCode;
  } catch (err) {
    // Never allow referral tracking to disrupt normal app initialization
    console.warn('[Referral Capture] Handled non-fatal tracking error:', err);
    return getStoredReferralCode();
  }
}
