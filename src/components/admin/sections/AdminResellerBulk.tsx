import React,{useState} from 'react';
import {websiteBusinessRequest} from '../../../services/websiteBusinessApi';
import {formatGhs,parseGhs} from '../../../../shared/money';
const field='min-h-11 p-2 bg-slate-900 border border-slate-700 rounded-lg';
const button=field+' disabled:opacity-50';
const cash=(n:number|null)=>n===null?'Unavailable':formatGhs(n);
export function AdminResellerBulk({token,products,busy,refresh}:{token:string;products:any[];busy:boolean;refresh:()=>Promise<void>}) {
  const [network,setNetwork]=useState('all'),[ids,setIds]=useState<string[]>(products.map(p=>p.id));
  const [rate,setRate]=useState(''),[threshold,setThreshold]=useState('10'),[discount,setDiscount]=useState('0'),[activation,setActivation]=useState('preserve');
  const [preview,setPreview]=useState<any>(null),[proposal,setProposal]=useState<any>(null),[error,setError]=useState(''),[working,setWorking]=useState(false);
  const invalidate=()=>{setPreview(null);setProposal(null);setError('');};
  const visible=products.filter(p=>network==='all'||p.network===network);
  return <section className="border border-slate-700 rounded-xl p-4 space-y-4">
    <h3 className="font-bold">Bulk reseller wholesale</h3>
    <p className="text-sm text-slate-400">Choose one network to set a per-GB rate, or all networks to activate/deactivate plans. A blank rate keeps existing wholesale prices. Activation changes do not enable the managed payments policy or change a seller’s retail prices. Larger-bundle discounts apply to the entire qualifying bundle; supplier costs are checked per plan.</p>
    <fieldset disabled={busy||working} className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <label>Network <select className={field} value={network} onChange={e=>{invalidate();setNetwork(e.target.value);setIds(products.filter(p=>e.target.value==='all'||p.network===e.target.value).map(p=>p.id));}}><option value="all">All networks</option>{[...new Set<string>(products.map(p=>p.network))].map(n=><option key={n} value={n}>{n.toUpperCase()}</option>)}</select></label>
        <button type="button" className={button} onClick={()=>{invalidate();setIds(visible.map(p=>p.id));}}>Select all shown</button>
        <button type="button" className={button} onClick={()=>{invalidate();setIds([]);}}>Clear selection</button>
      </div>
      <div className="flex flex-wrap gap-3">{visible.map(p=><label key={p.id} className="flex items-center gap-2 min-h-11"><input type="checkbox" checked={ids.includes(p.id)} onChange={e=>{invalidate();setIds(e.target.checked?[...ids,p.id]:ids.filter(id=>id!==p.id));}}/>{p.network.toUpperCase()} {p.dataAmount}</label>)}</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label>Wholesale per GB (GH₵, optional)<input className={field+' w-full'} inputMode="decimal" value={rate} onChange={e=>{invalidate();setRate(e.target.value);}}/></label>
        <label>Activation<select className={field+' w-full'} value={activation} onChange={e=>{invalidate();setActivation(e.target.value);}}><option value="preserve">Keep each plan’s status</option><option value="enable">Activate selected plans</option><option value="disable">Deactivate selected plans</option></select></label>
        <label>Discount starts at (GB)<input className={field+' w-full'} type="number" min="1" step="1" value={threshold} onChange={e=>{invalidate();setThreshold(e.target.value);}}/></label>
        <label>Larger-bundle discount (%)<input className={field+' w-full'} type="number" min="0" max="50" step="0.01" disabled={!rate} value={discount} onChange={e=>{invalidate();setDiscount(e.target.value);}}/></label>
      </div>
      <button type="button" className={button} disabled={!ids.length} onClick={async()=>{setWorking(true);invalidate();try{const bps=Number(discount)*100;if(rate&&Math.abs(bps-Math.round(bps))>0.000001)throw Error('Use at most two decimal places for the discount.');const input={productIds:ids,perGbMinor:rate?parseGhs(rate):null,discountFromGb:Number(threshold),discountBps:rate?Math.round(bps):0,activation};const result=await websiteBusinessRequest('admin/website-builder/reseller-wholesale/preview',token,input);setProposal(input);setPreview(result);}catch(e:any){setError(e.message);}finally{setWorking(false);}}}>Preview / validate {ids.length} plans</button>
    </fieldset>
    {error&&<p role="alert" className="text-rose-300">{error}</p>}
    {preview&&<div className="space-y-3">
      <p className="text-sm">Preview only — no settings saved. Processing reserve: {(preview.policy.reserveBps/100).toFixed(2)}% + {cash(preview.policy.reserveFixedMinor)}. Supplier spread excludes other platform expenses. Reserve is taken from customer retail, not wholesale. Minimum retail leaves no seller earning.</p>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><caption className="text-left">Exact proposed prices and eligibility</caption><thead><tr>{['Plan','Current wholesale','Proposed wholesale','Supplier cost / min wholesale','Min customer retail','Reserve at min retail','Platform gross spread','Status / validation'].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{preview.rows.map((r:any)=><tr key={r.productId} className="border-t border-slate-800"><td className="p-2">{r.network.toUpperCase()} {r.dataAmount}</td><td className="p-2">{cash(r.previous?.wholesaleMinor??null)}</td><td className="p-2">{cash(r.proposedMinor)}</td><td className="p-2">{cash(r.supplierCostMinor)}</td><td className="p-2">{cash(r.minimumRetailMinor)}</td><td className="p-2">{cash(r.reserveAtMinimumMinor)}</td><td className="p-2">{cash(r.platformSpreadMinor)}</td><td className="p-2">{r.enabled?'Enabled':'Disabled'}{r.errors.map((e:string)=><p key={e} className="text-rose-300">{e}</p>)}</td></tr>)}</tbody></table></div>
      <button type="button" className={button} disabled={busy||working||!preview.valid} onClick={async()=>{if(!window.confirm(`Apply these exact prices and statuses to ${preview.rows.length} plans? This is audited and affects future purchases. Existing seller prices below the new retail minimum will be unavailable until the seller updates them.`))return;setWorking(true);try{await websiteBusinessRequest('admin/website-builder/reseller-wholesale/apply',token,{confirmed:true,revision:preview.revision,proposal});invalidate();await refresh();}catch(e:any){setError(e.message);setPreview(null);}finally{setWorking(false);}}}>Confirm audited bulk apply</button>
    </div>}
  </section>;
}
