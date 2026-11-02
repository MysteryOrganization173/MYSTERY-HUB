import {Router} from 'express';
import {createRateLimiter} from '../middleware/rateLimiter.js';
import {FinanceError} from '../db/financeStore.js';
import {FinanceReconciliationStore} from '../db/financeReconciliationStore.js';
export const financeReconciliationRouter=Router();
// Mounted only below adminFinanceRouter's existing requireAdmin guard.
financeReconciliationRouter.get('/',createRateLimiter({windowMs:60_000,max:30}),async(req,res)=>{
 try{res.json(await FinanceReconciliationStore.report(req.query));}
 catch(e){res.status(e instanceof FinanceError?e.status:503).json({error:e instanceof FinanceError?e.message:'Reconciliation reporting is unavailable. Existing records were not changed.'});}
});
