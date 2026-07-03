import type { Session } from "@halo-pulse/types";
import { describe, expect, it } from "vitest";
import { computeSelfReportCorrelation } from "./selfReportInsight.js";

function session(overrides: Partial<Session>): Session {
  return {
    id: `s-${Math.random()}`,
    profileId: "local",
    startedAt: 0,
    endedAt: 60,
    baselineId: "b1",
    signalLayers: ["classical"],
    stressIndexMean: 50,
    stressIndexMedian: 50,
    stressIndexPeak: 60,
    hrMean: 70,
    hrvSummary: { rmssd: 40, sdnn: 50, lfhf: null },
    sqiMean: 0.7,
    ...overrides,
  };
}

function labelled(stressIndexMean: number, rating: number): Session {
  return session({
    stressIndexMean,
    selfReport: { stressRating: rating, confounders: [], reportedAt: 0 },
  });
}

describe("computeSelfReportCorrelation", () => {
  it("computes r=1 for a perfectly matched set (hand-derived)", () => {
    const sessions = [
      labelled(10, 1),
      labelled(20, 2),
      labelled(30, 3),
      labelled(40, 4),
      labelled(50, 5),
    ];
    const result = computeSelfReportCorrelation(sessions);
    expect(result.sampleCount).toBe(5);
    expect(result.correlation).toBeCloseTo(1, 6);
  });

  it("computes r=-1 for a perfectly inverted set (hand-derived)", () => {
    const sessions = [
      labelled(10, 5),
      labelled(20, 4),
      labelled(30, 3),
      labelled(40, 2),
      labelled(50, 1),
    ];
    const result = computeSelfReportCorrelation(sessions);
    expect(result.correlation).toBeCloseTo(-1, 6);
  });

  it("returns null correlation with fewer than 5 labelled sessions", () => {
    const sessions = [labelled(10, 1), labelled(20, 2), labelled(30, 3)];
    const result = computeSelfReportCorrelation(sessions);
    expect(result.sampleCount).toBe(3);
    expect(result.correlation).toBeNull();
  });

  it("only counts sessions that have a self-report", () => {
    const sessions = [
      labelled(10, 1),
      labelled(20, 2),
      labelled(30, 3),
      labelled(40, 4),
      labelled(50, 5),
      session({ stressIndexMean: 90 }), // no selfReport
    ];
    expect(computeSelfReportCorrelation(sessions).sampleCount).toBe(5);
  });

  it("returns null when computed index has zero variance (undefined correlation)", () => {
    const sessions = [
      labelled(50, 1),
      labelled(50, 2),
      labelled(50, 3),
      labelled(50, 4),
      labelled(50, 5),
    ];
    expect(computeSelfReportCorrelation(sessions).correlation).toBeNull();
  });
});
