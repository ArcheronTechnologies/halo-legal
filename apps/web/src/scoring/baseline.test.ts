import { describe, expect, it } from "vitest";
import { computeBaselineFromSamples } from "./baseline.js";
import type { WindowFeatures } from "./features.js";

function features(overrides: Partial<WindowFeatures>): WindowFeatures {
  return {
    hr: 70,
    rmssd: 40,
    sdnn: 50,
    lfhf: 1.5,
    browTension: 0.1,
    lidTension: 0.1,
    lipTension: 0.1,
    blinkRateHz: 0.2,
    sqi: 0.8,
    ...overrides,
  };
}

describe("computeBaselineFromSamples", () => {
  it("computes mean and sample stddev matching hand-derived reference values", () => {
    // hr = [60, 70, 80]: mean=70, sample stddev (ddof=1): deviations [-10,0,10] -> sumSq=200 -> /2=100 -> sqrt=10
    const windows = [features({ hr: 60 }), features({ hr: 70 }), features({ hr: 80 })];
    const baseline = computeBaselineFromSamples(windows, {
      id: "b1",
      profileId: "local",
      capturedAt: 0,
    });
    expect(baseline.hrMean).toBeCloseTo(70, 6);
    expect(baseline.hrSd).toBeCloseTo(10, 6);
    expect(baseline.windowCount).toBe(3);
  });

  it("ignores null rmssd/sdnn/lfhf windows when averaging those fields", () => {
    const windows = [features({ rmssd: 30 }), features({ rmssd: null }), features({ rmssd: 50 })];
    const baseline = computeBaselineFromSamples(windows, {
      id: "b1",
      profileId: "local",
      capturedAt: 0,
    });
    expect(baseline.rmssdMean).toBeCloseTo(40, 6); // mean of [30, 50], not [30, 0, 50]
  });

  it("produces a null lfhf baseline when no window ever had enough data for it", () => {
    const windows = [features({ lfhf: null }), features({ lfhf: null })];
    const baseline = computeBaselineFromSamples(windows, {
      id: "b1",
      profileId: "local",
      capturedAt: 0,
    });
    expect(baseline.lfhfMean).toBeNull();
    expect(baseline.lfhfSd).toBeNull();
  });

  it("falls back to 0 (not a crash) when NO window has valid rmssd/sdnn", () => {
    const windows = [features({ rmssd: null, sdnn: null })];
    const baseline = computeBaselineFromSamples(windows, {
      id: "b1",
      profileId: "local",
      capturedAt: 0,
    });
    expect(baseline.rmssdMean).toBe(0);
    expect(baseline.rmssdSd).toBe(0);
  });

  it("a single window has zero stddev for every field", () => {
    const baseline = computeBaselineFromSamples([features({})], {
      id: "b1",
      profileId: "local",
      capturedAt: 0,
    });
    expect(baseline.hrSd).toBe(0);
    expect(baseline.browTensionSd).toBe(0);
  });

  it("throws on an empty window list", () => {
    expect(() =>
      computeBaselineFromSamples([], { id: "b1", profileId: "local", capturedAt: 0 }),
    ).toThrow();
  });

  it("carries meta fields through unchanged", () => {
    const baseline = computeBaselineFromSamples([features({})], {
      id: "b-42",
      profileId: "local",
      capturedAt: 12345,
      version: 3,
      captureConditions: { skinToneBin: 5 },
    });
    expect(baseline.id).toBe("b-42");
    expect(baseline.version).toBe(3);
    expect(baseline.captureConditions.skinToneBin).toBe(5);
  });
});
