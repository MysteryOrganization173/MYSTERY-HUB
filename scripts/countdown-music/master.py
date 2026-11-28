"""Loudness, peaks and delivery encodes for the Countdown recordings."""
from __future__ import annotations

import json
import os
import subprocess

import numpy as np
import pyloudnorm
from scipy.signal import resample_poly

from piano import RATE

TARGET_LUFS = -16.0     # comfortable, consistent listening level for the playlist
CEILING_DBTP = -1.2     # true-peak ceiling after encoding headroom


def lufs(audio: np.ndarray) -> float:
    return float(pyloudnorm.Meter(RATE).integrated_loudness(audio))


def true_peak_db(audio: np.ndarray) -> float:
    over = resample_poly(audio, 4, 1, axis=0)
    return float(20 * np.log10(np.max(np.abs(over)) + 1e-12))


def limit(audio: np.ndarray, ceiling_db: float, lookahead: float = 0.004, release: float = 0.12) -> np.ndarray:
    """A transparent look-ahead peak limiter (only touches the loudest hammer strikes)."""
    return audio * limit_gain(audio, ceiling_db, lookahead, release)[:, None]


def limit_gain(audio: np.ndarray, ceiling_db: float, lookahead: float = 0.004, release: float = 0.12) -> np.ndarray:
    """The limiter's gain curve, so stems played together can share the gain of their sum."""
    ceiling = 10 ** (ceiling_db / 20)
    peak = np.max(np.abs(audio), axis=1)
    need = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    la = int(lookahead * RATE)
    # Look ahead: the gain is already down when the peak arrives.
    padded = np.concatenate([need[la:], np.ones(la)])
    gain = np.minimum(need, padded)
    from scipy.ndimage import minimum_filter1d
    gain = minimum_filter1d(gain, size=2 * la + 1)
    # Smooth release.
    coeff = np.exp(-1 / (release * RATE))
    out = np.empty_like(gain)
    g = 1.0
    for i in range(len(gain)):
        target = gain[i]
        g = target if target < g else target + (g - target) * coeff
        out[i] = g
    return out


def normalise(audio: np.ndarray, target: float = TARGET_LUFS, ceiling: float = CEILING_DBTP) -> tuple[np.ndarray, dict]:
    before = lufs(audio)
    gained = audio * 10 ** ((target - before) / 20)
    tp = true_peak_db(gained)
    limited = gained
    if tp > ceiling:
        limited = limit(gained, ceiling - 0.3)
        # Limiting lowers loudness a touch; correct it once (tiny), then re-check the peak.
        limited *= 10 ** ((target - lufs(limited)) / 20)
        if true_peak_db(limited) > ceiling:
            limited = limit(limited, ceiling - 0.4)
    report = {'lufs_in': round(before, 2), 'lufs': round(lufs(limited), 2), 'true_peak_db': round(true_peak_db(limited), 2),
              'gain_db': round(target - before, 2), 'limited': bool(tp > ceiling), 'peak_before_limit_db': round(tp, 2)}
    return limited, report


def encode(wav: str, base: str, fade_in: float = 0.0) -> dict:
    """Opus (WebM, 96k target: transparent for solo piano, about a quarter smaller than MP3) for browsers that play it,
    MP3 (LAME V2) for every other browser. Returns sizes and durations."""
    out = {}
    targets = {
        'webm': ['-c:a', 'libopus', '-b:a', '96k', '-vbr', 'on', '-compression_level', '10', '-application', 'audio'],
        'mp3': ['-c:a', 'libmp3lame', '-q:a', '2'],
    }
    for ext, args in targets.items():
        path = f'{base}.{ext}'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, *args, '-map_metadata', '-1', path], check=True)
        probe = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,bit_rate', '-of', 'json', path],
                                          capture_output=True, text=True, check=True).stdout)['format']
        out[ext] = {'bytes': os.path.getsize(path), 'duration': round(float(probe['duration']), 2), 'kbps': round(int(probe.get('bit_rate', 0)) / 1000)}
    return out
