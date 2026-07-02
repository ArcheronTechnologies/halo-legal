"""Mirrors packages/dsp/src/combiners.test.ts's scenarios in Python — independent, cross-language
confirmation that the algorithms are implemented consistently. See ARCHITECTURE.md §8.
"""

from __future__ import annotations

import numpy as np
import pytest

from rppg.combiners import chrom, omit, pos
from rppg.hr import estimate_hr_bpm
from rppg.synthetic import Interference, generate_synthetic_rgb

FS = 30.0


def recovered_bpm(signal: np.ndarray, fs: float = FS) -> float:
    return estimate_hr_bpm(signal, fs)


class TestCommonModeRejection:
    """POS and OMIT's projections are, by construction, exactly orthogonal to the (1,1,1)
    skin-tone/illumination direction, so a pure common-mode interferer (equal relative amplitude
    on R, G, B) should be nulled even when it is *larger* than the true pulsatile signal and sits
    *inside* the pass band."""

    pulse_hz = 1.2  # 72 bpm
    interference_hz = 1.8333  # 110 bpm, in-band, 5x the pulse amplitude

    def _samples(self) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        return generate_synthetic_rgb(
            duration_sec=20,
            fps=FS,
            pulse_hz=self.pulse_hz,
            pulse_amplitude=(0.008, 0.01, 0.006),
            interference=Interference(hz=self.interference_hz, amplitude=0.05),
            noise_amplitude=0.0008,
            seed=7,
        )

    def test_naive_green_channel_is_dominated_by_the_interferer(self) -> None:
        _, g, _ = self._samples()
        assert recovered_bpm(g) == pytest.approx(self.interference_hz * 60, abs=1.0)

    def test_pos_recovers_the_true_pulse_frequency(self) -> None:
        r, g, b = self._samples()
        combined = pos(r, g, b, FS)
        assert recovered_bpm(combined) == pytest.approx(self.pulse_hz * 60, abs=1.0)

    def test_omit_recovers_the_true_pulse_frequency(self) -> None:
        r, g, b = self._samples()
        combined = omit(r, g, b)
        assert recovered_bpm(combined) == pytest.approx(self.pulse_hz * 60, abs=1.0)


class TestChromUnderRealisticConditions:
    def test_recovers_true_pulse_frequency_under_modest_drift(self) -> None:
        pulse_hz = 1.2
        r, g, b = generate_synthetic_rgb(
            duration_sec=20,
            fps=FS,
            pulse_hz=pulse_hz,
            pulse_amplitude=(0.008, 0.01, 0.006),
            drift_hz=0.05,
            drift_amplitude=0.02,
            noise_amplitude=0.0008,
            seed=11,
        )
        combined = chrom(r, g, b)
        assert recovered_bpm(combined) == pytest.approx(pulse_hz * 60, abs=1.0)
