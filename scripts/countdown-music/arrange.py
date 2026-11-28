"""
Mystery Countdown music: turns a public-domain hymn setting (abcread.Tune) into an expressive solo-piano performance
(piano.Performance). The melody and harmony come from the setting; the arrangement (intro, textures per verse,
voicings, dynamics, pedalling, rubato and ending) is written here, for Mystery Hub.
"""
from __future__ import annotations

import math
import random
import re
from dataclasses import dataclass, field

from abcread import Tune, Event
from piano import Note, Performance

PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
QUALITY = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], 'sus4': [0, 5, 7],
           'sus2': [0, 2, 7], '7sus4': [0, 5, 7, 10], 'add9': [0, 4, 7, 2], 'madd9': [0, 3, 7, 2], '6': [0, 4, 7, 9],
           'm6': [0, 3, 7, 9], 'dim': [0, 3, 6], 'dim7': [0, 3, 6, 9], 'm7b5': [0, 3, 6, 10], '9': [0, 4, 7, 10, 2],
           'maj9': [0, 4, 7, 11, 2], 'm9': [0, 3, 7, 10, 2], '6/9': [0, 4, 7, 9, 2], 'aug': [0, 4, 8]}


def chord(symbol: str) -> tuple[set[int], int, int]:
    """'G7/B' -> (pitch classes, bass pitch class, root pitch class)."""
    m = re.fullmatch(r'([A-G])([#b]?)([^/]*)(?:/([A-G])([#b]?))?', symbol)
    if not m:
        raise ValueError(symbol)
    root = (PC[m.group(1)] + {'#': 1, 'b': -1, '': 0}[m.group(2)]) % 12
    pcs = {(root + i) % 12 for i in QUALITY[m.group(3)]}
    bass = root if not m.group(4) else (PC[m.group(4)] + {'#': 1, 'b': -1, '': 0}[m.group(5)]) % 12
    pcs.add(bass)
    return pcs, bass, root


def chord_line(text: str, bar_beats: float) -> list[tuple[float, str]]:
    """'F | Gm7:2 C7:2 | ...' -> [(beat, symbol)], bar 1 at beat 0."""
    out, t = [], 0.0
    for bar in text.split('|'):
        items = bar.split()
        if not items:
            continue
        given = [float(i.split(':')[1]) for i in items if ':' in i]
        free = [i for i in items if ':' not in i]
        each = (bar_beats - sum(given)) / len(free) if free else 0
        for item in items:
            sym, _, beats = item.partition(':')
            out.append((t, sym))
            t += float(beats) if beats else each
    return out


@dataclass
class Pass:
    """One time through the tune."""
    melody: str = 'plain'          # plain | high | octaves | alto | thirds | satb | none
    texture: str = 'flow'          # flow | triplet | pad | stride | waltz | none
    level: float = 0.5             # 0 (pp) .. 1 (ff)
    transpose: int = 0
    tempo: float = 1.0             # relative to the piece's tempo
    chords: str | None = None      # chord-line override for the harmony
    bridge: str | None = None      # bars of chords *before* this pass (to modulate), e.g. 'C7'
    swell: float = 0.0             # crescendo across the pass (level change at its end)
    fills: bool = False            # small right-hand answers while the melody holds a long note


@dataclass
class Piece:
    tune: Tune
    bpm: float
    passes: list[Pass]
    intro_bars: int = 4
    intro: Pass = field(default_factory=lambda: Pass(melody='high', texture='flow', level=.3, tempo=.94))
    ending: str = 'roll'           # roll | tag
    final_hold: float = 7.0        # seconds the last chord rings
    phrase_bars: int = 4
    seed: int = 7
    bass_range: tuple[int, int] = (34, 50)
    final_chord: str | None = None  # e.g. 'Fadd9' for the last chord


def _note_window(events: list[Event], t0: float, t1: float) -> list[Event]:
    return [e for e in events if t0 - 1e-6 <= e.start < t1 - 1e-6]


class Harmony:
    def __init__(self, tune: Tune, override: str | None, grain: float):
        self.tune, self.grain = tune, grain
        self.line = chord_line(override, tune.bar_beats) if override else None
        mel = tune.melody_voice()
        self.others = {k: v for k, v in tune.voices.items() if k != mel}
        self.melody = tune.voices[mel]

    def at(self, u: float) -> tuple[frozenset[int], int]:
        if self.line:
            current = self.line[0][1]
            for when, sym in self.line:
                if when <= u + 1e-6:
                    current = sym
            pcs, bass, _ = chord(current)
            return frozenset(pcs), bass
        u = math.floor((u + 1e-6) / self.grain) * self.grain
        u = min(u, self.tune.length - self.tune.pickup - 1e-3)
        notes = []
        for events in self.others.values():
            for e in events:
                if e.start - 1e-6 <= u < e.start + e.dur - 1e-6:
                    notes.extend(e.pitches)
        for e in self.melody:
            if e.start - 1e-6 <= u < e.start + e.dur - 1e-6 and e.dur >= 0.99:
                notes.extend(e.pitches)
        if not notes:
            return frozenset(), -1
        if len(self.tune.voices) <= 2:
            # Two-staff settings (chords in each hand): the bass is the lowest note of the lower staff.
            pass
        return frozenset(n % 12 for n in notes), min(notes) % 12


def voicing(pcs: frozenset[int], bass_pc: int, prev_bass: int | None, cap: int, voices: int,
            bass_range: tuple[int, int]) -> list[int]:
    lo, hi = bass_range
    cands = [p for p in range(lo, hi + 1) if p % 12 == bass_pc]
    target = prev_bass if prev_bass is not None else (lo + hi) // 2
    # Leave the arpeggio room under the right hand (about an octave and a half), then stay near the last bass.
    roomy = [p for p in cands if p <= cap - 16]
    bass = min(roomy or cands, key=lambda p: (abs(p - target), p)) if cands else lo
    chord_pcs = sorted(pcs)
    third = [pc for pc in chord_pcs if (pc - bass_pc) % 12 in (3, 4)]
    seventh = [pc for pc in chord_pcs if (pc - bass_pc) % 12 in (10, 11, 9, 2)]
    out = [bass]
    used = {bass_pc}

    def pick(floor: int, ceil: int, prefer: list[int]):
        options = [p for p in range(floor, ceil + 1) if p % 12 in pcs]
        if not options:
            return None
        for pc in prefer:
            for p in options:
                if p % 12 == pc:
                    return p
        fresh = [p for p in options if p % 12 not in used]
        return (fresh or options)[0]

    fifth = (bass_pc + 7) % 12
    v1 = pick(bass + 5, bass + 9, [fifth] if fifth in pcs else [])
    if v1 is None:
        v1 = pick(bass + 3, bass + 12, [])
    if v1 is not None:
        out.append(v1); used.add(v1 % 12)
    prefs = third + seventh
    while len(out) < voices:
        prev = out[-1]
        nxt = pick(prev + 3, prev + 10, [pc for pc in prefs if pc not in used])
        if nxt is None or nxt > cap:
            break
        out.append(nxt); used.add(nxt % 12)
    # Never above the right hand.
    out = [p for p in out if p <= cap or p == bass]
    return out


PATTERNS = {
    ('flow', 2): [0, 1, 2, 3], ('flow', 3): [0, 1, 2, 3, 2, 1], ('flow', 4): [0, 1, 2, 3, 4, 3, 2, 1],
    ('triplet', 3): [0, 1, 2, 3, 2, 1, 2, 3, 2], ('triplet', 4): [0, 1, 2, 3, 2, 1, 1, 2, 3, 4, 3, 2],
    ('triplet', 2): [0, 1, 2, 3, 2, 1],
}
SUBDIVISION = {'flow': 0.5, 'triplet': 1 / 3}


def wave(pos: int, n: int, pattern: list[int]) -> int:
    """The pattern's step for this slot, re-drawn for however many notes the voicing has (never one note twice)."""
    top = max(pattern)
    if n - 1 >= top:
        return pattern[pos % len(pattern)]
    if n <= 1:
        return 0
    if pos % len(pattern) == 0:
        return 0
    seq = list(range(1, n)) + list(range(n - 2, 1, -1))   # 1..n-1..2, bouncing
    return seq[(pos % len(pattern) - 1) % len(seq)]


class Builder:
    def __init__(self, piece: Piece):
        self.p = piece
        self.rng = random.Random(piece.seed)
        self.notes: list[tuple[float, int, float, float, str]] = []   # (beat, midi, velocity, beats, role)
        self.changes: list[float] = []                                 # harmony changes (pedal), beats
        self.tempo: list[tuple[float, float, float, float]] = []        # (beat0, beat1, factor0, factor1)
        self.levels: list[tuple[float, float, float, float]] = []

    # ── helpers ──
    def vel(self, level: float, role: str) -> float:
        base = 30 + 66 * max(0, min(1, level))
        offset = {'melody': 12, 'alto': 0, 'double': -6, 'bass': 2, 'inner': -8, 'top': -4, 'chord': -6, 'tenor': -3}[role]
        return max(8, min(120, base + offset + self.rng.gauss(0, 2.2)))

    def add(self, beat, midi, vel, beats, role):
        self.notes.append((beat, midi, vel, beats, role))

    # ── a pass of the tune at global beat `down` (its bar-1 downbeat) ──
    def play_pass(self, ps: Pass, down: float, window: tuple[float, float] | None = None, last: bool = False):
        tune, p = self.p.tune, self.p
        t0, t1 = window if window else (-tune.pickup, tune.length - tune.pickup)
        bb = tune.bar_beats
        tr = ps.transpose
        grain = 1.5 if tune.meter[1] == 8 else 1.0
        harmony = Harmony(tune, ps.chords, grain)
        mel_events = _note_window(tune.melody(), t0, t1)
        rh: list[tuple[float, float, int]] = []   # (start, end, midi) of right-hand notes, for the voicing cap

        def level_at(u):
            frac = (u - t0) / max(1e-6, t1 - t0)
            return ps.level + ps.swell * frac

        def phrase_shape(u):
            # Each phrase leans forward to two thirds, then relaxes.
            phrase = p.phrase_bars * bb
            x = ((u + tune.pickup) % phrase) / phrase
            return 0.07 * math.sin(math.pi * min(1, x / 0.75)) - (0.05 if x > 0.85 else 0)

        # Melody (and its doublings).
        if ps.melody not in ('none',):
            voices = {'satb': list(tune.voices.items())}.get(ps.melody, [(tune.melody_voice(), None)])
            for name, events in voices:
                if ps.melody == 'satb':
                    source = _note_window(events, t0, t1)
                    upper = name in ('S1V1', 'S1V2', 'S1', 'Soprano')
                    role = 'melody' if name in ('S1V1', 'S1', 'Soprano') else ('alto' if upper else 'tenor')
                    for e in source:
                        for midi in e.pitches:
                            mm = midi + tr
                            if name == 'S2V2' or (name == 'S2' and midi == min(e.pitches)):
                                role_b = 'bass'
                                self.add(down + e.start, mm, self.vel(level_at(e.start) + phrase_shape(e.start), role_b), e.dur * .98, 'L')
                                if mm - 12 >= 28 and e.dur >= 1:
                                    self.add(down + e.start, mm - 12, self.vel(level_at(e.start), 'inner'), e.dur * .98, 'L')
                                continue
                            v = self.vel(level_at(e.start) + phrase_shape(e.start), role if midi == max(e.pitches) or name != 'S1' else 'alto')
                            self.add(down + e.start, mm, v, e.dur * .98, 'R' if upper else 'L')
                            if upper:
                                rh.append((e.start, e.start + e.dur, mm))
                    continue
                for e in mel_events:
                    midi = e.pitches[0] + tr
                    lv = level_at(e.start) + phrase_shape(e.start) + (0.03 if abs((e.start + tune.pickup) % bb) < 1e-6 else 0)
                    if ps.melody == 'high':
                        midi += 12
                    v = self.vel(lv, 'melody')
                    self.add(down + e.start, midi, v, e.dur * .97, 'M')
                    rh.append((e.start, e.start + e.dur, midi))
                    if ps.melody == 'octaves':
                        self.add(down + e.start, midi - 12, v - 14, e.dur * .97, 'R')
                        rh.append((e.start, e.start + e.dur, midi - 12))
                    if ps.melody in ('alto', 'thirds') and e.dur >= 0.74:
                        pcs, _ = harmony.at(e.start)
                        below = [m for m in range(midi - 9, midi - 2) if m % 12 in pcs]
                        if ps.melody == 'alto' and 'S1V2' in tune.voices:
                            alto = [a for a in tune.voices['S1V2'] if abs(a.start - e.start) < 1e-6]
                            below = [a.pitches[0] + tr for a in alto if 2 < midi - (a.pitches[0] + tr) <= 12] or below
                        if below:
                            h = max(below)
                            self.add(down + e.start, h, v - 12, e.dur * .97, 'R')
                            rh.append((e.start, e.start + e.dur, h))

        if ps.fills and ps.melody != 'satb':
            # While the tune rests on a long note, a soft answer drifts down from above it (chord tones only).
            for i, e in enumerate(mel_events):
                nxt = mel_events[i + 1].start if i + 1 < len(mel_events) else e.start + e.dur
                room_beats = min(e.dur, nxt - e.start)
                if room_beats < 1.49 or e.start + 0.5 >= t1:
                    continue
                pcs, _ = harmony.at(e.start)
                pcs = {(x + tr) % 12 for x in pcs}
                m0 = e.pitches[0] + tr + (12 if ps.melody == 'high' else 0)
                tones = sorted({m for m in range(m0 + 4, m0 + 17) if m % 12 in pcs}, reverse=True)[:4]
                if len(tones) < 2:
                    continue
                count = min(len(tones), int((room_beats - 0.5) / 0.5))
                for k in range(count):
                    at = e.start + 0.5 + k * 0.5
                    self.add(down + at, tones[k], self.vel(level_at(e.start) - .12 - .03 * k, 'chord'), 1.2, 'R')
                    rh.append((at, at + 1.2, tones[k]))

        if ps.texture == 'none' or ps.melody == 'satb':
            self._changes_from_harmony(harmony, down, t0, t1, grain)
            return

        # Accompaniment.
        sub = SUBDIVISION.get(ps.texture, 0.5)
        bar_slots = int(round(bb / sub))
        start = math.ceil((max(t0, 0 if t0 < 0 and window is None else t0) + 1e-6 - 1e-6) / sub) * sub
        if window is None and t0 < 0:
            start = 0.0  # the pickup is carried by the bar before (intro or the previous verse)
        end = t1 if not last else t1 + (bb - ((t1 + tune.pickup) % bb or bb)) % bb
        prev_bass = None
        last_bass_pc = -1
        current: tuple | None = None
        voiced: list[int] = []
        u = start
        slot = int(round((u % bb) / sub))
        pattern = PATTERNS.get((ps.texture, int(bb)), PATTERNS[('flow', 3)])
        while u < end - 1e-6:
            pcs, bass_pc = harmony.at(u)
            if bass_pc < 0:
                u += sub; slot += 1
                continue
            pcs = frozenset((pc + tr) % 12 for pc in pcs)
            bass_pc = (bass_pc + tr) % 12
            key = (pcs, bass_pc)
            changed = key != current
            if changed:
                # Look ahead over this harmony's whole span, so the voicing fits under every melody note in it.
                span_end = u + sub
                while span_end < min(end, u + 2 * bb) - 1e-6:
                    p2, b2 = harmony.at(span_end)
                    if (frozenset((x + tr) % 12 for x in p2), (b2 + tr) % 12) != key:
                        break
                    span_end += sub
                sounding_rh = [m for (a, b, m) in rh if a < span_end - 1e-6 and b > u + 1e-6]
                cap = (min(sounding_rh) if sounding_rh else (voiced[-1] + 3 if voiced else 64)) - 2
                voiced = voicing(pcs, bass_pc, prev_bass, cap, 5 if bb >= 4 else 4, self.p.bass_range)
                prev_bass = voiced[0]
                self.changes.append(down + u)
            current = key
            lv = level_at(u)
            pos = slot % bar_slots
            if ps.texture in ('flow', 'triplet'):
                idx = wave(pos, len(voiced), pattern)
                if changed and idx != 0 and (pos == 0 or bass_pc != last_bass_pc):
                    idx = 0
                idx = min(idx, len(voiced) - 1)
                role = 'bass' if idx == 0 else ('top' if idx == len(voiced) - 1 else 'inner')
                beats = sub * 2.5
                self.add(down + u, voiced[idx], self.vel(lv, role), beats, 'L')
                if idx == 0 and pos == 0 and lv > 0.62 and voiced[0] - 12 >= 26:
                    self.add(down + u, voiced[0] - 12, self.vel(lv, 'inner'), beats, 'L')
            elif ps.texture == 'pad':
                if changed or pos == 0:
                    for i, m in enumerate(voiced):
                        self.add(down + u + i * 0.03, m, self.vel(lv, 'bass' if i == 0 else 'chord'), 4, 'L')
            elif ps.texture in ('stride', 'waltz'):
                beat_pos = (u % bb)
                on_beat = abs(beat_pos - round(beat_pos)) < 1e-6
                if on_beat:
                    b = int(round(beat_pos))
                    if b == 0 or (ps.texture == 'stride' and b == 2 and bb >= 4):
                        bass = voiced[0] if b == 0 else (voiced[1] - 12 if len(voiced) > 1 and voiced[1] - 12 >= 28 else voiced[0])
                        self.add(down + u, bass, self.vel(lv, 'bass'), 0.9, 'L')
                        if lv > .6 and bass - 12 >= 26:
                            self.add(down + u, bass - 12, self.vel(lv, 'inner'), 0.9, 'L')
                    else:
                        for m in voiced[1:4]:
                            self.add(down + u, m + (12 if m < 52 else 0), self.vel(lv - .08, 'chord'), 0.45, 'L')
            last_bass_pc = bass_pc
            u += sub; slot += 1

    def _changes_from_harmony(self, harmony, down, t0, t1, grain):
        current = None
        u = max(0.0, t0)
        while u < t1:
            key = harmony.at(u)
            if key != current:
                self.changes.append(down + u)
                current = key
            u += grain

    # ── the whole piece ──
    def build(self) -> 'Builder':
        p, tune = self.p, self.p.tune
        bb, L = tune.bar_beats, tune.length
        # Intro: the tune's last phrase, quietly, an octave up (or as the intro Pass says).
        g = 0.0
        if p.intro_bars:
            w1 = L - tune.pickup
            w0 = w1 - p.intro_bars * bb
            down = -w0
            self.play_pass(p.intro, down, window=(w0, w1))
            self.tempo.append((0, p.intro_bars * bb, p.intro.tempo, p.intro.tempo * .97))
            g = p.intro_bars * bb + tune.pickup  # the first verse's downbeat
        else:
            g = tune.pickup
        for i, ps in enumerate(p.passes):
            if ps.bridge:
                bridge = chord_line(ps.bridge, bb)
                bars = int(round((len(ps.bridge.split('|'))))) if '|' in ps.bridge else 1
                # The bridge harmony replaces the previous verse's held final chord, from that verse's last downbeat.
                for when, sym in bridge:
                    self._bridge_chord(sym, g + when, bb * bars - when if len(bridge) == 1 else bb, ps)
                g += bars * bb
            last = i == len(p.passes) - 1
            self.play_pass(ps, g, last=last)
            self.tempo.append((g - tune.pickup, g + L - tune.pickup, ps.tempo, ps.tempo))
            g += L
        self.end_beat = g - tune.pickup
        self._ending()
        return self

    def _bridge_chord(self, sym, beat, beats, ps: Pass):
        pcs, bass, _ = chord(sym)
        voiced = voicing(frozenset(pcs), bass, None, 64, 4, self.p.bass_range)
        self.changes.append(beat)
        sub = 0.5
        pattern = PATTERNS.get(('flow', int(self.p.tune.bar_beats)), PATTERNS[('flow', 3)])
        n = int(round(beats / sub))
        for i in range(n):
            idx = min(pattern[i % len(pattern)], len(voiced) - 1)
            self.add(beat + i * sub, voiced[idx], self.vel(ps.level - .08 + .1 * i / n, 'inner' if idx else 'bass'), sub * 2.5, 'L')

    def _ending(self):
        p, tune = self.p, self.p.tune
        last = p.passes[-1]
        bb = tune.bar_beats
        # The final bar's downbeat (where the last melody note falls).
        final_down = max(b for (b, m, v, d, r) in self.notes if r == 'M')
        final_down = round(final_down / bb) * bb if abs(final_down / bb - round(final_down / bb)) < .34 else final_down
        # Clear anything the texture put after the final downbeat; the ending replaces it.
        self.notes = [n for n in self.notes if not (n[0] > final_down + 1e-6 and n[4] == 'L')]
        mel = [n for n in self.notes if n[4] == 'M' and abs(n[0] - final_down) < 1e-6]
        top = mel[0][1] if mel else 72
        pcs, bass_pc, root = chord(p.final_chord) if p.final_chord else (None, None, None)
        if pcs is None:
            harmony = Harmony(tune, last.chords, 1.0)
            pcs_f, bass_f = harmony.at(tune.length - tune.pickup - 0.5)
            pcs = {(x + last.transpose) % 12 for x in pcs_f}
            bass_pc = (bass_f + last.transpose) % 12
        else:
            pcs = {(x + last.transpose) % 12 for x in pcs}
            bass_pc = (bass_pc + last.transpose) % 12
        self.notes = [n for n in self.notes if not (abs(n[0] - final_down) < 1e-6 and n[4] == 'L')]
        voiced = voicing(frozenset(pcs), bass_pc, None, top - 3, 5, (31, 43))
        lv = last.level + last.swell
        # A slow roll from the bottom, then a quiet chime of the home chord high up.
        for i, m in enumerate([voiced[0] - 12] + voiced if voiced[0] - 12 >= 24 else voiced):
            self.add(final_down + i * 0.18, m, self.vel(lv - .05, 'bass' if i == 0 else 'chord'), 8, 'L')
        self.changes.append(final_down)
        chime = sorted({m for m in range(top + 5, top + 20) if m % 12 in pcs})[:3]
        for i, m in enumerate(chime):
            self.add(final_down + 2.2 + i * 0.5, m, self.vel(lv - .2, 'chord'), 6, 'R')
        self.final_down = final_down
        # Ritardando into the last bar, and a held last chord.
        self.tempo.append((final_down - 2 * bb, final_down, 1.0, .72))
        self.tempo.append((final_down, final_down + 4 * bb, .7, .6))

    # ── beats to seconds, humanised ──
    def perform(self) -> Performance:
        p = self.p
        step = 1 / 96
        last_beat = max(n[0] + n[3] for n in self.notes) + 8
        grid = int(last_beat / step) + 2
        factor = [1.0] * grid
        for (b0, b1, f0, f1) in self.tempo:
            i0, i1 = int(max(0, b0) / step), int(min(last_beat, b1) / step)
            for i in range(i0, min(i1, grid)):
                x = (i - i0) / max(1, i1 - i0)
                factor[i] *= f0 + (f1 - f0) * x
        # Phrase breaths: each phrase's last beat eases a little.
        bb = p.tune.bar_beats
        phrase = p.phrase_bars * bb
        start_beat = (p.intro_bars * bb + p.tune.pickup) if p.intro_bars else p.tune.pickup
        k = start_beat + phrase
        while k < last_beat:
            for i in range(int((k - 1) / step), int(k / step)):
                if 0 <= i < grid:
                    factor[i] *= 0.9
            k += phrase
        times = [0.0]
        for i in range(grid):
            times.append(times[-1] + 60 / (p.bpm * factor[i]) * step)

        def at(beat: float) -> float:
            x = max(0.0, beat) / step
            i = int(x)
            return times[i] + (times[i + 1] - times[i]) * (x - i)

        perf = Performance()
        changes = sorted(set(self.changes))
        import bisect
        for (beat, midi, vel, beats, role) in self.notes:
            if role == 'L':
                i = bisect.bisect_right(changes, beat + 1e-6)
                if i < len(changes) and changes[i] < beat + beats:
                    beats = max(0.25, changes[i] - beat - 0.02)
            t = at(beat) + 0.35
            if role == 'M':
                t -= 0.012
            else:
                t += self.rng.gauss(0, 0.006)
            dur = at(beat + beats) - at(beat)
            perf.notes.append(Note(t=max(0.0, t), midi=midi, vel=vel, dur=dur))
        # Legato pedalling: up exactly at each change of harmony, down again just after.
        for c in sorted(set(round(c, 4) for c in self.changes)):
            t = at(c) + 0.35
            perf.pedal.append((t + 0.004, False))
            perf.pedal.append((t + 0.07, True))
        perf.pedal.sort()
        self.end_time = at(self.final_down) + 0.35 + p.final_hold
        return perf

