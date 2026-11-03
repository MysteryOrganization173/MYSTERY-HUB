import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SuccessBizHubClient} from '../successBizHub/client.js';
import {SuccessBizHubProvider} from '../successBizHub/provider.js';
import {parseBeneficiaryEligibility} from '../successBizHub/beneficiary.js';
const phone='0241234567';
const result=(eligible:unknown,extra={})=>({success:true,data:{results:[{phone,eligible,...extra}]}});
for(const [name,body,outcome] of [
 ['explicit eligible',result(true),'eligible'],['explicit denial',result(false),'ineligible'],
 ['missing eligible',result(undefined),'unknown'],['empty results',{success:true,data:{results:[]}},'unknown'],
 ['malformed results',{success:true,data:{results:'bad'}},'unknown'],['malformed entry',{success:true,data:{results:[null]}},'unknown'],
 ['wrong recipient',result(true,{phone:'0551111111'}),'unknown'],['wrong direct recipient',{success:true,data:{phone:'0551111111',eligible:true}},'unknown'],
 ['wrong root recipient',{phone:'0551111111',eligible:true},'unknown'],['non-string identity',result(true,{phone:24}),'unknown'],
 ['conflicting matching results',{success:true,data:{results:[{phone,eligible:true},{phone:'+233241234567',eligible:false}]}},'unknown'],
 ['nested conflicting evidence',{success:true,data:{eligible:false,results:[{phone,eligible:true}]}},'unknown'],
 ['invalid success envelope',{success:'true',data:{eligible:true}},'unknown'],
 ['invalid nested wrapper flag',{data:{eligible:'false',results:[{phone,eligible:true}]}},'unknown'],
 ['conflicting identity in duplicate rows',{data:[{phone,msisdn:'0551111111',eligible:true},{phone,eligible:true}]},'unknown'],
 ['false success envelope',{success:false,data:{eligible:true}},'unknown'],['error envelope',{success:true,error:{message:'PRIVATE'},data:{eligible:true}},'unknown'],
 ['malformed boolean',result('true'),'unknown'],['legacy direct',{data:{eligible:true}},'eligible'],['legacy single anonymous result',{data:[{eligible:true}]},'eligible'],
 ['unrelated rows',{data:[{phone:'0551111111',eligible:false},{phone:'233241234567',eligible:true}]},'eligible'],
] as const)test('beneficiary evidence: '+name,()=>{
 const parsed=parseBeneficiaryEligibility(body,phone);assert.equal(parsed.outcome,outcome);assert.equal(parsed.eligible,outcome==='eligible');assert.ok(!JSON.stringify(parsed).includes('PRIVATE'));
});

test('real HTTP client and provider: selectors, transport classification, privacy, deadline and recovery',async t=>{
 const saved={...process.env},fetch=globalThis.fetch,logs:string[]=[];const info=console.info,warn=console.warn;
 console.info=(...args)=>{logs.push(args.join(' '));};console.warn=(...args)=>{logs.push(args.join(' '));};
 Object.assign(process.env,{SUCCESS_BIZ_HUB_BASE_URL:'https://supplier.invalid/v2',SUCCESS_BIZ_HUB_API_KEY:'synthetic-only',SUCCESS_BIZ_HUB_REQUEST_TIMEOUT_MS:'20'});
 const client=new SuccessBizHubClient(),provider=new SuccessBizHubProvider(client);
 try{
  for(const [name,status,body,expected]of [
   ['eligible',200,result(true),'eligible'],['denied',200,result(false),'ineligible'],['permission',403,{error:{message:'PRIVATE '+phone}},'unknown'],
   ['unavailable',503,{error:{message:'PRIVATE'}},'unknown'],['unexpected HTML',200,'<html>PRIVATE</html>','unknown'],['unexpected 302',302,{},'unknown'],
  ] as const)await t.test(name,async()=>{
   globalThis.fetch=async(input,options)=>{assert.equal(String(input),'https://supplier.invalid/v2/beneficiary-check');assert.equal(options!.redirect,'error');assert.deepEqual(JSON.parse(options!.body as string),{phones:[phone],offerSlug:'fixture-mtn'});return new Response(typeof body==='string'?body:JSON.stringify(body),{status});};
   const r=await provider.checkBeneficiaryEligibility(phone,{offerSlug:'fixture-mtn'});assert.equal(r.outcome,expected);assert.equal(r.eligible,expected==='eligible');assert.ok(!JSON.stringify(r).includes('PRIVATE'));
  });
  await t.test('timeout',async()=>{globalThis.fetch=async(_i,o)=>new Promise((_r,reject)=>o!.signal!.addEventListener('abort',()=>reject(new DOMException('PRIVATE','AbortError'))));const r=await provider.checkBeneficiaryEligibility(phone);assert.equal(r.outcome,'unknown');assert.equal(r.failure,'timeout');});
  await t.test('connection',async()=>{globalThis.fetch=async()=>{throw new TypeError('PRIVATE '+phone);};assert.equal((await provider.checkBeneficiaryEligibility(phone)).failure,'connection');});
  await t.test('late headers cannot approve',async()=>{globalThis.fetch=async()=>{await new Promise(r=>setTimeout(r,35));return new Response(JSON.stringify(result(true)));};assert.equal((await provider.checkBeneficiaryEligibility(phone)).failure,'timeout');});
  await t.test('late body cannot approve',async()=>{globalThis.fetch=async()=>({ok:true,status:200,text:async()=>{await new Promise(r=>setTimeout(r,35));return JSON.stringify(result(true));}} as Response);assert.equal((await provider.checkBeneficiaryEligibility(phone)).failure,'timeout');});
  await t.test('user-initiated recovery and alternate offer selector',async()=>{globalThis.fetch=async(_i,o)=>{assert.deepEqual(JSON.parse(o!.body as string),{phones:[phone],offerId:'fixture-telecel'});return new Response(JSON.stringify({success:true,data:{eligible:true}}));};assert.equal((await provider.checkBeneficiaryEligibility(phone,{offerId:'fixture-telecel'})).outcome,'eligible');});
  assert.ok(!logs.join(' ').includes(phone));assert.ok(!logs.join(' ').includes('PRIVATE'));assert.ok(!logs.join(' ').includes('synthetic-only'));
 }finally{globalThis.fetch=fetch;console.info=info;console.warn=warn;for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
});
