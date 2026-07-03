import type { SignalQuality } from "@halo-pulse/types";
import { HR_BAND_HZ } from "./constants.js";
import { clamp01, skewness } from "./stats.js";
import type { WelchResult } from "./welch.js";

/**
 * In-band vs out-of-band spectral power ratio, in dB — the standard rPPG SQI approach
 * (ARCHITECTURE.md §4.1 step 9, RESEARCH.md §B).
 */
export function inBandSnrDb(result: WelchResult, band = HR_BAND_HZ): number {
  let inBand = 0;
  let total = 0;
  for (let k = 0; k < result.freqs.length; k++) {
    const p = result.psd[k]!;
    total += p;
    if (result.freqs[k]! >= band.low && result.freqs[k]! <= band.high) inBand += p;
  }
  const outBand = Math.max(total - inBand, 1e-12);
  const ratio = Math.max(inBand / outBand, 1e-12);
  return 10 * Math.log10(ratio);
}

/**
 * Combines skewness (Elgendi's single best-performing PPG quality index — RESEARCH.md §B) and
 * in-band SNR into a 0-1 score. The mapping below is a deliberately simple, documented heuristic
 * calibrated for plausible ranges (SNR from about -5dB to +15dB, |skewness| capped at 2) — it is
 * a starting point to be tuned empirically against the VALIDATION.md §5 study, not a precise
 * scientific formula.
 */
export function computeSqi(
  filteredSignal: ArrayLike<number>,
  psdResult: WelchResult,
  band = HR_BAND_HZ,
): SignalQuality {
  const snrDb = inBandSnrDb(psdResult, band);
  const skew = skewness(filteredSignal as number[]);

  const snrScore = clamp01((snrDb + 5) / 20);
  const skewScore = clamp01(Math.abs(skew) / 2);
  const sqi = clamp01(0.7 * snrScore + 0.3 * skewScore);

  return { sqi, snrDb, skewness: skew };
}
