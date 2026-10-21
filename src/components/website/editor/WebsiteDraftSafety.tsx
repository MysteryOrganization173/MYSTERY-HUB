import React, { useEffect, useRef } from 'react';
import { History, X } from 'lucide-react';
import type { SiteContent, SiteSettings, WebsiteSiteRecord } from '../../../types';
import { websitePublishChanges } from '../../../utils/websitePublishChanges';
import '../websiteBuilder.css';

/**
 * Draft safety: unsaved edits are mirrored on this device under a separate key for each website/design (cleared once the
 * server confirms the save, and when the website is deleted), and a save that meets a newer version
 * from another tab or phone asks which version to keep instead of overwriting either.
 */
import { readDraftRecovery, writeDraftRecovery, clearDraftRecovery, type DraftRecovery } from '../../../utils/websiteDraftRecovery';
export { readDraftRecovery, writeDraftRecovery, clearDraftRecovery, type DraftRecovery };

const when = (at: number) => { try { return new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(at)); } catch { return 'earlier'; } };

export function WebsiteRecoveryBanner({ recovery, changedSince, onRestore, onDiscard }: { recovery: DraftRecovery; changedSince: boolean; onRestore: () => void; onDiscard: () => void }) {
  return <div role="alert" className="website-recovery" data-draft-recovery>
    <History size={20} aria-hidden="true" />
    <div className="min-w-0 flex-1">
      <strong>Unsaved changes from {when(recovery.at)} were found on this device</strong>
      <p>{changedSince ? 'Your website was saved somewhere else since then. Restoring puts these changes in your draft instead; your live website does not change until you publish.' : 'They were not saved before the editor closed. Restore them to keep working.'}</p>
      <div className="website-recovery-actions"><button type="button" onClick={onRestore} className="visual-primary-button">Restore changes</button><button type="button" onClick={onDiscard} className="visual-secondary-button">Discard</button></div>
    </div>
  </div>;
}

export function WebsiteConflictSheet({ mine, theirs, templateId, word, onKeepMine, onUseTheirs }: { mine: { name: string; content: SiteContent; settings: SiteSettings }; theirs: WebsiteSiteRecord; templateId: string; word: string; onKeepMine: () => void; onUseTheirs: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  // Compare as if the other version were "live": the list names what keeping mine would replace.
  const differences = websitePublishChanges({ version: 1, templateId: theirs.template_id, name: theirs.name, content: theirs.content_json, settings: theirs.settings_json, draftUpdatedAt: theirs.updated_at, publishedAt: null }, { templateId, content: mine.content, settings: mine.settings }, word);
  return <dialog ref={dialog} aria-labelledby="website-conflict-title" className="website-sheet" onCancel={e => e.preventDefault()} data-save-conflict>
    <div className="website-sheet-head"><div className="min-w-0 flex-1"><h2 id="website-conflict-title">This website was changed somewhere else</h2><p>Another tab or phone saved a newer version while you were editing. Choose which one to keep.</p></div></div>
    <div className="website-sheet-body">
      {differences.length > 0 ? <div className="website-publish-changes"><strong>Your version is different in</strong><ul>{differences.map(d => <li key={d}>{d}</li>)}</ul></div> : <p className="text-sm text-slate-300">Both versions look the same.</p>}
      <p className="text-xs text-slate-400 mt-3">Your live website is not affected either way until you publish.</p>
    </div>
    <div className="website-sheet-foot">
      <button type="button" className="website-sheet-cancel" onClick={onUseTheirs}><X size={16} aria-hidden="true" />Use the other version</button>
      <button type="button" className="website-sheet-confirm" onClick={onKeepMine}>Keep my changes</button>
    </div>
  </dialog>;
}
