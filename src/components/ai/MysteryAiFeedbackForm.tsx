import {useLayoutEffect,useRef,useState} from 'react';
import {AI_FEEDBACK_ANSWER_MAX,AI_FEEDBACK_CATEGORIES,AI_FEEDBACK_NOTE_MAX,isFeedbackCategory,type AiFeedbackCategory} from '../../../shared/mysteryAiFeedback';
import {redactAiSavedText} from '../../../shared/mysteryAiPrivacy';
import {submitAiFeedback} from '../../services/mysteryAiFeedback';

export function MysteryAiFeedbackForm({token,reference,answer,onClose}:{token:string;reference:string;answer:string;onClose:()=>void}){
  const [category,setCategory]=useState<AiFeedbackCategory|''>('');
  const [note,setNote]=useState('');
  const [share,setShare]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [receipt,setReceipt]=useState('');
  const request=useRef<AbortController|undefined>(undefined);
  const first=useRef<HTMLSelectElement|null>(null);
  useLayoutEffect(()=>{first.current?.focus();return()=>{request.current?.abort();request.current=undefined;};},[]);
  const preview=redactAiSavedText(answer).slice(0,AI_FEEDBACK_ANSWER_MAX);
  const notePreview=redactAiSavedText(note.trim()).slice(0,AI_FEEDBACK_NOTE_MAX);
  const submit=async()=>{
    if(!category||request.current||receipt)return;
    const body={category,note:notePreview||undefined,shareAnswer:share,answer:share?preview:undefined};
    const controller=new AbortController();
    request.current=controller;setBusy(true);setError('');
    try{
      const result=await submitAiFeedback(token,{reference,...body},controller.signal);
      if(!controller.signal.aborted)setReceipt(result.reference);
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not send this report.');}
    finally{if(request.current===controller){request.current=undefined;setBusy(false);}}
  };
  const button='min-h-11 rounded-lg border border-slate-700 px-3 font-semibold disabled:opacity-50';
  return <section className="space-y-2 rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-100" aria-label="Report this answer">
    <h4 className="font-bold">Report this answer</h4>
    {receipt?<p role="status" className="break-all">Report sent. Reference: {receipt}</p>:<form className="space-y-2" onSubmit={e=>{e.preventDefault();void submit();}}>
      <p>Staff will see your reason and any note you add. The selected answer is shared only if you include it. No other messages are sent.</p>
      <label className="block" htmlFor="mystery-ai-feedback-reason">Reason</label>
      <select ref={first} id="mystery-ai-feedback-reason" value={category} disabled={busy} onChange={e=>setCategory(isFeedbackCategory(e.target.value)?e.target.value:'')} className="min-h-11 w-full rounded bg-slate-800 px-2">
        <option value="">Choose a reason</option>{Object.entries(AI_FEEDBACK_CATEGORIES).map(([key,label])=><option value={key} key={key}>{label}</option>)}
      </select>
      <label className="block" htmlFor="mystery-ai-feedback-note">Optional note</label>
      <textarea id="mystery-ai-feedback-note" disabled={busy} rows={2} maxLength={AI_FEEDBACK_NOTE_MAX} value={note} onChange={e=>setNote(e.target.value)} className="min-h-11 w-full rounded bg-slate-800 px-2 py-2" placeholder="Please don’t include personal or payment details."/>
      <label className="flex min-h-11 cursor-pointer items-center gap-2">
        <input type="checkbox" checked={share} disabled={busy} onChange={e=>setShare(e.target.checked)}/> Include this answer in my report
      </label>
      {share&&<div className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded bg-slate-800 p-2" aria-label="Selected answer preview">{preview}</div>}
      {notePreview&&notePreview!==note.trim()&&<p className="break-words text-slate-300">Note as shared: {notePreview}</p>}
      {error&&<p role="alert" className="text-amber-200">{error}</p>}
      <button type="submit" disabled={busy||!category} className={button}>{busy?'Sending…':'Send report'}</button>
    </form>}
    <button type="button" className={button} onClick={onClose}>{receipt?'Done':'Close report'}</button>
  </section>;
}
