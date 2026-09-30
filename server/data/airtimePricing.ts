/**
 * Server-Authoritative Airtime Pricing & Service Fee Module
 * Controls the single source of truth for Airtime calculations and service fees.
 */

export const AIRTIME_SERVICE_FEE_PERCENT = (() => {
  const raw = process.env.AIRTIME_SERVICE_FEE_PERCENT;
  if (raw) {
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }
  return 2; // Default 2%
})();

export interface AirtimeCalculation {
  faceValueGhc: number;
  faceValuePesewas: number;
  serviceFeePercent: number;
  serviceFeeGhc: number;
  serviceFeePesewas: number;
  totalGhc: number;
  totalPesewas: number;
  amountMajor: string; // Supplier face value string
}

export function calculateAirtimeOrder(amountGhc: number): AirtimeCalculation {
  const safeFaceValue = Number(Number(amountGhc).toFixed(2));
  const faceValuePesewas = Math.round(safeFaceValue * 100);
  const serviceFeePercent = AIRTIME_SERVICE_FEE_PERCENT;
  const serviceFeePesewas = Math.round((faceValuePesewas * serviceFeePercent) / 100);
  const totalPesewas = faceValuePesewas + serviceFeePesewas;
  const serviceFeeGhc = Number((serviceFeePesewas / 100).toFixed(2));
  const totalGhc = Number((totalPesewas / 100).toFixed(2));

  // Supplier amountMajor string without decimal if whole number e.g. "10"
  const amountMajor = Number.isInteger(safeFaceValue)
    ? String(safeFaceValue)
    : safeFaceValue.toFixed(2);

  return {
    faceValueGhc: safeFaceValue,
    faceValuePesewas,
    serviceFeePercent,
    serviceFeeGhc,
    serviceFeePesewas,
    totalGhc,
    totalPesewas,
    amountMajor,
  };
}

export function validateAirtimeAmount(amountGhc: number): { isValid: boolean; error?: string } {
  if (typeof amountGhc !== 'number' || isNaN(amountGhc)) {
    return { isValid: false, error: 'Please enter a valid numeric airtime amount.' };
  }
  if (amountGhc < 1) {
    return { isValid: false, error: 'Minimum airtime purchase is GH₵1.00.' };
  }
  if (amountGhc > 1000) {
    return { isValid: false, error: 'Maximum single airtime purchase is GH₵1,000.00.' };
  }
  return { isValid: true };
}
