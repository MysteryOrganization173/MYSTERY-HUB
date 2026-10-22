import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { WebsiteSiteRecord } from '../../types';
import { deleteWebsiteOnServer, getWebsiteDeletionCheck, WebsiteDeletionBlocked } from '../../services/apiClient';
import { deletionNameMatches, forgetDeletedWebsite, websiteDeletionName, type WebsiteDeletionBlockerView, type WebsiteDeletionCheckView } from '../../utils/websiteDeletion';
import { BUSINESS_CONFIG } from '../../config/business';
import { deletionBlockerSummary, websiteDeletionSupportUrl } from '../../utils/websiteSupport';
import './websiteBuilder.css';

/**
 * Danger Zone deletion. The server decides: it shows what will happen, refuses while orders or store
 * earnings could still move, and archives (never erases) the website. Retrying after a lost response is safe.
 */
export function WebsiteDeleteSheet({ site, token, onDeleted, onClose, onResolve, withdrawalMinimumMinor, onUnpublish }: { site: WebsiteSiteRecord; token: string; onDeleted: (siteId: string) => void; onClose: () => void; onResolve?: (tab: 'Orders' | 'Store Earnings') => void; withdrawalMinimumMinor?: number; onUnpublish?: () => Promise<boolean> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [check, setCheck] = useState<WebsiteDeletionCheckView | null>(null), [loadError, setLoadError] = useState(''), [attempt, setAttempt] = useState(0);
  const [typed, setTyped] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [blockers, setBlockers] = useState<WebsiteDeletionBlockerView[] | null>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let live = true; setLoadError('');
    getWebsiteDeletionCheck(token, site.id).then(result => { if (live) { setCheck(result); setBlockers(result.blockers); } }).catch(e => { if (live) setLoadError(e.message); });
    return () => { live = false; };
  }, [site.id, token, attempt]);
  const name = check?.site.name || websiteDeletionName(site);
  const matches = deletionNameMatches(site, typed);
  const blocked = (blockers?.length || 0) > 0;
  const live = check ? check.site.published : site.status === 'published';
  const [unpublishing, setUnpublishing] = useState(false), [stopped, setStopped] = useState(false);
  const address = (check?.site.publicUrl || `${typeof window !== 'undefined' ? window.location.origin : ''}/sites/${site.slug}`).replace(/^https?:\/\//, '');
  const resolveTabs = Array.from(new Set((blockers || []).map(b => deletionBlockerSummary(b, withdrawalMinimumMinor).resolve).filter(Boolean))) as ('Orders' | 'Store Earnings')[];
  const close = () => { if (!busy) onClose(); };
  const remove = async () => {
    if (busy || !matches || blocked || !check) return;
    setBusy(true); setError('');
    try {
      await deleteWebsiteOnServer(token, site.id, typed);
      forgetDeletedWebsite(site.id);
      onDeleted(site.id);
    } catch (e: any) {
      if (e instanceof WebsiteDeletionBlocked) setBlockers(e.blockers);
      setError(e instanceof WebsiteDeletionBlocked ? '' : `${e.message || 'The website was not deleted.'} Nothing was changed, so you can try again.`);
    } finally { setBusy(false); }
  };
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); close(); }} aria-labelledby="website-delete-title" className="website-sheet" data-website-delete-sheet>
    <div className="website-sheet-head">
      <div className="min-w-0 flex-1"><h2 id="website-delete-title">Delete this website?</h2><p>Read what happens before you confirm.</p></div>
      <button type="button" disabled={busy} onClick={close} aria-label="Close" className="website-sheet-close"><X size={20} /></button>
    </div>
    <div className="website-sheet-body">
      <div className="website-delete-identity">
        <strong className="break-words">{name}</strong>
        <span className="break-all">{(check?.site.publicUrl || `/sites/${site.slug}`).replace(/^https?:\/\//, '')}</span>
        <span>{(check ? check.site.published : site.status === 'published') ? 'Live now: the link stops working as soon as you delete.' : 'Not published: nobody can visit it yet.'}</span>
      </div>
      {!check && !loadError && <p className="website-sheet-note" role="status">Checking your website…</p>}
      {loadError && <div role="alert" className="website-delete-blockers"><p>{loadError}</p><button type="button" className="min-h-11 font-semibold text-emerald-300" onClick={() => setAttempt(n => n + 1)}>Check again</button></div>}
      {blocked && <div role="alert" className="website-delete-blockers" data-website-delete-blocked>
        <strong>You can’t delete this website yet</strong>
        <ul className="website-delete-reasons">{blockers!.map(b => { const why = deletionBlockerSummary(b, withdrawalMinimumMinor); return <li key={b.code} data-blocker={b.code}><b>{why.title}</b><span>{why.why}</span></li>; })}</ul>
        <p className="website-delete-safe"><b>Your money is safe.</b> Earnings stay in your Mystery Hub account. Deleting never forfeits them and nothing is paid out or moved from here.</p>
        <div className="website-delete-next">
          <a href={websiteDeletionSupportUrl(BUSINESS_CONFIG.contact.supportWhatsAppUrl, { name, publicAddress: address }, blockers!, withdrawalMinimumMinor)} target="_blank" rel="noopener noreferrer" className="website-sheet-confirm" data-support-link>Ask support to help settle this</a>
          {onResolve && resolveTabs.map(tab => <button key={tab} type="button" className="website-sheet-cancel" onClick={() => onResolve(tab)}>Open {tab}</button>)}
          <button type="button" className="min-h-11 px-2 underline" onClick={() => setAttempt(n => n + 1)}>Check again</button>
        </div>
        <p className="website-delete-whatsapp-note">Opens WhatsApp with a message about this website ready to send. Nothing is sent until you press send.</p>
        {live && onUnpublish && !stopped && <div className="website-delete-stop"><p><b>Want to stop new orders now?</b> Unpublish your website. It goes offline, nothing is deleted, and you can publish again any time.</p><button type="button" disabled={unpublishing} className="website-sheet-cancel" onClick={async () => { setUnpublishing(true); try { if (await onUnpublish()) { setStopped(true); setAttempt(n => n + 1); } } finally { setUnpublishing(false); } }}>{unpublishing ? 'Unpublishing…' : 'Unpublish website'}</button></div>}
        {stopped && <p className="website-delete-stop" role="status">Your website is unpublished. Customers can’t place new orders.</p>}
        <details className="text-xs"><summary className="cursor-pointer min-h-11 flex items-center">Details from Mystery Hub</summary><ul className="list-disc pl-5 space-y-1">{blockers!.map(b => <li key={b.code}>{b.message}</li>)}</ul></details>
      </div>}
      {blocked ? <details className="website-delete-later"><summary>What happens when you can delete</summary>
      <ul className="website-delete-effects">
        <li><strong>Gone right away.</strong> Visitors to the address see “This website is no longer available”. Nobody is sent to another business.</li>
        <li><strong>The address is never reused.</strong> Nobody else can take over your old link.</li>
        <li><strong>Your Free website slot opens.</strong> You can start a new website straight away, with a new design, name and address.</li>
        <li><strong>The new website starts fresh.</strong> It does not carry over this website’s text, photos, prices or address.</li>
        <li><strong>Kept safely:</strong> your Mystery Hub account, Wallet, Mystery Earn, and the records of past orders and earnings. Customers can still track past orders with their reference.</li>
      </ul>
      </details> : <>
      <ul className="website-delete-effects">
        <li><strong>Gone right away.</strong> Visitors to the address see “This website is no longer available”. Nobody is sent to another business.</li>
        <li><strong>The address is never reused.</strong> Nobody else can take over your old link.</li>
        <li><strong>Your Free website slot opens.</strong> You can start a new website straight away, with a new design, name and address.</li>
        <li><strong>The new website starts fresh.</strong> It does not carry over this website’s text, photos, prices or address.</li>
        <li><strong>Kept safely:</strong> your Mystery Hub account, Wallet, Mystery Earn, and the records of past orders and earnings. Customers can still track past orders with their reference.</li>
      </ul>
      </>}
      {!blocked && check && <label className="block text-sm">Type <strong className="break-words">{name}</strong> to confirm
        <input autoComplete="off" autoCapitalize="off" spellCheck={false} value={typed} onChange={e => setTyped(e.target.value)} disabled={busy} aria-describedby="website-delete-hint" className="block w-full min-h-12 bg-slate-900 border border-slate-700 p-3 rounded-xl mt-2 text-base" />
        <span id="website-delete-hint" className="block mt-1 text-xs text-slate-400">Capital letters do not matter.</span>
      </label>}
      {error && <p role="alert" className="text-rose-300 text-sm">{error}</p>}
    </div>
    <div className="website-sheet-foot">
      <button type="button" disabled={busy} onClick={close} className="website-sheet-cancel">{blocked ? 'Close' : 'Keep website'}</button>
      {!blocked && <button type="button" disabled={busy || !matches || !check} className="website-sheet-danger" onClick={() => void remove()}>{busy ? 'Deleting…' : 'Delete website'}</button>}
    </div>
  </dialog>;
}
