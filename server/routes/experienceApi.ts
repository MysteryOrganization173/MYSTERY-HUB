import {Router,json as jsonBody,type Request,type Response,type RequestHandler,type ErrorRequestHandler} from 'express';
import {requireAdmin} from '../middleware/authMiddleware.js';
import {createRateLimiter} from '../middleware/rateLimiter.js';
import {campaignRequestEligible} from '../db/campaignStore.js';
import {ExperienceStore,abuseIdentity} from '../db/experienceStore.js';
import {ExperienceService,greetingCreationEnabled,greetingLinksEnabled} from '../services/experienceService.js';
import {ExperienceError,objectInput} from '../services/experienceValidation.js';
import {countdownState} from '../../shared/mysteryExperiences.js';
const peer=(req:Request)=>req.socket.remoteAddress||'unknown';
const eligible=(req:Request)=>campaignRequestEligible('GET',req.get('user-agent')||'',req.get('dnt')==='1'||req.get('sec-gpc')==='1'?'1':undefined,req.get('purpose')||req.get('sec-purpose')||'');
const handle=(work:(req:Request,res:Response)=>Promise<unknown>|unknown):RequestHandler=>async(req,res)=>{
 try{res.json(await work(req,res));}catch(e){const status=e instanceof ExperienceError?e.status:503;if(status===429||status===503)res.set('Retry-After',status===429?'60':'30');res.status(status).json({error:{code:e instanceof ExperienceError?e.code:'EXPERIENCE_UNAVAILABLE'}});}
};
export const experienceRouter=Router(),adminExperienceRouter=Router();
const privateResponse:RequestHandler=(_req,res,next)=>{res.set('Cache-Control','no-store, private').set('X-Robots-Tag','noindex, nofollow').set('X-Content-Type-Options','nosniff');next();};
const bodyError:ErrorRequestHandler=(err,_req,res,_next)=>{res.status(err?.type==='entity.too.large'?413:400).json({error:{code:err?.type==='entity.too.large'?'BODY_TOO_LARGE':'INVALID_JSON'}});};
experienceRouter.use(privateResponse,createRateLimiter({windowMs:60000,max:240,key:peer,enforceInTests:true}),jsonBody({limit:'8kb'}),bodyError);
experienceRouter.get('/state',handle(()=>ExperienceService.state()));
experienceRouter.get('/countdown',handle(()=>countdownState()));
experienceRouter.get('/templates',handle(req=>{
 if(Object.keys(req.query).some(k=>!['occasion','random'].includes(k))||req.query.random!==undefined&&(typeof req.query.random!=='string'||!['true','false'].includes(req.query.random)))throw new ExperienceError('INVALID_QUERY');
 return ExperienceService.templates(req.query.occasion,req.query.random==='true');
}));
experienceRouter.post('/greetings',createRateLimiter({windowMs:60000,max:15,key:peer,enforceInTests:true}),handle(async(req,res)=>{if(!greetingCreationEnabled())throw new ExperienceError('CREATION_DISABLED',503);const result=await ExperienceService.create(req.body,abuseIdentity(peer(req)),eligible(req));res.status(result.duplicate?200:201);return result;}));
experienceRouter.get('/greetings/:shareId',handle(req=>ExperienceService.greeting(req.params.shareId)));
experienceRouter.post('/greetings/:shareId/revoke',handle(req=>{
 const token=(req.get('authorization')||'').match(/^Greeting ([A-Za-z0-9_-]{43})$/)?.[1];if(!token)throw new ExperienceError('GREETING_UNAVAILABLE',404);
 return ExperienceStore.revoke(req.params.shareId,token,abuseIdentity(peer(req)));
}));
experienceRouter.post('/greetings/:shareId/report',handle(req=>{
 if(!greetingLinksEnabled())throw new ExperienceError('GREETING_UNAVAILABLE',404);
 const body=objectInput(req.body,['reason']);return ExperienceStore.report(req.params.shareId,abuseIdentity(peer(req)),body.reason);
}));
experienceRouter.post('/events',handle(req=>{
 if(!greetingLinksEnabled())throw new ExperienceError('EXPERIENCE_UNAVAILABLE',503);
 if(!eligible(req))return {accepted:false};
 const v=objectInput(req.body,['event','shareId','visitorId','sessionId']);return ExperienceStore.event(v.event,v.shareId,v.visitorId,v.sessionId,abuseIdentity(peer(req)));
}));
adminExperienceRouter.use(privateResponse,createRateLimiter({windowMs:60000,max:60,key:peer}),jsonBody({limit:'8kb'}),bodyError,requireAdmin,createRateLimiter({windowMs:60000,max:30,key:req=>req.user!.id}));
adminExperienceRouter.get('/',handle(()=>ExperienceService.admin()));
adminExperienceRouter.put('/configuration',handle(req=>ExperienceStore.configure(req.user!.id,req.body)));
adminExperienceRouter.post('/preview',handle(req=>ExperienceService.preview(req.body)));
adminExperienceRouter.get('/reports',handle(()=>ExperienceStore.reports()));
adminExperienceRouter.post('/greetings/:shareId/revoke',handle(req=>{
 const v=objectInput(req.body,['confirmed']);if(v.confirmed!==true)throw new ExperienceError('CONFIRM_REQUIRED');return ExperienceStore.moderate(req.user!.id,req.params.shareId);
}));
adminExperienceRouter.get('/metrics',handle(req=>{if(Object.keys(req.query).some(k=>k!=='days')||req.query.days!==undefined&&!['7','30','90'].includes(String(req.query.days)))throw new ExperienceError('INVALID_RANGE');return ExperienceStore.metrics(Number(req.query.days||30));}));
adminExperienceRouter.post('/maintenance',handle(req=>{const v=objectInput(req.body,['confirmed']);if(v.confirmed!==true)throw new ExperienceError('CONFIRM_REQUIRED');return ExperienceStore.maintenance(req.user!.id);}));
