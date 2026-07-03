import { mean } from "@halo-pulse/dsp";
import type { Session } from "@halo-pulse/types";

/**
 * Below this many labelled (self-reported) sessions, a correlation figure is too noisy to be
 * worth showing — PLAN.md §6 "always framed... with visible uncertainty," so this returns null
 * rather than a headline number built on 2-3 data points.
 */
const MIN_LABELLED_SESSIONS = 5;

export interface SelfReportInsight {
  sampleCount: number;
  /** Pearson r between the computed Stress Index and the user's own 0-10 rating (scaled to
   * 0-100). Null when there isn't enough labelled data yet, or all values are identical (no
   * variance to correlate). This is a transparency figure, not a trained/validated model — see
   * PLAN.md §10 Phase 3 notes on what full adaptive personalization would require. */
  correlation: number | null;
}

/** Pearson correlation coefficient between the app's computed index and the user's own ratings,
 * across every session the user chose to self-report on — a plain, honest "how well does this
 * match how you actually feel" figure. */
export function computeSelfReportCorrelation(sessions: Session[]): SelfReportInsight {
  const labelled = sessions.filter((s) => s.selfReport !== undefined);
  if (labelled.length < MIN_LABELLED_SESSIONS) {
    return { sampleCount: labelled.length, correlation: null };
  }

  const xs = labelled.map((s) => s.stressIndexMean);
  const ys = labelled.map((s) => (s.selfReport?.stressRating ?? 0) * 10); // 0-10 -> 0-100
  const xbar = mean(xs);
  const ybar = mean(ys);

  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = (xs[i] ?? 0) - xbar;
    const dy = (ys[i] ?? 0) - ybar;
    covariance += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }

  if (varianceX === 0 || varianceY === 0) {
    return { sampleCount: labelled.length, correlation: null };
  }

  return {
    sampleCount: labelled.length,
    correlation: covariance / Math.sqrt(varianceX * varianceY),
  };
}
