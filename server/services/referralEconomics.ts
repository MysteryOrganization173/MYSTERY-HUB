import { randomUUID } from 'node:crypto';
import { FinanceStore, FinanceError } from '../db/financeStore.js';
import { moneyMinor, percentMinor } from '../../shared/money.js';
import type { OrderRecord } from '../types/orders.js';
import type { ReferralRewardRuleRecord } from '../types/referral.js';
export interface EconomicsPolicy {service:string;enabled:boolean;version:string;reserveMinor:number;reserveBps:number;supplierCostMinor:number|null;mode:'fixed'|'margin_percent';marginBps:number}
export async function economicsPolicy(service:string):Promise<EconomicsPolicy|undefined> {
  return FinanceStore.readConfig(`economics:${service}`);
}
export async function saveEconomicsPolicy(adminId:string,input:Record<string,unknown>) {
  if(input.confirmed!==true||!['data','airtime','afa'].includes(input.service as string)||typeof input.enabled!=='boolean'||!['fixed','margin_percent'].includes(input.mode as string))throw new FinanceError('Invalid reward economics configuration.');
  const policy:EconomicsPolicy={service:input.service as string,enabled:input.enabled,version:randomUUID(),reserveMinor:moneyMinor(input.reserveMinor,true),reserveBps:Number(input.reserveBps),supplierCostMinor:input.supplierCostMinor==null?null:moneyMinor(input.supplierCostMinor,true),mode:input.mode as EconomicsPolicy['mode'],marginBps:Number(input.marginBps)};
  percentMinor(100,policy.reserveBps);percentMinor(100,policy.marginBps);
  if(policy.service!=='afa'&&policy.supplierCostMinor!==null)throw new FinanceError('Data/Airtime cost must come from the authoritative supplier order; only flat AFA cost may be configured.');
  await FinanceStore.transaction(adminId,async tx=>{await tx.saveConfig(`economics:${policy.service}`,policy);await tx.audit(adminId,'reward_economics_changed',policy.service,{...policy});});
  return policy;
}
export function computeEconomicReward(order:OrderRecord,rule:ReferralRewardRuleRecord|null,requested:number,policy?:EconomicsPolicy) {
  const rawCost=order.supplier_cost_minor??(order.service_type==='afa'?policy?.supplierCostMinor:null)??null;
  const cost=Number.isSafeInteger(rawCost)&&rawCost!>=0?rawCost:null;
  const reserve=policy?.enabled?policy.reserveMinor+percentMinor(order.amount,policy.reserveBps):0;
  const margin=cost==null?null:Math.max(0,order.amount-cost-reserve);
  // The 50/10 fixed rules remain compatible, capped to known commercial margin.
  // Missing cost fails closed for new Data/Airtime/AFA rewards. Historical facts
  // are returned before this calculation and never revalued.
  const eligible=['data','airtime','afa'].includes(order.service_type||'data');
  const amount=!eligible?requested:margin==null?0:Math.min(margin,policy?.enabled&&policy.mode==='margin_percent'?percentMinor(margin,policy.marginBps):requested);
  return {amount,snapshot:{retail_price_minor:order.amount,supplier_cost_minor:cost,supplier_cost_source:cost===null?'unknown':order.supplier_cost_minor==null?'admin_afa_cost':'supplier_order',operations_reserve_minor:reserve,rewardable_margin_minor:margin,economic_version:policy?.enabled?policy.version:'legacy-rule',rule_version:rule?.updated_at||null,rule_id:rule?.id||null,final_reward_minor:amount,calculation_mode:policy?.enabled?policy.mode:'fixed_margin_cap'}};
}
