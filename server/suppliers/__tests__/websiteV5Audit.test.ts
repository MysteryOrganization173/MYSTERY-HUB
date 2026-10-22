import assert from 'node:assert/strict';
import {test} from 'node:test';
import {filterBundles,bundleFilters,type StoreBundle} from '../../../src/components/website/storefront/ResellerCatalogue.js';
import {websiteSocialHead} from '../../../src/utils/socialMetadata.js';
import {resolvePublicSocialMetadata} from '../../services/publicSocialMetadata.js';
import {injectSocialHead} from '../../routes/publicHtml.js';
import {WebsiteStore} from '../../db/websiteStore.js';
import {websitePublishChanges} from '../../../src/utils/websitePublishChanges.js';
import {containedPhotoBounds,containedPhotoFocal} from '../../../src/config/websiteContentV5.js';
import {writeDraftRecovery,readDraftRecovery,clearDraftRecovery} from '../../../src/utils/websiteDraftRecovery.js';
import {forgetDeletedWebsite} from '../../../src/utils/websiteDeletion.js';
import {prepareWebsiteImage} from '../../../src/utils/websiteImageCompression.js';

test('compression keeps PNG/WebP logos in an alpha-capable format and JPEG photos as JPEG',async()=>{
  const documentBefore=Object.getOwnPropertyDescriptor(globalThis,'document'),bitmapBefore=Object.getOwnPropertyDescriptor(globalThis,'createImageBitmap');
  Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,value:async()=>({width:2400,height:1600,close(){}})});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){}}),toBlob:(callback:(value:Blob)=>void,type:string)=>callback(new Blob([new Uint8Array(500)],{type}))})}});
  try{for(const input of ['image/png','image/webp','image/jpeg']){const output=await prepareWebsiteImage(new File([new Uint8Array(2_000_000)],'fixture',{type:input}),10_000_000);assert.equal(output.file.type,input==='image/jpeg'?'image/jpeg':'image/webp');assert.equal(output.compressed,true);}}
  finally{for(const [key,before] of [['document',documentBefore],['createImageBitmap',bitmapBefore]] as const){if(before)Object.defineProperty(globalThis,key,before);else delete (globalThis as any)[key];}}
});

test('unsaved recoveries stay with their design through template switches and deletion clears all design keys only',()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),store=new Map<string,string>();
  const storage={getItem:(key:string)=>store.get(key)||null,setItem:(key:string,value:string)=>store.set(key,value),removeItem:(key:string)=>store.delete(key),key:(i:number)=>[...store.keys()][i]||null,get length(){return store.size;}};
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
  try{
    const site={id:'recovery-site',name:'Owner',template_id:'tmpl-night-kitchen',content_json:{businessName:'Owner'},settings_json:{}} as any;
    writeDraftRecovery(site.id,{templateId:site.template_id,base:'r1',name:'Owner',content:{businessName:'Owner',tagline:'Unsaved menu'} as any,settings:{} as any});
    assert.equal(readDraftRecovery({...site,template_id:'tmpl-boutique'}),null);
    clearDraftRecovery(site.id,'tmpl-boutique');assert.equal(readDraftRecovery(site)?.content.tagline,'Unsaved menu');
    writeDraftRecovery(site.id,{templateId:'tmpl-boutique',base:'r2',name:'Owner',content:{businessName:'Owner',tagline:'Unsaved shop'} as any,settings:{} as any});
    assert.equal(readDraftRecovery(site)?.content.tagline,'Unsaved menu');
    assert.equal(readDraftRecovery({...site,template_id:'tmpl-boutique'})?.content.tagline,'Unsaved shop');
    store.set('mh_store_checkout:'+site.id,'buyer recovery');forgetDeletedWebsite(site.id,[storage]);assert.deepEqual([...store.keys()],['mh_store_checkout:'+site.id]);
  }finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete (globalThis as any).localStorage;}
});

test('focus selection maps portrait and landscape letterboxing to actual photo coordinates',()=>{
  const portrait=containedPhotoBounds(300,200,100,200);
  assert.deepEqual(containedPhotoFocal(100/3,25,portrait),{x:0,y:25});
  assert.deepEqual(containedPhotoFocal(0,50,portrait),{x:0,y:50});
  assert.deepEqual(containedPhotoFocal(100,50,portrait),{x:100,y:50});
  assert.deepEqual(containedPhotoFocal(75,25,containedPhotoBounds(300,200,300,100)),{x:75,y:0});
});

test('publication summary detects featured bundles, typography and every optional public detail',()=>{
  const before={version:1,templateId:'tmpl-data-reseller',name:'Owner',content:{businessName:'Owner'},settings:{},draftUpdatedAt:'v1',publishedAt:null} as any;
  const changes=websitePublishChanges(before,{templateId:before.templateId,content:{businessName:'Owner',pinnedBundles:['mtn-1gb'],features:['Owner detail'],stats:[{label:'Owner fact',value:'1'}]} as any,settings:{primaryColor:'#123456',accentColor:'#123456',fontFamily:'font-serif',borderRadius:'rounded-xl'}});
  for(const label of ['Featured bundles','Font','Corner style','Feature details','Business facts'])assert.ok(changes.includes(label),label);
});

test('owner-pinned available bundles lead the collapsed list in owner order; stale pins never create offers',()=>{
  const bundles:StoreBundle[]=Array.from({length:10},(_,i)=>({id:`bundle-${i}`,network:'mtn',dataAmount:`${i+1}GB`,priceMinor:(i+1)*500}));
  const pins=['missing','bundle-9','bundle-7'];
  assert.deepEqual(filterBundles(bundles,'all',pins).slice(0,2).map(b=>b.id),['bundle-9','bundle-7']);
  assert.deepEqual(filterBundles(bundles,'featured',pins).map(b=>b.id),['bundle-9','bundle-7']);
  assert.equal(filterBundles(bundles,'all',pins).length,bundles.length);
  assert.ok(!filterBundles(bundles,'all',pins).some(b=>b.id==='missing'));
  assert.equal(bundleFilters(bundles,pins).find(f=>f.id==='featured')?.count,2);
  assert.deepEqual(filterBundles(bundles,'under20',pins).map(b=>b.id),['bundle-0','bundle-1','bundle-2']);
});

test('both flagships use the published owner hero and identity in server HTML, never a newer draft',async()=>{
  assert.equal(process.env.DATABASE_URL,undefined);WebsiteStore.clearDevStore();
  for(const template of ['tmpl-night-kitchen','tmpl-boutique']){
    const hero='https://res.cloudinary.com/da6oeat7m/image/upload/v1790859552/owner-photo.png';
    const site=(await WebsiteStore.createSite(template,{template_id:template,name:'Real owner business',content:{whatsapp:'0241234567',businessName:'Real owner business',heroImage:hero,tagline:'Owner headline'}})).site;
    const published=(await WebsiteStore.publishSite(site.id,template,site.updated_at))!;
    await WebsiteStore.updateSite(site.id,template,{content:{businessName:'Private later name',heroImage:'https://images.unsplash.com/private'},expectedUpdatedAt:published.updated_at});
    const resolved=await resolvePublicSocialMetadata(`/sites/${site.slug}?utm_source=share`);
    assert.equal(resolved.status,200);assert.equal(resolved.head.title,'Real owner business');
    assert.equal(resolved.head.url,`https://mysterybundlehub.com/sites/${site.slug}`);
    assert.ok(resolved.head.image.endsWith('/v1790859552/owner-photo.png'));assert.ok(resolved.head.image.includes('w_1200,h_630'));
    const html=injectSocialHead('<html><head><title>Mystery Hub</title><script type="application/ld+json">platform</script></head></html>',resolved.head,true);
    assert.ok(html.includes('property="og:image"'));assert.ok(!html.includes('Private later')&&!html.includes('application/ld+json')&&!html.includes('QuickByte'));
  }
  const legacy=websiteSocialHead({id:'legacy',slug:'quickbyte-data',name:'Quickbyte data',template_id:'tmpl-data-reseller',content:{businessName:'Quickbyte data',tagline:'Owner headline',heroImage:'https://images.unsplash.com/owner-legacy'},settings:{},published_at:null} as any);
  assert.equal(legacy.title,'Quickbyte data');assert.equal(legacy.image,'https://images.unsplash.com/owner-legacy');assert.equal(legacy.icon,'');
});
