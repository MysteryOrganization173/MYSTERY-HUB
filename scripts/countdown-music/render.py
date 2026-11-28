"""
Render the Countdown piano recordings.

  python3 scripts/countdown-music/render.py [name ...] --out DIR

Needs the Salamander Grand Piano V3 samples (npm @audio-samples/piano-velocity1..16 and piano-release, unpacked into
$SALAMANDER_DIR/v1..v16 and $SALAMANDER_DIR/rel), numpy, scipy, soundfile, pyloudnorm and ffmpeg.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np  # noqa: E402

from arrange import Builder  # noqa: E402
from master import encode, normalise  # noqa: E402
from piano import RATE, render, room, trim_silence, write  # noqa: E402
from pieces import pieces  # noqa: E402


def render_piece(name: str, out: str) -> dict:
    piece = pieces()[name]
    builder = Builder(piece).build()
    perf = builder.perform()
    t = time.time()
    dry = render(perf, length=builder.end_time + 4)
    wet = room(dry)
    end = int((builder.end_time + 3.2) * RATE)
    wet = trim_silence(wet[:end], keep_tail=1.2)
    mastered, report = normalise(wet)
    wav = os.path.join(out, 'wav', f'{name}.wav')
    write(wav, mastered)
    sizes = encode(wav, os.path.join(out, name))
    report.update({'name': name, 'seconds': round(len(mastered) / RATE, 2), 'notes': len(perf.notes),
                   'render_s': round(time.time() - t, 1), 'files': sizes})
    return report


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('names', nargs='*')
    ap.add_argument('--out', default='/home/claude/work/music')
    args = ap.parse_args()
    names = args.names or list(pieces())
    os.makedirs(args.out, exist_ok=True)
    results = []
    for n in names:
        r = render_piece(n, args.out)
        print(json.dumps(r))
        results.append(r)
    with open(os.path.join(args.out, 'report.json'), 'a') as f:
        for r in results:
            f.write(json.dumps(r) + '\n')
