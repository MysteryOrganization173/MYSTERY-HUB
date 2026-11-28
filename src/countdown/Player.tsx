import { memo, useCallback, useEffect, useId, useState, useSyncExternalStore } from 'react';
import { Bell, BellOff, ChevronUp, Loader2, Pause, Play, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX, X } from 'lucide-react';
import { createCountdownSound, soundSupported, type CountdownSound, type PlayerState, type SoundNote } from './sound';
import { MUSIC_CREDITS, TRACKS } from './music';

/**
 * The countdown's music player. It appears only after the visitor taps to start; until then nothing is created or
 * downloaded. Compact on phones (play, title, next; the rest behind "More"), everything in one bar on larger screens,
 * and a small, quiet pill in the immersive view.
 */

const EMPTY: PlayerState = { started: false, playing: false, effects: true, volume: 0.85, shuffle: false, segment: 'idle', trackId: null, title: '', detail: '', locked: false, waiting: false, note: '' };

/** The sound controller for this page (created on mount, without any audio until the first tap) and its state. */
export function useCountdownSound() {
  const [sound, setSound] = useState<CountdownSound | null>(null);
  useEffect(() => {
    if (!soundSupported()) return;
    const created = createCountdownSound();
    setSound(created);
    const onVisible = () => { if (document.visibilityState === 'hidden') created?.hide(); else void created?.show(); };
    const onHide = () => created?.hide();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onHide);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('pagehide', onHide); created?.close(); };
  }, []);
  const subscribe = useCallback((listener: () => void) => sound ? sound.subscribe(listener) : () => undefined, [sound]);
  const read = useCallback(() => sound ? snapshot(sound) : EMPTY, [sound]);
  const state = useSyncExternalStore(subscribe, read, () => EMPTY);
  return { sound, state };
}

/** A stable snapshot: the same object while nothing the player shows has changed (so it re-renders only on change). */
const last = new WeakMap<CountdownSound, PlayerState>();
function snapshot(sound: CountdownSound): PlayerState {
  const next = sound.getState(), before = last.get(sound);
  if (before && (Object.keys(next) as (keyof PlayerState)[]).every(k => before[k] === next[k])) return before;
  last.set(sound, next);
  return next;
}

export const NOTE_TEXT: Record<Exclude<SoundNote, ''>, string> = {
  blocked: 'This browser didn’t allow sound. Tap play to try again.',
  lost: 'Sound paused while you were away. Tap play to continue.',
  'music-failed': 'The music couldn’t load just now. Countdown sounds still work.',
  'cues-failed': 'Countdown sounds couldn’t load. We’ll try again shortly.',
};

export const Player = memo(function Player({ sound, state, immersive }: { sound: CountdownSound; state: PlayerState; immersive: boolean }) {
  const [more, setMore] = useState(false);
  const panel = useId();
  const VolumeIcon = state.volume === 0 ? VolumeX : state.volume < 0.5 ? Volume1 : Volume2;
  const lockedTitle = state.locked ? 'The music follows the countdown now' : undefined;
  return (
    <section className="cd-player" aria-label="Music player" data-more={more || undefined} data-immersive={immersive || undefined}>
      <div className="cd-player-bar">
        <button type="button" className="cd-pbtn cd-prev-wide" onClick={sound.previous} aria-disabled={state.locked || undefined} aria-label="Previous track" title={lockedTitle}><SkipBack className="cd-icon" aria-hidden="true" /></button>
        <button type="button" className="cd-pbtn is-main" onClick={() => { if (state.playing) sound.pause(); else void sound.play(); }} aria-label={state.playing ? 'Pause music' : 'Play music'}>
          {state.waiting && state.playing ? <Loader2 className="cd-icon cd-spin" aria-hidden="true" /> : state.playing ? <Pause className="cd-icon" aria-hidden="true" /> : <Play className="cd-icon" aria-hidden="true" />}
        </button>
        <button type="button" className="cd-pbtn" onClick={sound.next} aria-disabled={state.locked || undefined} aria-label="Next track" title={lockedTitle}><SkipForward className="cd-icon" aria-hidden="true" /></button>
        <p className="cd-now" aria-live="polite">
          <span className="cd-now-title">{state.title || 'Piano music'}</span>
          <span className="cd-now-detail">{!state.playing ? 'Paused' : state.waiting ? 'Loading…' : state.detail}</span>
        </p>
        <div className="cd-player-more" id={panel}>
          <button type="button" className="cd-pbtn cd-prev-narrow" onClick={sound.previous} aria-disabled={state.locked || undefined} aria-label="Previous track" title={lockedTitle}><SkipBack className="cd-icon" aria-hidden="true" /></button>
          <button type="button" className="cd-chip" aria-pressed={state.shuffle} onClick={() => sound.setShuffle(!state.shuffle)}><Shuffle className="cd-icon" aria-hidden="true" /><span>Shuffle</span></button>
          <button type="button" className="cd-chip" aria-pressed={state.effects} onClick={() => sound.setEffects(!state.effects)}>
            {state.effects ? <Bell className="cd-icon" aria-hidden="true" /> : <BellOff className="cd-icon" aria-hidden="true" />}<span>Countdown sounds</span>
          </button>
          <label className="cd-volume">
            <VolumeIcon className="cd-icon" aria-hidden="true" />
            <span className="cd-sr">Volume</span>
            <input type="range" min={0} max={100} step={5} value={Math.round(state.volume * 100)} onChange={e => sound.setVolume(Number(e.currentTarget.value) / 100)} aria-valuetext={`${Math.round(state.volume * 100)}%`} />
          </label>
          <button type="button" className="cd-chip cd-off-narrow" onClick={sound.stop}><X className="cd-icon" aria-hidden="true" /><span>Turn sound off</span></button>
          <details className="cd-credits">
            <summary>Music credits</summary>
            <div className="cd-credits-body">
              <p>{MUSIC_CREDITS.arrangement} {MUSIC_CREDITS.melodies}</p>
              <p>Piano: Salamander Grand Piano V3 by Alexander Holm, licensed <a href={MUSIC_CREDITS.pianoLicence} target="_blank" rel="noopener noreferrer">CC BY 3.0<span className="cd-sr"> (opens in a new tab)</span></a>.</p>
              <ul>{TRACKS.map(t => <li key={t.id}><b>{t.title}</b> · {t.music}</li>)}</ul>
              <p className="cd-credits-data">Music plays one track at a time (about 2 to 3 MB each). The countdown’s own sounds are under 1 MB, fetched in the final hour.</p>
            </div>
          </details>
        </div>
        <button type="button" className="cd-pbtn is-more" aria-expanded={more} aria-controls={panel} aria-label="More sound controls" onClick={() => setMore(v => !v)}><ChevronUp className="cd-icon" aria-hidden="true" /></button>
        <button type="button" className="cd-pbtn cd-off-wide" onClick={sound.stop} aria-label="Turn sound off" title="Turn sound off"><X className="cd-icon" aria-hidden="true" /></button>
      </div>
      <p className="cd-player-note" role="status">{state.note ? NOTE_TEXT[state.note] : ''}</p>
    </section>
  );
});
