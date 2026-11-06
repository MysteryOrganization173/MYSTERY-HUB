/**
 * Results Checkers V1: the catalogue rules shared by the page and the server.
 *
 * Mystery Hub sells checker vouchers (PINs). It does not retrieve results and is not affiliated with WAEC.
 * A product can be bought only when an administrator has named its supplier voucher type in configuration, the live
 * supplier catalogue confirms that type by name, and its assigned cost is no higher than the approved limit.
 * A familiar name in the catalogue never makes a product purchasable by itself.
 */
export type CheckerProductKey = 'bece' | 'wassce';

export interface CheckerProduct {
  key: CheckerProductKey;
  name: string;
  short: string;
  /** Founder-approved customer price in pesewas. */
  retailMinor: number;
  /** Highest supplier cost this price was approved against, in pesewas. Above it the product stays unavailable. */
  maxCostMinor: number;
  /** The supplier's catalogue name must match this... */
  namePattern: RegExp;
  /** ...and must not match this: variants need their own commercial decision. */
  excludePattern: RegExp;
  /** Environment variable naming the supplier voucher type. */
  typeIdEnv: string;
}

export const CHECKER_PRODUCTS: readonly CheckerProduct[] = [
  { key: 'bece', name: 'BECE Results Checker', short: 'For Basic Education Certificate Examination results.', retailMinor: 2399, maxCostMinor: 1800,
    namePattern: /\bbece\b/i, excludePattern: /private|nov|dec|wassce/i, typeIdEnv: 'RESULTS_CHECKER_TYPE_ID_BECE' },
  { key: 'wassce', name: 'WASSCE Results Checker', short: 'For West African Senior School Certificate Examination results.', retailMinor: 2499, maxCostMinor: 1800,
    namePattern: /\bwassce\b/i, excludePattern: /private|nov|dec|bece/i, typeIdEnv: 'RESULTS_CHECKER_TYPE_ID_WASSCE' },
];

export const CHECKER_MAX_QTY = 5;
export const CHECKER_ORDER_NETWORK = 'education';
export const checkerProduct = (key: unknown) => CHECKER_PRODUCTS.find(product => product.key === key);
export const checkerProductId = (key: CheckerProductKey) => `results-checker-${key}`;
export const checkerOrderName = (product: CheckerProduct, qty: number) => qty > 1 ? `${product.name} × ${qty}` : product.name;

/** Pesewas only. A supplier value that isn't a safe whole number is treated as unknown, never guessed. */
export function parseMinor(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value.trim()))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 && number <= 2_147_483_647 ? number : null;
}

export interface VoucherOffer { id: string; name: string; slug: string; costMinor: number | null; available: number | null }

/** The documented GET /vouchers shape. Malformed rows are dropped. */
export function parseVoucherCatalogue(response: unknown): VoucherOffer[] {
  const rows = (response as { data?: unknown })?.data;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap(raw => {
    const row = raw as Record<string, unknown>;
    if (!row || typeof row.id !== 'string' || !row.id || row.id.length > 128 || typeof row.name !== 'string' || !row.name) return [];
    const available = typeof row.available === 'number' && Number.isSafeInteger(row.available) && row.available >= 0 ? row.available : null;
    return [{ id: row.id, name: row.name, slug: typeof row.slug === 'string' ? row.slug : '', costMinor: parseMinor(row.priceMinor), available }];
  });
}

export type OfferState = 'ok' | 'not_configured' | 'missing' | 'name_mismatch' | 'cost_unknown' | 'cost_too_high' | 'stock_unknown' | 'out_of_stock';

/** Decides whether one product may be sold. Every answer other than "ok" keeps it unavailable. */
export function matchCheckerOffer(product: CheckerProduct, typeId: string | undefined, catalogue: readonly VoucherOffer[], qty = 1): { state: OfferState; offer: VoucherOffer | null } {
  if (!typeId) return { state: 'not_configured', offer: null };
  const offer = catalogue.find(row => row.id === typeId) || null;
  if (!offer) return { state: 'missing', offer: null };
  if (!product.namePattern.test(offer.name) || product.excludePattern.test(offer.name)) return { state: 'name_mismatch', offer };
  if (offer.costMinor === null) return { state: 'cost_unknown', offer };
  if (offer.costMinor > product.maxCostMinor) return { state: 'cost_too_high', offer };
  if (offer.available === null) return { state: 'stock_unknown', offer };
  if (offer.available < qty) return { state: 'out_of_stock', offer };
  return { state: 'ok', offer };
}

export interface CheckerPin { pin: string; serial?: string }
export interface VoucherPurchaseResult { purchaseId: string | null; pins: CheckerPin[]; costMinor: number | null; malformedPins: number }

const PIN = /^[A-Za-z0-9][A-Za-z0-9 -]{3,63}$/;
const pinText = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) value = String(value);
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return PIN.test(clean) ? clean : null;
};

/**
 * Reads a supplier voucher response. The documentation promises data.pins but doesn't show each entry's shape, so plain
 * strings and { pin, serial } style objects are both accepted. Anything else is counted as malformed, never invented.
 */
export function parseVoucherPurchase(response: unknown): VoucherPurchaseResult {
  const data = (response as { data?: unknown })?.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') return { purchaseId: null, pins: [], costMinor: null, malformedPins: 0 };
  const rawId = data.id ?? data.publicId ?? data.purchaseId ?? data.reference;
  const purchaseId = typeof rawId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(rawId) ? rawId : null;
  const rawPins = Array.isArray(data.pins) ? data.pins : [];
  const pins: CheckerPin[] = []; let malformedPins = 0;
  for (const raw of rawPins) {
    if (raw && typeof raw === 'object') {
      const row = raw as Record<string, unknown>;
      const rawSerial = row.serial ?? row.serialNumber ?? row.serial_number;
      const pin = pinText(row.pin ?? row.code ?? row.value), serial = pinText(rawSerial);
      if (pin) pins.push({ pin, ...(serial ? { serial } : {}) }); else malformedPins++;
      if (pin && rawSerial !== undefined && rawSerial !== null && !serial) malformedPins++;
    } else { const pin = pinText(raw); if (pin) pins.push({ pin }); else malformedPins++; }
  }
  return { purchaseId, pins, costMinor: parseMinor(data.chargeMinor ?? data.priceMinor ?? data.totalMinor), malformedPins };
}

export interface CheckerConfigProduct { key: CheckerProductKey; name: string; short: string; priceMinor: number; available: boolean; stock: 'in_stock' | 'low' | null }
export interface CheckerConfig { available: boolean; message: string; maxQty: number; products: CheckerConfigProduct[] }

export interface CheckerReceipt {
  orderRef: string; productName: string; qty: number; status: string; paid: boolean; manualReview: boolean;
  pins: CheckerPin[]; pinsExpected: number; state: 'ready' | 'partial' | 'processing' | 'review';
}

/** What the customer is told, from the facts only. A paid order is never described as delivered until PINs are stored. */
export function checkerReceiptState(input: { paid: boolean; status: string; manualReview: boolean; pinCount: number; qty: number }): CheckerReceipt['state'] {
  if (input.pinCount >= input.qty && input.status === 'delivered') return 'ready';
  if (input.pinCount > 0) return 'partial';
  if (input.manualReview || ['refund_pending', 'failed', 'refunded', 'cancelled', 'expired'].includes(input.status)) return 'review';
  return 'processing';
}
