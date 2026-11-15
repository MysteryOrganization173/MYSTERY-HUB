import assert from 'node:assert/strict';
import {test,before,after,beforeEach,mock} from 'node:test';
import express from 'express';
import {contactHubRouter} from '../../routes/contactHubApi.js';
import {AuthStore} from '../../db/authStore.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {AdminAuditStore} from '../../db/adminAuditStore.js';
import {FinanceStore} from '../../db/financeStore.js';
import {WaitlistStore} from '../../db/waitlistStore.js';
import {ContactHubStore} from '../../db/contactHubStore.js';
import {contactDataset} from './fixtures/contactHub.js';
let server:any,base:string;
before(async()=>{assert.equal(process.env.DATABASE_URL,undefined);const app=express();app.use(express.json({limit:'32kb'}));app.use('/contacts',contactHubRouter);server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}/contacts`;});
after(async()=>{await new Promise<void>(r=>server.close(r));});
beforeEach(async()=>{mock.restoreAll();AuthStore._clearDevStore();OrdersStore.clearDevStore();FinanceStore._reset();WaitlistStore._clearDevStore();AdminAuditStore._clearDevStore();const d=contactDataset();for(const u of d.users)await AuthStore.createUser({id:u.id,name:u.name,email:u.email,phone:u.phone,passwordHash:u.password_hash,role:u.role,status:u.status});for(const o of d.orders)await OrdersStore.createOrder(o);for(const id of ['staff','one','disabled'])await AuthStore.createSession(id,'contact-token-'+id);});
const request=(path:string,body:unknown={},token='contact-token-staff')=>fetch(base+'/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
for(const token of ['', 'not-a-session','contact-token-one','contact-token-disabled'])test('all private operations deny unauthorized identity '+token,async()=>{
 for(const path of ['query','profile','preview','export'])assert.ok([401,403].includes((await request(path,{},token)).status));
});
test('revoked or disabled Admin cannot retrieve contacts or exports',async()=>{
 await AuthStore.revokeSession('contact-token-staff');assert.equal((await request('query')).status,401);
 await AuthStore.createSession('staff','disabled-admin-token');await AuthStore.updateUserStatus('staff','disabled');assert.equal((await request('query',{},'disabled-admin-token')).status,403);
});
test('authorized list, pagination, guest separation, profile and malformed input are real backend behavior',async()=>{
 const r=await request('query',{source:'registered',limit:1,page:2});assert.equal(r.status,200);assert.match(r.headers.get('cache-control')!,/private, no-store/);const data=await r.json();assert.equal(data.total,6);assert.equal(data.rows.length,1);assert.ok(!JSON.stringify(data).includes('NEVER-EXPORT-PASSWORD'));
 const buyer=await (await request('profile',{source:'registered',id:'repeat'})).json();assert.equal(buyer.contact.purchases,2);assert.equal(buyer.orders.length,2);
 const guest=await (await request('profile',{source:'guest',id:'+233241234567'})).json();assert.equal(guest.contact.name,null);assert.equal(guest.contact.purchases,2);assert.match(guest.warning,/purchaser/i);
 for(const body of [{source:'staff'},{q:['x']},{minSpending:-1},{page:0}])assert.equal((await request('query',body)).status,400);
 for(const body of [{source:'registered',id:'staff'},{source:'registered',id:'../one'},{source:'guest',id:'123'}])assert.ok([400,404].includes((await request('profile',body)).status));
});
test('export preview/confirmation download whole dataset and audit; unknown consent exports no marketing numbers',async()=>{
 const filters={source:'registered',limit:1,page:2,phone:'valid'},preview=await (await request('preview',{filters,purpose:'administrative'})).json();assert.equal(preview.uniqueNumbers,4);
 const txt=await request('export',{filters,purpose:'administrative',format:'txt',expectedRevision:preview.revision,confirmed:true});assert.equal(txt.status,200);assert.match(txt.headers.get('content-disposition')!,/attachment/);assert.match(txt.headers.get('cache-control')!,/no-store/);assert.equal((await txt.text()).split('\n').length,4);
 const audit=(await AdminAuditStore.findRecent())[0];assert.equal(audit.action,'contact_export_prepared');assert.ok(!audit.metadata_safe_json!.includes('+233'));
 const marketing=await (await request('preview',{filters:{source:'registered'},purpose:'marketing'})).json();assert.equal(marketing.uniqueNumbers,0);const empty=await request('export',{filters:{source:'registered'},purpose:'marketing',format:'txt',expectedRevision:marketing.revision,confirmed:true});assert.equal(await empty.text(),'');
 assert.equal((await request('preview',{filters:{source:'guest'},purpose:'marketing'})).status,200);
 assert.equal((await request('export',{filters,format:'txt',purpose:'administrative',confirmed:false,expectedRevision:preview.revision})).status,400);
});
test('database/report failure produces an error rather than an empty contact list',async()=>{
 mock.method(ContactHubStore,'query',async()=>{throw Error('PRIVATE phone or connection detail');});
 const r=await request('query');assert.equal(r.status,503);const text=await r.text();assert.ok(!text.includes('PRIVATE'));assert.ok(!text.includes('rows'));
});
test('export rate limit is enforced without changing customer financial data',async()=>{
 const before=await FinanceStore.adminOperations();const statuses=[];for(let i=0;i<7;i++)statuses.push((await request('export',{})).status);assert.ok(statuses.includes(429));assert.deepEqual(await FinanceStore.adminOperations(),before);
});
