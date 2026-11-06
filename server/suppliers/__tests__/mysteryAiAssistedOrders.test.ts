import assert from 'node:assert/strict';
import {test} from 'node:test';
import {aiDataChoices,confirmAiDataChoice,maskAiRecipient,parseAiDataRequest} from '../../../src/services/mysteryAiOrders';

test('exact direct Data request and clarification retain only the active recipient',()=>{
 const initial=parseAiDataRequest('I need data for +233 (24) 123-4567')!;
 assert.equal(initial.recipient,'0241234567');
 const network=parseAiDataRequest('MTN',initial)!;
 const size=parseAiDataRequest('5GB',network)!;
 assert.deepEqual([size.network,size.size,size.recipient],['mtn','5GB','0241234567']);
 assert.equal(parseAiDataRequest('I want 3GB AirtelTigo',size)?.recipient,undefined);
 assert.equal(parseAiDataRequest('MTN',undefined),null);
});

test('malformed or multiple recipients cannot use a previously supplied number',()=>{
 const first=parseAiDataRequest('Buy MTN 5GB for 024 123 4567')!;
 for(const bad of ['024 123 4567 9','012 123 4567','024 123 4567 and 027 123 4567','024.123.4567','024/123/4567']){
   const question='for '+bad;
   const draft=parseAiDataRequest(question,first)??parseAiDataRequest('Buy MTN 5GB '+question,first)!;
   assert.equal(draft.invalidRecipient,true);
   assert.equal(draft.recipient,undefined);
   assert.equal(parseAiDataRequest('5GB',draft)?.invalidRecipient,true);
   assert.equal(parseAiDataRequest('skip number',draft)?.invalidRecipient,false);
   assert.doesNotMatch(maskAiRecipient(question),/4567/);
 }
 assert.equal(maskAiRecipient('recipient:024.123.4567'), 'recipient:[number hidden]');
 assert.equal(parseAiDataRequest('I need MTN 5GB for 0241')?.invalidRecipient,true);
});

test('support, pricing questions and other purchase types never create direct bundle choices',()=>{
 for(const query of ['Where is my MTN 5GB order status?','I need help with my MTN 5GB order','I need my MTN 5GB order','I need to confirm my MTN 5GB payment','What does 5GB MTN cost?','Buy 5GB MTN instant','Buy 5GB MTN airtime','Do not buy 5GB MTN']){
   assert.equal(parseAiDataRequest(query),null,query);
 }
 const manyNetworks=parseAiDataRequest('Buy MTN or Telecel 5GB')!;
 assert.equal(parseAiDataRequest('5GB',manyNetworks)?.network,undefined);
 assert.equal(parseAiDataRequest('5GB',manyNetworks)?.ambiguousNetwork,true);
 assert.equal(parseAiDataRequest('MTN',manyNetworks)?.network,'mtn');
 const manySizes=parseAiDataRequest('Buy MTN 5GB or 10GB')!;
 assert.equal(parseAiDataRequest('Telecel',manySizes)?.size,undefined);
 assert.equal(parseAiDataRequest('Telecel',manySizes)?.ambiguousSize,true);
});

test('real HTTP adapter accepts only exact active products at server prices and refreshes before handoff',async()=>{
 const oldFetch=globalThis.fetch;
 const current={id:'mtn-5gb',network:'mtn',dataAmount:'5GB',isActive:true,currency:'GHS',amountPesewas:2345};
 let rows:unknown[]=[
   current,
   {...current,id:'mtn-1gb',dataAmount:'1GB',amountPesewas:501},
   {...current,id:'mtn-2gb',dataAmount:'2GB',isActive:false},
   {...current,id:'invented-5gb'},
   {...current,id:'mtn-3gb',dataAmount:'3GB',network:'telecel'},
 ];
 globalThis.fetch=async(input,init)=>{
   assert.match(String(input),/\/api\/commercial\/products$/);
   assert.equal(init?.method,'GET');
   assert.deepEqual(init?.headers,{});
   return Response.json({products:rows});
 };
 try {
   const signal=new AbortController().signal;
   const exact=await aiDataChoices(parseAiDataRequest('I want MTN 5GB')!,signal);
   assert.deepEqual(exact.choices,[{id:'mtn-5gb',network:'mtn',dataAmount:'5GB',priceGhc:23.45}]);
   const cheapest=await aiDataChoices(parseAiDataRequest('Show me the cheapest MTN option')!,signal);
   assert.deepEqual(cheapest.choices.map(x=>x.id),['mtn-1gb','mtn-5gb']);
   assert.equal((await confirmAiDataChoice(exact.choices[0],signal))?.id,'mtn-5gb');
   rows=[{...current,amountPesewas:9999}];
   assert.equal(await confirmAiDataChoice(exact.choices[0],signal),undefined);
   rows=[{...current,isActive:false}];
   assert.equal(await confirmAiDataChoice(exact.choices[0],signal),undefined);
   rows=[];
   assert.equal(await confirmAiDataChoice(exact.choices[0],signal),undefined);
 } finally {
   globalThis.fetch=oldFetch;
 }
});
