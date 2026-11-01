import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {advanceSalesIncidents,salesView} from '../../services/salesReliabilityRules.js';
import {SalesCollector} from '../../services/salesReliability.js';
import {SALES_RELIABILITY_SCHEMA} from '../../db/salesReliabilitySchema.js';
import type {SalesObservation} from '../../../shared/salesReliability.js';
import {readFileSync} from 'node:fs';

const now=1_800_000_000_000;
const event=(at:number,extra:Partial<SalesObservation>={}):SalesObservation=>({id:randomUUID(),at,service:'data',stage:'services',category:'timeout',blocked:true,phase:'headers',fresh:{},cached:[],...extra});
const failures=[event(now-120000),event(now-60000),event(now)];
const collector={pending:0,dropped:0,writeFailed:false,lastPersistedAt:now,since:now};
const advance=(events:SalesObservation[])=>advanceSalesIncidents([],events,events);

test('healthy, customer validation and unknown evidence never open false supplier incidents',()=>{
  for(const category of ['passed','validation','unverified'] as const){const events=failures.map(e=>({...e,category,blocked:false}));assert.deepEqual(advance(events),[]);}
  assert.equal(salesView([],[],now,'durable',collector).state,'insufficient_evidence');
  const good=event(now,{category:'passed',blocked:false,fresh:{services:now,catalog:now,wallet:now}});
  assert.equal(salesView([good],[],now,'durable',collector).state,'healthy');
  assert.equal(salesView([{...good,fresh:{},cached:['services']}],[],now,'durable',collector).state,'insufficient_evidence');
});
test('single timeout remains insufficient evidence; third related failure opens one grouped incident',()=>{
  assert.equal(advance(failures.slice(0,1)).length,0);
  assert.equal(salesView(failures.slice(0,1),[],now,'durable',collector).state,'insufficient_evidence');
  const incidents=advance(failures);assert.equal(incidents.length,1);assert.equal(incidents[0].affectedAttempts,3);assert.equal(incidents[0].firstFailureAt,now-120000);
  const more=event(now+1,{category:'authorization'});
  const next=advanceSalesIncidents(incidents,[...failures,more],[more]);assert.equal(next.length,1);assert.equal(next[0].affectedAttempts,4);assert.equal(next[0].category,'authorization');
});
test('ten-minute boundary, same-timestamp races and independent service/stage groups are exact',()=>{
  assert.equal(advance([event(now-600000),event(now-1),event(now)]).length,0);
  const same=Array.from({length:6},()=>event(now));assert.equal(advance(same)[0].affectedAttempts,6);
  assert.equal(advance([event(now),event(now,{service:'airtime'}),event(now,{service:'instant_bundle'})]).length,0);
  assert.equal(advance([event(now),event(now,{stage:'wallet'}),event(now,{stage:'catalog'})]).length,0);
});
test('wallet, cache, another service and older in-flight positives cannot clear discovery failure',()=>{
  const incidents=advance(failures);
  for(const positive of [event(now+1,{category:'passed',blocked:false,fresh:{wallet:now+1}}),event(now+1,{category:'passed',blocked:false,cached:['services']}),event(now+1,{service:'airtime',category:'passed',fresh:{services:now+1}}),event(now+1,{category:'passed',fresh:{services:now-1}})]){
    assert.equal(advanceSalesIncidents(incidents,[...failures,positive],[positive])[0].firstRecoveryAt,null);
  }
});
test('recovery needs two authoritative preflights one minute apart; new failure resets progress',()=>{
  let incidents=advance(failures);
  const first=event(now+1,{category:'passed',blocked:false,fresh:{services:now+1}});
  incidents=advanceSalesIncidents(incidents,[],[first]);assert.equal(incidents[0].firstRecoveryAt,now+1);assert.equal(incidents[0].recoveredAt,null);
  incidents=advanceSalesIncidents(incidents,[],[event(now+60000,{category:'passed',fresh:{services:now+60000}})]);assert.equal(incidents[0].recoveredAt,null);
  incidents=advanceSalesIncidents(incidents,[],[event(now+60001,{category:'passed',fresh:{services:now+60001}})]);assert.equal(incidents[0].recoveredAt,now+60001);
  const again=event(now+60002);assert.equal(advanceSalesIncidents(incidents,[...failures,again],[again]).length,1,'one post-recovery transient must not reuse old failures');
  let active=advanceSalesIncidents(advance(failures),[],[first]);active=advanceSalesIncidents(active,[],[event(now+2)]);assert.equal(active[0].firstRecoveryAt,null);
  assert.equal(salesView([],active,now+16*60000,'durable',collector).incidents[0].state,'insufficient_evidence');
});
test('durability problems prevent an invented healthy state',()=>{
  const good=event(now,{category:'passed',fresh:{services:now}});
  for(const storage of ['durable','unavailable'] as const)assert.equal(salesView([good],[],now,storage,{...collector,writeFailed:true}).state,'insufficient_evidence');
});
test('an unresolved incident cannot be hidden by a busy recovered history',()=>{
  const incident=advance(failures)[0];
  const history=Array.from({length:40},(_,i)=>({...incident,id:randomUUID(),firstFailureAt:now+i+1,lastFailureAt:now+i+1,recoveredAt:now+i+2}));
  const view=salesView([], [...history,incident],now+16*60000,'durable',collector);
  assert.equal(view.state,'insufficient_evidence');assert.ok(view.incidents.some(i=>i.id===incident.id));
});
test('an uncertain COMMIT is not blindly retried after retention could remove its deduplication record',async()=>{
  let writes=0;
  const c=new SalesCollector({canFlush:()=>true,read:async()=>({observations:[],incidents:[]}),save:async()=>{writes++;throw Object.assign(Error('synthetic'),{monitorCommitUncertain:true});}} as any);
  c.enqueue(event(now));await c.flush(now);const view=await c.view(now);
  assert.equal(view.collector.pending,0);assert.equal(view.collector.dropped,1);assert.equal(view.collector.writeFailed,true);
  await c.flush(now);assert.equal(writes,2,'empty maintenance retry cannot contain the uncertain observation');
});
test('bounded collector yields under pressure, isolates write failures, retries and avoids overlapping flushes',async()=>{
  let writes=0,can=false,fail=true,release!:()=>void;
  const fake={canFlush:()=>can,read:async()=>({observations:[],incidents:[]}),save:async()=>{writes++;if(fail)throw Error('Sensitive synthetic provider message');await new Promise<void>(r=>release=r);}};
  const c=new SalesCollector(fake as any);
  for(let i=0;i<1001;i++)c.enqueue(event(now));
  await c.flush(now);assert.equal(writes,0);
  can=true;await c.flush(now);let view=await c.view(now);assert.equal(view.collector.pending,1000);assert.equal(view.collector.dropped,1);assert.equal(view.collector.writeFailed,true);
  assert.ok(!JSON.stringify(view).includes('Sensitive'));
  fail=false;const pending=c.flush(now);await Promise.resolve();await c.flush(now);assert.equal(writes,2);release();await pending;
  view=await c.view(now);assert.equal(view.collector.pending,900);
});
test('schema is mirrored, RLS-protected and contains no permissive policy or customer identifiers',()=>{
  assert.ok(readFileSync('server/db/schema.sql','utf8').includes(SALES_RELIABILITY_SCHEMA));
  assert.ok(SALES_RELIABILITY_SCHEMA.includes('ENABLE ROW LEVEL SECURITY'));
  assert.ok(!/CREATE POLICY|SECURITY DEFINER|FORCE ROW|phone|payment_reference|user_id|session_token/i.test(SALES_RELIABILITY_SCHEMA));
});
