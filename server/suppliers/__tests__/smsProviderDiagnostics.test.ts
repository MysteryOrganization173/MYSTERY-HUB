import assert from 'node:assert/strict';import {test} from 'node:test';
import {ArkeselClient,arkeselConfig,senderBlocked,senderFingerprint,validationFields} from '../../sms/arkesel.js';
const config=()=>arkeselConfig({ARKESEL_API_KEY:'synthetic-read-key',ARKESEL_WEBHOOK_SECRET:'synthetic-signing',ARKESEL_SENDER_ID:'MYSTERY HUB',ARKESEL_SMS_ENABLED:'true',ARKESEL_TEST_ONLY:'false'});
const json=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
test('sender approval check uses only documented read-only GET and retains whitelisted metadata',async()=>{
 let calls=0;const api=new ArkeselClient(config,async(url,init)=>{calls++;assert.equal(url,'https://sms.arkesel.com/api/v3/sender-ids/MYSTERY%20HUB/status');assert.equal(init?.method,'GET');assert.equal(init?.body,undefined);return json({status:'success',data:{sender_id:'MYSTERY HUB',verification_status:'approved',verification_message:'Your sender ID has been approved.',organization_name:'PRIVATE ORG',comment:'PRIVATE TEXT'}});});
 const result=await api.senderStatus();assert.equal(result.status,'approved');assert.equal(result.documentsRequired,false);assert.equal(calls,1);for(const value of ['PRIVATE','synthetic-read-key','synthetic-signing'])assert.ok(!JSON.stringify(result).includes(value));
});
test('current sender/config binding prevents stale diagnostics and negative sender states block claims',()=>{
 const c=config(),state={sender:c.sender,sourceFingerprint:senderFingerprint(c),status:'pending',documentsRequired:false};assert.equal(senderBlocked(state,c),true);assert.equal(senderBlocked({...state,status:'approved'},c),false);assert.equal(senderBlocked(state,{...c,sender:'OTHER'}),false);assert.equal(senderBlocked(state,{...c,key:'changed'}),false);assert.equal(senderBlocked({...state,status:'unverified'},c),false);
});
test('only the documented positive documentation-required message triggers that classification',async()=>{
 for(const [message,required] of [['Your sender ID is approved but requires further documentation. Please submit your sender ID whitelisting documents and letter of authorization to the support team.',true],['This sender does not require documentation.',false]] as const){const api=new ArkeselClient(config,async()=>json({status:'success',data:{sender_id:'MYSTERY HUB',verification_status:'approved',verification_message:message}}));assert.equal((await api.senderStatus()).documentsRequired,required);}
});
test('not-found sender remains unverified and explicitly accounts for documented shared-sender ambiguity',async()=>{
 const result=await new ArkeselClient(config,async()=>json({status:'error',message:'PRIVATE provider account message'},404)).senderStatus();assert.equal(result.status,'unverified');assert.equal(result.reason,'not_found_or_shared');assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
test('422 errors retain field names only, preserve failure semantics and never retry a POST',async()=>{
 let calls=0;const api=new ArkeselClient(config,async()=>{calls++;return json({status:'error',errors:{sender:['PRIVATE SECRET'], 'recipients.0':['+233591234567'],'unsafe_private_key':['SECRET']},message:'PRIVATE provider response'},422);});
 await assert.rejects(()=>api.send('Synthetic message',['+233591234567']),(e:any)=>{assert.equal(e.code,'VALIDATION');assert.equal(e.uncertain,false);assert.deepEqual(e.details,{httpStatus:422,fields:['recipients','sender']});assert.ok(!JSON.stringify(e).includes('PRIVATE'));assert.ok(!JSON.stringify(e).includes('233591234567'));return true;});assert.equal(calls,1);
 assert.deepEqual(validationFields({errors:{'callback_url':['PRIVATE'],message:['PRIVATE'],token:['PRIVATE']}}),['callback_url','message']);
});
test('generic 422 message prose cannot impersonate a field error', async () => {
 const api = new ArkeselClient(config, async () => json({
  status:'error', message:'Your SMS message was rejected. Review the sender and recipient.',
 },422));
 await assert.rejects(() => api.send('Synthetic message',['+233591234567']), {
  code:'VALIDATION', uncertain:false, details:{httpStatus:422,fields:[]},
 });
 assert.deepEqual(validationFields({message:'The message field is required.'}), ['message']);
 assert.deepEqual(validationFields({errors:{'sender.private@example.test':'PRIVATE'}}), []);
});
