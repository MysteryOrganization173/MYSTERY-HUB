"""
Mystery Countdown music (3.7 final): an offline concert-grand renderer.

It plays note events through the Salamander Grand Piano V3 samples (Yamaha C5, 16 velocity layers, recorded by
Alexander Holm, CC BY 3.0), as published on npm by @audio-samples/piano-velocity1..16 (+ piano-release), and adds a
generated concert-hall room. Nothing here runs in the browser: the page streams the finished recordings.

Model (deliberately simple and physical):
- one sample per key strike, from the nearest recorded key (recorded every minor third, so at most one semitone of
  resampling) and the velocity layer for the touch, with a small gain trim inside the layer;
- a key held, or the sustain pedal down, lets the string ring with the recording's own decay;
- otherwise the damper falls: a short pitch-dependent fade, plus the recorded key-release noise, very quietly;
  keys above F#6 have no dampers on a grand, so they ring on;
- striking a key that is still sounding damps the earlier strike quickly (a real piano has one string set per key).
"""
from __future__ import annotations

import functools
import math
import os
from dataclasses import dataclass, field

import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve, resample_poly, butter, sosfilt

RATE = 48000
SAMPLES = os.environ.get('SALAMANDER_DIR', '/home/claude/work/samples')
NAMES = {0: 'C', 3: 'D#', 6: 'F#', 9: 'A'}
RECORDED = list(range(21, 109, 3))  # A0 .. C8, every minor third


def note_name(midi: int) -> str:
    return f"{NAMES[midi % 12]}{midi // 12 - 1}"


@functools.lru_cache(maxsize=None)
def _raw(midi: int, layer: int) -> np.ndarray:
    path = os.path.join(SAMPLES, f'v{layer}', 'package', 'audio', f'{note_name(midi)}v{layer}.ogg')
    data, rate = sf.read(path, dtype='float32', always_2d=True)
    assert rate == RATE, (path, rate)
    return data


@functools.lru_cache(maxsize=None)
def _release(key: int) -> np.ndarray:
    path = os.path.join(SAMPLES, 'rel', 'package', 'audio', f'rel{key}.ogg')
    data, _ = sf.read(path, dtype='float32', always_2d=True)
    return data


# Exact enough rational ratios for one semitone (error well under a cent).
_UP = (84, 89)    # raise pitch: fewer output samples
_DOWN = (89, 84)


@functools.lru_cache(maxsize=None)
def sample(midi: int, layer: int) -> np.ndarray:
    base = min(RECORDED, key=lambda r: abs(r - midi))
    raw = _raw(base, layer)
    shift = midi - base
    if shift == 0:
        return raw
    up, down = _UP if shift > 0 else _DOWN
    return resample_poly(raw, up, down, axis=0).astype('float32')


def layer_for(velocity: float) -> tuple[int, float]:
    """Velocity 1..127 -> (layer 1..16, gain trim). The trim smooths the steps between recorded layers."""
    v = min(127.0, max(1.0, velocity))
    pos = 1 + (v - 1) / 126 * 15
    layer = int(round(pos))
    trim = 10 ** (((pos - layer) * 1.6) / 20)  # +/- 0.8 dB inside a layer
    return max(1, min(16, layer)), trim


@dataclass
class Note:
    t: float          # onset, seconds
    midi: int
    vel: float        # 1..127
    dur: float        # key held, seconds
    gain: float = 1.0


@dataclass
class Performance:
    notes: list[Note] = field(default_factory=list)
    pedal: list[tuple[float, bool]] = field(default_factory=list)  # (time, down)

    def pedal_down_at(self, t: float) -> bool:
        state = False
        for when, down in self.pedal:
            if when > t:
                break
            state = down
        return state

    def next_pedal_up(self, t: float) -> float:
        if not self.pedal_down_at(t):
            return t
        for when, down in self.pedal:
            if when > t and not down:
                return when
        return math.inf


def damper_time(midi: int) -> float:
    # Low strings take longer to stop; the top of the keyboard has no dampers.
    return 0.32 - (midi - 21) / 87 * 0.22


def render(perf: Performance, length: float | None = None, release_level: float = 0.11) -> np.ndarray:
    notes = sorted(perf.notes, key=lambda n: n.t)
    end = max(n.t + 18 for n in notes) if length is None else length
    out = np.zeros((int(end * RATE) + RATE, 2), dtype='float64')
    # When each key is struck again (one string set per key).
    restrikes: dict[int, list[float]] = {}
    for n in notes:
        restrikes.setdefault(n.midi, []).append(n.t)
    for n in notes:
        layer, trim = layer_for(n.vel)
        data = sample(n.midi, layer)
        start = max(0, int(round(n.t * RATE)))
        if start >= len(out):
            continue
        key_up = n.t + max(0.05, n.dur)
        stop = math.inf
        if n.midi < 91:  # dampers
            stop = max(key_up, perf.next_pedal_up(key_up))
        later = [t for t in restrikes[n.midi] if t > n.t + 1e-6]
        restrike = later[0] if later else math.inf
        length_s = len(data) / RATE
        cut = min(stop + damper_time(n.midi) * 5, restrike + 0.25, n.t + length_s)
        count = max(1, min(len(data), int((cut - n.t) * RATE)))
        voice = data[:count].astype('float64') * (trim * n.gain)
        t_axis = np.arange(count) / RATE + n.t
        env = np.ones(count)
        if stop < cut:
            env *= np.where(t_axis < stop, 1.0, np.exp(-(t_axis - stop) / damper_time(n.midi)))
        if restrike < cut:
            env *= np.where(t_axis < restrike, 1.0, np.exp(-(t_axis - restrike) / 0.05))
        # A tiny fade at the very end of what is kept, so nothing clicks.
        tail = min(count, 480)
        env[-tail:] *= np.linspace(1, 0, tail)
        voice *= env[:, None]
        stop_at = min(len(out), start + count)
        out[start:stop_at] += voice[: stop_at - start]
        # The damper's own sound when it falls on a struck string (very quiet).
        if stop < cut and n.midi < 91 and release_level > 0:
            rel = _release(n.midi - 20).astype('float64') * release_level * (0.4 + 0.6 * n.vel / 127)
            r0 = int(stop * RATE)
            r1 = min(len(out), r0 + len(rel))
            if r0 < len(out):
                out[r0:r1] += rel[: r1 - r0]
    return out


# ───────────────────────── The room ─────────────────────────

def hall_impulse(seconds: float = 3.4, seed: int = 2027) -> np.ndarray:
    """A warm concert-hall response: sparse early reflections, then a dense tail that loses its top end first."""
    rng = np.random.default_rng(seed)
    n = int(seconds * RATE)
    t = np.arange(n) / RATE
    ir = np.zeros((n, 2))
    predelay = 0.021
    # Early reflections (side walls, stage, ceiling), panned and softened.
    for i, (delay, gain) in enumerate([(0.0, 0.0), (0.011, .42), (0.017, .36), (0.026, .30), (0.033, .27), (0.041, .22),
                                       (0.052, .19), (0.064, .16), (0.073, .13), (0.088, .11)]):
        if gain == 0:
            continue
        idx = int((predelay + delay) * RATE)
        pan = 0.5 + (0.32 if i % 2 else -0.32) * (1 - delay * 5)
        ir[idx, 0] += gain * math.cos(pan * math.pi / 2)
        ir[idx, 1] += gain * math.sin(pan * math.pi / 2)
    # Late tail: three bands with their own decay (low 2.7 s, mid 2.2 s, high 1.1 s), decorrelated per channel.
    bands = [(butter(2, 300, 'low', fs=RATE, output='sos'), 2.7, .9),
             (butter(2, [300, 3500], 'band', fs=RATE, output='sos'), 2.2, 1.0),
             (butter(2, 3500, 'high', fs=RATE, output='sos'), 1.05, .55)]
    onset = predelay + 0.035
    fade_in = np.clip((t - onset) / 0.06, 0, 1) ** 1.5
    for ch in range(2):
        noise = rng.standard_normal(n)
        tail = np.zeros(n)
        for sos, rt60, level in bands:
            tail += sosfilt(sos, noise) * level * np.exp(-6.91 * np.clip(t - onset, 0, None) / rt60)
        ir[:, ch] += tail * fade_in * 0.085
    ir[:int(predelay * RATE)] = 0
    return ir


@functools.lru_cache(maxsize=None)
def _hall() -> np.ndarray:
    return hall_impulse()


def room(dry: np.ndarray, wet: float = 0.30, width: float = 0.85) -> np.ndarray:
    """The piano in the hall: the dry recording narrowed a little (close mics are very wide), plus the room."""
    mid = (dry[:, 0] + dry[:, 1]) / 2
    side = (dry[:, 0] - dry[:, 1]) / 2 * width
    narrowed = np.stack([mid + side, mid - side], axis=1)
    ir = _hall()
    rev = np.stack([fftconvolve(mid, ir[:, 0])[: len(dry)], fftconvolve(mid, ir[:, 1])[: len(dry)]], axis=1)
    mix = narrowed * (1 - wet * .35) + rev * wet
    # Gentle tone: a little air off the top (close mics are bright) and nothing below 28 Hz.
    mix = sosfilt(butter(2, 28, 'high', fs=RATE, output='sos'), mix, axis=0)
    shelf = sosfilt(butter(1, 7200, 'low', fs=RATE, output='sos'), mix, axis=0)
    return mix * 0.78 + shelf * 0.22


def trim_silence(audio: np.ndarray, floor_db: float = -70, keep_tail: float = 0.4) -> np.ndarray:
    level = np.max(np.abs(audio), axis=1)
    loud = np.nonzero(level > 10 ** (floor_db / 20))[0]
    if not len(loud):
        return audio
    end = min(len(audio), loud[-1] + int(keep_tail * RATE))
    out = audio[:end].copy()
    fade = min(len(out), int(keep_tail * RATE))
    out[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    return out


def write(path: str, audio: np.ndarray):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sf.write(path, audio.astype('float32'), RATE, subtype='FLOAT')
