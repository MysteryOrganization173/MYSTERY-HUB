import React, {useEffect, useRef, useState} from 'react';
import {ChevronLeft, ChevronRight, SlidersHorizontal} from 'lucide-react';
import type {VisualTarget} from '../../../utils/websiteVisualEditing';
import {VisualField} from './VisualField';
import './visualEditor.css';

// On touch screens the soft keyboard opens only when the owner taps a field.
const touchFirst = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

export function VisualContextPanel({title, targets, siteId, token, onChange, onDone, onAllSettings, position, onPrevious, onNext, notice, noticeText, noticeAction, suggested, extra}: {
  title: string; targets: VisualTarget[]; siteId: string; token: string; onChange: (id:string,value:string)=>void; onDone:()=>void; onAllSettings:()=>void;
  position?: {index: number; total: number}; onPrevious?: () => void; onNext?: () => void; notice?: boolean; noticeText?: string; noticeAction?: string; suggested?: boolean;
  /** V7.1: design-specific helpers shown above the fields (store style, wording ideas). */
  extra?: React.ReactNode;
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
        <p className="visual-notice-text">{noticeText || 'Tapping doesn’t edit this part. Galleries, section order and social links are changed in All Settings. A few labels are part of the design and can’t be changed.'}</p>
        <button type="button" onClick={onAllSettings} className="visual-primary-button"><SlidersHorizontal size={17}/>{noticeAction || 'Open All Settings'}</button>
      </> : <>
        {suggested && <div className="visual-example-note is-suggested" role="note"><strong>Suggested wording</strong><p>We wrote this so your page doesn’t start empty. Make it your own, or keep it if it fits your business.</p></div>}
        {extra}
        {targets.map(target=><VisualField key={target.id} target={target} siteId={siteId} token={token} onChange={onChange}/>)}
        <button type="button" onClick={onAllSettings} className="visual-link-button"><SlidersHorizontal size={15}/>More options in All Settings</button>
      </>}
    </div>
  </aside>;
}
