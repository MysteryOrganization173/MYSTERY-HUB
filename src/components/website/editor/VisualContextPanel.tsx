import React, {useEffect, useRef, useState} from 'react';
import type {VisualTarget} from '../../../utils/websiteVisualEditing';
import {visualValueError} from '../../../utils/websiteVisualEditing';
import {WebsiteImageField} from './WebsiteImageField';
import './visualEditor.css';

function VisualField({target, onChange, siteId, token}: {target: VisualTarget; onChange: (id: string, value: string) => void; siteId: string; token: string}) {
  const [value, setValue] = useState(target.value), [error, setError] = useState('');
  useEffect(() => {setValue(target.value);setError('');}, [target.id, target.value]);
  const change = (next: string) => {
    setValue(next);
    const error = visualValueError(target, next);setError(error);
    if (!error) onChange(target.id, next);
  };
  const inputClass = 'block w-full min-h-11 rounded-xl bg-slate-900 border border-slate-600 px-3 py-2 text-base text-white focus:outline-2 focus:outline-emerald-400';
  const id = `visual-${target.id}`, errorId = `${id}-error`;
  return <div className="space-y-2 min-w-0">
    {target.control === 'image' ? <WebsiteImageField label={target.label} value={value} onChange={change} siteId={siteId} token={token}/> : <>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-200">{target.label}</label>
      {target.control === 'body' ? <textarea id={id} rows={3} maxLength={target.maxLength} value={value} onChange={e=>change(e.target.value)} className={inputClass} aria-invalid={!!error} aria-describedby={error ? errorId : undefined}/> : <div className="flex gap-2">
        {target.control === 'color' && <input type="color" aria-label={`Choose ${target.label}`} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#2563eb'} onChange={e=>change(e.target.value)} className="w-12 h-12 rounded-lg shrink-0"/>}
        <input id={id} type={target.control === 'email' ? 'email' : target.control === 'phone' ? 'tel' : 'text'} maxLength={target.maxLength} value={value} onChange={e=>change(e.target.value)} className={inputClass} aria-invalid={!!error} aria-describedby={error ? errorId : undefined}/>
      </div>}
    </>}
    {error && <p id={errorId} role="alert" className="text-sm text-amber-300">{error} This value has not changed your draft.</p>}
    {target.inherited && <p className="text-xs text-slate-400">Uses your site’s default. Editing changes only this section.</p>}
  </div>;
}

export function VisualContextPanel({title, targets, siteId, token, onChange, onDone, onAllSettings}: {title: string; targets: VisualTarget[]; siteId: string; token: string; onChange: (id:string,value:string)=>void; onDone:()=>void; onAllSettings:()=>void}) {
  const root=useRef<HTMLElement>(null);
  const firstId=targets[0]?.id;
  useEffect(() => {
    const field = root.current?.querySelector<HTMLElement>('input:not([type=color]),textarea');
    (field || root.current?.querySelector<HTMLElement>('button'))?.focus({preventScroll:true});
  }, [firstId]);
  useEffect(() => {
    const viewport=window.visualViewport;
    const resize=()=>{
      root.current?.style.setProperty('--visual-available-height',`${viewport?.height || window.innerHeight}px`);
      root.current?.style.setProperty('--visual-keyboard-offset',`${Math.max(0,window.innerHeight-(viewport?.height || window.innerHeight)-(viewport?.offsetTop || 0))}px`);
    };
    resize();viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);
    return ()=>{viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);};
  }, []);
  return <aside ref={root} role="dialog" aria-modal="false" aria-label={title} className="visual-context-panel" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onDone();}}}>
    <div className="visual-context-header"><div><p className="text-xs text-emerald-300 mb-1">Editing your draft</p><h3 className="font-bold break-words">{title}</h3></div><button type="button" onClick={onDone} className="min-h-11 px-4 rounded-xl bg-emerald-500 text-black font-bold shrink-0">Done</button></div>
    <div className="visual-context-fields">{targets.map(target=><VisualField key={target.id} target={target} siteId={siteId} token={token} onChange={onChange}/>)}<button type="button" onClick={onAllSettings} className="min-h-11 underline text-sm text-slate-300">All Settings</button></div>
  </aside>;
}
