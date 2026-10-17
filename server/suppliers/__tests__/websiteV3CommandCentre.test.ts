import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {ownerAttention} from '../../../src/utils/websiteOwnerAttention';

const live={published:true,content:{phone:'0241234567'},views:12};
test('a live, reachable, selling store needs nothing',()=>{
  assert.deepEqual(ownerAttention({...live,reseller:true,sellableBundles:4}),[]);
  assert.deepEqual(ownerAttention({...live,reseller:false}),[]);
});
test('attention items come only from real gaps and point at the place that fixes them',()=>{
  const items=ownerAttention({reseller:true,published:false,content:{},sellableBundles:0,reconciliationRequired:true});
  assert.deepEqual(items.map(i=>[i.id,i.action]),[['bundles','pricing'],['earnings','earnings'],['contact','edit'],['publish','publish']]);
});
test('unknown bundle counts and non-Data businesses never get reseller prompts',()=>{
  assert.equal(ownerAttention({...live,reseller:true,sellableBundles:null}).length,0);
  assert.ok(!ownerAttention({...live,reseller:false,sellableBundles:0}).some(i=>i.id==='bundles'));
});
test('share is suggested only for a live site with no visits in the period',()=>{
  assert.deepEqual(ownerAttention({...live,reseller:false,views:0}).map(i=>i.id),['share']);
  assert.ok(!ownerAttention({reseller:false,published:false,content:{whatsapp:'0241234567'},views:0}).some(i=>i.id==='share'));
});
test('dashboard reads bundle eligibility through the existing owner catalogue only',()=>{
  const s=readFileSync('src/components/website/WebsiteBusinessDashboard.tsx','utf8');
  assert.ok(s.includes('websiteBusinessRequest(`websites/${site.id}/bundles`,token).then('));
  assert.ok(s.includes('role="group" aria-label="Analytics period"'));
});
