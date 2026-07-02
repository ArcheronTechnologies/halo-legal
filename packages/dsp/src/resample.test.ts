import { describe, expect, it } from "vitest";
import { resampleRoiSamples, resampleSeries } from "./resample.js";

describe("resampleSeries", () => {
  it("linearly interpolates a simple ramp exactly", () => {
    // value = 10*t, sampled at irregular times; resampled at 10 Hz should reproduce 10*t exactly
    const times = [0, 0.05, 0.13, 0.2, 0.31, 0.4];
    const values = times.map((t) => 10 * t);
    const result = resampleSeries(times, values, 10);
    for (let i = 0; i < result.values.length; i++) {
      const t = result.t0 + i / 10;
      expect(result.values[i]).toBeCloseTo(10 * t, 6);
    }
  });

  it("reproduces exact samples when input is already on the target grid", () => {
    const times = [0, 0.1, 0.2, 0.3, 0.4];
    const values = [1, 2, 3, 4, 5];
    const result = resampleSeries(times, values, 10);
    expect(Array.from(result.values)).toEqual([1, 2, 3, 4, 5]);
  });

  it("handles jittered (uneven) timestamps and stays close to the true underlying function", () => {
    const trueFn = (t: number) => Math.sin(2 * Math.PI * 1.2 * t);
    const nominal = Array.from({ length: 300 }, (_, i) => i / 30);
    // deterministic jitter, +/- 5ms
    const jittered = nominal.map((t, i) => t + (((i * 7) % 10) - 5) / 1000);
    const values = jittered.map(trueFn);
    const result = resampleSeries(jittered, values, 30);
    let maxErr = 0;
    for (let i = 0; i < result.values.length; i++) {
      const t = result.t0 + i / 30;
      if (t < jittered[0]! || t > jittered[jittered.length - 1]!) continue;
      maxErr = Math.max(maxErr, Math.abs(result.values[i]! - trueFn(t)));
    }
    expect(maxErr).toBeLessThan(0.02);
  });

  it("throws on fewer than 2 samples", () => {
    expect(() => resampleSeries([0], [1], 30)).toThrow();
  });
});

describe("resampleRoiSamples", () => {
  it("resamples all three channels onto a shared uniform grid", () => {
    const samples = [
      { t: 0, r: 1, g: 2, b: 3 },
      { t: 0.1, r: 2, g: 4, b: 6 },
      { t: 0.2, r: 3, g: 6, b: 9 },
    ];
    const result = resampleRoiSamples(samples, 10);
    expect(result.r.length).toBe(result.g.length);
    expect(result.g.length).toBe(result.b.length);
    expect(result.r[0]).toBeCloseTo(1, 6);
    expect(result.g[0]).toBeCloseTo(2, 6);
    expect(result.b[0]).toBeCloseTo(3, 6);
  });

  it("sorts out-of-order input samples by timestamp before resampling", () => {
    const samples = [
      { t: 0.2, r: 3, g: 3, b: 3 },
      { t: 0, r: 1, g: 1, b: 1 },
      { t: 0.1, r: 2, g: 2, b: 2 },
    ];
    const result = resampleRoiSamples(samples, 10);
    expect(result.t0).toBeCloseTo(0, 10);
    expect(result.r[0]).toBeCloseTo(1, 6);
  });
});
