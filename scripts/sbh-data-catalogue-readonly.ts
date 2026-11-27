import { pathToFileURL } from 'node:url';
import { AUTHORITATIVE_PRODUCTS } from '../server/data/productCatalog.js';
import { SuccessBizHubClient } from '../server/suppliers/successBizHub/client.js';
import { isNetworkMatch, normalizeSizeLabel, resolveSupplierPackage } from '../server/suppliers/successBizHub/catalogResolver.js';
import type { SbhOffer } from '../server/suppliers/successBizHub/types.js';

type DataObject = Record<string, unknown>;
const object = (v: unknown): DataObject => v && typeof v === 'object' && !Array.isArray(v) ? v as DataObject : {};
const selector = (v: unknown) => typeof v === 'string' && /^[a-z\d_-]{1,128}$/i.test(v) ? v : null;
const validity = (v: unknown) => typeof v === 'string' && /^[a-z\d][a-z\d -]{0,39}$/i.test(v) ? v : null;
const availability = (v: DataObject) => v.enabled === false || v.available === false ? 'unavailable' :
  v.enabled === true || v.available === true ? 'reported_available' : 'not_reported';

export async function readSbhDataCatalogue(client = new SuccessBizHubClient()) {
  const discovery = object(object(await client.getReadinessResource('/services')).data);
  const services = Array.isArray(discovery.services) ? discovery.services.map(object) : [];
  const orders = services.filter(service => service.id === 'orders');
  const service = orders.length === 1 ? orders[0] : {};
  const granted = object(discovery.keyPermissions).orders === true && service.keyGranted === true;
  if (!granted || service.available !== true || service.enabled === false) {
    return { observedAt: new Date().toISOString(), granted, available: service.available === true, networks: [] };
  }

  const catalogue = object(await client.getReadinessResource('/catalog')).data;
  const list = Array.isArray(catalogue) ? catalogue : object(catalogue).offers;
  if (!Array.isArray(list) || list.length > 200 || list.some(offer => {
    const row = object(offer);
    return typeof row.kind !== 'string' || typeof row.network !== 'string' ||
      row.kind.toLowerCase().trim() === 'data' && (!Array.isArray(row.packages) || row.packages.length > 200 ||
        row.packages.some(p => typeof object(p).sizeLabel !== 'string'));
  })) throw new Error('Unusable catalogue shape.');
  const offers = list as SbhOffer[];
  const networks = (['mtn', 'telecel', 'airteltigo'] as const).map(network => {
    const matching = offers.filter(o => o.kind.toLowerCase().trim() === 'data' && isNetworkMatch(o.network, network));
    const defined = Object.values(AUTHORITATIVE_PRODUCTS).filter(p => p.network === network);
    const sizes = [...new Set([...defined.map(p => p.dataAmount), ...matching.flatMap(o => o.packages.map(p => normalizeSizeLabel(p.sizeLabel)))])]
      .filter(size => /^[1-9]\d{0,4}(?:\.\d{1,3})?(?:GB|MB)$/.test(size)).sort((a,b)=>parseFloat(a)-parseFloat(b));
    return { network, packages: sizes.map(size => {
      const product = defined.find(p => p.dataAmount === size);
      const r = resolveSupplierPackage(offers, network, size).resolved;
      if (!r) return { size, productId: product?.id ?? null, retailActive: product?.isActive ?? false, resolution: 'missing_or_ambiguous' };
      const duplicate = r.offer.packages.filter(p => normalizeSizeLabel(p.sizeLabel) === size).length !== 1;
      const offerSelector = selector(r.offerSlug) || selector(r.offerId);
      const packageValidity = validity(r.package.validity), offerValidity = validity(r.offer.validity);
      const offerAvailability = availability(r.offer), packageAvailability = availability(r.package);
      const familyMentioned = network !== 'airteltigo' || /ishare/i.test((r.offer.name || '') + ' ' + (r.offerSlug || ''));
      const reviewReasons = [
        duplicate && 'duplicate_size',
        !offerSelector && 'missing_offer_selector',
        r.supplierCostMinor <= 0 && 'invalid_cost',
        !familyMentioned && 'family_unconfirmed',
        !packageValidity && !offerValidity && 'validity_unconfirmed',
        packageValidity && offerValidity && packageValidity.toLowerCase() !== offerValidity.toLowerCase() && 'validity_conflict',
        offerAvailability === 'unavailable' || packageAvailability === 'unavailable' ? 'unavailable' :
          offerAvailability === 'not_reported' && packageAvailability === 'not_reported' && 'availability_unconfirmed',
      ].filter(Boolean);
      return { size, productId: product?.id ?? null, retailActive: product?.isActive ?? false, offerSelector,
        packageId: selector(r.package.id), supplierMinor: r.supplierCostMinor, packageValidity, offerValidity,
        offerAvailability, packageAvailability, familyMentioned, reviewReasons,
        resolution: reviewReasons.length ? 'requires_review' : 'exact_match' };
    }) };
  });
  return { observedAt: new Date().toISOString(), granted, available: true, networks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  readSbhDataCatalogue().then(result => {
    console.log(JSON.stringify(result, null, 2));
    const airteltigo = result.networks.find(n => n.network === 'airteltigo')?.packages.filter(p => p.productId);
    if (!result.granted || !result.available || !airteltigo?.length ||
      airteltigo.some(p => p.resolution !== 'exact_match')) process.exitCode = 1;
  }).catch(() => {
    console.error('SBH standard-data catalogue could not be verified. Check credentials, permissions and response format in the approved operator environment.');
    process.exitCode = 1;
  });
}
