import { describe, expect, it } from "vitest";
import { processRoiWindow } from "./pipeline.js";
import { generateSyntheticRoiSamples } from "./testUtils/synthetic.js";

describe("processRoiWindow (end-to-end classical rPPG pipeline)", () => {
  const trueBpm = 72;
  const trueHz = trueBpm / 60;

  const baseOptions = {
    durationSec: 25,
    fps: 30,
    pulseHz: trueHz,
    pulseAmplitude: [0.008, 0.01, 0.006] as [number, number, number],
    driftHz: 0.03,
    driftAmplitude: 0.015,
    noiseAmplitude: 0.001,
    timestampJitterSec: 0.004, // +/-4ms jitter, plausible for a webcam
  };

  for (const method of ["pos", "chrom", "omit"] as const) {
    it(`recovers heart rate within +/-5 bpm of ${trueBpm} bpm using ${method}`, () => {
      const samples = generateSyntheticRoiSamples({ ...baseOptions, seed: method.length * 101 });
      const result = processRoiWindow(samples, { method, fs: 30 });

      expect(result.method).toBe(method);
      expect(result.layer).toBe("classical");
      expect(result.hrBpm).toBeGreaterThan(trueBpm - 5);
      expect(result.hrBpm).toBeLessThan(trueBpm + 5);
      expect(result.quality.sqi).toBeGreaterThanOrEqual(0);
      expect(result.quality.sqi).toBeLessThanOrEqual(1);
    });
  }

  it("produces a plausible window start/end derived from the input timestamps", () => {
    const samples = generateSyntheticRoiSamples(baseOptions);
    const result = processRoiWindow(samples, { fs: 30 });
    expect(result.windowStart).toBeCloseTo(0, 1);
    expect(result.windowEnd).toBeGreaterThan(20);
    expect(result.windowEnd).toBeLessThanOrEqual(baseOptions.durationSec);
  });

  it("computes HRV (RMSSD present, LF/HF withheld for a 25s window) alongside HR", () => {
    const samples = generateSyntheticRoiSamples(baseOptions);
    const result = processRoiWindow(samples, { fs: 30 });
    expect(result.hrv).not.toBeNull();
    expect(Number.isFinite(result.hrv!.rmssd)).toBe(true);
    expect(result.hrv!.lfhf).toBeNull(); // 25s < LF_HF_MIN_DURATION_SEC (60s) — see VALIDATION.md §1
  });

  it("defaults to the POS method when none is specified", () => {
    const samples = generateSyntheticRoiSamples(baseOptions);
    const result = processRoiWindow(samples);
    expect(result.method).toBe("pos");
  });
});
