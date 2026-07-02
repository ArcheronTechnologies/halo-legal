import type { Sample } from "@halo-pulse/types";

export interface HeatmapCell {
  /** 0=Sunday..6=Saturday, matching Date#getDay(). */
  dayOfWeek: number;
  /** 0-23, local time. */
  hour: number;
  meanStressIndex: number;
  sampleCount: number;
}

/**
 * Time-of-day x day-of-week aggregation (PLAN.md §6 "time-of-day patterns"). Returns only
 * populated cells — a (dayOfWeek, hour) pair with no samples is absent, not a fabricated 0/"calm"
 * value, so the UI can render "no data" distinctly from "measured calm" (dataviz skill: never
 * imply precision the data doesn't have).
 */
export function computeTimeOfDayHeatmap(
  samples: Pick<Sample, "t" | "stressIndex">[],
): HeatmapCell[] {
  const buckets = new Map<
    string,
    { sum: number; count: number; dayOfWeek: number; hour: number }
  >();
  for (const sample of samples) {
    const d = new Date(sample.t);
    const dayOfWeek = d.getDay();
    const hour = d.getHours();
    const key = `${dayOfWeek}-${hour}`;
    const bucket = buckets.get(key) ?? { sum: 0, count: 0, dayOfWeek, hour };
    bucket.sum += sample.stressIndex;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values()).map((b) => ({
    dayOfWeek: b.dayOfWeek,
    hour: b.hour,
    meanStressIndex: b.sum / b.count,
    sampleCount: b.count,
  }));
}
