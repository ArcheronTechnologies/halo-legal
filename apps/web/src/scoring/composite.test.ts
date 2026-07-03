import type { Baseline } from "@halo-pulse/types";
import { describe, expect, it } from "vitest";
import { bandFor, computeStressIndex } from "./composite.js";
import type { WindowFeatures } from "./features.js";

const baseline: Baseline = {
  id: "b1",
  profileId: "local",
  capturedAt: 0,
  version: 1,
  hrMean: 70,
  hrSd: 5,
  rmssdMean: 40,
  rmssdSd: 8,
  sdnnMean: 50,
  sdnnSd: 10,
  lfhfMean: 1.5,
  lfhfSd: 0.3,
  blinkRateMean: 0.2,
  blinkRateSd: 0.05,
  browTensionMean: 0.1,
  browTensionSd: 0.05,
  lidTensionMean: 0.1,
  lidTensionSd: 0.05,
  lipTensionMean: 0.1,
  lipTensionSd: 0.05,
  windowCount: 20,
  captureConditions: {},
};

const atBaseline: WindowFeatures = {
  hr: baseline.hrMean,
  rmssd: baseline.rmssdMean,
  sdnn: baseline.sdnnMean,
  lfhf: baseline.lfhfMean,
  browTension: baseline.browTensionMean,
  lidTension: baseline.lidTensionMean,
  lipTension: baseline.lipTensionMean,
  blinkRateHz: baseline.blinkRateMean,
  sqi: 0.8,
};

describe("computeStressIndex", () => {
  it("returns exactly 50 (neutral) when every feature exactly matches baseline", () => {
    const result = computeStressIndex(atBaseline, baseline);
    expect(result.stressIndex).toBeCloseTo(50, 6);
    expect(result.band).toBe("neutral");
    for (const c of result.contributions) {
      expect(c.zScore).toBeCloseTo(0, 6);
    }
  });

  it("matches a hand-derived value for the classic HR-up/RMSSD-down stress signature", () => {
    // hr at baseline+2sd (z=+2, sign=+1 -> +2*weight) and rmssd at baseline-2sd (raw z=-2,
    // sign=-1 -> contribution = -1 * -2 * weight = +2*weight); all other features at baseline.
    // All 7 features present so weights sum to 1 unmodified: rawScore = 0.30*2 + 0.30*2 = 1.2
    // stressIndex = 100 / (1 + exp(-0.9 * 1.2)) ~= 74.65
    const current: WindowFeatures = {
      ...atBaseline,
      hr: baseline.hrMean + 2 * baseline.hrSd,
      rmssd: baseline.rmssdMean - 2 * baseline.rmssdSd,
    };
    const result = computeStressIndex(current, baseline);
    expect(result.stressIndex).toBeCloseTo(74.65, 1);
    expect(result.band).toBe("elevated");

    const hrContribution = result.contributions.find((c) => c.name === "hr")!;
    const rmssdContribution = result.contributions.find((c) => c.name === "rmssd")!;
    expect(hrContribution.zScore).toBeCloseTo(2, 6);
    expect(rmssdContribution.zScore).toBeCloseTo(-2, 6); // stored signed; sign flip happens in `contribution`
    expect(hrContribution.contribution).toBeCloseTo(0.3 * 2, 6);
    expect(rmssdContribution.contribution).toBeCloseTo(0.3 * 2, 6); // -1 * -2 * 0.3
  });

  it("a calmer-than-baseline reading (higher RMSSD, lower HR) scores below 50 and calm/neutral", () => {
    const current: WindowFeatures = {
      ...atBaseline,
      hr: baseline.hrMean - 2 * baseline.hrSd,
      rmssd: baseline.rmssdMean + 2 * baseline.rmssdSd,
    };
    const result = computeStressIndex(current, baseline);
    expect(result.stressIndex).toBeLessThan(50);
  });

  it("scores blink-rate deviation by magnitude regardless of direction (ADR-0003)", () => {
    const faster: WindowFeatures = {
      ...atBaseline,
      blinkRateHz: baseline.blinkRateMean + 3 * baseline.blinkRateSd,
    };
    const slower: WindowFeatures = {
      ...atBaseline,
      blinkRateHz: baseline.blinkRateMean - 3 * baseline.blinkRateSd,
    };
    const faterResult = computeStressIndex(faster, baseline);
    const slowerResult = computeStressIndex(slower, baseline);
    expect(faterResult.stressIndex).toBeCloseTo(slowerResult.stressIndex, 6);
    expect(faterResult.stressIndex).toBeGreaterThan(50); // deviation in either direction reads as more aroused
  });

  it("renormalizes weights when LF/HF is unavailable rather than shrinking the score", () => {
    const withLfhf = computeStressIndex(atBaseline, baseline);
    const withoutLfhf = computeStressIndex({ ...atBaseline, lfhf: null }, baseline);
    // both at baseline for every present feature -> still exactly 50 either way
    expect(withoutLfhf.stressIndex).toBeCloseTo(50, 6);
    expect(withoutLfhf.contributions.find((c) => c.name === "lfhf")).toBeUndefined();
    expect(withLfhf.contributions.length).toBe(7);
    expect(withoutLfhf.contributions.length).toBe(6);
    // remaining weights renormalized to sum to 1
    const sumWeights = withoutLfhf.contributions.reduce((s, c) => s + c.weight, 0);
    expect(sumWeights).toBeCloseTo(1, 6);
  });

  it("also excludes a feature the baseline itself never captured (lfhf baseline null)", () => {
    const baselineNoLfhf: Baseline = { ...baseline, lfhfMean: null, lfhfSd: null };
    const result = computeStressIndex(atBaseline, baselineNoLfhf);
    expect(result.contributions.find((c) => c.name === "lfhf")).toBeUndefined();
  });

  it("clamps extreme z-scores instead of letting them blow up the index", () => {
    const current: WindowFeatures = { ...atBaseline, hr: 10000 };
    const result = computeStressIndex(current, baseline);
    const hrContribution = result.contributions.find((c) => c.name === "hr")!;
    expect(hrContribution.zScore).toBe(4); // Z_CLAMP
    expect(result.stressIndex).toBeGreaterThan(0);
    expect(result.stressIndex).toBeLessThanOrEqual(100);
    expect(Number.isFinite(result.stressIndex)).toBe(true);
  });

  it("does not divide by zero when a baseline stddev is exactly 0", () => {
    const zeroSdBaseline: Baseline = { ...baseline, hrSd: 0 };
    const current: WindowFeatures = { ...atBaseline, hr: baseline.hrMean + 1 };
    const result = computeStressIndex(current, zeroSdBaseline);
    expect(Number.isFinite(result.stressIndex)).toBe(true);
  });

  it("confidence tracks SQI directly, clamped to [0, 1]", () => {
    const result = computeStressIndex({ ...atBaseline, sqi: 0.42 }, baseline);
    expect(result.confidence).toBeCloseTo(0.42, 6);
  });
});

describe("bandFor", () => {
  it("maps index ranges to the documented bands", () => {
    expect(bandFor(0)).toBe("calm");
    expect(bandFor(34.9)).toBe("calm");
    expect(bandFor(35)).toBe("neutral");
    expect(bandFor(59.9)).toBe("neutral");
    expect(bandFor(60)).toBe("elevated");
    expect(bandFor(79.9)).toBe("elevated");
    expect(bandFor(80)).toBe("high");
    expect(bandFor(100)).toBe("high");
  });
});
