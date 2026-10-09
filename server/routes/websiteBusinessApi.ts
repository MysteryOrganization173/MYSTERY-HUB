import { Router } from 'express';
import { requireAuth, optionalAuth, requireAdmin } from '../middleware/authMiddleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { FinanceError } from '../db/financeStore.js';
import { MoneyValidationError } from '../../shared/money.js';
import { WebsiteOperationError } from '../services/websiteCloudinary.js';
import { WebsiteBusinessService as Business } from '../services/websiteBusinessService.js';
import { WebsiteAnalyticsStore } from '../db/websiteAnalyticsStore.js';
import { WebsiteStore } from '../db/websiteStore.js';
const limit=(max:number)=>createRateLimiter({windowMs:60_000,max,key:req=>req.user?.id||req.ip||'unknown'});
const sensitive=limit(10),publicWrite=limit(30);
const handler=(work:(req:any)=>Promise<unknown>)=>async(req:any,res:any)=>{
  res.set('Cache-Control','no-store');
  try{res.json({success:true,data:await work(req)});}catch(e){if(e instanceof FinanceError||e instanceof WebsiteOperationError||e instanceof MoneyValidationError){res.status(e instanceof MoneyValidationError?400:e.status).json({error:e.message,...((e as any).existingOrderReference?{existingOrderReference:(e as any).existingOrderReference}:{})});return;}console.error('[Website business] Operation unavailable');res.status(503).json({error:'Business services are temporarily unavailable.'});}
};
const offset=(req:any)=>Math.max(0,Math.min(100000,Number(req.query.offset)||0));
export const websiteBusinessRouter=Router();
websiteBusinessRouter.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
websiteBusinessRouter.get('/:id/business',requireAuth,handler(async req=>({...await Business.ownerSummary(req.params.id,req.user.id,offset(req)),analytics:await WebsiteAnalyticsStore.ownerAnalytics(req.params.id,req.user.id,String(req.query.range||'30'))})));
websiteBusinessRouter.get('/:id/bundles',requireAuth,handler(req=>Business.catalog(req.params.id,req.user.id)));
websiteBusinessRouter.put('/:id/bundles',requireAuth,sensitive,handler(req=>Business.savePrices(req.params.id,req.user.id,req.body)));
websiteBusinessRouter.post('/:id/store-withdrawals',requireAuth,sensitive,handler(req=>Business.withdraw(req.params.id,req.user.id,req.body)));
websiteBusinessRouter.get('/:id/store-orders/:reference',publicWrite,handler(req=>Business.publicOrder(req.params.id,req.params.reference)));
websiteBusinessRouter.get('/:id/storefront',handler(req=>Business.catalog(req.params.id)));
websiteBusinessRouter.post('/:id/store-checkout',optionalAuth,publicWrite,handler(req=>{
  if(req.headers.authorization&&!req.user)throw new FinanceError('Invalid session.',401);
  return Business.initialize(req.params.id,req.body,req.user?.id);
}));
websiteBusinessRouter.post('/:id/public-events',publicWrite,handler(async req=>{await WebsiteAnalyticsStore.ingestPublic(req.params.id,req.body);return {accepted:true};}));
export const adminWebsiteBusinessRouter=Router();
adminWebsiteBusinessRouter.use(requireAdmin);
adminWebsiteBusinessRouter.get('/reseller-config',handler(()=>Business.adminConfig()));
adminWebsiteBusinessRouter.put('/reseller-policy',sensitive,handler(req=>Business.savePolicy(req.user.id,req.body)));
adminWebsiteBusinessRouter.put('/reseller-wholesale',sensitive,handler(req=>Business.saveWholesale(req.user.id,req.body)));
adminWebsiteBusinessRouter.post('/store-orders/:id/reconcile',sensitive,handler(req=>Business.reconcileReversal(req.user.id,req.params.id,req.body)));
adminWebsiteBusinessRouter.get('/:id/business',handler(async req=>{
  const site=await WebsiteStore.findSiteById(req.params.id);if(!site)throw new FinanceError('Website not found.',404);
  return {...await Business.ownerSummary(site.id,site.user_id,offset(req)),analytics:await WebsiteAnalyticsStore.ownerAnalytics(site.id,site.user_id,String(req.query.range||'30'))};
}));
