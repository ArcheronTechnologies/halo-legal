"""Classical rPPG channel combiners — the Python reference for packages/dsp/src/combiners.ts.

Keep the algorithms here and in the TypeScript module in lockstep; this is the "reference oracle"
ARCHITECTURE.md §8 describes, and the eventual golden-vector parity tests (packages/dsp Vitest
suite, fed fixtures generated here) check the TS port against it.
"""

from __future__ import annotations

import numpy as np

DEFAULT_POS_WINDOW_SEC = 1.6


def normalize_by_mean(x: np.ndarray) -> np.ndarray:
    m = float(np.mean(x))
    denom = m if abs(m) > 1e-12 else 1e-12
    return x / denom


def chrom(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> np.ndarray:
    """CHROM (de Haan & Jeanne, 2013). See combiners.ts's `chrom()` docstring for the algorithm."""
    rn = normalize_by_mean(r) - 1
    gn = normalize_by_mean(g) - 1
    bn = normalize_by_mean(b) - 1

    xs = 3 * rn - 2 * gn
    ys = 1.5 * rn + gn - 1.5 * bn

    std_ys = float(np.std(ys))
    alpha = float(np.std(xs)) / (std_ys if std_ys != 0 else 1e-12)
    return xs - alpha * ys


def pos(r: np.ndarray, g: np.ndarray, b: np.ndarray, fs: float, window_sec: float = DEFAULT_POS_WINDOW_SEC) -> np.ndarray:
    """POS (Wang, den Brinker, Stuijk & de Haan, 2017). See combiners.ts's `pos()` docstring."""
    n = len(r)
    win_len = max(2, round(window_sec * fs))
    h = np.zeros(n)
    if n < win_len:
        return h

    for start in range(0, n - win_len + 1):
        end = start + win_len
        rn = normalize_by_mean(r[start:end])
        gn = normalize_by_mean(g[start:end])
        bn = normalize_by_mean(b[start:end])

        s1 = gn - bn
        s2 = -2 * rn + gn + bn

        std_s2 = float(np.std(s2))
        alpha = float(np.std(s1)) / (std_s2 if std_s2 != 0 else 1e-12)

        h_window = s1 + alpha * s2
        h_window = h_window - np.mean(h_window)
        h[start:end] += h_window

    return h


def omit(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> np.ndarray:
    """OMIT (Álvarez-Casado et al., 2023). See combiners.ts's `omit()` docstring — same caveat
    about fidelity to the reference implementation applies here."""
    rn = normalize_by_mean(r)
    gn = normalize_by_mean(g)
    bn = normalize_by_mean(b)

    s = 1 / np.sqrt(3)
    u = np.array([s, s, s])
    v = u - np.array([1.0, 0.0, 0.0])
    v_norm = float(np.linalg.norm(v))
    if v_norm > 1e-12:
        v = v / v_norm

    stacked = np.stack([rn, gn, bn], axis=0)  # (3, n)
    dot = v @ stacked  # (n,)
    c1 = gn - 2 * dot * v[1]
    c2 = bn - 2 * dot * v[2]

    std_c2 = float(np.std(c2))
    alpha = float(np.std(c1)) / (std_c2 if std_c2 != 0 else 1e-12)
    return c1 - alpha * c2
