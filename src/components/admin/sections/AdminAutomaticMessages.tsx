import React,{useEffect,useRef,useState} from 'react';
import {AdminPanel,AdminButton,adminField} from '../ui/AdminUi';
import {smsRequest} from '../../../services/smsCommunications';
import {SMS_AUTO_EVENTS,SMS_DEFAULT_AUTO_EVENTS,SMS_EVENT_LABELS} from '../../../../shared/smsTransactional';

export function AdminAutomaticMessages({token,ready,onRefresh}:{token:string;ready:any;onRefresh:()=>void}) {
  const [types,setTypes]=useState<string[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const [versions,setVersions]=useState<Record<string,string>>({});
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  useEffect(()=>{
    const legacy=ready?.autoTypes?.includes('payment_confirmed');
    setTypes(legacy&&!ready.autoEnabled?[...SMS_DEFAULT_AUTO_EVENTS]:(ready?.autoTypes||[]).filter((v:string)=>(SMS_AUTO_EVENTS as readonly string[]).includes(v)));
    setVersions(Object.fromEntries((ready?.automaticTemplates||[]).map((t:any)=>[t.id,t.wordingId])));
  },[ready?.settingsRevision,ready?.automaticTemplates?.map((t:any)=>t.version).join(',')]);
  if(!ready)return <AdminPanel title="Automatic messages"><p role="status">Loading automatic message settings...</p></AdminPanel>;
  const act=async(path:string,input:any,method='PUT')=>{
    if(busy)return;const c=new AbortController();controller.current=c;setBusy(true);setNotice('');
    try{await smsRequest(token,path,input,method,c.signal);if(!c.signal.aborted){setNotice('Saved. The displayed policy will refresh.');onRefresh();}}
    catch(e){if(!c.signal.aborted)setNotice((e as Error).message);}finally{if(!c.signal.aborted)setBusy(false);}
  };
  const save=(enabled:boolean)=>void act('settings',{paused:ready.paused,autoEnabled:enabled,recipientUpdates:false,
    autoTypes:types,expectedRevision:ready.settingsRevision,confirmed:true});
  return <div className="space-y-4">
    <AdminPanel title="Automatic order messages">
      <div className="space-y-4 text-sm">
        <p className={ready.autoEnabled?'text-emerald-200':'text-amber-200'}>{ready.autoEnabled?'Automatic order messages are on.':'Automatic order messages are off.'} {ready.paused?'SMS is paused.':''}</p>
        <p className="text-slate-300">Account customers receive updates on their account number. Guests receive neutral updates on the bundle recipient number. Explicit SMS opt-outs apply. Web Push permission is separate.</p>
        <fieldset className="space-y-2"><legend className="mb-2 font-semibold">Choose the automatic updates</legend>
          {SMS_AUTO_EVENTS.map(kind=><label key={kind} className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-700 px-3 py-2"><input type="checkbox" checked={types.includes(kind)} onChange={e=>setTypes(e.target.checked?[...types,kind]:types.filter(t=>t!==kind))}/><span>{SMS_EVENT_LABELS[kind]}</span></label>)}
        </fieldset>
        <p className="text-xs text-slate-400">One received/processing update, then delivery. Fast deliveries skip stale processing messages. Refunds are optional and off in the rollout default. Registered recipient updates, automatic marketing and reminders are off.</p>
        <div className="flex flex-wrap gap-2">
          <AdminButton disabled={busy||!ready.installed} onClick={()=>save(ready.autoEnabled)}>Save selected policy</AdminButton>
          <AdminButton variant="primary" disabled={busy||!ready.sendReady||!ready.autoConfigured||!types.length} onClick={()=>{if(window.confirm('Enable exactly these selected updates for NEW eligible orders? Existing orders will not be backfilled. Adding an event starts a new cutoff.'))save(true);}}>Enable selected automatic updates</AdminButton>
          <AdminButton disabled={busy||!ready.autoEnabled} onClick={()=>save(false)}>Turn automatic updates off</AdminButton>
        </div>
        <p className="text-xs text-slate-400">Rollout begins: {ready.cutoff?new Date(ready.cutoff).toLocaleString():'Set when automatic updates are enabled'}. Adding an event starts a fresh cutoff for all automatic updates. Daily automatic limit: {ready.limits?.autoDailyCredits} credits. Reserve floor: {ready.limits?.lowCreditThreshold} credits.</p>
        {!ready.autoConfigured&&<p className="text-amber-200">The server automatic-message gate is off. Saving a policy does not change the server gate.</p>}
        {notice&&<p role="status" className="break-words text-emerald-200">{notice}</p>}
      </div>
    </AdminPanel>
    <AdminPanel title="Approved automatic wording">
      <p className="mb-4 text-sm text-slate-300">Compare and publish reviewed wording. Every network, bundle and number comes from the order. Sent messages stay unchanged; pending messages are rechecked. These are examples.</p>
      <div className="grid gap-4 lg:grid-cols-2">{(ready.automaticTemplates||[]).map((t:any)=>{
        const selected=t.variants.find((v:any)=>v.id===(versions[t.id]||t.wordingId))||t.variants[0];
        return <article key={t.id} className="min-w-0 rounded-2xl border border-slate-700 p-4 space-y-3">
          <h3 className="font-semibold">{SMS_EVENT_LABELS[t.id]}</h3>
          <label className="block text-sm">Approved wording<select className={adminField+' mt-1 w-full'} value={versions[t.id]||t.wordingId} onChange={e=>setVersions({...versions,[t.id]:e.target.value})}>{t.variants.map((v:any)=><option key={v.id} value={v.id}>{v.id==='standard'?'Standard':'Concise'}</option>)}</select></label>
          <p className="rounded-xl bg-slate-900 p-3 text-sm leading-relaxed break-words">{selected.example}</p>
          <p className="text-xs text-slate-400">Guest example: {selected.guestExample}</p>
          <p className="text-xs text-emerald-200">{selected.estimate.characters} characters · {selected.estimate.encoding} · {selected.estimate.segments} estimated credit per recipient</p>
          <AdminButton disabled={busy||!ready.installed||(selected.id===t.wordingId&&t.published)} onClick={()=>{if(window.confirm('Publish this reviewed wording for future messages? Order facts stay locked.'))void act('automatic-templates',{id:t.id,wordingId:selected.id,expectedVersion:t.version,confirmed:true},'POST');}}>Publish approved wording</AdminButton>
          <details className="text-xs text-slate-400"><summary className="min-h-10 cursor-pointer">Trigger and version details</summary><p>{t.published?`Published version ${t.version}.`:'Reviewed built-in default; database publication is available.'} {t.id==='order_processing'?'Verified payment and supplier acceptance are required.':t.id==='order_delivered'?'Delivered status, delivery time and fulfillment evidence are required.':'The paid order must be in the active Admin attention queue.'} Version history is available in Templates.</p></details>
        </article>;
      })}</div>
    </AdminPanel>
  </div>;
}
