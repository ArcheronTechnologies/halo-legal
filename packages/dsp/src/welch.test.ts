import { describe, expect, it } from "vitest";
import { estimateHrFromPsd, welchPsd } from "./welch.js";

describe("welchPsd + estimateHrFromPsd", () => {
  it("recovers the frequency of a pure sine wave within one bin", () => {
    const fs = 30;
    const freqHz = 1.2; // 72 bpm
    const n = 300; // 10s
    const signal = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * freqHz * i) / fs));
    const psd = welchPsd(signal, fs);
    const hr = estimateHrFromPsd(psd);
    expect(hr).toBeCloseTo(freqHz * 60, 0); // within 1 bpm thanks to parabolic interpolation
  });

  it("picks the larger-amplitude peak when two frequencies are both in-band", () => {
    const fs = 30;
    const n = 300;
    const weak = 1.2; // 72 bpm
    const strong = 2.5; // 150 bpm, larger amplitude
    const signal = Array.from(
      { length: n },
      (_, i) =>
        0.3 * Math.sin((2 * Math.PI * weak * i) / fs) +
        1.0 * Math.sin((2 * Math.PI * strong * i) / fs),
    );
    const psd = welchPsd(signal, fs);
    const hr = estimateHrFromPsd(psd);
    expect(hr).toBeCloseTo(strong * 60, 0);
  });

  it("throws only when the requested band has no representable bins at all", () => {
    const fs = 30;
    const n = 300;
    const signal = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 1.2 * i) / fs));
    const psd = welchPsd(signal, fs);
    // a band entirely above Nyquist (fs/2) cannot contain any bin
    expect(() => estimateHrFromPsd(psd, { low: fs, high: fs * 2 })).toThrow();
  });

  it("a signal well outside the HR band still yields a (low-confidence) in-band peak via leakage, not a throw", () => {
    // this is the correct division of labor: welchPsd/estimateHrFromPsd always return *a* peak
    // when the band has bins at all; whether to trust it is the SQI module's job (see sqi.test.ts)
    const fs = 30;
    const n = 300;
    const signal = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 0.1 * i) / fs));
    const psd = welchPsd(signal, fs);
    expect(() => estimateHrFromPsd(psd)).not.toThrow();
  });

  it("handles signals shorter than one FFT segment via zero-padded periodogram", () => {
    const fs = 30;
    const freqHz = 1.5;
    const n = 40; // well under 512
    const signal = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * freqHz * i) / fs));
    const psd = welchPsd(signal, fs);
    expect(psd.psd.length).toBeGreaterThan(0);
    const hr = estimateHrFromPsd(psd);
    expect(hr).toBeGreaterThan(0);
  });
});
