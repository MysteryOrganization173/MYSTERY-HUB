import { MAX_MONEY_MINOR, moneyMinor, percentMinor } from './money.js';

export interface StorePolicy {
  enabled: boolean;
  reserveBps: number;
  reserveFixedMinor: number;
  withdrawalMinimumMinor: number;
  withdrawalFeeBps: number;
  version: string;
}
export const STORE_POLICY_DEFAULTS: StorePolicy = { enabled:false,reserveBps:0,reserveFixedMinor:0,withdrawalMinimumMinor:500,withdrawalFeeBps:300,version:'unconfigured' };
export interface StoreSnapshot {
  channel:'website_store'; siteId:string; ownerId:string; productId:string;
  retailMinor:number; wholesaleMinor:number; reserveMinor:number; earningMinor:number;
  supplierCostMinor:number; currency:'GHS'; policyVersion:string; wholesaleVersion:string; priceVersion:string;
}
export const storeReserve = (retail:number,policy:StorePolicy) => percentMinor(retail,policy.reserveBps)+moneyMinor(policy.reserveFixedMinor,true);
export function minimumStorePrice(wholesale:number,policy:StorePolicy) {
  moneyMinor(wholesale);
  if(!Number.isInteger(policy.reserveBps)||policy.reserveBps<0||policy.reserveBps>=10000)throw new Error('Invalid processing reserve.');
  let low=wholesale,high=MAX_MONEY_MINOR;
  if(high-storeReserve(high,policy)<wholesale)throw new Error('No safe selling price.');
  while(low<high){const mid=Math.floor((low+high)/2);if(mid-storeReserve(mid,policy)>=wholesale)high=mid;else low=mid+1;}
  return low;
}
