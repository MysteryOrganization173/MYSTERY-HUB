import React, { useEffect, useRef, useState } from 'react';
import { Braces, CheckCircle2, Link2, Send, Smartphone, Sparkles, Users, X } from 'lucide-react';
import type { AdminNotificationsClient, NotificationAudience, NotificationDestination, NotificationLimits, NotificationOverview, NotificationPlaceholder, NotificationSendSummary, NotificationTemplate } from '../../../services/adminNotifications';
import { AI_DRAFT_ACTIONS, type AdminAiDraftingClient, type AiDraftAction, type AiDraftProposal } from '../../../services/adminAiDrafting';
import {
  CATEGORY_LABELS, SAMPLE_PLACEHOLDERS, STARTER_TEMPLATES, audienceAllows, draftFingerprint, insertAt, lengthGuidance,
  renderWithSamples, sendBlockers, unsupportedPlaceholders, type NotificationDraft,
} from '../../../utils/notificationComposer';
import { AdminButton, AdminNotice, AdminPanel, AdminSheet, StatusPill, adminField, adminLabel } from '../ui/AdminUi';
import { BrandMark } from '../../common/BrandLogo';

export interface ComposerData {
  audiences: NotificationAudience[] | null;
  placeholders: NotificationPlaceholder[] | null;
  destinations: NotificationDestination[] | null;
  limits: NotificationLimits;
  templates: NotificationTemplate[] | null;
}

const emptyDraft: NotificationDraft = { templateId: null, category: 'marketing', title: '', body: '', destination: '/', audienceId: null };
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
/** Devices and people are different numbers: one customer may have several phones; a visitor browser is one device. */
function audienceCount(a: NotificationAudience) {
  if (a.eligibleCount == null) return 'Counted when you review';
  if (a.kind === 'members' && a.people != null) return `${plural(a.people, 'customer')} · ${plural(a.eligibleCount, 'device')}`;
  if (a.kind === 'guests') return plural(a.eligibleCount, 'browser');
  return plural(a.eligibleCount, 'device');
}
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `send-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Compose, preview and send one notification. Sending always goes through a confirmation that re-reads the
 * audience count, carries an idempotency key tied to the exact content, and shows only what the server reports.
 * AI help proposes text that the founder must choose to use; it can never send.
 */
export function AdminNotificationComposer({ token, client, ai, data, seed, onSent, onViewHistory,onTemplateSaved, overview = null }: {
  token: string; client: AdminNotificationsClient; ai: AdminAiDraftingClient; data: ComposerData;
  /** Server status, when loaded: sending paused or unconfigured blocks review, and a test needs the operator's own device. */
  overview?: NotificationOverview | null;
  /** A template the founder chose elsewhere (Templates tab) to start from. */
  seed: { template: Pick<NotificationTemplate, 'id' | 'name' | 'category' | 'title' | 'body' | 'destination'>; at: number } | null;
  onSent: (send: NotificationSendSummary) => void; onViewHistory: () => void;
  onTemplateSaved?:(template:NotificationTemplate)=>void;
}) {
  const [draft, setDraft] = useState<NotificationDraft>(emptyDraft);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [focusField, setFocusField] = useState<'title' | 'body'>('body');
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const keyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const inFlight = useRef(false);
  const [confirm, setConfirm] = useState<{ count: number;previewId?:string;revision:number;customers?:number;customerDevices?:number;guests?:number } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const testKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const revision=useRef(0);
  const [checking, setChecking] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ send: NotificationSendSummary; duplicate: boolean } | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [aiBusy, setAiBusy] = useState<AiDraftAction | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<AiDraftProposal[] | null>(null);
  const aiRequest = useRef<AbortController | null>(null);
  useEffect(() => () => aiRequest.current?.abort(), []);

  const placeholders = data.placeholders ?? SAMPLE_PLACEHOLDERS;
  const audiences = data.audiences ?? [];
  const locked = Boolean(result) || sending;
  const update = (patch: Partial<NotificationDraft>) => {revision.current++;aiRequest.current?.abort();setProposals(null);setConfirm(null);setTestResult(null);setDraft(d => ({ ...d, ...patch })); setReviewError(null); };

  const applyTemplate = (t: Pick<NotificationTemplate, 'id' | 'name' | 'category' | 'title' | 'body'> & { destination?: string | null }) => {
    revision.current++;aiRequest.current?.abort();setConfirm(null);
    setTestResult(null);
    setDraft(d => ({ ...d, templateId: t.id.startsWith('starter-') ? null : t.id, category: t.category, title: t.title, body: t.body,
      // An announcement keeps the page already chosen; an automatic order update always opens Orders.
      destination: t.category === 'transactional' ? '/orders' : d.destination && d.destination !== '/orders' && d.destination !== '/app' ? d.destination : '/',
      audienceId: d.audienceId && audiences.find(a => a.id === d.audienceId && audienceAllows(a, t.category)) ? d.audienceId : null }));
    setTemplateName(t.name); setProposals(null); setReviewError(null);
  };
  useEffect(() => { if (seed && !locked) applyTemplate(seed.template); }, [seed?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  const insertPlaceholder = (token: string) => {
    const field = focusField === 'title' ? titleRef.current : bodyRef.current;
    const text = draft[focusField];
    const { value, caret } = insertAt(text, field?.selectionStart ?? text.length, field?.selectionEnd ?? text.length, token);
    update({ [focusField]: value } as Partial<NotificationDraft>);
    requestAnimationFrame(() => { field?.focus(); field?.setSelectionRange(caret, caret); });
  };

  const askAi = async (action: AiDraftAction) => {
    if (!draft.title.trim() && !draft.body.trim()) { setAiError('Write a title or message first, then ask for help.'); return; }
    aiRequest.current?.abort();
    const request = new AbortController(); aiRequest.current = request;
    setAiBusy(action); setAiError(null); setProposals(null);
    try {
      const res = await ai.propose(token, { templateId:draft.templateId,action, title: draft.title, body: draft.body, placeholders: placeholders.map(p => p.token) }, request.signal);
      if (request.signal.aborted) return;
      if (!res.ok) setAiError(res.message);
      else if (!res.proposals.length) setAiError('No suggestion this time. Your message is unchanged.');
      else setProposals(res.proposals.slice(0, 3));
    } catch {
      if (!request.signal.aborted) setAiError('AI help is unavailable right now. Your message is unchanged and you can keep editing.');
    } finally { if (aiRequest.current === request) { setAiBusy(null); aiRequest.current = null; } }
  };

  const blockers = client.available ? sendBlockers(draft, { audiences, placeholders: data.placeholders, limits: data.limits }) : [];
  const audience = audiences.find(a => a.id === draft.audienceId) || null;
  const savedMatch = data.templates?.find(t => t.id === draft.templateId && !t.locked && t.enabled !== false && t.title === draft.title.trim() && t.body === draft.body.trim()) || null;
  // Known from the server's status: paused or unconfigured sending cannot be reviewed for customers.
  const sendingBlocked = overview?.readiness ? (overview.sendingEnabled !== true ? 'Web Push is not configured, so announcements cannot be sent yet.' : overview.paused !== false ? 'Sending is paused. You can send this to your own devices to check it; announcements wait until sending is resumed.' : null) : null;
  const testBlocked = !client.testSelf ? 'Tests are not available.' : overview?.readiness && overview.sendingEnabled !== true ? 'Web Push is not configured on the server.'
    : overview?.readiness && overview.readiness.ownDevices === 0 ? 'No phone is registered to your account yet. Turn on notifications in My Account on your phone first.'
    : !savedMatch ? 'Save this exact wording as a template first.' : null;
  const sendTest = async () => {
    if (testBlocked || !savedMatch || testing || !client.testSelf) return;
    const fingerprint = draftFingerprint(draft);
    if (testKey.current?.fingerprint !== fingerprint) testKey.current = { fingerprint, key: newKey() };
    setTesting(true); setTestResult(null);
    const res = await client.testSelf(token, { requestId: testKey.current.key, templateId: savedMatch.id, destination: draft.destination || '/' });
    setTesting(false);
    setTestResult(res.ok ? { ok: true, message: res.duplicate ? 'This test was already sent. Check your phone.' : `Sent to your ${plural(res.devices, 'device')} only. Check how it looks and that it opens the right page.` } : { ok: false, message: res.message });
  };

  const review = async () => {
    if (!client.available || blockers.length || !audience || inFlight.current) return;
    setChecking(true); setReviewError(null); setConfirmError(null); setAcknowledged(false);
    try {
      const current=revision.current;
      const saved=data.templates?.find(t=>t.id===draft.templateId);
      if(client.prepareAudience&&(!saved||saved.locked||saved.enabled===false||saved.title!==draft.title.trim()||saved.body!==draft.body.trim()))throw Error('Save the exact marketing draft as a template before reviewing recipients.');
      if(audience.available===false)throw Error(audience.unavailableReason||'This audience is not available right now.');
      // Read the audience again: the confirmation must show who would receive it right now.
      const single=audience.single||audience.id==='customer';
      if(single&&!draft.userId?.trim())throw Error('Enter the customer account ID from Customers.');
      const preview=client.prepareAudience?await client.prepareAudience(token,{templateId:draft.templateId!,audience:audience.kind??'members',destination:draft.destination||'/',...(single?{userId:draft.userId?.trim()}:{})}):{eligibleDevices:await client.countAudience(token,audience.id),previewId:undefined};
      if(current!==revision.current)return;
      const count=preview.eligibleDevices;
      if (count <= 0) { setReviewError('Nobody in this audience can receive notifications right now.'); return; }
      setConfirm({ count,previewId:preview.previewId,revision:current,customers:'eligibleCustomers' in preview?preview.eligibleCustomers:undefined,customerDevices:'eligibleCustomerDevices' in preview?preview.eligibleCustomerDevices:undefined,guests:'eligibleGuests' in preview?preview.eligibleGuests:undefined });
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'Could not check the audience. Nothing was sent.');
    } finally { setChecking(false); }
  };

  const send = async () => {
    if (!confirm || !audience || inFlight.current||confirm.revision!==revision.current) return;
    inFlight.current = true; setSending(true); setConfirmError(null);
    const fingerprint = draftFingerprint(draft);
    if (keyRef.current?.fingerprint !== fingerprint) keyRef.current = { fingerprint, key: newKey() };
    try {
      const res = await client.createSend(token, { previewId:confirm.previewId,idempotencyKey: keyRef.current.key, templateId: draft.templateId, category: draft.category, title: draft.title.trim(), body: draft.body.trim(), destination: draft.destination, audienceId: audience.id, confirmedRecipients: confirm.count });
      if (!res.ok) {
        if (res.code === 'count_changed') {
          setConfirm(null);setReviewError('The audience or template changed. Prepare and review a fresh preview before sending.');
          setAcknowledged(false);
        }
        setConfirmError(res.code === 'count_changed' ? 'The audience changed while you were reviewing. Check the new number before sending.' : res.message);
        return;
      }
      setResult({ send: res.send, duplicate: res.duplicate });
      setConfirm(null);
      onSent(res.send);
    } catch (error) {
      // Unknown outcome: keep the same key so trying again cannot create a second send.
      setConfirmError(`${error instanceof Error ? error.message : 'The server did not answer.'} If you try again, the same message key is used, so it cannot be sent twice.`);
    } finally { inFlight.current = false; setSending(false); }
  };

  const reset = () => { setDraft(emptyDraft); setTemplateName(null); setResult(null); keyRef.current = null; testKey.current = null; setTestResult(null); setProposals(null); setAiError(null); setReviewError(null); };

  const titleGuide = lengthGuidance('title', draft.title, data.limits);
  const bodyGuide = lengthGuidance('body', draft.body, data.limits);
  const guideClass = (tone: string) => tone === 'over' ? 'text-rose-300' : tone === 'long' ? 'text-amber-200' : 'text-slate-400';
  const savedTemplates = data.templates ?? [];
  const automatic=draft.category==='transactional';
  const saveDraft=async()=>{
    if(locked||automatic||checking)return;const current=revision.current;setChecking(true);setReviewError(null);
    try{const r=await client.saveTemplate(token,{id:null,expectedVersion:null,name:draft.title.trim(),title:draft.title.trim(),body:draft.body.trim(),category:'marketing',destination:draft.destination||'/',enabled:true});if(current!==revision.current)return;if(!r.ok)throw Error(r.message);onTemplateSaved?.(r.template);applyTemplate(r.template);}catch(e){setReviewError((e as Error).message);}finally{setChecking(false);}
  };

  if (result) {
    return (
      <AdminPanel tone="success" title={result.duplicate ? 'Already queued' : 'Message handed to the server'}>
        <div className="space-y-3 text-sm text-slate-200">
          <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            {result.duplicate ? 'This exact campaign was already queued. No second campaign was created.' : `“${result.send.title}” is queued for ${result.send.recipients.toLocaleString()} ${result.send.recipients === 1 ? 'device' : 'devices'} in ${result.send.audienceLabel}.`}</p>
          <p className="text-xs text-slate-400">Delivery results arrive over the next minutes in History. “Accepted” means the push service took the message, not that someone read it.</p>
          <div className="flex flex-wrap gap-2"><AdminButton variant="primary" onClick={onViewHistory}>View delivery results</AdminButton><AdminButton onClick={reset}>Write another message</AdminButton></div>
        </div>
      </AdminPanel>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">

        <AdminPanel title="1. Start from a template" description="Order updates go to the people concerned; promotions only reach people who agreed to them.">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] sm:flex-wrap">
            {[...STARTER_TEMPLATES, ...savedTemplates].map(t => (
              <button key={t.id} type="button" disabled={locked} onClick={() => applyTemplate(t)} aria-pressed={templateName === t.name}
                className={`min-h-11 shrink-0 rounded-xl border px-3 text-left text-sm ${templateName === t.name ? 'border-[#00c365]/60 bg-[#00c365]/10 text-white' : 'border-slate-800 bg-[#0d151b] text-slate-300 hover:text-white'}`}>
                <span className="block font-semibold">{t.name}</span>
                <span className="block text-[11px] text-slate-400">{t.id.startsWith('starter-') ? CATEGORY_LABELS[t.category] : `Saved · ${CATEGORY_LABELS[t.category]}`}</span>
              </button>
            ))}
          </div>
          {data.templates === null && client.available && <p className="mt-2 text-xs text-slate-400">Templates could not be loaded. Refresh before reviewing a send.</p>}
        </AdminPanel>

        {automatic&&<AdminNotice tone="info" title="Automatic order update">This locked template is sent only from verified server events. It cannot be edited or sent as an announcement. Select a marketing template for a manual message.</AdminNotice>}

        <AdminPanel title="2. Write the message">
          <div className="space-y-4">
            <label className={adminLabel}>
              <span>Message type</span>
              <select className={adminField} value={draft.category} disabled={locked||automatic} onChange={e => update({ category: e.target.value as NotificationDraft['category'], audienceId: null })}>
                {(automatic?['transactional']:['marketing']).map(c => <option key={c} value={c}>{CATEGORY_LABELS[c as NotificationDraft['category']]}</option>)}
              </select>
            </label>
            <div className={adminLabel}>
              <label htmlFor="notif-title" className="block">Title</label>
              <input id="notif-title" ref={titleRef} className={adminField} value={draft.title} disabled={locked||automatic} maxLength={data.limits.titleMax + 40} onFocus={() => setFocusField('title')} onChange={e => update({ title: e.target.value })} placeholder="Short and specific" aria-describedby="notif-title-count" />
              <span id="notif-title-count" className={`block text-xs ${guideClass(titleGuide.tone)}`}>{titleGuide.count}/{titleGuide.max} · {titleGuide.message}</span>
            </div>
            <div className={adminLabel}>
              <label htmlFor="notif-body" className="block">Message</label>
              <textarea id="notif-body" ref={bodyRef} className={`${adminField} min-h-28`} value={draft.body} disabled={locked||automatic} maxLength={data.limits.bodyMax + 120} onFocus={() => setFocusField('body')} onChange={e => update({ body: e.target.value })} placeholder="What happened and what, if anything, the customer should do" aria-describedby="notif-body-count" />
              <span id="notif-body-count" className={`block text-xs ${guideClass(bodyGuide.tone)}`}>{bodyGuide.count}/{bodyGuide.max} · {bodyGuide.message}</span>
            </div>
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-sm text-slate-300"><Braces className="h-4 w-4 text-slate-400" />Insert into the {focusField === 'title' ? 'title' : 'message'}</p>
              <div className="flex flex-wrap gap-1.5">
                {placeholders.map(p => (
                  <button key={p.token} type="button" disabled={locked||automatic} onMouseDown={e => e.preventDefault()} onClick={() => insertPlaceholder(p.token)}
                    className="min-h-10 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-slate-200 hover:border-[#00c365]/50"><span className="font-mono text-[#00c365]">{p.token}</span> <span className="text-slate-400">{p.label}</span></button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-400">Only generic application and event labels are supported. Customer details never enter a push packet.</p>
            </div>
            <label className={adminLabel}>
              <span className="flex items-center gap-1.5"><Link2 className="h-4 w-4 text-slate-400" />Opens when tapped <span className="text-slate-400">(optional)</span></span>
              <select className={adminField} value={automatic?'/orders':draft.destination||'/'} disabled={locked||automatic||!data.destinations} onChange={e=>update({destination:e.target.value})}>
                {automatic&&<option value="/orders">Orders after sign-in</option>}
                {!automatic&&(data.destinations ?? [{value:'/',label:'Home'}]).map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <span aria-hidden="true" className="block text-xs text-slate-400">{data.destinations ? 'Only pages the server has approved can be linked. No web addresses.' : 'Approved pages will appear when the server provides them.'}</span>
            </label>

            {/* Optional AI help: proposals only */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-200"><Sparkles className="h-4 w-4 text-[#00c365]" />AI wording help <span className="font-normal text-slate-400">· optional</span></p>
              <p className="mb-2 text-xs text-slate-400">Uses canonical built-in template wording only. Your edited message and customer details are never sent to Gemini. Automatic order templates remain locked.</p>
              {!ai.available ? <p className="text-xs text-slate-400">AI wording help is not connected yet. Your message and preview work normally without it.</p> : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {AI_DRAFT_ACTIONS.map(a => <AdminButton key={a.id} disabled={locked || Boolean(aiBusy)} busy={aiBusy === a.id} onClick={() => void askAi(a.id)} className="!min-h-10 !px-2.5 !text-xs">{a.label}</AdminButton>)}
                  </div>
                  {aiBusy && <p role="status" className="mt-2 text-xs text-slate-400">Asking for a suggestion… You can keep editing.</p>}
                  {aiError && <p role="alert" className="mt-2 text-xs text-amber-200">{aiError}</p>}
                  {proposals && (
                    <div className="mt-3 space-y-2" aria-label="AI suggestions">
                      <p className="text-xs text-slate-400">Suggestions only. Nothing changes until you choose one, and you can edit it afterwards.</p>
                      {proposals.map((p, i) => {
                        const unknown = data.placeholders ? unsupportedPlaceholders(`${p.title} ${p.body}`, data.placeholders) : [];
                        return (
                          <div key={i} className="rounded-xl border border-slate-700 bg-[#0b1217] p-3 text-sm">
                            <p className="font-semibold text-white">{p.title}</p>
                            <p className="mt-0.5 whitespace-pre-line text-slate-300">{p.body}</p>
                            {unknown.length > 0 && <p className="mt-1 text-xs text-amber-200">Contains {unknown.join(', ')}, which the server cannot fill.</p>}
                            <div className="mt-2 flex gap-2">
                              <AdminButton variant="primary" disabled={automatic} className="!min-h-10" onClick={() => { update({ title: p.title, body: p.body }); setProposals(null); }}>Use this</AdminButton>
                            </div>
                          </div>
                        );
                      })}
                      <AdminButton onClick={() => setProposals(null)} className="!min-h-10"><X className="h-4 w-4" />Keep my wording</AdminButton>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </AdminPanel>

        {/* Phones: the preview sits right under the editor so the founder sees it while writing */}
        <div className="lg:hidden">
          <NotificationPreview kind={automatic ? 'account' : 'announcement'} title={draft.title} body={draft.body} placeholders={placeholders} destination={automatic ? 'Orders after sign-in' : data.destinations?.find(d => d.value === draft.destination)?.label ?? 'Home'} />
        </div>

        <AdminPanel title="3. Choose who receives it">
          {!client.available ? <p className="text-sm text-slate-400">Audiences, recipient counts and consent rules come from the server and will appear here when it is connected.</p>
            : data.audiences === null ? <p role="alert" className="text-sm text-amber-200">Audiences could not be loaded. Refresh to try again; nothing can be sent without them.</p>
            : (
              <fieldset className="space-y-2" disabled={locked}>
                <legend className="sr-only">Audience</legend>
                {audiences.map(a => {
                  const allowed = audienceAllows(a, draft.category) && a.available !== false;
                  return (
                    <label key={a.id} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3 ${draft.audienceId === a.id ? 'border-[#00c365]/60 bg-[#00c365]/8' : 'border-slate-800'} ${allowed ? '' : 'cursor-not-allowed opacity-55'}`}>
                      <input type="radio" name="notif-audience" className="mt-1 h-4 w-4 accent-[#00c365]" checked={draft.audienceId === a.id} disabled={!allowed} onChange={() => update({ audienceId: a.id })} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                          <span className="font-semibold text-white">{a.label}</span>
                          <span className="inline-flex items-center gap-1 text-xs tabular-nums text-slate-300"><Users className="h-3.5 w-3.5" aria-hidden />{audienceCount(a)}</span>
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-400">{a.description}</span>
                        <span className="mt-1 block text-xs text-slate-400">{a.available === false ? a.unavailableReason : a.consentNote}{a.available !== false && !audienceAllows(a, draft.category) ? ` Not available for ${CATEGORY_LABELS[draft.category].toLowerCase()} messages.` : ''}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            )}
        </AdminPanel>

        <div className="space-y-2">
          {draft.audienceId==='customer'&&<label className={adminLabel}>Customer account ID<input value={draft.userId||''} disabled={locked} maxLength={64} className={adminField} onChange={e=>update({userId:e.target.value})}/></label>}
          {client.available&&!automatic&&<AdminButton disabled={locked||checking||!draft.title.trim()||!draft.body.trim()} onClick={()=>void saveDraft()}>Save draft template</AdminButton>}
          {client.available && blockers.length > 0 && (draft.title || draft.body || draft.audienceId) && (
            <ul className="space-y-1 text-sm text-amber-200" aria-label="Before you can send">{blockers.map(b => <li key={b}>• {b}</li>)}</ul>
          )}
          {reviewError && <p role="alert" className="text-sm text-rose-300">{reviewError}</p>}
          {client.available && !automatic && sendingBlocked && <AdminNotice tone="info">{sendingBlocked}</AdminNotice>}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <AdminButton variant="primary" className="w-full sm:w-auto" disabled={!client.available || blockers.length > 0 || checking || locked || Boolean(sendingBlocked)} busy={checking} onClick={() => void review()}>
              <Send className="h-4 w-4" />{client.available ? 'Review and send' : 'Sending not connected yet'}
            </AdminButton>
            {client.available && !automatic && client.testSelf && <AdminButton className="w-full sm:w-auto" disabled={locked || testing || Boolean(testBlocked) || !draft.title.trim() || !draft.body.trim()} busy={testing} onClick={() => void sendTest()}>
              <Smartphone className="h-4 w-4" />Send to my devices first
            </AdminButton>}
          </div>
          {client.available && !automatic && client.testSelf && testBlocked && draft.title.trim() && draft.body.trim() && <p className="text-xs text-slate-400">Test: {testBlocked}</p>}
          {testResult && <p role={testResult.ok ? 'status' : 'alert'} className={`text-sm ${testResult.ok ? 'text-emerald-200' : 'text-rose-300'}`}>{testResult.message}</p>}
        </div>
      </div>

      <div className="hidden min-w-0 lg:sticky lg:top-[76px] lg:block lg:self-start">
        <NotificationPreview kind={automatic ? 'account' : 'announcement'} title={draft.title} body={draft.body} placeholders={placeholders} destination={automatic ? 'Orders after sign-in' : data.destinations?.find(d => d.value === draft.destination)?.label ?? 'Home'} />
      </div>

      {confirm && audience && (
        <AdminSheet title="Send this notification?" onClose={() => { if (!sending) setConfirm(null); }} busy={sending}
          footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AdminButton disabled={sending} onClick={() => setConfirm(null)}>Cancel</AdminButton>
            <AdminButton variant="primary" busy={sending} disabled={!acknowledged || sending} onClick={() => void send()}>{sending ? 'Sending…' : `Send to ${confirm.count.toLocaleString()} ${confirm.count === 1 ? 'device' : 'devices'}`}</AdminButton>
          </div>}>
          <div className="space-y-4 text-sm">
            <NotificationPreview compact kind={automatic ? 'account' : 'announcement'} title={draft.title} body={draft.body} placeholders={placeholders} destination={automatic ? 'Orders after sign-in' : data.destinations?.find(d => d.value === draft.destination)?.label ?? 'Home'} />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl border border-slate-800 p-3">
              <dt className="text-slate-400">Audience</dt><dd className="text-white">{audience.label}</dd>
              <dt className="text-slate-400">Recipients now</dt><dd className="font-semibold tabular-nums text-white">{confirm.count.toLocaleString()} {confirm.count === 1 ? 'device' : 'devices'}</dd>
              {(confirm.customers !== undefined || confirm.guests !== undefined) && <><dt className="text-slate-400">Made up of</dt><dd className="text-slate-200">{[
                confirm.customerDevices ? `${plural(confirm.customers ?? 0, 'customer')} (${plural(confirm.customerDevices, 'device')})` : null,
                confirm.guests ? plural(confirm.guests, 'visitor browser') : null,
              ].filter(Boolean).join(' and ') || '—'}</dd></>}
              <dt className="text-slate-400">Opens</dt><dd className="text-white">{data.destinations?.find(d => d.value === draft.destination)?.label ?? 'Home'}</dd>
              <dt className="text-slate-400">Type</dt><dd className="text-white">{CATEGORY_LABELS[draft.category]}</dd>
              <dt className="text-slate-400">Consent</dt><dd className="text-slate-300">{audience.consentNote}</dd>
            </dl>
            <AdminNotice tone="warning">A sent notification cannot be recalled. Everyone receives the same text; placeholders are filled with Mystery Hub’s own words, never personal details.</AdminNotice>
            <label className="flex min-h-11 items-start gap-3 text-slate-200">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#00c365]" checked={acknowledged} disabled={sending} onChange={e => setAcknowledged(e.target.checked)} />
              <span>I checked the wording, the page it opens and who receives it.</span>
            </label>
            {confirmError && <p role="alert" className="text-rose-300">{confirmError}</p>}
          </div>
        </AdminSheet>
      )}
    </div>
  );
}

/** How the message looks in an Android notification shade, collapsed and expanded, with sample values. */
/**
 * How the message looks in an Android notification shade, collapsed and expanded, with sample values. An
 * announcement shows its own approved text; an account update shows generic text, with details after sign-in.
 */
export function NotificationPreview({ title, body, placeholders, destination, compact = false, kind = 'account' }: { title: string; body: string; placeholders: NotificationPlaceholder[]; destination: string | null; compact?: boolean; kind?: 'account' | 'announcement' }) {
  const [expanded, setExpanded] = useState(true);
  const shownTitle = renderWithSamples(title.trim(), placeholders) || 'Your title appears here';
  const shownBody = renderWithSamples(body.trim(), placeholders) || 'Your message appears here.';
  const announcement = kind === 'announcement';
  const card = (open: boolean) => (
    <div className="rounded-[20px] bg-[#1d2329] p-3.5 text-left shadow-lg ring-1 ring-white/5">
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <BrandMark size="xs" className="!h-4 !w-4" />
        <span>Mystery Hub</span><span aria-hidden>·</span><span>now</span>
      </div>
      <p className={`mt-1.5 text-[14px] font-semibold leading-snug text-white ${open ? 'break-words' : 'truncate'}`}>{announcement ? shownTitle : 'Mystery Hub'}</p>
      <p className={`mt-0.5 text-[13px] leading-snug text-slate-300 ${open ? 'whitespace-pre-line break-words' : 'line-clamp-1'}`}>{announcement ? shownBody : 'An account update is available. Sign in to view it.'}</p>
    </div>
  );
  return (
    <section aria-label="Notification preview" className={compact ? '' : 'rounded-2xl border border-slate-800 bg-[#0d151b] p-4'}>
      {!compact && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Phone preview</h3>
          <div role="group" aria-label="Preview size" className="inline-flex rounded-lg border border-slate-800 p-0.5 text-xs">
            <button type="button" aria-pressed={!expanded} onClick={() => setExpanded(false)} className={`min-h-9 rounded-md px-2.5 ${!expanded ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>Collapsed</button>
            <button type="button" aria-pressed={expanded} onClick={() => setExpanded(true)} className={`min-h-9 rounded-md px-2.5 ${expanded ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>Expanded</button>
          </div>
        </div>
      )}
      <div className="rounded-3xl bg-gradient-to-b from-[#0b1015] to-[#121a21] p-3">{card(compact ? true : expanded)}</div>
      {!announcement && <div className="mt-3 text-sm text-slate-300"><p className="text-xs text-slate-400">Account inbox content after sign-in</p><p className="font-semibold">{shownTitle}</p><p className="whitespace-pre-line">{shownBody}</p></div>}
      <p className="mt-2 text-xs text-slate-400">Opens: {destination ?? 'Mystery Hub after sign-in'}{compact ? '' : announcement ? ' · Announcements show this text on the lock screen. Check it with “Send to my devices first”.' : ' · Push is generic for account privacy. Device appearance still needs founder acceptance.'}</p>
      {!compact && <StatusPill tone="neutral" dot={false}>Preview only</StatusPill>}
    </section>
  );
}
