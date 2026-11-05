/** Local synthetic pilot evidence only; never contains production customer contacts. */
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AdminWebsiteBuilderSection} from '../../../../src/components/admin/sections/AdminWebsiteBuilderSection';
const now=Date.now(),iso=(n:number)=>new Date(n).toISOString();
const sites=Array.from({length:31},(_,i)=>({id:`site_review_${i}`,name:`Project ${i}`,businessName:`Business ${i}`,slug:`review-site-${i}`,user_id:`owner-${i}`,ownerName:`Owner ${i}`,template_id:i%2?'tmpl-boutique':'tmpl-legon-consult',status:i%2?'draft':'published',created_at:iso(now-(i===30?40*86400000:i*3600000)),updated_at:iso(now),published_at:i%2?null:iso(now-i*60000),assetCount:0,publicUrl:i%2?null:`/sites/review-site-${i}`}));
sites.push({...sites[30],id:'site_review_31',slug:'review-site-31',name:'New draft for an existing published owner',businessName:'Second project',status:'draft',published_at:null,publicUrl:null,created_at:iso(now)});
const stage=(s:typeof sites[number])=>s.user_id==='owner-0'?'excluded':sites.some(other=>other.user_id===s.user_id&&other.status==='published')?'published_owner':'draft_only';
const controls={requests:[] as string[],mutations:0,failSummary:false,failDetail:false,failUnpublish:false,holdNextDetail:false,copyFails:false,clipboard:'',failEngagement:false,holdEngagement:false,badEngagement:false,oldBackend:false,empty:false,switchToken:(_value:string)=>{},rename:()=>{sites[0].businessName='Refreshed business';}};
(window as any).__websiteFixture=controls;
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(value:string)=>{if(controls.copyFails)throw Error('Synthetic clipboard unavailable');controls.clipboard=value;}}});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
window.fetch=async(input,options)=>{
  const url=new URL(String(input),location.origin),path=url.pathname;controls.requests.push(path+url.search);
  if((options?.headers as any)?.Authorization!=='Bearer synthetic-admin')return json({error:'Unauthorized'},403);
  if(path==='/api/admin/website-builder'){
    if(controls.failSummary)return json({error:'Synthetic list unavailable'},503);
    const activation=url.searchParams.get('activation')||'';
    const range=url.searchParams.get('range')||'30',search=(url.searchParams.get('search')||'').toLowerCase(),status=url.searchParams.get('status'),template=url.searchParams.get('template'),offset=Number(url.searchParams.get('offset')||0);
    const cutoff=range==='all'?0:now-Number(range)*86400000,period=(controls.empty?[]:sites).filter(s=>Date.parse(s.created_at)>=cutoff),filtered=period.filter(s=>(!activation||(activation==='eligible'?stage(s)!=='excluded':stage(s)===activation))&&(!status||s.status===status)&&(!template||s.template_id===template)&&(!search||[s.name,s.businessName,s.ownerName,s.id,s.slug].some(v=>v.toLowerCase().includes(search))));
    // Ignore AbortSignal deliberately: stale-response guards must still work.
    if(search==='slow')await new Promise(r=>setTimeout(r,600));
    return json({success:true,activation:controls.oldBackend?undefined:controls.empty?{customerOwners:0,publishedOwners:0,draftOnlyOwners:0,excludedProjects:0}:{customerOwners:30,publishedOwners:15,draftOnlyOwners:15,excludedProjects:1},sites:filtered.slice(offset,offset+25).map(s=>({...s,ownerStage:stage(s)})),total:filtered.length,limit:25,offset,metrics:{total:period.length,published:period.filter(s=>s.status==='published').length,draft:period.filter(s=>s.status==='draft').length,free:period.length},recentCreated:period.slice(0,5),recentPublished:sites.filter(s=>s.status==='published').slice(0,5),templates:[],funnel:{uniqueVisitors:1,previews:5,buildStarts:2,created:31,published:50,uniqueBuildStarters:1,uniqueCreators:31,startToCreate:100,createToPublish:50},media:{configured:false,maxAssets:10,maxBytes:5000000,ready:0,tracked:0,cleanupPending:0}});
  }
  const engagement=path.match(/^\/api\/admin\/website-builder\/(site_review_\d+)\/engagement$/);
  if(engagement){
    if(controls.holdEngagement){controls.holdEngagement=false;await new Promise(r=>setTimeout(r,700));}
    if(controls.failEngagement){controls.failEngagement=false;return json({error:'Synthetic analytics unavailable'},503);}
    if(controls.badEngagement){controls.badEngagement=false;return json({success:true});}
    const empty=engagement[1]==='site_review_1';
    return json({success:true,engagement:{since:iso(now-30*86400000),through:iso(now),views:empty?0:12,approximateBrowsers:empty?0:8,whatsappClicks:empty?0:3,callClicks:0,emailClicks:0,lastObservedAt:empty?null:iso(now-100000)}});
  }
  const match=path.match(/^\/api\/admin\/website-builder\/(site_review_\d+)(\/force-unpublish)?$/);
  if(match){
    const site=sites.find(s=>s.id===match[1]);if(!site)return json({error:'Not found'},404);
    if(match[2]){controls.mutations++;await new Promise(r=>setTimeout(r,100));if(controls.failUnpublish)return json({error:'Synthetic unpublish unavailable'},503);if(JSON.parse(String(options?.body)).confirmation!==site.slug)return json({error:'Confirmation required'},400);site.status='draft';site.publicUrl=null;return json({success:true});}
    if(controls.holdNextDetail){controls.holdNextDetail=false;await new Promise(r=>setTimeout(r,500));}
    if(controls.failDetail){controls.failDetail=false;return json({error:'Synthetic inspection unavailable'},503);}
    const n=Number(site.id.split('_').at(-1));
    return json({success:true,site:{...site,owner:{name:site.ownerName,email:`private-owner-${n}@fixture.test`,phone:n===1?null:`+23359${String(n).padStart(7,'0')}`},businessContact:{phone:`024${String(n).padStart(7,'0')}`,whatsapp:n===1?null:`020${String(n).padStart(7,'0')}`,email:`business-${n}@fixture.test`}}});
  }
  throw Error('Unexpected fixture request');
};
function App(){const [token,setToken]=useState('synthetic-admin');controls.switchToken=setToken;return <><header aria-label="Synthetic Admin header" className="sticky top-0 z-40 h-16 bg-slate-950 p-4">Hub Admin · Synthetic pilot records</header><main className="p-4 min-w-0"><AdminWebsiteBuilderSection sessionToken={token}/></main></>;}
createRoot(document.getElementById('root')!).render(<App/>);
