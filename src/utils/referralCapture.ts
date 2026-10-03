/**
 * Global Frontend Referral URL Capture & Visitor Identification
 * Captures ?ref=CODE across any landing page, generates/persists non-invasive visitor keys,
 * deduplicates requests to prevent API spamming, and preserves referral context for checkout.
 */

import { captureReferralOnServer } from '../services/apiClient';

const STORAGE_KEY_VISITOR = 'mh_visitor_key';
const STORAGE_KEY_REF_CODE = 'mh_referral_code';
const SESSION_KEY_LAST_CAPTURED = 'mh_last_captured_ref';
let memoryVisitorKey = '';
const captureIds = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();
const authenticatedCaptures = new Set<string>();
const recordedCodes = new Set<string>();
const attributedCodes = new Set<string>();

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
    memoryVisitorKey ||= `vk_transient_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return memoryVisitorKey;
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
export function initReferralCapture(sessionToken?: string | null): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const identity = `${window.location.search}:${sessionToken || ''}`;
  const pending = inFlight.get(identity);
  if (pending) return pending;
  const work = captureCurrentReferral(sessionToken).finally(() => inFlight.delete(identity));
  inFlight.set(identity, work);
  return work;
}

async function captureCurrentReferral(sessionToken?: string | null): Promise<string | null> {
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
    let lastCaptured: string | null = null;
    let storedCaptureId: string | null = null;
    let guestAttributed = false;
    try { lastCaptured = sessionStorage.getItem(SESSION_KEY_LAST_CAPTURED); } catch { /* storage unavailable */ }
    try {
      storedCaptureId = sessionStorage.getItem(`mh_capture_id:${cleanCode}`);
      guestAttributed = sessionStorage.getItem(`mh_attributed_ref:${cleanCode}`) === '1';
    } catch { /* use memory */ }
    const authIdentity = `${cleanCode}:${sessionToken || ''}`;
    const clickComplete = (lastCaptured === cleanCode && storedCaptureId) || recordedCodes.has(cleanCode);
    const attributionComplete = sessionToken ? authenticatedCaptures.has(authIdentity) : guestAttributed || attributedCodes.has(cleanCode);
    if (clickComplete && attributionComplete) {
      return cleanCode;
    }

    const visitorKey = getOrGenerateVisitorKey();
    let captureId = captureIds.get(cleanCode);
    try { captureId ||= sessionStorage.getItem(`mh_capture_id:${cleanCode}`) || undefined; } catch { /* use memory */ }
    captureId ||= crypto.randomUUID();
    captureIds.set(cleanCode, captureId);
    try { sessionStorage.setItem(`mh_capture_id:${cleanCode}`, captureId); } catch { /* use memory */ }
    const landingPath = window.location.pathname + window.location.search;

    // Dispatch non-blocking capture to server
    const res = await captureReferralOnServer(
      {
        code: cleanCode,
        captureId,
        visitorKey,
        landingPath: landingPath.slice(0, 250),
      },
      sessionToken || undefined
    );

    if (res?.valid && res.clickRecorded) {
      recordedCodes.add(cleanCode);
      try { sessionStorage.setItem(SESSION_KEY_LAST_CAPTURED, cleanCode); } catch { /* use memory */ }
      if (sessionToken && res.attributionRecorded) authenticatedCaptures.add(authIdentity);
    }
    if (res?.valid && res.attributionRecorded && !sessionToken) {
      attributedCodes.add(cleanCode);
      try { sessionStorage.setItem(`mh_attributed_ref:${cleanCode}`, '1'); } catch { /* use memory */ }
    }

    return cleanCode;
  } catch (err) {
    // Never allow referral tracking to disrupt normal app initialization
    console.warn('[Referral Capture] Handled non-fatal tracking error:', err);
    return getStoredReferralCode();
  }
}

/** Observe the custom history router, including same-page query-string changes. */
export function observeReferralNavigation(capture: () => void): () => void {
  const history = window.history;
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  const push: History['pushState'] = function (...args) { originalPush.apply(history, args); capture(); };
  const replace: History['replaceState'] = function (...args) { originalReplace.apply(history, args); capture(); };
  history.pushState = push;
  history.replaceState = replace;
  window.addEventListener('popstate', capture);
  capture();
  return () => {
    if (history.pushState === push) history.pushState = originalPush;
    if (history.replaceState === replace) history.replaceState = originalReplace;
    window.removeEventListener('popstate', capture);
  };
}
