import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CONTACT_SORTS,DEFAULT_CONTACT_FILTERS} from '../../../shared/contactHub.js';
import {contactFilters,deriveContacts,matchesContact,sortContacts,purposeEligible,CONTACT_EXPORT_LIMIT} from '../../services/contactHubPolicy.js';
import {contactExport,contactExportPreview} from '../../services/contactHubService.js';
import {contactDataset,contactNow,contactUser,contactOrder,contactWaitlist} from './fixtures/contactHub.js';
import {manualSmsTemplate,smsEstimate,channelDestination,smsLink} from '../../../src/utils/manualSms.js';
const data=()=>{const d=contactDataset();return deriveContacts(d.users,d.orders,d.waitlists,contactNow);};
const registered=(f:Record<string,unknown>={})=>{const filter=contactFilters({source:'registered',...f});return sortContacts(data().filter(r=>matchesContact(r,filter)),filter.sort);};
test('default contract matches shared defaults; invalid filters rejected',()=>{
 assert.deepEqual(contactFilters({}),DEFAULT_CONTACT_FILTERS);assert.deepEqual(contactFilters(DEFAULT_CONTACT_FILTERS as any),DEFAULT_CONTACT_FILTERS);
 for(const bad of [null,[],{unknown:true},{q:['phone']},{source:'owner'},{page:0},{limit:10001},{minPurchases:2,maxPurchases:1},{firstFrom:'2026-02-30'},{lastFrom:'2026-11-02',lastTo:'2026-11-01'},{source:'guest',segment:'repeat'},{source:'guest',vip:'high_value'}])assert.throws(()=>contactFilters(bad as any));
});
test('registered buyer identity is user_id only, separate from every recipient',()=>{
 const rows=data(),repeat=rows.find(r=>r.id==='repeat')!,guest=rows.find(r=>r.source==='guest')!,one=rows.find(r=>r.id==='one')!;
 assert.equal(repeat.purchases,2);assert.equal(repeat.spendingMinor,2000);assert.equal(guest.purchases,2);assert.equal(guest.name,null);assert.equal(guest.phone,repeat.phone);assert.equal(one.phone,'+233591234567');assert.equal(one.purchases,1);assert.equal(guest.vip.length,0);assert.equal(rows.some(r=>r.id==='staff'),false);assert.ok(repeat.sharedPhoneRecords>=2);
 assert.equal(JSON.stringify(rows).includes('Unrelated guest purchaser'),false);
});
test('two account identities sharing a number remain separate; guest matches never merge',()=>{
 const rows=deriveContacts([contactUser('a',{phone:'0591234567'}),contactUser('b',{phone:'233591234567'})],[contactOrder('a',1),contactOrder('b',2),contactOrder(null,1,{recipient_phone:'0591234567'})],[],contactNow);
 const identities=rows.filter(r=>r.source==='registered');assert.equal(identities.length,2);assert.ok(identities.every(r=>r.purchases===1));const f=contactFilters({source:'registered'}),preview=contactExportPreview(rows.filter(r=>matchesContact(r,f)),2,'administrative',f);assert.equal(preview.uniqueNumbers,1);assert.equal(preview.duplicatesRemoved,1);
});
test('all required buyer cohorts and configurable inactivity intervals use delivery, not attempts',()=>{
 const cases:Record<string,string[]>={no_purchases:['zero','invalid'],one_time:['one','disabled'],repeat:['repeat','frequent'],frequent:['frequent'],recent:['one'],inactive:['repeat','disabled'],at_risk:['frequent']};
 for(const [segment,ids]of Object.entries(cases))assert.deepEqual(new Set(registered({segment}).map(r=>r.id)),new Set(ids),segment);
 assert.equal(registered({segment:'inactive',inactiveDays:14}).length,3);assert.equal(registered({segment:'inactive',inactiveDays:60}).length,1);
 assert.equal(registered({segment:'high_value'})[0].id,'frequent');assert.ok(registered({vip:'formerly_active'}).some(r=>r.id==='repeat'));
 const d=contactDataset();d.orders.push(contactOrder('repeat',0,{status:'pending_payment',payment_status:'pending'}));assert.equal(deriveContacts(d.users,d.orders,[],contactNow).find(r=>r.id==='repeat')!.daysInactive,30);
 d.orders.push(contactOrder('repeat',0));assert.equal(deriveContacts(d.users,d.orders,[],contactNow).find(r=>r.id==='repeat')!.daysInactive,0);
});
test('missing dates, refunds, review, failed payments, operator orders and fixtures never inflate spending',()=>{
 const base=contactOrder('buyer',1);const variants:any[]=[{payment_status:'pending'},{status:'failed'},{status:'cancelled'},{status:'refund_pending'},{payment_provider:'complimentary',payment_status:'not_required'},{payment_provider:'admin_external',payment_status:'recorded'},{paid_at:null},{delivered_at:null},{paid_at:'invalid'},{delivered_at:'2099-01-01'},{resolution_json:{stage:'resolved',outcome:'paystack_refund'}},{resolution_json:{stage:'resolved',outcome:'wallet_refund'}},{resolution_json:{stage:'resolved',outcome:'external_compensation'}},{resolution_json:{stage:'under_review'}},{manual_review:true},{marketplace_status:'refunded'}];
 const orders=variants.map((v,i)=>({...base,id:'bad-'+i,...v}));const fixture={...base,id:'registered-fixture'};
 const rows=deriveContacts([contactUser('buyer')],[...orders,fixture,base],[],contactNow,{syntheticIds:new Set([fixture.id])});assert.equal(rows.find(r=>r.id==='buyer')!.purchases,1);assert.equal(rows.find(r=>r.id==='buyer')!.spendingMinor,1000);
});
test('archived purchases count, all sorting and advanced filters apply beyond any page',()=>{
 assert.equal(registered({minPurchases:2,network:'telecel'})[0].purchases,2);
 assert.equal(registered({q:'059 123 4567'})[0].id,'one');assert.deepEqual(registered({q:'ama'}).map(r=>r.id),['one']);assert.equal(registered({status:'disabled'})[0].id,'disabled');assert.equal(registered({phone:'invalid'})[0].id,'invalid');
 assert.equal(registered({minSpending:9000})[0].id,'frequent');assert.equal(registered({minDays:30,maxDays:60}).length,1);
 assert.equal(registered({firstFrom:'2026-09-01',firstTo:'2026-09-30'})[0].id,'repeat');
 for(const sort of CONTACT_SORTS){const rows=registered({sort});assert.equal(rows.length,6);assert.deepEqual(rows,registered({sort}));}
 assert.equal(registered({sort:'spending'})[0].id,'frequent');assert.equal(registered({sort:'purchases'})[0].id,'frequent');assert.equal(registered({sort:'inactive'})[0].id,'disabled');
});
test('SMS permission is never manufactured from purchases or push consent; matching SMS opt-out withheld',()=>{
 const d=contactDataset();const rows=deriveContacts(d.users,d.orders,[contactWaitlist('one','+233591234567')],contactNow,{supportRestrictedIds:new Set(['frequent'])});
 assert.equal(rows.find(r=>r.id==='one')!.smsPermission,'sms_unsubscribed');assert.equal(rows.find(r=>r.id==='one')!.supportReviewEligible,false);assert.equal(rows.find(r=>r.id==='frequent')!.supportReviewEligible,false);assert.equal(rows.find(r=>r.id==='zero')!.supportReviewEligible,false);assert.equal(rows.find(r=>r.id==='disabled')!.supportReviewEligible,false);
 assert.ok(rows.every(r=>!purposeEligible(r,'marketing')));assert.equal(rows.find(r=>r.id==='repeat')!.supportReviewEligible,true);
});
test('CSV is narrow/escaped, TXT deduplicates normalized numbers, purpose scopes never include guests as buyers',()=>{
 const rows=data(),r=rows.filter(r=>r.source==='registered'),guest=rows.filter(r=>r.source==='guest');
 r[0].name=' =HYPERLINK("evil")\n,malicious';r[0].email='@evil.test';
 const csv=contactExport(r,'administrative','csv');assert.ok(csv.includes("\"'=HYPERLINK("));assert.ok(csv.includes("\"'@evil.test\""));assert.ok(!csv.includes('NEVER-EXPORT-PASSWORD'));assert.ok(!csv.includes('supplier_response'));assert.ok(!csv.includes('Unrelated guest purchaser'));
 const txt=contactExport(r,'administrative','txt').split('\n');assert.ok(txt.every(n=>/^\+233[235]\d{8}$/.test(n)));assert.equal(new Set(txt).size,txt.length);assert.equal(contactExport(rows,'marketing','txt'),'');assert.equal(contactExport(guest,'guest_reference','txt'),'+233241234567');
 const preview=contactExportPreview(r,r.length,'administrative',contactFilters({source:'registered'}));assert.equal(preview.invalid,1);assert.equal(preview.missing,1);assert.equal(preview.uniqueNumbers,4);assert.equal(preview.total,6);
 assert.throws(()=>contactExportPreview([],CONTACT_EXPORT_LIMIT+1,'administrative',contactFilters({source:'registered'})),/Narrow the filters/);
});
test('SMS preparation has accurate GSM/Unicode estimates and no sending or invented channel',()=>{
 assert.deepEqual(smsEstimate('a'.repeat(160)),{characters:160,units:160,encoding:'GSM-7',segments:1});assert.equal(smsEstimate('a'.repeat(161)).segments,2);assert.equal(smsEstimate('^'.repeat(80)).units,160);assert.equal(smsEstimate('🎁'.repeat(36)).segments,2);assert.equal(smsEstimate('^'.repeat(153)).segments,3);assert.equal(smsEstimate('🎁'.repeat(67)).segments,3);
 assert.equal(manualSmsTemplate('channel','https://example.test'),'');for(const bad of ['javascript:alert(1)','https://evil.test/channel/1234567890','https://whatsapp.com/channel/1234567890?x=evil','https://user@whatsapp.com/channel/1234567890'])assert.equal(channelDestination(bad),null);
 const link='https://whatsapp.com/channel/1234567890';assert.equal(channelDestination(link),link);assert.ok(manualSmsTemplate('channel','https://example.test',link).includes(link));assert.ok(manualSmsTemplate('support','https://example.test').includes('https://example.test/help'));assert.ok(smsLink('+233591234567','Hello & thanks').includes('body=Hello%20%26%20thanks'));
});
