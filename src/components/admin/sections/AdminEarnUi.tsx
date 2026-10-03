import React, { useEffect, useRef } from 'react';
export const earnMoney = (minor: number) => new Intl.NumberFormat('en-GH',{style:'currency',currency:'GHS'}).format(minor/100);
export const earnButton = 'min-h-10 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-200 hover:border-[#00c365] disabled:opacity-40';
export const earnInput = 'min-h-10 w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white';
export function AdminEarnDialog({title,onClose,busy=false,children}:{title:string;onClose:()=>void;busy?:boolean;children:React.ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close();},[]);
  return <dialog ref={ref} aria-label={title} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}
    className="w-[calc(100%-2rem)] max-w-3xl max-h-[90dvh] overflow-y-auto bg-[#0f171d] text-slate-100 rounded-2xl border border-slate-700 p-4 sm:p-6 backdrop:bg-black/80">
    <div className="flex justify-between items-center gap-3 mb-4"><h3 className="font-bold text-lg">{title}</h3><button className={earnButton} disabled={busy} onClick={onClose} aria-label="Close dialog">Close</button></div>{children}
  </dialog>;
}
export function EarnPager({page,total,limit,onPage,disabled=false}:{page:number;total:number;limit:number;onPage:(page:number)=>void;disabled?:boolean}) {
  return <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 mt-3"><span>{total} records · Page {page} of {Math.max(1,Math.ceil(total/limit))}</span>
    <div className="flex gap-2"><button className={earnButton} disabled={disabled||page<=1} onClick={()=>onPage(page-1)}>Previous</button><button className={earnButton} disabled={disabled||page*limit>=total} onClick={()=>onPage(page+1)}>Next</button></div></div>;
}
