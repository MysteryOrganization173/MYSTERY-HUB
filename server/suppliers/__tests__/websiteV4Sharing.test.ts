import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {publicSiteHead} from '../../../src/utils/publicSiteHead';
import {DATA_RESELLER_LEGACY_HERO_IMAGE as LEGACY} from '../../../src/utils/dataResellerArtwork';

const logo='https://res.cloudinary.com/da6oeat7m/image/upload/v1/owner-uploads/quickbyte-logo.png';
const site=(heroImage:string,extra={})=>({id:'site_1791231782316_hfxt11',template_id:'tmpl-data-reseller',name:'Quickbyte data',slug:'quickbyte-data',
  content:{businessName:'Quickbyte data',tagline:'Affordable data. Simple delivery.',aboutText:'',location:'Dansoman',phone:'',whatsapp:'',email:'',logoUrl:logo,heroImage,ctaLabel:'Buy Data',ctaTarget:'',social:{},items:[],stats:[],features:[],...extra},
  settings:{primaryColor:'#0f172a',accentColor:'#2563eb',backgroundColor:'#0a0f1d',fontFamily:'font-sans',borderRadius:'rounded-xl'}}) as any;

test('share preview uses the owner name, words, banner and logo exactly as published',()=>{
  const record=site('');const before=structuredClone(record);
  const head=publicSiteHead(record,'https://mysterybundlehub.com/');
  assert.deepEqual(head,{title:'Quickbyte data',description:'Affordable data. Simple delivery.',url:'https://mysterybundlehub.com/sites/quickbyte-data',image:LEGACY,icon:logo});
  assert.deepEqual(record,before);
});
test('descriptions fall back to the about text, then to a plain line, and are clipped',()=>{
  assert.equal(publicSiteHead(site('',{tagline:'',aboutText:'x'.repeat(300)}),'https://a.test').description.length,160);
  assert.equal(publicSiteHead(site('',{tagline:'',aboutText:''}),'https://a.test').description,'Quickbyte data in Dansoman: Data & Telecom.');
});
test('unsafe image values are never written into the page head',()=>{
  const head=publicSiteHead(site('javascript:alert(1)',{logoUrl:'javascript:alert(1)'}),'https://a.test');
  assert.equal(head.icon,'');assert.equal(head.image,'');
});
test('the published page applies the head on load',()=>{
  assert.match(readFileSync('src/components/website/PublicPublishedSite.tsx','utf8'),/applyPublicSiteHead\(publicSiteHead\(res\.site, window\.location\.origin\)\)/);
});
