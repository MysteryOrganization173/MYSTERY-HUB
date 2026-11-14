import {Router} from 'express';
import {requireAdmin} from '../middleware/authMiddleware.js';
import {createRateLimiter} from '../middleware/rateLimiter.js';
import {ContactHubService} from '../services/contactHubService.js';
import {FinanceError} from '../db/financeStore.js';
export const contactHubRouter=Router();
contactHubRouter.use(requireAdmin,(_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');res.setHeader('Pragma','no-cache');res.setHeader('X-Content-Type-Options','nosniff');next();});
const readLimit=createRateLimiter({windowMs:60_000,max:45,key:req=>req.user!.id});
const exportLimit=createRateLimiter({windowMs:60_000,max:5,key:req=>req.user!.id,enforceInTests:true});
const handle=(fn:(req:any,res:any)=>Promise<void>)=>async(req:any,res:any)=>{try{await fn(req,res);}catch(e){res.status(e instanceof FinanceError?e.status:503).json({error:e instanceof FinanceError?e.message:'Contact evidence is unavailable. No export was produced. Try again later.'});}};
// POST reads keep private search terms and guest phone identifiers out of request URLs.
contactHubRouter.post('/query',readLimit,handle(async(req,res)=>{res.json(await ContactHubService.list(req.body));}));
contactHubRouter.post('/profile',readLimit,handle(async(req,res)=>{res.json(await ContactHubService.profile(req.body));}));
contactHubRouter.post('/preview',readLimit,handle(async(req,res)=>{res.json(await ContactHubService.preview(req.body));}));
contactHubRouter.post('/export',exportLimit,handle(async(req,res)=>{const result=await ContactHubService.export(req.user.id,req.body);res.setHeader('Content-Type',result.format==='csv'?'text/csv; charset=utf-8':'text/plain; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="mystery-contacts-${result.source}.${result.format==='csv'?'csv':'txt'}"`);res.send(result.content);}));
