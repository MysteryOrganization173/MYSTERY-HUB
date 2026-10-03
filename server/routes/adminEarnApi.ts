import { Router, type Request, type Response } from 'express';
import { requireAdmin } from '../middleware/authMiddleware.js';
import { AdminEarnStore } from '../db/adminEarnStore.js';
import { ReferralStore } from '../db/referralStore.js';
import { parseEarnQuery, EarnInputError } from '../services/adminEarnQuery.js';
import { recommendedPolicyStatus } from '../services/adminEarnControls.js';

export const adminEarnRouter = Router();
adminEarnRouter.use(requireAdmin);
const route = (handler: (req: Request,res: Response)=>Promise<void>) => async (req: Request,res: Response) => {
  try { await handler(req,res); } catch(error) {
    if(error instanceof EarnInputError) {res.status(400).json({error:error.message});return;}
    console.error('[Admin Earn] Request failed:',error); res.status(500).json({error:'Could not complete Mystery Earn request.'});
  }
};
adminEarnRouter.get('/overview',route(async(req,res)=>{res.json({success:true,overview:await AdminEarnStore.overview(parseEarnQuery(req.query))});}));
adminEarnRouter.get('/leaderboard',route(async(req,res)=>{const query=parseEarnQuery(req.query);res.json({success:true,period:query.range,...await AdminEarnStore.leaderboard(query)});}));
adminEarnRouter.get('/ledger',route(async(req,res)=>{const query=parseEarnQuery(req.query);res.json({success:true,period:query.range,...await AdminEarnStore.ledger(query)});}));
adminEarnRouter.get('/policy',route(async(_req,res)=>{res.json({success:true,policy:await recommendedPolicyStatus(),readOnly:true});}));
adminEarnRouter.get('/referrers/:id',route(async(req,res)=>{const detail=await AdminEarnStore.detail(req.params.id,parseEarnQuery(req.query));
  if(!detail){res.status(404).json({error:'Referral profile not found.'});return;}res.json({success:true,detail});}));
adminEarnRouter.patch('/referrers/:id/status',route(async(req,res)=>{
  if(typeof req.body?.enabled!=='boolean'||req.body?.confirm!==true) throw new EarnInputError('Confirm an active/suspended profile status.');
  if(!await ReferralStore.findProfileByUserId(req.params.id)){res.status(404).json({error:'Referral profile not found.'});return;}
  const result=await ReferralStore.setProfileEnabled(req.params.id,req.body.enabled,req.user!.id);
  res.json({success:true,changed:result.changed,profile:{userId:result.profile.user_id,code:result.profile.referral_code,enabled:result.profile.is_enabled}});
}));
