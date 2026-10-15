import React, {useEffect, useRef, useState} from 'react';
import {Check, ChevronLeft, ChevronRight, Plus, Trash2} from 'lucide-react';
import type {TemplateItem} from '../../../types';
import {WebsiteImageField} from './WebsiteImageField';
import './visualEditor.css';

type ItemField = 'name' | 'price' | 'category' | 'desc';
const LIMITS: Record<ItemField, number> = {name: 100, price: 40, category: 50, desc: 300};
const touchFirst = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

function ItemInput({item, field, label, hint, placeholder, multiline, onChange}: {item: TemplateItem; field: ItemField; label: string; hint?: string; placeholder?: string; multiline?: boolean; onChange: (patch: Partial<TemplateItem>) => void}) {
  const [value, setValue] = useState(item[field] || ''), [error, setError] = useState('');
  useEffect(() => {setValue(item[field] || ''); setError('');}, [item.id, item[field]]);
  const id = `item-${field}`, describedBy = [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;
  const change = (next: string) => {
    setValue(next);
    const problem = /[<>]/.test(next) ? 'Use plain text without HTML tags.' : field === 'name' && !next.trim() ? 'Give it a name, or remove it.' : '';
    setError(problem);
    if (!problem) onChange({[field]: next});
  };
  const finish = (event: React.KeyboardEvent<HTMLInputElement>) => {if (event.key === 'Enter') {event.preventDefault(); event.currentTarget.blur();}};
  return <div className="visual-field">
    <div className="visual-field-label"><label htmlFor={id}>{label}</label>{multiline && <span>{value.length}/{LIMITS[field]}</span>}</div>
    {multiline
      ? <textarea id={id} rows={3} maxLength={LIMITS[field]} value={value} placeholder={placeholder} onChange={e => change(e.target.value)} className="visual-input" aria-invalid={!!error} aria-describedby={describedBy}/>
      : <input id={id} type="text" enterKeyHint="done" autoComplete="off" maxLength={LIMITS[field]} value={value} placeholder={placeholder} onChange={e => change(e.target.value)} onKeyDown={finish} className="visual-input" aria-invalid={!!error} aria-describedby={describedBy}/>}
    {error && <p id={`${id}-error`} role="alert" className="visual-field-error">{error} Your draft keeps the last name.</p>}
    {hint && !error && <p id={`${id}-hint`} className="visual-field-hint">{hint}</p>}
  </div>;
}

/**
 * Edits one menu dish, service, room or product in place on the canvas. Example items carry the
 * explicit keep/remove decision the publish gate asks for, right where the owner is looking.
 */
export function WebsiteItemPanel({item, index, total, word, fields, siteId, token, busy, onChange, onKeep, onRemove, onAdd, onPrevious, onNext, onDone}: {
  item: TemplateItem; index: number; total: number; word: {singular: string; plural: string; many: string}; fields: string[]; siteId: string; token: string; busy: boolean;
  onChange: (patch: Partial<TemplateItem>) => void; onKeep: () => void; onRemove: () => void; onAdd: () => void; onPrevious: () => void; onNext: () => void; onDone: () => void;
}) {
  const root = useRef<HTMLElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const lower = word.singular.toLowerCase();
  useEffect(() => {
    const field = root.current?.querySelector<HTMLElement>('input');
    if (field && !touchFirst()) field.focus({preventScroll: true}); else heading.current?.focus({preventScroll: true});
  }, [item.id]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      root.current?.style.setProperty('--visual-available-height', `${viewport?.height || window.innerHeight}px`);
      root.current?.style.setProperty('--visual-keyboard-offset', `${Math.max(0, window.innerHeight - (viewport?.height || window.innerHeight) - (viewport?.offsetTop || 0))}px`);
    };
    resize(); viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize);
    return () => {viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize);};
  }, []);
  return <aside ref={root} role="dialog" aria-modal="false" aria-labelledby="visual-item-title" className="visual-context-panel is-item" onKeyDown={e => {if (e.key === 'Escape') {e.stopPropagation(); onDone();}}}>
    <div className="visual-context-grabber" aria-hidden="true"/>
    <div className="visual-context-header">
      {total > 1 && <button type="button" onClick={onPrevious} aria-label={`Previous ${lower}`} className="visual-icon-button"><ChevronLeft size={20}/></button>}
      <div className="visual-context-title">
        <h3 id="visual-item-title" ref={heading} tabIndex={-1}>{word.singular} {index + 1} of {total}</h3>
        <p>{word.plural}</p>
      </div>
      {total > 1 && <button type="button" onClick={onNext} aria-label={`Next ${lower}`} className="visual-icon-button"><ChevronRight size={20}/></button>}
      <button type="button" onClick={onDone} className="visual-done-button">Done</button>
    </div>
    <div className="visual-context-fields" inert={busy}>
      {item.isExample && <div className="visual-example-note" role="group" aria-labelledby="visual-example-title">
        <strong id="visual-example-title">Example {lower}</strong>
        <p>We added this so your page doesn’t start empty. Change it to something you really offer, then keep it, or remove it. Examples must be kept or removed before you publish.</p>
        <div className="visual-example-actions">
          <button type="button" onClick={onKeep} className="visual-primary-button"><Check size={17}/>Keep this {lower}</button>
          <button type="button" onClick={onRemove} className="visual-secondary-button">Remove</button>
        </div>
      </div>}
      <ItemInput item={item} field="name" label="Name" onChange={onChange}/>
      {fields.includes('price') && <ItemInput item={item} field="price" label="Price (optional)" placeholder="e.g. GH₵ 45" hint="Leave empty to hide the price." onChange={onChange}/>}
      {fields.includes('desc') && <ItemInput item={item} field="desc" label="Description" multiline onChange={onChange}/>}
      {fields.includes('image') && <div className="visual-field"><WebsiteImageField label="Photo" value={item.image || ''} siteId={siteId} token={token} onChange={image => onChange({image})}/></div>}
      {fields.includes('category') && <ItemInput item={item} field="category" label="Group (optional)" hint={`Visitors can filter your ${word.many} by group.`} onChange={onChange}/>}
      <div className="visual-item-footer">
        <button type="button" onClick={onAdd} className="visual-link-button"><Plus size={16}/>Add a {lower}</button>
        {!item.isExample && <button type="button" onClick={onRemove} className="visual-link-button is-danger"><Trash2 size={16}/>Remove this {lower}</button>}
      </div>
    </div>
  </aside>;
}
