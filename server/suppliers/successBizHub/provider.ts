/**
 * Success Biz Hub Supplier Provider
 * Production implementation of SupplierProvider abstraction for Data Bundles
 * using Success Biz Hub API v2.
 */

import {
  SupplierProvider,
  SupplierBalance,
  SupplierOffer,
  SupplierOrderRequest,
  SupplierOrderResponse,
  SupplierAirtimeRequest,
  SupplierAirtimeResponse,
} from '../supplierInterface.js';
import { SuccessBizHubClient } from './client.js';
import { resolveSupplierPackage, ResolvedSupplierPackage } from './catalogResolver.js';
import { SbhOffer } from './types.js';
import { parseMinorAmount } from './money.js';
import { validateAndNormalizeGhanaPhone } from '../../utils/phone.js';

/**
 * Normalizes Ghana phone number to 10-digit standard local format for matching
 * e.g. "0592066298", "233592066298", "+233592066298" all normalize to "0592066298"
 */
export function normalizeGhanaPhoneForComparison(phoneStr: string): string {
  const res = validateAndNormalizeGhanaPhone(phoneStr);
  if (res.isValid && res.formattedLocal) {
    return res.formattedLocal;
  }
  if (!phoneStr || typeof phoneStr !== 'string') return '';
  const digits = phoneStr.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) {
    return '0' + digits.slice(3);
  }
  return digits;
}

export class SuccessBizHubProvider implements SupplierProvider {
  providerId = 'success_biz_hub';
  providerName = 'Success Biz Hub API v2';

  constructor(public readonly client: SuccessBizHubClient = new SuccessBizHubClient()) {}

  async checkAfaAvailable(): Promise<{ available: boolean; status: 'available' | 'unavailable' | 'permission_missing' | 'supplier_error' | 'not_configured' }> {
    if (!this.client.isConfigured()) return { available: false, status: 'not_configured' };
    try {
      const result = await this.client.getAfaServices();
      const data = result.data as { keyPermissions?: { afa?: boolean }; services?: Array<{ id?: string; keyGranted?: boolean; available?: boolean }> };
      const service = data?.services?.find(item => item.id === 'afa');
      const permitted = data?.keyPermissions?.afa === true && service?.keyGranted !== false;
      if (!permitted) return { available: false, status: 'permission_missing' };
      const available = service?.available === true;
      return { available, status: available ? 'available' : 'unavailable' };
    } catch (err) {
      return { available: false, status: (err as { statusCode?: number }).statusCode === 403 ? 'permission_missing' : 'supplier_error' };
    }
  }
  async placeAfaRegistration(payload: import('./types.js').SbhAfaRequest) { return this.client.createAfa(payload); }
  async getAfaStatus(publicId: string) { return this.client.getAfa(publicId); }

  /**
   * Status mapping from Success Biz Hub to Mystery Hub domain status
   *
   * processed -> delivered
   * processing -> processing
   * pending -> submitted
   * failed -> failed
   */
  mapSupplierStatus(rawStatus: string): 'queued' | 'submitted' | 'processing' | 'delivered' | 'failed' {
    const s = (rawStatus || '').toLowerCase().trim();
    if (s === 'processed' || s === 'completed' || s === 'success' || s === 'delivered') {
      return 'delivered';
    }
    if (s === 'processing' || s === 'in_progress') {
      return 'processing';
    }
    if (s === 'pending' || s === 'queued' || s === 'accepted') {
      return 'submitted';
    }
    if (s === 'failed' || s === 'rejected' || s === 'cancelled') {
      return 'failed';
    }
    console.warn(`Unknown Success Biz Hub supplier order status received: "${rawStatus}". Defaulting to non-terminal "processing".`);
    return 'processing';
  }

  /**
   * 1. GET /wallet
   * Retrieves supplier wallet balance. Strictly validates availableMinor.
   */
  async getBalance(): Promise<SupplierBalance> {
    const res = await this.client.getWallet();
    const data = res.data || {};
    const parsedAvailable = parseMinorAmount(data.availableMinor);
    if (parsedAvailable === null) {
      throw new Error(`Invalid or unparseable availableMinor in supplier wallet: "${String(data.availableMinor)}"`);
    }
    const currency = (data.currency || 'GHS').toUpperCase() as 'GHS';

    return {
      providerName: this.providerName,
      currency,
      balancePesewas: parsedAvailable,
      balanceGhc: Number((parsedAvailable / 100).toFixed(2)),
    };
  }

  /**
   * 2. GET /catalog
   * Retrieves assigned data offers from supplier
   */
  async getOffers(): Promise<SupplierOffer[]> {
    const res = await this.client.getCatalog();
    let rawOffers: SbhOffer[] = [];
    if (Array.isArray(res.data)) {
      rawOffers = res.data;
    } else if (res.data && Array.isArray((res.data as { offers?: SbhOffer[] }).offers)) {
      rawOffers = (res.data as { offers?: SbhOffer[] }).offers!;
    }

    const supplierOffers: SupplierOffer[] = [];
    for (const offer of rawOffers) {
      if ((offer.kind || '').toLowerCase() !== 'data') continue;
      const packages = Array.isArray(offer.packages) ? offer.packages : [];
      for (const pkg of packages) {
        const wholesaleCost = parseMinorAmount(pkg.priceMinor) ?? 0;
        supplierOffers.push({
          supplierCode: offer.slug || offer.id || offer.name,
          network: offer.network,
          dataAmount: pkg.sizeLabel,
          wholesalePricePesewas: wholesaleCost,
        });
      }
    }
    return supplierOffers;
  }

  /**
   * Retrieves raw catalog offers
   */
  async getRawCatalog(skipCache = false): Promise<SbhOffer[]> {
    const res = await this.client.getCatalog(skipCache);
    if (Array.isArray(res.data)) {
      return res.data;
    }
    if (res.data && Array.isArray((res.data as { offers?: SbhOffer[] }).offers)) {
      return (res.data as { offers?: SbhOffer[] }).offers!;
    }
    return [];
  }

  /**
   * Check if data services are active and available in /services
   */
  async checkServicesAvailable(): Promise<{ available: boolean; reason?: string }> {
    try {
      const res = await this.client.getServices();
      const list = Array.isArray(res.data)
        ? res.data
        : (res.data as { services?: unknown[] })?.services || [];

      // If service list has entries, verify at least one data service is available
      if (list.length > 0) {
        const dataServices = (list as Array<{ kind?: string; enabled?: boolean; available?: boolean }>).filter(
          (s) => (s.kind || '').toLowerCase() === 'data'
        );
        if (dataServices.length > 0) {
          const anyActive = dataServices.some((s) => s.enabled !== false && s.available !== false);
          if (!anyActive) {
            return { available: false, reason: 'Supplier data service is temporarily marked unavailable.' };
          }
        }
      }
      return { available: true };
    } catch (err) {
      return {
        available: false,
        reason: err instanceof Error ? err.message : 'Unable to query supplier services.',
      };
    }
  }

  /**
   * Check beneficiary eligibility via /beneficiary-check with offer selector
   * Supports:
   * A) data.results: [{ phone, eligible, reason }]
   * B) data: [{ phone, eligible, reason }]
   * C) data: { eligible, reason }
   * Strictly requires explicit eligible === true. Never infers from status/success.
   */
  async checkBeneficiaryEligibility(
    phone: string,
    offerSelector?: { offerSlug?: string; offerId?: string }
  ): Promise<{ eligible: boolean; reason?: string }> {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const formatted = cleanPhone.startsWith('233') ? `0${cleanPhone.slice(3)}` : cleanPhone;
    const targetNorm = normalizeGhanaPhoneForComparison(formatted);
    const maskedPhone = targetNorm.length >= 4 ? `***${targetNorm.slice(-4)}` : '***';

    try {
      const res = await this.client.checkBeneficiary([formatted], offerSelector);

      let isEligible: boolean | null = null;
      let reason: string | undefined;
      let hasDataResults = false;
      let resultCount = 0;
      let matchedPhone: string | undefined;

      const rawData = res.data as
        | { results?: Array<{ phone?: string; eligible?: unknown; reason?: string }>; eligible?: unknown; reason?: string }
        | Array<{ phone?: string; eligible?: unknown; reason?: string }>
        | undefined;

      // Shape A: data.results array
      if (rawData && typeof rawData === 'object' && !Array.isArray(rawData) && Array.isArray(rawData.results)) {
        hasDataResults = true;
        resultCount = rawData.results.length;

        // Find entry matching requested phone
        let matched = rawData.results.find(
          (item) => item.phone && normalizeGhanaPhoneForComparison(item.phone) === targetNorm
        );

        // If only 1 result exists for the single phone submitted, allow use
        if (!matched && resultCount === 1) {
          const single = rawData.results[0];
          if (!single.phone || normalizeGhanaPhoneForComparison(single.phone) === targetNorm) {
            matched = single;
          }
        }

        if (matched) {
          matchedPhone = matched.phone;
          if (typeof matched.eligible === 'boolean') {
            isEligible = matched.eligible === true;
            reason = matched.reason;
          }
        }
      }
      // Shape B: data is an array
      else if (Array.isArray(rawData)) {
        resultCount = rawData.length;

        let matched = rawData.find(
          (item) => item.phone && normalizeGhanaPhoneForComparison(item.phone) === targetNorm
        );

        if (!matched && resultCount === 1) {
          const single = rawData[0];
          if (!single.phone || normalizeGhanaPhoneForComparison(single.phone) === targetNorm) {
            matched = single;
          }
        }

        if (matched) {
          matchedPhone = matched.phone;
          if (typeof matched.eligible === 'boolean') {
            isEligible = matched.eligible === true;
            reason = matched.reason;
          }
        }
      }
      // Shape C: data.eligible is direct boolean
      else if (rawData && typeof rawData === 'object' && typeof rawData.eligible === 'boolean') {
        isEligible = rawData.eligible === true;
        reason = rawData.reason;
      }
      // Direct root eligible boolean fallback
      else if (typeof res.eligible === 'boolean') {
        isEligible = res.eligible === true;
        reason = res.message;
      }

      // Safe server diagnostic logging (never logs API keys, secrets, or full credentials)
      console.info(
        `[SBH Beneficiary Check] Phone: ${maskedPhone}, hasDataResults: ${hasDataResults}, resultCount: ${resultCount}, matched: ${matchedPhone ? '***' + matchedPhone.slice(-4) : 'none'}, eligible: ${isEligible ?? 'undefined'}, reason: ${reason || 'none'}`
      );

      // Explicit eligible boolean requirement (Never infer from status === 'success')
      if (isEligible === null) {
        console.warn(
          `[SBH Beneficiary Check] Beneficiary response did not contain an explicit eligibility result for phone ${maskedPhone}.`
        );
        return {
          eligible: false,
          reason: 'Beneficiary response did not contain an explicit eligibility result.',
        };
      }

      return { eligible: isEligible, reason };
    } catch (err) {
      console.error(
        `[SBH Beneficiary Check] Error checking beneficiary eligibility for phone ${maskedPhone}:`,
        err instanceof Error ? err.message : err
      );
      return {
        eligible: false,
        reason: err instanceof Error ? err.message : 'Beneficiary eligibility check failed.',
      };
    }
  }

  /**
   * Resolves live catalog offer and package for an order
   */
  async resolvePackage(
    network: string,
    bundleSize: string
  ): Promise<{ resolved: ResolvedSupplierPackage | null; error?: string }> {
    const rawOffers = await this.getRawCatalog();
    return resolveSupplierPackage(rawOffers, network, bundleSize);
  }

  /**
   * 3. POST /orders
   * Dispatches data order to Success Biz Hub.
   * Body contains ONLY: msisdn, data, offerSlug OR offerId.
   * Never sends retail price or customer name.
   */
  async placeOrder(request: SupplierOrderRequest): Promise<SupplierOrderResponse> {
    // 1. Resolve live package
    // request.productId e.g. "mtn-1gb-7d", or data amount e.g. "1GB"
    const resolution = await this.resolvePackage(request.network, request.productId);
    if (!resolution.resolved) {
      return {
        success: false,
        status: 'failed',
        errorMessage: resolution.error || 'Failed to resolve supplier package.',
      };
    }

    const { offerSlug, offerId, sizeLabel } = resolution.resolved;

    // 2. Format recipient phone
    const cleanPhone = request.recipientPhone.replace(/[^\d]/g, '');
    const msisdn = cleanPhone.startsWith('233') ? `0${cleanPhone.slice(3)}` : cleanPhone;

    // 3. Post to Success Biz Hub
    try {
      const orderPayload: { msisdn: string; data: string; offerSlug?: string; offerId?: string } = {
        msisdn,
        data: sizeLabel,
      };
      if (offerSlug) {
        orderPayload.offerSlug = offerSlug;
      } else if (offerId) {
        orderPayload.offerId = offerId;
      }

      const res = await this.client.createOrder(orderPayload);
      const data = res.data || {};
      const supplierOrderId = data.publicId || data.id;
      const status = this.mapSupplierStatus(data.status);

      return {
        success: true,
        supplierOrderId,
        status,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const isTimeout = Boolean((err as { isTimeout?: boolean })?.isTimeout);
      const errorMessage = err instanceof Error ? err.message : 'Supplier order placement failed.';

      return {
        success: false,
        status: 'failed',
        errorMessage,
        rawResponse: {
          isTimeout,
          error: errorMessage,
        },
      };
    }
  }

  /**
   * Check if Airtime service is available via GET /services
   */
  async checkAirtimeAvailable(): Promise<{ available: boolean; reason?: string }> {
    try {
      const res = await this.client.getServices();
      let services: Array<{ kind?: string; slug?: string; name?: string; enabled?: boolean; available?: boolean }> = [];
      if (Array.isArray(res.data)) {
        services = res.data;
      } else if (res.data && Array.isArray((res.data as { services?: any[] }).services)) {
        services = (res.data as { services?: any[] }).services!;
      }

      if (services.length > 0) {
        const airtimeService = services.find(
          (s) =>
            (s.slug && s.slug.toLowerCase().includes('airtime')) ||
            (s.kind && s.kind.toLowerCase() === 'airtime') ||
            (s.name && s.name.toLowerCase().includes('airtime'))
        );

        if (airtimeService) {
          const isEnabled = airtimeService.enabled !== false && airtimeService.available !== false;
          if (!isEnabled) {
            return { available: false, reason: 'Airtime service is currently disabled on supplier.' };
          }
        }
      }

      return { available: true };
    } catch (err) {
      console.warn('[SBH Provider] Unable to query services endpoint for airtime availability:', err);
      return { available: true }; // Soft fallback if services endpoint is transiently slow
    }
  }

  /**
   * 4. GET /orders/:identifier
   * Retrieves supplier order status
   */
  async getOrderStatus(supplierOrderId: string): Promise<SupplierOrderResponse> {
    try {
      const res = await this.client.getOrder(supplierOrderId);
      const data = res.data || {};
      const status = this.mapSupplierStatus(data.status);

      return {
        success: true,
        supplierOrderId: data.publicId || data.id || supplierOrderId,
        status,
        rawResponse: data,
        errorMessage: data.failureReason,
      };
    } catch (err) {
      return {
        success: false,
        status: 'processing', // Keep non-terminal on lookup error
        supplierOrderId,
        errorMessage: err instanceof Error ? err.message : 'Failed to query supplier order status.',
      };
    }
  }

  /**
   * 5. POST /airtime
   * Places an airtime top-up order.
   * Body: { network, phone, amountMajor }
   * Never sends packageId. Face value is passed in amountMajor.
   */
  async placeAirtime(request: SupplierAirtimeRequest): Promise<SupplierAirtimeResponse> {
    const netRaw = (request.network || '').toLowerCase().trim();
    const network = netRaw === 'at' ? 'airteltigo' : netRaw;

    const cleanPhone = request.recipientPhone.replace(/[^\d]/g, '');
    const phone = cleanPhone.startsWith('233') ? `0${cleanPhone.slice(3)}` : cleanPhone;

    try {
      const res = await this.client.createAirtime({
        network,
        phone,
        amountMajor: request.amountMajor,
      });

      const data = res.data || {};
      const supplierOrderId = data.publicId || data.id;
      const status = this.mapSupplierStatus(data.status);

      const parsedAmountMinor = parseMinorAmount(data.amountMinor) ?? undefined;
      const parsedChargeMinor = parseMinorAmount(data.chargeMinor) ?? undefined;

      return {
        success: true,
        supplierOrderId,
        status,
        amountMinor: parsedAmountMinor,
        chargeMinor: parsedChargeMinor,
        rawResponse: data,
        errorMessage: data.failureReason,
      };
    } catch (err: unknown) {
      const isTimeout = Boolean((err as { isTimeout?: boolean })?.isTimeout);
      const errorMessage = err instanceof Error ? err.message : 'Supplier airtime placement failed.';

      return {
        success: false,
        status: 'failed',
        errorMessage,
        rawResponse: {
          isTimeout,
          error: errorMessage,
        },
      };
    }
  }

  /**
   * 6. GET /airtime/:identifier
   * Retrieves airtime order status.
   */
  async getAirtimeStatus(supplierOrderId: string): Promise<SupplierAirtimeResponse> {
    try {
      const res = await this.client.getAirtime(supplierOrderId);
      const data = res.data || {};
      const status = this.mapSupplierStatus(data.status);

      const parsedAmountMinor = parseMinorAmount(data.amountMinor) ?? undefined;
      const parsedChargeMinor = parseMinorAmount(data.chargeMinor) ?? undefined;

      return {
        success: true,
        supplierOrderId: data.publicId || data.id || supplierOrderId,
        status,
        amountMinor: parsedAmountMinor,
        chargeMinor: parsedChargeMinor,
        rawResponse: data,
        errorMessage: data.failureReason,
      };
    } catch (err) {
      return {
        success: false,
        status: 'processing', // Keep non-terminal on lookup error
        supplierOrderId,
        errorMessage: err instanceof Error ? err.message : 'Failed to query supplier airtime status.',
      };
    }
  }

  /**
   * 7. POST /instant-bundles
   * Places an instant bundle order. Never send retail prices to supplier.
   */
  async placeInstantBundle(request: {
    internalOrderId: string;
    publicReference: string;
    packageId: string;
    phone: string;
    amountMajor?: number | string;
  }): Promise<{
    success: boolean;
    supplierOrderId?: string;
    status: 'queued' | 'submitted' | 'processing' | 'delivered' | 'failed';
    amountMinor?: number;
    chargeMinor?: number;
    rawResponse?: unknown;
    errorMessage?: string;
  }> {
    try {
      const res = await this.client.createInstantBundle({
        packageId: request.packageId,
        phone: request.phone,
        amountMajor: request.amountMajor,
      });

      const data = res.data || {};
      const supplierOrderId = data.publicId || data.orderId || data.id;
      const status = this.mapSupplierStatus(data.status);

      const parsedAmountMinor = parseMinorAmount(data.amountMinor) ?? undefined;
      const parsedChargeMinor = parseMinorAmount(data.chargeMinor) ?? undefined;

      return {
        success: true,
        supplierOrderId,
        status,
        amountMinor: parsedAmountMinor,
        chargeMinor: parsedChargeMinor,
        rawResponse: data,
        errorMessage: data.failureReason,
      };
    } catch (err: unknown) {
      const isTimeout = Boolean((err as { isTimeout?: boolean })?.isTimeout);
      const errorMessage = err instanceof Error ? err.message : 'Supplier instant bundle placement failed.';
      const errorObj = err as unknown as { isTimeout?: boolean; statusCode?: number; responseBody?: unknown };

      return {
        success: false,
        status: 'failed',
        errorMessage,
        rawResponse: {
          isTimeout,
          statusCode: errorObj.statusCode,
          responseBody: errorObj.responseBody,
          error: errorMessage,
        },
      };
    }
  }

  /**
   * 8. GET /instant-bundles/:identifier
   * Retrieves instant bundle order status.
   */
  async getInstantBundleStatus(supplierOrderId: string): Promise<{
    success: boolean;
    supplierOrderId?: string;
    status: 'queued' | 'submitted' | 'processing' | 'delivered' | 'failed';
    amountMinor?: number;
    chargeMinor?: number;
    rawResponse?: unknown;
    errorMessage?: string;
  }> {
    try {
      const res = await this.client.getInstantBundle(supplierOrderId);
      const data = res.data || {};
      const status = this.mapSupplierStatus(data.status);

      const parsedAmountMinor = parseMinorAmount(data.amountMinor) ?? undefined;
      const parsedChargeMinor = parseMinorAmount(data.chargeMinor) ?? undefined;

      return {
        success: true,
        supplierOrderId: data.publicId || data.orderId || data.id || supplierOrderId,
        status,
        amountMinor: parsedAmountMinor,
        chargeMinor: parsedChargeMinor,
        rawResponse: data,
        errorMessage: data.failureReason,
      };
    } catch (err) {
      return {
        success: false,
        status: 'processing', // Keep non-terminal on lookup error
        supplierOrderId,
        errorMessage: err instanceof Error ? err.message : 'Failed to query supplier instant bundle status.',
      };
    }
  }
}
