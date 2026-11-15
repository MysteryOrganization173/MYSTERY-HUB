import assert from 'node:assert/strict';
import {test} from 'node:test';
import {deriveContacts,contactFilters,matchesContact,directContactOrder} from '../../services/contactHubPolicy.js';
import {contactExport,contactExportPreview} from '../../services/contactHubService.js';
import {contactOrder,contactUser,contactNow} from './fixtures/contactHub.js';
import {contactV2Dataset} from './fixtures/contactHubV2.js';
const dataset=()=>{const d=contactV2Dataset();return {d,rows:deriveContacts(d.users,d.orders,[],contactNow,{storeOrderIds:d.storeIds,guestPayers:d.payers})};};
test('direct scope rejects every storefront signal, including malformed context and contradictory finance evidence',()=>{
 const {d,rows}=dataset();for(const id of ['seller-only','malformed','reference-only','finance-only'])assert.ok(!rows.some(r=>r.source==='registered'&&r.id===id),id);
 const mixed=rows.find(r=>r.source==='registered'&&r.id==='mixed')!;assert.equal(mixed.purchases,1);assert.equal(mixed.spendingMinor,1000);assert.equal(mixed.daysInactive,40);assert.ok(!mixed.vip.includes('repeat'));
 for(const o of d.orders.filter(o=>o.id.startsWith('reseller')))assert.equal(directContactOrder(o,d.storeIds),false);
 assert.ok(rows.some(r=>r.source==='registered'&&r.id==='owner-direct'));
 assert.ok(!rows.some(r=>r.phone==='+233599990001'));
});
test('all registered-order and guest recipients survive independently of purchaser identity',()=>{
 const {rows}=dataset();const recipient=rows.find(r=>r.source==='recipient'&&r.id==='+233599990002')!;
 assert.equal(recipient.purchases,3);assert.deepEqual(recipient.provenance,['guest_recipient','registered_order_recipient']);assert.equal(recipient.spendingMinor,0);assert.deepEqual(recipient.vip,[]);
 assert.equal(rows.find(r=>r.source==='guest'&&r.phone===recipient.phone)!.purchases,1);
 const unified=rows.find(r=>r.source==='directory'&&r.phone===recipient.phone)!;assert.ok(unified.provenance.includes('registered_account'));assert.equal(unified.accountIds.length,1);assert.equal(unified.purchases,3);assert.equal(unified.spendingMinor,0);
 assert.ok(rows.some(r=>r.source==='registered'&&r.id==='zero-v2'&&r.purchases===0));
 const nums=contactExport(rows.filter(r=>r.source==='directory'),'administrative','txt').split('\n');assert.equal(new Set(nums).size,nums.length);assert.ok(nums.includes(recipient.phone!));assert.ok(!nums.includes('+233599990001'));
});
test('verified guest payer is separate from recipient and never rewrites account purchases',()=>{
 const {rows}=dataset(),payer=rows.find(r=>r.source==='payer')!;assert.equal(payer.name,'Verified payer');assert.equal(payer.phone,'+233599990003');assert.equal(payer.purchases,1);assert.equal(payer.spendingMinor,1000);assert.deepEqual(payer.vip,[]);
 assert.ok(rows.find(r=>r.source==='directory'&&r.phone===payer.phone)!.provenance.includes('verified_guest_payer'));
 assert.equal(rows.some(r=>r.source==='payer'&&r.phone==='+233599990001'),false);
});
test('direct scope alone controls stars and calendar-independent retention intervals',()=>{
 const u=contactUser('direct'),orders=[...Array.from({length:5},(_,i)=>contactOrder('direct',90+i)),...Array.from({length:10},()=>contactOrder('direct',0,{store_context:{} as any,amount:99999999}))];
 const rows=deriveContacts([u],orders,[],contactNow),buyer=rows.find(r=>r.source==='registered')!;assert.equal(buyer.purchases,5);assert.equal(buyer.spendingMinor,5000);assert.equal(buyer.daysInactive,90);assert.deepEqual(buyer.vip,['repeat','frequent','high_value','formerly_active']);
 for(const inactiveDays of [14,30,60,90])assert.ok(matchesContact(buyer,contactFilters({source:'registered',segment:'inactive',inactiveDays})));
});
test('administrative recovery is independent from outreach permission and CSV retains provenance',()=>{
 const {rows}=dataset();const f=contactFilters({}),all=rows.filter(r=>matchesContact(r,f));const preview=contactExportPreview(all,all.length,'administrative',f);assert.ok(preview.uniqueNumbers>0);assert.ok(preview.expiresAt);
 assert.ok(contactExport(all,'administrative','csv').includes('registered_order_recipient'));assert.equal(contactExport(all,'marketing','txt'),'');assert.ok(contactExport(all,'administrative','comma').includes(','));
});
test('refund exclusion never erases reseller-only account source evidence',()=>{
 const o=contactOrder('store-only',1,{store_context:{} as any});const rows=deriveContacts([contactUser('store-only',{phone:'0599990020'})],[o],[],contactNow,{metricExcludedIds:new Set([o.id])});assert.equal(rows.length,0);
});
test('multiple evidenced phones on an account-linked guest payer key remain separate',()=>{
 const orders=[contactOrder(null,2),contactOrder(null,1)],payers=orders.map((o,i)=>({order_id:o.id,buyer_key:'user:linked',payer_name:'Payer',payer_phone:i?'0599990031':'0599990030'}));
 const rows=deriveContacts([],orders,[],contactNow,{guestPayers:payers});assert.equal(rows.filter(r=>r.source==='payer').length,2);for(const phone of ['+233599990030','+233599990031'])assert.ok(rows.some(r=>r.source==='directory'&&r.phone===phone));assert.ok(rows.filter(r=>r.source==='payer').every(r=>r.purchases===1));
});
test('user-only SMS suppression follows the account into its directory number without becoming consent',()=>{
 const u=contactUser('optout',{phone:'0599990040'}),o=contactOrder('optout',1);const rows=deriveContacts([u],[o],[{user_id:u.id,channel:'sms',status:'unsubscribed',contact:'0599990041',contact_normalized:'0599990041'} as any],contactNow);
 assert.equal(rows.find(r=>r.source==='directory'&&r.phone==='+233599990040')!.smsPermission,'sms_unsubscribed');assert.ok(rows.every(r=>!r.supportReviewEligible));assert.ok(contactExport(rows.filter(r=>r.source==='directory'),'administrative','txt').includes('+233599990040'));
});
test('unified search resolves related account names without merging the directory identity',()=>{
 const {rows}=dataset(),f=contactFilters({q:'zero-v2'});const found=rows.filter(r=>matchesContact(r,f));assert.equal(found.length,1);assert.equal(found[0].source,'directory');assert.equal(found[0].name,null);assert.equal(found[0].spendingMinor,0);
});

import {manualSmsTemplate,smsLink} from '../../../src/utils/manualSms.js';
test('all editable SMS presets are preparation only and invalid destinations cannot open a composer',()=>{
 for(const kind of ['support','return','interruption','delay','assistance','availability'] as const)assert.ok(manualSmsTemplate(kind,'https://mysterybundlehub.com').length>0);
 assert.equal(manualSmsTemplate('custom','https://mysterybundlehub.com'),'');assert.equal(manualSmsTemplate('channel','https://mysterybundlehub.com'),'');assert.throws(()=>smsLink('bad','draft'),/valid Ghana/);
});
