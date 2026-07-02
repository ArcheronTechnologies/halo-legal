/** Plausible pulse band, ≈42–240 bpm — see PLAN.md §2.1 and VALIDATION.md §1. */
export const HR_BAND_HZ = { low: 0.7, high: 4.0 };

/** Standard HRV frequency bands (Hz), used only when ≥60s of clean IBI data exists — PLAN.md §2.1. */
export const LF_BAND_HZ = { low: 0.04, high: 0.15 };
export const HF_BAND_HZ = { low: 0.15, high: 0.4 };

/** LF/HF is only computed above this many seconds of inter-beat-interval coverage — VALIDATION.md §1. */
export const LF_HF_MIN_DURATION_SEC = 60;

export const DEFAULT_POS_WINDOW_SEC = 1.6;

export function bpmFromHz(hz: number): number {
  return hz * 60;
}

export function hzFromBpm(bpm: number): number {
  return bpm / 60;
}
