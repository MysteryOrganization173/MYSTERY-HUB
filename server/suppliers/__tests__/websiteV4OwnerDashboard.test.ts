import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {ownerSuggestions} from '../../../src/utils/websiteOwnerAttention';
import {customerActivityLabel,isOwnerActivity} from '../../../src/utils/customerActivity';

const base={reseller:false,hasItems:true,itemWord:'services'};
test('owner editor visits are owner activity with plain labels, customer events are not',()=>{
  for(const code of ['website_editor_opened','website_template_previewed','website_build_started','website_builder_viewed'])assert.equal(isOwnerActivity(code),true,code);
  for(const code of ['site_view','whatsapp_click','checkout_started','store_sale'])assert.equal(isOwnerActivity(code),false,code);
  assert.equal(customerActivityLabel('website_editor_opened'),'You opened the editor');
});
test('the Overview filters owner activity; the full history keeps it',()=>{
  const s=readFileSync('src/components/website/WebsiteBusinessDashboard.tsx','utf8');
  assert.ok(s.includes("a.activity.filter((x:any)=>tab!=='Overview'||!isOwnerActivity(x.event))"));
});
test('Data stores whose saved description says to order on WhatsApp get a wording suggestion, nothing is rewritten',()=>{
  const content={aboutText:'Choose your package, enter the recipient number and place your order through WhatsApp.',logoUrl:'x',location:'Dansoman'};
  const before=structuredClone(content);
  assert.deepEqual(ownerSuggestions({...base,reseller:true,hasItems:false,content}).map(i=>i.id),['wording']);
  assert.deepEqual(content,before);
  assert.deepEqual(ownerSuggestions({...base,reseller:true,hasItems:false,content:{...content,aboutText:'Buy bundles here. Message us on WhatsApp if you need help.'}}),[]);
  assert.ok(!ownerSuggestions({...base,content}).some(i=>i.id==='wording'),'only Data stores');
});
test('suggestions are tailored to the business and capped at three',()=>{
  const items=ownerSuggestions({...base,content:{logoUrl:'',items:[],location:''}});
  assert.deepEqual(items.map(i=>i.id),['logo','items','location']);
  assert.equal(items[1].title,'Show your services');
  assert.ok(items.every(i=>i.action==='edit'));
  assert.deepEqual(ownerSuggestions({...base,content:{logoUrl:'l',items:[{}],location:'Accra'}}),[]);
});
