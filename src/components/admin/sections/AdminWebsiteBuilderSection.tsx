import { AdminResellerControls } from './AdminResellerControls';
import { AdminUltraEnquiries } from './AdminUltraEnquiries';
import React, { useEffect, useRef, useState } from 'react';
import { getAdminWebsiteSummary } from '../../../services/apiClient';
import type { WebsiteAdminSummary, AdminWebsiteRow } from '../../../config/websiteAnalytics';
import { WEBSITE_TEMPLATES } from '../../../data/templates';
import { AdminPageHeader, AdminTabs, AdminStat, AdminLoading, AdminButton, AdminEmpty, StatusPill, adminButton } from '../ui/AdminUi';
import {AdminWebsiteInspect} from './AdminWebsiteInspect';
type BuilderView='websites'|'enquiries'|'reseller';
const title=(id:string)=>WEBSITE_TEMPLATES.find(t=>t.id===id)?.title || id;
export function AdminWebsiteBuilderSection({sessionToken,initialView}:{sessionToken:string;initialView?:string}) {
  const [query,setQuery]=useState({range:'30',search:'',status:'',template:'',offset:0});
  const {range,search,status,template,offset}=query;
  const key=JSON.stringify(query);
  const [loaded,setLoaded]=useState<{token:string;range:string;key:string;data:WebsiteAdminSummary}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0),[selected,setSelected]=useState<AdminWebsiteRow|null>(null),[notice,setNotice]=useState('');
  const results=useRef<HTMLDivElement>(null);
  const revealPending=useRef(false);
  const [reveal,setReveal]=useState(0);
  const data=loaded?.token===sessionToken&&loaded.range===range?loaded.data:null;
  const listReady=Boolean(data&&loaded?.key===key);
  const [view,setView]=useState<BuilderView>(initialView==='enquiries'||initialView==='reseller'?initialView:'websites');
  useEffect(()=>setSelected(null),[sessionToken]);
  useEffect(()=>{
    if(view!=='websites')return;
    let current=true;setLoading(true);setError('');
    const controller=new AbortController();
    const timer=setTimeout(()=>{void getAdminWebsiteSummary(sessionToken,query,controller.signal).then(result=>{if(current){
      if(result.offset>0&&result.offset>=result.total){setQuery(q=>({...q,offset:0}));setNotice('The project count changed. Showing the first page.');return;}
      setLoaded({token:sessionToken,range,key,data:result});setNotice(previous=>previous==='Refreshing website records…'?'Website records refreshed.':previous);
    }}).catch(e=>{if(current&&e.name!=='AbortError'){setError(e.message);setLoaded(null);setNotice('');}}).finally(()=>{if(current)setLoading(false);});},250);
    return ()=>{current=false;clearTimeout(timer);controller.abort();};
  },[sessionToken,key,refresh,view]);
  useEffect(()=>{
    if(!listReady||!revealPending.current)return;
    const frame=requestAnimationFrame(()=>{revealPending.current=false;results.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});results.current?.focus({preventScroll:true});});
    return ()=>cancelAnimationFrame(frame);
  },[listReady,loaded,reveal]);
  const filter=(field:'range'|'search'|'status'|'template',value:string)=>{revealPending.current=false;setNotice('');setQuery(q=>({...q,[field]:value,offset:0}));};
  const showProjects=(nextStatus:string)=>{
    revealPending.current=true;setReveal(n=>n+1);
    setQuery(q=>({...q,status:nextStatus,search:'',template:'',offset:0}));
    setNotice(`${nextStatus==='published'?'Published sites':nextStatus==='draft'?'Draft sites':'All projects'} selected. Search and template filters cleared; the date range is unchanged.`);
  };
  return <section className="space-y-5 text-left min-w-0">
    <AdminPageHeader title="Website Builder" description="Customer websites, Ultra launch enquiries and reseller storefront settings."/>
    <AdminTabs label="Website Builder views" value={view} onChange={setView} tabs={[{id:'websites',label:'Websites',count:data?.metrics.total??null},{id:'enquiries',label:'Ultra enquiries'},{id:'reseller',label:'Reseller settings'}]}/>
    {view==='enquiries'&&<AdminUltraEnquiries token={sessionToken} />}
    {view==='reseller'&&<AdminResellerControls token={sessionToken} defaultOpen/>}
    {view==='websites'&&<>
    <div className="flex flex-wrap gap-2"><input aria-label="Search websites" placeholder="Name, owner, slug or site ID" value={search} onChange={e=>filter('search',e.target.value)} maxLength={100} className="min-h-11 basis-full sm:basis-56 p-2 rounded-xl bg-slate-900 border border-slate-700 min-w-0 flex-1" /><select aria-label="Website date range" value={range} onChange={e=>filter('range',e.target.value)} className="min-h-11 p-2 rounded-xl bg-slate-900 border border-slate-700">{['7','30','90','all'].map(r=><option key={r} value={r}>{r==='all'?'All time':`${r} days`}</option>)}</select><select aria-label="Website status" value={status} onChange={e=>filter('status',e.target.value)} className="min-h-11 p-2 rounded-xl bg-slate-900 border border-slate-700"><option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option></select><select aria-label="Website template" value={template} onChange={e=>filter('template',e.target.value)} className="min-h-11 p-2 rounded-xl bg-slate-900 border border-slate-700 max-w-full"><option value="">All templates</option>{WEBSITE_TEMPLATES.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select><AdminButton busy={loading} onClick={()=>{setNotice('Refreshing website records…');setRefresh(n=>n+1);}}>Refresh</AdminButton></div>
    {notice&&<p role="status" aria-live="polite" className="text-sm text-emerald-300">{notice}</p>}
    {error && <p role="alert" className="text-rose-300">{error}</p>}{loading && !data && <AdminLoading label="Loading websites…"/>}
    {data && <>
      <p className="text-xs text-slate-400">Project metrics and lists use creation date in the selected range; recent publications use publication date. Template/status/search filters apply to the project list.</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{([['Total Website Projects',data.metrics.total,()=>showProjects('')],['Draft Sites',data.metrics.draft,()=>showProjects('draft')],['Published Sites',data.metrics.published,()=>showProjects('published')],['Free Sites',data.metrics.free,undefined]] as Array<[string,number,(()=>void)|undefined]>).map(([label,value,onClick])=><AdminStat key={label} label={label} value={value} onClick={onClick} actionLabel={onClick?`Show ${label.toLowerCase()} in the selected date range`:undefined} tone={label==='Published Sites'?'success':'neutral'}/>)}</div>
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"><h2 className="font-bold">Adoption funnel</h2><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">{[['Unique Builder Visitors',data.funnel.uniqueVisitors],['Template Preview Events',data.funnel.previews],['Build Start Events',data.funnel.buildStarts],['Site Creation Events',data.funnel.created],['Publication Events',data.funnel.published]].map(([label,value])=><div key={label} className="text-sm"><p className="text-xs text-slate-400">{label}</p><strong>{value}</strong></div>)}</div><p className="text-xs text-slate-400">Build Start → Created: {data.funnel.startToCreate===null?'No starts yet':`${data.funnel.startToCreate.toFixed(1)}%`} · Created → Published: {data.funnel.createToPublish===null?'No creations yet':`${data.funnel.createToPublish.toFixed(1)}%`}. Conversions count matched users/sites with ordered actions in this range. Raw events are not people; repeat publications count as events.</p></div>
      <div className="grid sm:grid-cols-2 gap-3">{[['Recently created',data.recentCreated],['Recently published',data.recentPublished]].map(([label,sites])=><div key={label as string} className="p-4 rounded-2xl border border-slate-800 bg-slate-900"><h2 className="font-bold mb-2">{label as string}</h2>{(sites as AdminWebsiteRow[]).length ? (sites as AdminWebsiteRow[]).map(site=><button type="button" key={site.id} onClick={()=>setSelected(site)} className="block text-sm text-emerald-300 py-1 break-all">{site.businessName || site.name}</button>) : <p className="text-xs text-slate-400">No sites in this range.</p>}</div>)}</div>
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900"><h2 className="font-bold mb-3">Template performance</h2>{data.templates.length ? [...data.templates].sort((a,b)=>b.previews-a.previews || b.created-a.created).map(t=><div key={t.templateId} className="flex flex-wrap justify-between gap-2 border-t border-slate-800 py-2 text-xs"><strong>{title(t.templateId)}</strong><span className="text-slate-400">{t.previews} previews · {t.created} created · {t.projects} current projects · {t.published} published projects</span></div>) : <p className="text-xs text-slate-400">No template activity yet.</p>}</div>
      <p className="text-xs text-slate-400">Cloudinary configured: {data.media.configured?'Yes':'No'} · Free limit: {data.media.maxAssets} images / {Math.round(data.media.maxBytes/1024/1024)} MB each · {data.media.ready} ready / {data.media.tracked} tracked · {data.media.cleanupPending} pending cleanup</p>
      <div ref={results} tabIndex={-1} role="region" aria-label="Website project results" className="space-y-3 scroll-mt-24 focus:outline-none">
        <h2 className="font-bold">Website projects · {status==='published'?'Published':status==='draft'?'Drafts':'All statuses'}</h2>
        <p className="text-xs text-slate-400">Created {range==='all'?'at any time':`in the last ${range} days`} · {template?title(template):'All templates'}{search?' · Search applied':''}</p>
        {!listReady?<AdminLoading label="Updating filtered websites…"/>:<>
          <p role="status" aria-live="polite" className="text-sm text-slate-300">{loading?'Refreshing… ':''}{data.total} matching website{data.total===1?'':'s'}</p>
          {data.sites.length?data.sites.map(site=><article key={site.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900 flex flex-wrap gap-3 justify-between"><div className="min-w-0"><h3 className="font-semibold break-words">{site.businessName || site.name}</h3><p className="text-xs text-slate-400 break-words">Owner: {site.ownerName} · {title(site.template_id)} · {site.assetCount} images</p><StatusPill tone={site.status==='published'?'success':'neutral'}>{site.status==='published'?'Published':'Draft'}</StatusPill><p className="text-xs text-slate-500">Created {new Date(site.created_at).toLocaleDateString()} · Updated {new Date(site.updated_at).toLocaleDateString()}</p></div><AdminButton onClick={()=>setSelected(site)} className="text-xs">Inspect Site</AdminButton></article>):<AdminEmpty title="No websites match these filters" action={<AdminButton onClick={()=>showProjects('')}>Clear list filters</AdminButton>}>Try another search or template. The selected creation date range still applies; choose All time to include older projects.</AdminEmpty>}
          <div className="flex flex-wrap justify-between gap-3 text-sm"><button type="button" className={adminButton()} disabled={loading||!offset} onClick={()=>setQuery(q=>({...q,offset:Math.max(0,q.offset-data.limit)}))}>Previous</button><span className="self-center text-slate-400">{data.total ? `${data.offset+1}–${Math.min(data.offset+data.limit,data.total)} of ${data.total}` : '0 sites'}</span><button type="button" className={adminButton()} disabled={loading||offset+data.limit>=data.total} onClick={()=>setQuery(q=>({...q,offset:q.offset+data.limit}))}>Next</button></div>
        </>}
      </div>
    </>}
    </>}
    {selected && <AdminWebsiteInspect token={sessionToken} siteId={selected.id} onClose={()=>setSelected(null)} onUnpublished={()=>{setSelected(null);setNotice('Website unpublished.');setRefresh(n=>n+1);}}/>}
  </section>;
}
