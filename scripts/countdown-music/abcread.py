"""
A small ABC reader for the public-domain hymn settings in tunes/ (Open Hymnal Project, ABC Plus files).

Only what those files use: K/M/L headers, [V: name] voice lines (several per voice, concatenated), notes with
accidentals, octave marks and lengths, [chords], rests (z, x), ties (-) and bar lines. Decorations (!..!), slurs and
staccato dots are ignored. Times are in quarter-note beats, with bar 1's downbeat at 0 (a pickup is negative).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from fractions import Fraction

LETTER = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
SHARPS = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
FLATS = ['B', 'E', 'A', 'D', 'G', 'C', 'F']
MAJOR_KEYS = {'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5}
MINOR_KEYS = {'Am': 0, 'Em': 1, 'Bm': 2, 'F#m': 3, 'Dm': -1, 'Gm': -2, 'Cm': -3}


def key_signature(key: str) -> dict[str, int]:
    key = key.strip().split()[0]
    count = MAJOR_KEYS.get(key, MINOR_KEYS.get(key))
    if count is None:
        raise ValueError(f'unknown key {key}')
    if count >= 0:
        return {l: 1 for l in SHARPS[:count]}
    return {l: -1 for l in FLATS[:-count]}


@dataclass
class Event:
    start: float
    dur: float
    pitches: list[int]


@dataclass
class Tune:
    title: str
    credit: str
    meter: tuple[int, int]
    key: str
    voices: dict[str, list[Event]] = field(default_factory=dict)
    pickup: float = 0.0
    bars: int = 0

    @property
    def bar_beats(self) -> float:
        n, d = self.meter
        return n * 4 / d

    @property
    def length(self) -> float:
        return self.bars * self.bar_beats

    def melody_voice(self) -> str:
        return 'S1V1' if 'S1V1' in self.voices else ('Soprano' if 'Soprano' in self.voices else 'S1')

    def melody(self) -> list[Event]:
        """The tune itself: the top note of the melody voice (chords in single-staff settings keep the top note)."""
        return [Event(e.start, e.dur, [max(e.pitches)]) for e in self.voices[self.melody_voice()] if e.pitches]

    def sounding(self, t: float, eps: float = 1e-6) -> list[int]:
        notes = []
        for events in self.voices.values():
            for e in events:
                if e.start - eps <= t < e.start + e.dur - eps and e.pitches:
                    notes.extend(e.pitches)
        return sorted(set(notes))


TOKEN = re.compile(r"""
    (?P<bar>\|\]|\|\||:\||\|:|\|)
  | (?P<chord>\[(?P<inner>[^\]]+)\](?P<cdur>[0-9]*/*[0-9]*))
  | (?P<note>(?P<acc>\^\^|\^|__|_|=)?(?P<letter>[A-Ga-g])(?P<oct>[,']*)(?P<dur>[0-9]*/*[0-9]*)(?P<tie>-)?)
  | (?P<rest>[zx](?P<rdur>[0-9]*/*[0-9]*))
""", re.VERBOSE)
INNER = re.compile(r"(?P<acc>\^\^|\^|__|_|=)?(?P<letter>[A-Ga-g])(?P<oct>[,']*)(?P<dur>[0-9]*/*[0-9]*)(?P<tie>-)?")


def length(text: str) -> Fraction:
    if not text:
        return Fraction(1)
    m = re.fullmatch(r'([0-9]*)(/*)([0-9]*)', text)
    num = Fraction(int(m.group(1))) if m.group(1) else Fraction(1)
    slashes, den = m.group(2), m.group(3)
    if slashes:
        if den:
            num /= int(den) * (2 ** (len(slashes) - 1))
        else:
            num /= 2 ** len(slashes)
    return num


def parse(path: str) -> Tune:
    text = open(path, encoding='utf-8').read()
    header = {}
    lines: dict[str, list[str]] = {}
    order: list[str] = []
    for raw in text.splitlines():
        line = raw.split('%')[0].rstrip()
        if not line:
            continue
        m = re.match(r'^([A-Za-z]):\s*(.*)$', line)
        if m and not line.startswith('[V'):
            header.setdefault(m.group(1), []).append(m.group(2))
            continue
        m = re.match(r'^\[V:\s*([^\]\s]+)\s*\](.*)$', line)
        if m:
            name, body = m.group(1), m.group(2)
            if name not in lines:
                lines[name] = []
                order.append(name)
            lines[name].append(body)
    meter = tuple(int(x) for x in header['M'][0].split('/'))
    unit = Fraction(*map(int, header.get('L', ['1/4'])[0].split('/'))) * 4  # in quarter beats
    key = header['K'][0]
    signature = key_signature(key)
    tune = Tune(title=header.get('T', ['?'])[0], credit=' '.join(header.get('C', [])), meter=meter, key=key)
    bar_len = Fraction(meter[0] * 4, meter[1])
    pickups = []
    for name in order:
        body = ' '.join(lines[name])
        body = re.sub(r'\[[A-Z]:[^\]]*\]', ' ', body)      # inline fields
        body = re.sub(r'![^!]*!', ' ', body)               # decorations
        body = body.replace('(', ' ').replace(')', ' ').replace('.', ' ')
        t = Fraction(0)
        events: list[Event] = []
        accidentals: dict[tuple[str, int], int] = {}
        tie_open: dict[int, Event] = {}
        first_bar: Fraction | None = None

        def pitch(acc, letter, octs):
            upper = letter.upper()
            octave = 4 if letter.isupper() else 5
            octave += octs.count("'") - octs.count(',')
            if acc:
                shift = {'^': 1, '^^': 2, '_': -1, '__': -2, '=': 0}[acc]
                accidentals[(upper, octave)] = shift
            shift = accidentals.get((upper, octave), signature.get(upper, 0))
            return 12 * (octave + 1) + LETTER[upper] + shift

        def add(pitches_ties, dur):
            nonlocal t
            new_pitches = []
            for p, tie in pitches_ties:
                held = tie_open.pop(p, None)
                if held is not None and abs(held.start + held.dur - float(t)) < 1e-6:
                    held.dur += float(dur)
                    if tie:
                        tie_open[p] = held
                    continue
                new_pitches.append((p, tie))
            if new_pitches:
                ev = Event(float(t), float(dur), [p for p, _ in new_pitches])
                events.append(ev)
                for p, tie in new_pitches:
                    if tie:
                        tie_open[p] = Event(ev.start, ev.dur, [p])
                        # keep a link so later ties extend the real event
                        tie_open[p] = ev if len(ev.pitches) == 1 else _split_for_tie(events, ev, p)
            t += dur

        for m in TOKEN.finditer(body):
            if m.group('bar'):
                accidentals.clear()
                if first_bar is None:
                    first_bar = t
                continue
            if m.group('chord'):
                inner = list(INNER.finditer(m.group('inner')))
                outer = length(m.group('cdur'))
                notes = [(pitch(n.group('acc'), n.group('letter'), n.group('oct')), bool(n.group('tie'))) for n in inner]
                dur = length(inner[0].group('dur')) * outer * unit
                add(notes, dur)
            elif m.group('note'):
                p = pitch(m.group('acc'), m.group('letter'), m.group('oct'))
                add([(p, bool(m.group('tie')))], length(m.group('dur')) * unit)
            elif m.group('rest'):
                t += length(m.group('rdur')) * unit
        pickup = first_bar if first_bar is not None and first_bar < bar_len else Fraction(0)
        pickups.append(pickup)
        tune.voices[name] = events
        tune.bars = max(tune.bars, int(round(float((t - pickup) / bar_len))))
    tune.pickup = float(max(pickups))
    for events in tune.voices.values():
        for e in events:
            e.start -= tune.pickup
    return tune


def _split_for_tie(events: list[Event], ev: Event, p: int) -> Event:
    """A tied note inside a chord becomes its own event, so extending it doesn't lengthen the whole chord."""
    ev.pitches.remove(p)
    single = Event(ev.start, ev.dur, [p])
    events.append(single)
    return single
