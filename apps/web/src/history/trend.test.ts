import type { Rollup } from "@halo-pulse/types";
import { describe, expect, it } from "vitest";
import { detectTrend, trailingMovingAverage } from "./trend.js";

function rollup(day: string, meanStressIndex: number, sampleCount = 5): Rollup {
  return { id: `local:${day}`, profileId: "local", day, meanStressIndex, sampleCount };
}

describe("detectTrend", () => {
  it("detects a clear upward trend (hand-derived OLS slope = 10/day, total change = 40)", () => {
    const rollups = [
      rollup("2026-01-01", 20),
      rollup("2026-01-02", 30),
      rollup("2026-01-03", 40),
      rollup("2026-01-04", 50),
      rollup("2026-01-05", 60),
    ];
    const result = detectTrend(rollups, { windowDays: 14 });
    expect(result).not.toBeNull();
    expect(result?.direction).toBe("up");
    expect(result?.slopePerDay).toBeCloseTo(10, 6);
    expect(result?.totalChange).toBeCloseTo(40, 6);
    expect(result?.dataPointCount).toBe(5);
  });

  it("detects a clear downward trend (mirror of the upward case)", () => {
    const rollups = [
      rollup("2026-01-01", 60),
      rollup("2026-01-02", 50),
      rollup("2026-01-03", 40),
      rollup("2026-01-04", 30),
      rollup("2026-01-05", 20),
    ];
    const result = detectTrend(rollups, { windowDays: 14 });
    expect(result?.direction).toBe("down");
    expect(result?.slopePerDay).toBeCloseTo(-10, 6);
    expect(result?.totalChange).toBeCloseTo(-40, 6);
  });

  it("calls small noisy fluctuation flat (hand-derived slope = -0.1/day, total change = -0.4)", () => {
    const rollups = [
      rollup("2026-01-01", 50),
      rollup("2026-01-02", 52),
      rollup("2026-01-03", 49),
      rollup("2026-01-04", 51),
      rollup("2026-01-05", 50),
    ];
    const result = detectTrend(rollups, { windowDays: 14 });
    expect(result?.direction).toBe("flat");
    expect(result?.slopePerDay).toBeCloseTo(-0.1, 6);
    expect(result?.totalChange).toBeCloseTo(-0.4, 6);
  });

  it("returns null when there are fewer than 3 data points in the window", () => {
    const rollups = [rollup("2026-01-01", 20), rollup("2026-01-02", 80)];
    expect(detectTrend(rollups, { windowDays: 14 })).toBeNull();
  });

  it("returns null for an empty rollup list", () => {
    expect(detectTrend([], { windowDays: 14 })).toBeNull();
  });

  it("excludes rollups outside the trailing window", () => {
    // An old outlier 30 days back should not pull in a 5-day window's trend.
    const rollups = [
      rollup("2025-12-01", 100), // far outside a 5-day window ending 2026-01-05
      rollup("2026-01-01", 20),
      rollup("2026-01-02", 30),
      rollup("2026-01-03", 40),
    ];
    const result = detectTrend(rollups, { windowDays: 5, asOfDay: "2026-01-03" });
    expect(result?.dataPointCount).toBe(3);
    expect(result?.direction).toBe("up");
  });

  it("respects an explicit asOfDay rather than always using the last rollup", () => {
    const rollups = [rollup("2026-01-01", 20), rollup("2026-01-02", 30), rollup("2026-01-03", 40)];
    // As-of day 2026-01-02 with a 2-day window includes only Jan1-Jan2 -> 2 points -> insufficient.
    const result = detectTrend(rollups, { windowDays: 2, asOfDay: "2026-01-02" });
    expect(result).toBeNull();
  });
});

describe("trailingMovingAverage", () => {
  it("computes a 2-day trailing average over consecutive days (hand-derived)", () => {
    const rollups = [rollup("2026-01-01", 10), rollup("2026-01-02", 20), rollup("2026-01-03", 30)];
    const result = trailingMovingAverage(rollups, 2);
    expect(result).toEqual([
      { day: "2026-01-01", value: 10 }, // only Jan1 in window [Dec31,Jan1]
      { day: "2026-01-02", value: 15 }, // (10+20)/2
      { day: "2026-01-03", value: 25 }, // (20+30)/2
    ]);
  });

  it("is gap-aware: a missing day is skipped, not zero-filled (hand-derived)", () => {
    const rollups = [rollup("2026-01-01", 10), rollup("2026-01-03", 30)]; // Jan2 missing
    const result = trailingMovingAverage(rollups, 3);
    expect(result).toEqual([
      { day: "2026-01-01", value: 10 },
      { day: "2026-01-03", value: 20 }, // (10+30)/2, Jan2's absence isn't counted as 0
    ]);
  });

  it("returns an empty array for no rollups", () => {
    expect(trailingMovingAverage([], 7)).toEqual([]);
  });
});
