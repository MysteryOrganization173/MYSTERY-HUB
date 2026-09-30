/**
 * Ghana Mobile Phone Number Normalization & Validation
 * Standardizes formats:
 * - "0592066298" -> "+233592066298"
 * - "233592066298" -> "+233592066298"
 * - "+233592066298" -> "+233592066298"
 */

// Common Ghanaian mobile network prefixes
// MTN: 024, 054, 055, 059, 025, 053
// Telecel (Vodafone): 020, 050
// AirtelTigo: 027, 057, 026, 056
const GHANA_PREFIX_REGEX = /^(?:\+?233|0)?([235]\d{8})$/;

export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string | null;
  formattedLocal: string | null;
  raw: string;
  error?: string;
}

export function validateAndNormalizeGhanaPhone(rawPhone: string): PhoneValidationResult {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return {
      isValid: false,
      normalized: null,
      formattedLocal: null,
      raw: rawPhone || '',
      error: 'Phone number is required.',
    };
  }

  // Remove spaces, hyphens, brackets
  const cleaned = rawPhone.replace(/[\s\-()]/g, '');

  const match = cleaned.match(GHANA_PREFIX_REGEX);
  if (!match) {
    return {
      isValid: false,
      normalized: null,
      formattedLocal: null,
      raw: rawPhone,
      error: 'Please enter a valid 10-digit Ghana phone number (e.g., 0592066298 or +233592066298).',
    };
  }

  const nineDigits = match[1];
  const normalized = `+233${nineDigits}`;
  const formattedLocal = `0${nineDigits}`;

  return {
    isValid: true,
    normalized,
    formattedLocal,
    raw: rawPhone,
  };
}
