import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createGreetingsVisitorResolver } from '../../services/greetingsVisitor.js';
import { experienceRouter } from '../../routes/experienceApi.js';
import { ExperienceService, greetingCreationAvailable } from '../../services/experienceService.js';
import { ExperienceStore } from '../../db/experienceStore.js';

const request = (remoteAddress?: string, ...rawHeaders: string[]) => ({socket:{remoteAddress},rawHeaders});
const forwarded = (address: string, chain: string, ...extra: string[]) => request(address, 'X-Forwarded-For', chain, ...extra);
const resolve = createGreetingsVisitorResolver('10.17.3.2/32,10.17.3.3/32,fd12::4/128', false).resolve;

test('verified suffix supports differing ingress lengths and ignores spoofed prefixes and Cloudflare headers', () => {
  const first = resolve(forwarded('::ffff:10.17.3.2','1.2.3.4'));
  assert.deepEqual(first,{key:'v4:1.2.3.4',established:true});
  assert.deepEqual(resolve(forwarded('fd12::4','garbage, 9.9.9.9, 1.2.3.4, 10.17.3.3','CF-Connecting-IP','4.4.4.4','Forwarded','for=5.5.5.5')),first);
  assert.notEqual(resolve(forwarded('10.17.3.2','9.9.9.9')).key,first.key);
  assert.deepEqual(resolve(forwarded('10.17.3.2','::ffff:1.2.3.4')),first);
});

test('IPv6 canonicalization groups privacy addresses in the same routed prefix', () => {
  const first = resolve(forwarded('10.17.3.2','2606:4700:0001:0002:0000:0000:0000:0001'));
  assert.deepEqual(first,{key:'v6:2606:4700:1:2/64',established:true});
  assert.deepEqual(resolve(forwarded('10.17.3.2','2606:4700:1:2::ff12')),first);
  assert.notEqual(resolve(forwarded('10.17.3.2','2606:4700:1:3::1')).key,first.key);
});

test('direct requests and forwarding ambiguity share a bounded unverified key', () => {
  const inputs = [request(), request('10.17.3.2'), request('10.17.3.2','CF-Connecting-IP','1.2.3.4'),
    forwarded('10.17.9.9','1.2.3.4'), forwarded('1.2.3.4','8.8.8.8'),
    forwarded('10.17.3.2','8.8.8.8','x-forwarded-for','1.2.3.4'),
    ...['127.0.0.1','010.0.0.1','169.254.0.2','fe80::1%eth0','8.8.8.8:81','[2606::1]','10.17.3.2','4.4.4.4,','4.4.4.4, nope','8.8.8.8'.repeat(81),Array(9).fill('8.8.8.8').join(',')].map(value=>forwarded('10.17.3.2',value))];
  for (const input of inputs) assert.deepEqual(resolve(input),{key:'unverified',established:false});
  for (const value of ['', '10.2.0.0/999','0.0.0.0/0','::/0','::ffff:10.1.2.3/128','10.1.2.3','10.1.2.3/32,',Array(17).fill('10.1.2.3/32').join(',')]) {
    assert.equal(createGreetingsVisitorResolver(value,false).configured,false);
  }
});

test('direct local development normalizes the actual socket and ignores all supplied headers', () => {
  const local=createGreetingsVisitorResolver('',true);
  assert.deepEqual(local.resolve(forwarded('::ffff:127.0.0.1','1.2.3.4')),local.resolve(request('127.0.0.1')));
  assert.equal(local.resolve(request('127.0.0.1')).established,true);
  assert.equal(local.resolve(forwarded('1.2.3.4','8.8.8.8')).established,false);
});

test('HTTP admission shares canonical identity with the durable HMAC and rejects unqualified ingress', async t => {
  const saved = {...process.env};
  Object.assign(process.env,{RENDER:'true',EXPERIENCES_TRUSTED_PROXY_CIDRS:'127.0.0.1/32',MYSTERY_GREETING_LINKS_ENABLED:'true',MYSTERY_GREETINGS_ENABLED:'true',EXPERIENCES_ABUSE_SECRET:'e'.repeat(64)});
  const storeRead=t.mock.method(ExperienceStore,'creationReadiness',async()=>true);
  const storeWrite=t.mock.method(ExperienceService,'create',async()=>({duplicate:false}));
  const app=express();app.use('/api/experiences',experienceRouter);
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/experiences`;
  const post=(xff?:string)=>fetch(base+'/greetings',{method:'POST',headers:{'content-type':'application/json',...(xff?{'x-forwarded-for':xff}:{})},body:'{}'});
  try {
    assert.equal((await post()).status,503);
    assert.equal((await (await fetch(base+'/templates')).json()).creationConfigured,false);
    assert.equal(storeRead.mock.callCount(),0);
    for (let i=0;i<15;i++) assert.equal((await post(`2.2.2.${i+1}, ${i===0?'::ffff:1.2.3.4':'1.2.3.4'}`)).status,201);
    assert.equal((await post('7.7.7.7, 1.2.3.4')).status,429);
    assert.equal((await post('2.2.2.2')).status,201);
    assert.equal(storeWrite.mock.callCount(),16);
    const ids=storeWrite.mock.calls.map(call=>call.arguments[1]);
    assert.equal(new Set(ids.slice(0,15)).size,1);
    assert.match(String(ids[0]),/^[a-f0-9]{64}$/);assert.notEqual(ids[15],ids[0]);
    delete process.env.EXPERIENCES_TRUSTED_PROXY_CIDRS;
    assert.equal(await greetingCreationAvailable(),false);
    assert.equal((await post('8.8.8.8')).status,503);
    assert.equal(storeWrite.mock.callCount(),16);
  } finally {
    await new Promise<void>(done=>server.close(()=>done()));
    for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];
    Object.assign(process.env,saved);
  }
});
