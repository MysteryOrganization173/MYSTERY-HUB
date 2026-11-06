import {useState} from 'react';
import {isAiReplyStyle} from '../../../shared/mysteryAiPrivacy';
import type {useMysteryAiHistory} from './useMysteryAiHistory';

const button='min-h-11 rounded-lg border border-slate-700 px-3 text-xs font-semibold disabled:opacity-50';
export function MysteryAiHistoryPanel({history}:{history:ReturnType<typeof useMysteryAiHistory>}) {
  const [edit,setEdit]=useState<{id:string;title:string}|null>(null);
  const [confirm,setConfirm]=useState<string|null>(null);
  return <section aria-label="Saved chats and reply preference" className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-bold text-white">Saved chats</h4>
      <button type="button" className={button} disabled={history.busy} onClick={history.hide}>Back to chat</button>
    </div>
    <p className="text-xs text-slate-300">Starting a saved chat stores its questions and replies on your account. Don’t include passwords, PINs or payment details. Temporary chats stay on this page and are not added to saved chats.</p>
    <button type="button" className={button} disabled={history.busy} onClick={history.create}>Start saved chat</button>
    {history.busy&&<p role="status">Working…</p>}
    {history.error&&<p role="alert" className="text-amber-200">{history.error} <button type="button" className={button} onClick={history.reload}>Try again</button></p>}
    {!history.busy&&!history.error&&!history.chats.length&&<p className="text-slate-300">No saved chats yet.</p>}
    <ul className="space-y-2">
      {history.chats.map(chat=><li key={chat.id} className="rounded-lg bg-slate-900 p-2">
        <button type="button" disabled={history.busy} className="min-h-11 w-full break-words rounded px-2 text-left font-semibold" onClick={()=>history.open(chat.id)}>{chat.title}</button>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={history.busy} onClick={()=>{setConfirm(null);setEdit({id:chat.id,title:chat.title});}}>Rename</button>
          <button type="button" className={button} disabled={history.busy} onClick={()=>{setEdit(null);setConfirm(chat.id);}}>Delete</button>
        </div>
        {edit?.id===chat.id&&<form className="mt-2 flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();void history.rename(chat.id,edit.title);setEdit(null);}}>
          <input aria-label="New chat title" maxLength={80} required value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})} className="min-h-11 min-w-0 rounded-lg bg-slate-800 px-2 text-white"/>
          <button type="submit" className={button} disabled={history.busy||!edit.title.trim()}>Save title</button>
        </form>}
        {confirm===chat.id&&<div className="mt-2 space-y-1">
          <p>Delete from live saved chats? Copies may remain in database backups until they expire.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} disabled={history.busy} onClick={()=>{void history.remove(chat.id);setConfirm(null);}}>Delete saved chat</button>
            <button type="button" className={button} onClick={()=>setConfirm(null)}>Keep chat</button>
          </div>
        </div>}
      </li>)}
    </ul>
    <div className="space-y-1 border-t border-slate-700 pt-2">
      <label htmlFor="mystery-ai-reply-style" className="block font-semibold">Remember my reply style</label>
      <p className="text-xs text-slate-300">This is the only preference Mystery AI remembers across chats. Verified help may use its usual format.</p>
      <select id="mystery-ai-reply-style" value={history.style??''} disabled={history.busy} onChange={e=>void history.preference(isAiReplyStyle(e.target.value)?e.target.value:null)} className="min-h-11 w-full rounded-lg bg-slate-800 px-2 text-white">
        <option value="">No saved preference</option><option value="brief">Brief replies</option><option value="step_by_step">Step by step</option>
      </select>
    </div>
  </section>;
}
