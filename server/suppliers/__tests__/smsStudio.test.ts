import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buyingPattern} from '../../sms/buyingPatterns.js';
import {draftSms} from '../../sms/draft.js';
import {SMS_STUDIO_TEMPLATES} from '../../../shared/smsStudio.js';
import {studioTemplates} from '../../sms/studio.js';
import {smsEstimate} from '../../../src/utils/manualSms.js';
const now=new Date('2026-11-17T12:00:00Z'),days=(values:number[])=>values.map(n=>new Date(+now-n*86400000));
test('buying cycles distinguish weekly, monthly, irregular and insufficient history',()=>{
 assert.equal(buyingPattern(days([35,28,21,14,7]),now).group,'normal');
 assert.equal(buyingPattern(days([39,32,25,18,11]),now).group,'due');
 assert.equal(buyingPattern(days([45,38,31,24,17]),now).group,'unusual');
 assert.equal(buyingPattern(days([90,83,76,69,62]),now).group,'long_inactive');
 assert.equal(buyingPattern(days([91,61,31,1]),now).group,'recent');
 assert.equal(buyingPattern(days([100,70,40,10]),now).group,'recent');
 assert.equal(buyingPattern(days([120,90,60,30]),now).group,'normal');
 assert.equal(buyingPattern(days([10]),now).group,'one_time');assert.equal(buyingPattern([],now).group,'insufficient');
 assert.equal(buyingPattern(days([1,1,1]),now).group,'insufficient');assert.equal(buyingPattern(days([10,1]),now).group,'insufficient');
 assert.equal(buyingPattern(days([90,89,88,48,1]),now).group,'insufficient');
});
test('manual library supplies all17 editable purposes and virtual versions without writes',()=>{
 assert.equal(SMS_STUDIO_TEMPLATES.length,17);assert.equal(new Set(SMS_STUDIO_TEMPLATES.map(t=>t.id)).size,17);
 const templates=studioTemplates([]);assert.equal(templates.find(t=>t.id==='friday').version,0);assert.equal(templates.find(t=>t.id==='custom').body,'');
 assert.ok(SMS_STUDIO_TEMPLATES.every(t=>!/^Mystery Hub:/i.test(t.body)));
 const edited={id:'support',body:'An approved custom saved service notice.',version:4,enabled:false};assert.deepEqual(studioTemplates([edited]).find(t=>t.id==='support'),edited);
});
const brief=()=>({goal:'availability',audience:'direct_customers',service:'data',network:'all',keyFacts:'',tone:'friendly',desiredSegments:1,cta:'Check current services.',officialLink:'website'});
const response=(alternatives:string[],capture?:(v:any)=>void)=>()=>({models:{generateContent:async(v:any)=>{capture?.(v);return {text:JSON.stringify({alternatives})};}}});
test('goal assistant returns reviewed alternatives and accurate estimates, never sends',async()=>{
 const result=await draftSms({brief:brief()},response(['Need data? Check current services: https://mysterybundlehub.com','Explore our digital services: https://mysterybundlehub.com']));assert.ok('purpose' in result);assert.equal(result.purpose,'marketing');assert.equal(result.sent,false);assert.equal(result.alternatives.length,2);assert.deepEqual((result as any).estimates,result.alternatives.map(smsEstimate));
});
test('goal assistant redacts identifiers before model input and rejects sensitive material',async()=>{
 let outbound='';const b={...brief(),keyFacts:'Hello Kojo Mensah: 0591234567 and person@example.test'};
 const client=()=>({models:{generateContent:async(v:any)=>{outbound=JSON.stringify(v);const data=JSON.parse(v.contents[0].parts[0].text);return {text:JSON.stringify({alternatives:[data.keyFacts]})};}}});
 await draftSms({brief:b},client);assert.ok(!outbound.includes('0591234567'));assert.ok(!outbound.includes('person@example.test'));assert.ok(!outbound.includes('Kojo Mensah'));
 let calls=0;await assert.rejects(()=>draftSms({brief:{...brief(),keyFacts:'OTP 1234'}},()=>{calls++;return client();}),/sensitive/);assert.equal(calls,0);
 await assert.rejects(()=>draftSms({brief:{...brief(),customers:['private']}},client),/Unexpected/);
});
test('goal assistant rejects invented prices, offers, speed, status, networks, URLs and excess length',async()=>{
 for(const text of ['Save 50% today!','Instant delivery is guaranteed.','Service restored today.','GHS 1 for every bundle.','Visit https://evil.test','Payment confirmed.','x'.repeat(161),'All bundles are available now.','Delivery within five minutes.','Your order has been delivered.','Your order is complete.','Bundles arrive in five mins.','We are running again.','New bundles are in stock.','We are back online.','Visit evil.test for current bundles.'])await assert.rejects(()=>draftSms({brief:brief()},response([text])),/safe campaign/);
 await assert.rejects(()=>draftSms({brief:{...brief(),network:'mtn'}},response(['Telecel bundles are here.'])),/safe campaign/);
 await assert.rejects(()=>draftSms({brief:{...brief(),officialLink:'channel'}},response(['Hello'])),/Confirm the official/);
 await assert.rejects(()=>draftSms({brief:{...brief(),goal:'offer'}},response(['Hello'])),/verified terms/);
 const verified={...brief(),goal:'offer',verifiedOffer:true,keyFacts:'A verified 10% discount applies today.'};
 assert.equal((await draftSms({brief:verified},response(['A verified 10% discount applies today.']))).sent,false);
});
