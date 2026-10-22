import React, {useEffect, useRef, useState} from 'react';
import {X} from 'lucide-react';
import type {WebsiteSiteRecord} from '../../types';
import {useApp} from '../../context/AppContext';
import {createWebsiteStarter} from '../../services/websiteB1Api';
import {WEBSITE_STARTER_VERSION} from '../../config/websiteStarters';
import {getTemplateById} from '../../utils/templateRendererUtils';
import {trackWebsiteEvent} from '../../utils/websiteAnalytics';
import {hasWorkingWhatsApp, websiteContactNeed} from '../../utils/websiteReadiness';
import './websiteBuilder.css';

export interface WebsiteStartDetails {businessName: string; whatsapp: string; location: string}
const freshToken = () => localStorage.getItem('mystery_hub_session_token') || sessionStorage.getItem('mystery_hub_session_token');

/**
 * The only questions before a new website exists: its real name, and optionally how customers
 * reach it and where it is. Everything else starts from the design's starter and is edited later.
 */
export function WebsiteStartSheet({templateId, initialName = '', onCreated, onClose}: {
  templateId: string; initialName?: string; onCreated: (site: WebsiteSiteRecord, alreadyExists: boolean) => void; onClose: () => void;
}) {
  const {user, sessionToken, openAuth, showToast} = useApp();
  const dialog = useRef<HTMLDialogElement>(null);
  const [details, setDetails] = useState<WebsiteStartDetails>({businessName: initialName, whatsapp: '', location: ''});
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const template = getTemplateById(templateId);
  useEffect(() => {dialog.current?.showModal();}, []);
  const name = details.businessName.trim();
  // V5.1: whether WhatsApp is needed depends on how this design's customers act.
  const need = websiteContactNeed(templateId);
  const whatsappProblem = details.whatsapp.trim() && !hasWorkingWhatsApp(details.whatsapp) ? 'Enter the full number, for example 024 123 4567 or +233 24 123 4567.' : '';
  const problem = !name ? '' : name.length < 2 ? 'Use at least 2 characters.' : /[<>]/.test(details.businessName + details.whatsapp + details.location) ? 'Use plain text without < or >.' : whatsappProblem;

  const create = async (token: string, input: WebsiteStartDetails) => {
    trackWebsiteEvent('website_build_started', {templateId, source: 'builder'}, token);
    const content = {...(input.whatsapp.trim() ? {whatsapp: input.whatsapp.trim()} : {}), ...(input.location.trim() ? {location: input.location.trim()} : {})};
    const res = await createWebsiteStarter(token, templateId, input.businessName.trim(), WEBSITE_STARTER_VERSION, content);
    onCreated(res.site, res.alreadyExists);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name || problem || busy) return;
    const input = {...details};
    if (!user || !sessionToken) {
      // Sign-up happens in between; the owner's answers are kept and used straight after.
      onClose();
      openAuth('signup', `Create your free account to save ${input.businessName.trim()}.`, () => {
        const token = freshToken();
        if (token) void create(token, input).catch((e: any) => showToast(e.message || 'We could not create your website. Please try again.', 'warning'));
      });
      return;
    }
    setBusy(true); setError('');
    try {await create(sessionToken, input);}
    catch (e: any) {setError(e.message || 'We could not create your website. Please try again.');}
    finally {setBusy(false);}
  };

  return <dialog ref={dialog} aria-labelledby="website-start-title" onCancel={event => {event.preventDefault(); if (!busy) onClose();}} className="website-sheet website-start">
    <form onSubmit={submit} className="contents">
      <div className="website-sheet-head">
        <div className="min-w-0 flex-1"><h2 id="website-start-title">Make it yours</h2><p>{template.title} · you can change everything later</p></div>
        <button type="button" disabled={busy} onClick={onClose} aria-label="Close" className="website-sheet-close"><X size={20}/></button>
      </div>
      <div className="website-sheet-body">
        <label className="website-start-field">
          <span>Business name</span>
          <input autoFocus required maxLength={100} value={details.businessName} onChange={e => setDetails({...details, businessName: e.target.value})} placeholder="e.g. Auntie Ama’s Kitchen" autoComplete="organization" enterKeyHint="next" aria-invalid={!!problem}/>
        </label>
        <label className="website-start-field">
          <span>WhatsApp number <em>{need === 'whatsapp' ? 'needed to publish' : need === 'contact' ? 'recommended' : 'optional'}</em></span>
          <input type="tel" inputMode="tel" maxLength={30} value={details.whatsapp} onChange={e => setDetails({...details, whatsapp: e.target.value})} placeholder="e.g. 024 123 4567" autoComplete="tel" enterKeyHint="next" aria-invalid={!!whatsappProblem} aria-describedby="website-start-whatsapp-hint"/>
          <small id="website-start-whatsapp-hint" data-need={need}>{whatsappProblem || (need === 'whatsapp' ? 'Customers send their orders to this WhatsApp. You can start your draft without it, but you need it before publishing.' : need === 'contact' ? 'Your website’s buttons open a WhatsApp chat with you. You can add a phone or email later instead.' : 'Adds a Chat button for customer questions. Customers buy and pay on your store, not on WhatsApp.')}</small>
        </label>
        <label className="website-start-field">
          <span>Area or address <em>optional</em></span>
          <input maxLength={150} value={details.location} onChange={e => setDetails({...details, location: e.target.value})} placeholder="e.g. Osu, Accra" autoComplete="address-level2" enterKeyHint="go"/>
        </label>
        <p className="website-sheet-note">{templateId === 'tmpl-data-reseller' ? 'Your store shows Mystery Hub data bundles. You choose which to sell and set your prices after creating it.' : templateId === 'tmpl-start-blank' ? 'Your website starts as a simple page of sections that you fill in.' : 'Your website starts with a few example items for this kind of business, marked “Example”. Edit them, keep the ones that fit and remove the rest before you publish.'}</p>
        {(problem || error) && <p role="alert" className="text-sm text-amber-200">{problem || error}</p>}
      </div>
      <div className="website-sheet-foot">
        <button type="button" disabled={busy} onClick={onClose} className="website-sheet-cancel">Back</button>
        <button type="submit" disabled={!name || !!problem || busy} className="website-sheet-confirm">{busy ? 'Creating your website…' : 'Create my website'}</button>
      </div>
    </form>
  </dialog>;
}
