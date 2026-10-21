/** Website Builder V5 quality bar for every registered design: working anchors, no simulated bookings, owner hours shown. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {WEBSITE_TEMPLATES} from '../../../src/data/templates.js';
import {mergeSiteWithTemplate,renderTemplateLayout} from '../../../src/utils/templateRendererUtils.js';
import type {SiteContent} from '../../../src/types/index.js';

const owner=(extra:Partial<SiteContent>={}):SiteContent=>({businessName:'Fixture Business',tagline:'Fixture headline',aboutText:'Fixture about',location:'Fixture Street, Accra',whatsapp:'0241234567',phone:'0241234567',email:'fixture@example.test',items:[{id:'i1',name:'Fixture item',price:'GH₵ 50',category:'Main',desc:'Fixture'}],...extra} as SiteContent);
const html=(t:any,content?:SiteContent)=>renderToStaticMarkup(renderTemplateLayout(content?mergeSiteWithTemplate(t,content):t));
const deadAnchors=(markup:string)=>{const ids=new Set([...markup.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]));return [...new Set([...markup.matchAll(/href="#([^"]+)"/g)].map(m=>m[1]))].filter(id=>!ids.has(id));};

test('every in-page link in every design points at a section that is on the page',()=>{
  for(const t of WEBSITE_TEMPLATES){
    assert.deepEqual(deadAnchors(html(t)),[],`${t.id} gallery preview`);
    if(t.layoutType!=='reseller')assert.deepEqual(deadAnchors(html(t,owner())),[],`${t.id} owner site`);
  }
});

test('no design simulates a booking, reservation or quote, in the gallery or on owner sites',()=>{
  for(const t of WEBSITE_TEMPLATES)for(const markup of [html(t),...(t.layoutType==='reseller'?[]:[html(t,owner())])]){
    for(const fake of [/Example reservation/i,/Preview reservation enquiry/i,/No appointment or confirmation message has been sent/i,/No project request has been sent/i,/no dates have been reserved/i,/Request (a )?Booking Slot/i])assert.doesNotMatch(markup,fake,t.id);
  }
});

test('Classic Kitchen shows owner hours and talks about enquiries, not reservations, on owner sites',()=>{
  const kitchen=WEBSITE_TEMPLATES.find(t=>t.layoutType==='restaurant')!;
  const plain=html(kitchen,owner());assert.match(plain,/>Location</);assert.doesNotMatch(plain,/>\s*Reservations\s*</);assert.doesNotMatch(plain,/Reserve Table/);
  const withHours=html(kitchen,owner({hours:{days:[0,1,2,3,4,5,6].map(()=>({closed:false,open:'11:00',close:'21:00'}))}} as any));
  assert.match(withHours,/Location &amp; Hours/);assert.match(withHours,/11/);
});
