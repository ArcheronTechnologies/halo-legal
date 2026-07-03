import { describe, expect, it } from "vitest";
import { tarvainenDetrend } from "./detrend.js";
import { std } from "./stats.js";

describe("tarvainenDetrend", () => {
  it("removes a large slow linear trend while preserving a faster oscillation", () => {
    const fs = 30;
    const n = 300; // 10s
    const oscHz = 1.2;
    const oscAmplitude = 1;
    const trendSlope = 50; // a trend far larger than the oscillation over the window
    const signal = Array.from({ length: n }, (_, i) => {
      const t = i / fs;
      return trendSlope * t + oscAmplitude * Math.sin(2 * Math.PI * oscHz * t);
    });

    const detrended = tarvainenDetrend(signal, { lambda: 100 });

    // the trend should be substantially suppressed...
    const first = detrended[0]!;
    const last = detrended[detrended.length - 1]!;
    expect(Math.abs(last - first)).toBeLessThan(trendSlope * (n / fs) * 0.2);

    // ...while the oscillation's amplitude (measured via stddev) survives reasonably intact
    const detrendedStd = std(Array.from(detrended));
    const expectedOscStd = oscAmplitude / Math.SQRT2; // stddev of a sine wave = amplitude/sqrt(2)
    expect(detrendedStd).toBeGreaterThan(expectedOscStd * 0.5);
  });

  it("passes signals shorter than 5 samples through unchanged", () => {
    const short = [1, 2, 3];
    const detrended = tarvainenDetrend(short);
    expect(Array.from(detrended)).toEqual(short);
  });

  it("a constant signal detrends to ~0 everywhere", () => {
    const constant = new Array(50).fill(5);
    const detrended = tarvainenDetrend(constant, { lambda: 100 });
    for (const v of detrended) {
      expect(Math.abs(v)).toBeLessThan(0.5);
    }
  });
});
