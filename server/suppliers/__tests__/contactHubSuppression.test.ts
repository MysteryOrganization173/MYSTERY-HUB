import assert from 'node:assert/strict';
import {test} from 'node:test';
import {contactWithdrawalSql} from '../../services/contactHubSuppression.js';
import {deriveContacts,contactFilters,matchesContact} from '../../services/contactHubPolicy.js';
import {contactExport,contactExportPreview} from '../../services/contactHubService.js';
import {contactUser,contactOrder,contactNow} from './fixtures/contactHub.js';

test('SMS withdrawals follow the account phone and every separate direct-number relationship',()=>{
 const users=[contactUser('buyer',{phone:'0599990060'}),contactUser('shared',{phone:'0599990060'})];
 const orders=[contactOrder('buyer',1),contactOrder('shared',1),contactOrder(null,1,{recipient_phone:'0599990060'})];
 const rows=deriveContacts(users,orders,[],contactNow,{smsWithdrawals:[{phone:'+233599990061',user_id:'buyer',purpose:'transactional'}]});
 for(const r of rows.filter(r=>r.phone==='+233599990060')){assert.deepEqual(r.smsRestrictions,['transactional']);assert.equal(r.supportReviewEligible,false);}
 const registered=rows.filter(r=>r.source==='registered');assert.equal(registered.length,2);assert.ok(registered.every(r=>r.purchases===1));
 assert.ok(contactExport(rows.filter(r=>r.source==='directory'),'administrative','txt').includes('+233599990060'));
 assert.ok(contactExport(registered,'administrative','csv').includes('transactional'));
 assert.equal(contactExportPreview(registered,2,'support_notice',contactFilters({source:'registered'})).uniqueNumbers,0);
});

test('purpose restrictions are visible without treating marketing withdrawal as operational withdrawal',()=>{
 const rows=deriveContacts([contactUser('buyer',{phone:'0599990060'})],[contactOrder('buyer',1)],[],contactNow,{smsWithdrawals:[{phone:'+233599990060',user_id:null,purpose:'marketing'}]});
 const buyer=rows.find(r=>r.source==='registered')!;assert.equal(buyer.supportReviewEligible,true);assert.deepEqual(buyer.smsRestrictions,['marketing']);
 assert.ok(matchesContact(buyer,contactFilters({source:'registered',permission:'suppressed'})));
 assert.equal(matchesContact(buyer,contactFilters({source:'registered',permission:'unknown'})),false);
 assert.equal(contactExport([buyer],'marketing','txt'),'');
 const operational=deriveContacts([contactUser('buyer',{phone:'0599990060'})],[contactOrder('buyer',1)],[],contactNow,{smsWithdrawals:[{phone:'+233599990060',user_id:null,purpose:'operational'}]}).find(r=>r.source==='registered')!;
 assert.equal(operational.supportReviewEligible,false);
});

test('optional SMS tables do not create a schema dependency and evidence errors fail closed',async()=>{
 const empty=await contactWithdrawalSql({query:async()=>({rows:[{consents:false,permissions:false}]})} as any);assert.match(empty,/WHERE FALSE/);assert.ok(!empty.includes('FROM mysteryhub_sms.'));
 await assert.rejects(()=>contactWithdrawalSql({query:async()=>{throw Error('synthetic evidence unavailable');}} as any),/evidence unavailable/);
});
