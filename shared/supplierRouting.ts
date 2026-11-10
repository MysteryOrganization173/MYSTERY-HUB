/** Public-to-Admin contract only; contains no credentials, costs or customer data. */
export const SUPPLIER_SERVICES = ['data', 'airtime', 'instant_bundle'] as const;
export const SUPPLIER_NETWORKS = ['mtn', 'telecel', 'airteltigo'] as const;
export type SupplierService = typeof SUPPLIER_SERVICES[number];
export type SupplierNetwork = typeof SUPPLIER_NETWORKS[number];
export type SupplierId = 'success_biz_hub' | 'telcogh';
export interface SupplierRoutingOverview {
  mode: 'read_only';
  providers: {
    id: SupplierId;
    name: string;
    implementedServices: readonly SupplierService[];
    plannedServices: readonly SupplierService[];
    networks: readonly SupplierNetwork[];
    configured: boolean;
    qualified: boolean;
    acceptsNewOrders: boolean;
    restriction: string;
  }[];
  routes: { service: SupplierService; network: SupplierNetwork; providerId: SupplierId }[];
}

export function isSupplierRoutingOverview(value: unknown): value is SupplierRoutingOverview {
  const v = value as SupplierRoutingOverview | null;
  const ids = ['success_biz_hub', 'telcogh'];
  const services = (list: unknown) => Array.isArray(list) && list.length <= 3 && list.every(s => SUPPLIER_SERVICES.includes(s));
  return !!v && v.mode === 'read_only' && Array.isArray(v.providers) && v.providers.length === 2 && new Set(v.providers.map(p => p?.id)).size === 2 && v.providers.every(p =>
    p && ids.includes(p.id) && typeof p.name === 'string' && services(p.implementedServices) && services(p.plannedServices) && Array.isArray(p.networks) && p.networks.length <= 3 && p.networks.every(n => SUPPLIER_NETWORKS.includes(n)) && ['configured','qualified','acceptsNewOrders'].every(k => typeof (p as any)[k] === 'boolean') && typeof p.restriction === 'string') &&
    Array.isArray(v.routes) && v.routes.length <= 9 && v.routes.every(r => r && SUPPLIER_SERVICES.includes(r.service) && SUPPLIER_NETWORKS.includes(r.network) && ids.includes(r.providerId));
}
