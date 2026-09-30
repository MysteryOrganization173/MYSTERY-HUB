/**
 * Authentication Input Validation & Normalization
 */

import { canonicalGhanaPhone, isValidGhanaPhoneNumber } from './phone.js';

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const clean = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(clean) || clean.length > 128) return null;
  return clean;
}

export function normalizeGhanaPhoneIdentifier(phone: unknown): string | null {
  if (typeof phone !== 'string') return null;
  const clean = phone.trim();
  if (!isValidGhanaPhoneNumber(clean)) return null;
  return canonicalGhanaPhone(clean);
}

export interface ParsedIdentifier {
  type: 'email' | 'phone';
  normalized: string;
}

export function parseIdentifier(rawIdentifier: unknown): ParsedIdentifier | null {
  if (typeof rawIdentifier !== 'string') return null;
  const clean = rawIdentifier.trim();

  if (clean.includes('@')) {
    const emailNorm = normalizeEmail(clean);
    if (emailNorm) return { type: 'email', normalized: emailNorm };
    return null;
  }

  const phoneNorm = normalizeGhanaPhoneIdentifier(clean);
  if (phoneNorm) return { type: 'phone', normalized: phoneNorm };

  return null;
}

export function validatePassword(password: unknown): { isValid: boolean; error?: string } {
  if (typeof password !== 'string') {
    return { isValid: false, error: 'Password must be provided.' };
  }
  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (password.length > 128) {
    return { isValid: false, error: 'Password must not exceed 128 characters.' };
  }
  return { isValid: true };
}
