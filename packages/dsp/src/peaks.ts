import { bpmFromHz, HR_BAND_HZ } from "./constants.js";
import { mean, std } from "./stats.js";

export interface PeakDetectionResult {
  peakIndices: number[];
  /** Beat occurrence times, seconds, relative to the start of the input signal. */
  peakTimes: number[];
  /** Inter-beat intervals, ms — already filtered to a physiologically plausible range. */
  ibisMs: number[];
  /** Timestamp (seconds) of the second beat in each retained interval — parallel to `ibisMs`. */
  ibiTimes: number[];
}

export interface PeakDetectionOptions {
  minBpm?: number;
  maxBpm?: number;
  /** Threshold above the mean, in standard deviations. Default 0.5 — a moderate, adaptive gate. */
  thresholdStd?: number;
}

/**
 * Simple adaptive-threshold local-maxima peak detector on the filtered pulse waveform, with a
 * minimum-distance constraint derived from the plausible HR range. This is intentionally a
 * first-pass detector (HeartPy-style but without its iterative threshold optimization) — see
 * ARCHITECTURE.md §4.1 step 7 for the documented follow-up.
 */
export function detectPeaks(
  signal: ArrayLike<number>,
  fs: number,
  opts: PeakDetectionOptions = {},
): PeakDetectionResult {
  const minBpm = opts.minBpm ?? bpmFromHz(HR_BAND_HZ.low);
  const maxBpm = opts.maxBpm ?? bpmFromHz(HR_BAND_HZ.high);
  const minDistanceSamples = Math.max(1, Math.round((fs * 60) / maxBpm));

  const arr = Array.from(signal);
  const threshold = mean(arr) + (opts.thresholdStd ?? 0.5) * std(arr);

  const candidates: number[] = [];
  for (let i = 1; i < arr.length - 1; i++) {
    if (arr[i]! > threshold && arr[i]! > arr[i - 1]! && arr[i]! >= arr[i + 1]!) {
      candidates.push(i);
    }
  }

  const peakIndices: number[] = [];
  for (const idx of candidates) {
    const prev = peakIndices[peakIndices.length - 1];
    if (prev === undefined || idx - prev >= minDistanceSamples) {
      peakIndices.push(idx);
    } else if (arr[idx]! > arr[prev]!) {
      peakIndices[peakIndices.length - 1] = idx; // keep the larger of two too-close peaks
    }
  }

  const peakTimes = peakIndices.map((i) => i / fs);
  const minIbiMs = 60000 / maxBpm;
  const maxIbiMs = 60000 / minBpm;

  const ibisMs: number[] = [];
  const ibiTimes: number[] = [];
  for (let i = 1; i < peakTimes.length; i++) {
    const ibi = (peakTimes[i]! - peakTimes[i - 1]!) * 1000;
    if (ibi >= minIbiMs && ibi <= maxIbiMs) {
      ibisMs.push(ibi);
      ibiTimes.push(peakTimes[i]!);
    }
  }

  return { peakIndices, peakTimes, ibisMs, ibiTimes };
}
