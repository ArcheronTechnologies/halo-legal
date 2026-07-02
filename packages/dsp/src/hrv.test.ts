import { describe, expect, it } from "vitest";
import { computeHrv, meanHr } from "./hrv.js";

describe("computeHrv", () => {
  // Hand-computed reference values for this fixture:
  //   ibis = [800, 810, 790, 820, 780] ms, mean = 800
  //   SDNN (sample, ddof=1): deviations [0,10,-10,20,-20] -> sumSq=1000 -> /4 = 250 -> sqrt = 15.8114
  //   RMSSD: successive diffs [10,-20,30,-40] -> sumSq=3000 -> /4 = 750 -> sqrt = 27.3861
  const ibisMs = [800, 810, 790, 820, 780];
  // arbitrary increasing beat times consistent with those intervals, well under the LF/HF gate
  const ibiTimes = [0.8, 1.61, 2.4, 3.22, 4.0];

  it("computes SDNN matching a hand-derived reference value", () => {
    const { sdnn } = computeHrv(ibisMs, ibiTimes);
    expect(sdnn).toBeCloseTo(15.8114, 3);
  });

  it("computes RMSSD matching a hand-derived reference value", () => {
    const { rmssd } = computeHrv(ibisMs, ibiTimes);
    expect(rmssd).toBeCloseTo(27.3861, 3);
  });

  it("does not compute LF/HF from a short (<60s) window — see VALIDATION.md §1", () => {
    const { lfhf } = computeHrv(ibisMs, ibiTimes);
    expect(lfhf).toBeNull();
  });

  it("returns NaN metrics (not a thrown error) for fewer than 2 IBIs", () => {
    const result = computeHrv([800], [0.8]);
    expect(Number.isNaN(result.rmssd)).toBe(true);
    expect(Number.isNaN(result.sdnn)).toBe(true);
    expect(result.ibiCount).toBe(1);
  });

  it("a perfectly regular rhythm has RMSSD and SDNN of ~0", () => {
    const regular = [800, 800, 800, 800, 800];
    const times = [0.8, 1.6, 2.4, 3.2, 4.0];
    const { rmssd, sdnn } = computeHrv(regular, times);
    expect(rmssd).toBeCloseTo(0, 6);
    expect(sdnn).toBeCloseTo(0, 6);
  });
});

describe("meanHr", () => {
  it("converts mean IBI to bpm correctly", () => {
    // mean IBI 800ms -> 60000/800 = 75 bpm
    expect(meanHr([800, 810, 790, 820, 780])).toBeCloseTo(75, 6);
  });

  it("a 1000ms IBI is exactly 60 bpm", () => {
    expect(meanHr([1000, 1000, 1000])).toBeCloseTo(60, 6);
  });
});
