import { getPool } from '../db/connection.js';
import {AdminAuditStore} from '../db/adminAuditStore.js';
import { randomUUID } from 'node:crypto';
import {createGuestCheckoutOnce,recoverDirectCheckout} from './directCheckoutRecovery.js';
import {CheckoutFailure,rejectPreflight,requireCheckoutRecovery} from './checkoutFailure.js';
import { AUTHORITATIVE_PRODUCTS, getAuthoritativeProduct } from '../data/productCatalog.js';
import { FinanceStore, FinanceError, type FinanceTx } from '../db/financeStore.js';
import { AuthStore } from '../db/authStore.js';
import { OrdersStore } from '../db/ordersStore.js';
import { ReferralStore } from '../db/referralStore.js';
import { economicsPolicy,computeEconomicReward } from './referralEconomics.js';
import { canonicalGhanaPhone } from '../utils/phone.js';
import { moneyMinor, percentMinor } from '../../shared/money.js';
import type { OrderRecord } from '../types/orders.js';
import { PaystackServerService } from './paystackService.js';
import { FinanceService, operationKey } from './financeService.js';
import { FulfilmentService } from './fulfilmentService.js';
import { normalizeCampaign, campaignPriceFor, campaignState, campaignHeadlinePercent, isCampaignDate, AFA_DECEMBER_PROPOSAL, type DirectCampaignConfig } from '../../shared/directCampaign.js';
import { accraDate } from '../../shared/seasonal.js';
import { DECEMBER_2026_CAMPAIGN_ID as CAMPAIGN_ID } from '../../shared/directCampaign.js';

const PRICE_DEFAULT={version:'direct-launch-v1',products:{} as Record<string,{retailMinor:number;enabled:boolean;recommendedMinor:number|null}>,reserveBps:0,reserveFixedMinor:0,reserveConfigured:false};
const OFFER_DEFAULT={version:'welcome-launch-v1',enabled:true,discountMinor:100,services:['data'],requirement:'unique_phone'};
const config=async(id:string,tx?:FinanceTx)=>{
  const read=(key:string)=>tx?tx.config(key):FinanceStore.readConfig(key);
  const stored=await read(id);
  if(id==='direct-campaign')return normalizeCampaign(stored);
  if(id!=='direct-pricing')return {...OFFER_DEFAULT,...stored};
  // Reuse an existing enabled Data economics reserve until explicitly configured here.
  const economics=await read('economics:data');
  const fallback=economics?.enabled&&(economics.mode!=='stage_margin_percent'||economics.reserveConfigured)?{reserveBps:economics.reserveBps,reserveFixedMinor:economics.reserveMinor,reserveConfigured:true}:{};
  return {...PRICE_DEFAULT,...stored,...(!stored?.reserveConfigured?fallback:{})};
};
const lock=async(tx:FinanceTx,exclusive=false)=>{if(tx.client)await tx.client.query(`SELECT pg_advisory_xact_lock${exclusive?'':'_shared'}(hashtextextended('commercial-policy',0))`);};
const direct=(order:OrderRecord)=>!order.store_context&&(!order.service_type||order.service_type==='data');
const campaignConfig=(tx?:FinanceTx)=>config('direct-campaign',tx) as Promise<DirectCampaignConfig>;
export class CommercialService {
  /** Server clock for dated pricing. Tests replace it; nothing from a request can. */
  static now=()=>new Date();
  static async catalog(tx?:FinanceTx) {
    const prices=await config('direct-pricing',tx),campaign=await campaignConfig(tx),now=CommercialService.now();
    const products=Object.values(AUTHORITATIVE_PRODUCTS).map(p=>{
      const setting=prices.products[p.id],standardMinor=setting?.retailMinor??p.amountPesewas;
      // A campaign price applies only while the campaign is enabled and today (Accra) is inside its dates; otherwise
      // the product is exactly as before, with no extra fields.
      const campaignMinor=campaignPriceFor(campaign,p.id,standardMinor,now),amountPesewas=campaignMinor??standardMinor;
      return {...p,amountPesewas,priceGhc:amountPesewas/100,isActive:p.isActive&&(setting?.enabled??true),
        ...(campaignMinor!==null?{standardPesewas:standardMinor,campaign:{id:campaign.id,label:campaign.label,endDate:campaign.endDate,stacksWithWelcome:campaign.stacksWithWelcome,revision:campaign.version}}:{})};
    }).filter(p=>p.isActive);
    const applied=products.some(p=>p.standardPesewas!==undefined);
    // The campaign revision joins the pricing revision while it applies, so a quote from before a start, end or
    // campaign change is refused at payment and the customer reviews the new total.
    return {version:applied?`${prices.version}~${campaign.version}`:prices.version,products,
      ...(applied?{campaign:{id:campaign.id,label:campaign.label,title:campaign.title,endDate:campaign.endDate,maxSavingPercent:campaignHeadlinePercent(products)}}:{})};
  }
  static async eligibility(tx:FinanceTx) {
    // Re-read and lock identity: middleware/cached profiles never establish eligibility.
    const user=tx.client?(await tx.client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[tx.userId])).rows[0]:await AuthStore.findUserById(tx.userId);
    const phone=user?.status==='active'?canonicalGhanaPhone(user.phone||''):null;
    if(!phone)return {state:'phone_required',phone:null};
    const matches=tx.client?(await tx.client.query('SELECT id FROM users WHERE mystery_canonical_phone(phone)=$1',[phone])).rows:AuthStore.adminDevUsers().filter(u=>canonicalGhanaPhone(u.phone||'')===phone);
    if(matches.length!==1)return {state:'phone_conflict',phone:null};
    if(tx.client)await tx.client.query("SELECT pg_advisory_xact_lock(hashtextextended('welcome:' || $1,0))",[phone]);
    const claim=await tx.config(`welcome-phone:${phone}`);
    if(claim&&claim.userId!==tx.userId)return {state:'unavailable',phone};
    const operations=(await tx.operations()).filter(o=>o.kind==='welcome');
    if(operations.some(o=>o.state==='redeemed'))return {state:'redeemed',phone};
    if(operations.some(o=>o.state==='reserved'))return {state:'reserved',phone};
    const orders=tx.client?(await tx.client.query<OrderRecord>("SELECT * FROM orders WHERE user_id=$1 AND store_context IS NULL AND (service_type='data' OR service_type IS NULL) AND payment_status='success' AND (status<>'refunded' OR COALESCE(manual_review,FALSE)=TRUE)",[tx.userId])).rows:OrdersStore.adminDevOrders().filter(o=>o.user_id===tx.userId&&direct(o)&&o.payment_status==='success'&&(o.status!=='refunded'||o.manual_review));
    if(orders.length)return {state:'previous_buyer',phone};
    return {state:'eligible',phone};
  }
  static async quote(productId:string,userId?:string,tx?:FinanceTx) : Promise<any> {
    if(userId&&!tx)return FinanceStore.transaction(userId,t=>this.quote(productId,userId,t));
    if(tx)await lock(tx);
    const base=getAuthoritativeProduct(productId);const catalog=await this.catalog(tx);
    const product=catalog.products.find(p=>p.id===base?.id);if(!product)throw new FinanceError('Bundle unavailable.',404);
    const offer=await config('welcome-offer',tx),identity=tx?await this.eligibility(tx):{state:'guest',phone:null};
    const enabled=offer.enabled&&offer.services.includes('data');
    // The welcome benefit stacks on a campaign price only where that campaign says so (December Specials: yes).
    const stacks=!product.campaign||product.campaign.stacksWithWelcome;
    const discountMinor=enabled&&stacks&&identity.state==='eligible'?offer.discountMinor:0;
    if(product.amountPesewas-discountMinor<=0)throw new FinanceError('This promotion would create an invalid payment amount. Contact support.',409);
    // regularMinor keeps its meaning: the price this product sells for now, before the welcome benefit. While a
    // campaign applies, standardMinor is the price before the campaign. Absent otherwise, so ordinary quotes are unchanged.
    const campaign=product.standardPesewas!==undefined?{standardMinor:product.standardPesewas,campaignSavingMinor:product.standardPesewas-product.amountPesewas,campaign:product.campaign}:{};
    return {product,regularMinor:product.amountPesewas,discountMinor,totalMinor:product.amountPesewas-discountMinor,pricingRevision:catalog.version,promotionRevision:offer.version,offer:{enabled,discountMinor:offer.discountMinor,requirement:'unique_phone',state:enabled?identity.state:'disabled'},buyerPhone:identity.phone,...campaign};
  }
  static async prepare(order:OrderRecord,input:Record<string,unknown>,tx?:FinanceTx) {
    const quote=await this.quote(order.product_id,order.user_id||undefined,tx);
    if(input.expectedTotalMinor!==undefined&&input.expectedTotalMinor!==quote.totalMinor||input.expectedRegularMinor!==undefined&&input.expectedRegularMinor!==quote.regularMinor||input.expectedStandardMinor!==undefined&&input.expectedStandardMinor!==(quote.standardMinor??quote.regularMinor)||input.pricingRevision!==undefined&&input.pricingRevision!==quote.pricingRevision||input.promotionRevision!==undefined&&input.promotionRevision!==quote.promotionRevision)
      throw new FinanceError('Price or welcome eligibility changed. Refresh and review the current total before paying.',409);
    if(process.env.NODE_ENV==='production'&&input.expectedTotalMinor===undefined)throw new FinanceError('Refresh checkout and review the current price before paying.',409);
    const prices=await config('direct-pricing',tx),reserveMinor=prices.reserveConfigured?percentMinor(quote.totalMinor,prices.reserveBps)+prices.reserveFixedMinor:null;
    if(order.supplier_cost_minor!==null&&quote.regularMinor<order.supplier_cost_minor)throw new FinanceError('This regular price does not cover the current supplier cost. Contact support.',409);
    const snapshot={regularMinor:quote.regularMinor,discountMinor:quote.discountMinor,paidMinor:quote.totalMinor,pricingRevision:quote.pricingRevision,promotionId:quote.discountMinor?'welcome-v1' as const:null,promotionRevision:quote.discountMinor?quote.promotionRevision:null,buyerPhone:quote.discountMinor?quote.buyerPhone:null,supplierCostMinor:order.supplier_cost_minor,reserveMinor,normalReserveMinor:prices.reserveConfigured?percentMinor(quote.regularMinor,prices.reserveBps)+prices.reserveFixedMinor:null,contributionMinor:reserveMinor!==null&&order.supplier_cost_minor!==null?quote.totalMinor-order.supplier_cost_minor-reserveMinor:null,
      // Recorded only for a campaign sale: the pre-campaign price and the campaign that set the selling price.
      ...(quote.standardMinor!==undefined?{standardMinor:quote.standardMinor,priceCampaignId:quote.campaign.id,priceCampaignRevision:quote.campaign.revision}:{})};
    const result={...order,amount:quote.totalMinor,commercial_context:snapshot};
    if(quote.discountMinor) {
      if(!tx)throw new FinanceError('Promotion transaction unavailable.',503);
      await tx.create('welcome',`welcome:${order.id}`,quote.discountMinor,{orderId:order.id,phone:quote.buyerPhone,configRevision:quote.promotionRevision},'reserved');
      await tx.saveConfig(`welcome-phone:${quote.buyerPhone}`,{userId:tx.userId,orderId:order.id,state:'reserved'});
    }
    return result;
  }
  static async initialize(order:OrderRecord,input:Record<string,unknown>) {
    if(input.paymentMethod==='wallet')return FinanceService.payOrder(order,input.requestId,undefined,tx=>this.prepare(order,input,tx));
    let saved:OrderRecord,operationId:string|undefined;
    if(order.user_id) {
      const key=`direct:${operationKey(input.requestId??(process.env.NODE_ENV==='production'?undefined:randomUUID()))}`;
      const result=await FinanceStore.transaction(order.user_id,async tx=>{
        const old=await tx.find(key);
        if(old){if(old.payload.productId!==order.product_id||old.payload.recipient!==order.recipient_phone)throw requireCheckoutRecovery();return {order:(await OrdersStore.findOrder(old.payload.orderId,tx.client))!,old};}
        const prepared=await this.prepare(order,input,tx).catch(error=>{if(error instanceof FinanceError)throw rejectPreflight('CHECKOUT_REVIEW_REQUIRED');throw error;});await this.create(prepared,tx);
        const created=await tx.create('direct_checkout',key,prepared.amount,{orderId:prepared.id,productId:prepared.product_id,recipient:prepared.recipient_phone},'initializing');
        return {order:prepared,created};
      });
      saved=result.order;if(result.old)return {...saved,checkout:result.old.payload.checkout||null,initializationUncertain:!result.old.payload.checkout};operationId=result.created!.id;
    } else {saved=await this.prepare(order,input).catch(async error=>{if(error instanceof FinanceError){await recoverDirectCheckout(undefined,input,order.product_id,order.recipient_phone,order.customer_email||'');throw rejectPreflight('CHECKOUT_REVIEW_REQUIRED');}throw error;});const created=await createGuestCheckoutOnce(saved,input);saved=created.order;if(!created.result.success)throw rejectPreflight('ACTIVE_MTN_ORDER');}
    try {
    const payment=await PaystackServerService.initializeTransaction({email:saved.customer_email,amountPesewas:saved.amount,reference:saved.payment_reference,metadata:{public_reference:saved.public_reference,network:saved.network,service_type:'data',product_id:saved.product_id,product_name:saved.bundle_size_snapshot}});
    if(saved.user_id&&operationId)await FinanceStore.transaction(saved.user_id,async tx=>{const row=(await tx.operations()).find(o=>o.id===operationId)!;await tx.update(row,payment.success?'pending':'initialization_uncertain',{...row.payload,checkout:payment.success?payment:null});});
    if(!payment.success) {
      // A network error is not proof that Paystack rejected initialization.
      if(payment.definitiveFailure)await this.release(saved,'definitive_initialization_failure');
      const error=requireCheckoutRecovery(saved.public_reference);error.status=503;throw error;
    }
    return {...saved,checkout:payment};
    }catch(error){if(error instanceof CheckoutFailure)throw error;const uncertain=requireCheckoutRecovery(saved.public_reference);uncertain.status=503;throw uncertain;}
  }
  static async create(order:OrderRecord,tx:FinanceTx) {
    if(tx.client&&order.network==='mtn') {
      await tx.client.query("SELECT pg_advisory_xact_lock(hashtext('mtn_' || $1))",[canonicalGhanaPhone(order.recipient_phone)]);
      if((await tx.client.query("SELECT id FROM orders WHERE network='mtn' AND recipient_phone=$1 AND status IN ('paid','queued','submitted','processing','refund_pending')",[order.recipient_phone])).rows.length)throw rejectPreflight('ACTIVE_MTN_ORDER');
    } else if(order.network==='mtn'&&await OrdersStore.findActiveMtnOrder(order.recipient_phone))throw rejectPreflight('ACTIVE_MTN_ORDER');
    await OrdersStore.createOrder(order,tx.client);
  }
  static async release(order:OrderRecord,reason:string) {
    if(!order.user_id||!order.commercial_context?.promotionId)return;
    await FinanceStore.transaction(order.user_id,async tx=>{
      const row=await tx.find(`welcome:${order.id}`);if(!row||row.state==='released')return;
      const current=tx.client?(await tx.client.query<OrderRecord>('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[order.id])).rows[0]:await OrdersStore.findOrder(order.id);
      if(!current)return;
      // A stale failed verification must never release a now-paid/supplier-active order.
      if(reason==='definitive_full_refund') {if(current.status!=='refunded'||current.manual_review)return;}
      else if(current.payment_status==='success'||current.paid_at||current.supplier_order_id||!['pending_payment','cancelled','expired','failed'].includes(current.status))return;
      await tx.update(row,'released',{...row.payload,reason,releasedAt:new Date().toISOString()});
      const claim=await tx.config(`welcome-phone:${row.payload.phone}`);if(claim?.orderId===order.id)await tx.saveConfig(`welcome-phone:${row.payload.phone}`,{...claim,state:'released'});
    });
  }
  static async paymentFailed(order:OrderRecord,result:Awaited<ReturnType<typeof PaystackServerService.verifyTransaction>>) {
    if(order.payment_status==='success'||!['failed','abandoned'].includes(result.status)||result.isSimulated)return;
    if(result.reference===order.payment_reference&&result.amountPesewas===order.amount&&result.currency==='GHS')await this.release(order,'verified_'+result.status);
  }
  static async allowPaid(order:OrderRecord) {
    if(!order.user_id||!order.commercial_context?.promotionId)return true;
    return FinanceStore.transaction(order.user_id,async tx=>{
      const row=await tx.find(`welcome:${order.id}`);return Boolean(row&&row.state!=='released');
    });
  }
  static async sync(order:OrderRecord) {
    if(!order.user_id||!order.commercial_context?.promotionId)return;
    if(order.status==='refunded'&&!order.manual_review){await this.release(order,'definitive_full_refund');return;}
    if(order.status==='delivered'&&order.payment_status==='success'&&!order.manual_review)await FinanceStore.transaction(order.user_id,async tx=>{
      const row=await tx.find(`welcome:${order.id}`);if(row?.state==='reserved'){await tx.update(row,'redeemed',{...row.payload,redeemedAt:new Date().toISOString()});await tx.saveConfig(`welcome-phone:${row.payload.phone}`,{userId:tx.userId,orderId:order.id,state:'redeemed'});}
    });
  }
  static async recover() {
    const pool=getPool();
    const candidates=pool?(await pool.query<OrderRecord>(`SELECT o.* FROM orders o JOIN finance_operations f ON f.user_id=o.user_id AND f.idempotency_key='welcome:' || o.id
      WHERE (f.state='reserved' OR f.state='redeemed' AND o.status='refunded' OR f.state='released' AND o.status='paid' AND o.payment_status='success' AND COALESCE(o.manual_review,FALSE)=FALSE) AND o.commercial_context IS NOT NULL
      ORDER BY f.updated_at LIMIT 50`)).rows:OrdersStore.adminDevOrders().filter(o=>o.commercial_context?.promotionId);
    for(const order of candidates) {
      try {
        await this.sync(order);
        if(order.status==='paid'&&order.payment_status==='success'&&!order.manual_review)await FulfilmentService.processPaidOrder(order.payment_reference,order.paid_at||new Date().toISOString(),'Welcome paid dispatch recovery');
        if(order.payment_provider==='paystack'&&order.payment_status!=='success'&&['pending_payment','cancelled','expired'].includes(order.status)) {
          const verified=await PaystackServerService.verifyTransaction(order.payment_reference);
          await this.paymentFailed(order,verified);
          if(verified.isVerified&&verified.status==='success') {
            const {validateOrderPayment}=await import('./paymentValidation.js');
            if(!validateOrderPayment(order,verified))await FulfilmentService.processPaidOrder(order.payment_reference,verified.paidAt||new Date().toISOString(),'Welcome payment recovery');
          }
        }
        if(order.user_id)await FinanceStore.transaction(order.user_id,async tx=>{const row=await tx.find(`welcome:${order.id}`);if(row)await tx.update(row,row.state,{...row.payload,lastCheckedAt:new Date().toISOString()});});
      }catch{/* Durable reservation remains held for subsequent recovery. */}
    }
  }
  static async admin() {
    const [prices,offer,store,economy,campaign]=await Promise.all([config('direct-pricing'),config('welcome-offer'),WebsiteConfig(),economicsPolicy('data'),campaignConfig()]);
    const now=CommercialService.now();
    const products=await Promise.all(Object.values(AUTHORITATIVE_PRODUCTS).map(async p=>{
      const resolved=await FulfilmentService.getProvider().resolvePackage(p.network,p.dataAmount).catch(()=>null),supplierCostMinor=resolved?.resolved?.supplierCostMinor??null;
      const setting=prices.products[p.id],retailMinor=setting?.retailMinor??p.amountPesewas,reserveMinor=prices.reserveConfigured?percentMinor(retailMinor,prices.reserveBps)+prices.reserveFixedMinor:null,discountedMinor=retailMinor-offer.discountMinor;
      const firstRule=await ReferralStore.findMatchingRule('data',p.network,p.id,'acquisition');
      const requestedFirstReward=firstRule?.reward_type==='fixed_minor'?firstRule.reward_minor??0:firstRule?.reward_percent_bps!=null?percentMinor(Math.max(0,discountedMinor),firstRule.reward_percent_bps):0;
      // Estimate for a valid referred first purchase, not a promise of eligibility.
      const dynamic=economy?.enabled&&economy.mode==='stage_margin_percent';
      const estimate={service_type:'data',amount:discountedMinor,supplier_cost_minor:supplierCostMinor,commercial_context:{regularMinor:retailMinor,discountMinor:offer.discountMinor,reserveMinor:prices.reserveConfigured?percentMinor(Math.max(0,discountedMinor),prices.reserveBps)+prices.reserveFixedMinor:null,normalReserveMinor:reserveMinor}} as OrderRecord;
      const firstReferralRewardMinor=dynamic?(firstRule?computeEconomicReward(estimate,firstRule,0,economy,'acquisition').amount:0):requestedFirstReward<=discountedMinor?requestedFirstReward:0;
      const recurringRule=await ReferralStore.findMatchingRule('data',p.network,p.id,'recurring');
      const recurringReferralRewardMinor=dynamic&&recurringRule?computeEconomicReward({...estimate,amount:retailMinor,commercial_context:{...estimate.commercial_context!,reserveMinor}},recurringRule,0,economy,'recurring').amount:null;
      const promoContributionMinor=supplierCostMinor===null||!prices.reserveConfigured?null:discountedMinor-supplierCostMinor-percentMinor(discountedMinor,prices.reserveBps)-prices.reserveFixedMinor;
      const wholesale=store.wholesale[p.id];
      return {...p,...campaignRow(p.id,p.dataAmount,retailMinor,setting?.enabled??true,supplierCostMinor,prices,offer,campaign,now),retailMinor,enabled:setting?.enabled??true,recommendedMinor:setting?.recommendedMinor??null,supplierCostMinor,reserveMinor,spreadMinor:supplierCostMinor===null?null:retailMinor-supplierCostMinor,contributionMinor:supplierCostMinor===null||reserveMinor===null?null:retailMinor-supplierCostMinor-reserveMinor,discountedMinor,promoContributionMinor,recurringReferralRewardMinor,normalContributionMinor:supplierCostMinor===null||reserveMinor===null?null:retailMinor-supplierCostMinor-reserveMinor,recurringContributionMinor:supplierCostMinor===null||reserveMinor===null||recurringReferralRewardMinor===null?null:retailMinor-supplierCostMinor-reserveMinor-recurringReferralRewardMinor,firstReferralRewardMinor,acquisitionContributionMinor:promoContributionMinor===null?null:promoContributionMinor-firstReferralRewardMinor,firstReferralRule:firstRule?{type:firstRule.reward_type,minor:firstRule.reward_minor,bps:firstRule.reward_percent_bps}:null,wholesaleMinor:wholesale?.wholesaleMinor??null,safeResellerFloor:wholesale?minimumFloor(wholesale.wholesaleMinor,store.policy):null,pricePerGb:retailMinor/100/parseFloat(p.dataAmount)};
    }));return {prices,offer,campaign:{...campaign,state:campaignState(campaign,now),today:accraDate(now)},afa:afaCampaignStatus(),products,dataReferralPolicy:economy,audit:(await AdminAuditStore.findRecent(100)).filter(a=>a.action.startsWith('commercial_')||a.action==='store_wholesale_changed'||a.action==='store_policy_changed').slice(0,25)};
  }
  static async save(adminId:string,input:any) {
    if(input.confirmed!==true)throw new FinanceError('Confirm this commercial change.');
    if(!['pricing','offer','campaign'].includes(input.kind))throw new FinanceError('Unknown commercial setting.');
    const id=input.kind==='pricing'?'direct-pricing':input.kind==='campaign'?'direct-campaign':'welcome-offer';
    let next:any;
    if(id==='direct-campaign')next=await campaignInput(input);
    else if(id==='direct-pricing') {
      if(!Number.isInteger(input.reserveBps)||input.reserveBps<0||input.reserveBps>=10000||!Array.isArray(input.products)||input.products.length>Object.keys(AUTHORITATIVE_PRODUCTS).length)throw new FinanceError('Invalid pricing configuration.');
      const products:any={};for(const item of input.products){const p=getAuthoritativeProduct(item.productId);if(!p||products[p.id]||typeof item.enabled!=='boolean')throw new FinanceError('Invalid/duplicate product.');const retailMinor=moneyMinor(item.retailMinor),recommendedMinor=item.recommendedMinor===null?null:moneyMinor(item.recommendedMinor);const cost=(await FulfilmentService.getProvider().resolvePackage(p.network,p.dataAmount).catch(()=>null))?.resolved?.supplierCostMinor;
        if(item.enabled&&(cost===undefined||cost===null||retailMinor<cost))throw new FinanceError('Enabled retail must cover a known authoritative supplier cost.');products[p.id]={retailMinor,recommendedMinor,enabled:item.enabled};}
      if(input.configureReserve!==undefined&&typeof input.configureReserve!=='boolean')throw new FinanceError('Invalid reserve confirmation.');
      next={products,reserveBps:input.reserveBps,reserveFixedMinor:moneyMinor(input.reserveFixedMinor,true)};
    } else {
      if(typeof input.enabled!=='boolean'||!Array.isArray(input.services)||input.services.some((s:any)=>s!=='data')||input.requirement!=='unique_phone')throw new FinanceError('V1 supports direct Data and unique account phone only.');
      const discountMinor=moneyMinor(input.discountMinor);const prices=await this.catalog();if(prices.products.some(p=>p.amountPesewas<=discountMinor)&&input.enabled)throw new FinanceError('Discount must leave a positive payment for every enabled product.');
      next={enabled:input.enabled,discountMinor,services:[...new Set(input.services)],requirement:'unique_phone'};
    }
    return FinanceStore.transaction(adminId,async tx=>{
      await lock(tx,true);const previous=await config(id,tx);
      if(previous.version!==input.expectedVersion)throw new FinanceError('Configuration changed. Refresh before saving.',409);
      const stored=await tx.config(id);
      const result={...next,...(id==='direct-pricing'?{products:{...previous.products,...next.products},reserveBps:input.configureReserve===true?next.reserveBps:stored?.reserveBps??0,reserveFixedMinor:input.configureReserve===true?next.reserveFixedMinor:stored?.reserveFixedMinor??0,reserveConfigured:input.configureReserve===true||Boolean(stored?.reserveConfigured)}:{}),version:randomUUID(),updatedAt:new Date().toISOString(),actorId:adminId};
      const prices=id==='direct-pricing'?result:await config('direct-pricing',tx),offer=id==='welcome-offer'?result:await config('welcome-offer',tx),campaign=id==='direct-campaign'?normalizeCampaign(result):await campaignConfig(tx);
      if(offer.enabled&&offer.services.includes('data')&&Object.values(AUTHORITATIVE_PRODUCTS).some(p=>{
        if(!(prices.products[p.id]?.enabled??p.isActive))return false;
        // A configured campaign price is checked as well (whatever its dates), so the welcome benefit can never empty a payment.
        const standard=prices.products[p.id]?.retailMinor??p.amountPesewas,dated=campaign.stacksWithWelcome?campaign.products[p.id]?.campaignMinor:undefined;
        return Math.min(standard,dated??standard)<=offer.discountMinor;
      }))throw new FinanceError('Discount must leave a positive payment for every enabled product.');
      if(id==='direct-campaign')checkCampaignAgainst(campaign,prices,input);
      await tx.saveConfig(id,result);const effective=await config(id,tx);await tx.audit(adminId,'commercial_'+input.kind+'_changed',id,{previous,next:effective});return effective;
    });
  }
}
import { STORE_POLICY_DEFAULTS,minimumStorePrice as minimumFloor } from '../../shared/storeEconomics.js';
async function WebsiteConfig(){return {policy:{...STORE_POLICY_DEFAULTS,...await FinanceStore.readConfig('store-policy')},wholesale:await FinanceStore.readConfig('store-wholesale')||{}};}

/** Campaign columns for one Admin product row: what December would charge and leave, and why it cannot apply. */
function campaignRow(productId:string,dataAmount:string,standardMinor:number,enabled:boolean,supplierCostMinor:number|null,prices:any,offer:any,campaign:DirectCampaignConfig,now:Date) {
  const campaignMinor=campaign.products[productId]?.campaignMinor??null;
  if(campaignMinor===null)return {campaignMinor:null,campaignApplies:false,effectiveMinor:standardMinor,campaignIssues:[] as string[]};
  const welcome=campaign.stacksWithWelcome&&offer.enabled&&offer.services?.includes('data')?offer.discountMinor:0;
  const reserve=(m:number)=>prices.reserveConfigured?percentMinor(m,prices.reserveBps)+prices.reserveFixedMinor:null;
  const net=(revenue:number)=>supplierCostMinor===null||!prices.reserveConfigured?null:revenue-supplierCostMinor-reserve(revenue)!;
  const applies=enabled&&campaignPriceFor(campaign,productId,standardMinor,now)!==null,issues:string[]=[];
  if(!enabled)issues.push('Product is not available for sale.');
  if(campaignMinor>=standardMinor)issues.push('December price is not below the standard price, so it will not apply.');
  if(supplierCostMinor===null)issues.push('Supplier cost is unknown, so the campaign cannot be enabled with this product.');
  else if(campaignMinor<supplierCostMinor)issues.push('December price is below the current supplier cost.');
  if(campaignMinor-welcome<=0)issues.push('The welcome benefit would leave no payment.');
  return {campaignMinor,campaignApplies:applies,effectiveMinor:applies?campaignMinor:standardMinor,campaignSavingMinor:standardMinor-campaignMinor,campaignWelcomeTotalMinor:campaignMinor-welcome,
    campaignContributionMinor:net(campaignMinor),campaignWelcomeContributionMinor:net(campaignMinor-welcome),campaignPricePerGb:campaignMinor/100/parseFloat(dataAmount),campaignIssues:issues};
}
/** Validates an Admin campaign change before the transaction (supplier costs are read here, as for retail prices). */
async function campaignInput(input:any) {
  const dates=['startDate','endDate'].map(k=>input[k]===null||input[k]===''?null:input[k]);
  if(typeof input.enabled!=='boolean'||dates.some(d=>d!==null&&!isCampaignDate(d))||!Array.isArray(input.products)||input.products.length>Object.keys(AUTHORITATIVE_PRODUCTS).length||(input.stacksWithWelcome!==undefined&&typeof input.stacksWithWelcome!=='boolean'))throw new FinanceError('Invalid December campaign settings.');
  const [startDate,endDate]=dates as (string|null)[];
  if(startDate&&endDate&&endDate<startDate)throw new FinanceError('The last day must be on or after the first day.');
  const products:Record<string,{campaignMinor:number}>={};
  for(const item of input.products) {
    const p=item&&typeof item.productId==='string'&&Object.hasOwn(AUTHORITATIVE_PRODUCTS,item.productId)?AUTHORITATIVE_PRODUCTS[item.productId]:undefined;
    if(!p||products[p.id])throw new FinanceError('Choose each standard Data product once.');
    products[p.id]={campaignMinor:moneyMinor(item.campaignMinor)};
  }
  if(input.enabled) {
    // Enabling is deliberate: a typed campaign name, complete dates that have not passed, and prices covering known supplier cost.
    if(input.activation!==CAMPAIGN_ID)throw new FinanceError(`Type ${CAMPAIGN_ID} to enable December prices.`);
    if(!startDate||!endDate)throw new FinanceError('Set the first and last day before enabling December prices.');
    if(endDate<accraDate(CommercialService.now()))throw new FinanceError('This campaign has already ended.');
    if(!Object.keys(products).length)throw new FinanceError('Choose at least one product before enabling December prices.');
    for(const [productId,{campaignMinor}] of Object.entries(products)) {
      const p=AUTHORITATIVE_PRODUCTS[productId],cost=(await FulfilmentService.getProvider().resolvePackage(p.network,p.dataAmount).catch(()=>null))?.resolved?.supplierCostMinor;
      if(cost===undefined||cost===null||campaignMinor<cost)throw new FinanceError(`${p.networkName} ${p.dataAmount}: a December price must cover a known authoritative supplier cost.`);
    }
  }
  return {id:CAMPAIGN_ID,enabled:input.enabled,startDate,endDate,stacksWithWelcome:input.stacksWithWelcome??true,products};
}
/** Checks against the locked standard prices: a campaign price must be a genuine reduction. */
function checkCampaignAgainst(campaign:DirectCampaignConfig,prices:any,input:any) {
  for(const [productId,{campaignMinor}] of Object.entries(campaign.products)) {
    const p=AUTHORITATIVE_PRODUCTS[productId],standard=prices.products[productId]?.retailMinor??p.amountPesewas;
    if(campaignMinor>=standard)throw new FinanceError(`${p.networkName} ${p.dataAmount}: the December price must be below the standard price of ${(standard/100).toFixed(2)}.`);
    if(input.enabled&&prices.products[productId]?.enabled===false)throw new FinanceError(`${p.networkName} ${p.dataAmount} is not available for sale.`);
  }
}
/** AFA's December price is prepared, not applied: these are the reasons it cannot be purchasable or advertised yet. */
function afaCampaignStatus() {
  const raw=process.env.AFA_RETAIL_PRICE_MINOR||'',current=/^\d+$/.test(raw)&&Number(raw)>0?Number(raw):null;
  return {currentMinor:current,...AFA_DECEMBER_PROPOSAL,discountPercent:Math.floor(((AFA_DECEMBER_PROPOSAL.historicalRetailMinor-AFA_DECEMBER_PROPOSAL.proposedMinor)*100)/AFA_DECEMBER_PROPOSAL.historicalRetailMinor),purchasable:false,
    reasons:['AFA checkout prices from its own server configuration, outside the commercial quote and revision checks.','No authoritative supplier cost is known before purchase (it is reported only after submission).','AFA checkout has no review step that would refuse a stale price before payment.']};
}
