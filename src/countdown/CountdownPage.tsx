import { memo, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowRight, Link2, Maximize2, MessageCircle, Music, RefreshCw, RotateCcw, Share2, Volume2, VolumeX, X } from 'lucide-react';
import { useCountdownClock, countdownParts, type ClockView } from '../greetings/countdown';
import { GREETINGS_MARK } from '../greetings/chrome';
import { analyticsAllowed, trackExperience } from '../greetings/analytics';
import { trackGrowth } from '../utils/growthAnalytics';
import { COUNTDOWN_SERIF_HREF, loadSeasonalSerif } from '../seasonal/christmas/font';
import { Dial, YearMark } from './Dial';
import { STAGE_ANNOUNCEMENT, isAfter, isCounting, remainingSentence, shownSeconds, stageCopy, stageOf, type Stage } from './stage';
import { canShareNatively, copyCountdownLink, countdownWhatsappHref, shareCountdown, COUNTDOWN_URL } from './share';
import { fullscreenAvailable, fullscreenEvents, isFullscreen, keepScreenOn, leaveFullscreen, requestFullscreen } from './immersive';
import { createCountdownSound, moodFor, soundSupported, type CountdownSound } from './sound';

/**
 * Mystery Countdown (/countdown): an original, shareable New Year countdown to midnight in Accra.
 *
 * Its own small surface (no app shell, account, checkout or Marketplace code). Time always comes from the server
 * through the shared engine in greetings/countdown.ts, which the card under New Year greetings also uses. The page
 * moves from calm anticipation to the final ten seconds, then one finite celebration for those who are actually here
 * at midnight; anyone arriving later gets a calm Welcome 2027 (with an optional, clearly labelled replay), and from
 * 8 January a quiet commemorative page.
 */

/** The celebration plays once per page load, whatever re-renders or re-mounts happen around it. */
let livePlayed = false;
export const resetLiveCelebrationForTests = () => { livePlayed = false; };
const CELEBRATION_MS = 5200;

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export function CountdownPage() {
  const { view, retry } = useCountdownClock(true);
  return <CountdownExperience view={view} retry={retry} />;
}

/** The whole experience for one clock view (separate from the hook, so every phase can be rendered and tested). */
export function CountdownExperience({ view, retry }: { view: ClockView; retry: () => void }) {
  const stage = stageOf(view);
  const remaining = view.state === 'running' ? view.remainingMs : 0;
  const serverNow = view.state === 'running' || view.state === 'arrived' ? view.serverNow : null;
  const seconds = shownSeconds(remaining);
  const [celebration, setCelebration] = useState<null | 'live' | 'replay'>(null);
  const [motion, setMotion] = useState(true);
  const [announcement, setAnnouncement] = useState('');
  const [immersive, setImmersive] = useState(false);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    loadSeasonalSerif(COUNTDOWN_SERIF_HREF);
    setMotion(!reducedMotion());
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const before = theme?.content;
    if (theme) theme.content = '#050817';
    if (analyticsAllowed()) trackGrowth('page_view', { page: 'countdown' });
    return () => { if (theme && before) theme.content = before; };
  }, []);

  // A real visit: the countdown (or the welcome) actually appeared. Never from the link preview or a prefetch.
  const opened = view.state === 'running' || view.state === 'arrived';
  useEffect(() => { if (opened) trackExperience('countdown_open'); }, [opened]);

  // Midnight, live: one celebration, once. A visitor who arrives after midnight is never shown it as if live.
  const live = view.state === 'arrived' && view.live;
  useEffect(() => {
    if (!live || livePlayed) return;
    livePlayed = true;
    setCelebration('live');
  }, [live]);
  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => setCelebration(null), reducedMotion() ? 1200 : CELEBRATION_MS);
    return () => window.clearTimeout(timer);
  }, [celebration]);

  // Spoken once per stage change while counting (or at a live midnight). Never each second.
  const previous = useRef<Stage>(stage);
  useEffect(() => {
    const was = previous.current;
    previous.current = stage;
    if (was === stage || !(isCounting(was) || was === 'confirming')) return;
    const words = STAGE_ANNOUNCEMENT[stage];
    if (words && (stage !== 'welcome' || live)) setAnnouncement(words);
  }, [stage, live]);

  useEffect(() => { if (isAfter(stage)) document.title = stage === 'welcome' ? 'Happy New Year 2027 · Afehyia pa! — Mystery Hub' : '2027 began in Accra — Mystery Hub'; }, [stage]);

  const sound = useCountdownSound();
  useEffect(() => { if (stage === 'final' && seconds > 0) sound.instance?.tick(seconds); }, [stage, seconds, sound.instance]);
  // The music follows the stage; in the final minute its build follows the seconds (a call per second, nothing more).
  const buildProgress = stage === 'minute' ? Math.round(((60 - seconds) / 50) * 20) / 20 : 0;
  useEffect(() => { sound.instance?.setMood(moodFor(stage), buildProgress); }, [stage, buildProgress, sound.instance, sound.on]);
  useEffect(() => { if (celebration) sound.instance?.midnight(); }, [celebration, sound.instance]);

  const replay = useCallback(() => setCelebration('replay'), []);
  const after = isAfter(stage);
  const copy = stageCopy(stage, serverNow);
  // While the first answer is on its way, the page keeps the shape of the most likely view (the days count, with its
  // lede held invisibly), so nothing below jumps when the time arrives.
  const reserve = stage === 'syncing';
  const lede = reserve ? stageCopy('days').lede : copy.lede;
  const igniting = celebration !== null;
  const yearLit = after && !igniting;
  const hideTitle = stage === 'final' && !igniting;

  return (
    <main ref={root} className="cd-page" data-stage={stage} data-celebration={celebration ?? undefined} data-immersive={immersive || undefined} data-motion={motion ? undefined : 'reduced'}>
      <Sky />
      <div className="cd-shell">
        <TopBar sound={sound} immersive={immersive} onImmersive={setImmersive} root={root} />
        <header className="cd-head">
          <p className="cd-kicker">{copy.kicker}</p>
          <h1 className={`cd-title${hideTitle ? ' cd-title-quiet' : ''}`} tabIndex={-1}>{igniting || stage === 'welcome' ? 'Welcome, 2027' : copy.title}</h1>
          {lede && <p className={`cd-lede${reserve ? ' is-reserve' : ''}`} aria-hidden={reserve || undefined}>{lede}</p>}
        </header>

        <section className="cd-stage" aria-label={after ? 'Welcome 2027' : 'Countdown to 2027'}>
          <Dial stage={igniting ? 'welcome' : stage} remainingMs={remaining} celebrating={igniting} motion={motion}>
            <DialCenter stage={stage} seconds={seconds} yearLit={yearLit} igniting={igniting} />
          </Dial>
          {celebration === 'replay' && <p className="cd-replay-note">Replay · not live</p>}
          <Timer view={view} stage={stage} retry={retry} />
        </section>

        {!immersive && <Actions stage={stage} replay={after ? replay : null} playing={celebration !== null} />}
        <p className="cd-sr" aria-live="polite">{announcement}</p>
      </div>
    </main>
  );
}

/* ───────────────────────── The dial's centre ───────────────────────── */

function DialCenter({ stage, seconds, yearLit, igniting }: { stage: Stage; seconds: number; yearLit: boolean; igniting: boolean }) {
  if (igniting || isAfter(stage)) return <YearMark lit={yearLit} igniting={igniting} />;
  if (stage === 'final') return <span key={seconds} className="cd-final-number" aria-hidden="true">{seconds}</span>;
  if (stage === 'minute') return (
    <span className="cd-minute" aria-hidden="true">
      <YearMark lit={false} igniting={false} small />
      <span className="cd-minute-number">{seconds}</span>
      <span className="cd-minute-label">seconds</span>
    </span>
  );
  return (
    <span className="cd-center-stack">
      <YearMark lit={false} igniting={false} />
      <span className="cd-center-caption" aria-hidden="true">Midnight · Accra</span>
    </span>
  );
}

/* ───────────────────────── The timer row and honest states ───────────────────────── */

const pad = (n: number) => String(n).padStart(2, '0');
/** Each digit in its own fixed-width box, so nothing shifts as numbers change, whatever the font. */
const Digits = ({ value }: { value: string }) => <span className="cd-digits">{[...value].map((d, i) => <span key={i}>{d}</span>)}</span>;

function Timer({ view, stage, retry }: { view: ClockView; stage: Stage; retry: () => void }) {
  if (view.state === 'syncing') return (
    // An empty frame of the timer (dashes, never numbers) holds its place until the server answers.
    <div className="cd-timer-wrap is-pending">
      <div className="cd-cells" data-count="4" aria-hidden="true">
        {['days', 'hours', 'minutes', 'seconds'].map(label => <span key={label} className="cd-cell"><Digits value="––" /><span className="cd-cell-label">{label}</span></span>)}
      </div>
      <p className="cd-pending-note" role="status">{view.slow ? 'Still connecting… your connection seems slow.' : 'Checking the time in Accra…'}</p>
    </div>
  );
  if (view.state === 'confirming') return <p className="cd-status" role="status">{view.failed ? 'We can’t confirm the time in Accra right now. Trying again…' : 'Checking the time in Accra…'}</p>;
  if (view.state === 'unavailable') return (
    <div className="cd-status cd-status-error" role="alert">
      <p>We can’t check the time in Accra right now.</p>
      <button type="button" className="cd-btn cd-btn-ghost" onClick={retry}><RefreshCw className="cd-icon" aria-hidden="true" />Try again</button>
    </div>
  );
  if (view.state === 'arrived') return null;
  const p = countdownParts(view.remainingMs);
  // The eve and the final hour fold the larger unit in, so their first second reads 24:00:00 and 60:00, never zeros.
  const hours = p.days * 24 + p.hours, minutes = hours * 60 + p.minutes;
  const unit = (n: number, one: string) => n === 1 ? one : `${one}s`;
  const cells: [string, string][] = stage === 'days'
    ? [[String(p.days), unit(p.days, 'day')], [pad(p.hours), unit(p.hours, 'hour')], [pad(p.minutes), unit(p.minutes, 'minute')], [pad(p.seconds), unit(p.seconds, 'second')]]
    : stage === 'eve' ? [[pad(hours), unit(hours, 'hour')], [pad(p.minutes), unit(p.minutes, 'minute')], [pad(p.seconds), unit(p.seconds, 'second')]]
      : stage === 'hour' ? [[pad(minutes), unit(minutes, 'minute')], [pad(p.seconds), unit(p.seconds, 'second')]] : [];
  return (
    <div className="cd-timer-wrap">
      <div className="cd-timer" role="timer" aria-label="Time until 2027 in Accra">
        {cells.length > 0 && (
          <div className="cd-cells" data-count={cells.length} aria-hidden="true">
            {cells.map(([value, label]) => <span key={label.replace(/s$/, '')} className="cd-cell"><Digits value={value} /><span className="cd-cell-label">{label}</span></span>)}
          </div>
        )}
        <span className="cd-sr">{remainingSentence(view.remainingMs)}</span>
      </div>
      <p className="cd-when">{view.checking ? <span role="status">Re-checking the time…</span> : 'Midnight, 1 January 2027 · Accra time (GMT)'}</p>
    </div>
  );
}

/* ───────────────────────── Sharing and the way back ───────────────────────── */

const Actions = memo(function Actions({ stage, replay, playing }: { stage: Stage; replay: (() => void) | null; playing: boolean }) {
  const after = isAfter(stage);
  const [native, setNative] = useState(false);
  const [note, setNote] = useState<'' | 'copied' | 'blocked'>('');
  useEffect(() => { setNative(canShareNatively(navigator, COUNTDOWN_URL)); }, []);
  const copy = async () => setNote(await copyCountdownLink());
  // The last hour is quieter; the final minute keeps only the way back. After 8 January there is nothing left to share.
  const quiet = stage === 'hour';
  const noShare = stage === 'commemorative' || stage === 'minute' || stage === 'final';
  const home = () => trackExperience('platform_navigation');
  return (
    <footer className="cd-actions" data-quiet={quiet || undefined}>
      {/* Kept in place (not removed) while it plays, so keyboard focus stays on it. */}
      {replay && <button type="button" className="cd-btn cd-btn-ghost" aria-disabled={playing || undefined} onClick={playing ? undefined : replay}><RotateCcw className="cd-icon" aria-hidden="true" />Replay midnight</button>}
      {!noShare && (
        <div className="cd-share" role="group" aria-label={after ? 'Share New Year wishes' : 'Share the countdown'}>
          {!quiet && <p className="cd-share-lede">{after ? 'Send New Year wishes with this page.' : 'Invite your people to count down with you.'}</p>}
          <div className="cd-share-row">
            {native && <button type="button" className="cd-btn cd-btn-gold" onClick={() => void shareCountdown(after)}><Share2 className="cd-icon" aria-hidden="true" />Share</button>}
            <a className={`cd-btn ${native ? 'cd-btn-ghost' : 'cd-btn-gold'}`} href={countdownWhatsappHref(after)} target="_blank" rel="noopener noreferrer"><MessageCircle className="cd-icon" aria-hidden="true" />WhatsApp<span className="cd-sr"> (opens WhatsApp)</span></a>
            <button type="button" className="cd-btn cd-btn-ghost" onClick={() => void copy()}><Link2 className="cd-icon" aria-hidden="true" />Copy link</button>
          </div>
          <p className="cd-share-note" aria-live="polite">{note === 'copied' ? 'Link copied.' : note === 'blocked' ? <>This browser didn’t allow copying. The link is <span className="cd-url">mysterybundlehub.com/countdown</span></> : ''}</p>
        </div>
      )}
      <a className="cd-home" href="/" onClick={home}>Visit Mystery Hub<ArrowRight className="cd-icon" aria-hidden="true" /></a>
      {!quiet && !noShare && <p className="cd-fine">Times are Accra time (GMT). The countdown follows Mystery Hub’s clock, not your device’s.</p>}
    </footer>
  );
});

/* ───────────────────────── Top bar: identity, sound and the immersive view ───────────────────────── */

type SoundNote = '' | 'music' | 'effects' | 'blocked' | 'lost';

function useCountdownSound() {
  const [instance, setInstance] = useState<CountdownSound | null>(null);
  const [on, setOn] = useState(false);
  const [music, setMusicState] = useState(true);
  const [note, setNote] = useState<SoundNote>('');
  const supported = useRef(false);
  useEffect(() => {
    supported.current = soundSupported();
    if (!supported.current) return;
    // Nothing is created here: the audio context (and the music's code) only once the visitor taps.
    const created = createCountdownSound();
    setInstance(created);
    const onVisible = () => {
      if (document.visibilityState === 'hidden') { created?.pause(); return; }
      void created?.resume().then(still => { if (!still) { setOn(false); setNote('lost'); } });
    };
    const onHide = () => created?.pause();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onHide);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('pagehide', onHide); created?.close(); };
  }, []);
  // The note under the controls says what is playing, then steps aside.
  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(''), note === 'blocked' || note === 'lost' ? 6000 : 4000);
    return () => window.clearTimeout(timer);
  }, [note]);
  // Each tap is numbered, so a start the visitor has already cancelled never reports back.
  const request = useRef(0);
  const toggle = useCallback(() => {
    if (!instance) return;
    const id = ++request.current;
    if (instance.on) { instance.disable(); setOn(false); setNote(''); return; }
    setOn(true);
    // The browser may still refuse to start audio; the button then switches back off and the note says so.
    void instance.enable().then(started => {
      if (id !== request.current) return;
      setOn(started); setNote(started ? (instance.music ? 'music' : 'effects') : 'blocked');
    });
  }, [instance]);
  const toggleMusic = useCallback(() => {
    if (!instance) return;
    const next = !instance.music;
    instance.setMusic(next); setMusicState(next); setNote(next ? 'music' : 'effects');
  }, [instance]);
  return { instance, on, music, note, toggle, toggleMusic };
}

const SOUND_NOTE: Record<Exclude<SoundNote, ''>, string> = {
  music: 'Music on. Midnight has its own sounds.',
  effects: 'Music off. Countdown sounds stay on.',
  blocked: 'This browser didn’t allow sound. Try again.',
  lost: 'The browser stopped sound. Tap Sound again.',
};

function TopBar({ sound, immersive, onImmersive, root }: { sound: ReturnType<typeof useCountdownSound>; immersive: boolean; onImmersive: (on: boolean) => void; root: RefObject<HTMLElement | null> }) {
  const enterButton = useRef<HTMLButtonElement>(null), exitButton = useRef<HTMLButtonElement>(null);
  const wentFullscreen = useRef(false), active = useRef(false), wake = useRef<Awaited<ReturnType<typeof keepScreenOn>>>(null);
  const [canFullscreen, setCanFullscreen] = useState(false);
  useEffect(() => { setCanFullscreen(fullscreenAvailable()); }, []);

  const release = () => { void wake.current?.release().catch(() => undefined); wake.current = null; };
  /** Holds a granted lock only while still immersive (a lock granted after leaving is let go at once). */
  const hold = (lock: Awaited<ReturnType<typeof keepScreenOn>>) => {
    if (!active.current) { void lock?.release().catch(() => undefined); return; }
    wake.current = lock;
  };
  const exit = useCallback(() => {
    active.current = false;
    onImmersive(false); release();
    if (wentFullscreen.current) { wentFullscreen.current = false; void leaveFullscreen(); }
    requestAnimationFrame(() => enterButton.current?.focus());
  }, [onImmersive]);
  const enter = async () => {
    active.current = true;
    onImmersive(true);
    requestAnimationFrame(() => exitButton.current?.focus());
    if (root.current && canFullscreen) {
      const went = await requestFullscreen(root.current);
      if (!active.current) { if (went) void leaveFullscreen(); return; }
      wentFullscreen.current = went;
    }
    hold(await keepScreenOn());
  };

  useEffect(() => {
    if (!immersive) return;
    // The browser's own exit (Escape, back gesture, its button) leaves the immersive view too.
    const onChange = () => { if (wentFullscreen.current && !isFullscreen()) { wentFullscreen.current = false; exit(); } };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') exit(); };
    // Browsers drop the wake lock when the page is hidden; ask again on return.
    const onVisible = () => { if (document.visibilityState === 'visible' && (!wake.current || wake.current.released)) void keepScreenOn().then(hold); };
    fullscreenEvents.forEach(name => document.addEventListener(name, onChange));
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisible);
    return () => { fullscreenEvents.forEach(name => document.removeEventListener(name, onChange)); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVisible); };
  }, [immersive, exit]);
  useEffect(() => () => { active.current = false; release(); }, []);

  return (
    <div className="cd-topbar">
      {!immersive && (
        <a className="cd-mark" href="/" aria-label="Mystery Hub home" onClick={() => trackExperience('platform_navigation')}>
          <img src={GREETINGS_MARK} alt="" width="22" height="15" decoding="async" />
          <span aria-hidden="true">Mystery Hub</span>
        </a>
      )}
      <div className="cd-tools">
        {sound.instance && (
          <button type="button" className="cd-tool" onClick={sound.toggle} aria-pressed={sound.on} title="Music and countdown sounds">
            {sound.on ? <Volume2 className="cd-icon" aria-hidden="true" /> : <VolumeX className="cd-icon" aria-hidden="true" />}
            <span className="cd-tool-label">{sound.on ? 'Sound on' : 'Sound off'}</span>
          </button>
        )}
        {/* Only while sound is on: the background music can be turned off on its own (countdown sounds stay). */}
        {sound.instance && sound.on && (
          <button type="button" className="cd-tool" onClick={sound.toggleMusic} aria-pressed={sound.music} title="Background music">
            <Music className="cd-icon" aria-hidden="true" />
            <span className="cd-tool-label">{sound.music ? 'Music on' : 'Music off'}</span>
          </button>
        )}
        {immersive
          ? <button ref={exitButton} type="button" className="cd-tool" onClick={exit}><X className="cd-icon" aria-hidden="true" /><span className="cd-tool-label">Exit full screen</span></button>
          : <button ref={enterButton} type="button" className="cd-tool" onClick={() => void enter()}><Maximize2 className="cd-icon" aria-hidden="true" /><span className="cd-tool-label">Full screen</span></button>}
      </div>
      <p className="cd-sound-note" role="status">{sound.note ? SOUND_NOTE[sound.note] : ''}</p>
    </div>
  );
}

/* ───────────────────────── The midnight sky ───────────────────────── */

/** A fixed, deterministic star field (no randomness at runtime, so every visit and the preview image agree). */
export const STARS = Array.from({ length: 64 }, (_, i) => ({ x: (i * 61.8 + (i % 7) * 13) % 100, y: (i * 37.3 + (i % 5) * 17) % 72, r: 0.5 + ((i * 13) % 10) / 10, o: 0.25 + ((i * 29) % 60) / 100, twinkle: i % 9 === 0 }));

const Sky = memo(function Sky() {
  return (
    <div className="cd-sky" aria-hidden="true">
      <span className="cd-sky-layer is-eve" />
      <span className="cd-sky-layer is-focus" />
      <span className="cd-sky-layer is-final" />
      <span className="cd-sky-layer is-bloom" />
      <svg className="cd-stars" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.12} opacity={s.o} className={s.twinkle ? 'is-twinkle' : undefined} style={s.twinkle ? { animationDelay: `${(i % 4) * 0.7}s` } : undefined} />)}
      </svg>
      <span className="cd-horizon" />
    </div>
  );
});

export default CountdownPage;
