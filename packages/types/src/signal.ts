/** Shared types for rPPG/HRV signal processing, used by packages/dsp, packages/vision, and apps/web. */

/** A single RGB-mean sample from one ROI at one presented video frame. */
export interface RoiSample {
  /** Presentation timestamp in seconds, from requestVideoFrameCallback's mediaTime. */
  t: number;
  r: number;
  g: number;
  b: number;
}

export type RoiName = "forehead" | "leftCheek" | "rightCheek";

/** Which rPPG combiner produced a given HR/HRV estimate. */
export type RppgMethod = "pos" | "chrom" | "omit" | "lgi";

/** Which signal layer(s) contributed to a reading — see ARCHITECTURE.md §5.3. */
export type SignalLayer = "classical" | "dl";

export interface HrvMetrics {
  /** Root mean square of successive differences (ms) — the primary, best-grounded metric. */
  rmssd: number;
  /** Standard deviation of NN intervals (ms) — secondary, needs a longer window. */
  sdnn: number;
  /**
   * Low-frequency/high-frequency ratio — hedged, tertiary, only computed when enough clean
   * inter-beat-interval data exists. See PLAN.md §2.1 for why this is de-emphasized.
   */
  lfhf: number | null;
  /** Number of clean inter-beat intervals the metrics above were computed from. */
  ibiCount: number;
}

export interface SignalQuality {
  /** 0 (unusable) .. 1 (excellent). Combines skewness + in-band SNR (see packages/dsp/sqi.ts). */
  sqi: number;
  snrDb: number;
  skewness: number;
}

export interface RppgWindowResult {
  method: RppgMethod;
  layer: SignalLayer;
  /** Window start/end, seconds, on the capture session's timeline. */
  windowStart: number;
  windowEnd: number;
  hrBpm: number;
  hrv: HrvMetrics | null;
  quality: SignalQuality;
}

/** A single per-frame behavioural (blendshape-derived) sample, ready for windowing. */
export interface BehaviouralSample {
  /** Presentation timestamp in seconds — same timeline as RoiSample.t. */
  t: number;
  browTension: number;
  lidTension: number;
  lipTension: number;
  blinking: boolean;
}

/** Behavioural (facial-tension) features for one window — always scored as deviation from baseline. */
export interface BehaviouralWindowResult {
  windowStart: number;
  windowEnd: number;
  browTension: number;
  lidTension: number;
  lipTension: number;
  blinkRateHz: number;
  /**
   * Variability of inter-blink intervals within the window, ms — a blink-rate analogue of HRV
   * (PLAN.md §2.2). `null` when fewer than 3 blinks occurred in the window.
   */
  blinkIntervalVariabilityMs: number | null;
  /**
   * Not yet computed (no head-pose extraction in Phase 1 — ARCHITECTURE.md §3 leaves the
   * transformation matrix off). Omitted, not defaulted to 0, so "not measured" is never confused
   * with "measured, found to be zero."
   */
  headStillnessDeviation?: number;
  sampleCount: number;
}
