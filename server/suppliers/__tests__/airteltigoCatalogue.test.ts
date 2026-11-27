import assert from 'node:assert/strict';
import test from 'node:test';
import { AIRTELTIGO_ISHARE_ADDITIONS, DIRECT_RETAIL_MINOR } from '../../../shared/directPricing.js';
import { DATA_BUNDLES } from '../../../src/data/bundles.js';
import { projectDirectCatalogBundle } from '../../../src/hooks/useDirectCatalog.js';
import { readSbhDataCatalogue } from '../../../scripts/sbh-data-catalogue-readonly.js';
import { FulfilmentService } from '../../services/fulfilmentService.js';
import { AUTHORITATIVE_PRODUCTS, getAuthoritativeProduct } from '../../data/productCatalog.js';
import { SuccessBizHubClient } from '../successBizHub/client.js';
import { resolveSupplierPackage } from '../successBizHub/catalogResolver.js';
import type { SbhOffer } from '../successBizHub/types.js';

const offer: SbhOffer = {
  kind: 'data', network: 'AT', name: 'Fixture AT iShare', slug: 'ishare_data_bundle',
  packages: AIRTELTIGO_ISHARE_ADDITIONS.map((p,i)=>({ id:`fixture-${p.id}`,sizeLabel:p.dataAmount,priceMinor:2000+i })),
};

test('all 13 approved plans augment the server catalogue without changing the legacy five prices', () => {
  assert.deepEqual(AIRTELTIGO_ISHARE_ADDITIONS.map(p=>Number.parseInt(p.dataAmount)), [6,7,8,9,10,12,15,20,25,30,40,50,100]);
  assert.deepEqual(Object.values(AUTHORITATIVE_PRODUCTS).filter(p=>p.network==='airteltigo'&&p.isActive)
    .slice(0,5).map(p=>p.amountPesewas), [499,949,1399,1849,2299]);
  assert.equal(Object.values(AUTHORITATIVE_PRODUCTS).filter(p=>p.network==='airteltigo'&&p.isActive).length,18);
  for (const p of AIRTELTIGO_ISHARE_ADDITIONS) {
    const product=AUTHORITATIVE_PRODUCTS[p.id];
    assert.equal(p.retailMinor,Number.parseInt(p.dataAmount)*450+49);
    assert.equal(product.amountPesewas,p.retailMinor);
    assert.equal(product.validity,undefined);
    assert.equal(product.isActive,true);
    assert.equal(DIRECT_RETAIL_MINOR[p.id],p.retailMinor);
    assert.equal(getAuthoritativeProduct(p.id),product);
    assert.equal(DATA_BUNDLES.some(b=>b.id===p.id),false);
  }
});

test('the existing SBH resolver matches every candidate size exactly and uses fixture supplier quotes', () => {
  for(const [i,p] of AIRTELTIGO_ISHARE_ADDITIONS.entries()){
    const r=resolveSupplierPackage([offer], 'airteltigo', `${Number.parseInt(p.dataAmount)} gb`).resolved;
    assert.equal(r?.offerSlug,offer.slug);
    assert.equal(r?.package.id,`fixture-${p.id}`);
    assert.equal(r?.supplierCostMinor,2000+i);
    assert.equal(resolveSupplierPackage([offer], 'airteltigo', `${Number.parseInt(p.dataAmount)}MB`).resolved,null);
    assert.equal(resolveSupplierPackage([{...offer,enabled:false}], 'airteltigo',p.dataAmount).resolved,null);
  }
  assert.equal(resolveSupplierPackage([offer,{...offer,slug:'other'}],'airteltigo','6GB').resolved?.offerSlug,offer.slug);
  assert.equal(resolveSupplierPackage([{...offer,slug:'other'}],'airteltigo','6GB').resolved,null);
  assert.equal(resolveSupplierPackage([offer,offer],'airteltigo','6GB').resolved,null);
  assert.equal(resolveSupplierPackage([{...offer,available:false}],'airteltigo','6GB').resolved,null);
  for (const flag of ['available','enabled']) {
    assert.equal(resolveSupplierPackage([{...offer,packages:[{...offer.packages[0],[flag]:false}]}],'airteltigo','6GB').resolved,null);
  }
  assert.equal(resolveSupplierPackage([offer],'airteltigo','11GB').resolved,null);
});

test('the read-only operator probe checks scope then resolves exact packages and sanitizes output', async t=>{
  const c=new SuccessBizHubClient();
  const read=t.mock.method(c,'getReadinessResource',async (endpoint:Parameters<SuccessBizHubClient['getReadinessResource']>[0])=>endpoint==='/services'?
    {data:{keyPermissions:{orders:true},services:[{id:'orders',keyGranted:true,available:true}]}}:
    {data:{offers:[{...offer,packages:[...offer.packages,{sizeLabel:'6GB',priceMinor:77},
      {sizeLabel:'1GB',priceMinor:100,available:false,validity:'<private>'}]}]}});
  const result=await readSbhDataCatalogue(c);
  assert.deepEqual(read.mock.calls.map(call=>call.arguments[0]),['/services','/catalog']);
  assert.equal(result.granted,true);
  const at=result.networks.find(row=>row.network==='airteltigo')!;
  assert.equal(at.packages.find(p=>p.size==='6GB')?.resolution,'missing_or_ambiguous');
  assert.equal(at.packages.find(p=>p.size==='1GB')?.resolution,'missing_or_ambiguous');
  assert.equal(at.packages.find(p=>p.size==='1GB')?.packageValidity,undefined);
  assert.equal(at.packages.find(p=>p.size==='100GB')?.packageValidity,null);
  assert.deepEqual(at.packages.find(p=>p.size==='100GB')?.reviewReasons,['validity_unconfirmed','availability_unconfirmed']);
  assert.ok(!JSON.stringify(result).includes('<private>'));
});

test('an exact size alone cannot qualify an unverified iShare offer', async t=>{
  const c=new SuccessBizHubClient();
  t.mock.method(c,'getReadinessResource',async (endpoint:Parameters<SuccessBizHubClient['getReadinessResource']>[0])=>endpoint==='/services'?
    {data:{keyPermissions:{orders:true},services:[{id:'orders',keyGranted:true,available:true}]}}:
    {data:[{kind:'data',network:'AT',name:'Unqualified AT data',slug:'fixture-at',packages:[{sizeLabel:'6GB',priceMinor:2000}]}]});
  const at=(await readSbhDataCatalogue(c)).networks.find(row=>row.network==='airteltigo')!;
  const row=at.packages.find(p=>p.size==='6GB');
  assert.equal(row?.resolution,'missing_or_ambiguous');
  assert.equal(row?.offerSelector,undefined);
});

test('permission mismatch stops the operator probe before reading catalogue',async t=>{
  const c=new SuccessBizHubClient();
  const read=t.mock.method(c,'getReadinessResource',async()=>({data:{keyPermissions:{orders:true},services:[{id:'orders',keyGranted:false,available:true}]}}));
  assert.deepEqual((await readSbhDataCatalogue(c)).networks,[]);
  assert.equal(read.mock.callCount(),1);
});

test('server-only products obtain size/filter metadata and use only the supplied validity', () => {
  for (const p of AIRTELTIGO_ISHARE_ADDITIONS) {
    const raw={...AUTHORITATIVE_PRODUCTS[p.id],priceGhc:25.49};
    const bundle=projectDirectCatalogBundle(raw);
    assert.equal(bundle?.dataBytesValue, Number.parseInt(p.dataAmount)*1024);
    assert.equal(bundle?.priceGhc,25.49);
    assert.equal(bundle?.validity,'');
    assert.equal(bundle?.serviceType,'data');
    assert.equal(projectDirectCatalogBundle({...raw,validity:'60 Days'})?.validity,'60 Days');
    assert.equal(bundle?.priceCampaign,undefined);
  }
  assert.equal(projectDirectCatalogBundle({id:'invalid',dataAmount:'6',network:'airteltigo'}),null);
  assert.equal(projectDirectCatalogBundle(AUTHORITATIVE_PRODUCTS['at-1gb'])?.validity,'Direct Credit');
});

test('added large plans check current orders entitlement, exact price, recipient and wallet before payment', async t=>{
  const provider=FulfilmentService.getProvider();
  const enabled=t.mock.method(provider.client,'isFulfillmentEnabled',()=>true);
  t.mock.method(provider.client,'isConfigured',()=>true);
  let permission=true, available=true, balance=0, currency='GHS', eligible=true;
  const services=t.mock.method(provider.client,'getServices',async (fresh?:boolean)=>{
    assert.equal(fresh,true);
    return {status:'success',data:{keyPermissions:{orders:permission},services:[{id:'orders',keyGranted:permission,available}]}};
  });
  t.mock.method(provider.client,'getCatalog',async ()=>({status:'success',data:{offers:[{...offer,packages:[
    {id:'fixture-50',sizeLabel:'50GB',priceMinor:19500},
    {id:'fixture-100',sizeLabel:'100GB',priceMinor:39000},
  ]}]}}));
  const wallet=t.mock.method(provider.client,'getWallet',async (fresh?:boolean)=>{
    assert.equal(fresh,true);
    return {status:'success',data:{availableMinor:balance,currency}};
  });
  const check=t.mock.method(provider,'checkBeneficiaryEligibility',async (_phone:string,selector?:{offerSlug?:string;offerId?:string})=>{
    assert.equal(selector?.offerSlug,offer.slug);
    return eligible?{eligible:true,outcome:'eligible' as const}:{eligible:false,outcome:'ineligible' as const};
  });
  const dispatch=t.mock.method(provider.client,'createOrder',async ()=>assert.fail('preflight cannot place a supplier order'));
  const preflight=(size:string)=>FulfilmentService.preflightCheck('airteltigo',size,'+233271234567');
  for(const [size,cost] of [['50GB',19500],['100GB',39000]] as const){
    balance=cost-1;
    assert.equal((await preflight(size)).code,'SUPPLIER_WALLET_LOW');
    balance=cost;
    const allowed=await preflight(size);
    assert.equal(allowed.allowed,true);
    assert.equal(allowed.supplierCostMinor,cost);
    assert.equal(allowed.supplierOfferRef,offer.slug);
  }
  currency='USD';
  assert.equal((await preflight('100GB')).code,'SERVICE_TEMPORARILY_UNAVAILABLE');
  currency='GHS';
  eligible=false;
  assert.equal((await preflight('100GB')).code,'BENEFICIARY_NOT_ELIGIBLE');
  permission=false;
  assert.equal((await preflight('100GB')).code,'SERVICE_TEMPORARILY_UNAVAILABLE');
  permission=true;
  available=false;
  assert.equal((await preflight('100GB')).code,'SERVICE_TEMPORARILY_UNAVAILABLE');
  assert.equal(services.mock.callCount(),8);
  assert.equal(wallet.mock.callCount(),6);
  assert.equal(check.mock.callCount(),6);
  enabled.mock.mockImplementation(()=>false);
  assert.equal((await preflight('100GB')).code,'SERVICE_TEMPORARILY_UNAVAILABLE');
  assert.equal(services.mock.callCount(),8);
  assert.equal(dispatch.mock.callCount(),0);
});
