import { randomUUID } from 'node:crypto';
import { AdminReadFailure } from '../services/adminCommercialRead.js';
import { Router } from 'express';
import { optionalAuth,requireAdmin } from '../middleware/authMiddleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { CommercialService } from '../services/commercialService.js';
import { FinanceError } from '../db/financeStore.js';
import { MoneyValidationError } from '../../shared/money.js';
const handle=(fn:(req:any)=>Promise<unknown>)=>async(req:any,res:any)=>{
  res.setHeader('Cache-Control','no-store');
  try{res.json(await fn(req));}catch(e){res.status(e instanceof FinanceError?e.status:e instanceof MoneyValidationError?400:503).json({error:e instanceof FinanceError||e instanceof MoneyValidationError?e.message:'Commercial service unavailable.'});}
};
export const commercialRouter=Router();
commercialRouter.get('/products',handle(()=>CommercialService.catalog()));
commercialRouter.get('/quote/:productId',optionalAuth,handle(async req=>{
  const {buyerPhone,...safe}=await CommercialService.quote(req.params.productId,req.user?.id);return safe;
}));
export const adminCommercialRouter=Router();
adminCommercialRouter.use(requireAdmin);
adminCommercialRouter.get('/',async(req,res)=>{
  const requestId=randomUUID();res.setHeader('Cache-Control','no-store');res.setHeader('X-Request-ID',requestId);
  try{const result=await CommercialService.admin();if(result.dependencyStatus.supplierCosts==='unavailable')console.warn(JSON.stringify({operation:'admin_commercial_read',requestId,dependency:'supplier_costs',reason:'unavailable',transient:true}));res.json(result);}
  catch(error){const failure=error instanceof AdminReadFailure?error:null;console.warn(JSON.stringify({operation:'admin_commercial_read',requestId,dependency:failure?.dependency??'response',reason:failure?.reason??'unavailable',transient:failure?.reason!=='invalid'}));res.status(503).json({error:'Commercial service unavailable.',requestId});}
});
adminCommercialRouter.post('/',createRateLimiter({windowMs:60_000,max:10}),handle(req=>CommercialService.save(req.user.id,req.body)));
