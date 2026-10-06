import { randomUUID } from 'node:crypto';
import { FinanceStore, FinanceError, type FinanceTx } from '../db/financeStore.js';
import { FinanceService, operationKey, maskWithdrawal } from './financeService.js';
import { WebsiteStore } from '../db/websiteStore.js';
import { WebsiteAssetStore } from '../db/websiteAssetStore.js';
import { OrdersStore } from '../db/ordersStore.js';
import { getPool } from '../db/connection.js';
import { AUTHORITATIVE_PRODUCTS, getAuthoritativeProduct } from '../data/productCatalog.js';
import { FulfilmentService } from './fulfilmentService.js';
import { PaystackServerService } from './paystackService.js';
import { moneyMinor } from '../../shared/money.js';
import { STORE_POLICY_DEFAULTS, minimumStorePrice, storeReserve, type StorePolicy, type StoreSnapshot } from '../../shared/storeEconomics.js';
import { validateAndNormalizeGhanaPhone, canonicalGhanaPhone, getGhanaPhoneLookupVariants } from '../utils/phone.js';
import { toSafePublicOrder, type OrderRecord } from '../types/orders.js';

interface Wholesale { enabled:boolean; wholesaleMinor:number; version:string; updatedAt:string; actorId:string; supplierCostMinor:number }
interface Price { enabled:boolean; retailMinor:number }
interface Prices { version:string; products:Record<string,Price> }
const exact=(input:Record<string,unknown>,keys:string[])=>{if(Object.keys(input).some(key=>!keys.includes(key)))throw new FinanceError('Unexpected request field.');};
const currentPolicy=async(tx?:FinanceTx):Promise<StorePolicy>=>({...STORE_POLICY_DEFAULTS,...await(tx?tx.config('store-policy'):FinanceStore.readConfig('store-policy'))});
const wholesale=async(tx?:FinanceTx):Promise<Record<string,Wholesale>>=>await(tx?tx.config('store-wholesale'):FinanceStore.readConfig('store-wholesale'))||{};
const priceConfig=async(id:string,tx?:FinanceTx):Promise<Prices>=>await(tx?tx.config(`store:${id}`):FinanceStore.readConfig(`store:${id}`))||{version:'empty',products:{}};
async function configLock(tx:FinanceTx,exclusive=false){if(tx.client)await tx.client.query(`SELECT pg_advisory_xact_lock${exclusive?'':'_shared'}(hashtextextended($1,0))`,['store-config']);}

export class WebsiteBusinessService {
  static async owned(siteId:string,userId:string){return WebsiteAssetStore.ownedSite(siteId,userId);}
  static async catalog(siteId:string,userId?:string) {
    const site=userId?await this.owned(siteId,userId):await WebsiteStore.findSiteById(siteId);
    if(!site||!userId&&site.status!=='published')throw new FinanceError('Store not found.',404);
    if(site.template_id!=='tmpl-data-reseller')return {version:'empty',products:[],managed:false};
    const [policy,costs,prices]=await Promise.all([currentPolicy(),wholesale(),priceConfig(site.id)]);
    const commercial=userId?await FinanceStore.readConfig('direct-pricing'):null;
    const products=Object.values(AUTHORITATIVE_PRODUCTS).filter(product=>product.isActive).flatMap(product=>{
      const cost=costs[product.id],price=prices.products[product.id];
      const floor=cost&&policy.enabled?minimumStorePrice(cost.wholesaleMinor,policy):null;
      const eligible=!!(policy.enabled&&cost?.enabled&&price?.enabled&&floor!==null&&price.retailMinor>=floor);
      if(!userId&&!eligible)return [];
      return [{id:product.id,network:product.network,networkName:product.networkName,dataAmount:product.dataAmount,validity:product.validity,description:product.description,retailMinor:price?.retailMinor||0,enabled:price?.enabled||false,...(userId?{wholesaleMinor:cost?.wholesaleMinor??null,minimumMinor:floor,recommendedMinor:Math.max(floor??0,commercial?.products?.[product.id]?.recommendedMinor??commercial?.products?.[product.id]?.retailMinor??product.amountPesewas),estimatedMinor:eligible?price.retailMinor-cost.wholesaleMinor-storeReserve(price.retailMinor,policy):null,eligible,configured:!!cost?.enabled}: {})}];
    });
    return {managed:true,version:prices.version,products,...(userId?{policy}:{})};
  }
  static async savePrices(siteId:string,userId:string,input:Record<string,unknown>) {
    exact(input,['expectedVersion','products']);
    if(!Array.isArray(input.products)||input.products.length>Object.keys(AUTHORITATIVE_PRODUCTS).length)throw new FinanceError('Invalid bundle prices.');
    return FinanceStore.transaction(userId,async tx=>{
      await configLock(tx);await this.owned(siteId,userId);
      if(tx.client)await tx.client.query('SELECT id FROM website_sites WHERE id=$1 AND user_id=$2 FOR UPDATE',[siteId,userId]);
      const site=await WebsiteStore.findSiteById(siteId);if(site?.template_id!=='tmpl-data-reseller')throw new FinanceError('Select the Data Reseller template first.');
      const existing=await priceConfig(siteId,tx);if(input.expectedVersion!==existing.version)throw new FinanceError('Prices changed. Refresh before saving.',409);
      const policy=await currentPolicy(tx),costs=await wholesale(tx),products={...existing.products};const seen=new Set<string>();
      for(const item of input.products as any[]) {
        exact(item,['productId','retailMinor','enabled']);const product=getAuthoritativeProduct(item.productId);
        if(!product||seen.has(product.id)||typeof item.enabled!=='boolean')throw new FinanceError('Invalid or duplicate bundle.');seen.add(product.id);
        const retail=moneyMinor(item.retailMinor,true),cost=costs[product.id];
        if(item.enabled&&(!policy.enabled||!cost?.enabled||retail<minimumStorePrice(cost.wholesaleMinor,policy)))throw new FinanceError('Set a price at or above the configured minimum online price.');
        products[product.id]={enabled:item.enabled,retailMinor:retail};
      }
      const result={version:randomUUID(),products};await tx.saveConfig(`store:${siteId}`,result);await tx.audit(userId,'store_prices_changed',siteId,{version:result.version,product_count:seen.size});return result;
    });
  }
  static async adminConfig() {
    const [policy,costs]=await Promise.all([currentPolicy(),wholesale()]);
    const products=await Promise.all(Object.values(AUTHORITATIVE_PRODUCTS).filter(p=>p.isActive).map(async p=>{
      const resolved=await FulfilmentService.getProvider().resolvePackage(p.network,p.dataAmount).catch(()=>null);
      return {id:p.id,network:p.network,dataAmount:p.dataAmount,supplierCostMinor:resolved?.resolved?.supplierCostMinor??null,wholesale:costs[p.id]||null};
    }));return {policy,products};
  }
  static async savePolicy(adminId:string,input:Record<string,unknown>) {
    exact(input,['confirmed','expectedVersion','enabled','reserveBps','reserveFixedMinor','withdrawalMinimumMinor','withdrawalFeeBps']);
    if(input.confirmed!==true||typeof input.enabled!=='boolean'||!Number.isInteger(input.reserveBps)||Number(input.reserveBps)<0||Number(input.reserveBps)>=10000||!Number.isInteger(input.withdrawalFeeBps)||Number(input.withdrawalFeeBps)<0||Number(input.withdrawalFeeBps)>5000)throw new FinanceError('Confirm a valid processing and withdrawal policy.');
    const policy:StorePolicy={enabled:input.enabled,reserveBps:Number(input.reserveBps),reserveFixedMinor:moneyMinor(input.reserveFixedMinor,true),withdrawalMinimumMinor:moneyMinor(input.withdrawalMinimumMinor),withdrawalFeeBps:Number(input.withdrawalFeeBps),version:randomUUID()};
    // Zero processing reserve is not a safe implicit assumption about external fees.
    if(policy.enabled&&policy.reserveBps===0&&policy.reserveFixedMinor===0)throw new FinanceError('Configure a conservative payment-processing reserve before enabling stores.');
    return FinanceStore.transaction(adminId,async tx=>{await configLock(tx,true);const previous=await currentPolicy(tx);if(previous.version!==input.expectedVersion)throw new FinanceError('Policy changed. Refresh.',409);await tx.saveConfig('store-policy',policy);await tx.audit(adminId,'store_policy_changed','store-policy',{previous,next:policy});return policy;});
  }
  static async saveWholesale(adminId:string,input:Record<string,unknown>) {
    exact(input,['confirmed','productId','expectedVersion','wholesaleMinor','enabled']);
    const product=getAuthoritativeProduct(String(input.productId));if(!product||input.confirmed!==true||typeof input.enabled!=='boolean')throw new FinanceError('Confirm a valid product configuration.');
    const amount=moneyMinor(input.wholesaleMinor);
    const resolved=await FulfilmentService.getProvider().resolvePackage(product.network,product.dataAmount);
    const cost=resolved.resolved?.supplierCostMinor;
    if(input.enabled&&(!Number.isSafeInteger(cost)||Number(cost)<=0||amount<Number(cost)))throw new FinanceError('Wholesale must cover the current authoritative supplier cost.');
    return FinanceStore.transaction(adminId,async tx=>{await configLock(tx,true);const costs=await wholesale(tx);if((costs[product.id]?.version||'empty')!==input.expectedVersion)throw new FinanceError('Wholesale changed. Refresh.',409);
      const previous=costs[product.id]||null;const row:Wholesale={enabled:input.enabled as boolean,wholesaleMinor:amount,version:randomUUID(),updatedAt:new Date().toISOString(),actorId:adminId,supplierCostMinor:cost??0};costs[product.id]=row;await tx.saveConfig('store-wholesale',costs);await tx.audit(adminId,'store_wholesale_changed',product.id,{previous,next:row});return row;});
  }
  static async initialize(siteId:string,input:Record<string,unknown>,customerId?:string) {
    if(process.env.NODE_ENV==='production'&&!process.env.PAYSTACK_SECRET_KEY?.trim().startsWith('sk_live_'))throw new FinanceError('Live managed checkout is unavailable.',503);
    exact(input,['productId','recipientPhone','customerEmail','requestId']);
    const product=getAuthoritativeProduct(String(input.productId));if(!product||product.id!==input.productId)throw new FinanceError('Bundle unavailable.');
    const phone=validateAndNormalizeGhanaPhone(input.recipientPhone as string);if(!phone.isValid||!phone.normalized!)throw new FinanceError('Enter a valid Ghana recipient number.');
    if(typeof input.customerEmail!=='string'||input.customerEmail.length>254||!/^\S+@\S+\.\S+$/.test(input.customerEmail))throw new FinanceError('Enter a valid receipt email.');
    const initialSite=await WebsiteStore.findSiteById(siteId);if(!initialSite||initialSite.status!=='published'||initialSite.template_id!=='tmpl-data-reseller')throw new FinanceError('Store not found.',404);
    const key=`store-checkout:${operationKey(input.requestId)}`;
    const preflight=await FulfilmentService.preflightCheck(product.network,product.dataAmount,phone.normalized!);
    if(!preflight.allowed||!Number.isSafeInteger(preflight.supplierCostMinor)||Number(preflight.supplierCostMinor)<=0)throw new FinanceError('Bundle is temporarily unavailable for managed checkout.',503);
    const created=await FinanceStore.transaction(initialSite.user_id,async tx=>{
      await configLock(tx);const old=await tx.find(key);if(old){if(old.payload.siteId!==siteId||old.payload.productId!==product.id||old.payload.recipient!==phone.normalized!||old.payload.email!==input.customerEmail||old.payload.customerId!==(customerId||null))throw new FinanceError('Checkout request changed.',409);return {row:old,fresh:false};}
      if(tx.client)await tx.client.query('SELECT id FROM website_sites WHERE id=$1 FOR UPDATE',[siteId]);
      const site=await WebsiteStore.findSiteById(siteId);if(!site||site.status!=='published'||site.template_id!=='tmpl-data-reseller')throw new FinanceError('Store is unavailable.',409);
      const policy=await currentPolicy(tx),costs=await wholesale(tx),prices=await priceConfig(siteId,tx),cost=costs[product.id],price=prices.products[product.id];
      if(!policy.enabled||!cost?.enabled||!price?.enabled||cost.wholesaleMinor<Number(preflight.supplierCostMinor)||price.retailMinor<minimumStorePrice(cost.wholesaleMinor,policy))throw new FinanceError('Bundle pricing needs an update before checkout.',409);
      const snapshot:StoreSnapshot={channel:'website_store',siteId,ownerId:site.user_id,productId:product.id,retailMinor:price.retailMinor,wholesaleMinor:cost.wholesaleMinor,reserveMinor:storeReserve(price.retailMinor,policy),earningMinor:price.retailMinor-cost.wholesaleMinor-storeReserve(price.retailMinor,policy),supplierCostMinor:preflight.supplierCostMinor!,currency:'GHS',policyVersion:policy.version,wholesaleVersion:cost.version,priceVersion:prices.version};
      if(product.network==='mtn') {
        if(tx.client){await tx.client.query("SELECT pg_advisory_xact_lock(hashtext('mtn_' || $1))",[canonicalGhanaPhone(phone.normalized!)]);const active=await tx.client.query("SELECT id FROM orders WHERE network='mtn' AND recipient_phone=ANY($1::text[]) AND status IN ('paid','queued','submitted','processing','refund_pending') LIMIT 1",[getGhanaPhoneLookupVariants(phone.normalized!)]);if(active.rows.length)throw new FinanceError('An MTN order is already processing for this number.',409);}
        else if(await OrdersStore.findActiveMtnOrder(phone.normalized!))throw new FinanceError('An MTN order is already processing for this number.',409);
      }
      const id=`ord_${randomUUID()}`,reference=`MH_STORE_${randomUUID()}`,publicRef=`MH-${randomUUID()}`,now=new Date().toISOString();
      const order:OrderRecord={id,user_id:customerId||null,public_reference:publicRef,customer_name:null,customer_email:input.customerEmail as string,customer_phone:phone.normalized!,recipient_phone:phone.normalized!,network:product.network,service_type:'data',product_id:product.id,product_name_snapshot:`${product.networkName} ${product.dataAmount}`,bundle_size_snapshot:product.dataAmount,amount:snapshot.retailMinor,currency:'GHS',status:'pending_payment',payment_provider:'paystack',payment_reference:reference,payment_status:'pending',supplier_provider:'success_biz_hub',supplier_order_id:null,supplier_response:null,supplier_cost_minor:snapshot.supplierCostMinor,supplier_offer_ref:null,supplier_last_checked_at:null,failure_reason:null,created_at:now,updated_at:now,paid_at:null,submitted_at:null,delivered_at:null,referrer_user_id:null,referral_attribution_id:null,referral_code:null,store_context:snapshot};
      await OrdersStore.createOrder(order,tx.client);
      const row=await tx.create('store_checkout',key,order.amount,{siteId,productId:product.id,recipient:phone.normalized!,email:input.customerEmail,customerId:customerId||null,orderId:id,reference,publicRef},'initializing');return {row,fresh:true};
    });
    let row=created.row;
    if(created.fresh) {
      const payment=await PaystackServerService.initializeTransaction({email:input.customerEmail as string,amountPesewas:row.amount_minor,reference:row.payload.reference,metadata:{purpose:'website_store_order',store_id:siteId,order_id:row.payload.orderId,product_id:product.id}});
      row=await FinanceStore.transaction(initialSite.user_id,async tx=>{const current=(await tx.find(key))!;return tx.update(current,payment.success?'pending':'initialization_uncertain',{...current.payload,...(payment.success?{accessCode:payment.accessCode,authorizationUrl:payment.authorizationUrl,isSimulated:payment.isSimulated===true}:{})});});
    }
    if(row.state!=='pending'){const error=new FinanceError('Payment connection is uncertain. Track the existing order before trying again.',409);Object.assign(error,{existingOrderReference:row.payload.publicRef});throw error;}
    return {success:true,orderRef:row.payload.publicRef,reference:row.payload.reference,amountPesewas:row.amount_minor,currency:'GHS',accessCode:row.payload.accessCode,authorizationUrl:row.payload.authorizationUrl,isSimulated:row.payload.isSimulated};
  }
  /** Durable order is authority. Repeat calls recover missing effects without duplicate credits. */
  static async syncOrder(input:OrderRecord) {
    if(!input.store_context)return;
    return FinanceStore.transaction(input.store_context.ownerId,async tx=>{
      const order=await OrdersStore.findOrder(input.id,tx.client);if(!order?.store_context||order.payment_status!=='success')return;
      const snapshot=order.store_context,key=`store-sale:${order.id}`;let row=await tx.find(key);
      if(!row)row=await tx.create('store_sale',key,snapshot.earningMinor,{orderId:order.id,siteId:snapshot.siteId,snapshot},'pending');
      if(order.status==='delivered'&&!order.manual_review&&row.state==='pending') {
        if(snapshot.earningMinor>0)await tx.append(row,'store',snapshot.earningMinor,'Delivered store sale');
        await tx.update(row,'available',{...row.payload,availableAt:order.delivered_at||new Date().toISOString()});
      } else if(['failed','cancelled','refunded'].includes(order.status)&&!order.manual_review&&['pending','available','manual_review'].includes(row.state)) {
        if(row.payload.availableAt) {
          const earnings=await tx.storeEarnings();if(earnings.availableMinor<row.amount_minor){await tx.update(row,'manual_review');await tx.restrict();return;}
          const reversal=await tx.create('reversal',`store-reversal:${order.id}`,row.amount_minor,{orderId:order.id,source:'store'});
          if(row.amount_minor>0)await tx.append(reversal,'store',-row.amount_minor,'Store sale reversal');
        }
        await tx.update(row,'reversed',{...row.payload,reversedAt:new Date().toISOString()});
      }
    });
  }
  static async publicOrder(siteId:string,reference:string) {
    if(!/^MH-[a-zA-Z0-9-]{1,60}$/.test(reference))throw new FinanceError('Order not found.',404);
    let order=await OrdersStore.findOrder(reference);
    if(!order?.store_context||order.store_context.siteId!==siteId)throw new FinanceError('Order not found.',404);
    order=await FulfilmentService.refreshOrderStatusIfDue(order);
    return toSafePublicOrder(order);
  }
  static async siteOrders(siteId:string,offset=0):Promise<OrderRecord[]> {
    const db=getPool();return db?(await db.query<OrderRecord>("SELECT * FROM orders WHERE store_context->>'siteId'=$1 ORDER BY created_at DESC LIMIT 25 OFFSET $2",[siteId,offset])).rows:OrdersStore.adminDevOrders().filter(o=>o.store_context?.siteId===siteId).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(offset,offset+25);
  }
  static async recoverEffects() {
    const db=getPool();
    const orders:OrderRecord[]=db?(await db.query<OrderRecord>(`SELECT o.* FROM orders o LEFT JOIN finance_operations f ON f.kind='store_sale' AND f.payload->>'orderId'=o.id
      WHERE o.store_context IS NOT NULL AND o.payment_status='success' AND (o.status='paid' OR f.id IS NULL OR (f.state IN ('pending','available','manual_review') AND o.status IN ('delivered','failed','refunded','cancelled')))
      ORDER BY o.updated_at LIMIT 50`)).rows:OrdersStore.adminDevOrders().filter(o=>o.store_context&&o.payment_status==='success');
    for(const order of orders){try{if(order.manual_review&&order.supplier_order_id)await FulfilmentService.refreshOrderStatusIfDue(order,true);await this.syncOrder(order);if(order.status==='paid')await FulfilmentService.processPaidOrder(order.payment_reference,order.paid_at!,'Managed store recovery');}catch{ /* Durable order remains eligible on the next pass. */ }}
  }
  static safeStoreOrder(o:OrderRecord) {return {id:o.id,reference:o.public_reference,createdAt:o.created_at,network:o.network,bundle:o.bundle_size_snapshot,recipient:`******${o.recipient_phone.slice(-4)}`,retailMinor:o.amount,earningMinor:o.store_context!.earningMinor,status:o.status,manualReview:!!o.manual_review,paid:o.payment_status==='success',snapshot:o.store_context};}
  static async ownerSummary(siteId:string,userId:string,offset=0) {
    await this.owned(siteId,userId);const orders=await this.siteOrders(siteId,offset);for(const order of orders)await this.syncOrder(order);
    return FinanceStore.transaction(userId,async tx=>{const operations=await tx.operations();return {orders:orders.map(o=>({...this.safeStoreOrder(o),earningState:operations.find(row=>row.idempotency_key===`store-sale:${o.id}`)?.state||(o.payment_status==='success'?'awaiting_reconciliation':'awaiting_payment')})),earnings:await tx.storeEarnings(),policy:await currentPolicy(tx),withdrawals:operations.filter(o=>o.kind==='withdrawal'&&o.payload.source==='store').slice(offset,offset+25).map(maskWithdrawal),ledger:(await tx.ledger()).filter(e=>e.bucket==='store').slice(offset,offset+25),activity:operations.filter(o=>o.payload.siteId===siteId||o.kind==='withdrawal'&&o.payload.source==='store').slice(0,15).map(o=>({id:o.id,kind:o.kind,state:o.state,createdAt:o.created_at,amountMinor:o.amount_minor}))};});
  }
  static async withdraw(siteId:string,userId:string,input:Record<string,unknown>){await this.owned(siteId,userId);exact(input,['confirmed','amountMinor','requestId','phone','network','recipientName']);return FinanceService.requestWithdrawal(userId,{...input,source:'store'});}
  static async reconcileReversal(adminId:string,orderId:string,input:Record<string,unknown>) {
    exact(input,['confirmed','reason']);
    if(input.confirmed!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>160)throw new FinanceError('Confirm reconciliation with an operational reason.');
    const order=await OrdersStore.findOrder(orderId);if(!order?.store_context||!['refunded','failed','cancelled'].includes(order.status)||order.manual_review)throw new FinanceError('A definitive store reversal is required.',409);
    await this.syncOrder(order);
    return FinanceStore.transaction(order.store_context.ownerId,async tx=>{const row=await tx.find(`store-sale:${order.id}`);if(row?.state!=='reversed')throw new FinanceError('Recover funds or release unpaid reservations before reconciliation.',409);await tx.clearRestriction();await tx.audit(adminId,'store_reversal_reconciled',order.id,{reason:input.reason,amount_minor:row.amount_minor});return {reconciled:true};});
  }
}
