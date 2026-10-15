import React, {useEffect, useRef, useState} from 'react';
import {AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, MessageCircle, X} from 'lucide-react';
import type {SiteContent, TemplateItem} from '../../../types';
import {SafeImage} from '../SafeImage';
import '../websiteBuilder.css';

const formatDate = (value?: string | null) => {
  if (!value) return '';
  try {return new Intl.DateTimeFormat(undefined, {day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'}).format(new Date(value));} catch {return '';}
};

/**
 * One place to decide "is this ready to be public?": the owner's name, a way to be reached and the
 * example items the server will not publish until each is kept or removed. Never confirms for them.
 */
export function WebsitePublishSheet({content, published, publishedAt, publicUrl, word, managed, onReview, onEditItem, onEditField, onPublish, onClose}: {
  content: SiteContent; published: boolean; publishedAt?: string | null; publicUrl: string; word: {singular: string; plural: string; many: string}; managed: boolean;
  onReview: (ids: string[], action: 'confirm' | 'remove') => Promise<boolean>; onEditItem: (id: string) => void; onEditField: (target: 'name' | 'contact') => void;
  onPublish: () => Promise<boolean>; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // Remember whether this publish creates or replaces the live site, for the result's wording.
  const [wasPublished] = useState(published);
  const [busy, setBusy] = useState(''), [done, setDone] = useState(false), [copied, setCopied] = useState(false);
  useEffect(() => {dialog.current?.showModal();}, []);
  const examples = (content.items || []).filter((item): item is TemplateItem & {id: string} => item.isExample === true && !!item.id);
  const contact = content.whatsapp ? `WhatsApp ${content.whatsapp}` : content.phone ? `Phone ${content.phone}` : content.email || '';
  const close = () => {if (!busy) onClose();};
  const review = async (ids: string[], action: 'confirm' | 'remove') => {setBusy(ids.join()); try {await onReview(ids, action);} finally {setBusy('');}};
  const publish = async () => {setBusy('publish'); try {if (await onPublish()) setDone(true);} finally {setBusy('');}};
  const copy = async () => {try {await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2500);} catch {/* the address stays visible to copy by hand */}};
  const lower = word.many;

  return <dialog ref={dialog} aria-labelledby="website-publish-title" onCancel={event => {event.preventDefault(); close();}} className="website-sheet website-publish">
    <div className="website-sheet-head">
      <div className="min-w-0 flex-1">
        <h2 id="website-publish-title">{done ? (wasPublished ? 'Your live website is updated' : 'Your website is live') : published ? 'Update your live website?' : 'Ready to publish?'}</h2>
        {!done && <p>{published ? `Live since ${formatDate(publishedAt) || 'your last publish'}. Publishing replaces it with this draft.` : 'Check these before your website becomes public.'}</p>}
      </div>
      <button type="button" disabled={!!busy} onClick={close} aria-label="Close" className="website-sheet-close"><X size={20}/></button>
    </div>
    <div className="website-sheet-body">
      {done ? <div className="website-publish-done">
        <CheckCircle2 size={40} aria-hidden="true"/>
        <p>Anyone with this link can now see {content.businessName || 'your website'}.</p>
        <div className="website-owner-address"><span className="min-w-0 truncate">{publicUrl.replace(/^https?:\/\//, '')}</span><button type="button" className="website-owner-icon" aria-label="Copy website link" onClick={() => void copy()}>{copied ? <Check size={16}/> : <Copy size={16}/>}</button></div>
        <div className="website-publish-actions">
          <a className="website-sheet-confirm" href={`https://wa.me/?text=${encodeURIComponent(`${content.businessName || 'My website'}: ${publicUrl}`)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/>Share on WhatsApp</a>
          <a className="website-sheet-cancel" href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={18}/>View website</a>
        </div>
      </div> : <ol className="website-checklist">
        <li data-state="ok">
          <span className="website-check-icon" aria-hidden="true"><Check size={15}/></span>
          <div><strong>Business name</strong><p>{content.businessName}</p></div>
          <button type="button" onClick={() => onEditField('name')}>Change</button>
        </li>
        <li data-state={contact ? 'ok' : 'warn'}>
          <span className="website-check-icon" aria-hidden="true">{contact ? <Check size={15}/> : <AlertTriangle size={15}/>}</span>
          <div><strong>How customers reach you</strong><p>{contact || 'No WhatsApp, phone or email yet. Customers will not be able to contact you.'}</p></div>
          <button type="button" onClick={() => onEditField('contact')}>{contact ? 'Change' : 'Add'}</button>
        </li>
        {!managed && <li data-state={examples.length ? 'todo' : 'ok'} className="website-check-examples">
          <span className="website-check-icon" aria-hidden="true">{examples.length ? examples.length : <Check size={15}/>}</span>
          <div>
            <strong>{examples.length ? `Review ${examples.length} example ${examples.length === 1 ? word.singular.toLowerCase() : lower}` : `${word.singular === 'Dish' ? 'Menu' : word.plural} reviewed`}</strong>
            <p>{examples.length ? `Keep the ones that are accurate for your business and remove the rest. Only kept ${lower} appear on your website.` : `Every ${word.singular.toLowerCase()} on your website is one you added or kept.`}</p>
            {examples.length > 0 && <ul className="website-example-list">{examples.map(item => <li key={item.id}>
              {item.image ? <SafeImage src={item.image} alt="" className="website-example-thumb"/> : <span className="website-example-thumb" aria-hidden="true"/>}
              <button type="button" className="website-example-name" onClick={() => onEditItem(item.id)}><span>{item.name}</span><small>{item.price || 'Tap to edit'}</small></button>
              <div className="website-example-buttons">
                <button type="button" disabled={!!busy} onClick={() => void review([item.id], 'confirm')} aria-label={`Keep ${item.name}`}>{busy === item.id ? '…' : 'Keep'}</button>
                <button type="button" disabled={!!busy} onClick={() => void review([item.id], 'remove')} aria-label={`Remove ${item.name}`} className="is-remove">Remove</button>
              </div>
            </li>)}</ul>}
          </div>
        </li>}
      </ol>}
    </div>
    <div className="website-sheet-foot">
      {done ? <button type="button" onClick={onClose} className="website-sheet-confirm">Back to editing</button> : <>
        <button type="button" disabled={!!busy} onClick={close} className="website-sheet-cancel">Not yet</button>
        <button type="button" disabled={!!busy || (!managed && examples.length > 0)} onClick={() => void publish()} className="website-sheet-confirm">
          {busy === 'publish' ? 'Publishing…' : !managed && examples.length ? `Review ${examples.length} first` : published ? 'Update live site' : 'Publish now'}
        </button>
      </>}
    </div>
  </dialog>;
}
