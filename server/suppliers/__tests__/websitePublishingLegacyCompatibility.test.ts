import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateWebsiteContentPatch} from '../../services/websiteValidation';
import {createPublishedSnapshot} from '../../services/websitePublication';
import {WEBSITE_TEMPLATES} from '../../../src/data/templates';
test('registered legacy comparison statistics validate and remain exactly unchanged in public snapshot',()=>{
 const stats=structuredClone(WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-data-reseller')!.stats!);const before=structuredClone(stats);
 validateWebsiteContentPatch({stats});const snapshot=createPublishedSnapshot({template_id:'tmpl-data-reseller',name:'Synthetic legacy',content_json:{stats},settings_json:{},updated_at:'2026-10-14T00:00:00.000Z'} as any);
 assert.deepEqual(stats,before);assert.deepEqual(snapshot.content.stats,before);
});
test('plain numeric comparison grammar is narrowly scoped to statistic values',()=>{
 for(const value of ['< 3 Mins','> 100','<0.5 %'])assert.doesNotThrow(()=>validateWebsiteContentPatch({stats:[{label:'Synthetic metric',value}]}));
 assert.throws(()=>validateWebsiteContentPatch({tagline:'< 3 Mins'}));assert.throws(()=>validateWebsiteContentPatch({stats:[{label:'< 3 Mins',value:'1'}]}));
});
test('comparison compatibility never permits markup, event attributes, arbitrary less-than text or oversized values',()=>{
 for(const value of ['<script>alert(1)</script>','<img src=x onerror=alert(1)>','< 3 Mins >','> 3 onload=alert(1)','< unknown','< '+'1'.repeat(51),null,3])assert.throws(()=>validateWebsiteContentPatch({stats:[{label:'Synthetic metric',value}]}));
});
