"""
Mystery Countdown 3.7 final: the countdown's own sounds, rendered offline.

- final-minute.*  The last 60 seconds (T-60 to T-0): a piano build at 120 bpm (two beats a second, so every bar is two
                  seconds), from a soft pulse to a held dominant tremolo. It hints the Auld Lang Syne motif that
                  midnight resolves. Played only when music is on, started at the right offset for a late arrival.
- ticks.*         Ten cues, one per second (10..1), each in its own 2-second slot of one file: a warm low impact and a
                  piano octave climbing the dominant chord; the last three gather with a reversed swell. The page plays
                  each slot when the visible clock shows that second (the clock leads, the sound follows).
- midnight-music.* and midnight-fx.*  The celebration (29 s), in two stems the page starts together: a full-keyboard F major impact with a deep, controlled low end, golden
                  fireworks spread across the stereo field (their times are exported for the visuals), and the chorus
                  of Auld Lang Syne in festive octaves, settling into a calm final chord.

Every piano note is a Salamander Grand Piano V3 sample (CC BY 3.0, Alexander Holm). The impacts, fireworks and
risers are synthesised here (original sound design, no samples).
"""
from __future__ import annotations

import json
import math
import os
import sys

import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from piano import RATE, Note, Performance, render, room, hall_impulse  # noqa: E402
from master import lufs, true_peak_db, limit, limit_gain, encode  # noqa: E402

rng = np.random.default_rng(2027)
N = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def m(name: str) -> int:
    """'C#4' -> MIDI."""
    letter, rest = name[0], name[1:]
    shift = 0
    while rest and rest[0] in '#b':
        shift += 1 if rest[0] == '#' else -1
        rest = rest[1:]
    return 12 * (int(rest) + 1) + N[letter] + shift


def chordm(names: str) -> list[int]:
    return [m(x) for x in names.split()]


def stereo(mono: np.ndarray, pan: float = 0.0) -> np.ndarray:
    """pan -1 (left) .. 1 (right), constant power."""
    a = (pan + 1) * math.pi / 4
    return np.stack([mono * math.cos(a), mono * math.sin(a)], axis=1)


def place(buf: np.ndarray, sound: np.ndarray, at: float, gain: float = 1.0):
    i = int(at * RATE)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sound))
    buf[i:j] += sound[: j - i] * gain


def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'low', fs=RATE, output='sos'), x, axis=0)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'high', fs=RATE, output='sos'), x, axis=0)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=RATE, output='sos'), x, axis=0)


# ───────────────────────── Synthesised sound design ─────────────────────────

def boom(f0=92.0, f1=46.0, sweep=0.09, decay=0.75, length=2.0, body=0.35, click=0.12) -> np.ndarray:
    """A warm, deep impact: a pitch-dropping sine (felt, not heard, on big speakers), a mid 'skin' body that carries on
    phone speakers, and a soft felt-mallet click. Mono."""
    n = int(length * RATE)
    t = np.arange(n) / RATE
    f = f1 + (f0 - f1) * np.exp(-t / sweep)
    phase = 2 * np.pi * np.cumsum(f) / RATE
    sub = np.sin(phase) * np.exp(-t / decay) * np.clip(t / 0.004, 0, 1)
    # Second harmonic, briefly: what makes the low end audible on small speakers without distortion.
    sub += 0.28 * np.sin(2 * phase) * np.exp(-t / (decay * 0.35))
    noise = rng.standard_normal(n)
    skin = bp(noise, 110, 420) * np.exp(-t / 0.07) * body
    felt = bp(noise, 900, 3500) * np.exp(-t / 0.012) * click
    out = sub + skin + felt
    fade = int(0.05 * RATE)
    out[-fade:] *= np.linspace(1, 0, fade)
    return out / np.max(np.abs(out))


def firework(size=1.0, distance=1.0, seed=0, length=3.2) -> np.ndarray:
    """One golden burst: a distant thump, a bright bloom of noise, then crackle that thins out. Stereo, spread."""
    r = np.random.default_rng(seed)
    n = int(length * RATE)
    t = np.arange(n) / RATE
    thump = np.sin(2 * np.pi * (58 + 30 * np.exp(-t / 0.05)) * t) * np.exp(-t / 0.16) * 0.55
    bloom = lp(r.standard_normal(n), 2600 / distance) * np.exp(-t / 0.22) * 0.32
    mono = (thump + bloom) * np.clip(t / 0.002, 0, 1)
    out = stereo(mono, 0)
    # Crackle: many tiny, bright pops, denser at first, each placed a little left or right.
    pops = int(260 * size)
    for _ in range(pops):
        when = 0.12 + r.exponential(0.55) * (0.7 + 0.6 * size)
        if when > length - 0.1:
            continue
        k = int(r.integers(24, 96))
        pop = r.standard_normal(k) * np.hanning(k)
        pop = hp(pop, 1800) * (0.04 + 0.05 * r.random()) * math.exp(-when / 1.4)
        place(out, stereo(pop, float(r.uniform(-.8, .8))), when)
    # A gentle sizzle under the crackle.
    sizzle = hp(r.standard_normal(n), 4500) * np.exp(-np.clip(t - 0.1, 0, None) / 0.9) * np.clip((t - 0.08) / 0.15, 0, 1) * 0.022
    out += stereo(sizzle, 0) * 0.9
    return out * (0.65 + 0.35 * size) / distance


def riser(length=4.5, f0=300, f1=5200, level=0.18) -> np.ndarray:
    """Filtered noise opening upward with a rising tone, cut cleanly at its peak. Mono."""
    n = int(length * RATE)
    t = np.arange(n) / RATE
    x = t / length
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    block = 1024
    for i in range(0, n, block):
        cutoff = f0 * (f1 / f0) ** x[min(i, n - 1)]
        seg = noise[max(0, i - 2048): i + block]
        filt = bp(seg, max(60, cutoff * .45), min(RATE / 2.2, cutoff), 2)[-min(block, n - i):]
        out[i:i + len(filt)] = filt
    tone = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (x * 2.0)) / RATE) * 0.25
    env = x ** 2.2
    out = (out + tone * 0.6) * env * level
    out[-int(0.03 * RATE):] *= np.linspace(1, 0, int(0.03 * RATE))
    return out


def reverse_swell(midis: list[int], length=0.9, level=0.5) -> np.ndarray:
    """A piano chord's reverberation played backwards, swelling into the beat. Stereo."""
    perf = Performance([Note(0.0, x, 72, 3.0) for x in midis], [(0.0, True), (4.0, False)])
    dry = render(perf, length=4.5)
    wet = room(dry, wet=0.9)
    seg = wet[: int(length * RATE * 2.2)][::-1]
    seg = seg[-int(length * RATE):]
    env = np.linspace(0, 1, len(seg)) ** 2
    return seg * env[:, None] * level


def piano(notes: list[tuple[float, int, float, float]], pedal: list[tuple[float, bool]] | None = None, length: float | None = None,
          wet: float = 0.3) -> np.ndarray:
    perf = Performance([Note(t, x, v, d) for (t, x, v, d) in notes], sorted(pedal or []))
    dry = render(perf, length=length)
    return room(dry, wet=wet)


# ───────────────────────── The final minute ─────────────────────────

BEAT = 0.5  # 120 bpm


def final_minute() -> np.ndarray:
    total = 60.0
    notes: list[tuple[float, int, float, float]] = []
    pedal: list[tuple[float, bool]] = []
    r = np.random.default_rng(60)
    jitter = lambda: float(r.normal(0, 0.004))
    bar = lambda k: k * 4 * BEAT  # bar k (0-based) start, seconds

    def chord_at(k, names, vel, beats=4, roll=0.0):
        for i, x in enumerate(chordm(names)):
            notes.append((bar(k) + i * roll + jitter(), x, vel, beats * BEAT))

    def pedal_change(t):
        pedal.append((t + 0.004, False)); pedal.append((t + 0.06, True))

    # A: T-60..T-40 (bars 0-9). A soft clock-like pulse in the middle of the piano, a low F breath on each bar, and the
    # first notes of Auld Lang Syne, high and quiet.
    a_harm = ['F2 C3', 'D2 A2', 'Bb1 F2', 'C2 G2', 'F2 C3', 'D2 A2', 'Bb1 F2', 'C2 G2', 'Bb1 F2', 'C2 G2']
    a_pulse = ['A3 C4 F4', 'A3 C4 F4', 'A3 D4 F4', 'A3 D4 F4', 'Bb3 D4 F4', 'A3 D4 F4', 'G3 C4 E4', 'Bb3 C4 E4', 'Bb3 D4 F4', 'Bb3 C4 E4']
    for k in range(10):
        pedal_change(bar(k))
        lv = 34 + k * 1.6
        for x in chordm(a_harm[k]):
            notes.append((bar(k) + jitter(), x, lv + 4, 4 * BEAT))
        for beat in range(4):
            for i, x in enumerate(chordm(a_pulse[k])):
                notes.append((bar(k) + beat * BEAT + i * 0.008 + jitter(), x, lv - 6 + (3 if beat == 0 else 0), BEAT * .9))
    motif = [(0, 'C5', 1), (1, 'F5', 1.5), (2.5, 'F5', .5), (3, 'F5', 1), (4, 'A5', 1), (5, 'G5', 1.5), (6.5, 'F5', .5), (7, 'G5', 1), (8, 'A5', 2)]
    for start_bar in (2, 6):
        for (b, x, d) in motif:
            if start_bar == 6 and b >= 7:
                break
            notes.append((bar(start_bar) - BEAT + b * BEAT + jitter(), m(x), 46 + start_bar, d * BEAT))
    # B: T-40..T-20 (bars 10-19). Eighth-note chords, octave bass on 1 and 3, a steady crescendo.
    b_bass = ['Bb1', 'C2', 'D2', 'Bb1', 'G1', 'C2', 'A1', 'D2', 'Bb1', 'C2']
    b_chord = ['Bb3 D4 F4', 'C4 E4 G4', 'A3 D4 F4', 'Bb3 D4 F4', 'Bb3 D4 G4', 'Bb3 E4 G4', 'A3 C4 E4', 'A3 D4 F4', 'Bb3 D4 F4', 'Bb3 E4 G4']
    for i in range(10):
        k = 10 + i
        pedal_change(bar(k))
        lv = 50 + i * 2.6
        lo = m(b_bass[i])
        for beat in (0, 2):
            notes.append((bar(k) + beat * BEAT + jitter(), lo, lv + 6, 2 * BEAT))
            notes.append((bar(k) + beat * BEAT + jitter(), lo + 12, lv, 2 * BEAT))
        for e in range(8):
            for x in chordm(b_chord[i]):
                notes.append((bar(k) + e * BEAT / 2 + jitter(), x + (12 if i >= 5 else 0), lv - 8 + (4 if e % 2 == 0 else 0), BEAT / 2 * .85))
    # C: T-20..T-10 (bars 20-24). Octaves in both hands, rising harmony to the dominant.
    c_bass = ['Bb1', 'Bb1', 'A1', 'D2', 'G1']
    c_chord = ['Bb4 D5 F5', 'C5 E5 G5', 'C5 E5 A5', 'D5 F5 A5', 'D5 F5 Bb5']
    for i in range(5):
        k = 20 + i
        pedal_change(bar(k))
        lv = 76 + i * 3
        lo = m(c_bass[i])
        for e in range(8):
            notes.append((bar(k) + e * BEAT / 2 + jitter(), lo + (12 if e % 2 else 0), lv - (0 if e % 2 == 0 else 8), BEAT / 2 * .9))
            for x in chordm(c_chord[i]):
                notes.append((bar(k) + e * BEAT / 2 + jitter(), x, lv - 10 + (6 if e % 4 == 0 else 0), BEAT / 2 * .8))
    # D: T-10..T-0 (bars 25-29). The dominant held: a low C tremolo growing, one sustained C chord, room for the ticks.
    pedal_change(bar(25))
    for x in chordm('C3 G3 Bb3 E4 G4'):
        notes.append((bar(25) + jitter(), x, 70, 10.0))
    t = bar(25)
    i = 0
    while t < total - 0.12:
        x = t / total
        lv = 46 + 46 * ((t - bar(25)) / 10.0) ** 1.4
        notes.append((t, m('C1') if i % 2 == 0 else m('C2'), lv, 0.12))
        t += 0.125; i += 1
    pedal.append((total - 0.05, False))
    pian = piano(notes, pedal, length=total + 1.5, wet=0.3)[: int(total * RATE)]
    out = pian.copy()
    # Heartbeat timpani from T-30: two soft impacts a bar, then every beat from T-20.
    for k in range(15, 25):
        beats = (0, 2) if k < 20 else (0, 1, 2, 3)
        for beat in beats:
            level = 0.05 + 0.012 * (k - 15) + (0.02 if beat == 0 else 0)
            place(out, stereo(boom(f0=78, f1=52, decay=0.42, length=1.0, body=0.4, click=0.05)), bar(k) + beat * BEAT, level)
    # A slow, deep swell under the last ten seconds, and the riser into midnight.
    place(out, stereo(riser(9.6, 120, 3800, 0.09)), total - 9.6)
    # The build's level: it starts under the playlist's loudness and grows; at T-10 it steps back so the ten
    # seconds lead (the tremolo's own crescendo carries it from there, under the cues).
    return out * envelope(len(out), [0, 10, 30, 48, 49.9, 50.15, 59.8], [-9.5, -8.5, -6.5, -4.5, -4.5, -10.5, -10.5])[:, None]


def envelope(n: int, times: list[float], dbs: list[float]) -> np.ndarray:
    t = np.arange(n) / RATE
    return 10 ** (np.interp(t, times, dbs) / 20)


# ───────────────────────── The final ten seconds ─────────────────────────

TICK_SLOT = 2.0
TICK_PIANO = {10: ['C3', 'C4'], 9: ['E3', 'E4'], 8: ['G3', 'G4'], 7: ['Bb3', 'Bb4'], 6: ['C4', 'C5'],
              5: ['E4', 'E5'], 4: ['G4', 'G5'], 3: ['Bb4', 'Bb5', 'C2'], 2: ['C5', 'C6', 'C2', 'G2'],
              1: ['C2', 'C3', 'G3', 'Bb3', 'E4', 'G4', 'Bb4', 'C5', 'E5']}


TICK_PEAK = {sec: -11.0 + (10 - sec) * (5.5 / 9) for sec in range(1, 11)}


def ticks() -> np.ndarray:
    out = np.zeros((int(10 * TICK_SLOT * RATE), 2))
    for i, sec in enumerate(range(10, 0, -1)):
        start = i * TICK_SLOT
        k = 10 - sec  # 0..9: rising intensity
        vel = 62 + k * 4.5
        notes = [(0.0, m(x), vel - (8 if m(x) < 48 else 0), 1.6) for x in TICK_PIANO[sec]]
        hit = piano(notes, [(0.0, True), (1.75, False)], length=TICK_SLOT + 1, wet=0.28)[: int(TICK_SLOT * RATE)]
        imp = stereo(boom(f0=96 - k * 2, f1=46, decay=0.5 + 0.04 * k, length=TICK_SLOT, body=0.4, click=0.1))
        slot = hit * (0.9 + 0.03 * k) + imp * (0.17 + 0.025 * k)
        fade = int(0.12 * RATE)
        slot[-fade:] *= np.linspace(1, 0, fade)[:, None]
        # A controlled rise: each second's peak is set on a curve (10 at -11 dBFS up to 1 at -5.5 dBFS), so the last
        # seconds grow in weight and density rather than simply getting louder, and leave room for the build under them.
        slot *= 10 ** ((TICK_PEAK[sec] - true_peak_db(slot)) / 20)
        place(out, slot, start)
        # 4, 3 and 2 carry the reversed swell that leads into the next second (it ends as that second appears).
        if sec in (4, 3, 2):
            nxt = sec - 1
            sw = reverse_swell([m(x) for x in TICK_PIANO[nxt]], length=0.75, level=0.36 + 0.08 * (4 - sec))
            place(out, sw, start + 1.0 - len(sw) / RATE)
    return out


# ───────────────────────── Midnight ─────────────────────────

CHORUS = [  # Auld Lang Syne's chorus (bars 9-16) in F, beats; pickup D5 at -1
    (-1, 'D5', 1), (0, 'C5', 1.5), (1.5, 'A4', .5), (2, 'A4', 1), (3, 'F4', 1), (4, 'G4', 1.5), (5.5, 'F4', .5), (6, 'G4', 1), (7, 'D5', 1),
    (8, 'C5', 1.5), (9.5, 'A4', .5), (10, 'A4', 1), (11, 'C5', 1), (12, 'D5', 3), (15, 'D5', 1),
    (16, 'C5', 1.5), (17.5, 'A4', .5), (18, 'A4', 1), (19, 'F4', 1), (20, 'G4', 1.5), (21.5, 'F4', .5), (22, 'G4', 1), (23, 'A4', .5), (23.5, 'G4', .5),
    (24, 'F4', 1.5), (25.5, 'D4', .5), (26, 'D4', 1), (27, 'C4', 1), (28, 'F4', 4)]
CHORUS_HARM = [(0, 'F2', 'A3 C4 F4'), (2, 'D2', 'A3 D4 F4'), (4, 'G1', 'Bb3 D4 G4'), (6, 'C2', 'Bb3 E4 G4'), (8, 'F2', 'A3 C4 F4'),
               (10, 'A1', 'A3 C4 E4'), (12, 'Bb1', 'Bb3 D4 F4'), (16, 'C2', 'A3 C4 F4'), (18, 'D2', 'A3 D4 F4'), (20, 'G1', 'Bb3 D4 G4'),
               (22, 'C2', 'Bb3 E4 G4'), (24, 'D2', 'A3 D4 F4'), (26, 'G1', 'Bb3 D4 G4'), (27, 'C2', 'Bb3 E4 G4'), (28, 'F1', 'A3 C4 F4')]
FIREWORKS = [  # (seconds after midnight, pan -1..1, size, height 0..1 for the visuals)
    (0.55, -0.55, 1.0, .62), (1.35, 0.6, 0.9, .55), (2.2, 0.0, 1.1, .74), (3.05, -0.75, 0.8, .5), (3.9, 0.7, 1.0, .66),
    (5.0, -0.2, 1.2, .78), (6.3, 0.45, 0.8, .52), (7.2, -0.6, 0.9, .6), (8.6, 0.15, 1.25, .8), (10.2, -0.4, 0.8, .56),
    (11.4, 0.65, 0.9, .64), (13.0, 0.0, 1.3, .82), (13.35, -0.5, 0.7, .58), (13.7, 0.5, 0.7, .6)]
CHORUS_START = 2.4   # seconds after midnight
CHORUS_BPM = 86


def midnight() -> tuple[np.ndarray, np.ndarray, dict]:
    """Two stems that sum to the full celebration, so effects still play with music off and vice versa:
    effects = the impact (full-keyboard chord, sparkle, low boom, crack) and the fireworks;
    music   = the Auld Lang Syne chorus and its final chord."""
    length = 29.0
    beat = 60 / CHORUS_BPM
    notes: list[tuple[float, int, float, float]] = []
    pedal: list[tuple[float, bool]] = []
    r = np.random.default_rng(1)
    # The impact: F major across the whole keyboard, struck at once (a fast roll from the bottom), then a high sparkle.
    for i, x in enumerate(chordm('F1 F2 C3 F3 A3 C4 F4 A4 C5 F5 A5')):
        notes.append((0.0 + i * 0.006, x, 108 - (6 if i > 6 else 0), 2.0))
    for i, x in enumerate(chordm('C6 F6 A6 C7 F7')):
        notes.append((0.32 + i * 0.07, x, 74 - i * 3, 1.5))
    impact = piano(notes, [(0.0, True), (CHORUS_START - 0.02, False)], length=length + 2, wet=0.32)[: int(length * RATE)]
    notes = []
    pedal += [(CHORUS_START + 0.05, True)]
    # The chorus in festive octaves, a little slower as it closes.
    def at(b):
        # gentle broadening over the last 6 beats
        stretch = 0.0 if b < 22 else (b - 22) ** 2 * 0.012
        return CHORUS_START + b * beat + stretch * beat
    for (b, name, d) in CHORUS:
        x = m(name) + 12
        lv = 88 - max(0, b - 16) * 0.9
        notes.append((at(b) - 0.01 + float(r.normal(0, .003)), x, lv, d * beat * .97))
        notes.append((at(b) + float(r.normal(0, .004)), x - 12, lv - 12, d * beat * .97))
    for i, (b, bass, upper) in enumerate(CHORUS_HARM):
        nxt = CHORUS_HARM[i + 1][0] if i + 1 < len(CHORUS_HARM) else b + 4
        lv = 80 - max(0, b - 16) * 1.2
        pedal += [(at(b) + 0.004, False), (at(b) + 0.06, True)]
        lo = m(bass)
        notes.append((at(b), lo, lv, (nxt - b) * beat))
        notes.append((at(b), lo + 12, lv - 6, (nxt - b) * beat))
        span = nxt - b
        for k in range(int(span * 2)):
            for x in chordm(upper):
                if b >= 28 and k > 0:
                    break
                notes.append((at(b + k * 0.5) + float(r.normal(0, .004)), x, lv - 16 + (5 if k % 2 == 0 else 0), beat * .45 if b < 28 else 6))
    # Last chord rings, and a final high chime.
    for i, x in enumerate(chordm('F5 A5 C6 F6')):
        notes.append((at(29.5) + i * 0.45, x, 52 - i * 3, 4))
    pedal.append((length - 0.4, False))
    music = piano(notes, pedal, length=length + 2, wet=0.32)[: int(length * RATE)]
    out = impact.copy()
    # The low impact and the first bloom.
    place(out, stereo(boom(f0=84, f1=40, decay=1.1, length=3.0, body=0.45, click=0.14)), 0.0, 0.55)
    crack = lp(rng.standard_normal(int(0.6 * RATE)), 5200) * np.exp(-np.arange(int(0.6 * RATE)) / RATE / 0.09) * 0.09
    place(out, stereo(crack, 0), 0.0)
    # The impact is set to land at -2.5 dBTP after the opening level (-6 dB), so the limiter only guards the sum.
    out *= min(1.0, 10 ** ((-2.5 - (true_peak_db(out) - 6.0)) / 20))
    # Fireworks, spread left to right, under the music.
    sky = np.zeros_like(out)
    for i, (when, pan, size, _) in enumerate(FIREWORKS):
        fw = firework(size=size, distance=1.25 + 0.3 * (i % 3), seed=100 + i)
        a = (pan + 1) * math.pi / 4
        fw = np.stack([fw[:, 0] * math.cos(a) * 1.4 + fw[:, 1] * 0.15, fw[:, 1] * math.sin(a) * 1.4 + fw[:, 0] * 0.15], axis=1)
        place(sky, fw, when, 0.5)
    # An outdoor space for the fireworks (longer and darker than the piano's hall).
    ir = hall_impulse(seconds=3.8, seed=31)
    space = np.stack([fftconvolve(sky[:, 0], ir[:, 0])[: len(sky)], fftconvolve(sky[:, 1], ir[:, 1])[: len(sky)]], axis=1)
    out += sky * 0.75 + lp(space, 3000) * 0.55
    env = envelope(len(out), [0, 2.2, 4.5, 20, 29], [-6.0, -5.5, -5.0, -5.0, -5.0])[:, None]
    timeline = {'fireworks': [{'at': w, 'x': round(0.5 + p * 0.42, 3), 'y': round(1 - h, 3), 'size': s} for (w, p, s, h) in FIREWORKS],
                'chorusStart': CHORUS_START, 'chorusEnd': round(at(28), 2), 'settled': round(at(28) + 2.5, 2), 'length': length}
    return music * env, out * env, timeline


def limiter_gain(audio: np.ndarray, peak_db: float) -> np.ndarray:
    """The limiter's gain curve for this audio (ones when it already fits under the ceiling)."""
    if true_peak_db(audio) <= peak_db:
        return np.ones(len(audio))
    return limit_gain(audio, peak_db - 0.3)


def finish(audio: np.ndarray, name: str, out_dir: str, peak_db: float, gain_db: float = 0.0, gain: np.ndarray | None = None) -> dict:
    audio = audio * 10 ** (gain_db / 20)
    if gain is not None:
        audio = audio * gain[:, None]
    elif true_peak_db(audio) > peak_db:
        audio = limit(audio, peak_db - 0.3)
    wav = os.path.join(out_dir, 'wav', f'{name}.wav')
    os.makedirs(os.path.dirname(wav), exist_ok=True)
    import soundfile as sf
    sf.write(wav, audio.astype('float32'), RATE, subtype='FLOAT')
    rep = {'name': name, 'seconds': round(len(audio) / RATE, 2), 'lufs': round(lufs(audio), 2), 'true_peak_db': round(true_peak_db(audio), 2),
           'files': encode(wav, os.path.join(out_dir, name))}
    return rep


if __name__ == '__main__':
    out_dir = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/work/cues'
    os.makedirs(out_dir, exist_ok=True)
    reports = []
    fm = final_minute()
    reports.append(finish(fm, 'final-minute', out_dir, -1.5, gain_db=0.0))
    tk = ticks()
    reports.append(finish(tk, 'ticks', out_dir, -1.5))
    music, fx, timeline = midnight()
    full = music + fx
    g = np.minimum(np.minimum(limiter_gain(full, -1.0), limiter_gain(music, -1.0)), limiter_gain(fx, -1.0))
    print('midnight limiter: most reduction', round(float(20 * np.log10(g.min())), 2), 'dB;',
          'time under -0.5 dB of reduction', round(float(np.sum(g < 10 ** (-0.5 / 20)) / RATE), 2), 's')
    reports.append(finish(music, 'midnight-music', out_dir, -1.0, gain=g))
    reports.append(finish(fx, 'midnight-fx', out_dir, -1.0, gain=g))
    reports.append(finish(full, 'midnight', out_dir, -1.0, gain=g))  # the two together, for review
    with open(os.path.join(out_dir, 'midnight-timeline.json'), 'w') as f:
        json.dump(timeline, f, indent=2)
    for r in reports:
        print(json.dumps(r))
