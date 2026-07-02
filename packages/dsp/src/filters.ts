import { CalcCascades, IirFilter } from "fili";

export interface BandpassOptions {
  lowHz: number;
  highHz: number;
  fs: number;
  /** Cascaded biquad order per side — see ARCHITECTURE.md §4.2. */
  order?: number;
}

/**
 * Zero-phase Butterworth bandpass (fili's `filtfilt`, matching scipy's `filtfilt` used in the
 * Python harness — ARCHITECTURE.md §4.1 step 4). fili's `bandpass` takes a center frequency and
 * a bandwidth in *octaves* (the standard Audio-EQ-Cookbook bandpass formula fili implements), so
 * a [lowHz, highHz] band is converted to Fc = geometric mean, BW = log2(high/low).
 */
export function bandpass(signal: ArrayLike<number>, opts: BandpassOptions): Float64Array {
  const { lowHz, highHz, fs, order = 2 } = opts;
  if (lowHz <= 0 || highHz <= lowHz || highHz >= fs / 2) {
    throw new Error(`bandpass: invalid range [${lowHz}, ${highHz}] Hz for fs=${fs} Hz`);
  }

  const fc = Math.sqrt(lowHz * highHz);
  const bwOctaves = Math.log2(highHz / lowHz);

  const calculator = new CalcCascades();
  const coeffs = calculator.bandpass({
    order,
    characteristic: "butterworth",
    Fs: fs,
    Fc: fc,
    BW: bwOctaves,
  });
  const filter = new IirFilter(coeffs);
  const input = Array.from(signal);
  const output = filter.filtfilt(input);
  return Float64Array.from(output);
}
