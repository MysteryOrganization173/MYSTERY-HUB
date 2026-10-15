import React, {useEffect, useRef, useState} from 'react';
import {ChevronLeft, ChevronRight, SlidersHorizontal} from 'lucide-react';
import type {VisualTarget} from '../../../utils/websiteVisualEditing';
import {visualValueError} from '../../../utils/websiteVisualEditing';
import {WebsiteImageField} from './WebsiteImageField';
import './visualEditor.css';

// On touch screens the soft keyboard opens only when the owner taps a field.
const touchFirst = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

function VisualField({target, onChange, siteId, token}: {target: VisualTarget; onChange: (id: string, value: string) => void; siteId: string; token: string}) {
  const [value, setValue] = useState(target.value), [error, setError] = useState('');
  useEffect(() => {setValue(target.value);setError('');}, [target.id, target.value]);
  const change = (next: string) => {
    setValue(next);
    const error = visualValueError(target, next);setError(error);
    if (!error) onChange(target.id, next);
  };
  const id = `visual-${target.id}`, errorId = `${id}-error`, countId = `${id}-count`;
  const counted = target.control === 'body' || target.control === 'text';
  const describedBy = [error ? errorId : '', counted ? countId : ''].filter(Boolean).join(' ') || undefined;
  // Return closes the keyboard on heading and single-line fields; the sheet stays open to review the result.
  const finish = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {if (event.key === 'Enter') {event.preventDefault(); event.currentTarget.blur();}};
  const inputType = target.control === 'email' ? 'email' : target.control === 'phone' ? 'tel' : target.control === 'url' ? 'url' : 'text';
  return <div className="visual-field">
    {target.control === 'image' ? <WebsiteImageField label={target.label} value={value} onChange={change} siteId={siteId} token={token} variant="light"/> : <>
      <div className="visual-field-label"><label htmlFor={id}>{target.label}</label>{counted && <span id={countId}>{value.length}/{target.maxLength}</span>}</div>
      {target.control === 'text' && target.maxLength > 100 ? <textarea id={id} rows={2} maxLength={target.maxLength} value={value} onChange={e=>change(e.target.value.replace(/\n/g,' '))} onKeyDown={finish} enterKeyHint="done" className="visual-input" aria-invalid={!!error} aria-describedby={describedBy}/> : target.control === 'body' ? <textarea id={id} rows={4} maxLength={target.maxLength} value={value} onChange={e=>change(e.target.value)} className="visual-input" aria-invalid={!!error} aria-describedby={describedBy}/> : <div className="visual-input-row">
        {target.control === 'color' && <input type="color" aria-label={`Choose ${target.label}`} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#2563eb'} onChange={e=>change(e.target.value)} className="visual-color-swatch"/>}
        <input id={id} type={inputType} inputMode={target.control === 'phone' ? 'tel' : undefined} enterKeyHint="done" autoComplete="off" maxLength={target.maxLength} value={value} onChange={e=>change(e.target.value)} onKeyDown={finish} className="visual-input" aria-invalid={!!error} aria-describedby={describedBy}/>
      </div>}
    </>}
    {error && <p id={errorId} role="alert" className="visual-field-error">{error} Your draft keeps the last valid value.</p>}
    {target.inherited && <p className="visual-field-hint">Uses your site’s default. Editing changes only this section.</p>}
  </div>;
}

export function VisualContextPanel({title, targets, siteId, token, onChange, onDone, onAllSettings, position, onPrevious, onNext, notice}: {
  title: string; targets: VisualTarget[]; siteId: string; token: string; onChange: (id:string,value:string)=>void; onDone:()=>void; onAllSettings:()=>void;
  position?: {index: number; total: number}; onPrevious?: () => void; onNext?: () => void; notice?: boolean;
}) {
  const root=useRef<HTMLElement>(null), heading=useRef<HTMLHeadingElement>(null);
  const firstId=targets[0]?.id;
  useEffect(() => {
    const field = root.current?.querySelector<HTMLElement>('input:not([type=color]),textarea');
    if (!notice && field && !touchFirst()) field.focus({preventScroll:true});
    else heading.current?.focus({preventScroll:true});
  }, [firstId, notice]);
  useEffect(() => {
    const viewport=window.visualViewport;
    const resize=()=>{
      root.current?.style.setProperty('--visual-available-height',`${viewport?.height || window.innerHeight}px`);
      root.current?.style.setProperty('--visual-keyboard-offset',`${Math.max(0,window.innerHeight-(viewport?.height || window.innerHeight)-(viewport?.offsetTop || 0))}px`);
    };
    resize();viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);
    return ()=>{viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);};
  }, []);
  const stepping = !!position && position.total > 1 && !notice;
  return <aside ref={root} role="dialog" aria-modal="false" aria-labelledby="visual-context-title" className={`visual-context-panel${notice?' is-notice':''}`} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onDone();}}}>
    <div className="visual-context-grabber" aria-hidden="true"/>
    <div className="visual-context-header">
      {stepping && <button type="button" onClick={onPrevious} aria-label="Previous item" className="visual-icon-button"><ChevronLeft size={20}/></button>}
      <div className="visual-context-title">
        <h3 id="visual-context-title" ref={heading} tabIndex={-1}>{title}</h3>
        {stepping && <p>{position!.index + 1} of {position!.total}</p>}
      </div>
      {stepping && <button type="button" onClick={onNext} aria-label="Next item" className="visual-icon-button"><ChevronRight size={20}/></button>}
      <button type="button" onClick={onDone} className="visual-done-button">{notice ? 'Close' : 'Done'}</button>
    </div>
    <div className="visual-context-fields">
      {notice ? <>
        <p className="visual-notice-text">Tapping doesn’t edit this part yet. Menu items, products, galleries, section order and social links are changed in All Settings. A few labels are part of the template design and can’t be changed.</p>
        <button type="button" onClick={onAllSettings} className="visual-primary-button"><SlidersHorizontal size={17}/>Open All Settings</button>
      </> : <>
        {targets.map(target=><VisualField key={target.id} target={target} siteId={siteId} token={token} onChange={onChange}/>)}
        <button type="button" onClick={onAllSettings} className="visual-link-button"><SlidersHorizontal size={15}/>More options in All Settings</button>
      </>}
    </div>
  </aside>;
}
