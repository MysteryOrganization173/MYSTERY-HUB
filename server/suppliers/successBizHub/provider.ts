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
} from '../supplierInterface.js';
import { SuccessBizHubClient } from './client.js';
import { resolveSupplierPackage, ResolvedSupplierPackage } from './catalogResolver.js';
import { SbhOffer } from './types.js';
import { parseMinorAmount } from './money.js';

export class SuccessBizHubProvider implements SupplierProvider {
  providerId = 'success_biz_hub';
  providerName = 'Success Biz Hub API v2';

  constructor(public readonly client: SuccessBizHubClient = new SuccessBizHubClient()) {}

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
    if (s === 'processed' || s === 'completed' || s === 'success') {
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
   */
  async checkBeneficiaryEligibility(
    phone: string,
    offerSelector?: { offerSlug?: string; offerId?: string }
  ): Promise<{ eligible: boolean; reason?: string }> {
    try {
      // Success Biz Hub expects 10-digit local or standard formatted phone
      const cleanPhone = phone.replace(/[^\d]/g, '');
      const formatted = cleanPhone.startsWith('233') ? `0${cleanPhone.slice(3)}` : cleanPhone;

      const res = await this.client.checkBeneficiary([formatted], offerSelector);

      // Parse response format: either { data: [{ phone, eligible, reason }] } or { eligible: true }
      let isEligible = false;
      let reason: string | undefined;

      if (Array.isArray(res.data) && res.data.length > 0) {
        const item = res.data[0];
        isEligible = item.eligible === true;
        reason = item.reason;
      } else if (res.data && typeof (res.data as { eligible?: boolean }).eligible === 'boolean') {
        isEligible = (res.data as { eligible: boolean }).eligible;
        reason = (res.data as { reason?: string }).reason;
      } else if (typeof res.eligible === 'boolean') {
        isEligible = res.eligible;
        reason = res.message;
      } else {
        // Fallback: if status === "success" without explicit false, consider eligible
        isEligible = res.status === 'success';
      }

      return { eligible: isEligible, reason };
    } catch (err) {
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
}
