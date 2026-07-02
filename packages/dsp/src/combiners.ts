/**
 * Classical rPPG channel combiners — turn three per-ROI RGB-mean traces into a single pulse
 * signal. See PLAN.md §2.1.1 and RESEARCH.md §A. POS is the default, CHROM the fallback/
 * comparison, OMIT the compression-robust option; LGI is documented but not yet implemented
 * (ARCHITECTURE.md — a follow-up, not silently dropped).
 */
import { DEFAULT_POS_WINDOW_SEC } from "./constants.js";
import { mean, normalizeByMean, std } from "./stats.js";

export interface RgbWindow {
  r: ArrayLike<number>;
  g: ArrayLike<number>;
  b: ArrayLike<number>;
}

export type RppgCombinerMethod = "pos" | "chrom" | "omit";

/**
 * CHROM (de Haan & Jeanne, 2013). Rn/Gn/Bn are each channel normalized and mean-centered
 * (Cn = C/mean(C) - 1); the chrominance signals Xs, Ys are a fixed linear combination designed
 * to cancel specular reflection under a standardized-skin assumption; alpha balances their
 * amplitudes before subtracting.
 */
export function chrom(window: RgbWindow): Float64Array {
  const rn = normalizeByMean(window.r);
  const gn = normalizeByMean(window.g);
  const bn = normalizeByMean(window.b);
  const n = rn.length;

  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const r = rn[i]! - 1;
    const g = gn[i]! - 1;
    const b = bn[i]! - 1;
    xs[i] = 3 * r - 2 * g;
    ys[i] = 1.5 * r + g - 1.5 * b;
  }
  const alpha = std(xs) / (std(ys) || 1e-12);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = xs[i]! - alpha * ys[i]!;
  return out;
}

/**
 * POS (Wang, den Brinker, Stuijk & de Haan, 2017), "Algorithmic Principles of Remote-PPG".
 * Projects each 1.6 s sub-window of mean-normalized RGB onto the plane orthogonal to the
 * skin-tone vector via the fixed matrix P = [[0,1,-1],[-2,1,1]], balances the two projected
 * components by their std ratio, mean-centers, and overlap-adds into the output — this sliding,
 * per-sub-window renormalization is what gives POS its robustness to slow illumination drift.
 */
export function pos(
  window: RgbWindow,
  fs: number,
  windowSec = DEFAULT_POS_WINDOW_SEC,
): Float64Array {
  const r = Array.from(window.r);
  const g = Array.from(window.g);
  const b = Array.from(window.b);
  const n = r.length;
  const l = Math.max(2, Math.round(windowSec * fs));

  const H = new Float64Array(n);
  if (n < l) return H; // window shorter than one POS sub-window: nothing to combine yet

  for (let start = 0; start + l <= n; start++) {
    const rSeg = r.slice(start, start + l);
    const gSeg = g.slice(start, start + l);
    const bSeg = b.slice(start, start + l);
    const rn = normalizeByMean(rSeg);
    const gn = normalizeByMean(gSeg);
    const bn = normalizeByMean(bSeg);

    const s1 = new Float64Array(l);
    const s2 = new Float64Array(l);
    for (let i = 0; i < l; i++) {
      s1[i] = gn[i]! - bn[i]!;
      s2[i] = -2 * rn[i]! + gn[i]! + bn[i]!;
    }
    const alpha = std(s1) / (std(s2) || 1e-12);
    const h = new Float64Array(l);
    for (let i = 0; i < l; i++) h[i] = s1[i]! + alpha * s2[i]!;
    const hMean = mean(h);
    for (let i = 0; i < l; i++) {
      H[start + i]! += h[i]! - hMean;
    }
  }
  return H;
}

/**
 * OMIT (Álvarez-Casado et al., 2023, "Face2PPG"). Reference-cited for its robustness to video
 * compression relative to POS/GREEN (RESEARCH.md §A) — relevant because browsers always deliver
 * compressed frames (ARCHITECTURE.md §2.1). This implements OMIT's core idea: a Householder
 * reflection rotates the mean-normalized RGB frame so the skin-tone/illumination direction
 * [1,1,1]/sqrt(3) becomes one axis, leaving an orthogonal 2-D complement that is largely free of
 * that shared illumination component; the two orthogonal components are then combined the same
 * way POS combines its projected components. This is faithful to OMIT's orthogonalization
 * principle but the exact normalization may differ from the reference implementation in
 * rPPG-Toolbox — validate against the Python harness (ARCHITECTURE.md §8) before relying on this
 * for production accuracy claims.
 */
export function omit(window: RgbWindow): Float64Array {
  const rn = normalizeByMean(window.r);
  const gn = normalizeByMean(window.g);
  const bn = normalizeByMean(window.b);
  const n = rn.length;

  const s = 1 / Math.sqrt(3);
  const u: [number, number, number] = [s, s, s];
  let v: [number, number, number] = [u[0] - 1, u[1], u[2]]; // u - e1
  const vNorm = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
  if (vNorm > 1e-12) v = [v[0] / vNorm, v[1] / vNorm, v[2] / vNorm];

  const c1 = new Float64Array(n);
  const c2 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const c0 = rn[i]!;
    const c1v = gn[i]!;
    const c2v = bn[i]!;
    const dotVal = c0 * v[0] + c1v * v[1] + c2v * v[2];
    // Householder reflection H = I - 2vv^T; we only need components 1 and 2 of Hc.
    c1[i] = c1v - 2 * dotVal * v[1];
    c2[i] = c2v - 2 * dotVal * v[2];
  }
  const alpha = std(c1) / (std(c2) || 1e-12);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = c1[i]! - alpha * c2[i]!;
  return out;
}

export function combine(method: RppgCombinerMethod, window: RgbWindow, fs: number): Float64Array {
  switch (method) {
    case "pos":
      return pos(window, fs);
    case "chrom":
      return chrom(window);
    case "omit":
      return omit(window);
    default: {
      const exhaustive: never = method;
      throw new Error(`combine: unknown method ${String(exhaustive)}`);
    }
  }
}
