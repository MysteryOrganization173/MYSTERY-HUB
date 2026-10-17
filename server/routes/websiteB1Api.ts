import {Router} from 'express';
import {requireAuth} from '../middleware/authMiddleware.js';
import {createRateLimiter} from '../middleware/rateLimiter.js';
import {WebsiteStore} from '../db/websiteStore.js';
import {WebsiteAssetStore} from '../db/websiteAssetStore.js';
import {WebsiteCheckpointStore,WEBSITE_CHECKPOINT_LIMIT} from '../db/websiteCheckpointStore.js';
import {withWebsiteLock} from '../db/websiteTransaction.js';
import {websiteStarter} from '../../src/config/websiteStarters.js';
import {websiteExampleReview,websiteLayoutMode} from '../../src/utils/websiteLayout.js';
import {migrateWebsiteTemplate,websiteMigrationSummary} from '../../src/utils/websiteTemplateMigration.js';
import {isValidTemplateId} from '../types/website.js';
import {WebsiteOperationError} from '../services/websiteCloudinary.js';
import {websiteFreeHandler} from './websiteFreeApi.js';
export const websiteB1Router=Router();
const limit=createRateLimiter({windowMs:60000,max:30,key:req=>req.user?.id||req.ip||'unknown'});
websiteB1Router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
function body(req:any,allowed:string[]){
  const value=req.body;
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k))||value.confirmed!==true||typeof value.expectedUpdatedAt!=='string'||!value.expectedUpdatedAt||value.expectedUpdatedAt.length>40)throw new WebsiteOperationError('Confirm this action against the current saved draft.');
  return value;
}
const metadata=(c:any)=>({id:c.id,templateId:c.template_id,name:c.document.name,sourceRevision:c.source_revision,reason:c.reason,createdAt:c.created_at});
websiteB1Router.get('/starter-preview',limit,websiteFreeHandler(async(req,res)=>{
  if(!isValidTemplateId(req.query.templateId))throw new WebsiteOperationError('Choose a valid template.');
  res.json({success:true,...websiteStarter(req.query.templateId,'Your business')});
}));
websiteB1Router.get('/:id/publication-readiness',requireAuth,websiteFreeHandler(async(req,res)=>{
  const site=await WebsiteAssetStore.ownedSite(req.params.id,req.user!.id),review=websiteExampleReview(site.content_json);
  res.json({success:true,revision:site.updated_at,layoutMode:websiteLayoutMode(site.template_id,site.content_json),canPublish:!review.required,review});
}));
websiteB1Router.get('/:id/template-plan',requireAuth,websiteFreeHandler(async(req,res)=>{
  const site=await WebsiteAssetStore.ownedSite(req.params.id,req.user!.id);
  if(!isValidTemplateId(req.query.targetTemplateId))throw new WebsiteOperationError('Choose a valid template.');
  const summary=websiteMigrationSummary(site.template_id,req.query.targetTemplateId),checkpoints=await WebsiteCheckpointStore.forSite(site.id,req.user!.id);
  res.json({success:true,revision:site.updated_at,summary,content:migrateWebsiteTemplate(site.content_json,site.template_id,req.query.targetTemplateId),settings:site.settings_json,publishedTemplateId:site.status==='published'?(site.published_snapshot_json?.templateId||site.template_id):null,recoverable:checkpoints.filter(c=>c.template_id===req.query.targetTemplateId).map(metadata),checkpointSlotsRemaining:Math.max(0,WEBSITE_CHECKPOINT_LIMIT-checkpoints.length)});
}));
websiteB1Router.post('/:id/layout',requireAuth,limit,websiteFreeHandler(async(req,res)=>{
  const input=body(req,['mode','expectedUpdatedAt','confirmed']);
  if(!['template','sections'].includes(input.mode))throw new WebsiteOperationError('Choose a valid layout mode.');
  res.json({success:true,site:await WebsiteStore.transitionLayout(req.params.id,req.user!.id,input.mode,input.expectedUpdatedAt)});
}));
websiteB1Router.post('/:id/review-examples',requireAuth,limit,websiteFreeHandler(async(req,res)=>{
  const input=body(req,['itemIds','action','expectedUpdatedAt','confirmed']);
  if(!Array.isArray(input.itemIds)||input.itemIds.length<1||input.itemIds.length>50||!input.itemIds.every((id:unknown)=>typeof id==='string'&&id.length<=64)||new Set(input.itemIds).size!==input.itemIds.length||!['confirm','remove'].includes(input.action))throw new WebsiteOperationError('Select example items and a valid review action.');
  const site=await WebsiteStore.reviewExamples(req.params.id,req.user!.id,input.expectedUpdatedAt,input.itemIds,input.action);res.json({success:true,site});
}));
websiteB1Router.get('/:id/checkpoints',requireAuth,websiteFreeHandler(async(req,res)=>{
  await WebsiteAssetStore.ownedSite(req.params.id,req.user!.id);
  res.json({success:true,limit:WEBSITE_CHECKPOINT_LIMIT,checkpoints:(await WebsiteCheckpointStore.forSite(req.params.id,req.user!.id)).map(metadata)});
}));
websiteB1Router.get('/:id/checkpoints/:checkpointId',requireAuth,websiteFreeHandler(async(req,res)=>{
  await WebsiteAssetStore.ownedSite(req.params.id,req.user!.id);
  const checkpoint=(await WebsiteCheckpointStore.forSite(req.params.id,req.user!.id)).find(c=>c.id===req.params.checkpointId);
  if(!checkpoint)throw new WebsiteOperationError('Draft checkpoint not found.',404);
  res.json({success:true,checkpoint:{...metadata(checkpoint),document:checkpoint.document}});
}));
websiteB1Router.post('/:id/restore-draft',requireAuth,limit,websiteFreeHandler(async(req,res)=>{
  const input=body(req,['checkpointId','expectedUpdatedAt','confirmed']);
  if(typeof input.checkpointId!=='string'||!/^[0-9a-f-]{36}$/i.test(input.checkpointId))throw new WebsiteOperationError('Choose a saved checkpoint.');
  res.json({success:true,site:await WebsiteStore.restoreDraft(req.params.id,req.user!.id,input.checkpointId,input.expectedUpdatedAt)});
}));
websiteB1Router.delete('/:id/checkpoints/:checkpointId',requireAuth,limit,websiteFreeHandler(async(req,res)=>{
  const input=body(req,['expectedUpdatedAt','confirmed']);
  await withWebsiteLock(req.user!.id,async()=>{
    const site=await WebsiteAssetStore.ownedSite(req.params.id,req.user!.id);
    if(site.updated_at!==input.expectedUpdatedAt)throw new WebsiteOperationError('Your website changed. Reload before removing recovery history.',409);
    if(!(await WebsiteCheckpointStore.forSite(site.id,req.user!.id)).some(c=>c.id===req.params.checkpointId))throw new WebsiteOperationError('Draft checkpoint not found.',404);
    await WebsiteCheckpointStore.discard(site.id,req.user!.id,req.params.checkpointId);
  });res.json({success:true});
}));
