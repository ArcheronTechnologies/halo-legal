/**
 * Minimal ambient declarations for untyped dependencies. Neither `fili` nor `fft.js` ships
 * TypeScript types, and no `@types/*` package exists for either — see ARCHITECTURE.md §4.2.
 * These cover only the surface this package actually uses.
 */

declare module "fili" {
  export interface IirFilterCoeffs {
    z?: number[];
    a?: number[];
    b?: number[];
    k?: number;
    [key: string]: unknown;
  }

  export interface BandpassParams {
    order: number;
    characteristic: "butterworth" | "bessel";
    Fs: number;
    Fc: number;
    BW: number;
    preGain?: boolean;
  }

  export class CalcCascades {
    bandpass(params: BandpassParams): IirFilterCoeffs;
  }

  export class IirFilter {
    constructor(coeffs: IirFilterCoeffs);
    singleStep(input: number): number;
    multiStep(input: number[], overwrite?: boolean): number[];
    /** Zero-phase forward-backward filtering — no group delay, matches scipy's filtfilt. */
    filtfilt(input: number[], overwrite?: boolean): number[];
    simulate(input: number[]): number[];
  }
}

declare module "fft.js" {
  export default class FFT {
    constructor(size: number);
    size: number;
    createComplexArray(): number[];
    toComplexArray(input: ArrayLike<number>, storage?: number[]): number[];
    fromComplexArray(complex: ArrayLike<number>, storage?: number[]): number[];
    completeSpectrum(spectrum: number[]): void;
    transform(out: number[], data: number[]): void;
    realTransform(out: number[], data: number[]): void;
    inverseTransform(out: number[], data: number[]): void;
  }
}
