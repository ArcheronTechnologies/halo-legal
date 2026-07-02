import { describe, expect, it } from "vitest";
import { bandpass } from "./filters.js";
import { std } from "./stats.js";

describe("bandpass", () => {
  const fs = 30;
  const n = 300;

  it("passes an in-band frequency through with most of its amplitude intact", () => {
    const inBandHz = 1.5; // inside 0.7-4.0 Hz
    const signal = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * inBandHz * i) / fs));
    const filtered = bandpass(signal, { lowHz: 0.7, highHz: 4.0, fs });
    // ignore filter start/end transients when comparing amplitude
    const core = Array.from(filtered).slice(60, -60);
    expect(std(core)).toBeGreaterThan(0.5); // original amplitude's stddev is 1/sqrt(2) ~= 0.707
  });

  it("strongly attenuates a well-below-band frequency (slow drift)", () => {
    const belowHz = 0.05;
    const signal = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * belowHz * i) / fs));
    const filtered = bandpass(signal, { lowHz: 0.7, highHz: 4.0, fs });
    const core = Array.from(filtered).slice(60, -60);
    expect(std(core)).toBeLessThan(0.2);
  });

  it("strongly attenuates a well-above-band frequency", () => {
    const aboveHz = 10;
    const signal = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * aboveHz * i) / fs));
    const filtered = bandpass(signal, { lowHz: 0.7, highHz: 4.0, fs });
    const core = Array.from(filtered).slice(60, -60);
    expect(std(core)).toBeLessThan(0.2);
  });

  it("rejects an invalid band", () => {
    const signal = new Array(100).fill(0);
    expect(() => bandpass(signal, { lowHz: 4, highHz: 0.7, fs })).toThrow();
    expect(() => bandpass(signal, { lowHz: 0.7, highHz: 100, fs })).toThrow();
  });
});
