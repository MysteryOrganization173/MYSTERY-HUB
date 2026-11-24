import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, Link2, Pencil, Plus, Share2, Shuffle, Trash2 } from 'lucide-react';
import { createGreeting, fetchTemplates, revokeGreeting, type Created, type Failure, type Result } from './api';
import { analyticsAllowed, trackGreetingsPage } from './analytics';
import { GiftArt } from './GiftArt';
import { GreetingStage } from './GreetingStage';
import { GreetingsSky, GreetingsTopBar, useGreetingsFonts } from './chrome';
import {
  LIMITS, OCCASIONS, OCCASION_COPY, TEMPLATE_CATEGORY, VARIANTS, VARIANT_COPY, checkText, cleanText, contentFingerprint, createContent, defaultOccasion, defaultVariant, isOccasion,
  draftMessage, draftProblems, draftSender, emptyDraft, type Draft, type Occasion, type TemplateOption,
} from './model';
import { browserGreetingsStore, newIdempotencyKey, type GreetingsStore, type LastCreated, type PendingAttempt, type SentGreeting } from './storage';
import { canShareNatively, copyLink, shareNatively, whatsappHref } from './share';
import { useDialogFocus } from '../hooks/useDialogFocus';

type Stage = 'design' | 'message' | 'preview';
const STAGES: { id: Stage; label: string }[] = [{ id: 'design', label: 'Design' }, { id: 'message', label: 'Message' }, { id: 'preview', label: 'Preview' }];
type Setup = { state: 'loading' } | { state: 'closed' } | { state: 'error'; failure: Failure } | { state: 'open'; templates: TemplateOption[] };
type Creating = { state: 'idle' } | { state: 'sending' } | { state: 'failed'; failure: Failure; code: string | null };

/**
 * The Mystery Greetings creator at /greetings: Design → Message → Preview → create → share. No account. Drafts stay in
 * this tab for at most two hours; Back (on screen or the phone's) keeps everything entered. The greeting exists only
 * once the server says so: one create action, a loading state, duplicate taps ignored, and a lost answer retried with
 * the same idempotency key so the server returns the same greeting instead of making another.
 */
export function CreatorPage({ search }: { search: string }) {
  useGreetingsFonts();
  const store = useMemo<GreetingsStore>(() => browserGreetingsStore(), []);
  const requested = useMemo(() => new URLSearchParams(search).get('occasion'), [search]);
  const parent = useMemo(() => store.takeParent(), [store]);
  const restored = useMemo(() => store.loadDraft(), [store]);
  const asked = isOccasion(requested) ? requested : parent?.occasion || null;
  const switched = Boolean(restored && asked && restored.draft.occasion !== asked);
  const [draft, setDraft] = useState<Draft>(() => !restored ? emptyDraft(defaultOccasion(asked)) : switched ? { ...restored.draft, occasion: asked!, templateId: null, variant: restored.draft.variant === defaultVariant(restored.draft.occasion) ? defaultVariant(asked!) : restored.draft.variant } : restored.draft);
  const [stage, setStage] = useState<Stage>(() => !restored || switched ? 'design' : restored.stage);
  const [pending, setPending] = useState<PendingAttempt | null>(() => restored?.pending || null);
  const [setup, setSetup] = useState<Setup>({ state: 'loading' });
  const [creating, setCreating] = useState<Creating>({ state: 'idle' });
  // The share screen comes back on a refresh (or Back/Forward), so a fresh link is never lost; a new visit starts fresh.
  const [created, setCreated] = useState<LastCreated | null>(() => {
    const entry = typeof performance === 'undefined' ? undefined : performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
    const kind = entry?.type;
    if (kind === 'reload' || kind === 'back_forward') return store.loadLast();
    store.clearLast(); return null;
  });
  const [errors, setErrors] = useState<Partial<Record<'recipient' | 'message' | 'sender', string>>>({});
  const [splitNotice, setSplitNotice] = useState(false);
  const inFlight = useRef(false);
  const parentRef = useRef(parent?.shareId || null);
  const main = useRef<HTMLDivElement>(null);
  const templates = setup.state === 'open' ? setup.templates : [];

  const loadSetup = useCallback(async () => {
    setSetup({ state: 'loading' });
    const result = await fetchTemplates();
    setSetup(!result.ok ? { state: 'error', failure: result.failure } : result.data.open ? { state: 'open', templates: result.data.templates } : { state: 'closed' });
  }, []);
  useEffect(() => { trackGreetingsPage(); void loadSetup(); }, [loadSetup]);

  // The draft (never the secret) follows every change, for this tab only.
  useEffect(() => { if (!created) store.saveDraft({ draft, stage, pending }); }, [draft, stage, pending, created, store]);

  // Phone Back moves between steps instead of leaving the page; the draft is kept either way.
  const pushes = useRef(0);
  const here = () => window.location.pathname + window.location.search;
  const go = useCallback((next: Stage, push = true) => {
    setStage(next);
    if (push) { window.history.pushState({ mg: next }, '', here()); pushes.current++; }
    else window.history.replaceState({ mg: next }, '', here());
    requestAnimationFrame(() => { main.current?.querySelector<HTMLElement>('[data-stage-heading]')?.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); });
  }, []);
  /** On-screen Back: the browser's own Back when this page added the step, otherwise straight to the previous step. */
  const back = () => {
    const previous: Stage = stage === 'preview' ? 'message' : 'design';
    if (pushes.current > 0 && window.history.state?.mg) { pushes.current--; window.history.back(); } else go(previous, false);
  };
  useEffect(() => {
    if (!window.history.state?.mg) window.history.replaceState({ mg: stage }, '', here());
    const onPop = (event: PopStateEvent) => {
      pushes.current = Math.max(0, pushes.current - 1);
      const target = event.state?.mg as Stage | 'done' | undefined;
      if (created) { startAnother(false); return; }
      if (target === 'design' || target === 'message' || target === 'preview') { setStage(target); requestAnimationFrame(() => window.scrollTo({ top: 0 })); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created]);

  const FIELD_OF: Record<string, 'recipient' | 'sender' | 'message'> = { recipientName: 'recipient', senderName: 'sender', showSender: 'sender', message: 'message', templateId: 'message', mode: 'message' };
  const update = (patch: Partial<Draft>) => {
    setDraft(d => ({ ...d, ...patch }));
    setErrors(e => { const next = { ...e }; for (const key of Object.keys(patch)) if (FIELD_OF[key]) delete next[FIELD_OF[key]]; return next; });
  };
  const setOccasion = (occasion: Occasion) => setDraft(d => d.occasion === occasion ? d : { ...d, occasion, templateId: null, variant: d.variant === defaultVariant(d.occasion) ? defaultVariant(occasion) : d.variant });

  const continueFromMessage = () => {
    const cleaned = { ...draft, recipientName: cleanText(draft.recipientName).text, senderName: cleanText(draft.senderName).text, message: cleanText(draft.message).text };
    setSplitNotice([draft.recipientName, draft.senderName, draft.message].some(v => cleanText(v).split));
    setDraft(cleaned);
    const problems = draftProblems(cleaned, templates);
    setErrors(problems);
    const first = (['recipient', 'message', 'sender'] as const).find(k => problems[k]);
    if (first) { requestAnimationFrame(() => document.getElementById(`mg-field-${first}`)?.focus()); return; }
    go('preview');
  };

  const create = async () => {
    if (inFlight.current || created) return;
    const problems = draftProblems(draft, templates);
    if (Object.keys(problems).length) { setErrors(problems); go('message'); return; }
    inFlight.current = true;
    setCreating({ state: 'sending' });
    const content = createContent(draft);
    const fingerprint = contentFingerprint(content);
    // Same content as an unconfirmed attempt: same key, so the server answers with that greeting if it was made.
    const attempt = pending && pending.fingerprint === fingerprint ? pending : { key: newIdempotencyKey(), fingerprint, startedAt: Date.now() };
    setPending(attempt);
    store.saveDraft({ draft, stage, pending: attempt });
    const token = store.creatorToken();
    const parentId = parentRef.current && analyticsAllowed() ? parentRef.current : null;
    let result = await createGreeting(content, token, attempt.key, parentId);
    // The greeting it came from was removed meanwhile: that context is optional, so create without it.
    if (!result.ok && result.failure === 'parent') { parentRef.current = null; result = await createGreeting(content, token, attempt.key, null); }
    inFlight.current = false;
    if (!result.ok) { setCreating({ state: 'failed', failure: result.failure, code: result.code }); return; }
    finish(result.data);
  };
  const finish = (data: Created) => {
    const entry: SentGreeting = { shareId: data.shareId, occasion: draft.occasion, recipientName: checkText(draft.recipientName, LIMITS.name).text, createdAt: new Date().toISOString(), expiresAt: data.expiresAt };
    store.remember(entry);
    const last: LastCreated = { shareId: data.shareId, url: data.url, occasion: draft.occasion, variant: draft.variant, recipientName: entry.recipientName, expiresAt: data.expiresAt, savedAt: Date.now() };
    store.saveLast(last);
    store.clearDraft();
    setPending(null);
    setCreating({ state: 'idle' });
    setCreated(last);
    window.history.replaceState({ mg: 'done' }, '', window.location.pathname + window.location.search);
    requestAnimationFrame(() => { window.scrollTo({ top: 0 }); document.getElementById('mg-done-title')?.focus({ preventScroll: true }); });
  };
  const startAnother = (push = true) => {
    store.clearLast();
    setCreated(null);
    setDraft(d => ({ ...emptyDraft(created?.occasion || d.occasion), variant: created?.variant || d.variant, senderName: d.senderName, showSender: d.showSender }));
    setPending(null);
    setErrors({});
    parentRef.current = null;
    go('design', push);
  };

  const occasion = created?.occasion || draft.occasion;
  const variant = created?.variant || draft.variant;
  // A step reached through history with nothing valid to preview shows the message step instead.
  const shown: Stage = stage === 'preview' && setup.state === 'open' && Object.keys(draftProblems(draft, templates)).length ? 'message' : stage;
  return (
    <main className="mg-page mg-creator" data-occasion={occasion} data-variant={variant} ref={main}>
      <GreetingsSky key={`${occasion}:${variant}`} />
      <div className="mg-shell mg-creator-shell">
        <GreetingsTopBar />
        {setup.state === 'loading' && <div className="mg-state mg-loading" role="status"><span className="mg-loading-gift" aria-hidden="true"><span /><span /></span><p>Getting the wrapping paper ready…</p></div>}
        {setup.state === 'error' && (
          <section className="mg-state" aria-labelledby="mg-setup-title">
            <h1 id="mg-setup-title">{setup.failure === 'offline' ? 'You seem to be offline' : 'Mystery Greetings is taking a short break'}</h1>
            <p>{setup.failure === 'offline' ? 'Check your connection and try again.' : 'Please try again in a little while.'}</p>
            <div className="mg-actions"><button type="button" className="mg-btn mg-btn-primary" onClick={() => void loadSetup()}>Try again</button><a className="mg-btn mg-btn-quiet" href="/">Back to Mystery Hub</a></div>
          </section>
        )}
        {setup.state === 'closed' && <ClosedNotice store={store} onRetry={() => void loadSetup()} />}
        {setup.state === 'open' && created && <Done created={created} store={store} onAnother={() => startAnother()} />}
        {setup.state === 'open' && !created && (
          <>
            <Progress stage={shown} />
            {shown === 'design' && (
              <section className="mg-step" aria-labelledby="mg-step-title">
                <h1 id="mg-step-title" className="mg-step-title" tabIndex={-1} data-stage-heading>Wrap a little surprise</h1>
                <p className="mg-step-lede">Write a greeting, wrap it as a gift and share the link. No account needed.</p>
                <fieldset className="mg-field">
                  <legend className="mg-label">Occasion</legend>
                  <div className="mg-segment">
                    {OCCASIONS.map(o => (
                      <label key={o} className="mg-segment-option">
                        <input type="radio" name="mg-occasion" value={o} checked={draft.occasion === o} onChange={() => setOccasion(o)} />
                        <span>{OCCASION_COPY[o].label}{' '}<small>{OCCASION_COPY[o].year}</small></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="mg-field">
                  <legend className="mg-label">Gift design</legend>
                  <div className="mg-designs">
                    {VARIANTS.map(v => (
                      <label key={v} className="mg-design" data-variant={v}>
                        <input type="radio" name="mg-variant" value={v} checked={draft.variant === v} onChange={() => update({ variant: v })} />
                        <span className="mg-design-art" data-occasion={draft.occasion} data-variant={v} aria-hidden="true"><GiftArt occasion={draft.occasion} variant={v} /></span>
                        <span className="mg-design-name">{VARIANT_COPY[v].name}<Check className="mg-design-check" aria-hidden="true" /></span>
                        <span className="mg-design-detail">{VARIANT_COPY[v].detail[draft.occasion]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <StepActions><button type="button" className="mg-btn mg-btn-primary mg-grow" onClick={() => go('message')}>Continue<ArrowRight className="mg-icon" aria-hidden="true" /></button></StepActions>
                <SentList store={store} />
              </section>
            )}
            {shown === 'message' && (
              <MessageStep draft={draft} templates={templates} errors={errors} splitNotice={splitNotice} update={update}
                onBack={back} onContinue={continueFromMessage} />
            )}
            {shown === 'preview' && (
              <section className="mg-step" aria-labelledby="mg-step-title">
                <h1 id="mg-step-title" className="mg-step-title" tabIndex={-1} data-stage-heading>Preview</h1>
                <p className="mg-step-lede">This is exactly what {checkText(draft.recipientName, LIMITS.name).text || 'they'} will see. Tap the gift to try the reveal.</p>
                <div className="mg-preview-frame">
                  <span className="mg-preview-badge">Preview</span>
                  <GreetingStage key={`${draft.occasion}${draft.variant}`} preview headingLevel={2}
                    greeting={{ occasion: draft.occasion, variant: draft.variant, recipientName: checkText(draft.recipientName, LIMITS.name).text, senderName: draftSender(draft), message: draftMessage(draft, templates) }}
                    after={replay => <button type="button" className="mg-btn mg-btn-ghost" onClick={replay}>Replay the preview</button>} />
                </div>
                <dl className="mg-summary">
                  <SummaryRow label="Design" value={`${OCCASION_COPY[draft.occasion].label} · ${VARIANT_COPY[draft.variant].name}`} onEdit={() => go('design')} editing="design" />
                  <SummaryRow label="For" value={checkText(draft.recipientName, LIMITS.name).text} onEdit={() => go('message')} editing="recipient name" />
                  <SummaryRow label="From" value={draftSender(draft) || 'Kept a mystery'} onEdit={() => go('message')} editing="sender" />
                </dl>
                {creating.state === 'failed' && <CreateProblem creating={creating} />}
                {pending && creating.state !== 'failed' && creating.state !== 'sending' && <p className="mg-note" role="status">Your last try wasn’t confirmed. Wrapping it again won’t make a second copy.</p>}
                <StepActions>
                  <button type="button" className="mg-btn mg-btn-ghost" onClick={back} disabled={creating.state === 'sending'}><ArrowLeft className="mg-icon" aria-hidden="true" />Back</button>
                  <button type="button" className="mg-btn mg-btn-primary mg-grow" onClick={() => void create()} disabled={creating.state === 'sending'} aria-busy={creating.state === 'sending'}>
                    {creating.state === 'sending' ? <><span className="mg-spinner" aria-hidden="true" />Wrapping your greeting…</> : creating.state === 'failed' && retryable(creating.failure) ? 'Try again' : 'Wrap my greeting'}
                  </button>
                </StepActions>
                <p className="mg-fine">Links last a year. Only this browser can remove the greeting later.</p>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

const retryable = (failure: Failure) => failure === 'offline' || failure === 'busy' || failure === 'paused';
function CreateProblem({ creating }: { creating: { failure: Failure; code: string | null } }) {
  const text = creating.failure === 'offline' ? 'We couldn’t confirm your greeting. Check your connection and tap Try again: you won’t get a duplicate.'
    : creating.failure === 'busy' ? 'Lots of greetings are being wrapped right now. Please wait a minute, then try again.'
      : creating.failure === 'duplicate' ? 'You just made this exact greeting from this browser. Find it under “Sent from this browser”, or change something to make a new one.'
        : creating.failure === 'invalid' ? 'Something in the greeting can’t be used. Go back to Message and check the name and wording.'
          : creating.code === 'CREATION_DISABLED' ? 'Mystery Greetings isn’t taking new greetings right now. Links already shared still open.'
            : 'We couldn’t wrap your greeting just now. Nothing was created. Please try again in a little while.';
  return <p className="mg-alert" role="alert">{text}</p>;
}

function Progress({ stage }: { stage: Stage }) {
  const index = STAGES.findIndex(s => s.id === stage);
  return (
    <ol className="mg-progress" aria-label={`Step ${index + 1} of 3: ${STAGES[index].label}`}>
      {STAGES.map((s, i) => <li key={s.id} data-state={i < index ? 'done' : i === index ? 'current' : 'next'} aria-current={i === index ? 'step' : undefined}><span aria-hidden="true">{i + 1}</span>{s.label}</li>)}
    </ol>
  );
}
function StepActions({ children }: { children: ReactNode }) {
  // Sticky above the page bottom, but back in the page flow while a field has focus, so a phone keyboard never covers it.
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const on = (e: FocusEvent) => setTyping((e.target as HTMLElement | null)?.matches?.('input[type=text], textarea') === true);
    const off = () => setTyping(false);
    document.addEventListener('focusin', on); document.addEventListener('focusout', off);
    return () => { document.removeEventListener('focusin', on); document.removeEventListener('focusout', off); };
  }, []);
  return <div className="mg-step-actions" data-typing={typing || undefined}>{children}</div>;
}
function SummaryRow({ label, value, onEdit, editing }: { label: string; value: string; onEdit: () => void; editing: string }) {
  return <div className="mg-summary-row"><dt>{label}</dt><dd><span>{value}</span><button type="button" className="mg-link mg-edit" onClick={onEdit} aria-label={`Edit ${editing}`}><Pencil className="mg-icon-sm" aria-hidden="true" />Edit</button></dd></div>;
}

function MessageStep({ draft, templates, errors, splitNotice, update, onBack, onContinue }: {
  draft: Draft; templates: TemplateOption[]; errors: Partial<Record<'recipient' | 'message' | 'sender', string>>; splitNotice: boolean;
  update: (patch: Partial<Draft>) => void; onBack: () => void; onContinue: () => void;
}) {
  const choices = templates.filter(t => t.occasion === draft.occasion);
  const count = checkText(draft.message, LIMITS.message, LIMITS.messageMin).length;
  // Surprise me picks another message and brings it into view (it may be further down the list), so the choice is seen.
  const surprise = () => {
    const others = choices.filter(t => t.id !== draft.templateId); const pick = others[Math.floor(Math.random() * others.length)];
    if (!pick) return;
    update({ mode: 'template', templateId: pick.id });
    // Focus follows the pick, so it is announced and keyboard users land on it.
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(`input[name="mg-template"][value="${CSS.escape(pick.id)}"]`);
      input?.closest('label')?.scrollIntoView({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      input?.focus({ preventScroll: true });
    });
  };
  return (
    <section className="mg-step" aria-labelledby="mg-step-title">
      <h1 id="mg-step-title" className="mg-step-title" tabIndex={-1} data-stage-heading>Your message</h1>
      <form noValidate onSubmit={e => { e.preventDefault(); onContinue(); }}>
        <div className="mg-field">
          <label className="mg-label" htmlFor="mg-field-recipient">Who is it for?</label>
          <input id="mg-field-recipient" className="mg-input" type="text" value={draft.recipientName} onChange={e => update({ recipientName: e.target.value })}
            placeholder="Their name, e.g. Ama" autoComplete="off" autoCapitalize="words" enterKeyHint="next" maxLength={240}
            aria-invalid={Boolean(errors.recipient)} aria-describedby={errors.recipient ? 'mg-error-recipient' : undefined} />
          {errors.recipient && <p className="mg-error" id="mg-error-recipient">{errors.recipient}</p>}
        </div>
        <fieldset className="mg-field" aria-describedby={errors.message ? 'mg-error-message' : undefined}>
          <legend className="mg-label">Message</legend>
          <div className="mg-segment mg-segment-small">
            <label className="mg-segment-option"><input type="radio" name="mg-mode" checked={draft.mode === 'template'} onChange={() => update({ mode: 'template' })} /><span>Pick a message</span></label>
            <label className="mg-segment-option"><input type="radio" name="mg-mode" checked={draft.mode === 'custom'} onChange={() => update({ mode: 'custom' })} /><span>Write my own</span></label>
          </div>
          {draft.mode === 'template' ? (
            <div className="mg-templates" role="radiogroup" aria-label={`${OCCASION_COPY[draft.occasion].label} messages`} id="mg-field-message" tabIndex={-1}>
              {choices.map(t => (
                <label key={t.id} className="mg-template">
                  <input type="radio" name="mg-template" value={t.id} checked={draft.templateId === t.id} onChange={() => update({ templateId: t.id })} />
                  <span className="mg-template-tag">{TEMPLATE_CATEGORY[t.category] || 'Message'}</span>
                  <span className="mg-template-text">{t.message}</span>
                </label>
              ))}
              <button type="button" className="mg-btn mg-btn-ghost mg-btn-small" onClick={surprise}><Shuffle className="mg-icon-sm" aria-hidden="true" />Surprise me</button>
            </div>
          ) : (
            <>
              <textarea id="mg-field-message" className="mg-input mg-textarea" aria-label="Write your own message" value={draft.message} onChange={e => update({ message: e.target.value })} rows={6} maxLength={2400}
                placeholder="Write from the heart…" aria-invalid={Boolean(errors.message)} aria-describedby={`mg-count${errors.message ? ' mg-error-message' : ''}`} />
              <p className={`mg-count${count > LIMITS.message ? ' mg-count-over' : ''}`} id="mg-count">{count} / {LIMITS.message}</p>
            </>
          )}
          {errors.message && <p className="mg-error" id="mg-error-message">{errors.message}</p>}
          {splitNotice && <p className="mg-note">Some combined emoji (like families) are shown as separate emoji.</p>}
        </fieldset>
        <div className="mg-field">
          <label className="mg-label" htmlFor="mg-field-sender">Your name <span className="mg-optional">(optional)</span></label>
          <input id="mg-field-sender" className="mg-input" type="text" value={draft.senderName} onChange={e => update({ senderName: e.target.value })} disabled={!draft.showSender}
            placeholder={draft.showSender ? 'e.g. Kofi' : 'Hidden'} autoComplete="off" autoCapitalize="words" enterKeyHint="done" maxLength={240}
            aria-invalid={Boolean(errors.sender)} aria-describedby={`mg-sender-help${errors.sender ? ' mg-error-sender' : ''}`} />
          <label className="mg-switch">
            <input type="checkbox" checked={!draft.showSender} onChange={e => update({ showSender: !e.target.checked })} />
            <span className="mg-switch-track" aria-hidden="true"><span /></span>
            <span>Keep me a mystery</span>
          </label>
          <p className="mg-help" id="mg-sender-help">{draft.showSender ? 'Your name appears on the greeting. Leave it empty to stay a mystery.' : 'They’ll see “From a mystery sender”. Your name isn’t sent or saved.'}</p>
          {errors.sender && <p className="mg-error" id="mg-error-sender">{errors.sender}</p>}
        </div>
        <StepActions>
          <button type="button" className="mg-btn mg-btn-ghost" onClick={onBack}><ArrowLeft className="mg-icon" aria-hidden="true" />Back</button>
          <button type="submit" className="mg-btn mg-btn-primary mg-grow">Preview<ArrowRight className="mg-icon" aria-hidden="true" /></button>
        </StepActions>
      </form>
    </section>
  );
}

function Done({ created, store, onAnother }: { created: LastCreated; store: GreetingsStore; onAnother: () => void }) {
  const [copied, setCopied] = useState<'idle' | 'copied' | 'blocked'>('idle');
  const [shareNote, setShareNote] = useState('');
  const native = useMemo(() => canShareNatively(navigator, created.url), [created.url]);
  const input = useRef<HTMLInputElement>(null);
  const copy = async () => { const r = await copyLink(created.url); setCopied(r); if (r === 'blocked') input.current?.select(); };
  const share = async () => {
    setShareNote('');
    const r = await shareNatively(created.occasion, created.url);
    if (r === 'unsupported') { const c = await copyLink(created.url); setCopied(c); setShareNote(c === 'copied' ? 'Sharing isn’t available here, so the link was copied instead.' : 'Sharing isn’t available here. Copy the link above instead.'); }
  };
  const copy1 = OCCASION_COPY[created.occasion];
  return (
    <section className="mg-step mg-done" aria-labelledby="mg-done-title">
      <span className="mg-done-art" aria-hidden="true"><GiftArt occasion={created.occasion} variant={created.variant} /></span>
      <h1 id="mg-done-title" className="mg-step-title" tabIndex={-1}>Your {copy1.noun} is wrapped</h1>
      <p className="mg-step-lede">Share the link with {created.recipientName}. They’ll tap to open it. Nothing is sent until you share it.</p>
      <div className="mg-linkbox">
        <label className="mg-label" htmlFor="mg-link">Greeting link</label>
        <div className="mg-linkbox-row">
          <Link2 className="mg-icon mg-linkbox-icon" aria-hidden="true" />
          <input id="mg-link" ref={input} className="mg-input mg-link-input" readOnly value={created.url} onFocus={e => e.currentTarget.select()} />
        </div>
        <p className="mg-copy-status" role="status">{copied === 'copied' ? 'Link copied.' : copied === 'blocked' ? 'Copying is blocked in this browser. The link is selected: copy it from the box.' : ''}</p>
      </div>
      <div className="mg-share">
        <a className="mg-btn mg-btn-whatsapp" href={whatsappHref(created.occasion, created.url)} target="_blank" rel="noopener noreferrer">
          <WhatsAppMark />Share on WhatsApp
        </a>
        <button type="button" className="mg-btn mg-btn-ghost" onClick={() => void copy()}>{copied === 'copied' ? <Check className="mg-icon mg-pop" aria-hidden="true" /> : <Copy className="mg-icon" aria-hidden="true" />}{copied === 'copied' ? 'Copied' : 'Copy link'}</button>
        {native && <button type="button" className="mg-btn mg-btn-ghost" onClick={() => void share()}><Share2 className="mg-icon" aria-hidden="true" />More ways to share</button>}
      </div>
      {shareNote && <p className="mg-note" role="status">{shareNote}</p>}
      <div className="mg-actions mg-done-actions">
        <a className="mg-btn mg-btn-ghost" href={`/g/${created.shareId}`} target="_blank" rel="noopener">Open my greeting<ExternalLink className="mg-icon" aria-hidden="true" /></a>
        <button type="button" className="mg-btn mg-btn-ghost" onClick={onAnother}><Plus className="mg-icon" aria-hidden="true" />Create another</button>
      </div>
      <ManageGreeting created={created} store={store} />
      <SentList store={store} exclude={created.shareId} />
    </section>
  );
}

function ManageGreeting({ created, store }: { created: LastCreated; store: GreetingsStore }) {
  const [confirming, setConfirming] = useState(false);
  const [removed, setRemoved] = useState<'removed' | 'forgotten' | null>(() => store.sent().some(e => e.shareId === created.shareId && e.removed) ? 'removed' : null);
  return (
    <div className="mg-manage">
      <p className="mg-help">Anyone with the link can open it. {store.persistence === 'device'
        ? 'Only this browser can remove it later: if you clear this browser’s data or change phones, you won’t be able to, and that can’t be recovered.'
        : 'This browser isn’t keeping site data, so you can remove it only until you close this page.'} Links expire after a year.</p>
      {removed ? <p className="mg-note" role="status">{removed === 'removed' ? 'Removed. The link no longer opens.' : 'Forgotten on this device. The link itself was not changed.'}</p>
        : <button type="button" className="mg-link mg-danger mg-remove" onClick={() => setConfirming(true)}><Trash2 className="mg-icon-sm" aria-hidden="true" />Remove this greeting</button>}
      {confirming && <RemoveDialog shareId={created.shareId} store={store} onClose={() => setConfirming(false)} onDone={outcome => { setRemoved(outcome); setConfirming(false); }} />}
    </div>
  );
}

/** Only the server's confirmation counts as removed. 404 means this browser's secret is not the one that made it. */
export const removeOutcome = (result: Result<{ revoked: true }>) => result.ok ? 'removed' as const : result.failure === 'unavailable' ? 'not-yours' as const : result.failure;

function RemoveDialog({ shareId, store, onClose, onDone }: { shareId: string; store: GreetingsStore; onClose: () => void; onDone: (outcome: 'removed' | 'forgotten') => void }) {
  const [state, setState] = useState<'idle' | 'sending' | 'not-yours' | Failure>('idle');
  const ref = useDialogFocus(true, onClose);
  const remove = async () => {
    if (state === 'sending') return;
    setState('sending');
    const outcome = removeOutcome(await revokeGreeting(shareId, store.creatorToken()));
    if (outcome === 'removed') { store.markRemoved(shareId); onDone('removed'); return; }
    setState(outcome);
  };
  const forget = () => { store.forget(shareId); onDone('forgotten'); };
  return (
    <div className="mg-dialog-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="mg-dialog" role="dialog" aria-modal="true" aria-labelledby="mg-remove-title" tabIndex={-1}>
        <h2 id="mg-remove-title">Remove this greeting?</h2>
        <p>The link will stop opening for everyone, straight away. This can’t be undone.</p>
        {state !== 'idle' && state !== 'sending' && <p role="alert" className="mg-dialog-error">{state === 'not-yours'
          ? 'This browser can’t remove it: it may have been made in another browser, or it no longer exists. Nothing was changed.'
          : state === 'offline' ? 'We couldn’t reach Mystery Hub. Check your connection and try again.' : state === 'busy' ? 'Too many attempts. Please wait a minute and try again.' : 'Removing isn’t available right now. Please try again later.'}</p>}
        <div className="mg-dialog-actions">
          {state === 'not-yours'
            ? <button type="button" className="mg-btn mg-btn-ghost" onClick={forget}>Forget it on this device</button>
            : <button type="button" className="mg-btn mg-btn-danger" onClick={() => void remove()} disabled={state === 'sending'}>{state === 'sending' ? 'Removing…' : 'Remove greeting'}</button>}
          <button type="button" className="mg-btn mg-btn-ghost" onClick={onClose} data-autofocus>{state === 'not-yours' ? 'Close' : 'Keep it'}</button>
        </div>
      </div>
    </div>
  );
}

/** Greetings made in this browser: open, copy or remove. Names stay on this device; messages are never kept. */
function SentList({ store, exclude }: { store: GreetingsStore; exclude?: string }) {
  const [version, setVersion] = useState(0);
  const [removing, setRemoving] = useState<string | null>(null);
  const items = useMemo(() => store.sent().filter(e => e.shareId !== exclude), [store, exclude, version]);
  if (!items.length) return null;
  return (
    <details className="mg-sent">
      <summary>Sent from this browser <span className="mg-sent-count">{items.length}</span></summary>
      <ul>
        {items.map(e => (
          <li key={e.shareId} data-removed={e.removed || undefined}>
            <span className="mg-sent-main"><b>{e.recipientName}</b><span>{OCCASION_COPY[e.occasion].short} · {new Date(e.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{e.removed ? ' · Removed' : ''}</span></span>
            {!e.removed && <a className="mg-link" href={`/g/${e.shareId}`} target="_blank" rel="noopener">Open<span className="mg-sr"> greeting for {e.recipientName}</span></a>}
            {!e.removed ? <button type="button" className="mg-link mg-danger" onClick={() => setRemoving(e.shareId)}>Remove<span className="mg-sr"> greeting for {e.recipientName}</span></button>
              : <button type="button" className="mg-link" onClick={() => { store.forget(e.shareId); setVersion(v => v + 1); }}>Forget<span className="mg-sr"> greeting for {e.recipientName}</span></button>}
          </li>
        ))}
      </ul>
      {removing && <RemoveDialog shareId={removing} store={store} onClose={() => setRemoving(null)} onDone={() => { setRemoving(null); setVersion(v => v + 1); }} />}
    </details>
  );
}

function ClosedNotice({ store, onRetry }: { store: GreetingsStore; onRetry: () => void }) {
  return (
    <section className="mg-state mg-closed" aria-labelledby="mg-closed-title">
      <span className="mg-closed-art" aria-hidden="true"><GiftArt occasion="christmas-2026" variant="gift-classic-v1" /></span>
      <h1 id="mg-closed-title">Mystery Greetings isn’t open right now</h1>
      <p>When it’s open, you can wrap a personal Christmas or New Year greeting as a digital gift and share the link. Please check back soon.</p>
      <div className="mg-actions"><a className="mg-btn mg-btn-primary" href="/">Back to Mystery Hub</a><button type="button" className="mg-btn mg-btn-quiet" onClick={onRetry}>Check again</button></div>
      <SentList store={store} />
    </section>
  );
}

function WhatsAppMark() {
  return <svg className="mg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.2 21.8l5.1-1.3A9.7 9.7 0 1 0 12 2.2Zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.9 2c0 1.2.9 2.3 1 2.5.1.1 1.7 2.6 4.1 3.7 1.5.7 2.1.7 2.9.6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.3-.5Z" /></svg>;
}
