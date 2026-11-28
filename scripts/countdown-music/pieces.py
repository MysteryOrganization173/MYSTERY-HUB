"""
The Mystery Countdown piano arrangements (3.7 final). Melodies and harmonies: public-domain settings from the Open
Hymnal Project (tunes/*.abc). Arrangements: written for Mystery Hub in this file.
"""
from __future__ import annotations

import os

from abcread import parse
from arrange import Pass, Piece

HERE = os.path.dirname(os.path.abspath(__file__))


def tune(name: str):
    return parse(os.path.join(HERE, 'tunes', f'{name}.abc'))


AULD_LANG_SYNE_MELODY = os.path.join(HERE, 'tunes', 'auld-lang-syne.abc')
# Harmony written for these arrangements (the tune is traditional; no hymnal setting is used).
ALS_CHORDS = ('F | Gm7:2 C7:2 | F:2 F7:2 | Bb | F:2 Dm:2 | Gm7:2 C7:2 | Dm:2 Gm7:1 C7:1 | F:3 Dm:1 | '
              'F:2 F/A:2 | Gm7:2 C7:2 | F:2 Am:2 | Bb | F/C:2 Dm:2 | Gm7:2 C7:2 | Dm:2 Gm7:1 C7:1 | F')


def pieces() -> dict[str, Piece]:
    return {
        'silent-night': Piece(
            tune=tune('silent-night'), bpm=64, seed=11,
            intro=Pass(melody='high', texture='flow', level=.24, tempo=.95),
            passes=[
                Pass(melody='plain', texture='flow', level=.34),
                Pass(melody='alto', texture='flow', level=.46, swell=.06),
                Pass(melody='octaves', texture='flow', level=.56, transpose=2, bridge='G7sus4:1.5 G7:1.5', swell=-.08),
                Pass(melody='high', texture='flow', level=.3, transpose=2, swell=-.06),
            ], final_chord='Bbadd9'),
        'first-noel': Piece(
            tune=tune('first-noel'), bpm=92, seed=12,
            intro=Pass(melody='high', texture='flow', level=.26, tempo=.95), intro_bars=4,
            passes=[
                Pass(melody='plain', texture='flow', level=.38),
                Pass(melody='satb', texture='none', level=.44),
                Pass(melody='octaves', texture='flow', level=.55, swell=-.1),
            ], final_chord='Dadd9'),
        'away-in-a-manger': Piece(
            tune=tune('away-in-a-manger'), bpm=84, seed=13,
            intro=Pass(melody='high', texture='flow', level=.24, tempo=.94),
            passes=[
                Pass(melody='plain', texture='flow', level=.32),
                Pass(melody='thirds', texture='flow', level=.42),
                Pass(melody='high', texture='flow', level=.3, transpose=2, bridge='D7sus4:1.5 D7:1.5'),
            ], final_chord='Gadd9'),
        'what-child': Piece(
            tune=tune('what-child'), bpm=76, seed=14, bass_range=(33, 50),
            intro=Pass(melody='high', texture='flow', level=.24, tempo=.95),
            passes=[
                Pass(melody='plain', texture='flow', level=.34),
                Pass(melody='alto', texture='flow', level=.46),
                Pass(melody='octaves', texture='flow', level=.52, swell=-.12),
            ], final_chord='Em'),
        'bleak-midwinter': Piece(
            tune=tune('bleak-midwinter'), bpm=62, seed=15,
            intro=Pass(melody='high', texture='triplet', level=.22, tempo=.95),
            passes=[
                Pass(melody='plain', texture='triplet', level=.32),
                Pass(melody='satb', texture='none', level=.38),
                Pass(melody='high', texture='triplet', level=.3, swell=-.06),
            ], final_chord='Fadd9'),
        'o-come-all-ye-faithful': Piece(
            tune=tune('o-come-all-ye-faithful'), bpm=84, seed=16,
            intro=Pass(melody='high', texture='flow', level=.28, tempo=.95),
            passes=[
                Pass(melody='plain', texture='flow', level=.4),
                Pass(melody='satb', texture='none', level=.5),
                Pass(melody='octaves', texture='flow', level=.62, transpose=2, bridge='E7sus4:2 E7:2', swell=-.06),
            ], final_chord='Aadd9'),
        'angels-we-have-heard': Piece(
            tune=tune('angels'), bpm=96, seed=17,
            intro=Pass(melody='high', texture='flow', level=.28, tempo=.95),
            passes=[
                Pass(melody='plain', texture='flow', level=.42),
                Pass(melody='octaves', texture='flow', level=.56, swell=-.08),
            ], final_chord='Fadd9'),
        'hark-the-herald': Piece(
            tune=tune('hark'), bpm=88, seed=18,
            intro=Pass(melody='high', texture='flow', level=.3, tempo=.95),
            passes=[
                Pass(melody='plain', texture='flow', level=.44),
                Pass(melody='satb', texture='none', level=.52),
                Pass(melody='octaves', texture='flow', level=.6, transpose=2, bridge='D7sus4:2 D7:2', swell=-.1),
            ], final_chord='Gadd9'),
        'joy-to-the-world': Piece(
            tune=tune('joy-to-the-world'), bpm=88, seed=19, phrase_bars=4,
            intro=Pass(melody='high', texture='flow', level=.3, tempo=.95), intro_bars=4,
            passes=[
                Pass(melody='plain', texture='flow', level=.42),
                Pass(melody='thirds', texture='flow', level=.5, fills=True),
                Pass(melody='satb', texture='none', level=.54),
                Pass(melody='octaves', texture='flow', level=.62, transpose=1, bridge='Bb7:2', swell=-.1),
            ], final_chord='Ebadd9'),
        'auld-lang-syne': Piece(
            tune=parse(AULD_LANG_SYNE_MELODY), bpm=66, seed=20,
            intro=Pass(melody='high', texture='flow', level=.24, tempo=.95, chords=ALS_CHORDS),
            passes=[
                Pass(melody='plain', texture='flow', level=.34, chords=ALS_CHORDS),
                Pass(melody='thirds', texture='flow', level=.46, chords=ALS_CHORDS, swell=.05),
                Pass(melody='high', texture='flow', level=.3, chords=ALS_CHORDS, swell=-.06),
            ], final_chord='Fadd9'),
        'ode-to-joy': Piece(
            tune=tune('ode-to-joy'), bpm=92, seed=21,
            intro=Pass(melody='high', texture='flow', level=.3, tempo=.95),
            passes=[
                Pass(melody='plain', texture='flow', level=.44),
                Pass(melody='satb', texture='none', level=.52),
                Pass(melody='octaves', texture='flow', level=.6, transpose=2, bridge='E7sus4:2 E7:2', swell=-.1),
            ], final_chord='Aadd9'),
    }
