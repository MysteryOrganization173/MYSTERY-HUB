import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createMysteryAiRouter} from '../../routes/mysteryAiApi.js';
import {sendMysteryAiMessage,MysteryAiError} from '../../../src/services/mysteryAiService.js';

for(const mode of ['gemini','guide','quota','timeout','configuration'] as const)test('real frontend/backend AI contract: '+mode,async()=>{
 const app=express();app.use(express.json());
 const client=mode==='guide'||mode==='configuration'?null:{models:{generateContent:async()=>{
  if(mode==='quota')throw {status:429};
  if(mode==='timeout')return new Promise(()=>{});
  return {text:'Synthetic provider answer'};
 }}};
 app.use('/api/mystery-ai',createMysteryAiRouter({getClient:()=>client as any,catalog:async()=>({products:[]}) as any,attemptTimeoutMs:20}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as any).port}`;
 const previous=globalThis.fetch;globalThis.fetch=(url,init)=>previous(base+String(url),init);
 try{
  if(mode==='gemini'){const r=await sendMysteryAiMessage('Explain a neutral concept','home',[]);assert.equal(r.source,'gemini');assert.equal(r.reply,'Synthetic provider answer');}
  if(mode==='guide'){const r=await sendMysteryAiMessage('How do I track my order?','orders',[]);assert.equal(r.source,'scripted');assert.match(r.reply,/Orders/);}
  if(mode==='quota')await assert.rejects(()=>sendMysteryAiMessage('Explain a neutral concept','home',[]),(e:any)=>e instanceof MysteryAiError&&e.kind==='busy'&&/60 seconds/.test(e.message));
  if(mode==='timeout')await assert.rejects(()=>sendMysteryAiMessage('Explain a neutral concept','home',[]),(e:any)=>e instanceof MysteryAiError&&e.kind==='timeout');
  if(mode==='configuration')await assert.rejects(()=>sendMysteryAiMessage('Explain a neutral concept','home',[]),(e:any)=>e instanceof MysteryAiError&&e.retryable===false);
 }finally{globalThis.fetch=previous;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
