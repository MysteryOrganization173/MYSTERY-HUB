import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createECDH} from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import express from 'express';
import {validateSubscription,encryptSubscription,decryptSubscription,validateTemplate,renderTemplate,pushConfiguration} from '../../services/notificationSafety.js';
import {notificationRouter,adminNotificationRouter} from '../../routes/notificationApi.js';
import {AuthStore} from '../../db/authStore.js';
import webPush from 'web-push';
import {draftNotification} from '../../services/notificationDraft.js';
import {NotificationService} from '../../services/notificationService.js';
export function syntheticSubscription(endpoint='https://fcm.googleapis.com/fcm/send/SYNTHETIC'){const ec=createECDH('prime256v1');return {endpoint,keys:{p256dh:ec.generateKeys().toString('base64url'),auth:randomBytes(16).toString('base64url')}};}
for(const endpoint of ['http://fcm.googleapis.com/x','https://localhost/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.test/x','https://user:password@fcm.googleapis.com/x','https://fcm.googleapis.com:8080/x','https://[::1]/x','file:///private','https://evil.notify.windows.com.evil.test/x'])test('subscription SSRF/credential guard rejects '+endpoint.replace('user:password','redacted'),()=>assert.throws(()=>validateSubscription(syntheticSubscription(endpoint))));
test('subscription key sizes, curve point, expiry and unknown fields fail closed',()=>{
 const s=syntheticSubscription();assert.deepEqual(validateSubscription(s).keys,s.keys);
 assert.throws(()=>validateSubscription({...s,keys:{...s.keys,auth:'bad'}}));assert.throws(()=>validateSubscription({...s,expirationTime:1}));assert.throws(()=>validateSubscription({...s,userId:'someone'}));
 assert.throws(()=>validateSubscription({...s,keys:{...s.keys,p256dh:Buffer.concat([Buffer.from([4]),Buffer.alloc(64)]).toString('base64url')}}));
});
test('authenticated encryption hides endpoint and keys and rejects tampering/wrong key',()=>{
 const old=process.env.WEB_PUSH_STORAGE_KEY;try{process.env.WEB_PUSH_STORAGE_KEY=randomBytes(32).toString('base64');const s=syntheticSubscription(),encrypted=encryptSubscription(s);assert.equal(encrypted.includes('fcm'),false);assert.deepEqual(decryptSubscription(encrypted),s);const altered=Buffer.from(encrypted,'base64');altered[altered.length-1]^=1;assert.throws(()=>decryptSubscription(altered.toString('base64')));process.env.WEB_PUSH_STORAGE_KEY=randomBytes(32).toString('base64');assert.throws(()=>decryptSubscription(encrypted));}finally{if(old===undefined)delete process.env.WEB_PUSH_STORAGE_KEY;else process.env.WEB_PUSH_STORAGE_KEY=old;}
});
for(const body of ['Save GH₵20 now','Get 20% off','Guaranteed delivery now','Your order delivered','Email a@example.test','Use {{customerPhone}} today','Use {{appName} today'])test('template claim/placeholder validation rejects '+body,()=>assert.throws(()=>validateTemplate({title:'Service update',body,category:'marketing',enabled:true})));
test('safe templates render resolved authoritative placeholders and default config stays disabled',()=>{
 assert.deepEqual(renderTemplate({title:'Hello {{appName}}',body:'{{eventLabel}}'}),{title:'Hello Mystery Hub',body:'Account update'});assert.throws(()=>renderTemplate({title:'{{unknown}}',body:'Body'}));assert.equal(pushConfiguration().enabled,false);
});
test('notification APIs deny guests and non-admin campaigns before accessing storage',async()=>{
 const previous=AuthStore.findSessionByToken;AuthStore.findSessionByToken=async()=>({user:{id:'buyer',role:'customer',status:'active'}} as any);
 const app=express();app.use(express.json());app.use('/notifications',notificationRouter);app.use('/admin',adminNotificationRouter);const server=app.listen(0,'127.0.0.1');
 try{await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as any).port}`;
 assert.equal((await fetch(base+'/notifications/preferences')).status,401);assert.equal((await fetch(base+'/admin/templates')).status,401);
 assert.equal((await fetch(base+'/admin/campaigns',{method:'POST',headers:{authorization:'Bearer synthetic','content-type':'application/json'},body:'{}'})).status,403);
 const config=await (await fetch(base+'/notifications/config')).json();assert.equal(config.enabled,false);assert.equal(config.publicKey,null);
 }finally{AuthStore.findSessionByToken=previous;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
test('push worker ignores untrusted payload destinations, masks content and opens only authenticated-inbox route',async()=>{
 const handlers:Record<string,Function>={},shown:any[]=[],opened:string[]=[];const id='11111111-1111-4111-8111-111111111111';
 const self={addEventListener:(type:string,fn:Function)=>handlers[type]=fn,location:{origin:'https://mysterybundlehub.com'},skipWaiting:async()=>{},registration:{showNotification:async(...args:any[])=>shown.push(args),getNotifications:async()=>[]},clients:{claim:async()=>{},matchAll:async()=>[],openWindow:async(url:string)=>opened.push(url)}};
 vm.runInNewContext(fs.readFileSync('public/push-sw.js','utf8'),{self,URL});let pending:Promise<any>=Promise.resolve();
 handlers.push({data:{json:()=>({version:1,notificationId:id,title:'PRIVATE CUSTOMER',body:'private phone',url:'https://evil.test'})},waitUntil:(p:Promise<any>)=>pending=p});await pending;
 assert.equal(shown[0][0],'Mystery Hub');assert.doesNotMatch(JSON.stringify(shown),/PRIVATE|private phone|evil/);
 handlers.notificationclick({notification:{data:{notificationId:id},close:()=>{}},waitUntil:(p:Promise<any>)=>pending=p});await pending;assert.deepEqual(opened,['https://mysterybundlehub.com/orders?notification='+id]);
 assert.equal(handlers.fetch,undefined);assert.equal(handlers.pushsubscriptionchange,undefined); // Re-subscription always needs a current authenticated page.
});
test('real Web Push library encrypts synthetic payload and signs VAPID without any provider call',()=>{
 const keys=webPush.generateVAPIDKeys();const details=webPush.generateRequestDetails(syntheticSubscription(),'synthetic plaintext',{vapidDetails:{subject:'mailto:synthetic@example.test',...keys},TTL:3600});
 assert.equal(details.method,'POST');assert.ok(details.body);assert.equal(details.body!.includes(Buffer.from('synthetic plaintext')),false);assert.equal(Object.entries(details.headers).find(([key])=>key.toLowerCase()==='content-encoding')?.[1],'aes128gcm');
});
test('AI drafting sees only canonical safe template text, never edited text, recipients or sends',async()=>{
 const previous=NotificationService.preview;NotificationService.preview=async()=>({template:{body:'SECRET_CUSTOMER_RECORD',title:'SECRET_CUSTOMER_RECORD'},preview:{}} as any);let sent='';
 try{const result=await draftNotification({mode:'friendly',templateId:'new_service'},()=>({models:{generateContent:async(input:any)=>{sent=JSON.stringify(input.contents);return {text:JSON.stringify({title:'Discover services',body:'Explore services in {{appName}}.'})};}}} as any));assert.equal(result.sent,false);assert.equal(result.requiresReview,true);assert.doesNotMatch(sent,/SECRET_CUSTOMER_RECORD/);assert.match(sent,/Explore the services currently available/);
 await assert.rejects(()=>draftNotification({mode:'friendly',templateId:'custom_customer_template'}),/only the built-in/);
 await assert.rejects(()=>draftNotification({mode:'friendly',templateId:'new_service',userId:'buyer'}),/Unexpected/);
 await assert.rejects(()=>draftNotification({mode:'friendly',templateId:'new_service'},()=>({models:{generateContent:async()=>({text:JSON.stringify({title:'Discount',body:'Save 20% right now'})})}} as any)),/safe draft/);
 }finally{NotificationService.preview=previous;}
});
