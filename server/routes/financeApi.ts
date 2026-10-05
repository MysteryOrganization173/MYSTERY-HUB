import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { FinanceService } from '../services/financeService.js';
import { FinanceStore, FinanceError } from '../db/financeStore.js';
import { ALLOWED_ORIGINS } from '../middleware/cors.js';
import { saveEconomicsPolicy } from '../services/referralEconomics.js';
import { economicsPolicy } from '../services/referralEconomics.js';
import { ReferralStore } from '../db/referralStore.js';
import { OrdersStore } from '../db/ordersStore.js';
import { MoneyValidationError } from '../../shared/money.js';

const handler=(fn:(req:any)=>Promise<unknown>)=>async(req:any,res:any)=>{
  res.setHeader('Cache-Control','no-store');
  try {res.json(await fn(req));} catch(error){res.status(error instanceof FinanceError?error.status:error instanceof MoneyValidationError?400:503).json({error:error instanceof FinanceError||error instanceof MoneyValidationError?error.message:'Financial service unavailable. Reconcile the request before retrying.'});}
};
const sensitive=createRateLimiter({windowMs:60_000,max:10});
export const financeRouter=Router();
financeRouter.use(requireAuth);
financeRouter.get('/',handler(req=>FinanceService.summary(req.user.id,Math.min(100000,Math.max(0,Number(req.query.offset)||0)))));
financeRouter.post('/topups',sensitive,handler(req=>{
  const origin=(process.env.APP_URL||process.env.FRONTEND_URL||'').replace(/\/$/,'');
  if(!/^https:\/\/[^\s]+$/.test(origin)||!ALLOWED_ORIGINS.includes(origin))throw new FinanceError('Wallet callback origin is not configured.',503);
  return FinanceService.initializeTopup(req.user,req.body,origin);
}));
financeRouter.post('/topups/:reference/verify',sensitive,handler(req=>FinanceService.verifyTopup(req.params.reference,req.user.id)));
financeRouter.post('/transfer',sensitive,handler(req=>FinanceService.transfer(req.user.id,req.body)));
financeRouter.post('/withdrawals',sensitive,handler(req=>FinanceService.requestWithdrawal(req.user.id,req.body)));
financeRouter.post('/achievements/:id/claim',sensitive,handler(req=>FinanceService.claimAchievement(req.user.id,req.params.id)));

export const adminFinanceRouter=Router();
adminFinanceRouter.use(requireAdmin);
adminFinanceRouter.get('/control',handler(async req=>({metrics:await FinanceStore.metrics(),...(await FinanceStore.transaction(req.user.id,async tx=>({settings:await FinanceService.config(tx),definitions:await FinanceService.achievementDefinitions(tx)}))),economics:await Promise.all(['data','airtime','afa'].map(async service=>({service,...await economicsPolicy(service)})))})));
adminFinanceRouter.get('/operations',handler(req=>FinanceStore.adminOperations(typeof req.query.kind==='string'?req.query.kind:undefined,50,Math.max(0,Math.min(100000,Number(req.query.offset)||0)))));
adminFinanceRouter.get('/customers/:id',handler(async req=>({...await FinanceService.summary(req.params.id,Math.max(0,Math.min(100000,Number(req.query.offset)||0))),earnLedger:await ReferralStore.getLedgerForUser(req.params.id)})));
adminFinanceRouter.post('/orders/:id/refund',sensitive,handler(async req=>{
  if(req.body.confirmed!==true)throw new FinanceError('Confirm the refund.');
  const order=await OrdersStore.findOrder(req.params.id);if(!order||order.status!=='refunded'||order.payment_provider!=='wallet'||order.manual_review)throw new FinanceError('A definitive, reconciled Wallet refund is required.',409);
  return FinanceService.refund(order,req.user.id);
}));
adminFinanceRouter.get('/withdrawals',handler(async req=>{
  const requests=await FinanceStore.adminOperations('withdrawal',50,Math.max(0,Math.min(100000,Number(req.query.offset)||0)));
  return Promise.all(requests.map(async row=>{const summary=await FinanceService.summary(row.user_id);return {...row,earn:summary.earn,restricted:summary.restricted,priorWithdrawals:(await FinanceStore.transaction(row.user_id,tx=>tx.operations())).filter(x=>x.kind==='withdrawal'&&x.id!==row.id).length};}));
}));
adminFinanceRouter.post('/withdrawals/:id',sensitive,handler(req=>FinanceService.withdrawalAction(req.user.id,req.params.id,req.body)));
adminFinanceRouter.post('/customers/:id/adjustment',sensitive,handler(req=>FinanceService.adjustment(req.user.id,req.params.id,req.body)));
adminFinanceRouter.post('/topups/:id/reversal',sensitive,handler(req=>FinanceService.reverseTopup(req.user.id,req.params.id,req.body)));
adminFinanceRouter.post('/reviews/:id/reconcile',sensitive,handler(req=>FinanceService.reconcileRewardReversal(req.user.id,req.params.id,req.body)));
adminFinanceRouter.post('/topups/:id/verify',sensitive,handler(async req=>{
  if(req.body.confirmed!==true)throw new FinanceError('Confirm funding reconciliation.');
  const row=await FinanceStore.ownerOf(req.params.id,'topup');if(!row)throw new FinanceError('Funding not found.',404);
  return FinanceService.verifyTopup(row.payload.reference,undefined,req.user.id);
}));
adminFinanceRouter.post('/settings',sensitive,handler(req=>FinanceService.saveSettings(req.user.id,req.body)));
adminFinanceRouter.post('/achievements',sensitive,handler(req=>FinanceService.saveAchievements(req.user.id,req.body)));
adminFinanceRouter.post('/reward-economics',sensitive,handler(req=>saveEconomicsPolicy(req.user.id,req.body)));
