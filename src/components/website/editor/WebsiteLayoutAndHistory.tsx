import React, {useEffect, useState} from 'react';
import {History, LayoutTemplate, Rows3, RotateCcw} from 'lucide-react';
import {getWebsiteCheckpoints, WebsiteB1Error, type WebsiteCheckpointSummary} from '../../../services/websiteB1Api';
import {getTemplateById} from '../../../utils/templateRendererUtils';
import type {WebsiteLayoutMode} from '../../../utils/websiteLayout';

const REASONS: Record<string, string> = {template_change: 'Before you changed design', layout_change: 'Before you switched layout', draft_restore: 'Before you restored a version'};
export const historyDate = (value: string) => {
  try {return new Intl.DateTimeFormat(undefined, {day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'}).format(new Date(value));} catch {return value;}
};
export const historyFull = (error: unknown) => error instanceof WebsiteB1Error && error.status === 409 && /history|checkpoint/i.test(error.message);

/** The designed template and Custom sections as two clear, reversible choices. */
export function WebsiteLayoutControl({mode, templateTitle, startBlank, plural, onSwitch, onOpenHistory, children}: {
  mode: WebsiteLayoutMode; templateTitle: string; startBlank: boolean; plural: string;
  onSwitch: (mode: WebsiteLayoutMode) => Promise<unknown>; onOpenHistory: () => void; children?: React.ReactNode;
}) {
  const [asking, setAsking] = useState<WebsiteLayoutMode | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<{text: string; full: boolean} | null>(null);
  const confirm = async () => {
    if (!asking) return;
    setBusy(true); setError(null);
    try {await onSwitch(asking); setAsking(null);}
    catch (e) {setError({text: e instanceof Error ? e.message : 'The layout could not be changed.', full: historyFull(e)});}
    finally {setBusy(false);}
  };
  const options: [WebsiteLayoutMode, string, string, typeof LayoutTemplate][] = [
    ['template', 'Designed layout', `The ${templateTitle} design with your details, ${plural.toLowerCase()} and photos. Recommended.`, LayoutTemplate],
    ['sections', 'Custom sections', 'Build the page from blocks you can add, reorder and hide. For when the design does not fit.', Rows3],
  ];
  return <section className="space-y-4 text-left" aria-labelledby="website-layout-title">
    <div><h3 id="website-layout-title" className="text-lg font-semibold">Page layout</h3>
      <p className="text-sm text-slate-400 mt-1">{startBlank ? 'Start Blank is built from custom sections.' : 'You can switch at any time. Nothing is deleted when you switch, and your live website only changes when you publish.'}</p></div>
    {!startBlank && <div className="visual-choice-list" role="radiogroup" aria-label="Page layout">
      {options.map(([value, title, text, Icon]) => <button key={value} type="button" role="radio" aria-checked={mode === value} disabled={busy} className="visual-choice" onClick={() => {setError(null); setAsking(mode === value ? null : value);}}>
        <Icon size={22} aria-hidden="true"/>
        <span><strong>{title}{mode === value && <em>In use</em>}</strong><span>{text}</span></span>
      </button>)}
    </div>}
    {asking && <div className="visual-confirm" role="group" aria-label="Confirm layout change">
      <strong>{asking === 'sections' ? 'Switch to Custom sections?' : `Go back to the ${templateTitle} design?`}</strong>
      <p>{asking === 'sections'
        ? `Your page will be made of blocks you arrange yourself. The designed layout and your ${plural.toLowerCase()} are kept, so you can come back to them.`
        : 'Your page returns to the designed layout. Your custom sections are kept in case you want them again.'} A copy of your current draft is saved in History first.</p>
      {error && <p role="alert" className="visual-field-error">{error.full ? 'Your history is full. Remove an old version in History, then try again.' : error.text} {error.full && <button type="button" className="visual-link-button" onClick={onOpenHistory}>Open History</button>}</p>}
      <div className="visual-example-actions">
        <button type="button" disabled={busy} onClick={() => void confirm()} className="visual-primary-button">{busy ? 'Switching…' : asking === 'sections' ? 'Use Custom sections' : 'Use designed layout'}</button>
        <button type="button" disabled={busy} onClick={() => setAsking(null)} className="visual-secondary-button">Cancel</button>
      </div>
    </div>}
    {mode === 'sections' && children}
  </section>;
}

/** Saved drafts from before each design change, layout switch or restore. */
export function WebsiteHistoryControl({siteId, token, revision, onRestore, onDiscard}: {
  siteId: string; token: string; revision: string;
  onRestore: (checkpoint: WebsiteCheckpointSummary) => Promise<unknown>; onDiscard: (checkpoint: WebsiteCheckpointSummary) => Promise<unknown>;
}) {
  const [list, setList] = useState<WebsiteCheckpointSummary[] | null>(null), [limit, setLimit] = useState(10);
  const [open, setOpen] = useState<{id: string; action: 'restore' | 'discard'} | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    getWebsiteCheckpoints(token, siteId).then(r => {if (live) {setList(r.checkpoints); setLimit(r.limit);}}).catch(e => {if (live) setError(e.message);});
    return () => {live = false;};
  }, [siteId, token, revision]);
  const run = async (checkpoint: WebsiteCheckpointSummary, action: 'restore' | 'discard') => {
    setBusy(true); setError('');
    try {await (action === 'restore' ? onRestore(checkpoint) : onDiscard(checkpoint)); setOpen(null); if (action === 'discard') setList(current => current?.filter(c => c.id !== checkpoint.id) || null);}
    catch (e) {setError(historyFull(e) ? 'Your history is full. Remove an old version first, then restore.' : e instanceof Error ? e.message : 'That did not work. Try again.');}
    finally {setBusy(false);}
  };
  return <section className="space-y-4 text-left" aria-labelledby="website-history-title">
    <div><h3 id="website-history-title" className="text-lg font-semibold flex items-center gap-2"><History size={18} aria-hidden="true"/>History</h3>
      <p className="text-sm text-slate-400 mt-1">We save a copy of your draft before you change design, switch layout or restore. Restoring only changes your draft, never your live website.</p></div>
    {error && <p role="alert" className="visual-field-error">{error}</p>}
    {!list ? !error && <p role="status" className="text-sm text-slate-400">Loading history…</p> : !list.length ? <p className="visual-empty">No saved versions yet. One appears here the first time you change design or layout.</p> : <>
      <p className="text-sm text-slate-400">{list.length} of {limit} saved. When history is full, remove an old version before changing design or layout.</p>
      <ul className="visual-history-list">{list.map(c => <li key={c.id}>
        <div className="visual-history-row">
          <span><strong>{REASONS[c.reason] || 'Saved draft'}</strong><span>{historyDate(c.createdAt)} · {getTemplateById(c.templateId).title} · “{c.name}”</span></span>
          <div className="visual-history-actions">
            <button type="button" disabled={busy} onClick={() => setOpen({id: c.id, action: 'restore'})}><RotateCcw size={15}/>Restore</button>
            <button type="button" disabled={busy} onClick={() => setOpen({id: c.id, action: 'discard'})} className="is-danger">Remove</button>
          </div>
        </div>
        {open?.id === c.id && <div className="visual-confirm" role="group" aria-label={open.action === 'restore' ? 'Confirm restore' : 'Confirm removal'}>
          <p>{open.action === 'restore' ? 'Your draft will be replaced by this version. Your current draft is saved here first, so you can come back to it. Your live website does not change.' : 'This saved version will be deleted for good. Your draft and live website are not affected.'}</p>
          <div className="visual-example-actions">
            <button type="button" disabled={busy} onClick={() => void run(c, open.action)} className={open.action === 'restore' ? 'visual-primary-button' : 'visual-danger-button'}>{busy ? 'Working…' : open.action === 'restore' ? 'Restore this version' : 'Remove for good'}</button>
            <button type="button" disabled={busy} onClick={() => setOpen(null)} className="visual-secondary-button">Cancel</button>
          </div>
        </div>}
      </li>)}</ul>
    </>}
  </section>;
}
