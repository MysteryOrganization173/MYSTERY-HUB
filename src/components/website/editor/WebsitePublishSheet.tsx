import React, {useEffect, useRef, useState} from 'react';
import {AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, LayoutDashboard, MessageCircle, PenLine, X} from 'lucide-react';
import type {SiteContent, TemplateItem} from '../../../types';
import {SafeImage} from '../SafeImage';
import type {WebsiteReadinessItem} from '../../../utils/websiteReadiness';
import '../websiteBuilder.css';

const formatDate = (value?: string | null) => {
  if (!value) return '';
  try {return new Intl.DateTimeFormat(undefined, {day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'}).format(new Date(value));} catch {return '';}
};

/**
 * One place to decide "is this ready to be public?": the owner's name, a way to be reached and the
 * example items the server will not publish until each is kept or removed. Never confirms for them.
 */
export function WebsitePublishSheet({content, published, publishedAt, publicUrl, word, managed, suggestions = [], changes, readiness = [], sellableBundles = null, onFix, onBundles, onBusiness, onReview, onEditItem, onEditField, onPublish, onClose}: {
  content: SiteContent; published: boolean; publishedAt?: string | null; publicUrl: string; word: {singular: string; plural: string; many: string}; managed: boolean;
  /** Design wording and sample photos still in use. Shown for a final look; never blocks publishing. */
  suggestions?: {label: string; target: string}[];
  /** For a live website: what this update changes, compared with what visitors see now. */
  changes?: string[];
  onReview: (ids: string[], action: 'confirm' | 'remove') => Promise<boolean>; onEditItem: (id: string) => void; onEditField: (target: string) => void;
  onPublish: () => Promise<boolean>; onClose: () => void;
  /** V5.1 readiness checks: required ones hold the publish button, warnings never do. */
  readiness?: WebsiteReadinessItem[]; sellableBundles?: number | null;
  onFix?: (item: WebsiteReadinessItem) => void; onBundles?: () => void;
  /** Builder V6: after publishing, the next place to go is My Business (orders, earnings, visitors). */
  onBusiness?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // Remember whether this publish creates or replaces the live site, for the result's wording.
  const [wasPublished] = useState(published);
  const [busy, setBusy] = useState(''), [done, setDone] = useState(false), [copied, setCopied] = useState(false);
  useEffect(() => {dialog.current?.showModal();}, []);
  const examples = (content.items || []).filter((item): item is TemplateItem & {id: string} => item.isExample === true && !!item.id);
  const contact = content.whatsapp ? `WhatsApp ${content.whatsapp}` : content.phone ? `Phone ${content.phone}` : content.email || '';
  const contactIssue = readiness.find(item => item.id === 'whatsapp' || item.id === 'contact');
  const others = readiness.filter(item => item !== contactIssue && item.id !== 'name');
  const required = readiness.filter(item => item.level === 'required');
  const noSales = managed && sellableBundles === 0;
  const close = () => {if (!busy) onClose();};
  const review = async (ids: string[], action: 'confirm' | 'remove') => {setBusy(ids.join()); try {await onReview(ids, action);} finally {setBusy('');}};
  const publish = async () => {setBusy('publish'); try {if (await onPublish()) setDone(true);} finally {setBusy('');}};
  const copy = async () => {try {await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2500);} catch {/* the address stays visible to copy by hand */}};
  const lower = word.many;

  return <dialog ref={dialog} aria-labelledby="website-publish-title" onCancel={event => {event.preventDefault(); close();}} className="website-sheet website-publish">
    <div className="website-sheet-head">
      <div className="min-w-0 flex-1">
        <h2 id="website-publish-title">{done ? (noSales ? 'Your website is live, but customers can’t buy yet' : wasPublished ? 'Your live website is updated' : 'Your website is live') : published ? 'Update your live website?' : 'Ready to publish?'}</h2>
        {!done && <p>{published ? `Live since ${formatDate(publishedAt) || 'your last publish'}. Publishing replaces it with this draft.` : 'Check these before your website becomes public.'}</p>}
      </div>
      <button type="button" disabled={!!busy} onClick={close} aria-label="Close" className="website-sheet-close"><X size={20}/></button>
    </div>
    <div className="website-sheet-body">
      {done ? <div className="website-publish-done">
        <CheckCircle2 size={40} aria-hidden="true"/>
        <p>Anyone with this link can now see {content.businessName || 'your website'}.{noSales ? ' Put some bundles on sale so customers can buy.' : ''}</p>
        {noSales && onBundles && <button type="button" className="website-sheet-confirm website-publish-next" onClick={onBundles}>Set up bundles &amp; prices</button>}
        <div className="website-owner-address"><span className="min-w-0 truncate">{publicUrl.replace(/^https?:\/\//, '')}</span><button type="button" className="website-owner-icon" aria-label="Copy website link" onClick={() => void copy()}>{copied ? <Check size={16}/> : <Copy size={16}/>}</button></div>
        <div className="website-publish-actions">
          <a className="website-sheet-confirm" href={`https://wa.me/?text=${encodeURIComponent(`${content.businessName || 'My website'}: ${publicUrl}`)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/>Share on WhatsApp</a>
          <a className="website-sheet-cancel" href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={18}/>View website</a>
        </div>
        {onBusiness && <button type="button" className="website-publish-business" data-publish-business onClick={onBusiness}>
          <LayoutDashboard size={18} aria-hidden="true"/><span><strong>{managed ? 'Manage orders & earnings' : 'Open My Business'}</strong><small>{managed ? 'Orders, bundle prices, Store Earnings and analytics are in My Business.' : 'See visitors, share your link and change website settings in My Business.'}</small></span>
        </button>}
      </div> : <>{published && changes && <div className="website-publish-changes" data-publish-changes>
        <strong>{changes.length ? 'What changes on your live website' : 'No changes since your last publish'}</strong>
        {changes.length > 0 ? <ul>{changes.map(change => <li key={change}>{change}</li>)}</ul> : <p>Visitors already see this version.</p>}
      </div>}<ol className="website-checklist">
        <li data-state="ok">
          <span className="website-check-icon" aria-hidden="true"><Check size={15}/></span>
          <div><strong>Business name</strong><p>{content.businessName}</p></div>
          <button type="button" onClick={() => onEditField('name')}>Change</button>
        </li>
        <li data-state={contactIssue ? (contactIssue.level === 'required' ? 'todo' : 'warn') : contact || managed ? 'ok' : 'warn'} data-check="contact">
          <span className="website-check-icon" aria-hidden="true">{contactIssue || (!contact && !managed) ? <AlertTriangle size={15}/> : <Check size={15}/>}</span>
          <div><strong>{contactIssue ? contactIssue.title : 'How customers reach you'}</strong><p>{contactIssue ? `${contactIssue.detail}${contactIssue.level === 'required' ? ' Needed before publishing.' : ''}` : contact || (managed ? 'Optional. Customers buy and track orders on your store; a WhatsApp number adds a Chat button for questions.' : 'No WhatsApp, phone or email yet. Customers will not be able to contact you.')}</p></div>
          <button type="button" onClick={() => onEditField('contact')}>{contact ? 'Change' : 'Add'}</button>
        </li>
        {others.map(item => <li key={item.id} data-state={item.level === 'required' ? 'todo' : 'warn'} data-check={item.id}>
          <span className="website-check-icon" aria-hidden="true"><AlertTriangle size={15}/></span>
          <div><strong>{item.title}</strong><p>{item.detail}</p></div>
          {item.fix && onFix ? <button type="button" onClick={() => onFix(item)}>{item.fix.label}</button> : item.id === 'bundles' && onBundles ? <button type="button" onClick={onBundles}>Set up</button> : <button type="button" onClick={() => onEditField(item.id === 'tagline' ? 'content:tagline' : item.id === 'cta' ? 'content:ctaLabel' : 'contact')}>Fix</button>}
        </li>)}
        {suggestions.length > 0 && <li data-state="info">
          <span className="website-check-icon" aria-hidden="true"><PenLine size={15}/></span>
          <div><strong>Make it sound like you</strong>
            <p>Optional. Still from the design: {suggestions.map(s => s.label).join(', ')}. Fine to publish if they fit your business.</p></div>
          <button type="button" onClick={() => onEditField(suggestions[0].target)}>Review</button>
        </li>}
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
      </ol></>}
    </div>
    <div className="website-sheet-foot">
      {done ? <button type="button" onClick={onClose} className="website-sheet-confirm">Back to editing</button> : <>
        <button type="button" disabled={!!busy} onClick={close} className="website-sheet-cancel">Not yet</button>
        <button type="button" disabled={!!busy || (!managed && examples.length > 0) || required.length > 0} onClick={() => void publish()} className="website-sheet-confirm">
          {busy === 'publish' ? 'Publishing…' : required.length ? 'Add what’s missing first' : !managed && examples.length ? `Review ${examples.length} first` : published ? 'Update live site' : 'Publish now'}
        </button>
      </>}
    </div>
  </dialog>;
}
