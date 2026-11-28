"""
Founder review previews, mixed offline with the same timing the page uses (src/countdown/audioPlan.ts):

- final-ten-seconds   T-13 .. T+5    the build's last bars, the ten second cues, the midnight impact
- midnight-transition T-70 .. T+80   playlist fade, the final minute, the ten seconds, the celebration, New Year music
- effects-only        T-12 .. T+18   the same moment with music switched off (only the effects play)
- audition            all playlist tracks back to back, with the player's crossfade

  python3 scripts/countdown-music/previews.py --music DIR --cues DIR --out DIR
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from master import encode, true_peak_db, lufs  # noqa: E402
from piano import RATE  # noqa: E402

# Keep in step with src/countdown/audioPlan.ts.
BUILD_AT = -60.0            # the final-minute build starts at T-60
PLAYLIST_FADE = (-62.0, 4.0)  # the playlist fades out from T-62 over 4 s
TICK_SLOT = 2.0             # second k's cue is ticks[(10 - k) * 2 s, +2 s], played at T-k
NEW_YEAR_AT = 25.0          # New Year music starts 25 s after midnight
CROSSFADE = 2.5             # between playlist tracks
LAST_TICK_FADE = 0.06       # second 1's cue fades out as midnight lands


def load(path: str) -> np.ndarray:
    data, rate = sf.read(path, dtype='float64', always_2d=True)
    assert rate == RATE
    return data


class Mix:
    def __init__(self, start: float, end: float):
        self.start, self.end = start, end
        self.buf = np.zeros((int((end - start) * RATE), 2))

    def add(self, audio: np.ndarray, at: float, offset: float = 0.0, length: float | None = None, gain=1.0,
            fade_out: tuple[float, float] | None = None):
        """Place audio[offset : offset+length] at page time `at`; fade_out = (page time, seconds)."""
        seg = audio[int(offset * RATE):]
        if length is not None:
            seg = seg[: int(length * RATE)]
        seg = seg * gain
        if fade_out:
            t = at + np.arange(len(seg)) / RATE
            f0, dur = fade_out
            env = np.clip(1 - (t - f0) / dur, 0, 1)
            seg = seg * env[:, None]
        i = int(round((at - self.start) * RATE))
        if i < 0:
            seg, i = seg[-i:], 0
        j = min(len(self.buf), i + len(seg))
        if j > i:
            self.buf[i:j] += seg[: j - i]


def countdown(mix: Mix, cues: str, music_on: bool, effects_on: bool, playlist: np.ndarray | None, playlist_at: float,
              new_year: np.ndarray | None):
    if music_on and playlist is not None:
        f0, dur = PLAYLIST_FADE
        mix.add(playlist, playlist_at, fade_out=(f0, dur))
    if music_on:
        mix.add(load(f'{cues}/wav/final-minute.wav'), BUILD_AT)
    if effects_on:
        ticks = load(f'{cues}/wav/ticks.wav')
        for k in range(10, 0, -1):
            # Each cue rings into the next second; the last one gives way to the midnight impact (60 ms fade at T-0).
            mix.add(ticks, -k, offset=(10 - k) * TICK_SLOT, length=TICK_SLOT, fade_out=(0.0, LAST_TICK_FADE) if k == 1 else None)
        mix.add(load(f'{cues}/wav/midnight-fx.wav'), 0.0)
    if music_on:
        mix.add(load(f'{cues}/wav/midnight-music.wav'), 0.0)
        if new_year is not None:
            mix.add(new_year, NEW_YEAR_AT)


def finish(mix: Mix, name: str, out: str, fade_tail: float = 3.0) -> dict:
    buf = mix.buf
    if fade_tail:
        n = int(fade_tail * RATE)
        buf[-n:] *= np.linspace(1, 0, n)[:, None] ** 2
    wav = os.path.join(out, 'wav', f'{name}.wav')
    os.makedirs(os.path.dirname(wav), exist_ok=True)
    sf.write(wav, buf.astype('float32'), RATE, subtype='FLOAT')
    return {'name': name, 'seconds': round(len(buf) / RATE, 2), 'lufs': round(lufs(buf), 2), 'true_peak_db': round(true_peak_db(buf), 2),
            'from': mix.start, 'to': mix.end, 'files': encode(wav, os.path.join(out, name))}


AUDITION_ORDER = ['silent-night', 'first-noel', 'away-in-a-manger', 'what-child', 'bleak-midwinter', 'o-come-all-ye-faithful',
                  'angels-we-have-heard', 'hark-the-herald', 'joy-to-the-world', 'auld-lang-syne', 'ode-to-joy']


def audition(music: str, out: str) -> dict:
    tracks = [load(f'{music}/wav/{n}.wav') for n in AUDITION_ORDER]
    total = sum(len(t) for t in tracks) / RATE - CROSSFADE * (len(tracks) - 1)
    mix = Mix(0, total)
    at = 0.0
    marks = []
    for name, t in zip(AUDITION_ORDER, tracks):
        length = len(t) / RATE
        marks.append({'name': name, 'at': round(at, 2)})
        fade = (at + length - CROSSFADE, CROSSFADE) if name != AUDITION_ORDER[-1] else None
        mix.add(t, at, fade_out=fade)
        at += length - CROSSFADE
    rep = finish(mix, 'audition', out, fade_tail=0)
    rep['marks'] = marks
    return rep


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--music', default='/home/claude/work/music')
    ap.add_argument('--cues', default='/home/claude/work/cues')
    ap.add_argument('--out', default='/home/claude/work/previews')
    ap.add_argument('--skip-audition', action='store_true')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    reports = []
    als = load(f'{a.music}/wav/auld-lang-syne.wav')
    ode = load(f'{a.music}/wav/ode-to-joy.wav')
    # B: the final ten seconds (music and effects on)
    mix = Mix(-13.0, 5.0)
    countdown(mix, a.cues, True, True, None, 0, None)
    reports.append(finish(mix, 'final-ten-seconds', a.out, fade_tail=1.5))
    # C: the whole transition; Auld Lang Syne is playing (as on 31 December) and is 40 s from its end at T-62
    mix = Mix(-70.0, 80.0)
    countdown(mix, a.cues, True, True, als, -62.0 - (len(als) / RATE - 40.0), ode)
    reports.append(finish(mix, 'midnight-transition', a.out))
    # D: music off, effects on
    mix = Mix(-12.0, 18.0)
    countdown(mix, a.cues, False, True, None, 0, None)
    reports.append(finish(mix, 'effects-only', a.out))
    if not a.skip_audition:
        reports.append(audition(a.music, a.out))
    with open(os.path.join(a.out, 'previews.json'), 'w') as f:
        json.dump(reports, f, indent=2)
    for r in reports:
        print(json.dumps({k: v for k, v in r.items() if k != 'marks'}))
