import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, RotateCcw, Sparkles } from 'lucide-react';
import type { PublicGreeting } from '../../shared/mysteryExperiences';
import { fetchCreationOpen, fetchGreeting, type Failure } from './api';
import { trackExperience, trackGreetingsPage } from './analytics';
import { GreetingStage } from './GreetingStage';
import { NewYearCountdown } from './NewYearCountdown';
import { ReportDialog } from './ReportDialog';
import { GreetingsTopBar, GreetingsSky, useGreetingsFonts } from './chrome';
import { SHARE_ID, isOccasion, isVariant, type Occasion, type Variant } from './model';
import { rememberParent } from './storage';

type View = { state: 'loading' } | { state: 'ready'; greeting: PublicGreeting } | { state: 'error'; failure: Failure | 'malformed' };

/** The share ID from a /g path, or '' when the link is not a complete greeting link (checked before any request). */
export const shareIdFromPath = (path: string) => path.match(/^\/g\/([A-Za-z0-9_-]{24})\/?$/)?.[1] ?? '';

/**
 * The recipient's page at /g/:shareId. Its own small bundle (no app shell): loading, the sealed gift, the reveal, the
 * letter, then gentle ways onward. Every failure gets a calm explanation and a safe way back, and never shows the
 * link's ID, a name or any detail of whether a particular greeting ever existed.
 */
export function RecipientPage({ path }: { path: string }) {
  const shareId = shareIdFromPath(path);
  const [view, setView] = useState<View>(shareId ? { state: 'loading' } : { state: 'error', failure: 'malformed' });
  const [reporting, setReporting] = useState(false);
  const [slow, setSlow] = useState(false);
  // The creator is offered only when the server says creation is open; links can stay readable after it closes.
  const [creationOpen, setCreationOpen] = useState(false);
  useGreetingsFonts();
  useEffect(() => { void fetchCreationOpen().then(r => setCreationOpen(r.ok && r.data)); }, []);
  const load = useCallback(async () => {
    if (!SHARE_ID.test(shareId)) return;
    setView({ state: 'loading' }); setSlow(false);
    const slowTimer = setTimeout(() => setSlow(true), 6000);
    const result = await fetchGreeting(shareId);
    clearTimeout(slowTimer);
    if (result.ok) { setView({ state: 'ready', greeting: result.data }); trackExperience('greeting_open', shareId); }
    else setView({ state: 'error', failure: result.failure });
  }, [shareId]);
  useEffect(() => { trackGreetingsPage(); void load(); }, [load]);
  // Coming back online retries by itself; nothing else retries without a tap.
  useEffect(() => {
    if (view.state !== 'error' || view.failure !== 'offline') return;
    const retry = () => void load();
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [view, load]);

  const greeting = view.state === 'ready' ? view.greeting : null;
  const occasion: Occasion = greeting && isOccasion(greeting.occasion) ? greeting.occasion : 'christmas-2026';
  const variant: Variant = greeting && isVariant(greeting.variant) ? greeting.variant : 'gift-classic-v1';
  const createYourOwn = () => {
    if (greeting) { rememberParent(greeting.shareId, occasion); trackExperience('greeting_remix_started', greeting.shareId); }
    window.location.assign(`/greetings?occasion=${occasion}`);
  };
  const home = () => { if (greeting) trackExperience('platform_navigation', greeting.shareId); };

  return (
    <main className="mg-page" data-occasion={occasion} data-variant={variant} data-ready={greeting ? 'true' : 'false'}>
      <GreetingsSky key={`${occasion}:${variant}`} />
      <div className="mg-shell">
        <GreetingsTopBar onNavigate={home} />
        {view.state === 'loading' && (
          <div className="mg-state mg-loading" role="status" aria-live="polite">
            <span className="mg-loading-gift" aria-hidden="true"><span /><span /></span>
            <p>{slow ? 'Still opening… your connection seems slow.' : 'Opening your greeting…'}</p>
          </div>
        )}
        {view.state === 'error' && <ErrorState failure={view.failure} retry={() => void load()} creationOpen={creationOpen} />}
        {greeting && (
          <GreetingStage
            greeting={{ occasion, variant, recipientName: greeting.recipientName, senderName: greeting.senderName, message: greeting.message }}
            onReveal={() => trackExperience('greeting_reveal', greeting.shareId)}
            after={replay => (
              <>
                <div className="mg-actions" data-single={!creationOpen || undefined}>
                  {creationOpen && <button type="button" className="mg-btn mg-btn-primary" onClick={createYourOwn}><Sparkles className="mg-icon" aria-hidden="true" />Create your own greeting</button>}
                  <button type="button" className="mg-btn mg-btn-quiet" onClick={replay}><RotateCcw className="mg-icon" aria-hidden="true" />Replay the surprise</button>
                </div>
                {occasion === 'new-year-2027' && <NewYearCountdown onShown={() => trackExperience('countdown_open')} />}
                <p className="mg-about">Mystery Greetings lets anyone wrap a personal message as a digital gift and share it with a link. No account needed.</p>
                <a className="mg-btn mg-btn-quiet" href="/" onClick={home}>Visit Mystery Hub<ArrowRight className="mg-icon" aria-hidden="true" /></a>
              </>
            )}
          />
        )}
        <footer className="mg-foot">
          {greeting && <button type="button" className="mg-link" onClick={() => setReporting(true)}>Report this greeting</button>}
          <span>Mystery Greetings by <a className="mg-link" href="/" onClick={home}>Mystery Hub</a></span>
        </footer>
      </div>
      {reporting && greeting && <ReportDialog shareId={greeting.shareId} onClose={() => setReporting(false)} />}
    </main>
  );
}

const ERRORS: Record<Failure | 'malformed', { title: string; body: string; retry: boolean }> = {
  malformed: { title: 'This link looks incomplete', body: 'Part of the greeting link may be missing. Ask the person who sent it to share it again.', retry: false },
  unavailable: { title: 'This greeting isn’t available', body: 'It may have expired, or the person who sent it may have removed it.', retry: false },
  paused: { title: 'Greetings are taking a short break', body: 'We couldn’t load this link just now. Please try again in a little while.', retry: true },
  busy: { title: 'Lots of greetings are being opened', body: 'Please try again in a minute.', retry: true },
  offline: { title: 'You seem to be offline', body: 'Check your connection, then try again.', retry: true },
  invalid: { title: 'This link looks incomplete', body: 'Part of the greeting link may be missing. Ask the person who sent it to share it again.', retry: false },
  conflict: { title: 'Greetings are taking a short break', body: 'We couldn’t load this link just now. Please try again in a little while.', retry: true },
  duplicate: { title: 'Greetings are taking a short break', body: 'We couldn’t load this link just now. Please try again in a little while.', retry: true },
  parent: { title: 'Greetings are taking a short break', body: 'We couldn’t load this link just now. Please try again in a little while.', retry: true },
};

/** Never says or hints that a particular greeting exists unless the server confirmed it; the creator only when open. */
function ErrorState({ failure, retry, creationOpen }: { failure: Failure | 'malformed'; retry: () => void; creationOpen: boolean }) {
  const e = ERRORS[failure];
  return (
    <section className="mg-state mg-error" aria-labelledby="mg-error-title">
      <span className="mg-error-art" aria-hidden="true"><ClosedGiftOutline /></span>
      <h1 id="mg-error-title">{e.title}</h1>
      <p>{e.body}</p>
      <div className="mg-actions">
        {e.retry && <button type="button" className="mg-btn mg-btn-primary" onClick={retry}>Try again</button>}
        {creationOpen && <a className={`mg-btn ${e.retry ? 'mg-btn-ghost' : 'mg-btn-primary'}`} href="/greetings">Create a greeting</a>}
        <a className={`mg-btn ${e.retry || creationOpen ? 'mg-btn-quiet' : 'mg-btn-ghost'}`} href="/">Visit Mystery Hub</a>
      </div>
    </section>
  );
}

function ClosedGiftOutline() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <rect x="12" y="28" width="40" height="26" rx="3" /><rect x="9" y="20" width="46" height="9" rx="2.5" /><path d="M32 20v34" />
      <path d="M32 20c-4-8-13-10-14-4-.6 3.6 6 4.6 14 4zM32 20c4-8 13-10 14-4 .6 3.6-6 4.6-14 4z" />
    </svg>
  );
}
