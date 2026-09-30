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

/**
 * Returns the canonical standardized Ghana phone number (+233...) or null if invalid
 */
export function canonicalGhanaPhone(rawPhone: string): string | null {
  const result = validateAndNormalizeGhanaPhone(rawPhone);
  return result.isValid ? result.normalized : null;
}

/**
 * Compares two Ghana phone numbers across formats (059..., 233..., +233...)
 */
export function areGhanaPhonesEqual(phoneA: string, phoneB: string): boolean {
  const normA = canonicalGhanaPhone(phoneA);
  const normB = canonicalGhanaPhone(phoneB);
  return Boolean(normA && normB && normA === normB);
}

/**
 * Generates all valid lookup representations of a Ghana phone number
 * e.g. for "0592066298": ["+233592066298", "233592066298", "0592066298"]
 */
export function getGhanaPhoneLookupVariants(rawPhone: string): string[] {
  const result = validateAndNormalizeGhanaPhone(rawPhone);
  if (!result.isValid || !result.normalized || !result.formattedLocal) {
    const digits = (rawPhone || '').replace(/\D/g, '');
    return digits ? [digits] : [];
  }
  const local = result.formattedLocal; // e.g. 0592066298
  const nineDigits = local.slice(1);   // e.g. 592066298
  return [
    result.normalized,                 // +233592066298
    `233${nineDigits}`,                // 233592066298
    local,                             // 0592066298
  ];
}
