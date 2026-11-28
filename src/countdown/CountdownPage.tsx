import { memo, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowRight, Link2, Maximize2, MessageCircle, Music, RefreshCw, RotateCcw, Share2, X } from 'lucide-react';
import { useCountdownClock, countdownParts, type ClockView } from '../greetings/countdown';
import { GREETINGS_MARK } from '../greetings/chrome';
import { analyticsAllowed, trackExperience } from '../greetings/analytics';
import { trackGrowth } from '../utils/growthAnalytics';
import { COUNTDOWN_SERIF_HREF, loadSeasonalSerif } from '../seasonal/christmas/font';
import { Dial, YearMark } from './Dial';
import { STAGE_ANNOUNCEMENT, isAfter, isCounting, remainingSentence, shownSeconds, stageCopy, stageOf, type Stage } from './stage';
import { canShareNatively, copyCountdownLink, countdownWhatsappHref, shareCountdown, COUNTDOWN_URL } from './share';
import { fullscreenAvailable, fullscreenEvents, isFullscreen, keepScreenOn, leaveFullscreen, requestFullscreen } from './immersive';
import { NOTE_TEXT, Player, useCountdownSound } from './Player';
import { Fireworks } from './Fireworks';
import { CELEBRATION_REDUCED_SECONDS, CELEBRATION_SECONDS } from './audioPlan';
import type { CountdownSound, PlayerState } from './sound';

/**
 * Mystery Countdown (/countdown): an original, shareable New Year countdown to midnight in Ghana (GMT).
 *
 * Its own small surface (no app shell, account, checkout or Marketplace code). Time always comes from the server
 * through the shared engine in greetings/countdown.ts, which the card under New Year greetings also uses. The page
 * moves from calm anticipation to the final ten seconds, then one finite celebration for those who are actually here
 * at midnight; anyone arriving later gets a calm Welcome 2027 (with an optional, clearly labelled replay), and from
 * 8 January a quiet commemorative page.
 *
 * 3.7 final: a solo piano soundtrack with its own player (off until tapped), the countdown's own sounds for the final
 * ten seconds and midnight, a cinematic final minute, golden fireworks for a finite celebration, and layouts composed for
 * phones, tablets, laptops, desktops and TVs.
 */

/** The celebration plays once per page load, whatever re-renders or re-mounts happen around it. */
let livePlayed = false;
export const resetLiveCelebrationForTests = () => { livePlayed = false; };
const CELEBRATION_MS = CELEBRATION_SECONDS * 1000;

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
  const [celebratedAt, setCelebratedAt] = useState(0);
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
    setCelebratedAt(performance.now());
    const timer = window.setTimeout(() => setCelebration(null), reducedMotion() ? CELEBRATION_REDUCED_SECONDS * 1000 : CELEBRATION_MS);
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

  useEffect(() => { if (isAfter(stage)) document.title = stage === 'welcome' ? 'Happy New Year 2027 · Afehyia pa! — Mystery Hub' : 'Welcome to a beautiful 2027 — Mystery Hub'; }, [stage]);

  // Sound follows the clock: one call each time the shown second changes (or the stage does), never more often.
  const { sound, state: player } = useCountdownSound();
  const holding = live && celebration === null && !livePlayed;
  useEffect(() => { if (celebration) sound?.celebrate(celebration); }, [celebration, sound]);
  useEffect(() => { sound?.sync({ stage, remainingMs: remaining, serverNow, holding }); }, [sound, stage, seconds, holding, player.started]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // The final minute, the ten seconds and the celebration take the whole screen's attention, on every size.
  const focus = stage === 'minute' || stage === 'final' || igniting;
  const kicker = igniting ? 'Afehyia pa! · Happy New Year' : copy.kicker;

  return (
    <main ref={root} className="cd-page" data-stage={stage} data-celebration={celebration ?? undefined} data-focus={focus || undefined} data-immersive={immersive || undefined}
      data-motion={motion ? undefined : 'reduced'} data-player={player.started || undefined}>
      <Sky />
      {igniting && motion && <Fireworks key={celebratedAt} startedAt={celebratedAt} />}
      {igniting && <span key={`r${celebratedAt}`} className="cd-reveal" aria-hidden="true" />}
      <div className="cd-shell">
        <TopBar sound={sound} player={player} immersive={immersive} onImmersive={setImmersive} root={root} />
        <header className="cd-head">
          <p className="cd-kicker">{kicker}</p>
          <h1 className={`cd-title${hideTitle ? ' cd-title-quiet' : ''}`} tabIndex={-1}>{igniting || stage === 'welcome' ? 'Welcome, 2027' : copy.title}</h1>
          {lede && !igniting && <p className={`cd-lede${reserve ? ' is-reserve' : ''}`} aria-hidden={reserve || undefined}>{lede}</p>}
        </header>

        <section className="cd-stage" aria-label={after ? 'Welcome 2027' : 'Countdown to 2027'}>
          <Dial stage={igniting ? 'welcome' : stage} remainingMs={remaining} celebrating={igniting} motion={motion}>
            <DialCenter stage={stage} seconds={seconds} yearLit={yearLit} igniting={igniting} />
          </Dial>
          {celebration === 'replay' && <p className="cd-replay-note">Replay · not live</p>}
        </section>
        <div className="cd-time"><Timer view={view} stage={stage} retry={retry} /></div>

        {/* The live celebration has the screen to itself; a replay keeps its button (and the keyboard focus on it). */}
        {!immersive && celebration !== 'live' && <Actions stage={stage} replay={after ? replay : null} playing={celebration !== null} />}
        {sound && player.started && <Player sound={sound} state={player} immersive={immersive} />}
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
      <span className="cd-center-caption" aria-hidden="true">Midnight · Ghana</span>
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
      <p className="cd-pending-note" role="status">{view.slow ? 'Still connecting… your connection seems slow.' : 'Synchronising the countdown…'}</p>
    </div>
  );
  if (view.state === 'confirming') return <p className="cd-status" role="status">{view.failed ? 'We can’t synchronise the countdown right now. Trying again…' : 'Synchronising the countdown…'}</p>;
  if (view.state === 'unavailable') return (
    <div className="cd-status cd-status-error" role="alert">
      <p>We can’t synchronise the countdown right now.</p>
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
      <div className="cd-timer" role="timer" aria-label="Time until 2027">
        {cells.length > 0 && (
          <div className="cd-cells" data-count={cells.length} aria-hidden="true">
            {cells.map(([value, label]) => <span key={label.replace(/s$/, '')} className="cd-cell"><Digits value={value} /><span className="cd-cell-label">{label}</span></span>)}
          </div>
        )}
        <span className="cd-sr">{remainingSentence(view.remainingMs)}</span>
      </div>
      <p className="cd-when">{view.checking ? <span role="status">Re-checking the time…</span> : 'Midnight, 1 January 2027 · GMT'}</p>
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
      {!quiet && !noShare && <p className="cd-fine">The countdown follows Mystery Hub’s clock, not your device’s.</p>}
    </footer>
  );
});

/* ───────────────────────── Top bar: identity, sound and the immersive view ───────────────────────── */

function TopBar({ sound, player, immersive, onImmersive, root }: { sound: CountdownSound | null; player: PlayerState; immersive: boolean; onImmersive: (on: boolean) => void; root: RefObject<HTMLElement | null> }) {
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
        {/* Sound starts only from this tap (never by itself, never from a shared link). Then the player takes over. */}
        {sound && !player.started && (
          <button type="button" className="cd-tool is-music" onClick={() => void sound.start()} title="Piano music and countdown sounds">
            <Music className="cd-icon" aria-hidden="true" />
            <span className="cd-tool-label">Play music</span>
          </button>
        )}
        {immersive
          ? <button ref={exitButton} type="button" className="cd-tool" onClick={exit}><X className="cd-icon" aria-hidden="true" /><span className="cd-tool-label">Exit full screen</span></button>
          : <button ref={enterButton} type="button" className="cd-tool" onClick={() => void enter()}><Maximize2 className="cd-icon" aria-hidden="true" /><span className="cd-tool-label">Full screen</span></button>}
      </div>
      {!player.started && player.note && <p className="cd-sound-note" role="status">{NOTE_TEXT[player.note]}</p>}
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
