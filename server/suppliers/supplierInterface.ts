/**
 * Universal Supplier Integration Interface & Boundary
 * Abstract interface for data & utility fulfillment providers.
 * Success Biz Hub (or future providers like Hubtel) will implement this interface.
 */

export interface SupplierOffer {
  supplierCode: string;
  network: string;
  dataAmount: string;
  wholesalePricePesewas: number;
}

export interface SupplierOrderRequest {
  internalOrderId: string;
  publicReference: string;
  recipientPhone: string;
  network: string;
  productId: string;
  amountPesewas: number;
}

export interface SupplierOrderResponse {
  success: boolean;
  supplierOrderId?: string;
  status: 'queued' | 'submitted' | 'processing' | 'delivered' | 'failed';
  rawResponse?: unknown;
  errorMessage?: string;
}

export interface SupplierBalance {
  providerName: string;
  currency: 'GHS';
  balancePesewas: number;
  balanceGhc: number;
}

export interface SupplierProvider {
  providerId: string;
  providerName: string;

  getBalance(): Promise<SupplierBalance>;
  getOffers(): Promise<SupplierOffer[]>;
  placeOrder(request: SupplierOrderRequest): Promise<SupplierOrderResponse>;
  getOrderStatus(supplierOrderId: string): Promise<SupplierOrderResponse>;
}

/**
 * Placeholder Provider for Unconfigured State
 * Explicitly notifies system that supplier fulfillment is not yet enabled.
 * Paid orders remain cleanly in 'paid' or 'queued' state without pretending delivery occurred.
 */
export class UnconfiguredSupplierProvider implements SupplierProvider {
  providerId = 'unconfigured';
  providerName = 'Unconfigured Supplier Provider';

  async getBalance(): Promise<SupplierBalance> {
    throw new Error('Supplier integration not configured.');
  }

  async getOffers(): Promise<SupplierOffer[]> {
    return [];
  }

  async placeOrder(_request: SupplierOrderRequest): Promise<SupplierOrderResponse> {
    return {
      success: false,
      status: 'queued',
      errorMessage: 'Supplier integration not configured.',
    };
  }

  async getOrderStatus(_supplierOrderId: string): Promise<SupplierOrderResponse> {
    throw new Error('Supplier integration not configured.');
  }
}

let activeSupplier: SupplierProvider = new UnconfiguredSupplierProvider();

export function getActiveSupplierProvider(): SupplierProvider {
  return activeSupplier;
}

export function setActiveSupplierProvider(provider: SupplierProvider): void {
  activeSupplier = provider;
}
