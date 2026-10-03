import React,{useEffect,useState} from 'react';
import {adminEarnRequest,type AdminEarnRule,type AdminEarnPolicy} from '../../../services/apiClient';
import {AdminEarnDialog,earnButton,earnInput,earnMoney} from './AdminEarnUi';

const services=['data','airtime','instant_bundle','marketplace','website_builder','all'];
const blank={service_type:'data',network:'',product_key:'',purchase_stage:'any',reward_type:'fixed_minor',value:'0.00',enabled:false,starts_at:'',ends_at:''};
const datetime=(value:string|null|undefined)=>value?new Date(value).toISOString().slice(0,-1):'';
export const AdminEarnRules:React.FC<{sessionToken:string;refreshKey?:number}> = ({sessionToken,refreshKey})=>{
  const [rules,setRules]=useState<AdminEarnRule[]>([]);const [policy,setPolicy]=useState<AdminEarnPolicy>([]);
  const [form,setForm]=useState<typeof blank&{id?:string}|null>(null);const [error,setError]=useState('');const [warnings,setWarnings]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const [confirm,setConfirm]=useState(false);const [reload,setReload]=useState(0);
  useEffect(()=>{let active=true;setLoading(true);Promise.all([adminEarnRequest<{rules:AdminEarnRule[]}>(sessionToken,'rules'),adminEarnRequest<{policy:AdminEarnPolicy}>(sessionToken,'policy')])
    .then(([r,p])=>{if(active){setRules(r.rules);setPolicy(p.policy);setError('');}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[sessionToken,reload,refreshKey]);
  const edit=(rule:AdminEarnRule)=>{setError('');setWarnings([]);setForm({id:rule.id,service_type:rule.service_type,network:rule.network||'',product_key:rule.product_key||'',purchase_stage:rule.purchase_stage,
    reward_type:rule.reward_type,value:((rule.reward_type==='fixed_minor'?rule.reward_minor:rule.reward_percent_bps)!/100).toFixed(2),enabled:rule.enabled,starts_at:datetime(rule.starts_at),ends_at:datetime(rule.ends_at)});};
  const save=async()=>{if(!form)return;setBusy(true);setError('');try{
    const units=Number(form.value)*100;if(!Number.isFinite(units)||Math.abs(units-Math.round(units))>0.000001)throw new Error('Use at most two decimal places.');
    const result=await adminEarnRequest<{warnings:string[]}>(sessionToken,'rules',{}, {id:form.id,service_type:form.service_type,network:form.network||null,product_key:form.product_key||null,
      purchase_stage:form.purchase_stage,reward_type:form.reward_type,reward_minor:form.reward_type==='fixed_minor'?Math.round(units):null,
      reward_percent_bps:form.reward_type==='percent_bps'?Math.round(units):null,enabled:form.enabled,confirmEnable:form.enabled,
      starts_at:form.starts_at?new Date(`${form.starts_at}Z`).toISOString():null,ends_at:form.ends_at?new Date(`${form.ends_at}Z`).toISOString():null},'POST');
    setWarnings(result.warnings);setForm(null);setConfirm(false);setReload(n=>n+1);
  }catch(e){setError(e instanceof Error?e.message:'Could not save rule.');setConfirm(false);}finally{setBusy(false);}};
  return <div className="space-y-4">
    <div className="p-4 bg-[#0f171d] rounded-2xl border border-slate-800 space-y-3"><h3 className="font-bold">Recommended Data Referral Policy</h3>
      <p className="text-xs text-slate-400">Read-only recommendation. Review each rule in the editor; no bulk apply or automatic activation. Existing overrides retain precedence.</p>
      {policy.map(item=><div key={item.recommended.id} className="flex flex-wrap gap-3 items-center justify-between p-3 rounded-xl bg-slate-900"><div><strong>{item.recommended.purchase_stage==='acquisition'?'First qualifying Data purchase':'Repeat qualifying Data purchase'} · {earnMoney(item.recommended.reward_minor||0)}</strong>
        <p className="text-xs text-slate-400">{item.status}{item.existing?` · ${item.existing.effectiveStatus}`:''}{item.existing?.starts_at?` · starts ${new Date(item.existing.starts_at).toISOString()}`:''}</p></div>
        <button className={earnButton} onClick={()=>{if(item.existing)edit(item.existing);else setForm({...blank,id:item.recommended.id,purchase_stage:item.recommended.purchase_stage,value:((item.recommended.reward_minor||0)/100).toFixed(2)});}}>Review Policy</button></div>)}
    </div>
    <div className="flex justify-between gap-3 items-center"><h3 className="font-bold">Reward Rules</h3><button className={earnButton} onClick={()=>{setError('');setForm({...blank});}}>Create rule</button></div>
    {error&&<p role="alert" className="text-red-400 text-sm">{error}</p>}{warnings.map(w=><p key={w} className="p-3 bg-amber-500/10 text-amber-300 text-xs rounded-xl">{w}</p>)}
    {loading?<p className="text-slate-400">Loading rules…</p>:rules.length===0?<p className="text-slate-400">No rules configured.</p>:<div className="space-y-3">{rules.map(rule=><article key={rule.id} className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800 space-y-2">
      <div className="flex flex-wrap gap-3 justify-between"><div><strong className="capitalize">{rule.service_type.replaceAll('_',' ')} · {rule.purchase_stage}</strong><p className="text-xs text-slate-400 break-all">{rule.id}</p></div><span className="text-sm text-[#00c365]">{rule.effectiveStatus} · {rule.enabled?'Enabled':'Disabled'}</span></div>
      <p className="text-sm">{rule.reward_type==='fixed_minor'?earnMoney(rule.reward_minor||0):`${(rule.reward_percent_bps||0)/100}%`} · Network: {rule.network||'Any'} · Product: {rule.product_key||'Any'}</p>
      <p className="text-xs text-slate-400">Starts: {rule.starts_at?new Date(rule.starts_at).toISOString():'Unbounded'} · Ends: {rule.ends_at?new Date(rule.ends_at).toISOString():'Unbounded'}</p>
      {rule.warnings.map(w=><p key={w} className="text-xs text-amber-300">{w}</p>)}<div className="flex gap-2"><button className={earnButton} onClick={()=>edit(rule)}>Edit rule</button><button className={earnButton} onClick={()=>{edit(rule);setForm(current=>current?{...current,enabled:!rule.enabled}:null);}}>{rule.enabled?'Disable':'Enable'}</button></div>
    </article>)}</div>}
    {form&&<AdminEarnDialog title={form.id?'Edit reward rule':'Create reward rule'} busy={busy} onClose={()=>{setForm(null);setConfirm(false);}}>
      {error&&<p role="alert" className="text-red-400 mb-3">{error}</p>}
      <form onSubmit={e=>{e.preventDefault();if(form.enabled)setConfirm(true);else void save();}} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label>Service Type<select className={earnInput} value={form.service_type} onChange={e=>setForm({...form,service_type:e.target.value})}>{services.map(s=><option key={s}>{s}</option>)}</select></label>
          <label>Network<select className={earnInput} value={form.network} onChange={e=>setForm({...form,network:e.target.value})}><option value="">Any network</option>{['mtn','telecel','airteltigo'].map(n=><option key={n}>{n}</option>)}</select></label>
          <label>Product key (optional)<input maxLength={128} className={earnInput} value={form.product_key} onChange={e=>setForm({...form,product_key:e.target.value})}/></label>
          <label>Purchase Stage<select className={earnInput} value={form.purchase_stage} onChange={e=>setForm({...form,purchase_stage:e.target.value})}><option value="any">Any Purchase</option><option value="acquisition">First Qualifying Purchase</option><option value="recurring">Repeat Qualifying Purchase</option></select></label>
          <label>Reward Type<select className={earnInput} value={form.reward_type} onChange={e=>setForm({...form,reward_type:e.target.value})}><option value="fixed_minor">Fixed GHS</option><option value="percent_bps">Percentage</option></select></label>
          <label>{form.reward_type==='fixed_minor'?'Reward amount (GHS)':'Percentage (%)'}<input type="number" min="0" max={form.reward_type==='percent_bps'?100:undefined} step="0.01" required className={earnInput} value={form.value} onChange={e=>setForm({...form,value:e.target.value})}/></label>
          <label>Starts (UTC, optional)<input type="datetime-local" step="0.001" className={earnInput} value={form.starts_at} onChange={e=>setForm({...form,starts_at:e.target.value})}/></label>
          <label>Ends (UTC, optional)<input type="datetime-local" step="0.001" className={earnInput} value={form.ends_at} onChange={e=>setForm({...form,ends_at:e.target.value})}/></label>
        </div>
        <label className="flex gap-3 items-center min-h-10"><input type="checkbox" checked={form.enabled} onChange={e=>setForm({...form,enabled:e.target.checked})}/>Enabled</label>
        <p className="text-xs text-amber-300">Server validation and rule precedence apply. Fixed rewards above a customer charge are blocked. Existing ledger amounts are never rewritten.</p>
        {confirm?<div className="p-4 rounded-xl border border-amber-500/40 space-y-3"><p>Confirm this enabled rule: {form.service_type} / {form.network||'any network'} / {form.product_key||'any product'} / {form.purchase_stage} · {form.value} {form.reward_type==='fixed_minor'?'GHS':'%'} · {form.starts_at||'no start'} to {form.ends_at||'no end'} UTC. This affects future eligible reward credits.</p>
          <button type="button" className={earnButton} disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Confirm enabled rule'}</button><button type="button" className={`${earnButton} ml-2`} disabled={busy} onClick={()=>setConfirm(false)}>Back</button></div>
          :<button className={earnButton} disabled={busy}>{busy?'Saving…':form.enabled?'Review enabled rule':'Save disabled rule'}</button>}
      </form>
    </AdminEarnDialog>}
  </div>;
};
