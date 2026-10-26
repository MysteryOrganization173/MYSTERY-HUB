import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFixtureCustomerNotifications} from '../../../src/fixtures/notificationFixtures';
import {notificationOpportunity,activateNotificationOnboarding,acceptNotificationOffers} from '../../../src/pwa/notificationOnboarding';
import {marketingPromptAnswered,markMarketingPromptAnswered,showNotificationOptIn,NO_SNOOZE} from '../../../src/pwa/launchPolicy';

function fixture(permission:NotificationPermission='default',options:Parameters<typeof createFixtureCustomerNotifications>[0]={}) {
  const f=createFixtureCustomerNotifications(options);let asks=0;
  const env:any={...f.env,isSecureContext:true,location:{pathname:'/'},Notification:{get permission(){return permission;},requestPermission:async()=>{asks++;permission='granted';return permission;}}};env.top=env;env.self=env;
  const opts={allowOffers:true,offersAnswered:false,signal:new AbortController().signal,environment:env,snooze:NO_SNOOZE,now:Date.now()};
  return {...f,env,opts,asks:()=>asks};
}
const deferred=<T,>()=>{let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};};

test('onboarding assessment is read-only and disabled configuration never asks permission',async()=>{
  const f=fixture();assert.equal(await notificationOpportunity(f.client,'a',f.opts),'enable');assert.equal(f.asks(),0);assert.equal(f.registered.size,0);
  assert.equal(await notificationOpportunity({...f.client,configuration:async()=>({enabled:false,publicKey:null,workerPath:'/push-sw.js'})},'a',f.opts),null);assert.equal(f.asks(),0);
});
test('Allow completes subscription and server confirmation, then immediately offers the separate marketing choice',async()=>{
  const f=fixture();assert.equal((await activateNotificationOnboarding(f.client,'a',f.opts)).step,'offers');assert.equal(f.asks(),1);assert.equal(f.registered.size,1);assert.equal((await f.client.preferences('a')).promotional,false);
});
test('permission granted by the old prompt is recovered without another native permission request',async()=>{
  const f=fixture('granted');assert.equal(await notificationOpportunity(f.client,'a',f.opts),'enable');assert.equal((await activateNotificationOnboarding(f.client,'a',f.opts)).step,'offers');assert.equal(f.asks(),0);
  assert.equal(showNotificationOptIn({installed:true,signedIn:true,permission:'granted',registered:false,snooze:NO_SNOOZE,now:Date.now()}),true);
});
test('already registered customers receive the unanswered offers question; staff and opted-in customers do not',async()=>{
  const f=fixture();await activateNotificationOnboarding(f.client,'a',f.opts);
  assert.equal(await notificationOpportunity(f.client,'a',f.opts),'offers');assert.equal(await notificationOpportunity(f.client,'a',{...f.opts,allowOffers:false}),null);
  assert.equal(await notificationOpportunity(f.client,'a',{...f.opts,offersAnswered:true}),null);
  await acceptNotificationOffers(f.client,'a',f.opts.signal);assert.equal(await notificationOpportunity(f.client,'a',f.opts),null);
});
test('a declined or failed registration never offers promotions or pretends success',async()=>{
  const denied=fixture('denied');assert.equal((await activateNotificationOnboarding(denied.client,'a',denied.opts)).step,'denied');assert.equal(denied.asks(),0);assert.equal(denied.registered.size,0);
  const refused=fixture('default',{refuseRegister:true});assert.equal((await activateNotificationOnboarding(refused.client,'a',refused.opts)).step,'error');assert.equal(refused.registered.size,0);
  const unconfirmed=fixture('default',{confirm:false});assert.equal((await activateNotificationOnboarding(unconfirmed.client,'a',unconfirmed.opts)).step,'error');assert.equal((await unconfirmed.client.preferences('a')).promotional,false);
});
test('only the explicit offers acceptance writes marketing=true and preserves a prior order-update opt-out',async()=>{
  const f=fixture();await f.client.savePreferences('a',{transactional:false,promotional:false,expectedVersion:'p1'});
  await activateNotificationOnboarding(f.client,'a',f.opts);assert.equal((await f.client.preferences('a')).promotional,false);
  await acceptNotificationOffers(f.client,'a',f.opts.signal);const p=await f.client.preferences('a');assert.equal(p.promotional,true);assert.equal(p.transactional,false);
});
test('Not now is an account-scoped prompt answer, never a server opt-in or a repeated nag',async()=>{
  const f=fixture();const store={getItem:(_k:string)=>null,setItem:(_k:string,_v:string)=>{}};
  markMarketingPromptAnswered('customer-one',store);assert.equal(marketingPromptAnswered('customer-one',store),true);assert.equal(marketingPromptAnswered('customer-two',store),false);assert.equal((await f.client.preferences('a')).promotional,false);
});
test('closing or changing session during delayed configuration prevents permission and registration',async()=>{
  const f=fixture(),d=deferred<string>(),controller=new AbortController();const run=activateNotificationOnboarding({...f.client,publicKey:()=>d.promise},'old-session',{...f.opts,signal:controller.signal});controller.abort();d.resolve('AQID');await assert.rejects(run,/cancelled|closed/);assert.equal(f.asks(),0);assert.equal(f.registered.size,0);
});
test('a delayed previous-session assessment cannot expose the offers card to the next account',async()=>{
  const f=fixture(),d=deferred<{enabled:boolean}>(),controller=new AbortController();const run=notificationOpportunity({...f.client,configuration:()=>d.promise as never},'old-session',{...f.opts,signal:controller.signal});controller.abort();d.resolve({enabled:true});await assert.rejects(run,/closed/);assert.equal(f.asks(),0);
});
test('session changes during a delayed preference read cannot write offers for another account',async()=>{
  const f=fixture(),d=deferred<Awaited<ReturnType<typeof f.client.preferences>>>(),controller=new AbortController();let writes=0;const run=acceptNotificationOffers({...f.client,preferences:()=>d.promise,savePreferences:async()=>{writes++;throw Error('must not run');}},'old-session',controller.signal);controller.abort();d.resolve(await f.client.preferences('a'));await assert.rejects(run,/closed/);assert.equal(writes,0);
});
test('failed consent persistence remains an error and never marks consent confirmed',async()=>{
  const f=fixture();await assert.rejects(()=>acceptNotificationOffers({...f.client,savePreferences:async()=>({ok:false,message:'Temporary failure'})},'a',f.opts.signal),/Temporary failure/);assert.equal((await f.client.preferences('a')).promotional,false);
});
test('UI is installed-Home only, keyed to account/session and preserves checkout/editor overlay exclusion',()=>{
  const layer=readFileSync('src/components/pwa/AppLaunchLayer.tsx','utf8');assert.match(layer,/if \(!installed\) return null/);assert.match(layer,/activePage === 'home' && !busy/);assert.match(layer,/key=\{`\$\{user.id\}:\$\{sessionToken\}`\}/);assert.match(layer,/allowOffers=\{user.role==='customer'\}/);
  for(const guard of ['isCheckoutOpen','isAuthModalOpen','activeEditorSite','isAccountOpen','mustChangePassword'])assert.ok(layer.includes(guard));
  const ui=readFileSync('src/components/pwa/NotificationOptIn.tsx','utf8');assert.match(ui,/step==='offers'\)markMarketingPromptAnswered/);assert.match(ui,/acceptNotificationOffers/);assert.match(ui,/request.current\?\.abort/);
});
