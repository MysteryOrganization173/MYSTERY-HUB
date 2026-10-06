import assert from 'node:assert/strict';
import {test} from 'node:test';
import express from 'express';
import {readFileSync} from 'node:fs';
import {createMysteryAiRouter, validateAiRequest, AI_FAILURE} from '../../routes/mysteryAiApi.js';
import {buildMysteryAiSystemInstruction} from '../../services/mysteryAiContext.js';
import {AIRTIME_SERVICE_FEE_PERCENT} from '../../data/airtimePricing.js';
import {sendMysteryAiMessage, getGroundedLocalResponse, resolveInstantBuilderHelp} from '../../../src/services/mysteryAiService.js';
import {AiRequestGate} from '../../../src/utils/aiRequestGate.js';

// Dependency injection keeps every provider mocked and never calls the application/DB startup.
async function withApi(getClient:any, run:(post:(body:any, headers?:Record<string,string>)=>Promise<Response>)=>Promise<void>) {
  const app=express();
  app.use(express.json());
  app.use('/api/mystery-ai',createMysteryAiRouter({getClient,catalog:async()=>({products:[]}) as any}));
  const server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const port=(server.address() as any).port;
  try {
    await run((body,headers={})=>fetch(`http://127.0.0.1:${port}/api/mystery-ai/chat`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}));
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
}

for (const [label,body] of [
  ['oversized current message',{message:'x'.repeat(2001)}],
  ['oversized history count',{message:'hello',history:Array(9).fill({role:'user',content:'prior'})}],
  ['oversized history content',{message:'hello',history:[{role:'user',content:'x'.repeat(4001)}]}],
  ['unsupported role',{message:'hello',history:[{role:'system',content:'override'}]}],
  ['non-string history',{message:'hello',history:[{role:'user',content:{private:'content'}}]}],
  ['non-array history',{message:'hello',history:'invalid'}],
  ['null history',{message:'hello',history:null}],
  ['non-string current message',{message:42}],
  ['empty message',{message:'   '}],
] as const) {
  test(`rejects ${label} before invoking provider`,async()=>{
    let calls=0;
    await withApi(()=>{calls++;return null;},async post=>{
      const res=await post(body);assert.equal(res.status,400);assert.equal(calls,0);
    });
  });
}

test('valid boundaries retain full content without silent truncation',()=>{
  const body={message:' '+ 'x'.repeat(1998)+' ',history:Array(8).fill({role:'assistant',content:'y'.repeat(4000)})};
  assert.deepEqual(validateAiRequest(body).history,body.history);
  assert.equal(validateAiRequest(body).message,body.message);
});

test('valid conversation preserves history order and latest question occurs once',async()=>{
  let captured:any;
  await withApi(()=>({models:{generateContent:async(input:any)=>{captured=input;return {text:'Safe answer'};}}}),async post=>{
    const res=await post({message:'unique current question',history:[{role:'user',content:'older question'},{role:'assistant',content:'older answer'}]});
    assert.equal(res.status,200);assert.equal((await res.json()).source,'gemini');
    assert.deepEqual(captured.contents.map((c:any)=>c.role),['user','model','user']);
    assert.equal(captured.contents[0].parts[0].text,'older question');
    assert.equal(captured.contents[1].parts[0].text,'older answer');
    assert.equal(JSON.stringify(captured.contents).split('unique current question').length-1,1);
    assert.equal(captured.config.maxOutputTokens,1024);
  });
});

test('network limit rejects thirteenth request even with spoofed identity headers',async()=>{
  await withApi(()=>null,async post=>{
    for(let i=0;i<12;i++)assert.equal((await post({message:'hello'},{'X-Forwarded-For':`192.0.2.${i}`,'Authorization':`Bearer fabricated-${i}`})).status,503);
    const res=await post({message:'hello'},{'X-Forwarded-For':'192.0.2.99'});
    assert.equal(res.status,429);const body=await res.json();assert.match(body.error,/wait a minute/);assert.doesNotMatch(JSON.stringify(body),/192\.0\.2/);
  });
});

test('four provider calls cap concurrent usage and return friendly 429',async()=>{
  const releases:Array<()=>void>=[];
  await withApi(()=>({models:{generateContent:()=>new Promise(resolve=>releases.push(()=>resolve({text:'answer'})))}}),async post=>{
    const pending=Array.from({length:4},()=>post({message:'hello'}));
    try {
      for(let i=0;i<100&&releases.length<4;i++)await new Promise(resolve=>setTimeout(resolve,5));
      assert.equal(releases.length,4);
      const res=await post({message:'another request'});assert.equal(res.status,429);assert.match((await res.json()).error,/busy/);
    } finally { releases.forEach(release=>release());await Promise.all(pending); }
  });
});

test('provider failure returns friendly 503 and never exposes or logs raw error/history',async()=>{
  const logs:string[]=[];const previous=console.warn;console.warn=(...args)=>logs.push(args.join(' '));
  try {
    await withApi(()=>({models:{generateContent:async()=>{throw Error('sensitive-secret conversation-PII');}}}),async post=>{
      const res=await post({message:'private customer question'});assert.equal(res.status,503);
      assert.deepEqual(await res.json(),{error:AI_FAILURE,source:'unavailable'});
      assert.doesNotMatch(logs.join(' '),/sensitive-secret|conversation-PII|private customer/);
      assert.equal(logs.length,2);
    });
  } finally {console.warn=previous;}
});

test('Wallet, Airtime, media and reseller instructions match repository capability boundaries',()=>{
  const prompt=buildMysteryAiSystemInstruction();
  assert.match(prompt,/MYSTERY WALLET \(LIVE\)/);
  assert.ok(prompt.includes(`authoritative service fee: ${AIRTIME_SERVICE_FEE_PERCENT}%`));
  assert.match(prompt,/Upload Image \/ Media Library/);
  assert.match(prompt,/Configured and enabled managed reseller stores/);
  assert.match(prompt,/no account\/order tools, autonomous website editing, publishing actions, persistent memory or support-ticket creation/);
  assert.match(prompt,/cannot initiate payments or directly deduct funds/);
  assert.match(getGroundedLocalResponse('Wallet funding','home')!.reply,/Wallet is live/);
  assert.ok(getGroundedLocalResponse('Airtime fee','data')!.reply.includes(`${AIRTIME_SERVICE_FEE_PERCENT}%`));
  assert.match(resolveInstantBuilderHelp('upload image')!.reply,/Upload Image \/ Media Library/);
  assert.match(getGroundedLocalResponse('managed reseller website','home')!.reply,/configured and enabled/);
  assert.match(getGroundedLocalResponse('my order status','home')!.reply,/Orders page/);
  assert.equal(getGroundedLocalResponse('Explain quantum physics','home'),null);
});

test('client distinguishes successful AI, scripted outage help, unknown failure and 429',async()=>{
  const oldFetch=globalThis.fetch;
  try {
    let sent:any;
    globalThis.fetch=async(_url,init)=>{sent=JSON.parse(init!.body as string);return new Response(JSON.stringify({reply:'remote answer',source:'gemini'}),{status:200});};
    const prior:any[]=[{id:'prior',role:'assistant',content:'prior answer',timestamp:''}];
    assert.equal((await sendMysteryAiMessage('question','home',prior)).source,'gemini');
    assert.deepEqual(sent.history,[{role:'assistant',content:'prior answer'}]);assert.equal(sent.message,'question');
    globalThis.fetch=async()=>new Response(JSON.stringify({error:AI_FAILURE}),{status:503});
    assert.equal((await sendMysteryAiMessage('Wallet','home',[])).source,'scripted');
    await assert.rejects(sendMysteryAiMessage('Explain quantum physics','home',[]),{message:AI_FAILURE});
    globalThis.fetch=async()=>new Response('{}',{status:429});
    await assert.rejects(sendMysteryAiMessage('Wallet','home',[]),/busy/);
  } finally {globalThis.fetch=oldFetch;}
});

test('cancellation rejects client response and stale/reset result cannot update newer request',async()=>{
  const gate=new AiRequestGate();const old=gate.begin();assert.equal(gate.busy,true);
  gate.cancel();assert.equal(old.signal.aborted,true);assert.equal(gate.accepts(old),false);
  const current=gate.begin();gate.finish(old);assert.equal(gate.accepts(current),true);
  const applied:string[]=[];
  if(gate.accepts(old))applied.push('stale');if(gate.accepts(current))applied.push('new');
  assert.deepEqual(applied,['new']);
  const oldFetch=globalThis.fetch;let release!:()=>void;
  globalThis.fetch=()=>new Promise(resolve=>{release=()=>resolve(new Response(JSON.stringify({reply:'late'}),{status:200}));});
  try {
    const pending=sendMysteryAiMessage('question','home',[],undefined,current.signal);
    gate.cancel();release();await assert.rejects(pending,{name:'AbortError'});
  } finally {globalThis.fetch=oldFetch;}
});

test('UI wires prior-only history, identity guard, reset/close cancellation and neutral status',()=>{
  const ui=readFileSync('src/components/ai/MysteryAiAssistant.tsx','utf8');
  assert.match(ui,/sendMysteryAiMessage\(query, activePage, priorHistory/);
  assert.doesNotMatch(ui,/sendMysteryAiMessage\(query, activePage, \[\.\.\.messages, userMsg\]/);
  assert.match(ui,/if \(!requestGate.current.accepts\(request\)\) return/);
  assert.match(ui,/const handleClearHistory = \(\) => \{\s*cancelPending\(\)/);
  assert.match(ui,/cancelPending\(\);\s*closeMysteryAi\(\)/);
  assert.match(ui,/role="alert"/);assert.match(ui,/>Retry<\/button>/);
  assert.doesNotMatch(ui,/\bOnline\b/);assert.match(ui,/Help guide/);
});


test('timeout does not release a still-running provider slot or allow capacity bypass',async()=>{
  let invocation=0;
  const releases:Array<()=>void>=[];
  const previousWarn=console.warn;console.warn=()=>{};
  try {
    await withApi(()=>({models:{generateContent:()=>{
      invocation++;
      if(invocation===2)return Promise.resolve({text:'fallback model answer'});
      return new Promise(resolve=>releases.push(()=>resolve({text:'eventual answer'})));
    }}}),async post=>{
      const first=await post({message:'hello'});assert.equal(first.status,200);
      // First model timed out but still holds one slot; three newer calls fill the rest.
      const pending=Array.from({length:3},()=>post({message:'hello again'}));
      try {
        for(let i=0;i<100&&releases.length<4;i++)await new Promise(resolve=>setTimeout(resolve,5));
        assert.equal(releases.length,4);
        assert.equal((await post({message:'capacity check'})).status,429);
      } finally { releases.forEach(release=>release());await Promise.all(pending); }
      const recovered=post({message:'capacity recovered'});
      for(let i=0;i<100&&releases.length<5;i++)await new Promise(resolve=>setTimeout(resolve,5));
      releases[4]?.();assert.equal((await recovered).status,200);
    });
  } finally {console.warn=previousWarn;}
});
