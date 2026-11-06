import assert from 'node:assert/strict';
import {test} from 'node:test';
import {aiActions,validateAiNavigation} from '../../../shared/mysteryAiIntent.js';
import {sendMysteryAiMessage} from '../../../src/services/mysteryAiService.js';

for(const [question,page] of [
 ['Open the Data page','data'],['Take me to my Wallet','wallet'],['Show me Creative Studio','creative'],
 ['I want to check my order','orders'],['Where can I buy airtime','data'],
 ['Can I check my order status','orders'],
 ['I want to create a website','website'],['Show me all services','services'],
 ['Take me to Mystery Earn','earn'],['Can I request a logo design','creative'],
])test(question,()=>assert.equal(aiActions(question)[0]?.targetPage,page));

test('explicit data or airtime offers two modes without calling Gemini',async()=>{
 const result=await sendMysteryAiMessage('How do I buy data or airtime?','home',[]);
 assert.equal(result.source,'scripted');
 assert.deepEqual(result.actions?.map(action=>action.dataMode),['data','airtime']);
 assert.equal(validateAiNavigation(result.actions![0],'data','data'),undefined);
 assert.equal(validateAiNavigation(result.actions![1],'data','data')?.dataMode,'airtime');
});
test('tracking on Orders targets the existing panel and becomes stale after leaving',()=>{
 const [action]=aiActions('I want to check my order',{activePage:'orders'});
 assert.equal(action?.focus,'track-order');
 assert.equal(validateAiNavigation(action,'home'),undefined);
 assert.deepEqual(aiActions('Open Wallet',{activePage:'wallet'}),[]);
});
test('follow-ups rely on the last relevant user topic and inherit negation',()=>{
 const history=(content:string)=>[{role:'user' as const,content},{role:'assistant' as const,content:'Open Wallet'}];
 assert.equal(aiActions('Take me there',{history:history('What can Creative Studio design?')})[0]?.targetPage,'creative');
 assert.deepEqual(aiActions('Open it',{history:history('Do not open Creative Studio')}),[]);
 assert.deepEqual(aiActions('Open it',{history:history('Compare Wallet and Mystery Earn')}),[]);
});
test('negative, dormant and forged actions fail closed',()=>{
 for(const q of ["Don’t open the Wallet","Can I buy a WAEC checker","Open the admin panel","Compare Wallet and Mystery Earn"])
   assert.deepEqual(aiActions(q),[],q);
 const [action]=aiActions('Open Wallet');
 assert.equal(validateAiNavigation({...action,label:'Send money'},'home'),undefined);
});
