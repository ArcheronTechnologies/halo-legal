import { describe, expect, it } from "vitest";
import { chrom, omit, pos } from "./combiners.js";
import { resampleRoiSamples } from "./resample.js";
import { generateSyntheticRoiSamples } from "./testUtils/synthetic.js";
import { estimateHrFromPsd, welchPsd } from "./welch.js";

const FS = 30;

function recoveredBpm(signal: Float64Array, fs = FS): number {
  const psd = welchPsd(signal, fs);
  return estimateHrFromPsd(psd);
}

describe("rPPG combiners: common-mode interference rejection", () => {
  // POS's projection matrix and OMIT's Householder reflection are both, by construction,
  // exactly orthogonal to the (1,1,1) "skin-tone/illumination" direction — so a pure common-mode
  // interferer (equal relative amplitude on R, G, B) should be nulled exactly, even when it is
  // *larger* than the true pulsatile signal and sits *inside* the pass band (so a plain bandpass
  // filter alone could not remove it). This is the property that makes POS/OMIT meaningfully
  // different from (and more robust than) filtering a single raw channel.
  const pulseHz = 1.2; // 72 bpm
  const interferenceHz = 1.8333; // 110 bpm — also in-band, and 5x the pulse's amplitude
  const samples = generateSyntheticRoiSamples({
    durationSec: 20,
    fps: FS,
    pulseHz,
    pulseAmplitude: [0.008, 0.01, 0.006],
    interference: { hz: interferenceHz, amplitude: 0.05 },
    noiseAmplitude: 0.0008,
    seed: 7,
  });
  const uniform = resampleRoiSamples(samples, FS);
  const window = { r: uniform.r, g: uniform.g, b: uniform.b };

  it("sanity check: the interference really does dominate a naive single-channel read", () => {
    // if this fails, the synthetic fixture isn't actually testing anything discriminating
    const naiveGreenBpm = recoveredBpm(uniform.g);
    expect(naiveGreenBpm).toBeCloseTo(interferenceHz * 60, 0);
  });

  it("POS recovers the true (smaller) pulse frequency despite the larger common-mode interferer", () => {
    const combined = pos(window, FS);
    const bpm = recoveredBpm(combined);
    expect(bpm).toBeCloseTo(pulseHz * 60, 0);
  });

  it("OMIT recovers the true pulse frequency despite the larger common-mode interferer", () => {
    const combined = omit(window);
    const bpm = recoveredBpm(combined);
    expect(bpm).toBeCloseTo(pulseHz * 60, 0);
  });
});

describe("CHROM: realistic (non-adversarial) conditions", () => {
  // CHROM targets specular-reflection cancellation specifically and is documented as less
  // robust to general motion/illumination artifacts than POS (RESEARCH.md §A) — so unlike POS/
  // OMIT above, it is not expected to exactly null an arbitrary large in-band common-mode
  // interferer. This test instead checks the realistic case: a clean pulse with modest slow
  // illumination drift, which is what CHROM's normalization is meant to handle.
  it("recovers the true pulse frequency under modest illumination drift", () => {
    const pulseHz = 1.2;
    const samples = generateSyntheticRoiSamples({
      durationSec: 20,
      fps: FS,
      pulseHz,
      pulseAmplitude: [0.008, 0.01, 0.006],
      driftHz: 0.05,
      driftAmplitude: 0.02,
      noiseAmplitude: 0.0008,
      seed: 11,
    });
    const uniform = resampleRoiSamples(samples, FS);
    const combined = chrom({ r: uniform.r, g: uniform.g, b: uniform.b });
    const bpm = recoveredBpm(combined);
    expect(bpm).toBeCloseTo(pulseHz * 60, 0);
  });
});

describe("pos()", () => {
  it("returns an all-zero signal when the window is shorter than one POS sub-window", () => {
    const samples = generateSyntheticRoiSamples({ durationSec: 0.5, fps: FS, pulseHz: 1.2 });
    const uniform = resampleRoiSamples(samples, FS);
    const combined = pos({ r: uniform.r, g: uniform.g, b: uniform.b }, FS, 1.6);
    expect(Array.from(combined).every((v) => v === 0)).toBe(true);
  });
});
