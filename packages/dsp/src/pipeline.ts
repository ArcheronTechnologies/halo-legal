import type { RoiSample, RppgWindowResult } from "@halo-pulse/types";
import { combine, type RppgCombinerMethod } from "./combiners.js";
import { HR_BAND_HZ } from "./constants.js";
import { tarvainenDetrend } from "./detrend.js";
import { bandpass } from "./filters.js";
import { computeHrv } from "./hrv.js";
import { detectPeaks } from "./peaks.js";
import { resampleRoiSamples } from "./resample.js";
import { computeSqi } from "./sqi.js";
import { estimateHrFromPsd, welchPsd } from "./welch.js";

export interface ProcessWindowOptions {
  /** Uniform resample target, Hz. Must be well above 2x the HR band's high edge. Default 30. */
  fs?: number;
  method?: RppgCombinerMethod;
  band?: { low: number; high: number };
  detrendLambda?: number;
}

/**
 * The classical rPPG pipeline end-to-end: irregular per-frame ROI samples in, one window's
 * HR/HRV/quality result out. See ARCHITECTURE.md §4.1 for the full step-by-step design this
 * mirrors, and PLAN.md §2.1.1 for how this "classical" layer relates to the (separate,
 * not-yet-implemented) on-device DL layer.
 */
export function processRoiWindow(
  samples: RoiSample[],
  opts: ProcessWindowOptions = {},
): RppgWindowResult {
  const fs = opts.fs ?? 30;
  const band = opts.band ?? HR_BAND_HZ;
  const method = opts.method ?? "pos";

  const uniform = resampleRoiSamples(samples, fs);
  const raw = combine(method, { r: uniform.r, g: uniform.g, b: uniform.b }, fs);
  const detrended = tarvainenDetrend(raw, { lambda: opts.detrendLambda ?? 300 });
  const filtered = bandpass(detrended, { lowHz: band.low, highHz: band.high, fs });

  const psd = welchPsd(filtered, fs);
  const hrBpm = estimateHrFromPsd(psd, band);

  const { ibisMs, ibiTimes } = detectPeaks(filtered, fs, {
    minBpm: band.low * 60,
    maxBpm: band.high * 60,
  });
  const hrv = ibisMs.length >= 2 ? computeHrv(ibisMs, ibiTimes) : null;
  const quality = computeSqi(filtered, psd, band);

  const windowStart = uniform.t0;
  const windowEnd = uniform.t0 + (uniform.r.length - 1) / fs;

  return {
    method,
    layer: "classical",
    windowStart,
    windowEnd,
    hrBpm,
    hrv,
    quality,
  };
}
