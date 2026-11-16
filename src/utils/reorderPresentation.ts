import type { DataBundle, NetworkId } from '../types';
import type { ReorderAnswer, ReorderUnavailableReason } from '../../server/services/reorderService';
import { GHANA_NETWORKS } from '../data/bundles';
import { formatGhanaPhone } from './checkoutRecovery';
import { instantBundleToCheckout } from './instantBundleCheckout';

/**
 * 3.4.1 Smart Buy Again, client side. Turns the server's answer into one of two things:
 * - an ordinary checkout review for today's product, with the network and recipient filled in; or
 * - a short explanation and the right catalogue (tab and network) when the product cannot be repeated as it was.
 * The order's old price is never used: Data totals come from the checkout's own server quote, Airtime and Instant
 * figures from today's catalogue, and payment initialization prices everything again.
 */
export type ReorderAction =
  | { type: 'checkout'; bundle: DataBundle; recipientPhone: string }
  | { type: 'catalogue'; mode: 'data' | 'instant' | 'airtime'; network: NetworkId | 'all'; message: string };

const SHORT_NAME: Record<NetworkId, string> = { mtn: 'MTN', telecel: 'Telecel', airteltigo: 'AirtelTigo' };

export function reorderMessage(reason: ReorderUnavailableReason, kind: ReorderAnswer['kind'], network: NetworkId | null): string {
  const net = network ? SHORT_NAME[network] + ' ' : '';
  const things = kind === 'airtime' ? 'airtime' : `${net}bundles`;
  switch (reason) {
    case 'not_completed': return 'Only delivered orders can be bought again. Choose what you need here.';
    case 'not_repeatable': return 'This order can’t be repeated from here. Choose what you need here.';
    case 'unidentifiable': return kind === 'airtime' ? 'We couldn’t read the amount from that order. Choose the amount again.' : `We couldn’t match that order to a current product. Here are today’s ${things}.`;
    case 'discontinued': return `That bundle is no longer sold. Here are today’s ${things}.`;
    case 'unavailable': return `That bundle isn’t available right now. Here are today’s ${things}.`;
    case 'choose_amount': return `Choose the amount again for this flexible ${net}bundle.`;
    case 'service_unavailable': return 'Instant Bundles can’t be checked right now. Please try again shortly.';
  }
}

export function reorderAction(answer: ReorderAnswer, catalogue: readonly DataBundle[]): ReorderAction {
  const recipientPhone = formatGhanaPhone(answer.recipientPhone || '');
  if (!answer.available) {
    const mode = answer.kind === 'airtime' ? 'airtime' : answer.kind === 'instant_bundle' ? 'instant' : 'data';
    return { type: 'catalogue', mode, network: answer.network ?? 'all', message: reorderMessage(answer.reason, answer.kind, answer.network) };
  }
  if (answer.kind === 'data') {
    const { product } = answer;
    // Static presentation (validity, labels) from the catalogue the page already shows; identity from the server.
    const known = catalogue.find(b => b.id === product.id);
    const bundle: DataBundle = known
      ? { ...known, network: product.network, dataAmount: product.dataAmount }
      : { id: product.id, network: product.network, dataAmount: product.dataAmount, dataBytesValue: 0, validity: product.validity || '', validityCategory: 'Monthly', priceGhc: 0 };
    return { type: 'checkout', bundle, recipientPhone };
  }
  if (answer.kind === 'airtime') {
    const { faceValueGhc, serviceFeeGhc, totalGhc } = answer.airtime;
    // The same checkout bundle the Airtime form builds, with today's fee from the server.
    return { type: 'checkout', recipientPhone, bundle: {
      id: `airtime-${answer.network}-${faceValueGhc}`,
      network: answer.network,
      serviceType: 'airtime',
      dataAmount: `GH₵${faceValueGhc.toFixed(2)} Airtime`,
      dataBytesValue: 0,
      validity: 'Direct Credit',
      validityCategory: 'Daily',
      priceGhc: totalGhc,
      faceValueGhc,
      serviceFeeGhc,
      description: `Direct airtime recharge on ${GHANA_NETWORKS[answer.network].name}`,
    } };
  }
  return { type: 'checkout', bundle: instantBundleToCheckout(answer.product), recipientPhone };
}
