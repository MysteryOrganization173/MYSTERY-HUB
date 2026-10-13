import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { adminRouter } from '../../routes/adminApi.js';
import { ultraRouter } from '../../routes/websiteUltraApi.js';
import { AuthStore } from '../../db/authStore.js';
import { WebsiteUltraStore } from '../../db/websiteUltraStore.js';
import { ultraCustomerWhatsApp, ultraReferenceWebsite } from '../../../src/utils/ultraEnquiryPresentation.js';
import { readFileSync } from 'node:fs';
let server: Server, base: string;
const brief = {businessName:'Synthetic Studio',businessType:'Design',contactName:'Synthetic Owner',phone:'0241234567',email:'synthetic@example.test',existingDomain:'no',estimatedPages:4,featuresRequirements:'Original full project brief',preferredStyle:'Minimal blue',projectNotes:'Original notes',referenceWebsite:'https://example.test/design'};
before(async () => {
  delete process.env.DATABASE_URL; process.env.NODE_ENV='test';
  const app=express(); app.use(express.json()); app.use('/api/admin',adminRouter); app.use('/api/website-ultra',ultraRouter);
  server=await new Promise<Server>(resolve=>{const running=app.listen(0,'127.0.0.1',()=>resolve(running));});base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
beforeEach(async()=>{
  AuthStore._clearDevStore(); WebsiteUltraStore.clearDevStore();
  for(const role of ['admin','customer'] as const){await AuthStore.createUser({id:role,name:role,email:`${role}@example.test`,phone:null,passwordHash:'synthetic-not-a-password',role});await AuthStore.createSession(role,`${role}-fixture-session`);}
});
const request=(path:string,token='admin-fixture-session')=>fetch(base+'/api/admin/websites/ultra-enquiries'+path,{headers:token?{Authorization:`Bearer ${token}`}:{}});
test('admin reads persisted guest submission and exact full original brief without modifying it',async()=>{
  const submitted=await fetch(base+'/api/website-ultra/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(brief)});assert.equal(submitted.status,201);
  const {reference}=await submitted.json();const before=await WebsiteUltraStore.findByReference(reference);
  const list=await request('');assert.equal(list.headers.get('cache-control'),'no-store');assert.equal(list.status,200);assert.equal((await list.json()).enquiries[0].user_id,null);
  const detail=await request('/'+reference);assert.equal(detail.status,200);assert.deepEqual((await detail.json()).enquiry,before);assert.deepEqual(await WebsiteUltraStore.findByReference(reference),before);
});
test('guest, invalid session and ordinary customer cannot list or read private enquiries',async()=>{
  const record=await WebsiteUltraStore.create(brief);
  for(const suffix of ['', '/'+record.reference])for(const [token,status] of [['',401],['invalid',401],['customer-fixture-session',403]] as const)assert.equal((await request(suffix,token)).status,status);
});
test('search covers reference, business, type, name, phone and email; pagination is bounded and stable',async()=>{
  for(let index=0;index<27;index++)await WebsiteUltraStore.create({...brief,businessName:`Synthetic Studio ${index}`});
  const first=await (await request('?limit=25')).json(),second=await (await request('?limit=25&offset=25')).json();assert.equal(first.total,27);assert.equal(first.enquiries.length,25);assert.equal(second.enquiries.length,2);assert.equal(new Set([...first.enquiries,...second.enquiries].map(x=>x.id)).size,27);
  for(const search of ['SYNTHETIC STUDIO','Design','Synthetic Owner','0241234567','synthetic@example.test'])assert.equal((await (await request('?search='+encodeURIComponent(search))).json()).total,27);
  assert.equal((await (await request('?search='+first.enquiries[0].reference)).json()).total,1);assert.equal((await (await request('?search=no-match')).json()).total,0);
  for(const query of ['?limit=0','?offset=-1','?limit=101','?search='+('a'.repeat(101)),'?search[x]=bad'])assert.equal((await request(query)).status,400);
});
test('missing/invalid detail references return safe errors',async()=>{assert.equal((await request('/MH-ULTRA-12345678')).status,404);assert.equal((await request('/bad')).status,400);});
test('literal wildcard search does not match all rows; dev results cannot mutate persistence',async()=>{
  const record=await WebsiteUltraStore.create(brief);assert.equal((await WebsiteUltraStore.list(25,0,'%')).total,0);const result=await WebsiteUltraStore.list(25,0);result.enquiries[0].brief.businessName='Changed';assert.equal((await WebsiteUltraStore.findByReference(record.reference))!.brief.businessName,brief.businessName);
});
test('WhatsApp links target the saved customer number, without an automatic message',()=>{
  assert.equal(ultraCustomerWhatsApp('024 123 4567'),'https://wa.me/233241234567');assert.equal(ultraCustomerWhatsApp('+233241234567'),'https://wa.me/233241234567');assert.equal(ultraCustomerWhatsApp('javascript:alert(1)'),null);
});
test('untrusted reference URLs cannot execute script or include embedded credentials',()=>{for(const value of ['javascript:alert(1)','data:text/html,bad','https://user:pass@example.test'])assert.equal(ultraReferenceWebsite(value),null);assert.equal(ultraReferenceWebsite('https://example.test/'),'https://example.test/');});
test('brief UI renders original text as React text, with safe external links and constrained mobile dialog',()=>{
  const source=readFileSync(new URL('../../../src/components/admin/sections/AdminUltraEnquiries.tsx',import.meta.url),'utf8');assert.ok(!source.includes('dangerouslySetInnerHTML'));assert.ok(source.includes('rel="noopener noreferrer"'));assert.ok(source.includes('overflow-wrap:anywhere'));assert.ok(source.includes('max-h-[85dvh]'));assert.ok(source.includes('Requested features / project brief'));
});
