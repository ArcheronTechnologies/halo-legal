import type { Baseline } from "@halo-pulse/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysSinceCapture(capturedAt: number, now: number): number {
  return (now - capturedAt) / MS_PER_DAY;
}

/**
 * PLAN.md §11 "open: best default calibration length & re-cal cadence" — until that's settled
 * empirically, a baseline older than this many days is flagged for a gentle re-calibration
 * suggestion (a genuine physiological baseline does drift over weeks/months). `now` is injected
 * rather than read from Date.now() so this stays pure and testable.
 */
const DEFAULT_STALE_THRESHOLD_DAYS = 30;

export function shouldSuggestRecalibration(
  baseline: Pick<Baseline, "capturedAt">,
  now: number,
  thresholdDays = DEFAULT_STALE_THRESHOLD_DAYS,
): boolean {
  return daysSinceCapture(baseline.capturedAt, now) >= thresholdDays;
}
