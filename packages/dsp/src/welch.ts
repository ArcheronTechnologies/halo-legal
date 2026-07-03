import FFT from "fft.js";
import { bpmFromHz, HR_BAND_HZ } from "./constants.js";
import { nextPow2 } from "./stats.js";

export interface WelchResult {
  /** Bin center frequencies, Hz. */
  freqs: Float64Array;
  /** Power spectral density estimate, one value per bin in `freqs`. */
  psd: Float64Array;
  nfft: number;
}

function hannWindow(n: number): Float64Array {
  const w = new Float64Array(n);
  if (n === 1) {
    w[0] = 1;
    return w;
  }
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  }
  return w;
}

function accumulateSegment(
  signal: ArrayLike<number>,
  start: number,
  len: number,
  fft: FFT,
  nfft: number,
  psdAccum: Float64Array,
): void {
  const window = hannWindow(len);
  const segment = new Array<number>(nfft).fill(0);
  for (let i = 0; i < len; i++) segment[i] = signal[start + i]! * window[i]!;

  const out = fft.createComplexArray();
  fft.realTransform(out, segment);
  fft.completeSpectrum(out);

  const half = nfft / 2;
  for (let k = 0; k < half; k++) {
    const re = out[2 * k]!;
    const im = out[2 * k + 1]!;
    psdAccum[k]! += re * re + im * im;
  }
}

export interface WelchOptions {
  /** FFT segment length; rounded up to the next power of two. Default: up to 512. */
  nfft?: number;
  /** Fractional overlap between segments, [0, 0.9]. Default 0.5. */
  overlap?: number;
}

/**
 * Welch's method: average the periodogram of overlapping, Hann-windowed segments. With a signal
 * shorter than one segment, this degenerates to a single zero-padded, windowed periodogram — a
 * standard and acceptable fallback for the short (~10-30s) windows this pipeline processes.
 */
export function welchPsd(
  signal: ArrayLike<number>,
  fs: number,
  opts: WelchOptions = {},
): WelchResult {
  const n = signal.length;
  if (n < 8) throw new Error("welchPsd: signal too short (need at least 8 samples)");

  const nfft = nextPow2(Math.max(8, Math.min(opts.nfft ?? 512, nextPow2(n))));
  const overlap = Math.min(0.9, Math.max(0, opts.overlap ?? 0.5));
  const step = Math.max(1, Math.round(nfft * (1 - overlap)));

  const fft = new FFT(nfft);
  const half = nfft / 2;
  const psdAccum = new Float64Array(half);
  let segCount = 0;

  if (n <= nfft) {
    accumulateSegment(signal, 0, n, fft, nfft, psdAccum);
    segCount = 1;
  } else {
    for (let start = 0; start + nfft <= n; start += step) {
      accumulateSegment(signal, start, nfft, fft, nfft, psdAccum);
      segCount++;
    }
  }

  const freqs = new Float64Array(half);
  const psd = new Float64Array(half);
  const binHz = fs / nfft;
  for (let k = 0; k < half; k++) {
    freqs[k] = k * binHz;
    psd[k] = psdAccum[k]! / segCount;
  }
  return { freqs, psd, nfft };
}

/**
 * Finds the dominant frequency within `band` and returns it as bpm, using parabolic interpolation
 * across the peak's neighboring bins for sub-bin precision.
 */
export function estimateHrFromPsd(result: WelchResult, band = HR_BAND_HZ): number {
  const { freqs, psd } = result;
  let bestIdx = -1;
  let bestVal = -Infinity;
  for (let k = 0; k < freqs.length; k++) {
    const f = freqs[k]!;
    if (f < band.low || f > band.high) continue;
    if (psd[k]! > bestVal) {
      bestVal = psd[k]!;
      bestIdx = k;
    }
  }
  if (bestIdx < 0) throw new Error("estimateHrFromPsd: no spectral energy in the HR band");

  let peakFreq = freqs[bestIdx]!;
  if (bestIdx > 0 && bestIdx < freqs.length - 1) {
    const y0 = psd[bestIdx - 1]!;
    const y1 = psd[bestIdx]!;
    const y2 = psd[bestIdx + 1]!;
    const denom = y0 - 2 * y1 + y2;
    if (Math.abs(denom) > 1e-12) {
      const delta = (0.5 * (y0 - y2)) / denom;
      const binHz = freqs[1]! - freqs[0]!;
      peakFreq += delta * binHz;
    }
  }
  return bpmFromHz(peakFreq);
}
