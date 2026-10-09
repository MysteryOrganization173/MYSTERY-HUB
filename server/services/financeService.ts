import { randomUUID } from 'node:crypto';
import { FinanceStore, FinanceTx, FinanceError, type FinanceOperation } from '../db/financeStore.js';
import { moneyMinor, percentMinor, MAX_MONEY_MINOR } from '../../shared/money.js';
import { PaystackServerService } from './paystackService.js';
import { OrdersStore } from '../db/ordersStore.js';
import { FulfilmentService } from './fulfilmentService.js';
import { ReferralStore } from '../db/referralStore.js';
import { validateAndNormalizeGhanaPhone, canonicalGhanaPhone, getGhanaPhoneLookupVariants } from '../utils/phone.js';
import type { OrderRecord } from '../types/orders.js';
import type { UserRecord } from '../types/auth.js';

export const FINANCE_DEFAULTS={withdrawalMinimumMinor:500,withdrawalFeeBps:300,topupMinimumMinor:100,topupMaximumMinor:100_000};
export function operationKey(value:unknown) {if(typeof value!=='string'||!/^[-a-zA-Z0-9_]{16,80}$/.test(value))throw new FinanceError('A stable request ID is required.');return value;}
const confirmation=(value:unknown)=>{if(value!==true)throw new FinanceError('Explicit confirmation is required.');};
const text=(value:unknown,max=160)=>{if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x1f]/.test(value))throw new FinanceError('Enter a valid reason/name/reference.');return value.trim();};
const sameAmount=(row:FinanceOperation,amount:number)=>{if(row.amount_minor!==amount)throw new FinanceError('This request ID belongs to a different amount.',409);};
export const maskWithdrawal=(row:FinanceOperation)=>({...row,payload:{source:row.payload.source==='store'?'Store Earnings':'Mystery Earn',network:row.payload.network,maskedPhone:`******${String(row.payload.phone).slice(-4)}`,feeBps:row.payload.feeBps,feeMinor:row.payload.feeMinor,netMinor:row.payload.netMinor,paidAt:row.payload.paidAt||null,rejectionReason:row.payload.rejectionReason||null}});
export class FinanceService {
  static async config(tx:FinanceTx){return {...FINANCE_DEFAULTS,...await tx.config('settings')};}
  static async summary(userId:string,offset=0) {
    return FinanceStore.transaction(userId,async tx=>{const account=await tx.account();const earn=await tx.earn();return {walletMinor:account.wallet_minor,restricted:account.restricted,earn,settings:await this.config(tx),ledger:(await tx.ledger()).filter(x=>x.bucket==='wallet').slice(offset,offset+25),withdrawals:(await tx.operations()).filter(x=>x.kind==='withdrawal'&&x.payload.source!=='store').slice(offset,offset+25).map(maskWithdrawal),topups:(await tx.operations()).filter(x=>x.kind==='topup').slice(0,10).map(x=>({id:x.id,amountMinor:x.amount_minor,state:x.state,reference:x.payload.reference,createdAt:x.created_at})),achievements:await this.achievementProgress(tx)};});
  }
  static async initializeTopup(user:UserRecord,input:Record<string,unknown>,origin:string) {
    if(process.env.NODE_ENV==='production'&&!process.env.PAYSTACK_SECRET_KEY?.trim().startsWith('sk_live_'))throw new FinanceError('Live Wallet funding is unavailable.',503);
    const amount=moneyMinor(input.amountMinor), key=`topup:${operationKey(input.requestId)}`;
    if(!user.email||!/^\S+@\S+\.\S+$/.test(user.email))throw new FinanceError('Add a valid email to My Account before funding Wallet.');
    const row=await FinanceStore.transaction(user.id,async tx=>{
      const settings=await this.config(tx);if(amount<settings.topupMinimumMinor||amount>settings.topupMaximumMinor)throw new FinanceError(`Funding must be between ${settings.topupMinimumMinor/100} and ${settings.topupMaximumMinor/100} GHS.`);
      const old=await tx.find(key);if(old){sameAmount(old,amount);return {operation:old,new:false};}
      const account=await tx.account();if(account.restricted)throw new FinanceError('Account needs reconciliation.',409);
      const openFunding=(await tx.operations()).filter(x=>x.kind==='topup'&&['initializing','pending','initialization_uncertain'].includes(x.state)).reduce((sum,x)=>sum+x.amount_minor,0);
      if(account.wallet_minor+openFunding+amount>MAX_MONEY_MINOR)throw new FinanceError('Funding exceeds the Wallet balance limit. Reconcile open funding first.',409);
      const operation=await tx.create('topup',key,amount,{reference:`MH-WALLET-${randomUUID()}`,purpose:'wallet_topup',currency:'GHS'},'initializing');return {operation,new:true};
    });
    if(!row.new)return {id:row.operation.id,reference:row.operation.payload.reference,authorizationUrl:row.operation.payload.authorizationUrl,state:row.operation.state};
    const payment=await PaystackServerService.initializeTransaction({email:user.email,amountPesewas:amount,reference:row.operation.payload.reference,callbackUrl:`${origin}/wallet`,channels:['mobile_money'],metadata:{purpose:'wallet_topup',topup_id:row.operation.id,user_id:user.id}});
    await FinanceStore.transaction(user.id,async tx=>{const current=(await tx.find(key))!;if(current.state==='credited')return;await tx.update(current,payment.success?'pending':'initialization_uncertain',{...current.payload,...(payment.success?{authorizationUrl:payment.authorizationUrl}:{}),simulated:payment.isSimulated===true});});
    if(!payment.success)throw new FinanceError('Payment initialization is uncertain. Reconcile this funding request before starting another.',503);
    return {id:row.operation.id,reference:row.operation.payload.reference,authorizationUrl:payment.authorizationUrl,state:'pending'};
  }
  static async verifyTopup(reference:string,userId?:string,adminId?:string) {
    const row=await FinanceStore.ownerOf(reference,'topup');if(!row||userId&&row.user_id!==userId)throw new FinanceError('Funding request not found.',404);
    if(row.state==='credited'||['reversed','reversal_review'].includes(row.state))return {state:row.state};
    const result=await PaystackServerService.verifyTransaction(row.payload.reference);
    const matches=!result.isSimulated&&!result.isTestMode&&result.reference===row.payload.reference&&result.amountPesewas===row.amount_minor&&result.currency==='GHS'&&result.metadata?.purpose==='wallet_topup'&&result.metadata?.topup_id===row.id&&result.metadata?.user_id===row.user_id;
    if(matches&&['failed','abandoned'].includes(result.status))return FinanceStore.transaction(row.user_id,async tx=>{const current=(await tx.find(row.idempotency_key))!;if(['credited','reversed','reversal_review'].includes(current.state))return {state:current.state};await tx.update(current,'failed',{...current.payload,lastVerifiedAt:new Date().toISOString()});return {state:'failed'};});
    if(!result.isVerified||result.status!=='success')return {state:'verifying'};
    // Simulation never creates spendable Wallet money, even outside production.
    if(!matches)throw new FinanceError('Payment verification did not match the funding request.',409);
    return FinanceStore.transaction(row.user_id,async tx=>{
      const current=(await tx.find(row.idempotency_key))!;if(current.state==='credited')return {state:'credited'};
      if(!['initializing','pending','initialization_uncertain','failed'].includes(current.state))throw new FinanceError('Funding is closed.',409);
      await tx.append(current,'wallet',current.amount_minor,'Wallet Top-up');await tx.update(current,'credited',{...current.payload,verifiedAt:new Date().toISOString(),creditedAt:new Date().toISOString()});
      if(adminId)await tx.audit(adminId,'wallet_funding_reconciled',current.id,{amount_minor:current.amount_minor});return {state:'credited'};
    });
  }
  static async transfer(userId:string,input:Record<string,unknown>) {
    confirmation(input.confirmed);const amount=moneyMinor(input.amountMinor),key=`transfer:${operationKey(input.requestId)}`;
    return FinanceStore.transaction(userId,async tx=>{const old=await tx.find(key);if(old){sameAmount(old,amount);return old;}
      const earn=await tx.earn();if((await tx.account()).restricted||earn.reconciliationRequired||earn.availableMinor<amount)throw new FinanceError('Insufficient available earnings or reconciliation required.',409);
      const row=await tx.create('transfer',key,amount,{feeMinor:0,irreversible:true});await tx.append(row,'earn',-amount,'Transferred to Mystery Wallet');await tx.append(row,'wallet',amount,'Transferred from Mystery Earn');return row;});
  }
  static async requestWithdrawal(userId:string,input:Record<string,unknown>) {
    confirmation(input.confirmed);const source=input.source==='store'?'store':'earn';const amount=moneyMinor(input.amountMinor),key=`${source==='store'?'store-':''}withdrawal:${operationKey(input.requestId)}`;
    const phone=validateAndNormalizeGhanaPhone(input.phone as string);if(!phone.isValid)throw new FinanceError('Enter a valid Ghana Mobile Money number.');
    const network=input.network;if(!['mtn','telecel','airteltigo'].includes(network as string))throw new FinanceError('Select a valid Mobile Money network.');
    const recipient=text(input.recipientName,128);
    return FinanceStore.transaction(userId,async tx=>{const old=await tx.find(key);if(old){sameAmount(old,amount);if(old.payload.phone!==phone.normalized||old.payload.network!==network||old.payload.recipientName!==recipient)throw new FinanceError('Request details changed.',409);return maskWithdrawal(old);}
      const settings=source==='store'?{...FINANCE_DEFAULTS,...await tx.config('store-policy')}:await this.config(tx),earn=source==='store'?await tx.storeEarnings():await tx.earn();if(amount<settings.withdrawalMinimumMinor)throw new FinanceError(`Minimum withdrawal is GH₵${(settings.withdrawalMinimumMinor/100).toFixed(2)}.`);
      if((await tx.account()).restricted||earn.reconciliationRequired||earn.availableMinor<amount)throw new FinanceError('Insufficient available earnings or reconciliation required.',409);
      const fee=percentMinor(amount,settings.withdrawalFeeBps);if(fee>=amount)throw new FinanceError('Withdrawal has no payable amount.');
      const row=await tx.create('withdrawal',key,amount,{source,policyVersion:settings.version||'finance-settings',feeBps:settings.withdrawalFeeBps,feeMinor:fee,netMinor:amount-fee,phone:phone.normalized,network,recipientName:recipient},'pending_review');
      await tx.append(row,source==='store'?'store':'earn',-amount,'Reserved for withdrawal');return maskWithdrawal(row);});
  }
  static async withdrawalAction(adminId:string,id:string,input:Record<string,unknown>) {
    confirmation(input.confirmed);const found=await FinanceStore.ownerOf(id,'withdrawal');if(!found)throw new FinanceError('Withdrawal not found.',404);
    return FinanceStore.transaction(found.user_id,async tx=>{const row=(await tx.find(found.idempotency_key))!;
      if(input.expectedState!==row.state)throw new FinanceError('Withdrawal state changed. Refresh before acting.',409);
      const action=input.action;const bucket=row.payload.source==='store'?'store':'earn';const earnings=()=>bucket==='store'?tx.storeEarnings():tx.earn();
      if(action==='approve'&&row.state==='pending_review') {if((await tx.account()).restricted||(await earnings()).reconciliationRequired)throw new FinanceError('Earnings require reconciliation.',409);await tx.update(row,'approved');}
      else if(action==='reject'&&['pending_review','approved'].includes(row.state)) {
        const reason=text(input.reason);const release=await tx.create('reversal',`withdrawal-release:${row.id}`,row.amount_minor,{withdrawalId:row.id});await tx.append(release,bucket,row.amount_minor,'Withdrawal reservation released');await tx.update(row,'rejected',{...row.payload,rejectionReason:reason});
      } else if(action==='paid'&&row.state==='approved') {
        if((await tx.account()).restricted||(await earnings()).reconciliationRequired)throw new FinanceError('Earnings require reconciliation.',409);
        await tx.update(row,'paid',{...row.payload,paidAt:new Date().toISOString(),paidBy:adminId,payoutReference:text(input.reference,100)});
      } else throw new FinanceError('Invalid withdrawal transition.',409);
      await tx.audit(adminId,`withdrawal_${row.state}`,row.id,{requested_minor:row.amount_minor,fee_minor:row.payload.feeMinor,net_minor:row.payload.netMinor});return row;});
  }
  static async payOrder(order:OrderRecord,requestId:unknown,create?:(tx:FinanceTx,paid:OrderRecord)=>Promise<void>,prepare?:(tx:FinanceTx)=>Promise<OrderRecord>) {
    moneyMinor(order.amount);if(order.currency!=='GHS')throw new FinanceError('Invalid currency.');
    if(!order.user_id||!['data','airtime','afa'].includes(order.service_type||''))throw new FinanceError('Wallet is available for signed-in Data, Airtime and AFA purchases.');
    const key=`purchase:${operationKey(requestId)}`;
    const paid=await FinanceStore.transaction(order.user_id,async tx=>{
      const old=await tx.find(key);if(old){if(old.payload.productId!==order.product_id||old.payload.recipient!==order.recipient_phone||old.amount_minor!==order.amount||old.payload.service!==order.service_type)throw new FinanceError('Checkout request details changed.',409);return (await OrdersStore.findOrder(old.payload.orderId,tx.client))!;}
      if(prepare)order=await prepare(tx);
      const account=await tx.account();if(account.restricted||account.wallet_minor<order.amount)throw new FinanceError('Insufficient Wallet balance. Add Money or use Paystack.',409);
      const record={...order,payment_provider:'wallet' as const,payment_reference:`MH_WALLET_ORDER_${randomUUID()}`,status:'paid' as const,payment_status:'success' as const,paid_at:new Date().toISOString()};
      const row=await tx.create('purchase',key,order.amount,{orderId:order.id,productId:order.product_id,recipient:order.recipient_phone,service:order.service_type});
      // Debit and durable order are committed together; provider dispatch is strictly after commit.
      await tx.append(row,'wallet',-order.amount,order.service_type==='afa'?'AFA Registration':order.service_type==='airtime'?'Airtime Purchase':'Data Purchase');
      if(create)await create(tx,record);
      else {
        if(tx.client&&order.network==='mtn') {
          await tx.client.query("SELECT pg_advisory_xact_lock(hashtext('mtn_' || $1))",[canonicalGhanaPhone(order.recipient_phone)]);
          const active=await tx.client.query("SELECT id FROM orders WHERE network='mtn' AND recipient_phone=ANY($1::text[]) AND status IN ('paid','queued','submitted','processing','refund_pending') LIMIT 1",[getGhanaPhoneLookupVariants(order.recipient_phone)]);if(active.rows.length)throw new FinanceError('An MTN order is already active for this recipient.',409);
        }
        if(!tx.client&&order.network==='mtn'&&await OrdersStore.findActiveMtnOrder(order.recipient_phone))throw new FinanceError('An MTN order is already active for this recipient.',409);
        await OrdersStore.createOrder(record,tx.client);
      }
      return record;
    });
    return this.recoverPurchase(order.user_id,paid.id);
  }
  static async recoverPurchase(userId:string,orderId:string) {
    const paid=await OrdersStore.findOrder(orderId);
    if(!paid||paid.user_id!==userId||paid.payment_provider!=='wallet')throw new FinanceError('Wallet order not found.',404);
    // Only an unclaimed paid order can dispatch. Queued/uncertain supplier requests
    // retain their existing latch and reconciliation path; never blind-submit them.
    if(paid.status==='paid'&&paid.payment_status==='success') {
      try {await FulfilmentService.processPaidOrder(paid.payment_reference,paid.paid_at!,'Wallet payment committed');}catch { /* The durable paid/claimed state remains recoverable. */ }
    }
    return (await OrdersStore.findOrder(paid.id))||paid;
  }
  static async reconcileWalletOrders() {
    const orders=await OrdersStore.getWalletRecoveryOrders();
    for(const order of orders) {
      try {if(order.status==='paid')await this.recoverPurchase(order.user_id!,order.id);else await this.refund(order);}catch { /* Retain the durable record for the next reconciliation pass. */ }
    }
  }
  static async refund(order:OrderRecord,adminId?:string) {
    // Only an authoritative terminal refund, never timeout/refund_pending/queued.
    if(order.payment_provider!=='wallet'||!order.user_id||order.status!=='refunded'||order.manual_review)return;
    return FinanceStore.transaction(order.user_id,async tx=>{
      const purchase=(await tx.operations()).find(x=>x.kind==='purchase'&&x.payload.orderId===order.id);
      if(!purchase||purchase.amount_minor!==order.amount)throw new FinanceError('Wallet purchase ledger does not match the refund.',409);
      const key=`refund:${order.id}`;const old=await tx.find(key);if(old)return old;const row=await tx.create('refund',key,purchase.amount_minor,{orderId:order.id});await tx.append(row,'wallet',purchase.amount_minor,'Refund');
      if(adminId)await tx.audit(adminId,'wallet_refund_reconciled',row.id,{order_id:order.id,amount_minor:purchase.amount_minor});return row;});
  }
  static async reverseReward(record:import('../types/referral.js').RewardLedgerRecord,reason:string) {
    return FinanceStore.transaction(record.referrer_user_id,async tx=>{
      const key=`reward-reversal:${record.id}`,old=await tx.find(key);if(old)return null;
      const earn=await tx.earn();
      if(record.status==='approved'&&(earn.reconciliationRequired||earn.availableMinor<record.amount_minor)) {
        await tx.create('review',key,record.amount_minor,{rewardId:record.id,orderId:record.order_id,reason},'manual_review');await tx.restrict();return null;
      }
      const reversed=await ReferralStore.reverseLedgerEntry(record.id,reason,tx.client);
      await tx.create('reversal',key,record.amount_minor,{rewardId:record.id,orderId:record.order_id,reason});
      await tx.audit(record.referrer_user_id,'referral_reward_reversed',record.id,{amount_minor:record.amount_minor,order_id:record.order_id});return reversed;
    });
  }
  static async adjustment(adminId:string,userId:string,input:Record<string,unknown>) {
    confirmation(input.confirmed);const amount=moneyMinor(input.amountMinor),reason=text(input.reason),key=`adjustment:${operationKey(input.requestId)}`;
    if(input.direction!=='credit'&&input.direction!=='debit')throw new FinanceError('Choose Credit or Debit.');
    return FinanceStore.transaction(userId,async tx=>{const old=await tx.find(key);if(old){sameAmount(old,amount);if(old.payload.direction!==input.direction||old.payload.reason!==reason)throw new FinanceError('Adjustment details changed.',409);return old;}const row=await tx.create('adjustment',key,amount,{direction:input.direction,reason,adminId});await tx.append(row,'wallet',input.direction==='credit'?amount:-amount,'Wallet Adjustment');await tx.audit(adminId,`wallet_${input.direction}`,row.id,{amount_minor:amount,reason});return row;});
  }
  static async reconcileRewardReversal(adminId:string,id:string,input:Record<string,unknown>) {
    confirmation(input.confirmed);const reason=text(input.reason),found=await FinanceStore.ownerOf(id,'review');
    if(!found?.payload.rewardId)throw new FinanceError('Reward reconciliation not found.',404);
    return FinanceStore.transaction(found.user_id,async tx=>{
      const review=(await tx.find(found.idempotency_key))!;if(review.state==='resolved')return review;
      if(review.state!=='manual_review')throw new FinanceError('Invalid reconciliation state.',409);
      const earn=await tx.earn();if(earn.reconciliationRequired||earn.availableMinor<review.amount_minor)throw new FinanceError('Insufficient recovered Earn. Release unpaid reservations or recover funds before reconciliation.',409);
      const reward=await ReferralStore.findLedgerById(review.payload.rewardId,tx.client);
      if(!reward||reward.referrer_user_id!==found.user_id||reward.amount_minor!==review.amount_minor||reward.status!=='approved')throw new FinanceError('Reward history changed. Manual review is required.',409);
      await ReferralStore.reverseLedgerEntry(reward.id,reason,tx.client);
      await tx.create('reversal',`reward-reversal-settled:${reward.id}`,review.amount_minor,{rewardId:reward.id,reviewId:review.id,reason,adminId});
      await tx.update(review,'resolved',{...review.payload,resolutionReason:reason,resolvedBy:adminId,resolvedAt:new Date().toISOString()});
      if(!(await tx.operations()).some(x=>['manual_review','reversal_review'].includes(x.state)))await tx.clearRestriction();
      await tx.audit(adminId,'reward_reversal_reconciled',review.id,{reward_id:reward.id,amount_minor:review.amount_minor,reason});return review;
    });
  }
  static async reverseTopup(adminId:string,id:string,input:Record<string,unknown>) {
    confirmation(input.confirmed);const reason=text(input.reason);const found=await FinanceStore.ownerOf(id,'topup');if(!found)throw new FinanceError('Funding not found.',404);
    return FinanceStore.transaction(found.user_id,async tx=>{const row=(await tx.find(found.idempotency_key))!;if(row.state==='reversed')return row;if(!['credited','reversal_review'].includes(row.state))throw new FinanceError('Only credited funding can be reconciled.',409);
      const account=await tx.account();if(account.wallet_minor<row.amount_minor){await tx.restrict();await tx.update(row,'reversal_review');await tx.audit(adminId,'payment_reversal_review',id,{reason,amount_minor:row.amount_minor});return row;}
      // A restriction blocks purchases; an explicit reconciler may debit recovered funds.
      if(account.restricted){if(tx.client)await tx.client.query('UPDATE finance_accounts SET restricted=FALSE WHERE user_id=$1',[row.user_id]);else account.restricted=false;}
      const reversal=await tx.create('reversal',`topup-reversal:${row.id}`,row.amount_minor,{topupId:row.id,reason,adminId});await tx.append(reversal,'wallet',-row.amount_minor,'Payment reversal');await tx.update(row,'reversed');if((await tx.operations()).some(x=>['manual_review','reversal_review'].includes(x.state)))await tx.restrict();await tx.audit(adminId,'payment_reversed',id,{reason,amount_minor:row.amount_minor});return row;});
  }
  static async saveSettings(adminId:string,input:Record<string,unknown>) {
    confirmation(input.confirmed);
    const settings={withdrawalMinimumMinor:moneyMinor(input.withdrawalMinimumMinor),withdrawalFeeBps:Number(input.withdrawalFeeBps),topupMinimumMinor:moneyMinor(input.topupMinimumMinor),topupMaximumMinor:moneyMinor(input.topupMaximumMinor)};
    if(!Number.isInteger(settings.withdrawalFeeBps)||settings.withdrawalFeeBps<0||settings.withdrawalFeeBps>5000||settings.topupMinimumMinor>settings.topupMaximumMinor)throw new FinanceError('Invalid financial limits or fee.');
    return FinanceStore.transaction(adminId,async tx=>{await tx.saveConfig('settings',settings);await tx.audit(adminId,'finance_settings_changed','settings',settings);return settings;});
  }
  static async achievementDefinitions(tx:FinanceTx):Promise<any[]> {return await tx.config('achievements')||[
    {id:'first-referral',name:'First successful referral',metric:'successful_referrals',threshold:1,enabled:true,rewardMinor:0},
    {id:'qualified-visitors',name:'Ten qualified visitors',metric:'qualified_visitors',threshold:10,enabled:true,rewardMinor:0},
    {id:'afa-referral',name:'First successful AFA referral',metric:'afa_referrals',threshold:1,enabled:true,rewardMinor:0}
  ];}
  static async achievementProgress(tx:FinanceTx) {
    const ledger=tx.client?(await tx.client.query("SELECT order_id,service_type,amount_minor FROM reward_ledger WHERE referrer_user_id=$1 AND status='approved' AND reversal_of_id IS NULL",[tx.userId])).rows:ReferralStore.adminDevSnapshot().ledger.filter(x=>x.referrer_user_id===tx.userId&&x.status==='approved'&&!x.reversal_of_id);
    const values={successful_referrals:new Set(ledger.map(x=>x.order_id).filter(Boolean)).size,afa_referrals:ledger.filter(x=>x.service_type==='afa').length,qualified_visitors:await ReferralStore.countUniqueVisitorsByReferrer(tx.userId,tx.client),lifetime_earnings:ledger.reduce((s,x)=>s+Number(x.amount_minor),0)};
    const operations=await tx.operations();return (await this.achievementDefinitions(tx)).filter(x=>x.enabled).map(def=>({...def,progress:values[def.metric as keyof typeof values]||0,claimed:operations.some(x=>x.idempotency_key===`achievement:${def.id}`)}));
  }
  static async claimAchievement(userId:string,id:string) {
    return FinanceStore.transaction(userId,async tx=>{const key=`achievement:${id}`,old=await tx.find(key);if(old)return old;
      // Existing claims remain replayable; new claims honor the financial account restriction under the owner lock.
      if((await tx.account()).restricted)throw new FinanceError('Account needs reconciliation.',409);
      const def=(await this.achievementProgress(tx)).find(x=>x.id===id);if(!def||def.progress<def.threshold)throw new FinanceError('Achievement is not unlocked.',409);const row=await tx.create('achievement',key,def.rewardMinor,{definition:{...def},rewardMinor:def.rewardMinor});if(def.rewardMinor>0)await tx.append(row,'wallet',def.rewardMinor,'Achievement Reward');return row;});
  }
  static async saveAchievements(adminId:string,input:Record<string,unknown>) {
    confirmation(input.confirmed);if(!Array.isArray(input.definitions)||input.definitions.length>20)throw new FinanceError('Invalid achievement definitions.');
    const definitions=input.definitions.map((d:any)=>{if(!/^[-a-z0-9]{1,50}$/.test(d.id)||typeof d.enabled!=='boolean'||!['successful_referrals','qualified_visitors','afa_referrals','lifetime_earnings'].includes(d.metric))throw new FinanceError('Invalid achievement.');return {id:d.id,name:text(d.name,100),metric:d.metric,threshold:moneyMinor(d.threshold),enabled:d.enabled,rewardMinor:moneyMinor(d.rewardMinor,true)};});
    if(new Set(definitions.map(x=>x.id)).size!==definitions.length)throw new FinanceError('Duplicate achievement ID.');
    return FinanceStore.transaction(adminId,async tx=>{await tx.saveConfig('achievements',definitions);await tx.audit(adminId,'achievement_config_changed','achievements',{definitions});return definitions;});
  }
}
