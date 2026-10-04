import { MARKETPLACE_LIMITS } from '../../shared/marketplaceLimits.js';
import { MarketplaceProductRecord, parseJsonPickupLocations } from '../types/marketplace.js';
import { MarketplaceInputError, plainText } from '../db/marketplaceControlStore.js';
import { FULFILMENT_MODES, encouragesCredentials } from '../../shared/marketplacePolicy.js';

export function marketplaceFulfilment(product: MarketplaceProductRecord, body: Record<string,unknown>) {
  const kind = product.product_kind || 'physical'; const mode = product.fulfilment_mode || 'both';
  const method = body.fulfilmentMethod;
  if (mode === 'inquiry_only' || product.price_type === 'quote' || product.purchase_enabled === false) throw new MarketplaceInputError('This product requires an inquiry.');
  if (!FULFILMENT_MODES[kind]?.includes(mode)) throw new MarketplaceInputError('Product fulfilment needs administrator review.');
  if (Object.keys(body).some(key => /password|passcode|credential|otp|pin$/i.test(key))) throw new MarketplaceInputError('External credentials are never accepted.');
  let selectedPickupId: string | null = null; let selectedPickupSnapshot: string | null = null;
  let deliveryCity: string | null = null; let deliveryArea: string | null = null; let deliveryLandmark: string | null = null; let deliveryNote: string | null = null;
  if (kind === 'physical') {
    if (method !== 'pickup' && method !== 'delivery') throw new MarketplaceInputError('Please choose pickup or delivery.');
    if (method === 'pickup') {
      if (mode === 'delivery') throw new MarketplaceInputError('Pickup is not available.');
      const loc = parseJsonPickupLocations(product.pickup_locations).find(l=>l.id === body.pickupLocationId && l.active !== false);
      if (!loc || !loc.name || !loc.city || !loc.area) throw new MarketplaceInputError('Please select an active, valid pickup location.');
      selectedPickupId = plainText(loc.id,'Pickup location ID',MARKETPLACE_LIMITS.pickupId,true); selectedPickupSnapshot = `${loc.name} (${loc.area}, ${loc.city}${loc.addressOrLandmark ? ` · ${loc.addressOrLandmark}` : ''})`;
    } else {
      if (mode === 'pickup' || product.delivery_available === false) throw new MarketplaceInputError('Delivery is not available.');
      deliveryCity = plainText(body.deliveryCity,'Delivery city',100,true); deliveryArea = plainText(body.deliveryArea,'Delivery area',MARKETPLACE_LIMITS.deliveryArea,true);
      deliveryLandmark = plainText(body.deliveryLandmark,'Landmark',300); deliveryNote = plainText(body.deliveryNote,'Delivery note',500);
    }
  } else if (method !== mode) throw new MarketplaceInputError('Please use the configured digital or service fulfilment method.');
  if(body.variantId !== undefined)plainText(body.variantId,'Option ID',MARKETPLACE_LIMITS.variantId,true);
  const identifier = plainText(body.fulfilmentIdentifier,'Customer identifier',200,product.fulfilment_identifier_required === true);
  if (identifier && !product.fulfilment_identifier_label) throw new MarketplaceInputError('This product does not request an identifier.');
  if (encouragesCredentials([product.fulfilment_identifier_label,product.fulfilment_identifier_placeholder,product.fulfilment_note,product.purchase_note].join(' ')) || /(?:password|passcode|otp|secret|pin)\s*[:=]/i.test(identifier)) throw new MarketplaceInputError('External passwords and security codes are never accepted.');
  const context = { productKind:kind,fulfilmentMode:mode,productId:product.id,productSlug:product.slug,productName:product.name,
    identifierLabel:identifier ? product.fulfilment_identifier_label : null,identifierValue:identifier || null,
    purchaseNote:product.purchase_note || null,fulfilmentNote:product.fulfilment_note || null };
  return {method:method as 'pickup'|'delivery'|'digital_delivery'|'manual_activation',selectedPickupId,selectedPickupSnapshot,deliveryCity,deliveryArea,deliveryLandmark,deliveryNote,context};
}
