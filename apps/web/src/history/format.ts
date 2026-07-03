import type { Session } from "@halo-pulse/types";
import type { SelfReportInsight } from "../personalization/selfReportInsight.js";
import type { TrendResult } from "./trend.js";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Deterministic "YYYY-MM-DD HH:MM" formatting (local time) — deliberately not Intl-locale-based
 * so it's identical across environments/tests, matching dayKeyFor's local-day convention. */
export function formatSessionDate(timestampMs: number): string {
  const d = new Date(timestampMs);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "45 sec" under a minute, "5 min" (rounded) at or above a minute. */
export function formatDuration(startedAt: number, endedAt: number): string {
  const totalSec = Math.max(0, Math.round((endedAt - startedAt) / 1000));
  if (totalSec < 60) return `${totalSec} sec`;
  const minutes = Math.round(totalSec / 60);
  return `${minutes} min`;
}

export interface SessionRowLabel {
  dateLabel: string;
  durationLabel: string;
  meanLabel: string;
  peakLabel: string;
  /** "you rated 7/10", absent when the session has no self-report. */
  ratingLabel: string | null;
}

export function formatSessionRow(session: Session): SessionRowLabel {
  return {
    dateLabel: formatSessionDate(session.startedAt),
    durationLabel: formatDuration(session.startedAt, session.endedAt),
    meanLabel: session.stressIndexMean.toFixed(0),
    peakLabel: session.stressIndexPeak.toFixed(0),
    ratingLabel: session.selfReport ? `you rated ${session.selfReport.stressRating}/10` : null,
  };
}

/** Plain-language trend sentence — PLAN.md §6 "always framed as your change over time, with
 * visible uncertainty," so this never overclaims from a null/flat result. */
export function formatTrendSummary(trend: TrendResult | null): string {
  if (!trend) return "Not enough data yet for a trend.";
  const period = `the last ${trend.windowDays} days`;
  if (trend.direction === "flat") return `Fairly stable over ${period}.`;
  const verb = trend.direction === "up" ? "up" : "down";
  return `Trending ${verb} over ${period} (${trend.dataPointCount} days with data).`;
}

/** A plain, honest "how well does the index match how you actually feel" sentence — a
 * transparency figure, never framed as validated personalization (see the note on
 * computeSelfReportCorrelation). */
export function formatSelfReportInsight(insight: SelfReportInsight): string {
  if (insight.correlation === null) {
    if (insight.sampleCount === 0) {
      return "Rate how a session felt afterward to see how well the index matches your own sense of it.";
    }
    const noun = insight.sampleCount === 1 ? "session" : "sessions";
    return `${insight.sampleCount} ${noun} rated so far — rate a few more to see how well the index matches how you actually felt.`;
  }
  return `Across ${insight.sampleCount} rated sessions, the index has correlated with your own ratings at r=${insight.correlation.toFixed(2)}.`;
}
