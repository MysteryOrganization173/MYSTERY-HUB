import {Router} from 'express';
import {optionalAuth,requireAdmin} from '../middleware/authMiddleware.js';
import {createRateLimiter} from '../middleware/rateLimiter.js';
import {GrowthAnalyticsStore} from '../db/growthAnalyticsStore.js';
import {GrowthError} from '../services/growthValidation.js';
export const growthAnalyticsRouter=Router(),adminGrowthAnalyticsRouter=Router();
let active=0;
growthAnalyticsRouter.post('/events',createRateLimiter({windowMs:60000,max:360,enforceInTests:true,key:req=>req.socket.remoteAddress||'unknown'}),optionalAuth,async(req,res)=>{
 res.set('Cache-Control','no-store');
 if(req.headers.authorization&&!req.user){res.status(401).json({error:'Invalid session.'});return;}
 if(req.user?.role==='admin'||/bot|crawler|spider/i.test(req.get('user-agent')||'')){res.status(202).json({accepted:false});return;}
 if(active>=2){res.status(429).json({error:'Analytics busy.'});return;}active++;
 try{res.status(202).json(await GrowthAnalyticsStore.ingest(req.body,req.user?.id));}
 catch(e){res.status(e instanceof GrowthError?e.status:503).json({error:e instanceof GrowthError?e.message:'Analytics temporarily unavailable.'});}finally{active--;}
});
adminGrowthAnalyticsRouter.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();},requireAdmin,createRateLimiter({windowMs:60000,max:12,key:req=>req.user!.id}));
adminGrowthAnalyticsRouter.get('/',async(req,res)=>{
 try{if(Object.keys(req.query).some(k=>k!=='range'))throw new GrowthError('Invalid report filters.');res.json({success:true,report:await GrowthAnalyticsStore.summary(req.query.range)});}
 catch(e){res.status(e instanceof GrowthError?e.status:e instanceof Error&&e.message.startsWith('Choose ')?400:503).json({error:e instanceof GrowthError?e.message:'Analytics report unavailable. Retry shortly.'});}
});
