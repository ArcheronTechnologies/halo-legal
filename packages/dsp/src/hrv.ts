import type { HrvMetrics } from "@halo-pulse/types";
import { HF_BAND_HZ, LF_BAND_HZ, LF_HF_MIN_DURATION_SEC } from "./constants.js";
import { resampleSeries } from "./resample.js";
import { mean, std } from "./stats.js";
import { welchPsd } from "./welch.js";

const TACHOGRAM_RESAMPLE_HZ = 4;

function integrateBandPower(
  psd: Float64Array,
  freqs: Float64Array,
  band: { low: number; high: number },
): number {
  let power = 0;
  for (let k = 0; k < freqs.length; k++) {
    if (freqs[k]! >= band.low && freqs[k]! <= band.high) power += psd[k]!;
  }
  return power;
}

/**
 * LF/HF from the inter-beat-interval tachogram. Gated on `LF_HF_MIN_DURATION_SEC` of coverage —
 * PLAN.md §2.1 explains why this metric is de-emphasized: it needs minutes of clean data and its
 * physiological interpretation is itself contested (RESEARCH.md §C), so callers must treat a
 * non-null result as a hedged, tertiary signal, never a headline number.
 */
function computeLfHf(ibiTimes: number[], ibisMs: number[]): number | null {
  if (ibiTimes.length < 8) return null;
  const durationSec = ibiTimes[ibiTimes.length - 1]! - ibiTimes[0]!;
  if (durationSec < LF_HF_MIN_DURATION_SEC) return null;

  const tachogram = resampleSeries(ibiTimes, ibisMs, TACHOGRAM_RESAMPLE_HZ);
  if (tachogram.values.length < 16) return null;

  const { freqs, psd } = welchPsd(tachogram.values, TACHOGRAM_RESAMPLE_HZ, { nfft: 64 });
  const lfPower = integrateBandPower(psd, freqs, LF_BAND_HZ);
  const hfPower = integrateBandPower(psd, freqs, HF_BAND_HZ);
  if (hfPower < 1e-9) return null;
  return lfPower / hfPower;
}

/**
 * RMSSD (primary, valid from short windows) and SDNN (secondary, wants a longer window) from
 * inter-beat intervals — PLAN.md §2.1, VALIDATION.md §1. `ibiTimes` (seconds) must be parallel to
 * `ibisMs` (ms), as returned by `detectPeaks`.
 */
export function computeHrv(ibisMs: number[], ibiTimes: number[]): HrvMetrics {
  const n = ibisMs.length;
  if (n < 2) {
    return { rmssd: Number.NaN, sdnn: Number.NaN, lfhf: null, ibiCount: n };
  }

  const sdnn = std(ibisMs, 1); // sample stddev (n-1 denominator)

  let sumSqDiff = 0;
  for (let i = 1; i < n; i++) {
    const d = ibisMs[i]! - ibisMs[i - 1]!;
    sumSqDiff += d * d;
  }
  const rmssd = Math.sqrt(sumSqDiff / (n - 1));

  const lfhf = computeLfHf(ibiTimes, ibisMs);

  return { rmssd, sdnn, lfhf, ibiCount: n };
}

export function meanHr(ibisMs: number[]): number {
  if (ibisMs.length === 0) return Number.NaN;
  return 60000 / mean(ibisMs);
}
