import { describe, expect, it } from "vitest";
import { clamp, clamp01, mean, normalizeByMean, skewness, std } from "./stats.js";

describe("stats", () => {
  it("mean of a known array", () => {
    expect(mean([1, 2, 3, 4, 5])).toBeCloseTo(3, 10);
  });

  it("std matches hand-computed population stddev", () => {
    // [2, 4, 4, 4, 5, 5, 7, 9]: mean=5, population variance=4, std=2 (classic textbook example)
    const x = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(std(x, 0)).toBeCloseTo(2, 10);
  });

  it("std with ddof=1 (sample stddev) is larger than population stddev", () => {
    const x = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(std(x, 1)).toBeGreaterThan(std(x, 0));
  });

  it("skewness of a symmetric distribution is ~0", () => {
    const x = [-2, -1, -1, 0, 0, 0, 1, 1, 2];
    expect(skewness(x)).toBeCloseTo(0, 6);
  });

  it("skewness is positive for a right-skewed sample", () => {
    const x = [1, 1, 1, 1, 2, 2, 3, 10];
    expect(skewness(x)).toBeGreaterThan(0);
  });

  it("normalizeByMean centers values around 1", () => {
    const x = [10, 20, 30];
    const norm = normalizeByMean(x);
    expect(mean(Array.from(norm))).toBeCloseTo(1, 10);
  });

  it("clamp and clamp01 bound values correctly", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(-0.5)).toBe(0);
  });
});
