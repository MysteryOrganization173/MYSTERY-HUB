import {AsyncLocalStorage} from 'node:async_hooks';
import type {RequestHandler} from 'express';
import {CampaignStore,campaignRequestEligible} from '../db/campaignStore.js';
import type {CampaignSnapshot} from '../../shared/campaigns.js';
import type {OrderRecord} from '../types/orders.js';
const context=new AsyncLocalStorage<CampaignSnapshot|null>();
/** Resolve optional marketing evidence before any financial transaction acquires a connection. */
const campaignMiddleware=(store:boolean):RequestHandler=>async(req,_res,next)=>{
 let value:CampaignSnapshot|null=null;
 if(req.user?.role!=='admin'&&campaignRequestEligible('GET',req.get('user-agent')||'',req.get('dnt')==='1'||req.get('sec-gpc')==='1'?'1':undefined)){value=await CampaignStore.attribution(req.body,req.user?.id,store?String(req.params.id):null);}
 context.run(value,()=>next());
};
export const campaignOrderContext=campaignMiddleware(false),campaignStoreOrderContext=campaignMiddleware(true);
export function campaignForNewOrder(order:OrderRecord):CampaignSnapshot|null{
 const value=context.getStore();if(!value||Date.parse(value.expiresAt)<=Date.now()||!['paystack','wallet'].includes(order.payment_provider)||!['data','airtime','instant_bundle','afa','marketplace'].includes(order.service_type||'data'))return null;
 if((order.store_context?.siteId||null)!==value.siteId)return null;
 return value;
}
