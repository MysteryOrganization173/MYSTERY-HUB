"""
Write docs/countdown-music/manifest.json: the rights and delivery record for every Countdown recording.

  python3 scripts/countdown-music/manifest.py [--music DIR] [--cues DIR]

Reads the arrangements (pieces.py), each tune's source note (tunes/*.abc), the render reports and the delivered files.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pieces import pieces  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OPEN_HYMNAL = 'https://openhymnal.org/'
OPEN_HYMNAL_FILE = 'https://openhymnal.org/OpenHymnal2026.11-abc.zip'
OPEN_HYMNAL_COPYING = 'https://openhymnal.org/copying.html'
SALAMANDER = 'https://archive.org/details/SalamanderGrandPianoV3'
SALAMANDER_ALT = 'https://github.com/sfzinstruments/SalamanderGrandPiano'
CC_BY_3 = 'https://creativecommons.org/licenses/by/3.0/'
PIANO = 'Salamander Grand Piano V3 (Yamaha C5, sampled by Alexander Holm), played by the Mystery Hub offline renderer'
ATTRIBUTION = 'Piano: Salamander Grand Piano V3 by Alexander Holm, licensed CC BY 3.0. Arranged and recorded for Mystery Hub.'

TUNE_FILE = {'angels-we-have-heard': 'angels', 'hark-the-herald': 'hark'}
ORDER = ['silent-night', 'first-noel', 'away-in-a-manger', 'what-child', 'bleak-midwinter', 'o-come-all-ye-faithful',
         'angels-we-have-heard', 'hark-the-herald', 'joy-to-the-world', 'auld-lang-syne', 'ode-to-joy']
TITLES = {'silent-night': 'Silent Night', 'first-noel': 'The First Noel', 'away-in-a-manger': 'Away in a Manger',
          'what-child': 'What Child Is This?', 'bleak-midwinter': 'In the Bleak Midwinter',
          'o-come-all-ye-faithful': 'O Come, All Ye Faithful', 'angels-we-have-heard': 'Angels We Have Heard on High',
          'hark-the-herald': 'Hark! The Herald Angels Sing', 'joy-to-the-world': 'Joy to the World',
          'auld-lang-syne': 'Auld Lang Syne', 'ode-to-joy': 'Ode to Joy'}
COMPOSER = {'silent-night': 'Franz Xaver Gruber (1787-1863)', 'first-noel': 'Traditional English carol',
            'away-in-a-manger': 'James R. Murray (1841-1905)', 'what-child': 'Greensleeves, English traditional (16th century)',
            'bleak-midwinter': 'Gustav Holst (1874-1934)', 'o-come-all-ye-faithful': 'John Francis Wade (1711-1786)',
            'angels-we-have-heard': 'Traditional French carol (Gloria)',
            'hark-the-herald': 'Felix Mendelssohn (1809-1847), adapted by William H. Cummings (1831-1915)',
            'joy-to-the-world': 'After G. F. Handel, arranged by Lowell Mason (1792-1872)',
            'auld-lang-syne': 'Traditional Scottish melody', 'ode-to-joy': 'Ludwig van Beethoven (1770-1827), adapted by Edward Hodges (1796-1867)'}


def duration(path: str) -> float:
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                         capture_output=True, text=True, check=True).stdout
    return round(float(out.strip()), 2)


def files(directory: str, name: str) -> dict:
    out = {}
    for fmt, codec in (('webm', 'Opus in WebM, 96 kbps target, 48 kHz stereo'), ('mp3', 'MP3 VBR (LAME V2), 44.1 kHz stereo')):
        path = os.path.join(directory, f'{name}.{fmt}')
        out[fmt] = {'path': f'countdown-audio/v1/{name}.{fmt}', 'codec': codec, 'bytes': os.path.getsize(path), 'seconds': duration(path)}
    return out


def reports(path: str) -> dict:
    found = {}
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line:
                r = json.loads(line)
                found[r['name']] = r
    return found


def source_note(name: str) -> str:
    with open(os.path.join(HERE, 'tunes', f"{TUNE_FILE.get(name, name)}.abc")) as f:
        for line in f:
            if line.startswith('C:'):
                return line[2:].strip()
    return ''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--music', default='/home/claude/work/music')
    ap.add_argument('--cues', default='/home/claude/work/cues')
    a = ap.parse_args()
    arrangements = pieces()
    rep = reports(os.path.join(a.music, 'report.json'))
    tracks = []
    for name in ORDER:
        piece = arrangements[name]
        own_harmony = any(p.chords for p in [piece.intro, *piece.passes] if p)
        uses_setting_voices = any(p.melody in ('satb', 'alto') for p in [piece.intro, *piece.passes] if p)
        note = source_note(name)
        r = rep.get(name, {})
        if name == 'auld-lang-syne':
            harmony = 'Written for Mystery Hub (the melody is traditional; no published harmony is used).'
            source = 'Melody transcribed from the traditional tune as published with Robert Burns\'s words (1799).'
        elif own_harmony:
            harmony = ('Written for Mystery Hub. The hymnal harmony (Edward S. Barnes, 1887-1958) is not used: it is still '
                       'protected where copyright lasts for the author\'s life plus 70 years, Ghana included, until the end of 2028.')
            source = f'Melody only, from the Open Hymnal Project ABC edition 2026.11 ({note})'
        else:
            harmony = 'From the public-domain hymnal setting' + (' (its inner voices are heard in one verse)' if uses_setting_voices else ' (as chords, re-voiced for piano)') + '.'
            source = f'Open Hymnal Project ABC edition 2026.11 ({note})'
        tracks.append({
            'id': name,
            'title': TITLES[name],
            'composer': COMPOSER[name],
            'source': source,
            'sourceUrl': OPEN_HYMNAL_FILE if name != 'auld-lang-syne' else None,
            'harmony': harmony,
            'arrangement': 'Original solo-piano arrangement written for Mystery Hub (intro, verse textures, voicings, dynamics, pedalling, ending): scripts/countdown-music/pieces.py and arrange.py.',
            'performer': PIANO,
            'instrumentSource': SALAMANDER,
            'instrumentSourceMirror': SALAMANDER_ALT,
            'vocals': False,
            'licence': {
                'melodyAndSetting': 'Public domain (composition and setting published before 1929; every author named died more than 70 years ago, except the harmony noted above, which is not used).',
                'pianoSamples': 'CC BY 3.0 (attribution required; commercial use allowed)',
                'pianoSamplesLicenceUrl': CC_BY_3,
                'recording': 'Produced for Mystery Hub from the above; no third-party recording is used.',
                'openHymnalTerms': OPEN_HYMNAL_COPYING,
            },
            'attribution': ATTRIBUTION,
            'permittedUse': 'Streaming on mysterybundlehub.com (and any Mystery Hub surface) without a fee, worldwide, with the attribution shown in the player credits.',
            'modifications': 'Arranged for solo piano, transposed and re-voiced by verse, performed from samples, room reverb added, mastered to -16 LUFS integrated with a true-peak ceiling, encoded to Opus and MP3.',
            'loudness': {'integratedLufs': r.get('lufs'), 'truePeakDb': r.get('true_peak_db')},
            'files': files(a.music, name),
        })
    cues = []
    for name, what in (('final-minute', 'The final minute: a piano build from T-60 to midnight.'),
                       ('ticks', 'The final ten seconds: ten cues in 2-second slots, one per visible second.'),
                       ('midnight-fx', 'Midnight: impact, boom and golden fireworks (synthesised, with piano impact chord).'),
                       ('midnight-music', 'Midnight: the Auld Lang Syne chorus in festive octaves, then a calm final chord.')):
        cues.append({
            'id': name, 'description': what,
            'composer': 'Original for Mystery Hub (scripts/countdown-music/cues.py); Auld Lang Syne motif is traditional.',
            'performer': PIANO + '; impacts, risers and fireworks synthesised in cues.py (no samples).',
            'licence': {'composition': 'Original work for Mystery Hub; traditional melody in the public domain.', 'pianoSamples': 'CC BY 3.0', 'pianoSamplesLicenceUrl': CC_BY_3},
            'attribution': ATTRIBUTION,
            'permittedUse': 'As for the playlist.',
            'files': files(a.cues, name),
        })
    manifest = {
        'schema': 1,
        'release': 'Mystery Countdown 3.7 final',
        'generatedBy': 'scripts/countdown-music/manifest.py',
        'servedFrom': '/countdown-audio/v1/ (pending the founder\'s hosting choice)',
        'summary': {'tracks': len(tracks), 'vocals': False, 'thirdPartyRecordings': 0, 'licencesPurchased': 0},
        'tracks': tracks,
        'cues': cues,
    }
    out = os.path.join(ROOT, 'docs', 'countdown-music', 'manifest.json')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(out, len(tracks), 'tracks', len(cues), 'cues')


if __name__ == '__main__':
    main()
