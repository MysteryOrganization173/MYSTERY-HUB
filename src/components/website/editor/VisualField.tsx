import React, {useEffect, useRef, useState} from 'react';
import type {VisualTarget} from '../../../utils/websiteVisualEditing';
import {visualValueError} from '../../../utils/websiteVisualEditing';
import {WebsiteImageField} from './WebsiteImageField';

/** One editable field of the canvas panel (V7.2: shared with Design mode's fine-tuning; no stylesheet import, so it renders in tests). */
export function VisualField({target, onChange, siteId, token}: {target: VisualTarget; onChange: (id: string, value: string) => void; siteId: string; token: string}) {
  const [value, setValue] = useState(target.value), [error, setError] = useState(''), shownId = useRef(target.id);
  useEffect(() => {
    // An emptied design label falls back to the design's wording; keep the field empty while the owner types.
    const keepEmpty = shownId.current === target.id && target.source.kind === 'copy';
    shownId.current = target.id;
    setValue(current => keepEmpty && !current.trim() ? current : target.value);setError('');
  }, [target.id, target.value]);
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
    {target.control === 'image' ? <WebsiteImageField label={target.label} value={value} onChange={change} siteId={siteId} token={token}/> : <>
      <div className="visual-field-label"><label htmlFor={id}>{target.label}</label>{counted && <span id={countId}>{value.length}/{target.maxLength}</span>}</div>
      {target.control === 'text' && target.maxLength > 100 ? <textarea id={id} rows={2} maxLength={target.maxLength} value={value} onChange={e=>change(e.target.value.replace(/\n/g,' '))} onKeyDown={finish} enterKeyHint="done" className="visual-input" aria-invalid={!!error} aria-describedby={describedBy}/> : target.control === 'body' ? <textarea id={id} rows={4} maxLength={target.maxLength} value={value} onChange={e=>change(e.target.value)} className="visual-input" aria-invalid={!!error} aria-describedby={describedBy}/> : <div className="visual-input-row">
        {target.control === 'color' && <input type="color" aria-label={`Choose ${target.label}`} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#2563eb'} onChange={e=>change(e.target.value)} className="visual-color-swatch"/>}
        <input id={id} type={inputType} inputMode={target.control === 'phone' ? 'tel' : undefined} enterKeyHint="done" autoComplete="off" maxLength={target.maxLength} value={value} onChange={e=>change(e.target.value)} onKeyDown={finish} className="visual-input" aria-invalid={!!error} aria-describedby={describedBy}/>
      </div>}
    </>}
    {error && <p id={errorId} role="alert" className="visual-field-error">{error} Your draft keeps the last valid value.</p>}
    {target.inherited && <p className="visual-field-hint">Uses your site’s default. Editing changes only this section.</p>}
    {target.source.kind === 'copy' && !error && <p className="visual-field-hint">Part of the design. Leave it empty to use the design’s wording.</p>}
  </div>;
}
