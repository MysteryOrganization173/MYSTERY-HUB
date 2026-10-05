import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth, requireAdmin, optionalAuth } from '../middleware/authMiddleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { WebsiteAssetStore } from '../db/websiteAssetStore.js';
import { WebsiteStore } from '../db/websiteStore.js';
import { WebsiteAnalyticsStore } from '../db/websiteAnalyticsStore.js';
import { WebsiteOperationError, cloudinaryConfigured, websiteMediaLimits } from '../services/websiteCloudinary.js';
import { WebsiteInputError } from '../services/websiteValidation.js';
const limit = (max: number) => createRateLimiter({ windowMs: 60_000, max, key: req => req.user?.id || req.ip || 'unknown' });
const editing = limit(30), media = limit(60), analytics = limit(60);
export function websiteFreeHandler(action: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, _next?: NextFunction) => {
    try { await action(req,res); }
    catch(error) {
      if(error instanceof WebsiteOperationError || error instanceof WebsiteInputError) { res.status(error instanceof WebsiteOperationError ? error.status : 400).json({error:error.message}); return; }
      console.error('[Website Free] Operation failed');
      res.status(503).json({error:'Website services are temporarily unavailable. Please retry.'});
    }
  };
}
export const websiteMediaRouter=Router({mergeParams:true});
websiteMediaRouter.use(requireAuth);
websiteMediaRouter.get('/',websiteFreeHandler(async(req,res)=>{
  const assets=await WebsiteAssetStore.list(req.params.siteId,req.user!.id);
  res.json({success:true,assets,configured:cloudinaryConfigured(),limits:websiteMediaLimits()});
}));
websiteMediaRouter.post('/upload-intent',media,websiteFreeHandler(async(req,res)=>{
  const intent=await WebsiteAssetStore.reserve(req.params.siteId,req.user!.id,req.body);
  res.status(201).json({success:true,intent});
}));
websiteMediaRouter.post('/:assetId/finalize',media,websiteFreeHandler(async(req,res)=>{
  // No caller URL, public ID or metadata is accepted. Asset ID resolves the trusted intent.
  if(req.body && Object.keys(req.body).length) throw new WebsiteOperationError('Finalization does not accept image metadata.');
  const asset=await WebsiteAssetStore.finalize(req.params.siteId,req.user!.id,req.params.assetId);
  res.json({success:true,asset});
}));
websiteMediaRouter.delete('/:assetId',editing,websiteFreeHandler(async(req,res)=>{
  const cleaned=await WebsiteAssetStore.delete(req.params.siteId,req.user!.id,req.params.assetId);
  res.json({success:true,cleanupPending:!cleaned});
}));
export const websiteActionsRouter=Router();
websiteActionsRouter.post('/analytics',analytics,optionalAuth,websiteFreeHandler(async(req,res)=>{
  if(req.headers.authorization && !req.user) throw new WebsiteOperationError('Invalid session.',401);
  await WebsiteAnalyticsStore.ingest(req.body,req.user?.id);
  res.status(202).json({success:true});
}));
websiteActionsRouter.post('/:id/change-template',requireAuth,editing,websiteFreeHandler(async(req,res)=>{
  const body=req.body || {};
  if(Object.keys(body).some(key=>!['targetTemplateId','confirmed','expectedUpdatedAt'].includes(key)) || body.confirmed!==true || typeof body.targetTemplateId!=='string' || typeof body.expectedUpdatedAt!=='string') throw new WebsiteOperationError('Confirm the template change after reviewing the preview.');
  const site=await WebsiteStore.changeTemplate(req.params.id,req.user!.id,body.targetTemplateId,body.expectedUpdatedAt);
  await WebsiteAnalyticsStore.action('website_template_changed',req.user!.id,site.id,site.template_id);
  res.json({success:true,site});
}));
export const adminWebsiteRouter=Router();
adminWebsiteRouter.use(requireAdmin);
adminWebsiteRouter.get('/',websiteFreeHandler(async(req,res)=>{res.json({success:true,...await WebsiteAnalyticsStore.summary(req.query)});}));
adminWebsiteRouter.get('/:id',websiteFreeHandler(async(req,res)=>{
  const site=await WebsiteStore.findSiteById(req.params.id);
  if(!site) throw new WebsiteOperationError('Website not found.',404);
  // Safe operational projection; no account/security/provider credentials or arbitrary content.
  res.json({success:true,site:await WebsiteAnalyticsStore.siteDetails(site)});
}));
adminWebsiteRouter.post('/:id/force-unpublish',editing,websiteFreeHandler(async(req,res)=>{
  if(Object.keys(req.body || {}).some(key=>key!=='confirmation') || typeof req.body?.confirmation!=='string') throw new WebsiteOperationError('Confirmation required.');
  const site=await WebsiteStore.forceUnpublish(req.params.id,req.user!.id,req.body.confirmation);
  if(site) await WebsiteAnalyticsStore.action('website_unpublished',req.user!.id,site.id,site.template_id);
  res.json({success:true,siteId:site?.id,status:site?.status});
}));
adminWebsiteRouter.post('/media/cleanup',limit(2),websiteFreeHandler(async(_req,res)=>{
  res.json({success:true,...await WebsiteAssetStore.cleanupCandidates()});
}));
