import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {CALENDAR,EXPERIENCE_END,seasonalState,countdownState,type ExperienceConfig} from '../../../shared/mysteryExperiences.js';
import {greetingInput} from '../../services/experienceValidation.js';
import {ExperienceStore} from '../../db/experienceStore.js';
import {experienceRouter,adminExperienceRouter} from '../../routes/experienceApi.js';
import {ExperienceService} from '../../services/experienceService.js';
import {createPublicHtmlRouter} from '../../routes/publicHtml.js';
import {campaignRequestEligible} from '../../db/campaignStore.js';
import {validateGrowth} from '../../services/growthValidation.js';
const config:ExperienceConfig={id:'christmas-2026',revision:1,definition_version:1,starts_at:CALENDAR[0][0],ends_at:EXPERIENCE_END,time_zone:'Africa/Accra',lifecycle:'approved',enabled:true,preview_enabled:true,override_phase:null,override_until:null,updated_at:new Date().toISOString()};
for(const [index,[start,phase]] of CALENDAR.entries())test(`calendar ${phase} inclusive, previous phase exclusive`,()=>{
 assert.equal(seasonalState(config,new Date(start),true).phase,phase);
 assert.equal(seasonalState(config,new Date(Date.parse(start)-1),true).phase,index?CALENDAR[index-1][1]:null);
 assert.equal(seasonalState(config,new Date(start),true).nextTransitionAt,CALENDAR[index+1]?.[0]||EXPERIENCE_END);
});
test('Jan6 restores normal; deployment, approval and enablement are independent',()=>{
 const at=new Date(EXPERIENCE_END);assert.equal(seasonalState(config,at,true).appearance,'normal');
 for(const c of [null,{...config,enabled:false},{...config,lifecycle:'draft' as const},{...config,lifecycle:'archived' as const}])assert.equal(seasonalState(c,new Date('2026-12-25'),true).active,false);
 assert.equal(seasonalState(config,new Date('2026-12-25')).active,false);
 assert.equal(seasonalState({...config,definition_version:2},new Date('2026-12-25'),true).availability,'unavailable');
});
test('time-bounded override expires exactly into schedule without jobs or browser state',()=>{
 const c={...config,override_phase:'new_year_eve' as const,override_until:'2026-12-25T01:00:00Z'};
 assert.equal(seasonalState(c,new Date('2026-12-25T00:59:59.999Z'),true).phase,'new_year_eve');
 assert.equal(seasonalState(c,new Date(c.override_until),true).phase,'christmas_day');
 assert.equal(seasonalState(c,new Date('2027-02-01'),true).active,false);
});
test('Accra countdown recalculates real time and post-midnight state',()=>{
 assert.equal(countdownState(new Date('2026-12-31T23:59:59.999Z')).remainingMs,1);
 assert.equal(countdownState(new Date('2027-01-01T00:00:00Z')).passed,true);
 assert.equal(countdownState(new Date('2027-01-05')).remainingMs,0);
});
const input=()=>({occasion:'christmas-2026',recipientName:'Ama',showSender:false,senderName:'Hidden private name',message:'Merry Christmas, with love!',variant:'gift-classic-v1',creatorToken:randomBytes(32).toString('base64url'),idempotencyKey:randomUUID()});
test('greeting validation normalizes Unicode, suppresses hidden identity and snapshots curated content',()=>{
 assert.equal(greetingInput(input()).value.senderName,null);
 const v={...input(),recipientName:'Ame\u0301',templateId:'christmas-warm-v1'};delete (v as any).message;
 assert.equal(greetingInput(v).value.recipientName,'Amé');assert.match(greetingInput(v).value.message,/warmth/);
 for(const v of [{...input(),recipientName:'A'.repeat(61)},{...input(),message:'x'.repeat(601)},{...input(),message:'<script>alert(1)</script>'},{...input(),message:'go https://evil.test'},{...input(),message:'hello\u202eevil'},{...input(),message:'    '},{...input(),templateId:'not-real'},{...input(),occasion:'easter-2030'},{...input(),creatorToken:'short'},{...input(),extra:'unapproved'}])assert.throws(()=>greetingInput(v));
});
test('growth retains existing privacy validation and financial outcomes cannot be submitted',()=>{
 const data={visitorId:randomUUID(),sessionId:randomUUID(),metadata:{page:'greetings'}};
 assert.doesNotThrow(()=>validateGrowth({...data,event:'page_view'}));
 assert.throws(()=>validateGrowth({...data,event:'verified_sale'}));
 assert.throws(()=>validateGrowth({...data,event:'greeting_created'}));
 assert.equal(campaignRequestEligible('GET','WhatsApp/2'),false);assert.equal(campaignRequestEligible('GET','Mozilla','1'),false);assert.equal(campaignRequestEligible('GET','Mozilla',undefined,'prefetch'),false);
});
test('missing storage fails closed; public preview query cannot activate, Admin APIs reject guests',async()=>{
 assert.equal(process.env.DATABASE_URL,undefined);
 const old=process.env.MYSTERY_EXPERIENCES_ENABLED;process.env.MYSTERY_EXPERIENCES_ENABLED='true';
 try{
  const state=await ExperienceService.state(new Date('2026-12-25'));assert.equal(state.active,false);assert.equal(state.availability,'unavailable');
  await assert.rejects(ExperienceStore.configuration());
  const app=express();app.use(express.json());app.use('/api/experiences',experienceRouter);app.use('/api/admin/experiences',adminExperienceRouter);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as any).port}`;
  try{const r=await fetch(base+'/api/experiences/state?preview=christmas_day');assert.equal((await r.json()).active,false);assert.match(r.headers.get('cache-control')!,/no-store/);assert.equal((await fetch(base+'/api/admin/experiences/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"phase":"christmas_day"}'})).status,401);}
  finally{await new Promise<void>(r=>server.close(()=>r()));}
 }finally{if(old===undefined)delete process.env.MYSTERY_EXPERIENCES_ENABLED;else process.env.MYSTERY_EXPERIENCES_ENABLED=old;}
});
test('raw social HTML has canonical private generic metadata; crawlers cause no event writes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'experiences-html-'));writeFileSync(join(dir,'index.html'),'<html><head><title>old</title></head><body><div id="root"></div></body></html>');
 let exists=true;const id=randomBytes(18).toString('base64url');const calls=mock.method(ExperienceStore,'event',async()=>{throw Error('must not track crawlers');});
 const app=express();app.use(createPublicHtmlRouter(dir,{product:async()=>null,site:async()=>null,greeting:async()=>exists}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as any).port}`;
 try{
  const response=await fetch(`${base}/g/${id}?recipient=PRIVATE&image=https://evil.test`,{headers:{Host:'evil.test','User-Agent':'facebookexternalhit'}});const html=await response.text();
  assert.equal(response.status,200);assert.match(html,/og:title/);assert.match(html,/og:image:width/);assert.match(html,/twitter:card/);assert.ok(html.includes(`https://mysterybundlehub.com/g/${id}`));assert.match(response.headers.get('x-robots-tag')!,/noindex/);assert.doesNotMatch(html,/PRIVATE|evil.test/);assert.equal(calls.mock.callCount(),0);
  exists=false;assert.equal((await fetch(`${base}/g/${id}`)).status,404);
  assert.equal((await fetch(`${base}/g/bad`)).status,404);
 }finally{await new Promise<void>(r=>server.close(()=>r()));rmSync(dir,{recursive:true});mock.restoreAll();}
});
test('social storage failure is503, never a misleading greeting success',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'experiences-unavailable-'));writeFileSync(join(dir,'index.html'),'<html><head></head><body></body></html>');
 const app=express();app.use(createPublicHtmlRouter(dir,{product:async()=>null,site:async()=>null,greeting:async()=>{throw Error('private database error');}}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 try{const r=await fetch(`http://127.0.0.1:${(server.address() as any).port}/g/${randomBytes(18).toString('base64url')}`);assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private database error/);assert.match(r.headers.get('cache-control')!,/no-store/);}finally{await new Promise<void>(r=>server.close(()=>r()));rmSync(dir,{recursive:true});}
});
test('optional schema is never wired into startup; excluded visual/financial modules are not dependencies',()=>{
 assert.doesNotMatch(readFileSync('server/db/connection.ts','utf8'),/mysteryExperiences|experienceStore|mysteryhub_experiences/);
 for(const file of ['server/db/experienceStore.ts','server/routes/experienceApi.ts'])assert.doesNotMatch(readFileSync(file,'utf8'),/supplier|paystack|FinanceStore|OrdersStore/);
});
