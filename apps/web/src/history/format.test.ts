import type { Session } from "@halo-pulse/types";
import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatSessionDate,
  formatSessionRow,
  formatTrendSummary,
} from "./format.js";
import type { TrendResult } from "./trend.js";

describe("formatSessionDate", () => {
  it("formats a UTC timestamp as YYYY-MM-DD HH:MM with zero-padding (hand-derived)", () => {
    expect(formatSessionDate(Date.UTC(2026, 0, 5, 9, 5, 0))).toBe("2026-01-05 09:05");
  });
});

describe("formatDuration", () => {
  it("shows seconds under a minute", () => {
    expect(formatDuration(0, 45_000)).toBe("45 sec");
  });

  it("shows rounded minutes at or above 60 seconds", () => {
    expect(formatDuration(0, 60_000)).toBe("1 min");
    expect(formatDuration(0, 300_000)).toBe("5 min");
  });

  it("rounds to the nearest minute (90s -> 2min, Math.round half-up)", () => {
    expect(formatDuration(0, 90_000)).toBe("2 min");
  });
});

function makeSession(overrides: Partial<Session>): Session {
  return {
    id: "s1",
    profileId: "local",
    startedAt: Date.UTC(2026, 0, 5, 9, 5, 0),
    endedAt: Date.UTC(2026, 0, 5, 9, 5, 0) + 90_000,
    baselineId: "b1",
    signalLayers: ["classical"],
    stressIndexMean: 62.4,
    stressIndexMedian: 60,
    stressIndexPeak: 88.9,
    hrMean: 75,
    hrvSummary: { rmssd: 35, sdnn: 45, lfhf: null },
    sqiMean: 0.6,
    ...overrides,
  };
}

describe("formatSessionRow", () => {
  it("combines date/duration/mean/peak labels (hand-derived)", () => {
    const row = formatSessionRow(makeSession({}));
    expect(row).toEqual({
      dateLabel: "2026-01-05 09:05",
      durationLabel: "2 min",
      meanLabel: "62",
      peakLabel: "89",
    });
  });
});

describe("formatTrendSummary", () => {
  it("handles null (insufficient data)", () => {
    expect(formatTrendSummary(null)).toBe("Not enough data yet for a trend.");
  });

  it("handles a flat trend", () => {
    const trend: TrendResult = {
      direction: "flat",
      slopePerDay: 0,
      totalChange: 0,
      windowDays: 14,
      dataPointCount: 8,
    };
    expect(formatTrendSummary(trend)).toBe("Fairly stable over the last 14 days.");
  });

  it("handles an upward trend", () => {
    const trend: TrendResult = {
      direction: "up",
      slopePerDay: 2,
      totalChange: 20,
      windowDays: 14,
      dataPointCount: 10,
    };
    expect(formatTrendSummary(trend)).toBe(
      "Trending up over the last 14 days (10 days with data).",
    );
  });

  it("handles a downward trend with a different window", () => {
    const trend: TrendResult = {
      direction: "down",
      slopePerDay: -3,
      totalChange: -15,
      windowDays: 7,
      dataPointCount: 5,
    };
    expect(formatTrendSummary(trend)).toBe(
      "Trending down over the last 7 days (5 days with data).",
    );
  });
});
