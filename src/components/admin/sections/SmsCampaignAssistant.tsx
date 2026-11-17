import React,{useEffect,useRef,useState} from 'react';
import {AdminButton,adminField} from '../ui/AdminUi';
import {smsRequest} from '../../../services/smsCommunications';
import {SMS_CAMPAIGN_GOALS} from '../../../../shared/smsStudio';
import {smsEstimate} from '../../../utils/manualSms';

export function SmsCampaignAssistant({token,disabled,onChoose,onSave}:{token:string;disabled?:boolean;onChoose:(s:string,meta:any)=>void;onSave:(s:string,meta:any)=>void}) {
  const [brief,setBrief]=useState({goal:'availability',audience:'direct_customers',service:'data',network:'all',keyFacts:'',tone:'friendly',desiredSegments:1,cta:'Check current services before ordering.',officialLink:'website',channelConfirmed:false,verifiedOffer:false,performanceConfirmed:false});
  const [meta,setMeta]=useState<any>({purpose:'marketing'}),[proposals,setProposals]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const request=useRef<AbortController|null>(null);
  useEffect(()=>{request.current?.abort();setBusy(false);setProposals([]);},[JSON.stringify(brief),disabled]);
  useEffect(()=>()=>request.current?.abort(),[]);
  const ask=async()=>{if(busy||disabled)return;const c=new AbortController();request.current=c;setBusy(true);setError('');try{const r=await smsRequest(token,'draft',{brief},'POST',c.signal);if(!c.signal.aborted){setMeta({purpose:r.purpose==='operational'?'operational':'marketing',channelUrl:r.channelUrl,channelConfirmed:r.channelConfirmed===true});setProposals(r.alternatives);};}catch(e){if(!c.signal.aborted)setError((e as Error).message);}finally{if(!c.signal.aborted)setBusy(false);}};
  const field=(key:keyof typeof brief,label:string,options:[string,string][])=> <label className="block min-w-0 text-sm">{label}<select className={adminField+' w-full mt-1'} value={String(brief[key])} onChange={e=>setBrief({...brief,[key]:key==='desiredSegments'?Number(e.target.value):e.target.value})}>{options.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>;
  return <div className="space-y-4">
    <p className="text-sm text-slate-300">Start with a goal and verified facts. Choose or edit a proposal before reviewing recipients and credits. AI never sends messages.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {field('goal','Message goal',SMS_CAMPAIGN_GOALS.map(([id,label])=>[id,label]))}
      {field('audience','Writing audience',[['direct_customers','Direct customers'],['repeat_buyers','Repeat buyers'],['inactive_buyers','Inactive buyers'],['new_customers','New customers'],['custom_audience','My selected audience']])}
      {field('service','Service',[['data','Data bundles'],['digital_services','Digital services'],['marketplace','Marketplace']])}
      {field('network','Relevant network',[['all','MTN, Telecel and AirtelTigo'],['mtn','MTN'],['telecel','Telecel'],['airteltigo','AirtelTigo'],['none','No network mention']])}
      {field('tone','Tone',[['friendly','Friendly'],['professional','Professional'],['upbeat','Upbeat'],['reassuring','Reassuring']])}
      {field('desiredSegments','Target length',[['1','One SMS segment'],['2','Up to two segments']])}
      {field('officialLink','Call-to-action link',[['website','Official website'],['channel','Official WhatsApp Channel'],['none','No link']])}
    </div>
    <label className="block text-sm">Verified facts (no personal details)<textarea className={adminField+' mt-1 min-h-24 w-full'} maxLength={500} value={brief.keyFacts} onChange={e=>setBrief({...brief,keyFacts:e.target.value})} placeholder="Only facts you have checked. Leave blank for a general invitation to check current services."/></label>
    <label className="block text-sm">Call to action<input className={adminField+' mt-1 w-full'} value={brief.cta} maxLength={160} onChange={e=>setBrief({...brief,cta:e.target.value})}/></label>
    {brief.goal==='offer'&&<label className="flex gap-3 text-sm"><input type="checkbox" checked={brief.verifiedOffer} onChange={e=>setBrief({...brief,verifiedOffer:e.target.checked})}/>I verified the offer and included its actual terms above.</label>}
    {/instant|express|moving fast|fast delivery/i.test(brief.keyFacts)&&<label className="flex gap-3 text-sm"><input type="checkbox" checked={brief.performanceConfirmed} onChange={e=>setBrief({...brief,performanceConfirmed:e.target.checked})}/>I verified the current delivery-performance claim.</label>}
    {brief.officialLink==='channel'&&<label className="flex gap-3 text-sm"><input type="checkbox" checked={brief.channelConfirmed} onChange={e=>setBrief({...brief,channelConfirmed:e.target.checked})}/>I verified the official channel link.</label>}
    <p className="text-xs text-slate-400">Choose actual recipients in Campaigns & Audiences. Keep customer lists, phone numbers, order records and credentials out of the brief.</p>
    <AdminButton disabled={busy||disabled} variant="primary" onClick={()=>void ask()}>{busy?'Drafting proposals...':'Draft campaign ideas'}</AdminButton>
    {disabled&&<p className="text-xs text-amber-200">Automatic order facts use approved wording in Automatic Messages.</p>}
    {error&&<p role="alert" className="break-words text-sm text-rose-300">{error}</p>}
    <div className="space-y-3">{proposals.map((text,i)=>{const estimate=smsEstimate(text);return <article key={i} className="space-y-3 rounded-2xl border border-emerald-900 bg-emerald-950/20 p-4"><p className="text-sm leading-relaxed break-words">{text}</p><p className="text-xs text-slate-400">{estimate.characters} characters · {estimate.encoding} · {estimate.segments} estimated credits per recipient</p><div className="flex flex-wrap gap-2"><AdminButton onClick={()=>{onChoose(text,meta);setProposals([]);}}>Use and edit this proposal</AdminButton><AdminButton onClick={()=>onSave(text,meta)}>Save proposal as template</AdminButton><AdminButton onClick={()=>setProposals(proposals.filter((_,n)=>n!==i))}>Discard</AdminButton></div></article>;})}</div>
  </div>;
}
