"""Welch-PSD heart-rate estimation — the Python reference for packages/dsp/src/welch.ts.

Uses scipy.signal.welch directly, since Python has a trustworthy standard implementation (unlike
the browser, which has no equivalent built-in — see ARCHITECTURE.md §4.2 for why the TypeScript
side hand-rolls this on top of fft.js instead).
"""

from __future__ import annotations

import numpy as np
from scipy.signal import welch

HR_BAND_HZ = (0.7, 4.0)


def estimate_hr_bpm(signal: np.ndarray, fs: float, band: tuple[float, float] = HR_BAND_HZ) -> float:
    nperseg = min(len(signal), 512)
    freqs, psd = welch(signal, fs=fs, nperseg=nperseg)

    in_band = (freqs >= band[0]) & (freqs <= band[1])
    if not np.any(in_band):
        raise ValueError("estimate_hr_bpm: no representable bins in the requested band")

    band_psd = psd[in_band]
    peak_idx = int(np.argmax(band_psd))

    # parabolic interpolation across neighbouring bins, mirroring welch.ts's estimateHrFromPsd
    global_idx = np.where(in_band)[0][peak_idx]
    peak_freq = float(freqs[global_idx])
    if 0 < global_idx < len(freqs) - 1:
        y0, y1, y2 = psd[global_idx - 1], psd[global_idx], psd[global_idx + 1]
        denom = y0 - 2 * y1 + y2
        if abs(denom) > 1e-12:
            delta = 0.5 * (y0 - y2) / denom
            bin_hz = freqs[1] - freqs[0]
            peak_freq += delta * bin_hz

    return peak_freq * 60
