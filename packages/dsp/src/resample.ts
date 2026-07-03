import type { RoiSample } from "@halo-pulse/types";

/** A signal on a uniform time grid, ready for detrending/filtering/spectral analysis. */
export interface UniformSeries {
  fs: number;
  /** Timestamp (seconds) of sample index 0, on the same timeline as the input samples. */
  t0: number;
  values: Float64Array;
}

export interface UniformRgbSeries {
  fs: number;
  t0: number;
  r: Float64Array;
  g: Float64Array;
  b: Float64Array;
}

/**
 * Linear interpolation of an irregularly-sampled (t, value) series onto a uniform grid at `fs`
 * Hz. This is the concrete fix for uneven webcam frame timing described in ARCHITECTURE.md §2.2 —
 * inputs must carry true per-frame timestamps (e.g. requestVideoFrameCallback's mediaTime), not
 * frame-count-based approximations.
 */
export function resampleSeries(
  times: ArrayLike<number>,
  values: ArrayLike<number>,
  fs: number,
): UniformSeries {
  const n = times.length;
  if (n !== values.length) {
    throw new Error("resampleSeries: times and values must have the same length");
  }
  if (n < 2) {
    throw new Error("resampleSeries: need at least 2 samples");
  }
  if (fs <= 0) {
    throw new Error("resampleSeries: fs must be positive");
  }

  const t0 = times[0]!;
  const tEnd = times[n - 1]!;
  if (!(tEnd > t0)) {
    throw new Error("resampleSeries: timestamps must be strictly increasing overall");
  }

  const outLen = Math.floor((tEnd - t0) * fs) + 1;
  const out = new Float64Array(outLen);

  let srcIdx = 0;
  for (let i = 0; i < outLen; i++) {
    const target = t0 + i / fs;
    // advance srcIdx so that times[srcIdx] <= target < times[srcIdx + 1]
    while (srcIdx < n - 2 && times[srcIdx + 1]! <= target) srcIdx++;
    const tA = times[srcIdx]!;
    const tB = times[srcIdx + 1]!;
    const vA = values[srcIdx]!;
    const vB = values[srcIdx + 1]!;
    const span = tB - tA;
    const frac = span > 1e-9 ? (target - tA) / span : 0;
    out[i] = vA + frac * (vB - vA);
  }

  return { fs, t0, values: out };
}

/** Resamples the three per-ROI RGB-mean channels together, onto one shared uniform timeline. */
export function resampleRoiSamples(samples: RoiSample[], fs: number): UniformRgbSeries {
  if (samples.length < 2) {
    throw new Error("resampleRoiSamples: need at least 2 samples");
  }
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  const times = sorted.map((s) => s.t);
  const rSeries = resampleSeries(
    times,
    sorted.map((s) => s.r),
    fs,
  );
  const gSeries = resampleSeries(
    times,
    sorted.map((s) => s.g),
    fs,
  );
  const bSeries = resampleSeries(
    times,
    sorted.map((s) => s.b),
    fs,
  );
  return { fs, t0: rSeries.t0, r: rSeries.values, g: gSeries.values, b: bSeries.values };
}
