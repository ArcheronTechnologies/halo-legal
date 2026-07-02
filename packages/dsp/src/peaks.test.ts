import { describe, expect, it } from "vitest";
import { detectPeaks } from "./peaks.js";

describe("detectPeaks", () => {
  it("finds the expected number of peaks in a clean synthetic pulse train", () => {
    const fs = 30;
    const bpm = 72;
    const hz = bpm / 60;
    const durationSec = 20;
    const n = durationSec * fs;
    // a peaky (not pure-sine) waveform, closer to a real pulse shape
    const signal = Array.from({ length: n }, (_, i) => {
      const t = i / fs;
      const phase = 2 * Math.PI * hz * t;
      return Math.sin(phase) + 0.3 * Math.sin(2 * phase);
    });
    const { peakTimes, ibisMs } = detectPeaks(signal, fs);

    const expectedBeats = durationSec * hz;
    expect(peakTimes.length).toBeGreaterThanOrEqual(expectedBeats - 2);
    expect(peakTimes.length).toBeLessThanOrEqual(expectedBeats + 2);

    const expectedIbiMs = 60000 / bpm;
    for (const ibi of ibisMs) {
      expect(ibi).toBeGreaterThan(expectedIbiMs * 0.85);
      expect(ibi).toBeLessThan(expectedIbiMs * 1.15);
    }
  });

  it("ibiTimes stays parallel to ibisMs", () => {
    const fs = 30;
    const n = 300;
    const signal = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 1.2 * i) / fs));
    const { ibisMs, ibiTimes } = detectPeaks(signal, fs);
    expect(ibiTimes.length).toBe(ibisMs.length);
  });

  it("enforces a minimum distance between peaks derived from maxBpm", () => {
    const fs = 30;
    const n = 300;
    // very high frequency noise that would over-trigger without a minimum-distance constraint
    const signal = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 8 * i) / fs));
    const { peakTimes } = detectPeaks(signal, fs, { minBpm: 40, maxBpm: 200 });
    for (let i = 1; i < peakTimes.length; i++) {
      const gapMs = (peakTimes[i]! - peakTimes[i - 1]!) * 1000;
      expect(gapMs).toBeGreaterThanOrEqual((60000 / 200) * 0.99);
    }
  });
});
