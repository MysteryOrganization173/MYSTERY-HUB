import { createHash } from 'node:crypto';
import { SuccessBizHubClient } from '../suppliers/successBizHub/client.js';
import { CommercialService } from './commercialService.js';
import { ResultsCheckerService } from './resultsCheckerService.js';
import { ResultsCheckerStore } from '../db/resultsCheckerStore.js';
import { isCheckerEncryptionConfigured } from './resultsCheckerEncryption.js';
import { isAfaEncryptionConfigured } from './afaEncryption.js';
import { AIRTIME_SERVICE_FEE_PERCENT } from '../data/airtimePricing.js';
import { CHECKER_PRODUCTS, matchCheckerOffer, parseMinor, parseVoucherCatalogue } from '../../shared/resultsCheckers.js';
import type { CapabilityId, CommercialReadiness, ReadinessProduct, ServiceReadiness } from '../../shared/serviceReadiness.js';

const IDS: CapabilityId[] = ['orders', 'airtime', 'instant_bundles', 'afa', 'vouchers'];
const NAMES = ['Regular Data', 'Airtime', 'Instant Bundles', 'AFA registration', 'Results Checkers'];
const object = (v: unknown): Record<string, any> | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : null;
const bool = (v: unknown): boolean | null => typeof v === 'boolean' ? v : null;
const count = (v: unknown): number | null => Number.isSafeInteger(v) && Number(v) >= 0 ? Number(v) : null;
const id = (v: unknown): string | null => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? String(v) : typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v) ? v : null;
const label = (v: unknown): string => typeof v === 'string' ? v.replace(/[<>\x00-\x1f\x7f]/g, '').slice(0, 100) : 'Unnamed product';
const usable = (row: Record<string, any>) => (row.enabled === undefined || row.enabled === true) && (row.available === undefined || row.available === true);
const meaningful = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
const positive = (v: unknown) => (typeof v === 'number' || typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) && Number.isFinite(Number(v)) && Number(v) > 0;
const enabled = (v: string | undefined) => /^(true|1)$/i.test(v || '');
const envelope = (v: unknown) => { const row = object(v); if (row?.success !== true) throw Error('Invalid supplier envelope'); return row.data; };
const failure = (err: unknown): string => {
  const e = (object(err) || {}) as { statusCode?: number; isTimeout?: boolean; code?: string };
  if (e.isTimeout) return 'Supplier request timed out.';
  if (e.statusCode === 401 || e.statusCode === 403) return 'Supplier authorization was refused.';
  if (e.statusCode === 429) return 'Supplier request limit reached; wait before refreshing.';
  if (e.code === 'CONFIGURATION') return 'Supplier base configuration requires verification.';
  return 'Supplier evidence unavailable or malformed.';
};

/** One on-demand, credential-scoped snapshot per minute. No background worker or financial transactions. */
export class CommercialReadinessService {
  static client = new SuccessBizHubClient();
  private static cache: { identity: string; expires: number; value?: CommercialReadiness; flight?: Promise<CommercialReadiness> } | null = null;
  static resetForTests() { if (process.env.NODE_ENV !== 'test') throw Error('Test only'); this.cache = null; }
  static async snapshot(): Promise<CommercialReadiness> {
    const identity = this.client.readinessIdentity();
    if (this.cache?.identity === identity && this.cache.flight) return this.cache.flight;
    if (this.cache?.identity === identity && this.cache.expires > Date.now() && this.cache.value) return this.cache.value;
    const slot: NonNullable<typeof this.cache> = { identity, expires: 0 };
    this.cache = slot;
    const flight = this.collect().then(value => { slot.value = value; slot.expires = Date.parse(value.expiresAt); return value; }).finally(() => { slot.flight = undefined; });
    slot.flight = flight;
    return flight;
  }
  private static async collect(): Promise<CommercialReadiness> {
    const observedAt = new Date().toISOString();
    let discovery: Record<string, any> | null = null, discoveryError = '';
    if (!this.client.isConfigured()) discoveryError = 'Supplier credentials are not configured.';
    else try {
      discovery = object(envelope(await this.client.getReadinessResource('/services')));
      if (!discovery || !object(discovery.keyPermissions) || !Array.isArray(discovery.services) || discovery.services.length > 100) { discovery = null; throw Error('Invalid discovery'); }
    } catch (e) { discoveryError = failure(e); }
    const services: ServiceReadiness[] = IDS.map((serviceId, index) => {
      const matches = discovery?.services.filter((s: unknown) => object(s)?.id === serviceId) || [];
      const service = matches.length === 1 ? object(matches[0]) : null;
      return { id: serviceId, name: NAMES[index], state: 'unverified', supplierConfigured: this.client.isConfigured() && this.client.isFulfillmentEnabled(),
        keyPermission: bool(discovery?.keyPermissions?.[serviceId]), keyGranted: bool(service?.keyGranted), available: bool(service?.available), reportedProducts: count(service?.productCount),
        catalogue: { state: serviceId === 'afa' ? 'not_applicable' : 'unverified', count: null, products: [] }, pricing: 'Not verified', blockers: discoveryError ? [discoveryError] : [] };
    });
    const granted = (service: ServiceReadiness) => service.keyPermission === true && service.keyGranted === true;
    const fetchData = async (endpoint: '/catalog' | '/instant-bundles' | '/vouchers') => {
      try { return { data: envelope(await this.client.getReadinessResource(endpoint)), error: '' }; }
      catch (e) { return { data: null, error: failure(e) }; }
    };
    const [catalog, instant, vouchers, retail, storage] = await Promise.all([
      services.slice(0, 2).some(granted) ? fetchData('/catalog') : null,
      granted(services[2]) ? fetchData('/instant-bundles') : null,
      granted(services[4]) ? fetchData('/vouchers') : null,
      CommercialService.catalog().catch(() => null), ResultsCheckerStore.ready().catch(() => false),
    ]);
    for (const service of services) {
      if (!service.supplierConfigured) service.blockers.push('Supplier credentials or fulfilment configuration are incomplete.');
      if (service.keyPermission === false && service.keyGranted === false) service.blockers.push('This key is not authorized for this service.');
      else if (!granted(service)) service.blockers.push('Permission flags are missing or disagree; supplier clarification is required.');
      if (service.available === false) service.blockers.push('Supplier reports this service unavailable.');
      else if (service.available === null) service.blockers.push('Supplier availability is unverified.');
      const result = service.id === 'orders' || service.id === 'airtime' ? catalog : service.id === 'instant_bundles' ? instant : service.id === 'vouchers' ? vouchers : null;
      if (result?.error) service.blockers.push(result.error);
      if (result && !result.error && granted(service)) {
        let products: ReadinessProduct[] | null = null;
        if (service.id === 'orders' || service.id === 'airtime') {
          const offers = object(result.data)?.offers;
          if (Array.isArray(offers) && offers.length <= 200) {
            const rows = offers.filter((o: any) => object(o)?.kind === (service.id === 'orders' ? 'data' : 'airtime') && usable(o));
            products = [];
            for (const offer of rows) {
              const selector = id(offer.slug) || id(offer.id);
              if (!selector || !meaningful(offer.name)) continue;
              // Airtime uses an offer and amountMajor, not data package identifiers/prices.
              if (service.id === 'airtime') products.push({ id: selector, name: label(offer.name), costMinor: null, stock: null });
              else if (Array.isArray(offer.packages)) for (const pack of offer.packages.slice(0, 200)) {
                if (object(pack) && usable(pack) && meaningful(pack.sizeLabel) && parseMinor(pack.priceMinor) !== null) products.push({ id: selector, name: label(`${offer.name || 'Data'} ${pack.sizeLabel}`), costMinor: parseMinor(pack.priceMinor), stock: null });
              }
            }
          }
        } else if (service.id === 'instant_bundles') {
          const data = object(result.data);
          if (Array.isArray(data?.packages) && data.packages.length <= 1000 && typeof data.available === 'boolean') {
            products = data.packages.filter((p: any) => {
              if (!object(p) || !usable(p) || id(p.id) === null || !meaningful(p.name) || !meaningful(p.network)) return false;
              if (p.isFlexi !== undefined && typeof p.isFlexi !== 'boolean' || p.mode !== undefined && !['fixed', 'flexi'].includes(p.mode) || typeof p.isFlexi === 'boolean' && p.mode !== undefined && p.isFlexi !== (p.mode === 'flexi')) return false;
              const flexi = p.isFlexi === true || p.mode === 'flexi';
              if (flexi) return positive(p.payableRatio ?? data.flexiPayRatio) && (p.minAmountMajor == null || positive(p.minAmountMajor)) && (p.maxAmountMajor == null || positive(p.maxAmountMajor)) && (p.minAmountMajor == null || p.maxAmountMajor == null || Number(p.maxAmountMajor) >= Number(p.minAmountMajor));
              return p.mode !== 'flexi' && parseMinor(p.priceMinor) !== null;
            }).map((p: any) => ({ id: id(p.id)!, name: label(p.name), costMinor: parseMinor(p.priceMinor), stock: null }));
            if (!data.available) service.blockers.push('Instant catalogue reports unavailable.');
          }
        } else if (service.id === 'vouchers' && Array.isArray(result.data) && result.data.length <= 200) {
          const offers = parseVoucherCatalogue({ data: result.data });
          products = offers.map(p => ({ id: p.id, name: label(p.name), costMinor: p.costMinor, stock: p.available }));
          service.checkers = CHECKER_PRODUCTS.map(p => { const check = matchCheckerOffer(p, ResultsCheckerService.typeId(p), offers); return { name: p.name, mapping: check.state, retailMinor: p.retailMinor, costMinor: check.offer?.costMinor ?? null, stock: check.offer?.available ?? null, grossSpreadMinor: check.offer?.costMinor == null ? null : p.retailMinor - check.offer.costMinor }; });
          if (service.checkers.every(p => p.mapping !== 'ok')) service.blockers.push('No checker has a validated mapping, approved cost and stock.');
        }
        if (products) service.catalogue = { state: 'verified', count: products.length, products: products.slice(0, 20) };
      }
      if (service.id === 'orders') {
        service.pricing = retail ? `${retail.products.length} active direct retail products; use existing pricing controls below.` : 'Direct retail settings could not be read.';
        if (!retail?.products.length) service.blockers.push('Direct retail pricing is unavailable.');
      } else if (service.id === 'airtime') service.pricing = `Server service fee: ${AIRTIME_SERVICE_FEE_PERCENT}%. Supplier cost varies by amount; no net margin claim.`;
      else if (service.id === 'instant_bundles') service.pricing = 'Existing server fixed/Flexi pricing applies at checkout; no net margin claim.';
      else if (service.id === 'afa') {
        const price = parseMinor(process.env.AFA_RETAIL_PRICE_MINOR || '');
        service.pricing = price && price <= 100_000_000 ? `Configured retail: GH₵${(price / 100).toFixed(2)}; supplier cost unverified.` : 'AFA retail price is not configured.';
        if (!enabled(process.env.AFA_SERVICE_ENABLED)) { service.state = 'disabled'; service.blockers.push('AFA commercial flag is disabled.'); }
        if (!isAfaEncryptionConfigured() || !price || price > 100_000_000) service.blockers.push('AFA encryption or retail configuration is incomplete.');
      } else {
        service.pricing = 'BECE GH₵23.99 / WASSCE GH₵24.99. Gross spread excludes fees, rewards and other costs.';
        if (!ResultsCheckerService.enabled()) { service.state = 'disabled'; service.blockers.push('Checker commercial flag is disabled.'); }
        if (!storage || !isCheckerEncryptionConfigured() || !ResultsCheckerService.supplierSpendAllowed()) service.blockers.push('Checker storage, encryption or live-payment prerequisites are incomplete.');
        service.blockers.push('Purchase/lookup contract and controlled activation require separate verification and authorization.');
      }
      if (service.catalogue.state === 'unverified') service.blockers.push('Catalogue evidence is unverified.');
      else if (service.catalogue.count === 0) service.blockers.push('No products were validated in this catalogue response.');
      if (service.state !== 'disabled') service.state = service.blockers.length === 0 ? 'checks_passed' : service.available === false || service.keyPermission === false && service.keyGranted === false ? 'unavailable' : 'unverified';
    }
    const account = discovery?.accountId;
    return { readOnly: true, livePaymentConfigured: process.env.NODE_ENV === 'production' && (process.env.PAYSTACK_SECRET_KEY || '').trim().startsWith('sk_live_'), observedAt, expiresAt: new Date(Date.now() + 60_000).toISOString(), accountFingerprint: typeof account === 'string' && account.length <= 128 ? createHash('sha256').update(account).digest('hex').slice(0, 12) : null, services };
  }
}
