import { randomUUID } from 'node:crypto';
import { FinanceStore, FinanceError } from '../db/financeStore.js';
import { moneyMinor, percentMinor } from '../../shared/money.js';
import type { OrderRecord } from '../types/orders.js';
import type { ReferralRewardRuleRecord } from '../types/referral.js';
export interface EconomicsPolicy {service:string;enabled:boolean;version:string;reserveMinor:number;reserveBps:number;supplierCostMinor:number|null;mode:'fixed'|'margin_percent'|'stage_margin_percent';marginBps:number;acquisitionBps?:number;recurringBps?:number;reserveConfigured?:boolean;directReserve?:{bps:number;fixed:number}}
export async function economicsPolicy(service:string):Promise<EconomicsPolicy|undefined> {
  const policy=await FinanceStore.readConfig(`economics:${service}`);
  if(service!=='data'||!policy)return policy;
  const direct=await FinanceStore.readConfig('direct-pricing');
  return {...policy,...(direct?.reserveConfigured?{directReserve:{bps:direct.reserveBps,fixed:direct.reserveFixedMinor}}:{})};
}
export async function saveEconomicsPolicy(adminId:string,input:Record<string,unknown>) {
  if(input.confirmed!==true||!['data','airtime','afa'].includes(input.service as string)||typeof input.enabled!=='boolean'||!['fixed','margin_percent','stage_margin_percent'].includes(input.mode as string))throw new FinanceError('Invalid reward economics configuration.');
  const policy:EconomicsPolicy={service:input.service as string,enabled:input.enabled,version:randomUUID(),reserveMinor:moneyMinor(input.reserveMinor,true),reserveBps:Number(input.reserveBps),supplierCostMinor:input.supplierCostMinor==null?null:moneyMinor(input.supplierCostMinor,true),mode:input.mode as EconomicsPolicy['mode'],marginBps:Number(input.marginBps)};
  percentMinor(100,policy.reserveBps);percentMinor(100,policy.marginBps);
  if(policy.mode==='stage_margin_percent') {
    if(policy.service!=='data'||typeof input.reserveConfigured!=='boolean')throw new FinanceError('Dynamic Data policy requires explicit reserve status.');
    policy.acquisitionBps=Number(input.acquisitionBps);policy.recurringBps=Number(input.recurringBps);policy.reserveConfigured=input.reserveConfigured;
    percentMinor(100,policy.acquisitionBps);percentMinor(100,policy.recurringBps);
  }
  if(policy.service!=='afa'&&policy.supplierCostMinor!==null)throw new FinanceError('Data/Airtime cost must come from the authoritative supplier order; only flat AFA cost may be configured.');
  await FinanceStore.transaction(adminId,async tx=>{await tx.saveConfig(`economics:${policy.service}`,policy);await tx.audit(adminId,'reward_economics_changed',policy.service,{...policy});});
  return policy;
}
export function computeEconomicReward(order:OrderRecord,rule:ReferralRewardRuleRecord|null,requested:number,policy?:EconomicsPolicy,purchaseStage='any') {
  const rawCost=order.supplier_cost_minor??(order.service_type==='afa'?policy?.supplierCostMinor:null)??null;
  const cost=Number.isSafeInteger(rawCost)&&rawCost!>=0?rawCost:null;
  if(policy?.enabled&&policy.mode==='stage_margin_percent'&&(order.service_type||'data')==='data'&&!order.store_context) {
    const first=purchaseStage==='acquisition',snapshot=order.commercial_context;
    const regular=snapshot?.regularMinor??order.amount;
    const reserveAt=(revenue:number)=>policy.directReserve?policy.directReserve.fixed+percentMinor(revenue,policy.directReserve.bps):policy.reserveConfigured?policy.reserveMinor+percentMinor(revenue,policy.reserveBps):null;
    const actualReserve=snapshot?.reserveMinor??reserveAt(order.amount);
    const normalReserve=snapshot?.normalReserveMinor??(snapshot?.discountMinor===0?snapshot.reserveMinor:null)??reserveAt(regular);
    const basis=first?regular:order.amount,basisReserve=first?normalReserve:actualReserve;
    const margin=cost===null||basisReserve===null?null:Math.max(0,basis-cost-basisReserve);
    const bps=first?policy.acquisitionBps:policy.recurringBps;
    const qualified=purchaseStage==='acquisition'||purchaseStage==='recurring';
    const amount=!qualified||margin===null||!Number.isInteger(bps)?0:percentMinor(margin,bps!);
    const contribution=cost===null||actualReserve===null?null:order.amount-cost-actualReserve-amount;
    return {amount,snapshot:{retail_price_minor:order.amount,normal_retail_minor:regular,supplier_cost_minor:cost,supplier_cost_source:cost===null?'unknown':'supplier_order',operations_reserve_minor:actualReserve,normal_reserve_minor:normalReserve,rewardable_margin_minor:margin,reward_basis_minor:basis,reward_percent_bps:bps,economic_version:policy.version,rule_version:rule?.updated_at||null,rule_id:rule?.id||null,final_reward_minor:amount,calculation_mode:'stage_margin_percent',acquisition_subsidy:first&&Boolean(snapshot?.discountMinor),contribution_after_reward_minor:contribution}};
  }
  // New direct orders preserve the processing reserve quoted at checkout. Legacy
  // orders and other services retain their existing reward-policy behavior.
  const quotedReserve=!order.store_context?order.commercial_context?.reserveMinor:null;
  const reserve=quotedReserve??(policy?.enabled?policy.reserveMinor+percentMinor(order.amount,policy.reserveBps):0);
  const margin=cost==null?null:Math.max(0,order.amount-cost-reserve);
  // Only the server-persisted welcome snapshot on the first qualifying direct
  // Data purchase authorizes an acquisition expense. Never extend it to repeats.
  const welcome=order.commercial_context;
  const acquisitionSubsidy=purchaseStage==='acquisition'&&!order.store_context
    && (order.service_type||'data')==='data'&&Boolean(order.user_id)&&Boolean(welcome?.buyerPhone)
    && welcome?.promotionId==='welcome-v1'&&welcome.discountMinor>0
    && welcome.paidMinor===order.amount&&welcome.regularMinor-welcome.discountMinor===order.amount;
  // The 50/10 fixed rules remain compatible, capped to known commercial margin.
  // Missing cost fails closed for new Data/Airtime/AFA rewards. Historical facts
  // are returned before this calculation and never revalued.
  const eligible=['data','airtime','afa'].includes(order.service_type||'data');
  const amount=!eligible?requested:margin==null?0:acquisitionSubsidy?requested:Math.min(margin,policy?.enabled&&policy.mode==='margin_percent'?percentMinor(margin,policy.marginBps):requested);
  const contribution=cost===null||!(quotedReserve!=null||policy?.enabled)?null:order.amount-cost-reserve-amount;
  return {amount,snapshot:{retail_price_minor:order.amount,supplier_cost_minor:cost,supplier_cost_source:cost===null?'unknown':order.supplier_cost_minor==null?'admin_afa_cost':'supplier_order',operations_reserve_minor:reserve,rewardable_margin_minor:margin,economic_version:policy?.enabled?policy.version:'legacy-rule',rule_version:rule?.updated_at||null,rule_id:rule?.id||null,final_reward_minor:amount,calculation_mode:acquisitionSubsidy?'welcome_acquisition_subsidy':policy?.enabled?policy.mode:'fixed_margin_cap',acquisition_subsidy:acquisitionSubsidy,contribution_after_reward_minor:contribution}};
}
