import React,{useEffect,useRef,useState} from 'react';
import {getAdminWebsiteEngagement} from '../../../services/apiClient';
import type {AdminWebsiteEngagement as Evidence} from '../../../config/websiteAnalytics';
import {AdminButton,AdminLoading} from '../ui/AdminUi';

/** Lazy, isolated reporting: contacts remain usable if this request fails. */
export function AdminWebsiteEngagement({token,siteId}:{token:string;siteId:string}){
 const [data,setData]=useState<Evidence|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const request=useRef<AbortController|null>(null),sequence=useRef(0);
 useEffect(()=>()=>{sequence.current++;request.current?.abort();},[]);
 const load=async()=>{
  if(request.current)return;
  const controller=new AbortController(),id=++sequence.current;request.current=controller;setLoading(true);setError('');setData(null);
  try{const result=await getAdminWebsiteEngagement(token,siteId,controller.signal);if(id===sequence.current)setData(result);}
  catch(e){if(id===sequence.current&&(e as Error).name!=='AbortError')setError('Public engagement could not be loaded. Owner details and contacts remain available.');}
  finally{if(id===sequence.current){request.current=null;setLoading(false);}}
 };
 return <section aria-label="Public engagement evidence" className="border-t border-slate-800 pt-4 space-y-3">
  <h3 className="font-semibold">Observed public engagement</h3>
  <p className="text-xs text-slate-400">Last 30 days of recorded public-page events. Editor/template previews are separate; owner or staff visits to the public page may be included. Tracking can be blocked or fabricated. These are not verified customers.</p>
  <AdminButton busy={loading} onClick={()=>void load()}>{error?'Retry engagement':data?'Refresh engagement':'Load public engagement'}</AdminButton>
  {loading&&<AdminLoading label="Loading observed public events…"/>}
  {error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}
  {!data&&!loading&&!error&&<p className="text-sm text-slate-400">Not loaded yet. This read does not open the public site or generate visits.</p>}
  {data&&<>
   <dl className="grid grid-cols-2 gap-3 text-sm">{[
    ['Public view events',data.views],['Approximate browsers',data.approximateBrowsers],['WhatsApp handoff clicks',data.whatsappClicks],['Phone link clicks',data.callClicks],['Email link clicks',data.emailClicks],
   ].map(([label,value])=><div key={label} className="min-w-0"><dt className="text-xs text-slate-400">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>
   <p className="text-xs text-slate-400">{new Date(data.since).toLocaleDateString()} – {new Date(data.through).toLocaleDateString()} · Last recorded event: {data.lastObservedAt?new Date(data.lastObservedAt).toLocaleString():'None in this period'}</p>
   {!data.lastObservedAt&&<p className="text-sm text-slate-300">No recorded public views or contact actions in this period. Missing tracking does not prove there were no visitors.</p>}
  </>}
  <p className="text-xs text-slate-400">Repeated events are deduplicated. A WhatsApp click is a handoff attempt, not proof a message was sent. Link sharing, received enquiries and sales are not measured here.</p>
 </section>;
}
