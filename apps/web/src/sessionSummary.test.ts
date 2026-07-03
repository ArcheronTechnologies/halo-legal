import type { Sample } from "@halo-pulse/types";
import { describe, expect, it } from "vitest";
import { buildSessionSummary } from "./sessionSummary.js";

function sample(overrides: Partial<Sample>): Sample {
  return {
    id: `s-${Math.random()}`,
    sessionId: "sess-1",
    t: 0,
    hr: 70,
    rmssd: 40,
    sdnn: 50,
    lfhf: undefined,
    behavioural: { blinkDeviation: 0, browTension: 0.1, lidTension: 0.1, lipTension: 0.1 },
    sqi: 0.7,
    stressIndex: 50,
    confidence: 0.7,
    ...overrides,
  };
}

const meta = {
  id: "sess-1",
  profileId: "local",
  baselineId: "b1",
  startedAt: 1000,
  endedAt: 2000,
  signalLayers: ["classical" as const],
};

describe("buildSessionSummary", () => {
  it("computes mean, median, and peak stress index matching hand-derived values", () => {
    // stress indices [40, 50, 90]: mean=60, median=50, peak=90
    const samples = [
      sample({ stressIndex: 40 }),
      sample({ stressIndex: 50 }),
      sample({ stressIndex: 90 }),
    ];
    const summary = buildSessionSummary(samples, meta);
    expect(summary.stressIndexMean).toBeCloseTo(60, 6);
    expect(summary.stressIndexMedian).toBeCloseTo(50, 6);
    expect(summary.stressIndexPeak).toBe(90);
  });

  it("computes the median correctly for an even sample count", () => {
    // [10, 20, 30, 40] -> median = (20+30)/2 = 25
    const samples = [10, 20, 30, 40].map((v) => sample({ stressIndex: v }));
    const summary = buildSessionSummary(samples, meta);
    expect(summary.stressIndexMedian).toBeCloseTo(25, 6);
  });

  it("ignores undefined rmssd/sdnn/lfhf when averaging those fields", () => {
    const samples = [sample({ rmssd: 30 }), sample({ rmssd: undefined }), sample({ rmssd: 50 })];
    const summary = buildSessionSummary(samples, meta);
    expect(summary.hrvSummary.rmssd).toBeCloseTo(40, 6); // mean of [30, 50]
  });

  it("carries meta fields through unchanged", () => {
    const summary = buildSessionSummary([sample({})], meta);
    expect(summary.id).toBe("sess-1");
    expect(summary.baselineId).toBe("b1");
    expect(summary.startedAt).toBe(1000);
    expect(summary.endedAt).toBe(2000);
    expect(summary.signalLayers).toEqual(["classical"]);
  });

  it("throws on an empty sample list", () => {
    expect(() => buildSessionSummary([], meta)).toThrow();
  });
});
