// Mystery Hub 3.6.3 Release A · the emergency MTN Data maintenance pause. Synthetic data only; no payment, no supplier.
// Guards: the scope is MTN standard Data only; the server refuses it through the catalogue the quote, payment start
// and reorder already use; existing recovery is untouched; the copy names no supplier, promises no refund and never
// reopens by date; every customer surface reads the same record.
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { SERVICE_INCIDENTS, activeServiceIncidents, dataPurchasePaused, purchaseIncident, restorationLine, restorationDateLabel, setServiceIncidentsForTests } from '../../../shared/serviceIncidents';
import { CommercialService } from '../../services/commercialService';

const source = (path: string) => readFileSync(path, 'utf8');
const code = (path: string) => source(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
after(() => setServiceIncidentsForTests([]));

test('the incident covers MTN standard Data only, blocks new purchases, and starts with no other service paused', () => {
  assert.equal(SERVICE_INCIDENTS.length, 1);
  const [mtn] = SERVICE_INCIDENTS;
  assert.deepEqual([mtn.service, mtn.network, mtn.state, mtn.blocksPurchases], ['data', 'mtn', 'maintenance', true]);
  assert.equal(purchaseIncident('data', 'mtn', SERVICE_INCIDENTS), mtn);
  assert.equal(purchaseIncident('data', 'MTN', SERVICE_INCIDENTS), mtn);
  for (const [service, network] of [['instant_bundle', 'mtn'], ['airtime', 'mtn'], ['data', 'telecel'], ['data', 'airteltigo']]) {
    assert.equal(purchaseIncident(service, network, SERVICE_INCIDENTS), null, `${service} ${network} is not paused by this incident`);
  }
  assert.equal(Object.isFrozen(SERVICE_INCIDENTS) && Object.isFrozen(mtn), true, 'nothing at runtime can edit the record');
});

test('customer copy is the approved meaning, names no supplier and promises neither a refund nor a date', () => {
  const [mtn] = SERVICE_INCIDENTS;
  const words = [mtn.title, mtn.short, mtn.message, mtn.existingOrders, mtn.apology, mtn.followUp].join(' ');
  assert.equal(mtn.title, 'MTN Data service update');
  assert.match(mtn.message, /^MTN Data bundle purchases are temporarily suspended due to ongoing maintenance and system upgrades\.$/);
  assert.match(mtn.existingOrders, /Existing orders remain trackable\. Affected transactions will be reviewed accordingly\./);
  assert.match(mtn.followUp, /We will announce once MTN Data services are restored\./);
  assert.doesNotMatch(words, /success\s*biz|brainiac|supplier|reseller|vendor|wholesale/i, 'no upstream supplier is named');
  assert.doesNotMatch(words, /refunded|will be refunded|refund(s)? (has|have) been|guarantee|nationwide|MTN Ghana (has )?confirm/i);
  assert.equal(restorationDateLabel('2026-12-01'), 'Tuesday, December 1, 2026');
});

test('the expected date is an expectation, never a switch', () => {
  const [mtn] = SERVICE_INCIDENTS;
  assert.deepEqual(restorationLine(mtn, '2026-11-25'), { label: 'Expected resumption: Tuesday, December 1, 2026.', overdue: false });
  assert.equal(restorationLine(mtn, '2026-12-01').overdue, false);
  const late = restorationLine(mtn, '2026-12-02');
  assert.equal(late.overdue, true);
  assert.match(late.label, /Restoration is awaiting confirmation; purchases stay paused/);
  // The pause has no date in it: it holds on any day until an authorised release removes it.
  assert.equal(purchaseIncident('data', 'mtn', SERVICE_INCIDENTS)?.blocksPurchases, true);
  const shared = code('shared/serviceIncidents.ts');
  assert.doesNotMatch(shared.slice(shared.indexOf('export function purchaseIncident'), shared.indexOf('export const dataPurchasePaused')), /Date|today|expectedRestoration/, 'the pause never depends on the date');
  assert.doesNotMatch(shared, /setTimeout|setInterval/);
});

test('the server catalogue leaves MTN Data out while the incident is in force, and restores it exactly without', async () => {
  setServiceIncidentsForTests([]);
  const open = await CommercialService.catalog();
  assert.ok(open.products.some(p => p.network === 'mtn'), 'MTN Data is listed when nothing is paused');
  setServiceIncidentsForTests(SERVICE_INCIDENTS);
  const paused = await CommercialService.catalog();
  assert.equal(paused.products.some(p => p.network === 'mtn'), false, 'no MTN Data product is offered');
  assert.deepEqual(paused.products.map(p => p.id), open.products.filter(p => p.network !== 'mtn').map(p => p.id), 'every other network is unchanged');
  await assert.rejects(CommercialService.quote('mtn-1gb'), (e: any) => e.status === 404, 'no quote for a paused bundle');
  assert.ok((await CommercialService.quote('at-1gb').catch(() => CommercialService.quote(paused.products[0].id))).totalMinor > 0, 'other networks still quote');
  setServiceIncidentsForTests([]);
});

test('payment start, reorder and the assistant refuse through that same catalogue; recovery is checked first', () => {
  const api = code('server/routes/api.ts');
  const init = api.slice(api.indexOf('const recoverData=()=>recoverDirectCheckout'), api.indexOf('// 3a. MTN Duplicate Active Order Protection'));
  assert.match(init, /const existingCheckout=await recoverData\(\);[\s\S]*const product = \(await CommercialService\.catalog\(\)\)\.products\.find\(/, 'an existing checkout is recovered before the catalogue is consulted');
  assert.match(init, /if \(!product\) \{\s*await rejectData\('PACKAGE_UNAVAILABLE'\);return;/);
  assert.match(init, /if\(concurrent\|\|existingCheckout\)throw requireCheckoutRecovery/, 'a customer who already started paying is sent to recovery, never charged again');
  assert.match(code('server/services/reorderService.ts'), /dataCatalogue: \(\) => CommercialService\.catalog\(\)/);
  assert.match(code('server/services/commercialService.ts'), /isActive:p\.isActive&&\(setting\?\.enabled\?\?true\)&&!dataPurchasePaused\(p\.network\),/);
  // Nothing after payment is touched: verification, webhooks and fulfilment never read the incident.
  for (const file of ['server/services/paystackService.ts', 'server/services/fulfilmentService.ts', 'server/services/financeService.ts']) assert.doesNotMatch(source(file), /serviceIncidents|dataPurchasePaused/, file);
});

test('the browser reads the same record everywhere a customer could start an MTN Data purchase', () => {
  assert.match(code('src/hooks/useDirectCatalog.ts'), /const offered=\(b:DataBundle\)=>!dataPurchasePaused\(b\.network\);\s*let current=DATA_BUNDLES\.filter\(offered\);/);
  assert.match(code('src/hooks/useDirectCatalog.ts'), /\.filter\(offered\);/);
  const checkout = code('src/components/checkout/CheckoutModal.tsx');
  assert.match(checkout, /const pausedIncident = isRegularData \? purchaseIncident\('data', checkoutBundle\.network\) : null;/);
  assert.match(checkout, /if \(pausedIncident && !awaitingPayment && !busy && !paymentClosed && !knownReference\.current\) \{/, 'an open payment window or known payment keeps its recovery path');
  assert.match(checkout, /purchaseIncident\('data',checkoutBundle\.network\)\)\{setCommercial\(null\);return;\}/, 'no quote is requested for a paused bundle');
  const page = code('src/components/data/DataPage.tsx');
  assert.match(page, /<ServiceMaintenanceState incident=\{activeIncident\}/);
  assert.match(page, /mtnNotice\.enabled && !dataPurchasePaused\('mtn'\)/, 'no "MTN delivery 15–45 minutes" line while MTN is paused');
  assert.match(page, /paused=\{pausedDataNetworks\}/);
  for (const file of ['src/components/home/HomeFeaturedData.tsx', 'src/seasonal/christmas/home/ChristmasHome.tsx']) {
    const home = code(file);
    assert.match(home, /useState<NetworkId>\(\(\) => NETWORKS\.find\(n => !purchaseIncident\('data', n\.id\)\)\?\.id \?\? 'mtn'\)/, file);
    assert.match(home, /incident \? <ServiceInlineNotice incident=\{incident\}>/, file);
  }
  assert.match(code('src/App.tsx'), /<Navbar \/>\s*(\{\}\s*)?<ServiceUpdateBar page=\{activePage\} \/>/);
  const modal = code('src/components/checkout/OrderStatusModal.tsx');
  assert.match(modal, /const smartBuyAgain = delivered && Boolean\(sessionToken && user && activeOrder\.publicReference\) && repeatable && !pausedIncident;/);
  assert.match(code('src/context/AppContext.tsx'), /useState<NetworkId \| 'all'>\(\(\) => \(dataPurchasePaused\('mtn'\) \? 'all' : 'mtn'\)\)/);
  assert.match(code('src/utils/memberHomePresentation.ts'), /if\(\(!o\.service_type\|\|o\.service_type==='data'\)&&dataPurchasePaused\(o\.network\)\)return null;/, 'member homepage Buy again (ordinary and Christmas) is withheld for a paused service');
});

test('dismissing the announcement hides the bar for that revision only; the pause and contextual notices stay', () => {
  const bar = code('src/components/service/ServiceUpdate.tsx');
  assert.match(bar, /const dismissKey = \(incident: ServiceIncident\) => `\$\{incident\.id\}:\$\{incident\.revision\}`;/);
  assert.match(bar, /if \(!\['home', 'orders', 'help'\]\.includes\(page\)\) return null;/);
  assert.doesNotMatch(bar.slice(bar.indexOf('export function ServiceInlineNotice')), /dismiss/i, 'contextual notices cannot be dismissed');
  assert.doesNotMatch(bar.slice(bar.indexOf('export function ServiceMaintenanceState'), bar.indexOf('export function ServiceInlineNotice')), /dismiss/i);
  const css = source('src/components/service/serviceUpdate.css');
  assert.doesNotMatch(css, /infinite/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('under the test runner the suite starts with no incident, and outside it the list cannot be replaced', () => {
  setServiceIncidentsForTests([]);
  assert.equal(activeServiceIncidents().length, 0);
  assert.equal(dataPurchasePaused('mtn'), false);
  setServiceIncidentsForTests(SERVICE_INCIDENTS);
  assert.equal(dataPurchasePaused('mtn'), true);
  setServiceIncidentsForTests([]);
  assert.match(code('shared/serviceIncidents.ts'), /let inForce: readonly ServiceIncident\[\] = underTest \? \[\] : SERVICE_INCIDENTS;/, 'production always runs with the record');
  assert.match(code('shared/serviceIncidents.ts'), /if \(!underTest\) throw new Error\('Service incidents can only be replaced in tests\.'\);/);
});
