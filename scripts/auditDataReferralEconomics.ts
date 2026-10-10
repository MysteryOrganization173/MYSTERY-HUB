/** Synthetic, read-only calculation evidence. No configuration or financial writes. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { computeEconomicReward, type EconomicsPolicy } from '../server/services/referralEconomics.js';
import { AUTHORITATIVE_PRODUCTS } from '../server/data/productCatalog.js';
import { DATA_MARGIN_POLICY } from '../shared/dataReferralPolicy.js';
import type { OrderRecord } from '../server/types/orders.js';
const policy: EconomicsPolicy = { service:'data', enabled:true, version:'SYNTHETIC-NOT-LIVE',
  reserveMinor:0, reserveBps:0, reserveConfigured:true, marginBps:0, supplierCostMinor:null, ...DATA_MARGIN_POLICY };
const samples=[['mtn-1gb',400],['at-1gb',390],['mtn-10gb',4000],['mtn-40gb',15000]] as const;
const rows: Record<string,unknown>[]=[];
for(const [id,cost] of samples)for(const discount of [0,100])for(const reserve of [0,10]){
 const retail=AUTHORITATIVE_PRODUCTS[id].amountPesewas,paid=retail-discount;
 const order={service_type:'data',user_id:'synthetic-only',amount:paid,supplier_cost_minor:cost,
  commercial_context:{regularMinor:retail,paidMinor:paid,discountMinor:discount,buyerPhone:'+233240000000',promotionId:discount?'welcome-v1':null,reserveMinor:reserve,normalReserveMinor:reserve}} as OrderRecord;
 const fixedFirst=computeEconomicReward(order,null,50,undefined,'acquisition');
 const fixedRepeat=computeEconomicReward({...order,amount:retail,commercial_context:{...order.commercial_context!,paidMinor:retail,discountMinor:0,promotionId:null}},null,10,undefined,'recurring');
 const dynamicFirst=computeEconomicReward(order,null,50,policy,'acquisition');
 const dynamicRepeat=computeEconomicReward({...order,amount:retail,commercial_context:{...order.commercial_context!,paidMinor:retail,discountMinor:0,promotionId:null}},null,10,policy,'recurring');
 assert.equal(dynamicFirst.amount,Math.floor((Math.max(0,retail-cost-reserve)*5000+5000)/10000));
 assert.equal(dynamicRepeat.amount,Math.floor((Math.max(0,retail-cost-reserve)*2000+5000)/10000));
 assert.equal(discount?fixedFirst.amount:Math.min(50,Math.max(0,paid-cost-reserve)),fixedFirst.amount);
 rows.push({product:id,source:'retail=repository catalog; cost=synthetic NOT supplier quote',retailMinor:retail,supplierCostMinor:cost,welcomeDiscountMinor:discount,paidMinor:paid,reserveMinor:reserve,normalRewardableMarginMinor:Math.max(0,retail-cost-reserve),actualMarginBeforeRewardMinor:paid-cost-reserve,fixedFirstMinor:fixedFirst.amount,fixedRepeatMinor:fixedRepeat.amount,dynamicFirstMinor:dynamicFirst.amount,dynamicRepeatMinor:dynamicRepeat.amount,firstRetainedMinor:dynamicFirst.snapshot.contribution_after_reward_minor,repeatRetainedMinor:dynamicRepeat.snapshot.contribution_after_reward_minor});
}
const unknown={service_type:'data',amount:499,supplier_cost_minor:null} as OrderRecord;
assert.equal(computeEconomicReward(unknown,null,50,policy,'acquisition').amount,0);
assert.equal(computeEconomicReward({...unknown,supplier_cost_minor:390},null,50,{...policy,reserveConfigured:false},'acquisition').amount,0);
assert.equal(computeEconomicReward({...unknown,supplier_cost_minor:500},null,10,policy,'recurring').amount,0);
const keys=Object.keys(rows[0]);const csv=[keys.join(','),...rows.map(row=>keys.map(k=>JSON.stringify(row[k])).join(','))].join('\n')+'\n';
writeFileSync('docs/data-referral-economics-synthetic-v1.csv',csv);
console.log(JSON.stringify({scenarios:rows.length,unknownCost:'fails closed',unknownReserve:'fails closed',negativeRecurringMargin:'zero reward',rows},null,2));
