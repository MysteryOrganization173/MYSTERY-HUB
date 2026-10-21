import {test} from 'node:test';
import * as artwork from '../../../src/utils/dataResellerArtwork';
import * as websiteUndo from '../../../src/utils/websiteUndo';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {transformSync} from 'esbuild';
import {WEBSITE_TEMPLATES} from '../../../src/data/templates';
import {mergeSiteWithTemplate,renderTemplateLayout,getTemplateById} from '../../../src/utils/templateRendererUtils';
import {createWebsiteComposition} from '../../../src/config/websiteBuilder';
import {visualTargets,applyVisualValue,visualValueError,matchesVisualMessage} from '../../../src/utils/websiteVisualEditing';
import {VisualEditContext} from '../../../src/components/website/editor/VisualEditMarkers';

const content={businessName:'Synthetic visual business',tagline:'Original headline',aboutText:'Original description',location:'Accra',phone:'0241234567',whatsapp:'0241234567',email:'owner@example.test',heroImage:'https://example.test/hero.jpg',logoUrl:'https://example.test/logo.png',ctaLabel:'Contact us',ctaTarget:'https://example.test/contact',items:[],stats:[],features:[]};
const settings={primaryColor:'#123456',accentColor:'#7c3aed',backgroundColor:'#ffffff'};
for(const base of WEBSITE_TEMPLATES)test(`${base.id}: real rendered elements have valid controls; public markup is untouched`,()=>{
  const t=mergeSiteWithTemplate(base,content,settings),targets=visualTargets(t);
  const publicHtml=renderToStaticMarkup(renderTemplateLayout(t));
  assert.ok(!publicHtml.includes('data-visual-'));assert.ok(!publicHtml.includes('aria-label="Edit '));
  const editHtml=renderToStaticMarkup(React.createElement(VisualEditContext.Provider,{value:targets},renderTemplateLayout(t)));
  const ids=[...editHtml.matchAll(/data-visual-target="([^"]+)"/g)].map(m=>m[1]);
  for(const id of ids)assert.ok(targets.some(t=>t.id===id),id);
  for(const id of ['content:businessName','content:logoUrl','content:email','content:phone','content:whatsapp'])assert.ok(ids.includes(id),id);
  assert.ok(ids.includes(t.composition ? 'section:hero-1:heading' : 'content:tagline'));
  assert.equal(editHtml.replace(/ data-visual-target="[^"]*"| data-visual-empty="[^"]*"| tabindex="0"| aria-label="Edit [^"]*"/g,''),publicHtml);
});
test('stable section IDs create an override without editing inherited global content or siblings',()=>{
  const composition=createWebsiteComposition(['header','hero','about','contact','footer']);
  composition.sections[2].data={body:'Separate about body'};
  const c={...content,composition},t=mergeSiteWithTemplate(WEBSITE_TEMPLATES[0],c,settings);
  const target=visualTargets(t).find(t=>t.id==='section:hero-1:body')!;assert.equal(target.value,content.aboutText);assert.equal(target.inherited,true);
  const next=applyVisualValue(c,settings,t,target.id,'Hero override')!;
  assert.equal(next.content.aboutText,content.aboutText);assert.deepEqual(next.content.composition!.sections[2],composition.sections[2]);assert.equal(next.content.composition!.sections[1].data.body,'Hero override');assert.equal(composition.sections[1].data.body,undefined);
  const reordered={...c,composition:{...composition,sections:[...composition.sections].reverse()}};
  assert.equal(applyVisualValue(reordered,settings,mergeSiteWithTemplate(t,reordered),target.id,'Still the hero')!.content.composition!.sections.find(s=>s.id==='hero-1')!.data.body,'Still the hero');
});
test('disabled, removed, unknown and executable-looking targets cannot mutate draft state',()=>{
  const c={...content,composition:createWebsiteComposition()};c.composition.sections[1].enabled=false;
  const t=mergeSiteWithTemplate(WEBSITE_TEMPLATES[0],c,settings);
  for(const id of ['section:hero-1:heading','section:missing:body','content:__proto__','content:constructor','content:wholesaleCost','settings:paystackKey','window.alert(1)'])assert.equal(applyVisualValue(c,settings,t,id,'unsafe'),null);
  assert.equal(Object.getPrototypeOf(c),Object.prototype);
});
test('managed CTA label is editable but protected destination, price and supplier settings are unavailable',()=>{
  const t=mergeSiteWithTemplate(getTemplateById('tmpl-data-reseller'),content,settings);
  assert.ok(visualTargets(t).some(x=>x.id==='content:ctaLabel'));
  assert.ok(!visualTargets(t).some(x=>x.id==='content:ctaTarget'));
  assert.equal(applyVisualValue(content,settings,t,'content:ctaTarget','https://evil.test'),null);
  const c={...content,composition:createWebsiteComposition()},composed=mergeSiteWithTemplate(t,c);
  assert.ok(!visualTargets(composed).some(x=>x.id==='section:hero-1:ctaUrl'));
});
test('existing validation rejects unsafe text, bad email, contact, image URL and oversized input',()=>{
  const t=mergeSiteWithTemplate(WEBSITE_TEMPLATES[0],content,settings);
  for(const [id,value]of [['content:businessName','<script>x</script>'],['content:tagline','x'.repeat(151)],['content:aboutText','javascript:alert(1)'],['content:email','bad'],['content:phone','abcd'],['content:heroImage','javascript:alert(1)'],['content:heroImage','https://user:secret@example.test/a.jpg'],['settings:accentColor','red']])assert.equal(applyVisualValue(content,settings,t,id,value),null,id);
  assert.equal(visualValueError(visualTargets(t).find(t=>t.id==='content:phone')!,'+233 24 123 4567'),'');
  const c={...content,composition:createWebsiteComposition()},composed=mergeSiteWithTemplate(t,c);
  assert.equal(applyVisualValue(c,settings,composed,'section:hero-1:image','/relative.jpg'),null,'section images follow existing full-URL validation');
});
test('branding changes settings only and preserves site identity and content',()=>{
  const t=mergeSiteWithTemplate(WEBSITE_TEMPLATES[0],content,settings);
  const next=applyVisualValue(content,settings,t,'settings:accentColor','#e8790c')!;
  assert.equal(next.content,content);assert.equal(next.settings.accentColor,'#e8790c');assert.equal(settings.accentColor,'#7c3aed');
});
test('message envelope requires origin, exact Window, channel, site, template and known type',()=>{
  const source={} as Window,identity={channel:'current-frame',siteId:'current-site',templateId:'current-template'};
  const valid={origin:'https://owner.example',source,data:{type:'MYSTERYHUB_VISUAL_SELECT',...identity,targetId:'content:tagline'}};
  const check=(e:any)=>matchesVisualMessage(e,valid.origin,source,identity,'MYSTERYHUB_VISUAL_SELECT');
  assert.equal(check(valid),true);
  for(const event of [{...valid,origin:'https://evil.example'},{...valid,source:{}},{...valid,source:null},...Object.entries({channel:'old-frame',siteId:'old-site',templateId:'old-template',type:'UNKNOWN'}).map(([key,value])=>({...valid,data:{...valid.data,[key]:value}})),{...valid,data:null}])assert.equal(check(event),false);
});

// Execute the real editor's draft/save/publish handlers without any network or provider.
const compiled=transformSync(readFileSync('src/components/website/editor/WebsiteEditor.tsx','utf8'),{loader:'tsx',format:'cjs'}).code;
function editorHarness(){
  const cells:any[]=[],effects:Array<()=>void>=[],timers=new Map<number,()=>void>();let cursor=0,timerId=0;
  const calls={saved:[] as any[],published:[] as any[],toasts:[] as string[]};
  let saveFailure=false,publishFailure=false,releaseSave:(()=>void)|undefined,pauseSave=false;
  const initial={id:'synthetic-site',user_id:'synthetic-owner',template_id:'tmpl-accra-build',name:'Synthetic',slug:'synthetic',content_json:content,settings_json:settings,status:'published',updated_at:'revision-1'} as any;
  const react:any={createElement:(type:any,props:any,...children:any[])=>({type,props:{...props,children}}),
    useState:(init:any)=>{const i=cursor++;if(!(i in cells))cells[i]=typeof init==='function'?init():init;return[cells[i],(v:any)=>{cells[i]=typeof v==='function'?v(cells[i]):v;}];},
    useRef:(init:any)=>{const i=cursor++;return cells[i]??(cells[i]={current:init});},
    useEffect:(fn:any,deps:any[])=>{const i=cursor++,old=cells[i];if(!old||deps.some((d,j)=>!Object.is(d,old.deps[j]))){effects.push(()=>{old?.cleanup?.();cells[i]={deps,cleanup:fn()};});}}
  };
  const toolbar=()=>null,panel=()=>null,sheet=()=>null;
  const api={updateWebsiteOnServer:async(_token:string,_id:string,input:any)=>{calls.saved.push(input);if(pauseSave)await new Promise<void>(resolve=>{releaseSave=resolve;});if(saveFailure)throw Error('Synthetic save failure');return {site:{...initial,content_json:input.content,settings_json:input.settings,updated_at:'revision-'+(calls.saved.length+1)}};},publishWebsiteOnServer:async(_token:string,_id:string,revision:string)=>{calls.published.push(revision);if(publishFailure)throw Error('Synthetic publication failure');return {success:true,site:{...initial,updated_at:revision}};},unpublishWebsiteOnServer:async()=>({success:true,site:{...initial,status:'draft'}}),getWebsiteByIdOnServer:async()=>({site:initial}),WebsiteSaveConflict:class extends Error{}};
  const modules:any={react,'./VisualContextPanel':{VisualContextPanel:panel},'./WebsiteEditorToolbar':{WebsiteEditorToolbar:toolbar},'../../../utils/websiteVisualEditing':{visualTargets,applyVisualValue},'../WebsitePreviewFrame':{WebsitePreviewFrame:'iframe'},'./WebsiteImageField':{},'../../../utils/websiteAnalytics':{trackWebsiteEvent(){}},'../../../services/apiClient':api,'../../../utils/templateRendererUtils':{getTemplateById,mergeSiteWithTemplate},'../../../context/AppContext':{useApp:()=>({openMysteryAi(){}})},'./WebsiteSectionsControl':{},'../SafeImage':{},'./WebsiteItemPanel':{WebsiteItemPanel:()=>null},'./WebsiteItemsList':{WebsiteItemsList:()=>null},'./WebsitePublishSheet':{WebsitePublishSheet:sheet},'./WebsiteLayoutAndHistory':{WebsiteLayoutControl:()=>null,WebsiteHistoryControl:()=>null},'../../../services/websiteB1Api':{publishWebsiteB1:(token:string,id:string,revision:string)=>api.publishWebsiteOnServer(token,id,revision),WebsiteB1Error:class extends Error{}},'../../../config/websiteStarters':{websiteItemVocabulary:()=>({singular:'Project',plural:'Projects',many:'projects'})},'../../../config/websiteBuilder':{websiteTemplateItemFields:()=>['name','desc','image']},'../../../utils/websiteLayout':{websiteLayoutMode:()=>'template'},'../../../utils/dataResellerArtwork':artwork,'./WebsiteDraftSafety':{WebsiteConflictSheet:()=>null,WebsiteRecoveryBanner:()=>null,readDraftRecovery:()=>null,writeDraftRecovery(){},clearDraftRecovery(){}},'./WebsiteV5Controls':{},'../../../utils/websiteUndo':websiteUndo,'../../../config/websiteContentV5':{WEBSITE_SECTION_REGISTRY:{}},'../../../utils/websitePublishChanges':{websitePublishChanges:()=>[]},'../../../utils/websiteDraftRecovery':{withV5Clears:(_s:any,d:any)=>d},'lucide-react':new Proxy({},{get:()=>()=>null})};
  const module={exports:{} as any};runInNewContext(compiled,{module,exports:module.exports,require:(key:string)=>{assert.ok(modules[key],key);return modules[key];},window:{innerWidth:1280,location:{origin:'https://synthetic.test'},addEventListener(){},removeEventListener(){},confirm:()=>true},localStorage:{getItem:()=> 'dismissed'},setTimeout:(fn:()=>void)=>{timers.set(++timerId,fn);return timerId;},clearTimeout:(id:number)=>timers.delete(id)});
  const render=()=>{cursor=0;const tree=module.exports.WebsiteEditor({site:initial,sessionToken:'synthetic',onClose(){},onSiteUpdated(){},showToast:(m:string)=>calls.toasts.push(m)});while(effects.length)effects.shift()!();return tree;};
  const nodes=(tree:any):any[]=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
  const find=(type:any)=>nodes(render()).find(n=>n.type===type)?.props;
  render();render();
  const choose=(id:string)=>{const frame=nodes(render()).find(n=>n.type==='iframe');frame.props.onSelect(id);return find(panel);};
  const publish=()=>{find(toolbar).onPublish();return find(sheet).onPublish();};
  return {calls,choose,publish,toolbar:()=>find(toolbar),panel:()=>find(panel),render,failSave:()=>saveFailure=true,failPublish:()=>publishFailure=true,pauseSave:()=>pauseSave=true,resumeSave:()=>{pauseSave=false;releaseSave?.();},autosave:()=>{for(const fn of timers.values())fn();timers.clear();},initial};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('context edit updates the shared draft, dirty status and debounced autosave revision',async()=>{
  const h=editorHarness();h.choose('content:tagline').onChange('content:tagline','Edited on canvas');h.render();assert.equal(h.toolbar().status,'unsaved');h.autosave();await tick();
  assert.equal(h.calls.saved[0].content.tagline,'Edited on canvas');assert.equal(h.calls.saved[0].expectedUpdatedAt,'revision-1');assert.equal(h.toolbar().status,'saved');
});
test('failed save preserves edited draft, reports error and blocks publication',async()=>{
  const h=editorHarness();h.choose('content:tagline').onChange('content:tagline','Keep this edit');h.failSave();h.publish();await tick();assert.equal(h.calls.published.length,0);assert.equal(h.toolbar().status,'failed','V5: a failed save says so, not just "unsaved"');assert.equal(h.choose('content:tagline').targets[0].value,'Keep this edit');assert.ok(h.calls.toasts.some(t=>t.includes('save failure')));
});
test('an edit during a save remains dirty and cannot publish an unacknowledged revision',async()=>{
  const h=editorHarness();h.choose('content:tagline').onChange('content:tagline','First');h.pauseSave();h.toolbar().onSave();await tick();h.choose('content:tagline').onChange('content:tagline','Later');h.resumeSave();await tick();assert.equal(h.calls.saved[0].content.tagline,'First');assert.equal(h.toolbar().status,'unsaved');assert.equal(h.choose('content:tagline').targets[0].value,'Later');h.failSave();h.publish();await tick();assert.equal(h.calls.published.length,0);
});
test('mode switches clear contextual editing but retain unsaved values; template identity clears stale selection',()=>{
  const h=editorHarness();h.choose('content:tagline').onChange('content:tagline','Unpublished');h.toolbar().onMode('preview');assert.equal(h.panel(),undefined);h.toolbar().onMode('edit');assert.equal(h.choose('content:tagline').targets[0].value,'Unpublished');h.initial.template_id='tmpl-data-reseller';h.render();h.render();assert.equal(h.panel(),undefined);
});
test('publication uses saved revision, failed publication preserves draft, and unpublish remains available',async()=>{
  const h=editorHarness();h.choose('content:tagline').onChange('content:tagline','Ready');h.publish();await tick();assert.equal(h.calls.published[0],'revision-2');h.failPublish();h.publish();await tick();assert.ok(h.calls.toasts.includes('Synthetic publication failure'));h.toolbar().onUnpublish();await tick();assert.equal(h.toolbar().published,false);
});

test('real frame listener rejects stale/foreign/unsupported selections and cleans up on unmount',()=>{
  const source={postMessage(){}} as unknown as Window,calls:any[]=[],listeners=new Set<(event:any)=>void>(),effects:Array<()=>void|(()=>void)>=[],cells:any[]=[];let cursor=0,nextChannel=0;
  const react:any={createElement:(type:any,props:any)=>({type,props}),useRef:(initial:any)=>{const i=cursor++;return cells[i]??(cells[i]={current:initial});},useMemo:(fn:any,deps:any[])=>{const i=cursor++;if(!cells[i]||deps.some((d,j)=>d!==cells[i].deps[j]))cells[i]={deps,value:fn()};return cells[i].value;},useEffect:(fn:any)=>effects.push(fn)};
  const windowMock={location:{origin:'https://owner.example'},addEventListener:(_type:string,fn:any)=>listeners.add(fn),removeEventListener:(_type:string,fn:any)=>listeners.delete(fn)};
  const module={exports:{} as any},code=transformSync(readFileSync('src/components/website/WebsitePreviewFrame.tsx','utf8'),{loader:'tsx',format:'cjs'}).code;
  runInNewContext(code,{module,exports:module.exports,require:(id:string)=>id==='react'?react:{matchesVisualMessage,visualTargets},window:windowMock,crypto:{randomUUID:()=>`frame-${++nextChannel}`}});
  const template=mergeSiteWithTemplate(getTemplateById('tmpl-accra-build'),content,settings);
  const render=(siteId='site-a',editMode=true)=>{cursor=0;return module.exports.WebsitePreviewFrame({template,siteId,editMode,onSelect:(id:any)=>calls.push(id)});};
  const frame=render();frame.props.ref.current={contentWindow:source};const cleanup=effects.map(fn=>fn());
  const identity={siteId:'site-a',templateId:template.id,channel:'frame-1'};
  const fire=(patch:any={},targetId:any='content:tagline')=>{for(const receive of listeners)receive({origin:windowMock.location.origin,source,data:{type:'MYSTERYHUB_VISUAL_SELECT',...identity,targetId},...patch});};
  fire();assert.deepEqual(calls,['content:tagline']);
  fire({origin:'https://evil.example'});fire({source:{}});
  for(const target of ['content:__proto__','content:missing','settings:accentColor',{},['content:tagline']])fire({},target);
  assert.equal(calls.length,1);render('site-a',false);fire();assert.equal(calls.length,1);render('site-b');fire();assert.equal(calls.length,1);
  cleanup.forEach(fn=>fn?.());assert.equal(listeners.size,0);
});

test('frame forwards All Settings hints and validated reading order only from the current editor frame',()=>{
  const source={postMessage(){}} as unknown as Window,selects:any[]=[],orders:any[]=[],listeners=new Set<(event:any)=>void>(),effects:Array<()=>void|(()=>void)>=[],cells:any[]=[];let cursor=0;
  const react:any={createElement:(type:any,props:any)=>({type,props}),useRef:(initial:any)=>{const i=cursor++;return cells[i]??(cells[i]={current:initial});},useMemo:(fn:any,deps:any[])=>{const i=cursor++;if(!cells[i]||deps.some((d,j)=>d!==cells[i].deps[j]))cells[i]={deps,value:fn()};return cells[i].value;},useEffect:(fn:any)=>effects.push(fn)};
  const windowMock={location:{origin:'https://owner.example'},addEventListener:(_type:string,fn:any)=>listeners.add(fn),removeEventListener:(_type:string,fn:any)=>listeners.delete(fn)};
  const module={exports:{} as any},code=transformSync(readFileSync('src/components/website/WebsitePreviewFrame.tsx','utf8'),{loader:'tsx',format:'cjs'}).code;
  runInNewContext(code,{module,exports:module.exports,require:(id:string)=>id==='react'?react:{matchesVisualMessage,visualTargets},window:windowMock,crypto:{randomUUID:()=>'frame-1'}});
  const template=mergeSiteWithTemplate(getTemplateById('tmpl-buka-bistro'),content,settings);
  const frame=module.exports.WebsitePreviewFrame({template,siteId:'site-a',editMode:true,onSelect:(id:any,hint:any)=>selects.push([id,hint]),onOrder:(ids:any)=>orders.push(ids)});
  frame.props.ref.current={contentWindow:source};effects.forEach(fn=>fn());
  const identity={siteId:'site-a',templateId:template.id,channel:'frame-1'};
  const fire=(data:any,patch:any={})=>{for(const receive of listeners)receive({origin:windowMock.location.origin,source,data:{...identity,...data},...patch});};
  fire({type:'MYSTERYHUB_VISUAL_SELECT',targetId:null,hint:'settings'});
  fire({type:'MYSTERYHUB_VISUAL_SELECT',targetId:null,hint:'navigate'});
  assert.deepEqual(selects,[[null,'settings'],[null,undefined]]);
  fire({type:'MYSTERYHUB_VISUAL_ORDER',targetIds:['content:businessName','content:tagline','settings:accentColor','content:__proto__',{}]});
  assert.deepEqual(orders,[['content:businessName','content:tagline']]);
  fire({type:'MYSTERYHUB_VISUAL_ORDER',targetIds:['content:tagline']},{source:{}});
  fire({type:'MYSTERYHUB_VISUAL_ORDER',targetIds:['content:tagline'],channel:'old-frame'});
  fire({type:'MYSTERYHUB_VISUAL_ORDER',targetIds:'content:tagline'});
  assert.equal(orders.length,1);
});
test('contextual labels use plain words for owners',()=>{
  const labels=visualTargets(mergeSiteWithTemplate(getTemplateById('tmpl-buka-bistro'),content,settings)).map(t=>t.label);
  for(const label of ['Main heading','Short description','Main photo','Main button text','Button link','Logo'])assert.ok(labels.includes(label),label);
  for(const label of labels)assert.ok(!/hero|destination/i.test(label),label);
});
