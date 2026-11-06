import {Router,type Request,type RequestHandler} from 'express';
import {getPool} from '../db/connection.js';
import {AiHistoryStore,AiHistoryError} from '../db/mysteryAiHistoryStore.js';
import {requireAuth} from '../middleware/authMiddleware.js';

export const mysteryAiHistoryRouter=Router();
mysteryAiHistoryRouter.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();},requireAuth);
const endpoint=(work:(store:AiHistoryStore,owner:string,req:Request)=>Promise<unknown>):RequestHandler=>async(req,res)=>{
  if(req.user?.role!=='customer'){res.status(403).json({error:'Saved chats require a customer account.'});return;}
  try {
    const pool=getPool();
    if(!pool)throw new AiHistoryError(503,'Saved chats are not available right now. You can still use temporary chat.');
    res.json(await work(new AiHistoryStore(pool),req.user.id,req));
  } catch(error) {
    const status=error instanceof AiHistoryError?error.status:503;
    res.status(status).json({error:error instanceof AiHistoryError?error.message:'Saved chats are not available right now. You can still use temporary chat.'});
  }
};
mysteryAiHistoryRouter.get('/',endpoint((s,u)=>s.list(u)));
mysteryAiHistoryRouter.post('/',endpoint((s,u,r)=>s.create(u,r.body?.id,r.body?.title)));
mysteryAiHistoryRouter.put('/preference',endpoint((s,u,r)=>s.setStyle(u,r.body?.style)));
mysteryAiHistoryRouter.get('/:id',endpoint((s,u,r)=>s.read(u,r.params.id)));
mysteryAiHistoryRouter.post('/:id/turns',endpoint((s,u,r)=>s.append(u,r.params.id,r.body)));
mysteryAiHistoryRouter.patch('/:id',endpoint((s,u,r)=>s.rename(u,r.params.id,r.body?.title)));
mysteryAiHistoryRouter.delete('/:id',endpoint((s,u,r)=>s.remove(u,r.params.id)));
