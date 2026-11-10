import type { SupplierProvider } from './supplierInterface.js';
import { SUPPLIER_NETWORKS, SUPPLIER_SERVICES, type SupplierId, type SupplierNetwork, type SupplierService } from '../../shared/supplierRouting.js';

export class SupplierRoutingError extends Error {
  constructor(public readonly code: 'UNKNOWN_PROVIDER' | 'UNAVAILABLE_PROVIDER' | 'UNSUPPORTED_ROUTE' | 'INVALID_CONFIGURATION') {
    super('Supplier routing is unavailable. Retain the original order for review.');
  }
}
export interface SupplierRegistration {
  readonly id: SupplierId;
  readonly name: string;
  readonly provider: SupplierProvider | null;
  readonly services: readonly SupplierService[];
  readonly networks: readonly SupplierNetwork[];
  readonly plannedServices: readonly SupplierService[];
  readonly configured: boolean;
  readonly qualified: boolean;
  readonly acceptsNewOrders: boolean;
}
/** Immutable per-construction registry. No request may change a global active provider. */
export class SupplierRegistry {
  private readonly entries = new Map<string, SupplierRegistration>();
  constructor(registrations: readonly SupplierRegistration[]) {
    for (const entry of registrations) {
      if (!['success_biz_hub', 'telcogh'].includes(entry.id) || this.entries.has(entry.id) || entry.provider && entry.provider.providerId !== entry.id) {
        throw new SupplierRoutingError('INVALID_CONFIGURATION');
      }
      this.entries.set(entry.id, Object.freeze({ ...entry, services: Object.freeze([...entry.services]), networks: Object.freeze([...entry.networks]), plannedServices: Object.freeze([...entry.plannedServices]) }));
    }
  }
  get(id: string): SupplierRegistration {
    const entry = this.entries.get(id);
    if (!entry) throw new SupplierRoutingError('UNKNOWN_PROVIDER');
    return entry;
  }
  list(): readonly SupplierRegistration[] { return [...this.entries.values()]; }
}
export interface SupplierRouteContext { service: SupplierService; network: string; productId?: string }
export interface SupplierRoute { readonly service: SupplierService; readonly network: SupplierNetwork; readonly providerId: SupplierId; readonly productId?: string }
export const DEFAULT_SUPPLIER_ROUTES: readonly SupplierRoute[] = Object.freeze(SUPPLIER_SERVICES.flatMap(service => SUPPLIER_NETWORKS.map(network => Object.freeze({ service, network, providerId: 'success_biz_hub' as const }))));

function capability(registry: SupplierRegistry, id: string, context: SupplierRouteContext, newOrder: boolean, requireConfigured: boolean) {
  const entry = registry.get(id);
  if (!entry.provider || !entry.qualified || (newOrder && !entry.acceptsNewOrders) || (requireConfigured && !entry.configured)) throw new SupplierRoutingError('UNAVAILABLE_PROVIDER');
  if (!SUPPLIER_SERVICES.includes(context.service) || !SUPPLIER_NETWORKS.includes(context.network as SupplierNetwork) || !entry.services.includes(context.service) || !entry.networks.includes(context.network as SupplierNetwork)) throw new SupplierRoutingError('UNSUPPORTED_ROUTE');
  return entry;
}
/** Exact product routes may be added deliberately later. No fallover, cost selection or client override. */
export function resolveSupplierRoute(registry: SupplierRegistry, context: SupplierRouteContext, routes = DEFAULT_SUPPLIER_ROUTES, requireConfigured = true): SupplierRoute {
  const matches = routes.filter(r => r.service === context.service && r.network === context.network && (!r.productId || r.productId === context.productId));
  const exact = matches.filter(r => r.productId);
  const selected = exact.length ? exact : matches;
  if (selected.length !== 1) throw new SupplierRoutingError('UNSUPPORTED_ROUTE');
  const route = selected[0];
  capability(registry, route.providerId, context, true, requireConfigured);
  return Object.freeze({ ...route });
}
export interface SupplierOrderIdentity { supplier_provider?: string | null; service_type?: string | null; product_id: string; network: string }
export function telecomService(order: Pick<SupplierOrderIdentity, 'service_type' | 'product_id'>): SupplierService | null {
  if (['afa', 'results_checker', 'marketplace'].includes(order.service_type || '')) return null;
  if (order.service_type === 'airtime' || order.product_id.startsWith('airtime-')) return 'airtime';
  if (order.service_type === 'instant_bundle' || order.product_id.startsWith('instant-')) return 'instant_bundle';
  return !order.service_type || order.service_type === 'data' ? 'data' : null;
}
/** Null telecom identity predates explicit routing and was exclusively SBH. Never infer TELCOGH. */
export function legacySuccessBizHubIdentity(order: SupplierOrderIdentity): boolean {
  return order.supplier_provider == null && (telecomService(order) !== null && SUPPLIER_NETWORKS.includes(order.network as SupplierNetwork) || ['afa', 'results_checker'].includes(order.service_type || ''));
}
export function resolveOrderSupplier(registry: SupplierRegistry, order: SupplierOrderIdentity): SupplierRegistration {
  const id = order.supplier_provider || (legacySuccessBizHubIdentity(order) ? 'success_biz_hub' : '');
  const service = telecomService(order);
  if (!service) throw new SupplierRoutingError('UNSUPPORTED_ROUTE');
  // Existing orders do not use current default routes or the permission to accept NEW orders.
  return capability(registry, id, { service, network: order.network }, false, false);
}
