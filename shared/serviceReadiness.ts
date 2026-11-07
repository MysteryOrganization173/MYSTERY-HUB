/** Admin-only operational facts. A snapshot never authorizes a payment or proves delivery. */
export type ReadinessState = 'checks_passed' | 'disabled' | 'unavailable' | 'unverified';
export type CapabilityId = 'orders' | 'airtime' | 'instant_bundles' | 'afa' | 'vouchers';
export interface ReadinessProduct { id: string; name: string; costMinor: number | null; stock: number | null }
export interface ServiceReadiness {
  id: CapabilityId; name: string; state: ReadinessState; supplierConfigured: boolean;
  keyPermission: boolean | null; keyGranted: boolean | null; available: boolean | null; reportedProducts: number | null;
  catalogue: { state: 'verified' | 'unverified' | 'not_applicable'; count: number | null; products: ReadinessProduct[] };
  pricing: string; blockers: string[];
  checkers?: { name: string; mapping: string; retailMinor: number; costMinor: number | null; stock: number | null; grossSpreadMinor: number | null }[];
}
export interface CommercialReadiness {
  observedAt: string; expiresAt: string; readOnly: true; livePaymentConfigured: boolean; accountFingerprint: string | null;
  services: ServiceReadiness[];
}


/** Reject partial/malformed successful HTTP responses before rendering privileged operational facts. */
export function isCommercialReadiness(value: unknown): value is CommercialReadiness {
  const record = (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const text = (v: any) => typeof v === 'string' && v.length <= 500;
  const nullableCount = (v: any) => v === null || Number.isSafeInteger(v) && v >= 0;
  const flag = (v: any) => v === null || typeof v === 'boolean';
  const ids = ['orders', 'airtime', 'instant_bundles', 'afa', 'vouchers'];
  const v = value as any;
  if (!record(v) || v.readOnly !== true || typeof v.livePaymentConfigured !== 'boolean' || !Number.isFinite(Date.parse(v.observedAt)) || !Number.isFinite(Date.parse(v.expiresAt)) || !(v.accountFingerprint === null || typeof v.accountFingerprint === 'string' && /^[a-f0-9]{12}$/.test(v.accountFingerprint)) || !Array.isArray(v.services) || v.services.length !== 5) return false;
  const seen = new Set();
  return v.services.every((s: any) => {
    if (!record(s) || !ids.includes(s.id) || seen.has(s.id) || !text(s.name) || !['checks_passed', 'disabled', 'unavailable', 'unverified'].includes(s.state) || typeof s.supplierConfigured !== 'boolean' || ![s.keyPermission, s.keyGranted, s.available].every(flag) || !nullableCount(s.reportedProducts) || !text(s.pricing) || !Array.isArray(s.blockers) || s.blockers.length > 20 || !s.blockers.every(text)) return false;
    seen.add(s.id);
    const c = s.catalogue;
    if (!record(c) || !['verified', 'unverified', 'not_applicable'].includes(c.state) || !nullableCount(c.count) || !Array.isArray(c.products) || c.products.length > 20 || !c.products.every((p: any) => record(p) && text(p.id) && text(p.name) && nullableCount(p.costMinor) && nullableCount(p.stock))) return false;
    return s.checkers === undefined || Array.isArray(s.checkers) && s.checkers.length <= 2 && s.checkers.every((p: any) => record(p) && text(p.name) && text(p.mapping) && nullableCount(p.retailMinor) && nullableCount(p.costMinor) && nullableCount(p.stock) && (p.grossSpreadMinor === null || Number.isSafeInteger(p.grossSpreadMinor)));
  });
}
