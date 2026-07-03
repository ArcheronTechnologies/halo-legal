import { describe, expect, it } from "vitest";
import { computeSqi, inBandSnrDb } from "./sqi.js";
import { welchPsd } from "./welch.js";

describe("computeSqi", () => {
  const fs = 30;
  const n = 300;

  it("scores a clean in-band sine wave higher than pure white noise", () => {
    const clean = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 1.2 * i) / fs));
    // deterministic pseudo-noise (avoid Math.random for reproducibility)
    let seed = 123456789;
    const noise = Array.from({ length: n }, () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed / 0x7fffffff) * 2 - 1;
    });

    const cleanPsd = welchPsd(clean, fs);
    const noisePsd = welchPsd(noise, fs);

    const cleanSqi = computeSqi(clean, cleanPsd);
    const noiseSqi = computeSqi(noise, noisePsd);

    expect(cleanSqi.sqi).toBeGreaterThan(noiseSqi.sqi);
    expect(cleanSqi.snrDb).toBeGreaterThan(noiseSqi.snrDb);
  });

  it("inBandSnrDb is high for energy concentrated inside the band", () => {
    const inBand = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 1.5 * i) / fs));
    const psd = welchPsd(inBand, fs);
    expect(inBandSnrDb(psd)).toBeGreaterThan(0);
  });

  it("sqi is always within [0, 1]", () => {
    const signal = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 1.2 * i) / fs));
    const psd = welchPsd(signal, fs);
    const { sqi } = computeSqi(signal, psd);
    expect(sqi).toBeGreaterThanOrEqual(0);
    expect(sqi).toBeLessThanOrEqual(1);
  });
});
