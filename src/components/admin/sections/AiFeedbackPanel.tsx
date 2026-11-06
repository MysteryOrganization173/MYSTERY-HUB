import {useLayoutEffect,useRef,useState} from 'react';
import {AI_FEEDBACK_CATEGORIES,type AiFeedbackReport} from '../../../../shared/mysteryAiFeedback';
import {listAiFeedback,reviewAiFeedback} from '../../../services/mysteryAiFeedback';

export function AiFeedbackPanel({sessionToken}:{sessionToken:string}){
  const [reports,setReports]=useState<AiFeedbackReport[]|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const request=useRef<AbortController|undefined>(undefined);
  useLayoutEffect(()=>{
    setReports(null);setError('');setBusy(false);
    return ()=>{request.current?.abort();request.current=undefined;};
  },[sessionToken]);
  const run=async(work:(s:AbortSignal)=>Promise<void>)=>{
    if(request.current)return;
    const controller=new AbortController();
    request.current=controller;setBusy(true);setError('');
    try{await work(controller.signal);}
    catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not load submitted reports.');}
    finally{if(request.current===controller){request.current=undefined;setBusy(false);}}
  };
  const reload=()=>run(async signal=>{
    const result=await listAiFeedback(sessionToken,signal);
    if(!signal.aborted)setReports(result.reports);
  });
  const mark=(id:string)=>run(async signal=>{
    await reviewAiFeedback(sessionToken,id,signal);
    if(!signal.aborted)setReports(previous=>previous?.filter(r=>r.reference!==id)??null);
  });
  return <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-100" aria-label="Mystery AI feedback">
    <h3 className="font-bold">Mystery AI feedback</h3>
    <p className="text-sm text-slate-300">Only submitted reports appear here. Private chat history is not available to staff.</p>
    <button type="button" onClick={reload} disabled={busy} className="min-h-11 rounded border border-slate-600 px-3 text-sm disabled:opacity-50">{reports?'Refresh reports':'Load reports'}</button>
    {busy&&<p role="status">Working…</p>}
    {error&&<p role="alert" className="text-amber-200">{error}</p>}
    {reports?.length===0&&<p>No reports waiting for review.</p>}
    {reports&&reports.length>0&&<ul className="space-y-2">
      {reports.map(report=><li key={report.reference} className="space-y-2 rounded border border-slate-700 p-3">
        <p className="font-semibold">{AI_FEEDBACK_CATEGORIES[report.category]}</p>
        <p className="break-all text-xs text-slate-400">{report.reference} · {new Date(report.createdAt).toLocaleString()}</p>
        {report.note&&<p className="whitespace-pre-wrap break-words text-sm">Note: {report.note}</p>}
        {report.answer&&<blockquote className="whitespace-pre-wrap break-words border-l border-slate-500 pl-3 text-sm">{report.answer}</blockquote>}
        <button type="button" disabled={busy} className="min-h-11 rounded border border-slate-600 px-3 text-sm disabled:opacity-50" onClick={()=>mark(report.reference)}>Mark reviewed</button>
      </li>)}
    </ul>}
  </section>;
}
