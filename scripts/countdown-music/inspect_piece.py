"""Development aid: print a piece's notes by bar, and flag harsh clashes against the melody."""
import sys
from arrange import Builder, chord
from pieces import pieces
N = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
nm = lambda p: f"{N[p % 12]}{p // 12 - 1}"

def clashes(b):
    import bisect
    changes = sorted(set(b.changes))
    def cut(n):
        beat, midi, vel, dur, role = n
        i = bisect.bisect_right(changes, beat + 1e-6)
        if role == 'L' and i < len(changes) and changes[i] < beat + dur:
            dur = changes[i] - beat
        return (beat, midi, vel, dur, role)
    mel = sorted([n for n in b.notes if n[4] == 'M'])
    acc = [cut(n) for n in b.notes if n[4] != 'M']
    out = []
    for (beat, midi, vel, dur, role) in mel:
        for (b2, m2, v2, d2, r2) in acc:
            # accompaniment notes struck while this melody note is held (pedal blur aside)
            if (beat - 1e-6 <= b2 < beat + dur - 1e-6 or b2 - 1e-6 <= beat < b2 + d2 - 1e-6) and dur >= 0.5:
                iv = (midi - m2) % 12
                if iv in (1, 11) and abs(midi - m2) < 24:
                    out.append((round(beat, 2), nm(midi), nm(m2), round(b2, 2)))
    return out

if __name__ == '__main__':
    name = sys.argv[1]
    bars = [int(x) for x in sys.argv[2:4]] if len(sys.argv) > 2 else [0, 6]
    p = pieces()[name]
    b = Builder(p).build()
    bb = p.tune.bar_beats
    origin = p.tune.pickup if p.intro_bars else 0
    notes = sorted(b.notes)
    for k in range(*bars):
        lo, hi = origin + k * bb, origin + (k + 1) * bb
        row = [n for n in notes if lo - 1e-6 <= n[0] < hi - 1e-6]
        mel = ' '.join(f"{nm(n[1])}@{n[0]-lo:.2f}" for n in row if n[4] == 'M')
        rh = ' '.join(f"{nm(n[1])}@{n[0]-lo:.2f}" for n in row if n[4] == 'R')
        lh = ' '.join(f"{nm(n[1])}" for n in row if n[4] == 'L')
        print(f"bar {k:3d} | M {mel}\n        | R {rh}\n        | L {lh}")
    c = clashes(b)
    print('clashes', len(c), c[:30])
