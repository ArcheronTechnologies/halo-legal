import type { RoiSample } from "@halo-pulse/types";

export interface SyntheticSignalOptions {
  durationSec: number;
  fps?: number;
  /** True pulse frequency, Hz (e.g. 1.2 = 72 bpm). */
  pulseHz: number;
  /** Per-channel pulsatile amplitude (fractional), roughly [r, g, b]. Green is usually strongest. */
  pulseAmplitude?: [number, number, number];
  /** An interfering signal applied with EQUAL relative amplitude on all 3 channels (pure common-mode). */
  interference?: { hz: number; amplitude: number; phase?: number };
  /** Slow multiplicative illumination drift, equal on all channels (also pure common-mode). */
  driftHz?: number;
  driftAmplitude?: number;
  /** Gaussian-ish noise amplitude (fractional). */
  noiseAmplitude?: number;
  /** Jitter added to nominal frame timestamps, to emulate uneven webcam frame delivery. */
  timestampJitterSec?: number;
  seed?: number;
}

/** A small deterministic PRNG so tests are reproducible without relying on Math.random(). */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianFrom(rand: () => number): number {
  // Box-Muller
  const u1 = Math.max(rand(), 1e-9);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Generates a synthetic ROI RGB trace with a known embedded pulse frequency, optional
 * common-mode interference/drift, noise, and jittered timestamps — the ground truth against
 * which the rPPG combiners and the end-to-end pipeline are checked in the tests alongside this
 * file.
 */
export function generateSyntheticRoiSamples(opts: SyntheticSignalOptions): RoiSample[] {
  const fps = opts.fps ?? 30;
  const [ar, ag, ab] = opts.pulseAmplitude ?? [0.008, 0.01, 0.006];
  const noiseAmp = opts.noiseAmplitude ?? 0.001;
  const jitter = opts.timestampJitterSec ?? 0;
  const rand = mulberry32(opts.seed ?? 42);

  const n = Math.floor(opts.durationSec * fps);
  const samples: RoiSample[] = [];
  const [R0, G0, B0] = [150, 120, 100]; // plausible mean skin-pixel RGB levels

  for (let i = 0; i < n; i++) {
    const tNominal = i / fps;
    const t = tNominal + (jitter > 0 ? (rand() * 2 - 1) * jitter : 0);

    const pulse = Math.sin(2 * Math.PI * opts.pulseHz * t);
    let commonMode = 0;
    if (opts.interference) {
      commonMode +=
        opts.interference.amplitude *
        Math.sin(2 * Math.PI * opts.interference.hz * t + (opts.interference.phase ?? 0));
    }
    if (opts.driftHz && opts.driftAmplitude) {
      commonMode += opts.driftAmplitude * Math.sin(2 * Math.PI * opts.driftHz * t);
    }

    const noiseR = noiseAmp * gaussianFrom(rand);
    const noiseG = noiseAmp * gaussianFrom(rand);
    const noiseB = noiseAmp * gaussianFrom(rand);

    const r = R0 * (1 + ar * pulse + commonMode + noiseR);
    const g = G0 * (1 + ag * pulse + commonMode + noiseG);
    const b = B0 * (1 + ab * pulse + commonMode + noiseB);

    samples.push({ t, r, g, b });
  }
  return samples;
}

export function bpmFromHz(hz: number): number {
  return hz * 60;
}
