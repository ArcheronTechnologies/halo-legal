import type { Rollup } from "@halo-pulse/types";

/** Minimum distinct days of data required before a trend claim is made at all (PLAN.md §6). */
const MIN_TREND_POINTS = 3;

/** Below this predicted total change (index points) across the analyzed window, call it "flat"
 * rather than manufacturing a direction out of noise. */
const FLAT_TOTAL_CHANGE_THRESHOLD = 5;

export type TrendDirection = "up" | "down" | "flat";

export interface TrendResult {
  direction: TrendDirection;
  /** Predicted index-points change per day (OLS slope). */
  slopePerDay: number;
  /** Predicted total change across the analyzed window (slope * span in days). */
  totalChange: number;
  windowDays: number;
  dataPointCount: number;
}

/** Stable integer day-index for a "YYYY-MM-DD" label — just a linear x-axis for regression, not
 * a timezone claim (the label's local-day meaning was already fixed by whoever produced it).
 * Exported so chart rendering can share the exact same x-axis mapping as the trend math. */
export function dayOrdinal(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1) / 86_400_000;
}

/**
 * Simple ordinary-least-squares trend over the trailing `windowDays` of rollups, anchored at
 * `asOfDay` (defaults to the most recent rollup's day so callers don't need to pass a live
 * timestamp into otherwise-pure logic). Returns null when there isn't enough data in the window
 * to support a trend claim (PLAN.md §6: report trend with visible uncertainty, never overclaim).
 */
export function detectTrend(
  rollups: Rollup[],
  opts: { windowDays?: number; asOfDay?: string } = {},
): TrendResult | null {
  if (rollups.length === 0) return null;
  const windowDays = opts.windowDays ?? 14;
  const asOfDay = opts.asOfDay ?? rollups[rollups.length - 1]?.day;
  if (!asOfDay) return null;
  const asOfOrdinal = dayOrdinal(asOfDay);
  const minOrdinal = asOfOrdinal - windowDays + 1;

  const points = rollups
    .filter((r) => {
      const o = dayOrdinal(r.day);
      return o >= minOrdinal && o <= asOfOrdinal;
    })
    .map((r) => ({ x: dayOrdinal(r.day), y: r.meanStressIndex }));

  if (points.length < MIN_TREND_POINTS) return null;

  const n = points.length;
  const xbar = points.reduce((sum, p) => sum + p.x, 0) / n;
  const ybar = points.reduce((sum, p) => sum + p.y, 0) / n;
  const numerator = points.reduce((sum, p) => sum + (p.x - xbar) * (p.y - ybar), 0);
  const denominator = points.reduce((sum, p) => sum + (p.x - xbar) ** 2, 0);
  if (denominator === 0) return null; // all points on the same day — no time axis to fit

  const slopePerDay = numerator / denominator;
  const xs = points.map((p) => p.x);
  const span = Math.max(...xs) - Math.min(...xs);
  const totalChange = slopePerDay * span;

  const direction: TrendDirection =
    Math.abs(totalChange) < FLAT_TOTAL_CHANGE_THRESHOLD ? "flat" : totalChange > 0 ? "up" : "down";

  return { direction, slopePerDay, totalChange, windowDays, dataPointCount: n };
}

export interface MovingAveragePoint {
  day: string;
  value: number;
}

/**
 * Trailing calendar-day moving average, gap-aware: a day with no rollup contributes nothing (it
 * is not zero-filled), so a quiet stretch doesn't drag the average toward "calm" it never measured.
 */
export function trailingMovingAverage(rollups: Rollup[], windowDays: number): MovingAveragePoint[] {
  const withOrdinal = rollups.map((r) => ({ ...r, ordinal: dayOrdinal(r.day) }));

  return withOrdinal.map((target) => {
    const windowStart = target.ordinal - windowDays + 1;
    const inWindow = withOrdinal.filter(
      (r) => r.ordinal >= windowStart && r.ordinal <= target.ordinal,
    );
    const value = inWindow.reduce((sum, r) => sum + r.meanStressIndex, 0) / inWindow.length;
    return { day: target.day, value };
  });
}
