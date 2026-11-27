import assert from 'node:assert/strict';
import test from 'node:test';
import { AIRTELTIGO_ISHARE_CANDIDATES, DIRECT_RETAIL_MINOR } from '../../../shared/directPricing.js';
import { DATA_BUNDLES } from '../../../src/data/bundles.js';
import { projectDirectCatalogBundle } from '../../../src/hooks/useDirectCatalog.js';
import { readSbhDataCatalogue } from '../../../scripts/sbh-data-catalogue-readonly.js';
import { AUTHORITATIVE_PRODUCTS, getAuthoritativeProduct } from '../../data/productCatalog.js';
import { SuccessBizHubClient } from '../successBizHub/client.js';
import { resolveSupplierPackage } from '../successBizHub/catalogResolver.js';
import type { SbhOffer } from '../successBizHub/types.js';

const offer: SbhOffer = {
  kind: 'data', network: 'AT', name: 'Fixture AT iShare', slug: 'fixture-ishare', enabled: true,
  packages: AIRTELTIGO_ISHARE_CANDIDATES.map((p,i)=>({ id:`fixture-${p.id}`,sizeLabel:p.dataAmount,priceMinor:2000+i,validity:'60 Days' })),
};

test('all 13 proposed AT definitions are dormant and absent from the fallback catalogue', () => {
  assert.deepEqual(AIRTELTIGO_ISHARE_CANDIDATES.map(p=>Number.parseInt(p.dataAmount)), [6,7,8,9,10,12,15,20,25,30,40,50,100]);
  assert.deepEqual(Object.values(AUTHORITATIVE_PRODUCTS).filter(p=>p.network==='airteltigo'&&p.isActive)
    .map(p=>p.amountPesewas), [499,949,1399,1849,2299]);
  for (const p of AIRTELTIGO_ISHARE_CANDIDATES) {
    const product=AUTHORITATIVE_PRODUCTS[p.id];
    assert.equal(p.proposedRetailMinor,Number.parseInt(p.dataAmount)*450+49);
    assert.equal(product.amountPesewas,p.proposedRetailMinor);
    assert.equal(product.validity,undefined);
    assert.equal(product.isActive,false);
    assert.equal(DIRECT_RETAIL_MINOR[p.id],undefined);
    assert.equal(getAuthoritativeProduct(p.id),null);
    assert.equal(DATA_BUNDLES.some(b=>b.id===p.id),false);
  }
});

test('the existing SBH resolver matches every candidate size exactly and uses fixture supplier quotes', () => {
  for(const [i,p] of AIRTELTIGO_ISHARE_CANDIDATES.entries()){
    const r=resolveSupplierPackage([offer], 'airteltigo', `${Number.parseInt(p.dataAmount)} gb`).resolved;
    assert.equal(r?.offerSlug,offer.slug);
    assert.equal(r?.package.id,`fixture-${p.id}`);
    assert.equal(r?.supplierCostMinor,2000+i);
    assert.equal(resolveSupplierPackage([offer], 'airteltigo', `${Number.parseInt(p.dataAmount)}MB`).resolved,null);
    assert.equal(resolveSupplierPackage([{...offer,enabled:false}], 'airteltigo',p.dataAmount).resolved,null);
  }
  assert.equal(resolveSupplierPackage([offer,{...offer,slug:'other'}],'airteltigo','6GB').resolved,null);
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
  assert.equal(at.packages.find(p=>p.size==='6GB')?.resolution,'requires_review');
  assert.equal(at.packages.find(p=>p.size==='1GB')?.resolution,'requires_review');
  assert.equal(at.packages.find(p=>p.size==='1GB')?.packageValidity,null);
  assert.equal(at.packages.find(p=>p.size==='100GB')?.packageValidity,'60 Days');
  assert.ok(!JSON.stringify(result).includes('<private>'));
});

test('permission mismatch stops the operator probe before reading catalogue',async t=>{
  const c=new SuccessBizHubClient();
  const read=t.mock.method(c,'getReadinessResource',async()=>({data:{keyPermissions:{orders:true},services:[{id:'orders',keyGranted:false,available:true}]}}));
  assert.deepEqual((await readSbhDataCatalogue(c)).networks,[]);
  assert.equal(read.mock.callCount(),1);
});

test('server-only products obtain size/filter metadata and use only the supplied validity', () => {
  for (const p of AIRTELTIGO_ISHARE_CANDIDATES) {
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
