/**
 * Money Minor Parser Utility
 * Success Biz Hub API v2 returns ledger money fields as pesewa decimal strings or numbers.
 * This helper strictly validates and parses pesewa values into integers.
 */

export function parseMinorAmount(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  let num: number;
  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }
    // Reject non-numeric strings or signs like negative
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      return null;
    }
    num = Number(trimmed);
  } else {
    return null;
  }

  if (isNaN(num) || !isFinite(num) || num < 0) {
    return null;
  }

  return Math.round(num);
}
