"""Synthetic ROI RGB signal generation for testing — the Python counterpart of
packages/dsp/src/testUtils/synthetic.ts. Deliberately mirrors that module's model (pulse + optional
common-mode interference/drift + noise) so the two languages' test suites are checking the same
scenario, even though they don't yet share literal fixture files (ARCHITECTURE.md §8's
golden-vector parity testing is the natural next step to make that literal).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class Interference:
    hz: float
    amplitude: float
    phase: float = 0.0


def generate_synthetic_rgb(
    duration_sec: float,
    fps: float,
    pulse_hz: float,
    pulse_amplitude: tuple[float, float, float] = (0.008, 0.01, 0.006),
    interference: Interference | None = None,
    drift_hz: float | None = None,
    drift_amplitude: float | None = None,
    noise_amplitude: float = 0.001,
    seed: int = 42,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    n = int(duration_sec * fps)
    t = np.arange(n) / fps

    ar, ag, ab = pulse_amplitude
    pulse = np.sin(2 * np.pi * pulse_hz * t)

    common_mode = np.zeros(n)
    if interference is not None:
        common_mode += interference.amplitude * np.sin(2 * np.pi * interference.hz * t + interference.phase)
    if drift_hz is not None and drift_amplitude is not None:
        common_mode += drift_amplitude * np.sin(2 * np.pi * drift_hz * t)

    noise_r = noise_amplitude * rng.standard_normal(n)
    noise_g = noise_amplitude * rng.standard_normal(n)
    noise_b = noise_amplitude * rng.standard_normal(n)

    r0, g0, b0 = 150.0, 120.0, 100.0
    r = r0 * (1 + ar * pulse + common_mode + noise_r)
    g = g0 * (1 + ag * pulse + common_mode + noise_g)
    b = b0 * (1 + ab * pulse + common_mode + noise_b)
    return r, g, b
