import type { Session } from "@halo-pulse/types";
import { describe, expect, it } from "vitest";
import type { SelfReportInsight } from "../personalization/selfReportInsight.js";
import {
  formatDuration,
  formatSelfReportInsight,
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
      ratingLabel: null,
    });
  });

  it("includes a rating label when the session has a self-report", () => {
    const row = formatSessionRow(
      makeSession({ selfReport: { stressRating: 7, confounders: [], reportedAt: 0 } }),
    );
    expect(row.ratingLabel).toBe("you rated 7/10");
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

describe("formatSelfReportInsight", () => {
  it("invites the first rating when there are none yet", () => {
    const insight: SelfReportInsight = { sampleCount: 0, correlation: null };
    expect(formatSelfReportInsight(insight)).toBe(
      "Rate how a session felt afterward to see how well the index matches your own sense of it.",
    );
  });

  it("uses singular 'session' for exactly one rated session", () => {
    const insight: SelfReportInsight = { sampleCount: 1, correlation: null };
    expect(formatSelfReportInsight(insight)).toBe(
      "1 session rated so far — rate a few more to see how well the index matches how you actually felt.",
    );
  });

  it("uses plural for multiple rated sessions still below the threshold", () => {
    const insight: SelfReportInsight = { sampleCount: 3, correlation: null };
    expect(formatSelfReportInsight(insight)).toBe(
      "3 sessions rated so far — rate a few more to see how well the index matches how you actually felt.",
    );
  });

  it("reports the correlation once there is enough data (hand-derived rounding)", () => {
    const insight: SelfReportInsight = { sampleCount: 8, correlation: 0.7234 };
    expect(formatSelfReportInsight(insight)).toBe(
      "Across 8 rated sessions, the index has correlated with your own ratings at r=0.72.",
    );
  });

  it("formats a negative correlation correctly", () => {
    const insight: SelfReportInsight = { sampleCount: 6, correlation: -0.5 };
    expect(formatSelfReportInsight(insight)).toBe(
      "Across 6 rated sessions, the index has correlated with your own ratings at r=-0.50.",
    );
  });
});
