import assert from 'node:assert/strict';
import {test} from 'node:test';
import {minimumStorePrice, storeReserve, STORE_POLICY_DEFAULTS} from '../../../shared/storeEconomics';
import {bulkSellerPrices, type SellerBundle} from '../../../src/utils/websitePricing';

// Diagnostic coverage of existing economics. The checkout hotfix does not change policy.
const policy={...STORE_POLICY_DEFAULTS,enabled:true,reserveBps:30,reserveFixedMinor:0};
const bundle:SellerBundle={id:'synthetic',network:'mtn',networkName:'MTN',dataAmount:'1GB',retailMinor:0,enabled:true,minimumMinor:421,wholesaleMinor:420,configured:true};
test('reported 0.3% reserve produces the smallest GHS 4.21 safe price',()=>{
  assert.equal(minimumStorePrice(420,policy),421);
  assert.equal(storeReserve(420,policy),1);
  assert.equal(420-storeReserve(420,policy),419);
  assert.equal(421-storeReserve(421,policy),420);
});
test('GHS 1 markup adds to the safe minimum; resulting reserve leaves GHS 0.99 seller earning',()=>{
  const [{retailMinor}]=bulkSellerPrices([bundle],'all','flat','1.00');
  assert.equal(retailMinor,521);
  assert.equal(storeReserve(retailMinor,policy),2);
  assert.equal(retailMinor-420-storeReserve(retailMinor,policy),99);
});
test('10% markup uses safe minimum and rounds to integer pesewas',()=>{
  const [{retailMinor}]=bulkSellerPrices([bundle],'all','percent','10');
  assert.equal(retailMinor,463);
  assert.equal(storeReserve(retailMinor,policy),1);
  assert.equal(retailMinor-420-storeReserve(retailMinor,policy),42);
  assert.equal(storeReserve(500,{...policy,reserveBps:30}),2); // 1.5 pesewas rounds up.
});
test('zero reserve is mathematically supported without changing the enabled-policy safeguard',()=>{
  assert.equal(minimumStorePrice(420,STORE_POLICY_DEFAULTS),420);
  assert.equal(storeReserve(520,STORE_POLICY_DEFAULTS),0);
});
