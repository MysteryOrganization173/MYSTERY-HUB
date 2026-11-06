import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, MessageCircle, Plus, RotateCcw, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';
import { CreativeBriefRequestError, submitCreativeBrief } from '../../services/apiClient';
import { trackGrowth } from '../../utils/growthAnalytics';
import {
  CREATIVE_LIMITS, CREATIVE_SERVICES, creativeBriefProblems, creativeService,
  type CreativeBriefInput, type CreativeField, type CreativeServiceId,
} from '../../../shared/creativeStudio';

type Status = 'editing' | 'sending' | 'failed' | 'sent';
const accraToday = () => new Date().toISOString().slice(0, 10);
const newRequestId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (Number(c) ^ (Math.random() * 16 >> (Number(c) / 4))).toString(16)));

/** The WhatsApp line a customer can send after a brief is saved: only the reference and service, no personal details. */
export function creativeWhatsAppUrl(reference: string, service: string) {
  return `${BUSINESS_CONFIG.contact.supportWhatsAppUrl}?text=${encodeURIComponent(`Hello Mystery Hub, I sent a Creative Studio brief (${reference}) for ${service}.`)}`;
}

/**
 * The Creative Studio brief. One short form whose middle part changes with the chosen service. Validation is the
 * same shared rule the server applies; success is shown only after the server confirms the brief is stored.
 * A failed send keeps everything typed. Retrying an unchanged brief reuses its request id, so it can never become two leads.
 */
export const CreativeBriefForm: React.FC<{ service: CreativeServiceId | ''; onService: (id: CreativeServiceId) => void }> = ({ service, onService }) => {
  const { user } = useApp();
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [details, setDetails] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [links, setLinks] = useState<string[]>(['']);
  const [budget, setBudget] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>('editing');
  const [failure, setFailure] = useState<{ message: string; retryable: boolean } | null>(null);
  const [sent, setSent] = useState<{ reference: string; service: string } | null>(null);
  const request = useRef<{ key: string; id: string } | null>(null);
  const started = useRef(false);
  const sentHeading = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const today = accraToday();

  // Signed-in customers start with their own contact details (they can change them).
  useEffect(() => {
    if (!user) return;
    setName(n => n || user.name || '');
    setPhone(p => p || user.phone || '');
    setEmail(e => e || user.email || '');
  }, [user]);
  useEffect(() => { if (status === 'sent') sentHeading.current?.focus(); }, [status]);

  const selected = creativeService(service);
  const own = (selected && values[selected.id]) || {};
  const setField = (id: string, value: string) => { if (!selected) return; setValues(v => ({ ...v, [selected.id]: { ...(v[selected.id] || {}), [id]: value } })); clearError(`fields.${id}`); };
  const clearError = (key: string) => setErrors(e => { if (!e[key]) return e; const next = { ...e }; delete next[key]; return next; });
  const markStarted = () => { if (!started.current) { started.current = true; trackGrowth('creative_brief_started', { page: 'creative' }); } };
  const focusField = (field: string) => requestAnimationFrame(() => (formRef.current?.querySelector<HTMLElement>(`[data-field="${field}"]`) || formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]'))?.focus());

  const payload = useMemo((): CreativeBriefInput => {
    const fields = selected ? Object.fromEntries(selected.fields.map(f => [f.id, (own[f.id] || '').trim()]).filter(([, v]) => v)) : {};
    return {
      requestId: '', service: (selected?.id || '') as CreativeServiceId, name: name.trim(), phone: phone.trim(), email: email.trim() || undefined,
      details: details.trim(), neededBy: neededBy || undefined, budget: budget.trim() || undefined,
      links: links.map(l => l.trim()).filter(Boolean), fields, website,
    };
  }, [selected, own, name, phone, email, details, neededBy, budget, links, website]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === 'sending') return;
    // The same brief sent again (after a lost reply) keeps its id; any change makes a new one.
    const key = JSON.stringify(payload);
    if (!request.current || request.current.key !== key) request.current = { key, id: newRequestId() };
    const body = { ...payload, requestId: request.current.id };
    // Every problem at once, in the order of the form; focus goes to the first one.
    const problems = creativeBriefProblems(body, today);
    if (problems.length) {
      setErrors(Object.fromEntries(problems.map(p => [p.field || 'form', p.message])));
      setFailure(null); setStatus('editing');
      focusField(problems[0].field);
      return;
    }
    setErrors({}); setFailure(null); setStatus('sending');
    try {
      const saved = await submitCreativeBrief(body);
      setSent({ reference: saved.reference, service: saved.service });
      setStatus('sent');
    } catch (error) {
      const err = error instanceof CreativeBriefRequestError ? error : new CreativeBriefRequestError('We could not save your brief just now. Please try again.');
      if (err.field) { setErrors({ [err.field]: err.message }); focusField(err.field); }
      setFailure({ message: err.message, retryable: err.retryable });
      setStatus('failed');
    }
  };

  const startAgain = () => {
    request.current = null; setValues({}); setDetails(''); setNeededBy(''); setLinks(['']); setBudget('');
    setErrors({}); setFailure(null); setSent(null); setStatus('editing');
  };

  if (status === 'sent' && sent) {
    return (
      <div className="cs-sheet cs-sent" role="status" aria-live="polite">
        <div className="cs-sent-icon"><CheckCircle2 size={28} aria-hidden /></div>
        <h3 ref={sentHeading} tabIndex={-1}>Brief received</h3>
        <p className="cs-sheet-sub">Mystery Hub has saved your brief for {sent.service}. Keep this reference:</p>
        <p className="cs-ref" aria-label={`Reference ${sent.reference.split('').join(' ')}`}>{sent.reference}</p>
        <ol>
          <li>The team reads your brief. Nothing has started and nothing is charged yet.</li>
          <li>We contact you on {phone.trim() || 'the number you gave'} to agree what you will receive.</li>
          <li>You get a quote with the price and timing. Work starts only if you accept it.</li>
        </ol>
        <div className="cs-sent-actions">
          <a className="cs-btn cs-btn-primary" href={creativeWhatsAppUrl(sent.reference, sent.service)} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden />Message us about {sent.reference}<span className="sr-only"> (opens WhatsApp)</span></a>
          <button type="button" className="cs-btn cs-btn-ghost" onClick={startAgain}><RotateCcw size={17} aria-hidden />Send another brief</button>
        </div>
      </div>
    );
  }

  const sending = status === 'sending';
  const err = (key: string) => errors[key] ? <p className="cs-error-text" id={`cs-err-${key.replace('.', '-')}`}>{errors[key]}</p> : null;
  const invalid = (key: string) => errors[key] ? { 'aria-invalid': true as const, 'aria-describedby': `cs-err-${key.replace('.', '-')}` } : {};

  const renderField = (field: CreativeField) => {
    const key = `fields.${field.id}`, id = `cs-f-${field.id}`, value = own[field.id] || '';
    const label = <>{field.label}{!field.required && <small>(optional)</small>}</>;
    if (field.kind === 'choice') return (
      <fieldset key={field.id}>
        <legend>{label}</legend>
        <div className="cs-pills">
          {field.choices!.map((choice, i) => (
            <label className="cs-pill" key={choice}>
              <input type="radio" name={id} value={choice} checked={value === choice} data-field={i === 0 ? key : undefined} {...invalid(key)} onChange={() => setField(field.id, choice)} onClick={() => { if (value === choice && !field.required) setField(field.id, ''); }} />
              <span>{choice}</span>
            </label>
          ))}
        </div>
        {err(key)}
      </fieldset>
    );
    return (
      <div key={field.id}>
        <label className="cs-label" htmlFor={id}>{label}</label>
        <input id={id} className="cs-input" data-field={key} type={field.kind === 'date' ? 'date' : 'text'} min={field.kind === 'date' ? today : undefined}
          maxLength={field.kind === 'text' ? field.max : undefined} placeholder={field.placeholder} value={value} required={field.required}
          onChange={e => setField(field.id, e.target.value)} {...invalid(key)} />
        {err(key)}
      </div>
    );
  };

  return (
    <form ref={formRef} className="cs-sheet" onSubmit={submit} onFocusCapture={markStarted} noValidate aria-busy={sending}>
      <h3>Request a design</h3>
      <p className="cs-sheet-sub">Free to send. No account or payment needed.</p>

      <fieldset>
        <legend>What do you need?</legend>
        <div className="cs-choice-grid">
          {CREATIVE_SERVICES.map((s, i) => (
            <label className="cs-choice" key={s.id}>
              <input type="radio" name="cs-service" value={s.id} checked={service === s.id} data-field={i === 0 ? 'service' : undefined} {...invalid('service')}
                onChange={() => { onService(s.id); clearError('service'); }} />
              <span>{s.name}</span>
            </label>
          ))}
        </div>
        {err('service')}
        {selected && <p className="cs-selected-note">{selected.summary}</p>}
      </fieldset>

      {selected && (
        <fieldset className="cs-group">
          <legend className="cs-group-title">About your {selected.name.toLowerCase()}</legend>
          <div className="cs-fields">{selected.fields.map(renderField)}</div>
        </fieldset>
      )}

      <fieldset className="cs-group">
        <legend className="cs-group-title">Your brief</legend>
        <div className="cs-fields">
          <div>
            <label className="cs-label" htmlFor="cs-details">Tell us what you need</label>
            <textarea id="cs-details" className="cs-textarea" data-field="details" maxLength={CREATIVE_LIMITS.details} required value={details}
              placeholder={selected?.detailsHint || 'Choose a service above, then describe what you need.'}
              onChange={e => { setDetails(e.target.value); clearError('details'); }} {...invalid('details')} aria-describedby={errors.details ? 'cs-err-details' : 'cs-details-count'} />
            <p className="cs-hint" id="cs-details-count">Include any words, prices or dates exactly as they should appear.<span className="cs-count">{details.length}/{CREATIVE_LIMITS.details}</span></p>
            {err('details')}
          </div>
          <div className="cs-fields cs-fields-2">
            <div>
              <label className="cs-label" htmlFor="cs-needed">When do you need it?<small>(optional)</small></label>
              <input id="cs-needed" className="cs-input" type="date" data-field="neededBy" min={today} value={neededBy} onChange={e => { setNeededBy(e.target.value); clearError('neededBy'); }} {...invalid('neededBy')} />
              {err('neededBy')}
            </div>
            <div>
              <label className="cs-label" htmlFor="cs-budget">Your budget<small>(optional)</small></label>
              <input id="cs-budget" className="cs-input" data-field="budget" maxLength={CREATIVE_LIMITS.budget} placeholder="What you plan to spend, if you know" value={budget} onChange={e => { setBudget(e.target.value); clearError('budget'); }} {...invalid('budget')} />
              {err('budget')}
            </div>
          </div>
          <div>
            <span className="cs-label" id="cs-links-label">Examples you like<small>(optional)</small></span>
            <div className="cs-links" role="group" aria-labelledby="cs-links-label">
              {links.map((link, i) => (
                <div key={i}>
                  <div className="cs-link-row">
                    <input className="cs-input" type="url" inputMode="url" autoComplete="url" data-field={`links.${i}`} maxLength={CREATIVE_LIMITS.link} aria-label={`Example link ${i + 1}`}
                      placeholder="https://instagram.com/p/…" value={link} onChange={e => { const next = [...links]; next[i] = e.target.value; setLinks(next); clearError(`links.${i}`); }} {...invalid(`links.${i}`)} />
                    {links.length > 1 && <button type="button" className="cs-remove" aria-label={`Remove example link ${i + 1}`} onClick={() => { setLinks(links.filter((_, j) => j !== i)); setErrors(e => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith('links.')))); }}><X size={18} aria-hidden /></button>}
                  </div>
                  {err(`links.${i}`)}
                </div>
              ))}
              {links.length < CREATIVE_LIMITS.links && <button type="button" className="cs-text-btn" onClick={() => setLinks([...links, ''])}><Plus size={15} aria-hidden style={{ display: 'inline', verticalAlign: '-2px' }} /> Add another link</button>}
            </div>
            <p className="cs-hint">Links to designs, pages or photos you like. To send files, mention it and we will ask for them on WhatsApp.</p>
          </div>
        </div>
      </fieldset>

      <fieldset className="cs-group">
        <legend className="cs-group-title">How we reach you</legend>
        <div className="cs-fields">
          <div>
            <label className="cs-label" htmlFor="cs-name">Your name</label>
            <input id="cs-name" className="cs-input" data-field="name" autoComplete="name" maxLength={CREATIVE_LIMITS.name} required value={name} onChange={e => { setName(e.target.value); clearError('name'); }} {...invalid('name')} />
            {err('name')}
          </div>
          <div className="cs-fields cs-fields-2">
            <div>
              <label className="cs-label" htmlFor="cs-phone">WhatsApp or phone number</label>
              <input id="cs-phone" className="cs-input" data-field="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={CREATIVE_LIMITS.phone} required placeholder="024 123 4567" value={phone} onChange={e => { setPhone(e.target.value); clearError('phone'); }} {...invalid('phone')} />
              {err('phone')}
            </div>
            <div>
              <label className="cs-label" htmlFor="cs-email">Email<small>(optional)</small></label>
              <input id="cs-email" className="cs-input" data-field="email" type="email" inputMode="email" autoComplete="email" maxLength={CREATIVE_LIMITS.email} value={email} onChange={e => { setEmail(e.target.value); clearError('email'); }} {...invalid('email')} />
              {err('email')}
            </div>
          </div>
        </div>
      </fieldset>

      <div className="cs-trap" aria-hidden="true">
        <label htmlFor="cs-website">Leave this empty</label>
        <input id="cs-website" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
      </div>

      {errors.form && <p className="cs-error-text" role="alert">{errors.form}</p>}
      {status !== 'failed' && Object.keys(errors).filter(k => k !== 'form').length > 0 && <p className="cs-error-text" role="alert">Please check the {Object.keys(errors).filter(k => k !== 'form').length === 1 ? 'highlighted answer' : `${Object.keys(errors).filter(k => k !== 'form').length} highlighted answers`} above.</p>}
      {status === 'failed' && failure && (
        <div className="cs-alert cs-alert-error" role="alert">
          <AlertCircle size={18} aria-hidden />
          <div>
            <strong>Your brief was not sent.</strong> {failure.message}
            <div className="cs-alert-actions">
              {failure.retryable && <span>Everything you typed is still here, so you can press “Try sending again”.</span>}
              <a href={BUSINESS_CONFIG.contact.supportWhatsAppUrl} target="_blank" rel="noopener noreferrer">Or message us on WhatsApp<span className="sr-only"> (opens WhatsApp)</span></a>
            </div>
          </div>
        </div>
      )}

      <p className="cs-consent">Sending a brief doesn’t commit you to anything. We use these details to reply about this request.</p>
      <button type="submit" className="cs-btn cs-btn-primary cs-submit" disabled={sending}>{sending ? 'Sending your brief…' : status === 'failed' && failure?.retryable ? 'Try sending again' : 'Send my brief'}</button>
    </form>
  );
};
