import {Router,type Request,type RequestHandler} from 'express';
import {requireAdmin,requireAuth} from '../middleware/authMiddleware.js';
import {getPool} from '../db/connection.js';
import {redactAiSavedText} from '../../shared/mysteryAiPrivacy.js';
import {AI_FEEDBACK_ANSWER_MAX,AI_FEEDBACK_NOTE_MAX,isFeedbackCategory} from '../../shared/mysteryAiFeedback.js';
import type {Pool} from 'pg';

const table='mysteryhub_ai_feedback_private.reports';
class FeedbackError extends Error {constructor(readonly status:number,message:string){super(message);}}
const reference=(id:unknown)=>{
  if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw new FeedbackError(400,'Invalid report reference.');
  return id.toLowerCase();
};
const text=(value:unknown,max:number)=>{
  if(value===null||value===undefined||value==='')return null;
  if(typeof value!=='string'||value.length>max||value.includes('\0'))throw new FeedbackError(400,'Report text exceeds the allowed limit.');
  return redactAiSavedText(value.trim()).slice(0,max)||null;
};
const endpoint=(work:(db:Pool,req:Request)=>Promise<unknown>):RequestHandler=>async(req,res)=>{
  try {
    const db=getPool();
    if(!db)throw new FeedbackError(503,'Mystery AI feedback is temporarily unavailable.');
    res.json(await work(db,req));
  } catch(error) {
    res.status(error instanceof FeedbackError?error.status:503).json({error:error instanceof FeedbackError?error.message:'Mystery AI feedback is temporarily unavailable.'});
  }
};
export const mysteryAiFeedbackRouter=Router();
mysteryAiFeedbackRouter.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
mysteryAiFeedbackRouter.post('/',requireAuth,endpoint(async(db,req)=>{
  if(req.user?.role!=='customer')throw new FeedbackError(403,'Sign in with a customer account to submit feedback.');
  const body=req.body;
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['reference','category','note','shareAnswer','answer'].includes(k))
    ||!isFeedbackCategory(body.category)||typeof body.shareAnswer!=='boolean')throw new FeedbackError(400,'Select a feedback category and confirm what to share.');
  const id=reference(body.reference), note=text(body.note,AI_FEEDBACK_NOTE_MAX);
  if(!body.shareAnswer&&body.answer!==undefined&&body.answer!==null)throw new FeedbackError(400,'Answer text requires explicit permission.');
  const answer=body.shareAnswer?text(body.answer,AI_FEEDBACK_ANSWER_MAX):null;
  if(body.shareAnswer&&!answer)throw new FeedbackError(400,'There is no selected answer to share.');
  const owner=req.user.id;
  const client=await db.connect();
  try{
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='5s'");
    const active=await client.query("SELECT id FROM public.users WHERE id=$1 AND status='active' AND role='customer' AND NOT must_change_password FOR UPDATE",[owner]);
    if(!active.rowCount)throw new FeedbackError(403,'Sign in with an active customer account to submit feedback.');
    const existing=(await client.query(`SELECT category,note,answer FROM ${table} WHERE reference=$1 AND author_id=$2`,[id,owner])).rows[0];
    if(existing){
      if(existing.category!==body.category||existing.note!==note||existing.answer!==answer)throw new FeedbackError(409,'This report was already sent with different details.');
    }else{
      const recent=await client.query(`SELECT 1 FROM ${table} WHERE author_id=$1 AND created_at>now()-interval '24 hours' LIMIT 5`,[owner]);
      if((recent.rowCount??0)>=5)throw new FeedbackError(429,'You’ve reached today’s feedback limit. Try again later.');
      const inserted=await client.query(`INSERT INTO ${table}(reference,author_id,category,note,answer) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,[id,owner,body.category,note,answer]);
      if(!inserted.rowCount)throw new FeedbackError(409,'Could not accept this report reference.');
    }
    await client.query('COMMIT');
    return {reference:id};
  }catch(error){
    await client.query('ROLLBACK').catch(()=>{});
    throw error;
  }finally{client.release();}
}));
mysteryAiFeedbackRouter.get('/admin',requireAdmin,endpoint(async(db,req)=>{
  const status=req.query.status??'new';
  if(status!=='new'&&status!=='reviewed')throw new FeedbackError(400,'Invalid report status.');
  const {rows}=await db.query(`SELECT reference,category,note,answer,status,created_at AS "createdAt" FROM ${table} WHERE status=$1 ORDER BY created_at DESC,reference LIMIT 25`,[status]);
  return {reports:rows};
}));
mysteryAiFeedbackRouter.patch('/admin/:id',requireAdmin,endpoint(async(db,req)=>{
  if(req.body?.status!=='reviewed')throw new FeedbackError(400,'Only the reviewed state is supported.');
  const {rowCount}=await db.query(`UPDATE ${table} SET status='reviewed' WHERE reference=$1`,[reference(req.params.id)]);
  if(!rowCount)throw new FeedbackError(404,'Report not found.');
  return {reviewed:true};
}));
