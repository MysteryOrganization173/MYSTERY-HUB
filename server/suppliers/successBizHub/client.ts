/**
 * Success Biz Hub API v2 Client
 * Handles authenticated communication with Success Biz Hub API v2.
 * Includes request timeout, in-memory caching for discovery endpoints,
 * and safe error parsing without credential leakage.
 */

import {
  SbhAfaRequest,
  SbhAfaResponse,
  SbhServicesResponse,
  SbhWalletResponse,
  SbhCatalogResponse,
  SbhBeneficiaryCheckResponse,
  SbhCreateOrderRequest,
  SbhOrderResponse,
  SbhCreateAirtimeRequest,
  SbhAirtimeResponse,
  SbhInstantBundlesResponse,
  SbhCreateInstantBundleRequest,
  SbhInstantBundleResponse,
  SbhOffer,
} from './types.js';

import { createHash } from 'node:crypto';
import { noteSupplierResponse, noteSupplierError, noteSalesFailure } from '../../services/salesReliability.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class SuccessBizHubClient {
  private static sharedCache = new Map<string, CacheEntry<unknown>>();
  private cache = SuccessBizHubClient.sharedCache;
  private static afaDiscoveryFlights = new Map<string, Promise<SbhServicesResponse & {success?:boolean}>>();

  private getBaseUrl(): string {
    const raw = process.env.SUCCESS_BIZ_HUB_BASE_URL || 'https://api.successbizhub.com/v2';
    return raw.trim().replace(/\/+$/, '');
  }

  private getApiKey(): string {
    const raw = process.env.SUCCESS_BIZ_HUB_API_KEY || process.env.SUCCESSBASE_API_KEY || '';
    return raw.trim();
  }

  private getTimeoutMs(): number {
    const raw = process.env.SUCCESS_BIZ_HUB_REQUEST_TIMEOUT_MS;
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 15000;
  }

  public isFulfillmentEnabled(): boolean {
    const val = (process.env.SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED || '').toLowerCase().trim();
    return val === 'true' || val === '1' || val === 'yes';
  }

  public isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  /**
   * Helper to perform authenticated HTTP requests
   */
  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST';
      body?: unknown;
      skipCache?: boolean;
      cacheTtlMs?: number;
      privateAfa?: boolean;
      privateBeneficiary?: boolean;
      diagnostic?: boolean;
    } = {}
  ): Promise<T> {
    const method = options.method || 'GET';
    const observed = !options.diagnostic && (method === 'GET' && ['/services','/catalog','/wallet','/instant-bundles'].includes(endpoint)
      || method === 'POST' && endpoint === '/beneficiary-check');
    const identity = options.privateAfa ? `${this.getBaseUrl()}:${createHash('sha256').update(this.getApiKey()).digest('hex')}:` : '';
    const cacheKey = `${identity}${method}:${endpoint}:${options.cacheTtlMs || 0}`;

    // Read cache for GET requests if TTL specified
    if (method === 'GET' && !options.skipCache && options.cacheTtlMs) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        if (observed) noteSupplierResponse(endpoint, 'cache', cached.data, 200);
        return cached.data as T;
      }
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      if (observed) noteSalesFailure('application','configuration');
      throw new Error('Success Biz Hub API key is not configured.');
    }

    const url = `${this.getBaseUrl()}${endpoint}`;
    const timeoutMs = options.diagnostic ? Math.min(this.getTimeoutMs(), 8000) : this.getTimeoutMs();
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    let receivedHeaders = false;
    try {
      const headers: Record<string, string> = {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal,
        ...((options.privateBeneficiary || options.diagnostic)?{redirect:'error' as const}:{}),
      };

      if (options.body && method === 'POST') {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const res = await fetch(url, fetchOptions);
      if ((options.privateBeneficiary || options.diagnostic) && controller.signal.aborted) throw new DOMException('Supplier deadline exceeded.','AbortError');
      receivedHeaders = true;

      let responseJson: unknown = null;
      // fetch resolves at headers. Keep the deadline through body consumption too.
      const text = await res.text();
      if ((options.privateBeneficiary || options.diagnostic) && controller.signal.aborted) throw new DOMException('Supplier deadline exceeded.','AbortError');
      clearTimeout(timeoutHandle);
      try {
        responseJson = JSON.parse(text);
      } catch {
        // Raw non-JSON response
        responseJson = { status: 'error', message: text };
      }
      if (observed) noteSupplierResponse(endpoint, 'network', responseJson, res.status);

      if (options.privateAfa && (!res.ok || (responseJson as { success?: boolean })?.success !== true)) {
        // AFA errors may echo identity fields. Never retain raw response/body/message.
        const nested = (responseJson as { error?: { code?: unknown } })?.error;
        const code = typeof nested?.code === 'string' && /^[A-Z_]{1,64}$/.test(nested.code) ? nested.code : 'SUPPLIER_ERROR';
        throw Object.assign(new Error('AFA supplier request failed.'), { statusCode: res.status, code });
      }
      if (!res.ok) {
        if(options.privateBeneficiary)throw Object.assign(new Error('Recipient eligibility service unavailable.'),{statusCode:res.status});
        const errorMsg =
          (responseJson as { message?: string; error?: string })?.message ||
          (responseJson as { message?: string; error?: string })?.error ||
          `HTTP ${res.status}: ${res.statusText}`;

        const err = new Error(`Success Biz Hub request failed: ${errorMsg}`);
        (err as unknown as { statusCode: number; responseBody: unknown }).statusCode = res.status;
        (err as unknown as { statusCode: number; responseBody: unknown }).responseBody = responseJson;
        throw err;
      }

      // Store in cache if configured
      if (method === 'GET' && options.cacheTtlMs) {
        this.cache.set(cacheKey, {
          data: responseJson,
          expiresAt: Date.now() + options.cacheTtlMs,
        });
      }

      return responseJson as T;
    } catch (err: unknown) {
      clearTimeout(timeoutHandle);
      if (observed) noteSupplierError(endpoint, err, receivedHeaders ? 'body' : 'headers');
      if (err instanceof Error && err.name === 'AbortError') {
        const timeoutErr = new Error(`Success Biz Hub request timed out after ${timeoutMs}ms.`);
        (timeoutErr as unknown as { isTimeout: boolean }).isTimeout = true;
        throw timeoutErr;
      }
      throw err;
    }
  }

  /**
   * 1. GET /services
   * Determine product permissions and current availability
   * Cached for 5 minutes (300,000 ms)
   */
  /** Admin diagnostics only: no order methods, cache reuse, redirects, retries or checkout observations. */
  public readinessIdentity(): string {
    return createHash('sha256').update(`${this.getBaseUrl()}:${this.getApiKey()}`).digest('hex');
  }
  async getReadinessResource(endpoint: '/services' | '/catalog' | '/instant-bundles' | '/vouchers'): Promise<unknown> {
    if (!['/services', '/catalog', '/instant-bundles', '/vouchers'].includes(endpoint)) throw new Error('Unsupported readiness resource.');
    const base = this.getBaseUrl();
    if (base !== 'https://api.successbizhub.com/v2' && !(process.env.NODE_ENV === 'test' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/v2$/.test(base))) throw Object.assign(new Error('Supplier readiness configuration requires verification.'), { code: 'CONFIGURATION' });
    return this.request(endpoint, { privateAfa: true, diagnostic: true, skipCache: true });
  }

  async getServices(skipCache = false): Promise<SbhServicesResponse> {
    return this.request<SbhServicesResponse>('/services', {
      method: 'GET',
      skipCache,
      cacheTtlMs: 300_000,
    });
  }

  async getAfaServices(): Promise<SbhServicesResponse & { success?: boolean }> {
    const identity = this.getBaseUrl()+createHash('sha256').update(this.getApiKey()).digest('hex');
    const pending = SuccessBizHubClient.afaDiscoveryFlights.get(identity);
    if (pending) return pending;
    const request = this.request<SbhServicesResponse & {success?:boolean}>('/services', {cacheTtlMs:45_000,privateAfa:true});
    SuccessBizHubClient.afaDiscoveryFlights.set(identity, request);
    try { return await request; } finally { SuccessBizHubClient.afaDiscoveryFlights.delete(identity); }
  }
  async createAfa(req: SbhAfaRequest): Promise<SbhAfaResponse> {
    const { name, phone, idNumber, location, region, dateOfBirth, occupation } = req;
    return this.request('/afa', { method: 'POST', privateAfa: true,
      body: { name, phone, idNumber, location, region, dateOfBirth, ...(occupation ? { occupation } : {}) } });
  }
  async getAfa(identifier: string): Promise<SbhAfaResponse> {
    return this.request(`/afa/${encodeURIComponent(identifier)}`, { privateAfa: true });
  }

  /** Voucher catalogue. Cached briefly for the page; purchases always pass skipCache to see current cost and stock. */
  async getVouchers(skipCache = false): Promise<unknown> {
    return this.request('/vouchers', { cacheTtlMs: 60_000, skipCache, privateAfa: true });
  }
  /**
   * Buys vouchers and returns PINs. Never retried here: the supplier documents no idempotency key for this route. The
   * private mode keeps raw supplier text out of errors. Customer contacts are not sent, and the supplier's documentation
   * says the pack then also goes to the supplier account's own contacts by SMS, email and WhatsApp.
   */
  async purchaseVoucher(req: { typeId: string; qty: number }): Promise<unknown> {
    return this.request('/vouchers/purchase', { method: 'POST', privateAfa: true, body: { typeId: req.typeId, qty: req.qty } });
  }
  async getVoucherPurchase(identifier: string): Promise<unknown> {
    return this.request(`/vouchers/purchases/${encodeURIComponent(identifier)}`, { privateAfa: true });
  }

  /**
   * 2. GET /wallet
   * Retrieve balance, available and held
   * Cached for 30 seconds (30,000 ms)
   */
  async getWallet(skipCache = false): Promise<SbhWalletResponse> {
    return this.request<SbhWalletResponse>('/wallet', {
      method: 'GET',
      skipCache,
      cacheTtlMs: 30_000,
    });
  }

  /**
   * 3. GET /catalog
   * Retrieve assigned data offers/packages
   * Cached for 5 minutes (300,000 ms)
   */
  async getCatalog(skipCache = false): Promise<SbhCatalogResponse> {
    return this.request<SbhCatalogResponse>('/catalog', {
      method: 'GET',
      skipCache,
      cacheTtlMs: 300_000,
    });
  }

  /**
   * 4. POST /beneficiary-check
   * Check phone eligibility before order placement. Requires phones and exactly one offer selector.
   * Never cached
   */
  async checkBeneficiary(
    phones: string[],
    selector?: { offerSlug?: string; offerId?: string }
  ): Promise<SbhBeneficiaryCheckResponse> {
    const body: { phones: string[]; offerSlug?: string; offerId?: string } = { phones };
    if (selector?.offerSlug) {
      body.offerSlug = selector.offerSlug;
    } else if (selector?.offerId) {
      body.offerId = selector.offerId;
    }

    return this.request<SbhBeneficiaryCheckResponse>('/beneficiary-check', {
      method: 'POST',
      body,
      skipCache: true,
      privateBeneficiary: true,
    });
  }

  /**
   * 5. POST /orders
   * Place a data order. Never send price, never send beneficiary name.
   * Never cached.
   */
  async createOrder(req: SbhCreateOrderRequest): Promise<SbhOrderResponse> {
    return this.request<SbhOrderResponse>('/orders', {
      method: 'POST',
      body: req,
      skipCache: true,
    });
  }

  /**
   * 6. GET /orders/:identifier
   * Retrieve supplier order status
   * Never cached
   */
  async getOrder(identifier: string): Promise<SbhOrderResponse> {
    return this.request<SbhOrderResponse>(`/orders/${encodeURIComponent(identifier)}`, {
      method: 'GET',
      skipCache: true,
    });
  }

  /**
   * 7. POST /airtime
   * Place an airtime top-up order.
   * Body: { network, phone, amountMajor }
   * Never cached.
   */
  async createAirtime(req: SbhCreateAirtimeRequest): Promise<SbhAirtimeResponse> {
    return this.request<SbhAirtimeResponse>('/airtime', {
      method: 'POST',
      body: req,
      skipCache: true,
    });
  }

  /**
   * 8. GET /airtime/:identifier
   * Retrieve supplier airtime status.
   * Never cached.
   */
  async getAirtime(identifier: string): Promise<SbhAirtimeResponse> {
    return this.request<SbhAirtimeResponse>(`/airtime/${encodeURIComponent(identifier)}`, {
      method: 'GET',
      skipCache: true,
    });
  }

  /**
   * 9. Inspect GET /services for instant_bundles permission & availability
   * Instant Bundles must only be shown as LIVE when the current account/key
   * reports the instant_bundles service as:
   * - keyGranted / permitted
   * - available
   * - and there are sellable products
   */
  async checkInstantBundlesService(skipCache = false): Promise<{
    permitted: boolean;
    available: boolean;
    productCount: number;
    reason?: string;
  }> {
    try {
      const res = await this.getServices(skipCache);
      const data = res.data as {
        keyPermissions?: Record<string, boolean>;
        services?: Array<{ id: string; keyGranted?: boolean; available?: boolean; productCount?: number }>;
      } | undefined;

      const keyPermitted = data?.keyPermissions?.instant_bundles;
      const serviceItem = Array.isArray(data?.services)
        ? data?.services.find((s) => s.id === 'instant_bundles')
        : undefined;

      const isGranted = Boolean(keyPermitted || serviceItem?.keyGranted);
      const isAvailable = Boolean(serviceItem?.available);
      const productCount = typeof serviceItem?.productCount === 'number' ? serviceItem.productCount : 0;

      if (!isGranted) {
        return {
          permitted: false,
          available: false,
          productCount: 0,
          reason: 'API key does not have permission for instant_bundles.',
        };
      }

      if (!isAvailable) {
        return {
          permitted: true,
          available: false,
          productCount,
          reason: 'Instant Bundles service is currently unavailable from supplier.',
        };
      }

      return {
        permitted: true,
        available: true,
        productCount,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to query supplier services.';
      return {
        permitted: false,
        available: false,
        productCount: 0,
        reason: msg,
      };
    }
  }

  /**
   * 10. GET /instant-bundles
   * Retrieve assigned instant bundles catalog
   * Cached for 5 minutes (300,000 ms) unless skipCache is true
   */
  async getInstantBundles(skipCache = false): Promise<SbhInstantBundlesResponse> {
    return this.request<SbhInstantBundlesResponse>('/instant-bundles', {
      method: 'GET',
      skipCache,
      cacheTtlMs: 300_000,
    });
  }

  /**
   * 11. POST /instant-bundles
   * Place an instant bundle order. Never send retail prices to supplier.
   * Never cached.
   */
  async createInstantBundle(req: SbhCreateInstantBundleRequest): Promise<SbhInstantBundleResponse> {
    return this.request<SbhInstantBundleResponse>('/instant-bundles', {
      method: 'POST',
      body: req,
      skipCache: true,
    });
  }

  /**
   * 12. GET /instant-bundles/:identifier
   * Retrieve supplier instant bundle order status.
   * Never cached.
   */
  async getInstantBundle(identifier: string): Promise<SbhInstantBundleResponse> {
    return this.request<SbhInstantBundleResponse>(`/instant-bundles/${encodeURIComponent(identifier)}`, {
      method: 'GET',
      skipCache: true,
    });
  }

  /**
   * Invalidate discovery caches
   */
  clearCache(): void {
    SuccessBizHubClient.sharedCache.clear();
  }
}
