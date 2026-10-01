/**
 * Success Biz Hub API v2 Client
 * Handles authenticated communication with Success Biz Hub API v2.
 * Includes request timeout, in-memory caching for discovery endpoints,
 * and safe error parsing without credential leakage.
 */

import {
  SbhServicesResponse,
  SbhWalletResponse,
  SbhCatalogResponse,
  SbhBeneficiaryCheckResponse,
  SbhCreateOrderRequest,
  SbhOrderResponse,
  SbhCreateAirtimeRequest,
  SbhAirtimeResponse,
  SbhOffer,
} from './types.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class SuccessBizHubClient {
  private static sharedCache = new Map<string, CacheEntry<unknown>>();
  private cache = SuccessBizHubClient.sharedCache;

  private getBaseUrl(): string {
    const raw = process.env.SUCCESS_BIZ_HUB_BASE_URL || 'https://api.successbizhub.com/v2';
    return raw.trim().replace(/\/+$/, '');
  }

  private getApiKey(): string {
    const raw = process.env.SUCCESS_BIZ_HUB_API_KEY || '';
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
    } = {}
  ): Promise<T> {
    const method = options.method || 'GET';
    const cacheKey = `${method}:${endpoint}`;

    // Read cache for GET requests if TTL specified
    if (method === 'GET' && !options.skipCache && options.cacheTtlMs) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data as T;
      }
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Success Biz Hub API key is not configured.');
    }

    const url = `${this.getBaseUrl()}${endpoint}`;
    const timeoutMs = this.getTimeoutMs();
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

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
      };

      if (options.body && method === 'POST') {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const res = await fetch(url, fetchOptions);
      clearTimeout(timeoutHandle);

      let responseJson: unknown = null;
      const text = await res.text();
      try {
        responseJson = JSON.parse(text);
      } catch {
        // Raw non-JSON response
        responseJson = { status: 'error', message: text };
      }

      if (!res.ok) {
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
  async getServices(skipCache = false): Promise<SbhServicesResponse> {
    return this.request<SbhServicesResponse>('/services', {
      method: 'GET',
      skipCache,
      cacheTtlMs: 300_000,
    });
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
   * Invalidate discovery caches
   */
  clearCache(): void {
    SuccessBizHubClient.sharedCache.clear();
  }
}
