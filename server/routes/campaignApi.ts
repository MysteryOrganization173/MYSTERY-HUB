import {Router,type RequestHandler} from 'express';
import {optionalAuth,requireAdmin} from '../middleware/authMiddleware.js';
import {createRateLimiter} from '../middleware/rateLimiter.js';
import {CampaignStore,campaignRequestEligible} from '../db/campaignStore.js';
import {campaignReport} from '../db/campaignReport.js';
import {CampaignError} from '../../shared/campaigns.js';
export const campaignPublicRouter=Router(),campaignAdminRouter=Router(),campaignShortRouter=Router();
const noCache:RequestHandler=(_req,res,next)=>{res.set({'Cache-Control':'no-store, private','Referrer-Policy':'same-origin','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'});next();};
const handler=(work:(req:any)=>Promise<any>):RequestHandler=>async(req,res)=>{try{res.json({success:true,data:await work(req)});}catch(e){res.status(e instanceof CampaignError?e.status:503).json({error:e instanceof CampaignError?e.message:'Campaign service unavailable. Please retry shortly.'});}};
const publicLimit=createRateLimiter({windowMs:60_000,max:600,enforceInTests:true,key:req=>req.socket.remoteAddress||'unknown'});
let observing=0,reporting=0;
const resolve=async(req:any)=>CampaignStore.resolve(req.params.code,campaignRequestEligible(req.method,req.get('user-agent')||'',req.get('dnt')==='1'||req.get('sec-gpc')==='1'?'1':undefined,req.get('purpose')||req.get('sec-purpose')||''));
campaignShortRouter.get('/c/:code',noCache,publicLimit,async(req,res)=>{try{const result=await resolve(req);if(result.active){res.redirect(302,result.destination);return;}res.status(410).type('html').send(`<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Campaign unavailable</title><body><h1>This campaign is not active</h1><p>You can still visit the destination without campaign tracking.</p><a href="${result.destination.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}">Continue to the website</a></body></html>`);}catch(e){res.status(e instanceof CampaignError?e.status:503).type('html').send('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link unavailable</title><body><h1>This link is unavailable</h1><a href="/">Visit Mystery Hub</a></body></html>');}});
campaignPublicRouter.get('/resolve/:code',noCache,publicLimit,handler(resolve));
campaignPublicRouter.post('/events',noCache,publicLimit,optionalAuth,async(req,res)=>{
 if(req.headers.authorization&&!req.user){res.status(401).json({error:'Invalid session.'});return;}
 if(req.user?.role==='admin'||!campaignRequestEligible('GET',req.get('user-agent')||'',req.get('dnt')==='1'||req.get('sec-gpc')==='1'?'1':undefined)){res.status(202).json({accepted:false});return;}
 if(observing>=2){res.status(429).json({accepted:false});return;}observing++;
 try{res.status(202).json(await CampaignStore.observe(req.body,req.user?.id));}catch(e){res.status(e instanceof CampaignError?e.status:503).json({error:e instanceof CampaignError?e.message:'Campaign observation unavailable.'});}finally{observing--;}
});
campaignAdminRouter.use(noCache,requireAdmin,createRateLimiter({windowMs:60_000,max:60,key:req=>req.user!.id}));
campaignAdminRouter.get('/',handler(async req=>{if(Object.keys(req.query).some(k=>k!=='offset'))throw new CampaignError('Invalid registry filters.');return CampaignStore.list(Number(req.query.offset||0));}));
campaignAdminRouter.get('/report',createRateLimiter({windowMs:60_000,max:12,key:req=>req.user!.id}),handler(async req=>{if(reporting)throw new CampaignError('A campaign report is already loading. Retry shortly.',429);reporting++;try{return await campaignReport(req.query);}finally{reporting--;}}));
campaignAdminRouter.post('/',handler(req=>CampaignStore.create(req.user.id,req.body)));
campaignAdminRouter.get('/:id',handler(req=>CampaignStore.detail(req.params.id)));
campaignAdminRouter.patch('/:id',handler(req=>CampaignStore.update(req.user.id,req.params.id,req.body)));
campaignAdminRouter.post('/:id/links',handler(req=>CampaignStore.link(req.user.id,req.params.id,req.body)));
campaignAdminRouter.post('/:id/spend',handler(req=>CampaignStore.spend(req.user.id,req.params.id,req.body)));
