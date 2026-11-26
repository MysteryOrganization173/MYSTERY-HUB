import { ServiceControlService } from './serviceControlService.js';
/**
 * 3.4.1 Smart Buy Again. From one of the signed-in customer's own delivered orders, finds the product that order was
 * for, by the product id stored on the order (never by its name or historical price), and checks that the product is
 * still sold today. The answer opens an ordinary checkout review: the checkout fetches the current server quote, and
 * payment initialization re-validates and re-prices everything. Nothing here creates an order or a charge.
 *
 * Only public catalogue facts leave this module: no supplier cost, payable ratio, margin, route or internal note.
 */
import type { OrderRecord } from '../types/orders.js';
import { getAuthoritativeProduct } from '../data/productCatalog.js';
import { CommercialService } from './commercialService.js';
import { calculateAirtimeOrder, validateAirtimeAmount } from '../data/airtimePricing.js';
import { toPublicInstantBundle, type PublicInstantBundle } from '../data/instantBundlePricing.js';
import type { SbhInstantBundlePackage } from '../suppliers/successBizHub/types.js';
import { FulfilmentService } from './fulfilmentService.js';

export type ReorderKind = 'data' | 'airtime' | 'instant_bundle';
export type ReorderNetwork = 'mtn' | 'telecel' | 'airteltigo';
export type ReorderUnavailableReason =
  | 'not_completed'      // not delivered, still moving, failed, refunded, or under review
  | 'not_repeatable'     // a service Buy Again does not cover, or a purchase from a business website
  | 'unidentifiable'     // the order carries no product we can match
  | 'discontinued'       // the product is no longer in the catalogue
  | 'unavailable'        // in the catalogue but switched off or out of stock today
  | 'choose_amount'      // a flexible-amount bundle: the customer chooses the amount again
  | 'service_unavailable'; // the service cannot be checked right now

export type PublicDataReorderProduct = { id: string; network: ReorderNetwork; dataAmount: string; validity?: string };
export type ReorderAnswer = { reference: string; recipientPhone: string; network: ReorderNetwork | null } & (
  | { available: true; kind: 'data'; product: PublicDataReorderProduct }
  | { available: true; kind: 'airtime'; network: ReorderNetwork; airtime: { faceValueGhc: number; serviceFeeGhc: number; totalGhc: number } }
  | { available: true; kind: 'instant_bundle'; product: Omit<PublicInstantBundle, 'recipientAlternative'> }
  | { available: false; kind: ReorderKind | null; reason: ReorderUnavailableReason }
);

const NETWORKS: readonly ReorderNetwork[] = ['mtn', 'telecel', 'airteltigo'];
const asNetwork = (value: unknown): ReorderNetwork | null => (NETWORKS as readonly unknown[]).includes(value) ? value as ReorderNetwork : null;
const kindOf = (order: OrderRecord): ReorderKind | null => {
  const service = order.service_type ?? 'data';
  return service === 'data' || service === 'airtime' || service === 'instant_bundle' ? service : null;
};

/** Delivered and settled, with nothing open: the only orders Buy Again repeats. */
export function reorderableOrder(order: OrderRecord): boolean {
  return order.status === 'delivered'
    && ['success', 'not_required', 'recorded'].includes(order.payment_status)
    && order.manual_review !== true
    && !order.resolution_json?.outcome
    && !order.resolution_json?.stage;
}

export interface InstantCatalogue { available: boolean; packages: SbhInstantBundlePackage[] }

/** The live Instant Bundles catalogue, exactly as payment initialization reads it. */
export async function liveInstantCatalogue(): Promise<InstantCatalogue> {
  const provider = FulfilmentService.getProvider();
  const check = await provider.client.checkInstantBundlesService();
  if (!check.permitted || !check.available) return { available: false, packages: [] };
  const response = await provider.client.getInstantBundles();
  const data = response.data as SbhInstantBundlePackage[] | { packages?: SbhInstantBundlePackage[]; products?: SbhInstantBundlePackage[] } | undefined;
  const packages = Array.isArray(data) ? data : Array.isArray(data?.packages) ? data!.packages! : Array.isArray(data?.products) ? data!.products! : [];
  return { available: true, packages };
}

export interface ReorderDependencies {
  dataCatalogue: () => Promise<{ products: { id: string; network: string; dataAmount: string; validity?: string }[] }>;
  instantCatalogue: () => Promise<InstantCatalogue>;
}
const live: ReorderDependencies = { dataCatalogue: () => CommercialService.catalog(), instantCatalogue: liveInstantCatalogue };

/**
 * Answers for an order the caller has already proved belongs to the signed-in customer. Unavailable answers carry a
 * reason so the customer is told why and taken to the right catalogue instead.
 */
export async function resolveReorder(order: OrderRecord, deps: ReorderDependencies = live): Promise<ReorderAnswer> {
  const kind = kindOf(order);
  const base = { reference: order.public_reference, recipientPhone: order.recipient_phone, network: asNetwork(order.network) };
  const no = (reason: ReorderUnavailableReason, network = base.network): ReorderAnswer => ({ ...base, network, available: false, kind, reason });
  if (!kind || order.store_context) return no('not_repeatable');
  if (!reorderableOrder(order)) return no('not_completed');

  if (kind === 'data') {
    // Legacy ids map through the catalogue's own alias table; an unknown or retired id is never guessed from a name.
    const product = getAuthoritativeProduct(order.product_id);
    if (!product) return no('discontinued');
    const current = (await deps.dataCatalogue()).products.find(p => p.id === product.id);
    const network = asNetwork(current?.network ?? product.network);
    if (!current || !network) return no('unavailable', network ?? base.network);
    return { ...base, network, available: true, kind, product: { id: current.id, network, dataAmount: current.dataAmount, ...(current.validity ? { validity: current.validity } : {}) } };
  }

  if (kind === 'airtime') {
    // The face value the customer chose last time; today's fee comes from today's calculation, not the old order.
    const network = base.network;
    const face = typeof order.face_value_minor === 'number' && Number.isSafeInteger(order.face_value_minor) ? order.face_value_minor / 100 : NaN;
    if (!network || !validateAirtimeAmount(face).isValid) return no('unidentifiable');
    // 3.6.3: a network whose Airtime is paused in the Service Control Center cannot be bought again for now.
    if (await ServiceControlService.purchaseBlock('airtime', network)) return no('unavailable');
    const today = calculateAirtimeOrder(face);
    return { ...base, network, available: true, kind, airtime: { faceValueGhc: today.faceValueGhc, serviceFeeGhc: today.serviceFeeGhc, totalGhc: today.totalGhc } };
  }

  // Instant Bundles: the stored product id is `instant-<package id>`, as payment initialization writes it.
  if (!/^instant-[\w.-]+$/.test(order.product_id || '')) return no('unidentifiable');
  let catalogue: InstantCatalogue;
  try { catalogue = await deps.instantCatalogue(); } catch { return no('service_unavailable'); }
  if (!catalogue.available) return no('service_unavailable');
  const pkg = catalogue.packages.find(p => `instant-${p.id}` === order.product_id);
  if (!pkg) return no('discontinued');
  if (pkg.enabled === false) return no('unavailable');
  const product = toPublicInstantBundle(pkg);
  if (!product || product.availability !== 'in_stock') return no('unavailable', asNetwork(product?.network) ?? base.network);
  // 3.6.3: a network whose Instant Bundles are paused in the Service Control Center cannot be bought again for now.
  if (await ServiceControlService.purchaseBlock('instant_bundle', product.network)) return no('unavailable', product.network);
  if (product.isFlexi) return no('choose_amount', product.network);
  const { recipientAlternative: _evidence, ...publicProduct } = product;
  return { ...base, network: product.network, available: true, kind, product: publicProduct };
}
